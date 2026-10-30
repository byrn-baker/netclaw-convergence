"""Installer-owned voice routing. Legacy deployments retain their own policy."""
import hashlib
import json
import os
from pathlib import Path
import stat
import uuid
from urllib.parse import urlsplit


def is_managed():
    return os.environ.get('NETCLAW_COMMS_MANAGED')=='1'


def private_json(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        info=os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.getuid() or info.st_mode&0o077 or info.st_size>1024*1024:
            raise ValueError('voice_private_state_required')
        with os.fdopen(fd,'r',closefd=False) as stream:return json.load(stream)
    finally:os.close(fd)


def owned_home():
    value=os.environ.get('NETCLAW_RUNTIME_ENV','');file=Path(value)
    if not file.is_absolute() or file.name!='.env':raise ValueError('voice_owner_required')
    home=file.parent
    info=home.stat()
    if home.resolve()!=home or not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.getuid() or info.st_mode&0o077:raise ValueError('voice_owner_required')
    marker=private_json(home/'.netclaw-setup-owner.json')
    identity=private_json(home/'netclaw-hud/installation.json')
    expected=str(uuid.uuid5(uuid.NAMESPACE_URL,'netclaw:'+str(marker.get('runId'))+':'+str(marker.get('installationId'))))
    if (not marker.get('installationId') or not marker.get('runId') or
        identity.get('installationId')!=expected or expected!=os.environ.get('NETCLAW_INSTALLATION_ID')):
        raise ValueError('voice_owner_mismatch')
    return home


def gateway_binding():
    """Return only the selected OpenClaw gateway; Hermes voice is unqualified."""
    if not is_managed():return None
    try:
        if os.environ.get('NETCLAW_RUNTIME')!='openclaw':return None
        home=owned_home();config=private_json(home/'openclaw.json')
        url=os.environ.get('OPENCLAW_GATEWAY_URL','');parsed=urlsplit(url)
        token=os.environ.get('OPENCLAW_GATEWAY_TOKEN','')
        if (parsed.scheme!='http' or parsed.hostname!='127.0.0.1' or parsed.username or parsed.password or
            parsed.path not in ('','/') or parsed.query or parsed.fragment or
            parsed.port!=config.get('gateway',{}).get('port') or len(token)<32):return None
        auth=config.get('gateway',{}).get('auth',{})
        if auth.get('mode')!='token' or auth.get('token')!={'source':'env','provider':'default','id':'OPENCLAW_GATEWAY_TOKEN'}:return None
        return {'url':url.rstrip('/'),'token':token}
    except (OSError,ValueError,TypeError):return None


def context_directory():
    root=owned_home()
    for part in ('voice','contexts'):
        root=root/part
        if root.is_symlink():raise ValueError('voice_context_alias_refused')
        root.mkdir(mode=0o700,exist_ok=True)
        info=root.stat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.getuid() or info.st_mode&0o077:raise ValueError('voice_private_context_required')
    return root


def context_name(caller_id):
    return hashlib.sha256(caller_id.encode()).hexdigest()+'.json'


def write_context(path,value):
    if path.is_symlink():raise ValueError('voice_context_alias_refused')
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_NOFOLLOW,0o600)
    try:
        info=os.fstat(fd)
        if info.st_uid!=os.getuid() or info.st_mode&0o077 or not stat.S_ISREG(info.st_mode):raise ValueError('voice_private_context_required')
        data=json.dumps(value).encode();os.ftruncate(fd,0)
        with os.fdopen(fd,'wb',closefd=False) as stream:stream.write(data);stream.flush();os.fsync(fd)
    finally:os.close(fd)
