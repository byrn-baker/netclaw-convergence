import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import pytest
import yaml

ROOT=Path(__file__).resolve().parents[3]
HELM=os.environ.get('HELM_BIN',str(Path.home()/'.local/bin/helm'))
CHART=ROOT/'deploy/helm'

def render(chart,release='example',namespace='example',*args):
    p=subprocess.run([HELM,'template',release,str(CHART/chart),'-n',namespace,*args],capture_output=True,text=True,check=True)
    return [d for d in yaml.safe_load_all(p.stdout) if d]

def test_generic_stacks_do_not_collide_or_deploy_another_grafana():
    a=render('victoria-stack','alpha','project-a','--set','sharedGrafana.enabled=true')
    b=render('victoria-stack','beta','project-b','--set','sharedGrafana.enabled=true')
    def identities(objects,ns):return {(d['kind'],d['metadata'].get('namespace',ns),d['metadata']['name']) for d in objects}
    assert not identities(a,'project-a') & identities(b,'project-b')
    for objects in (a,b):
        assert not any(d['kind'] in ('ClusterRole','ClusterRoleBinding','Secret') for d in objects)
        assert not any(d['kind'] in ('Deployment','StatefulSet') and any('grafana/grafana' in c['image'] for c in d['spec']['template']['spec']['containers']) for d in objects)
        stores=[d for d in objects if d['kind']=='StatefulSet']
        assert len(stores)==5
        for store in stores:
            for volume in store['spec']['volumeClaimTemplates']:
                assert volume['spec']['storageClassName']=='longhorn'
        config=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name'].endswith('victoria-config'))
        assert yaml.safe_load(config['data']['alertmanager.yml'])['receivers']==[{'name':'quiet'}]
        bundle=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name'].endswith('grafana-bundle'))
        sources=json.loads(bundle['data']['datasources.json'])
        assert all(s['isDefault'] is False for s in sources)
        assert len({s['uid'] for s in sources})==2


def test_convergence_parallel_profile_keeps_writes_local_and_secrets_external():
    objects=render('convergence','convergence','netclaw-convergence','-f',str(CHART/'profiles/convergence-home.yaml'))
    services={d['metadata']['name'] for d in objects if d['kind']=='Service'}
    assert {'convergence-api','convergence-postgres','convergence-loki','convergence-metrics','convergence-logs','convergence-agent','convergence-collector','convergence-alertmanager','convergence-vmalert'}<=services
    api=next(d for d in objects if d['kind']=='Deployment' and d['metadata']['name']=='convergence-api')
    container=api['spec']['template']['spec']['containers'][0]
    values={e['name']:e.get('value') for e in container['env']}
    assert values['ALERT_RECEIVER_URL']==''
    assert values['PROMETHEUS_URL']=='http://convergence-metrics:8428'
    assert values['VICTORIAMETRICS_URL']=='http://convergence-metrics:8428'
    assert values['API_RATE_LIMIT_PER_MINUTE']=='1000'
    assert container['envFrom']==[{'secretRef':{'name':'convergence-secrets'}}]
    assert not any(d['kind']=='Secret' for d in objects)
    config=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name']=='convergence-victoria-config')
    collector=yaml.safe_load(config['data']['collector.yml'])
    assert not any(k.startswith('snmp/') for k in collector['receivers'])
    assert '192.168.3.252:9090' in config['data']['agent.yml']
    assert collector['exporters']['loki']['endpoint']=='http://convergence-loki:3100/loki/api/v1/push'
    assert collector['extensions']['file_storage/otel']['directory']=='/data'
    bundle=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name']=='convergence-grafana-bundle')
    sources=json.loads(bundle['data']['datasources.json'])
    assert len(sources)==3 and all(s['isDefault'] is False for s in sources)
    assert len({s['uid'] for s in sources})==3


def test_chart_rejects_missing_application_credentials():
    p=subprocess.run([HELM,'template','test',str(CHART/'convergence'),'--set','api.image.tag=test'],capture_output=True,text=True)
    assert p.returncode and 'existingSecret' in p.stderr


