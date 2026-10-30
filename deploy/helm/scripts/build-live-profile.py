#!/usr/bin/env python3
"""Generate the home cutover profile from the verified preview and collectors."""
import argparse
import copy
import json
import importlib.util
from pathlib import Path
import yaml

root = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
load = lambda name: yaml.safe_load((root/name).read_text())
profile = load('deploy/helm/profiles/convergence-home.yaml')
profile['queryAccess'] = {'enabled': True}
profile['api']['alertReceiverUrl'] = 'http://192.168.3.252:8099'
profile['api']['env'] = {'PUBLIC_URL': 'http://192.168.13.12:30081',
    'UNIFI_MGMT_URL': 'https://192.168.100.10:11443', 'PFSENSE_MGMT_URL': 'https://192.168.13.1:440'}
profile['loki'] = {'storage': {'existingClaim': 'convergence-loki-live'},
                   'service': {'type': 'NodePort', 'nodePort': 30310},
                   'resources': {'requests': {'cpu': '250m', 'memory': '256Mi'},
                                 'limits': {'cpu': '4', 'memory': '2Gi'}}}
profile['ids'] = {'enabled': True, 'existingSecret': 'convergence-ids-secrets',
    'existingClaim': 'convergence-ids-live',
    'image': {'repository': 'netclaw-ids-ingest', 'tag': '20261030-prune2'},
    'service': {'type': 'NodePort', 'nodePort': 30445}}
profile['unifi'] = {'enabled': True, 'controllerUrl': 'https://192.168.100.10:11443'}
profile['blackbox'] = {'config': load('deploy/convergence/blackbox/blackbox.yml')}
profile['speedtest'] = {'enabled': True}
spec = importlib.util.spec_from_file_location('flow_renderer', root/'deploy/convergence/flows/render-collector.py')
flow_renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flow_renderer)
flow_config = json.loads(flow_renderer.manifest('observability', 'goflow2', 'goflow2', 'home',
    ['192.168.13.1'], 'http://placeholder:9428')['items'][0]['data']['collector.yaml'])
flow_config['exporters']['otlphttp/flows']['logs_endpoint'] = 'http://{{ .Release.Name }}-logs:9428/insert/opentelemetry/v1/logs'
profile['flowLogs'] = {'enabled': True, 'config': flow_config, 'stateDirectory': '/var/lib/netclaw-flow-logs'}
victoria = profile['victoria']
victoria['logs']['server'].update(retentionPeriod='365d',
    persistentVolume={'existingClaim': 'convergence-logs-live'})
victoria['metrics']['server'].update(retentionPeriod='365d', extraArgs={'dedup.minScrapeInterval': '1ms'})
collector = copy.deepcopy(profile['victoria']['collector']['config'])
canonical = load('deploy/convergence/otel/otel-config.yaml')
collector['receivers'].update({k:v for k,v in canonical['receivers'].items() if k.startswith('snmp/')})
collector['processors'].update({k:v for k,v in canonical['processors'].items() if k.startswith('resource/homeswitch')})
for name, pipeline in canonical['service']['pipelines'].items():
    if name.startswith('metrics/homeswitch'):
        collector['service']['pipelines'][name] = {**pipeline, 'exporters': ['prometheusremotewrite/victoriametrics']}
ids = load('deploy/convergence/ids/otel-ids.yaml')
collector['receivers'].update(ids['receivers'])
collector['service']['pipelines']['metrics/ids'] = {**ids['service']['pipelines']['metrics/ids'],
    'exporters': ['prometheusremotewrite/victoriametrics']}
victoria['collector'].update(config=collector,
    service={'type': 'NodePort', 'nodePort': 30318, 'grpcNodePort': 30317},
    envFrom=[{'secretRef': {'name': 'convergence-collector-secrets'}}],
    extraVolumes=[{'name': 'ids-ca', 'secret': {'secretName': 'convergence-secrets',
        'items': [{'key': 'ids-ca.crt', 'path': 'ids-ca.crt'}]}}],
    extraVolumeMounts=[{'name': 'ids-ca', 'mountPath': '/run/secrets', 'readOnly': True}])
victoria['collector']['extraServicePorts'].append({'name': 'metrics', 'port': 8888, 'targetPort': 8888})
scrapes = []
for job in load('deploy/convergence/prometheus/prometheus.yml')['scrape_configs']:
    if job['job_name'] in ('prometheus', 'generic_snmp_wireless', 'suzieq-rest'):
        continue
    text = json.dumps(job).replace('host.docker.internal', '192.168.3.252')
    for a,b in [('convergence-api:3000','{{ .Release.Name }}-api:3000'),
                ('blackbox:9115','{{ .Release.Name }}-blackbox:9115'),
                ('unifi-exporter:9899','{{ .Release.Name }}-unifi:9899'),
                ('pushgateway:9091','{{ .Release.Name }}-pushgateway:9091'),
                ('otel-collector:8888','{{ .Release.Name }}-collector:8888'),
                ('promtail:9080','192.168.3.252:9080')]:
        text = text.replace(a,b)
    scrapes.append(json.loads(text))
victoria['agent']['extraScrapeConfigs'] = scrapes
am = load('deploy/convergence/alertmanager/alertmanager.yml')
am['receivers'][0]['webhook_configs'][0]['url'] = 'http://192.168.3.252:8099/webhook'
victoria['alerting'].update(alertmanagerConfig=am,
    extraVolumes=[{'name': 'receiver-token', 'secret': {'secretName': 'convergence-secrets',
        'items': [{'key': 'ALERT_RECEIVER_TOKEN', 'path': 'receiver-token'}]}}],
    extraVolumeMounts=[{'name': 'receiver-token', 'mountPath': '/run/secrets', 'readOnly': True}])
path = root/'deploy/helm/profiles/convergence-home-live.yaml'
rendered = '# Live home stack: independent collection and K3s storage. Apply only with the documented migration.\n'+yaml.safe_dump(profile, sort_keys=False)
relay = copy.deepcopy(canonical)
relay['receivers'] = {k:v for k,v in relay['receivers'].items() if k.startswith('syslog/')}
relay['processors'] = {k:v for k,v in relay['processors'].items() if not k.startswith('resource/homeswitch')}
relay['exporters'] = {'otlphttp/k3s': {'endpoint': '${env:K3S_OTLP_ENDPOINT}',
    'timeout': '30s', 'retry_on_failure': {'enabled': True, 'max_elapsed_time': '0s'},
    'sending_queue': {'enabled': True, 'queue_size': 512, 'storage': 'file_storage/otel'}}}
relay['processors']['batch'].update(send_batch_size=512, send_batch_max_size=512)
relay['service']['pipelines'] = {'logs/devices': {**canonical['service']['pipelines']['logs/devices'],
    'exporters': ['otlphttp/k3s']}}
promtail = load('deploy/convergence/promtail/promtail-config.yml')
promtail['clients'] = [{'url': 'http://192.168.13.12:30310/loki/api/v1/push'}]
promtail['positions']['filename'] = '/positions/positions.yaml'
artifacts = {path: rendered,
    root/'deploy/helm/host-relay/otel.yaml': yaml.safe_dump(relay, sort_keys=False),
    root/'deploy/helm/host-relay/promtail.yaml': yaml.safe_dump(promtail, sort_keys=False)}
if args.check:
    for path, rendered in artifacts.items():
        if not path.exists() or path.read_text() != rendered:
            raise SystemExit('Live profile/relay drift; run build-live-profile.py')
else:
    for path, rendered in artifacts.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered)
print('Live profile matches source' if args.check else 'Generated live home profile')
