#!/usr/bin/env python3
"""Preview/apply secure iN2N transport settings; preserve a private rollback file."""
import argparse
import importlib.util
import os
from pathlib import Path
import shlex
import ssl
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'mcp-servers/protocol-mcp'))
from bgp.federation.internal_security import is_loopback
_spec=importlib.util.spec_from_file_location('migration_helpers',Path(__file__).with_name('migrate-voice-auth.py'))
helpers=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(helpers)


def migrate(path, bind='127.0.0.1', cert=None, key=None, ca=None, apply=False, restore=False):
    path=Path(path).absolute();backup=path.with_name(path.name+'.pre-in2n-tls')
    helpers.regular_file(path);helpers.regular_file(backup)
    original=path.read_bytes() if path.exists() else b''
    if restore:
        if not backup.is_file():raise ValueError('No backup')
        helpers.restore_backup(path, backup, apply)
        print('Restored environment.' if apply else 'Preview: restore environment backup.')
        return
    if not bind or '\n' in bind or '\r' in bind:raise ValueError('Invalid bind')
    if not is_loopback(bind) and not (cert and key):raise ValueError('Remote listener requires certificate and key')
    if bool(cert)!=bool(key):raise ValueError('Supply certificate and key together')
    updates={'N2N_IN2N_BIND':bind}
    if cert:
        ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain(cert,key)
        updates.update(N2N_IN2N_TLS_CERT=str(Path(cert).absolute()),N2N_IN2N_TLS_KEY=str(Path(key).absolute()))
    if ca:
        ssl.create_default_context(cafile=ca)
        updates.update(N2N_IN2N_CA_FILE=str(Path(ca).absolute()),N2N_IN2N_TLS='true')
    if any('\n' in value or '\r' in value for value in updates.values()):raise ValueError('Invalid path')
    print(('Apply: ' if apply else 'Preview: ')+', '.join(updates)+'; other settings preserved.')
    if not apply:return
    text=original.decode();current=helpers.values(text)
    if all(current.get(k)==v for k,v in updates.items()):
        os.chmod(path,0o600);print('Already migrated; unchanged.');return
    lines=[line for line in text.splitlines(keepends=True) if not ((m:=helpers.ASSIGNMENT.match(line.strip())) and m[1] in updates)]
    output=''.join(lines).rstrip('\n')+'\n'+''.join(k+'='+helpers.quote(v)+'\n' for k,v in updates.items())
    if path.exists():
        fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as stream:
            stream.write(original);stream.flush();os.fsync(stream.fileno())
    helpers.write_migrated(path, output.encode(), backup);print('Migrated. Upgrade both endpoints before restarting distributed connections.')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
    p.add_argument('--bind',default='127.0.0.1');p.add_argument('--cert');p.add_argument('--key');p.add_argument('--ca-file')
    p.add_argument('--apply',action='store_true');p.add_argument('--restore',action='store_true');a=p.parse_args()
    try:migrate(a.env_file,a.bind,a.cert,a.key,a.ca_file,a.apply,a.restore)
    except (OSError,ValueError):
        print('Migration stopped. Check TLS files, bind address and backup; no secret values printed.');return 1
    return 0


if __name__=='__main__':raise SystemExit(main())
