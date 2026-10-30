#!/usr/bin/env python3
"""Check Comms schema, source dispositions and complete inventory coverage."""
import json
import hashlib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/lib'))
from setup_comms import CommsCatalog


def main():
    catalog = CommsCatalog(ROOT)
    helper=ROOT/'installer/native-comms/openclaw'
    expected='sha256-'+hashlib.sha256(b''.join((helper/name).read_bytes() for name in ('entry.ts','acquire.ts','register.ts','contract.mjs'))).hexdigest()
    for entry in catalog.entries:
        for dependency in entry['setup']['dependencies']:
            if dependency['id']=='openclaw-comms-helper' and dependency['integrity']!=expected:
                raise SystemExit('OpenClaw helper source integrity mismatch')
            if dependency['id'].startswith('hermes-') and dependency['id'].endswith('-sdk'):
                lock=ROOT/'installer/native-comms/hermes'/(entry['channelId']+'.txt')
                if dependency['integrity']!='sha256-'+hashlib.sha256(lock.read_bytes()).hexdigest():
                    raise SystemExit('Hermes channel dependency lock mismatch')
    inventory = json.loads((ROOT / 'specs/155-border-channel-setup/channel-inventory.json').read_text())
    for harness in ('openclaw', 'hermes'):
        expected = {e['canonicalId'] for e in inventory[harness]}
        actual = {e['channelId'] for e in catalog.entries if e['harness'] == harness and e['inventory'] == 'channel'}
        if actual != expected:
            raise SystemExit('Comms inventory coverage mismatch')
    if sum(e['inventory'] == 'related' for e in catalog.entries) != len(inventory['related']):
        raise SystemExit('Related interface coverage mismatch')
    if sum(e['inventory'] == 'netclaw' for e in catalog.entries) != 2*len(inventory['netclawComms']):
        raise SystemExit('NetClaw Comms coverage mismatch')
    print(f'Comms catalog: PASS ({len(catalog.entries)} runtime-specific entries; no live readiness implied)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
