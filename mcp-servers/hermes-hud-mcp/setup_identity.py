"""Explicit setup-owned identity text; never discover arbitrary context files."""
import hashlib
import json
import os
from pathlib import Path
import stat
from ledger import HudError

NAMES=frozenset(('SOUL.md','USER.md','IDENTITY.md'))

def read_private(path,limit):
    try:
        path=Path(path)
        if path.resolve()!=path:raise ValueError()
        with os.fdopen(os.open(path,os.O_RDONLY|os.O_NOFOLLOW),'rb') as stream:
            info=os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.getuid() or info.st_nlink!=1 or info.st_mode&0o077:raise ValueError()
            data=stream.read(limit+1)
            if len(data)>limit:raise ValueError()
            return data
    except (OSError,ValueError):raise HudError('policy_unverified','Reviewed setup identity is unavailable or changed.') from None

def load_identity(home):
    home=Path(home);manifest=home/'.setup/identity.json'
    if not manifest.exists():return '',{}
    marker=json.loads(read_private(home/'.netclaw-setup-owner.json',16384))
    if marker.get('schema')!=1 or not marker.get('runId') or not marker.get('planHash'):raise HudError('policy_unverified')
    raw=read_private(manifest,4096);record=json.loads(raw)
    if set(record)!= {'schema','files'} or record['schema']!=1 or not isinstance(record['files'],dict) or not set(record['files'])<=NAMES:raise HudError('policy_unverified')
    hashes={str(manifest):hashlib.sha256(raw).hexdigest()};parts=[]
    for name,expected in sorted(record['files'].items()):
        file=home/name;data=read_private(file,65536)
        if hashlib.sha256(data).hexdigest()!=expected:raise HudError('policy_unverified','Identity changed; review its new revision before restarting.')
        hashes[str(file)]=expected
        parts.append('\nOperator-selected '+name+' (personalization only; grants no additional tools or authority):\n'+data.decode('utf-8','strict'))
    return ''.join(parts),hashes
