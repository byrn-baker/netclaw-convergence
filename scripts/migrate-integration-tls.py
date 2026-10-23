#!/usr/bin/env python3
"""Preview/apply/restore verified integration transport configuration."""
import argparse
import importlib.util
import os
from pathlib import Path
import ssl

spec=importlib.util.spec_from_file_location('env_helpers',Path(__file__).with_name('migrate-voice-auth.py'))
helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)


def migrate(path, ca=None, lab_insecure=False, apply=False, restore=False, service="redfish"):
    keys={"redfish":("REDFISH_VERIFY_TLS","REDFISH_CA_BUNDLE"),
          "nautobot":("NAUTOBOT_VERIFY_SSL","NAUTOBOT_CA_BUNDLE"),
          "anta":("ANTA_VERIFY_TLS","ANTA_CA_BUNDLE")}
    if service not in keys:raise ValueError("Unknown service")
    verify_key,ca_key=keys[service]
    path=Path(path).absolute();backup=path.with_name(path.name+'.pre-'+service+'-tls')
    helpers.regular_file(path);helpers.regular_file(backup)
    original=path.read_bytes() if path.exists() else b''
    if restore:
        if not backup.is_file():raise ValueError('No backup')
        helpers.restore_backup(path, backup, apply)
        print('Restored environment.' if apply else 'Preview: restore environment backup.');return
    if ca and lab_insecure:raise ValueError('CA trust and lab-insecure are mutually exclusive')
    if ca:ssl.create_default_context(cafile=str(Path(ca).absolute()))
    updates={verify_key:'false' if lab_insecure else 'true'}
    if ca:updates[ca_key]=str(Path(ca).absolute())
    print(('Apply: ' if apply else 'Preview: ')+', '.join(updates)+'; preserve credentials.')
    if lab_insecure:print('Explicit lab override: Service identity will NOT be verified.')
    if not apply:return
    text=original.decode();current=helpers.values(text)
    if all(current.get(k)==v for k,v in updates.items()):
        os.chmod(path,0o600);print('Already migrated.');return
    lines=[line for line in text.splitlines(keepends=True) if not ((m:=helpers.ASSIGNMENT.match(line.strip())) and m[1] in updates)]
    output=''.join(lines).rstrip('\n')+'\n'+''.join(k+'='+helpers.quote(v)+'\n' for k,v in updates.items())
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    if path.exists():
        fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as stream:stream.write(original);stream.flush();os.fsync(stream.fileno())
    helpers.write_migrated(path, output.encode(), backup);print('Migrated; restart the selected MCP. No service contacted.')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
    p.add_argument('--service',choices=('redfish','nautobot','anta'),default='redfish')
    p.add_argument('--ca-bundle');p.add_argument('--lab-insecure',action='store_true')
    p.add_argument('--apply',action='store_true');p.add_argument('--restore',action='store_true');a=p.parse_args()
    try:migrate(a.env_file,a.ca_bundle,a.lab_insecure,a.apply,a.restore,a.service)
    except (OSError,ValueError):
        print('Migration stopped; check paths, CA certificate and backup. No secret values printed.');return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
