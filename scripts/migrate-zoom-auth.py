#!/usr/bin/env python3
"""Preview/apply Zoom webhook and panel authentication settings without printing secrets."""
import argparse
import getpass
import importlib.util
import os
from pathlib import Path
import shlex

_spec=importlib.util.spec_from_file_location('migration_helpers',Path(__file__).with_name('migrate-voice-auth.py'))
helpers=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(helpers)
KEYS=('ZOOM_RTMS_WEBHOOK_SECRET','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET')


def migrate(path, apply=False, restore=False):
    path=Path(path).absolute();backup=path.with_name(path.name+'.pre-zoom-auth')
    helpers.regular_file(path);helpers.regular_file(backup)
    original=path.read_bytes() if path.exists() else b''
    if restore:
        if not backup.is_file():raise ValueError('No backup')
        helpers.restore_backup(path, backup, apply)
        print('Restored environment.' if apply else 'Preview: restore environment backup.');return
    text=original.decode();current=helpers.values(text)
    missing=[key for key in KEYS if not current.get(key)]
    print('Missing settings: '+(', '.join(missing) or 'none'))
    if not apply:
        print('Preview: preserve credentials; set local webhook/panel bind defaults; create private backup.');return
    updates={key:current.get(key) or os.environ.get(key) or getpass.getpass(key+' (hidden): ') for key in KEYS}
    updates.update(ZOOM_RTMS_WEBHOOK_HOST=current.get('ZOOM_RTMS_WEBHOOK_HOST','127.0.0.1'),
                   ZOOM_PANEL_FEED_HOST=current.get('ZOOM_PANEL_FEED_HOST','127.0.0.1'))
    if any(not value or '\n' in value or '\r' in value for value in updates.values()):raise ValueError('Invalid settings')
    if all(current.get(k)==v for k,v in updates.items()):
        os.chmod(path,0o600);print('Already migrated; unchanged.');return
    lines=[line for line in text.splitlines(keepends=True) if not ((m:=helpers.ASSIGNMENT.match(line.strip())) and m[1] in updates)]
    output=''.join(lines).rstrip('\n')+'\n'+''.join(k+'='+helpers.quote(v)+'\n' for k,v in updates.items())
    if path.exists():
        fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as stream:stream.write(original);stream.flush();os.fsync(stream.fileno())
    helpers.write_migrated(path, output.encode(), backup);print('Migrated; restart Zoom service and reopen panel. No secrets printed.')


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
    p.add_argument('--apply',action='store_true');p.add_argument('--restore',action='store_true');a=p.parse_args()
    try:migrate(a.env_file,a.apply,a.restore)
    except (OSError,ValueError,EOFError):
        print('Migration stopped; check environment/backup and required settings. No secrets printed.');return 1
    return 0


if __name__=='__main__':raise SystemExit(main())