def test_live_profile_moves_storage_and_collection_without_embedding_secrets():
    subprocess.run([sys.executable,str(CHART/'scripts/build-live-profile.py'),'--check'],check=True,capture_output=True)
    objects=render('convergence','convergence','netclaw-convergence','-f',str(CHART/'profiles/convergence-home-live.yaml'))
    assert not any(d['kind']=='Secret' for d in objects)
    config=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name']=='convergence-victoria-config')
    assert 'federate' not in config['data']['agent.yml'] and '192.168.3.252:9090' not in config['data']['agent.yml']
    collector=yaml.safe_load(config['data']['collector.yml'])
    assert len([k for k in collector['receivers'] if k.startswith('snmp/')])==3
    assert 'prometheus/ids' in collector['receivers']
    ids=next(d for d in objects if d['kind']=='Deployment' and d['metadata']['name']=='convergence-ids')
    assert ids['spec']['strategy']['type']=='Recreate'
    assert ids['spec']['template']['spec']['volumes'][0]['persistentVolumeClaim']['claimName']=='convergence-ids-live'
    assert ids['spec']['template']['spec']['containers'][0]['startupProbe']['httpGet']['scheme']=='HTTPS'
    am=yaml.safe_load(config['data']['alertmanager.yml'])
    webhook=am['receivers'][0]['webhook_configs'][0]
    assert webhook['http_config']['authorization']['credentials_file']=='/run/secrets/receiver-token'
    assert webhook['url']=='http://192.168.3.252:8099/webhook'
    services={d['metadata']['name']:d for d in objects if d['kind']=='Service'}
    for name in ('metrics','logs'):
        assert services[f'convergence-{name}-access']['spec']['selector']==services[f'convergence-{name}']['spec']['selector']
    flows=next(d for d in objects if d['kind']=='DaemonSet' and d['metadata']['name']=='convergence-flow-logs')
    assert flows['spec']['template']['spec']['automountServiceAccountToken'] is False
    flow_config=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name']=='convergence-flow-logs')
    assert 'http://convergence-logs:9428/' in flow_config['data']['collector.yaml']
    assert '192.168.3.252:9428' not in flow_config['data']['collector.yaml']
    relay=yaml.safe_load((CHART/'host-relay/otel.yaml').read_text())
    assert all(k.startswith('syslog/') for k in relay['receivers'])
    assert set(relay['service']['pipelines'])=={'logs/devices'}
    assert relay['exporters']['otlphttp/k3s']['sending_queue']['queue_size']==512


