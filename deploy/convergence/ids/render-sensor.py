#!/usr/bin/env python3
"""Adapt the image's upstream Suricata defaults for an ERSPAN Type II sensor."""
import argparse
import ipaddress
from pathlib import Path
import yaml

p = argparse.ArgumentParser()
p.add_argument('--base', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--interface', default='eth0')
p.add_argument('--switch-ip', required=True)
p.add_argument('--sensor-ip', required=True)
p.add_argument('--home-net', required=True, help='Comma separated IPv4/IPv6 CIDRs')
args = p.parse_args()
ipaddress.ip_address(args.switch_ip)
ipaddress.ip_address(args.sensor_ip)
networks = [str(ipaddress.ip_network(n)) for n in args.home_net.split(',')]
c = yaml.safe_load(args.base.read_text())
c['vars']['address-groups']['HOME_NET'] = '['+','.join(networks)+']'
# Internal endpoints must not be exempt from rules that use EXTERNAL_NET.
c['vars']['address-groups']['EXTERNAL_NET'] = 'any'
c['default-rule-path'] = '/var/lib/suricata/rules'
c['rule-files'] = ['suricata.rules', '/etc/suricata/local.rules']
c['default-log-dir'] = '/var/log/suricata'
c['stats'] = {'enabled': True, 'interval': 30}
c['af-packet'] = [{'interface': args.interface, 'threads': 1, 'cluster-id': 99,
    'cluster-type': 'cluster_flow', 'defrag': True, 'use-mmap': True,
    'tpacket-v3': True, 'ring-size': 65536,
    'bpf-filter': f'ip proto 47 and src host {args.switch_ip} and dst host {args.sensor_ip}'}]
# Decode the ERSPAN header natively to retain its original VLAN ID. Autofp
# distributes decoded inner flows to detection workers after the capture thread.
c['runmode'] = 'autofp'
c['outputs'] = [{'eve-log': {'enabled': True, 'filetype': 'regular',
    'filename': 'eve-%Y%m%d%H%M.json', 'rotate-interval': 3600,
    'community-id': True, 'types': [
        {'alert': {'payload': False, 'packet': False}}, {'stats': {'totals': True, 'threads': False}},
        'flow', {'dns': {'requests': True, 'responses': True}}, {'tls': {'extended': True}},
    ]}}]
args.output.write_text('%YAML 1.1\n---\n'+yaml.safe_dump(c, sort_keys=False))
