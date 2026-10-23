#!/usr/bin/env python3
"""Preflight and adopt mandatory production change verification; never creates a CR."""
import argparse
import importlib.util
import os
from pathlib import Path
from urllib.parse import urlsplit

spec=importlib.util.spec_from_file_location('helpers',Path(__file__).with_name('migrate-voice-auth.py'))
helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
REQUIRED=('SERVICENOW_INSTANCE_URL','SERVICENOW_USERNAME','SERVICENOW_PASSWORD')


def migrate(path, apply=False, restore=False):
    path=Path(path).absolute();backup=path.with_name(path.name+'.pre-change-gates')
    helpers.regular_file(path);helpers.regular_file(backup)
    original=path.read_bytes() if path.exists() else b''
    if restore:
        if not backup.is_file():raise ValueError('No backup')
        helpers.restore_backup(path, backup, apply)
        print('Restored environment.' if apply else 'Preview: restore environment backup.');return
    current=helpers.values(original.decode())
    updates={key:current.get(key) or os.environ.get(key,'') for key in REQUIRED}
    missing=[key for key,value in updates.items() if not value]
    print('Missing ServiceNow settings: '+(', '.join(missing) or 'none'))
    print('Production writes require the exact approved CR in Implement state; unavailable verification blocks writes.')
    if not apply:
        print('Preview only; no writes, ServiceNow requests or credential values displayed.');return
    if missing:raise ValueError('Configure missing settings before applying')
    url=urlsplit(updates['SERVICENOW_INSTANCE_URL'])
    if url.scheme!='https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('ServiceNow endpoint must be an HTTPS base URL without credentials/query')
    updates['NETCLAW_LAB_MODE']='false'
    for value in updates.values():helpers.quote(value)
    if all(current.get(k)==v for k,v in updates.items()):
        os.chmod(path,0o600);print('Already migrated.');return
    lines=[line for line in original.decode().splitlines(keepends=True) if not ((m:=helpers.ASSIGNMENT.match(line.strip())) and m[1] in updates)]
    output=''.join(lines).rstrip('\n')+'\n'+''.join(k+'='+helpers.quote(v)+'\n' for k,v in updates.items())
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    if path.exists():
        fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as stream:stream.write(original);stream.flush();os.fsync(stream.fileno())
    helpers.write_migrated(path, output.encode(), backup)
    print('Production settings written; backup retained. Restart affected MCPs. No CR or device changed.')


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
    p.add_argument('--apply',action='store_true');p.add_argument('--restore',action='store_true');a=p.parse_args()
    try:migrate(a.env_file,a.apply,a.restore)
    except (OSError,ValueError):
        print('Migration stopped; check missing settings, HTTPS endpoint and backup. No secret values printed.');return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