def registrar():
    spec=importlib.util.spec_from_file_location('registrar',CHART/'victoria-stack/files/register-grafana.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def test_shared_grafana_merge_preserves_defaults_and_is_idempotent():
    r=registrar();original={'apiVersion':1,'datasources':[{'uid':'prometheus','name':'Prometheus','isDefault':True,'url':'http://existing'}]}
    sources=[{'uid':'project-metrics','name':'My project / Metrics','isDefault':False,'url':'http://project'}]
    a=r.merge_sources(original,sources);b=r.merge_sources(a,sources)
    assert a==b and len(b['datasources'])==2
    assert b['datasources'][0]==original['datasources'][0]
    assert len(original['datasources'])==1
    with pytest.raises(ValueError):r.merge_sources(original,[{**sources[0],'name':'Prometheus'}])


def test_dashboard_copies_use_project_uids_without_mutating_existing_boards():
    r=registrar();raw={'uid':'convergence-ids','title':'IDS','panels':[{'datasource':{'type':'prometheus','uid':'victoriametrics-longterm'}}]}
    board=r.project_dashboard(raw,'abcd','namespace/release',{'victoriametrics-longterm':'project-metrics'})
    assert board['uid']=='abcd-convergence-ids' and board['panels'][0]['datasource']['uid']=='project-metrics'
    assert raw['uid']=='convergence-ids' and raw['panels'][0]['datasource']['uid']=='victoriametrics-longterm'


def test_canonical_assets_have_not_drifted():
    subprocess.run([sys.executable,str(CHART/'scripts/sync-assets.py'),'--check'],check=True,capture_output=True)


def test_complete_registrar_flow_is_idempotent_and_preserves_shared_grafana(monkeypatch):
    import copy
    r=registrar()
    objects=render('victoria-stack','alpha','project-a','--set','sharedGrafana.enabled=true')
    bundle=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name']=='alpha-grafana-bundle')
    uid=json.loads(bundle['data']['datasources.json'])[0]['uid'].removesuffix('-metrics')
    original={'uid':'prometheus','name':'Prometheus','url':'http://original','isDefault':True}
    class Fake:
        def __init__(self):
            self.maps={'grafana-datasources':{'metadata':{'resourceVersion':'1'},'data':{'datasources.yml':yaml.safe_dump({'apiVersion':1,'datasources':[original]})}},
                       'grafana-dashboards':{'metadata':{'resourceVersion':'1'},'data':{'original.json':'{"uid":"original"}'}}}
            self.restarts=0
        def request(self,path,method='GET',data=None):
            if 'labelSelector=' in path:return {'items':[bundle]}
            if '/deployments/' in path:
                self.restarts+=1;return {}
            name=path.rsplit('/',1)[-1]
            if method=='GET':return copy.deepcopy(self.maps[name])
            assert data['metadata']['resourceVersion']==self.maps[name]['metadata']['resourceVersion']
            self.maps[name]['data']=data['data'];self.maps[name]['metadata']['resourceVersion']=str(int(data['metadata']['resourceVersion'])+1)
            return copy.deepcopy(self.maps[name])
    fake=Fake();monkeypatch.setattr(r,'Kubernetes',lambda:fake)
    for key,value in {'RELEASE_NAMESPACE':'project-a','RELEASE_NAME':'alpha','STACK_UID':uid,'GRAFANA_NAMESPACE':'observability','DATASOURCE_CONFIGMAP':'grafana-datasources','DATASOURCE_KEY':'datasources.yml','DASHBOARD_CONFIGMAP':'grafana-dashboards','GRAFANA_DEPLOYMENT':'grafana'}.items():monkeypatch.setenv(key,value)
    r.main();r.main()
    assert fake.restarts==1
    sources=yaml.safe_load(fake.maps['grafana-datasources']['data']['datasources.yml'])['datasources']
    assert len(sources)==3 and sources[0]==original
    assert fake.maps['grafana-dashboards']['data']['original.json']=='{"uid":"original"}'


def test_argocd_profile_uses_pullable_images_and_has_no_shared_namespace_writes():
    objects=render('convergence','convergence','netclaw-convergence',
                   '-f',str(CHART/'profiles/convergence-home-live.yaml'),
                   '-f',str(CHART/'profiles/convergence-home-argocd.yaml'))
    assert not any(d['kind'] in ('Secret','PersistentVolumeClaim') for d in objects)
    assert not any(d['metadata'].get('namespace','netclaw-convergence') != 'netclaw-convergence' for d in objects)
    assert all(d['metadata'].get('annotations',{}).get('helm.sh/hook') in (None,'test') for d in objects)
    assert not any('grafana-registrar' in d['metadata']['name'] for d in objects)
    assert any(d['metadata']['name']=='convergence-grafana-bundle' for d in objects)
    for component in ('api','ids'):
        pod=next(d['spec']['template']['spec'] for d in objects if d['kind']=='Deployment' and d['metadata']['name']=='convergence-'+component)
        assert pod['imagePullSecrets']==[{'name':'ghcr-pull'}]
        assert pod['containers'][0]['image'].startswith('ghcr.io/byrn-baker/')
        assert '@sha256:' in pod['containers'][0]['image']
    cron=next(d for d in objects if d['kind']=='CronJob')
    assert cron['spec']['jobTemplate']['spec']['template']['spec']['imagePullSecrets']==[{'name':'ghcr-pull'}]


def test_offline_grafana_merge_preserves_existing_projects_and_is_idempotent():
    spec=importlib.util.spec_from_file_location('gitops_merge',CHART/'scripts/merge-grafana-gitops.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    objects=render('victoria-stack','alpha','project-a','--set','sharedGrafana.enabled=true','--set','sharedGrafana.registrationMode=external')
    existing={'uid':'existing','name':'Existing','isDefault':True,'url':'http://existing'}
    sources={'data':{'datasources.yml':yaml.safe_dump({'apiVersion':1,'datasources':[existing]})}}
    boards={'data':{'existing.json':'{"uid":"existing"}'}}
    module.merge(objects,'project-a','alpha',sources,boards)
    before=json.dumps([sources,boards],sort_keys=True)
    module.merge(objects,'project-a','alpha',sources,boards)
    assert json.dumps([sources,boards],sort_keys=True)==before
    assert yaml.safe_load(sources['data']['datasources.yml'])['datasources'][0]==existing
    assert boards['data']['existing.json']=='{"uid":"existing"}'
    with pytest.raises(ValueError):module.merge(objects,'wrong-namespace','alpha',sources,boards)


def test_portable_fresh_bundle_renders_optional_grafana_and_local_path(tmp_path):
    import sys
    scripts=ROOT/'workspace/skills/convergence-setup/scripts'
    sys.path.insert(0,str(scripts))
    spec=importlib.util.spec_from_file_location('fresh_k3s',scripts/'k3s.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    bundle=tmp_path/'bundle'
    module.prepare(ROOT,bundle,{'context':'test','namespace':'office-obs','release':'office',
        'site':'office','storage_class':'local-path','image':'api:test','grafana':True})
    objects=render('convergence','office','office-obs','-f',str(bundle/'values.json'))
    assert not any(d['kind']=='Secret' for d in objects)
    config=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name']=='office-application-config')
    assert json.loads(config['data']['SITES_CONFIG'])=={'office':{'name':'office'}}
    grafana=next(d for d in objects if d['kind']=='StatefulSet' and d['metadata']['name']=='office-grafana')
    container=grafana['spec']['template']['spec']['containers'][0]
    env={e['name']:e for e in container['env']}
    assert env['GF_AUTH_ANONYMOUS_ENABLED']['value']=='false'
    assert env['GF_SECURITY_ADMIN_PASSWORD']['valueFrom']['secretKeyRef']['name']=='office-credentials'
    for obj in objects:
        if obj['kind']=='StatefulSet':
            assert obj['spec'].get('persistentVolumeClaimRetentionPolicy',{}).get('whenDeleted','Retain')=='Retain'
            assert all(v['spec']['storageClassName']=='local-path' for v in obj['spec']['volumeClaimTemplates'])
    config=next(d for d in objects if d['kind']=='ConfigMap' and d['metadata']['name']=='office-grafana')
    assert json.loads(config['data']['health.json'])['uid']=='convergence-installation'
    assert all(d['spec'].get('type','ClusterIP')=='ClusterIP' for d in objects if d['kind']=='Service')
