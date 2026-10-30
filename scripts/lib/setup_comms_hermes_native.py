"""Owned Hermes Node prerequisites and one-shot WhatsApp pairing.

The selected upstream sources and lockfiles are immutable inputs. A started
dependency acquisition or account-pair attempt never automatically repeats.
"""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import shlex
import sys

from setup_schema import canonical,loads
from setup_state import Conflict,guarded_read,directory,revision

PIN='818c13be1dc4fd28987e1e881a9408224afd4535'
HOMEASSISTANT_PIN='ba30cb0cf86c52bdb5cde98974bc062e97966529'

def homeassistant_contract(repository):
    base=Path(repository)/'installer/native-comms/hermes/homeassistant'
    contract=loads(guarded_read(base/'source.json',16384))
    if contract.get('schema')!=1 or contract.get('revision')!=HOMEASSISTANT_PIN or contract.get('version')!='2.0.1':
        raise Conflict('comms_external_plugin_pin')
    files=contract.get('files',{})
    if set(files)!={'__init__.py','adapter.py','tools.py','plugin.yaml','LICENSE'}:raise Conflict('comms_external_plugin_files')
    for name,digest in files.items():
        if hashlib.sha256(guarded_read(base/name,4*1024*1024)).hexdigest()!=digest:raise Conflict('comms_external_plugin_source')
    return base,files

def observe_homeassistant(home,repository):
    try:
        _,files=homeassistant_contract(repository)
        base=Path(home)/'plugins/homeassistant'
        if not base.is_dir() or base.is_symlink():return False
        return set(p.name for p in base.iterdir())==set(files) and all(
            hashlib.sha256(guarded_read(base/name,4*1024*1024,private=True)).hexdigest()==digest for name,digest in files.items())
    except (OSError,ValueError,KeyError,TypeError):return False

def install_homeassistant(effect,deploy):
    """Copy the audited, MIT-licensed official external plugin; no install hooks."""
    if observe_homeassistant(deploy.root,deploy.source):return True
    source,files=homeassistant_contract(deploy.source);base=deploy.root/'plugins/homeassistant'
    artifacts={a['path']:a for a in effect.get('artifacts',[])}
    if base.exists():
        if set(p.name for p in base.iterdir())-set(files):raise Conflict('comms_external_plugin_foreign')
        for path in base.iterdir():
            if str(path) not in artifacts or revision(path)!=artifacts[str(path)]['sha256']:
                raise Conflict('comms_external_plugin_foreign')
    for name in files:
        path=base/name
        deploy.write(effect,path,guarded_read(source/name,4*1024*1024),kind='comms-native-source',
            expected=artifacts.get(str(path),{}).get('sha256'))
    return observe_homeassistant(deploy.root,deploy.source)

def patched_bridge(data):
    text=data.decode('utf-8')
    marker="  sock.ev.on('messages.update', async (updates) => {"
    if text.count(marker)!=1:raise Conflict('comms_pairing_source_changed')
    # Pair-only must not register poll/message handlers or download media.
    return text.replace(marker,"  if (PAIR_ONLY) return; // NetClaw owned installer: auth only, no message handlers.\n\n"+marker).encode()

def graph(root):
    """Hash the installed graph without following links outside its owner."""
    result={};total=0;root=Path(root)
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            target=path.resolve()
            if not target.is_relative_to(root) or not target.is_file():raise Conflict('comms_node_dependency_alias')
            result[path.relative_to(root).as_posix()]={'link':os.readlink(path)}
        elif path.is_file():
            raw=guarded_read(path,32*1024*1024);total+=len(raw)
            result[path.relative_to(root).as_posix()]=hashlib.sha256(raw).hexdigest()
        elif not path.is_dir():raise Conflict('comms_node_dependency_type')
        if len(result)>30000 or total>512*1024*1024:raise Conflict('comms_node_dependency_limit')
    return result

def source_contract(repository,channel):
    if channel=='raft':
        base=Path(repository)/'installer/native-comms/hermes/raft'
        contract=loads(guarded_read(base/'source.json',16384))
        if contract.get('package')!='@botiverse/raft' or contract.get('version')!='0.0.26':raise Conflict('comms_node_source_pin')
        files=contract['files']
        if set(files)!={'package.json','package-lock.json'}:raise Conflict('comms_node_source_files')
        for name,digest in files.items():
            if hashlib.sha256(guarded_read(base/name,4*1024*1024)).hexdigest()!=digest:raise Conflict('comms_node_source_changed')
        return {'installer/native-comms/hermes/raft/'+k:v for k,v in files.items()},'installer/native-comms/hermes/raft/'
    data=loads(guarded_read(Path(repository)/'installer/native-comms/hermes/platform-sources.json',1024*1024))
    if data.get('source')!=PIN:raise Conflict('comms_node_source_pin')
    if channel=='whatsapp':return data['whatsappBridge'],'scripts/whatsapp-bridge/'
    if channel=='photon':return {k:v for k,v in data['plugins']['photon'].items() if k.startswith('plugins/platforms/photon/sidecar/')},'plugins/platforms/photon/sidecar/'
    raise Conflict('comms_node_channel_invalid')

def observe_bridge(home,repository,channel):
    try:
        home=Path(home);base=home/'.setup/comms/native'/channel
        receipt=loads(guarded_read(home/'.setup/comms'/channel/'node-installed.json',8*1024*1024,private=True),8*1024*1024)
        files,prefix=source_contract(repository,channel)
        expected={k[len(prefix):]:digest for k,digest in files.items()}
        if receipt.get('schema')!=1 or receipt.get('source')!=PIN or receipt.get('channel')!=channel or receipt.get('sourceFiles')!=expected:return False
        if receipt.get('files')!=graph(base):return False
        if channel=='whatsapp':
            source=home/'python-runtimes/hermes-hud-agent/source'
            raw=guarded_read(source/'scripts/whatsapp-bridge/bridge.js',4*1024*1024)
            if hashlib.sha256(raw).hexdigest()!=files['scripts/whatsapp-bridge/bridge.js']:return False
            if guarded_read(base/'bridge.js',4*1024*1024)!=patched_bridge(raw):return False
        return True
    except (OSError,ValueError,KeyError,TypeError):return False

def install_bridge(effect,deploy,harness,channel):
    if channel not in ('whatsapp','photon','raft'):return False
    if observe_bridge(deploy.root,deploy.source,channel):return True
    home=deploy.root;base=home/'.setup/comms/native'/channel;stage=home/'.setup/comms'/channel
    started=stage/'node-started.json'
    if started.exists() or base.exists():return False
    files,prefix=source_contract(deploy.source,channel)
    source=deploy.source if channel=='raft' else home/'python-runtimes/hermes-hud-agent/source'
    validated=[]
    for relative,digest in files.items():
        raw=guarded_read(source/relative,8*1024*1024)
        if hashlib.sha256(raw).hexdigest()!=digest:raise Conflict('comms_node_source_changed')
        tail=relative[len(prefix):]
        if Path(tail).is_absolute() or '..' in Path(tail).parts:raise Conflict('comms_node_source_path')
        validated.append((base/tail,patched_bridge(raw) if channel=='whatsapp' and tail=='bridge.js' else raw))
    env=harness.environment();node=shutil.which('node',path=env['PATH']);npm=shutil.which('npm',path=env['PATH'])
    if not node or not npm:return False
    version=harness.call(effect,[node,'--version'],capture=True,timeout=10)
    if version['returncode']:return False
    checked=harness.call(effect,[sys.executable,str(deploy.source/'scripts/runtime-policy.py'),
        '--runtime','openclaw','--node',version['stdout'].decode().strip()],timeout=10)
    if checked['returncode']:return False
    deploy.write(effect,started,canonical({'schema':1,'channel':channel,'source':PIN}),kind='comms-native-attempt')
    for path,raw in validated:deploy.write(effect,path,raw,kind='comms-native-source')
    if harness.call(effect,[npm,'ci','--ignore-scripts','--no-audit','--no-fund'],cwd=base,timeout=600)['returncode']:return False
    if channel=='photon':
        if harness.call(effect,[node,str(base/'patch-spectrum-mixed-attachments.mjs'),str(base)],cwd=base,timeout=30)['returncode']:return False
    if harness.call(effect,[npm,'ls','--omit=dev','--all','--offline'],cwd=base,timeout=30)['returncode']:return False
    # Native WhatsApp uses this stamp to avoid an implicit npm install at startup.
    if channel=='whatsapp':
        deploy.write(effect,base/'node_modules/.hermes-pkg-hash',hashlib.sha256(guarded_read(base/'package.json')).hexdigest().encode(),kind='comms-native-dependencies')
    receipt={'schema':1,'channel':channel,'source':PIN,'sourceFiles':{k[len(prefix):]:v for k,v in files.items()},'files':graph(base)}
    deploy.write(effect,stage/'node-installed.json',canonical(receipt),kind='comms-native-dependencies')
    return observe_bridge(home,deploy.source,channel)

def executable(path):
    with directory(Path(path).parent) as parent:
        fd=os.open(Path(path).name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=parent)
        try:os.fchmod(fd,0o700);os.fsync(fd)
        finally:os.close(fd)

def raft_wrapper(home,node):
    home=Path(home)
    return ('#!/bin/sh\nexport HOME='+shlex.quote(str(home/'.setup/os-home'))+'\n'
        +'export HERMES_REAL_HOME='+shlex.quote(str(home/'.setup/os-home'))+'\n'
        +'export RAFT_HOME='+shlex.quote(str(home/'.setup/comms/raft/profile-home'))+'\n'
        +'unset SLOCK_HOME RAFT_PROFILE_DIR SLOCK_PROFILE_DIR SLOCK_PROFILE SLOCK_AGENT_API_KEY\n'
        +'exec '+shlex.quote(str(node))+' '+shlex.quote(str(home/'.setup/comms/native/raft/node_modules/@botiverse/raft/dist/raft.js'))+' "$@"\n').encode()

def install_raft_profile(effect,deploy,harness,values):
    from setup_comms_hermes import raft_credential
    credential=raft_credential(values);home=deploy.root
    if not observe_bridge(home,deploy.source,'raft'):return False
    if observe_raft_profile(home,values):return True
    node=shutil.which('node',path=harness.environment()['PATH'])
    if not node:return False
    target=home/'.setup/comms/raft/profile-home/profiles'/values['RAFT_PROFILE']/'credential.json'
    prior={a['path']:a for a in effect.get('artifacts',[])}
    for path,raw,kind in [(target,canonical(credential),'comms-native-account'),
        (home/'.setup/prefix/bin/raft',raft_wrapper(home,node),'comms-native-launcher')]:
        deploy.write(effect,path,raw,kind=kind,expected=prior.get(str(path),{}).get('sha256'))
    executable(home/'.setup/prefix/bin/raft')
    # Native --version is local-only; all profile authentication remains unverified.
    result=harness.call(effect,[str(home/'.setup/prefix/bin/raft'),'--version'],capture=True,timeout=15)
    if result['returncode'] or result['stdout'].strip()!=b'Raft CLI: 0.0.26':return False
    record={'schema':1,'profile':values['RAFT_PROFILE'],'credential':hashlib.sha256(canonical(credential)).hexdigest(),
        'node':node,'wrapper':hashlib.sha256(raft_wrapper(home,node)).hexdigest(),'version':'0.0.26'}
    deploy.write(effect,home/'.setup/comms/raft/profile-installed.json',canonical(record),kind='comms-native-account')
    return observe_raft_profile(home,values)

def observe_raft_profile(home,values):
    from setup_comms_hermes import raft_credential
    try:
        home=Path(home);credential=raft_credential(values)
        record=loads(guarded_read(home/'.setup/comms/raft/profile-installed.json',16384,private=True))
        target=home/'.setup/comms/raft/profile-home/profiles'/values['RAFT_PROFILE']/'credential.json'
        raw=guarded_read(target,16384,private=True);wrapper=home/'.setup/prefix/bin/raft'
        return (record.get('schema')==1 and record.get('version')=='0.0.26' and record.get('profile')==values['RAFT_PROFILE'] and
            raw==canonical(credential) and record.get('credential')==hashlib.sha256(raw).hexdigest() and
            guarded_read(wrapper,16384,private=True)==raft_wrapper(home,record['node']) and os.access(wrapper,os.X_OK) and
            record.get('wrapper')==hashlib.sha256(raft_wrapper(home,record['node'])).hexdigest())
    except (OSError,ValueError,KeyError,TypeError):return False

def observe_buzz(home,values):
    try:
        home=Path(home);target=home/'.setup/comms/native/buzz/buzz'
        record=loads(guarded_read(home/'.setup/comms/buzz/binary-installed.json',16384,private=True))
        raw=guarded_read(target,64*1024*1024,private=True)
        return (record.get('schema')==1 and record.get('version')=='0.1.0' and record.get('source')==
            'https://github.com/block/buzz/tree/9e8c9fc04daf20259cd259dcaec89109587cc7f5' and
            record.get('sha256')==values.get('NETCLAW_BUZZ_BINARY_SHA256')==hashlib.sha256(raw).hexdigest() and os.access(target,os.X_OK))
    except (OSError,ValueError,KeyError,TypeError):return False

def install_buzz(effect,deploy,harness,values):
    """Import the explicitly reviewed prepared binary; never borrow PATH/login."""
    if observe_buzz(deploy.root,values):return True
    origin=Path(values['NETCLAW_BUZZ_BINARY'])
    try:raw=guarded_read(origin,64*1024*1024)
    except FileNotFoundError:return False
    if (not origin.is_absolute() or origin.is_symlink() or not os.access(origin,os.X_OK) or
        hashlib.sha256(raw).hexdigest()!=values['NETCLAW_BUZZ_BINARY_SHA256']):raise Conflict('comms_buzz_binary_changed')
    # Native Mach-O or ELF only. Shell scripts and arbitrary interpreter hooks
    # are not part of the reviewed upstream CLI handoff.
    if raw[:4] not in (b'\x7fELF',b'\xcf\xfa\xed\xfe',b'\xfe\xed\xfa\xcf',b'\xca\xfe\xba\xbe',b'\xbe\xba\xfe\xca'):
        raise Conflict('comms_buzz_binary_type')
    target=deploy.root/'.setup/comms/native/buzz/buzz';started=deploy.root/'.setup/comms/buzz/binary-started.json'
    prior={a['path']:a for a in effect.get('artifacts',[])}
    if started.exists():return False # a version probe that did not settle is never replayed
    deploy.write(effect,started,canonical({'schema':1,'sha256':values['NETCLAW_BUZZ_BINARY_SHA256']}),kind='comms-native-attempt')
    deploy.write(effect,target,raw,kind='comms-native-binary',expected=prior.get(str(target),{}).get('sha256'));executable(target)
    result=harness.call(effect,[str(target),'--version'],timeout=15,capture=True)
    if result['returncode'] or result['stdout'].strip()!=b'buzz 0.1.0':return False
    deploy.write(effect,deploy.root/'.setup/comms/buzz/binary-installed.json',canonical({'schema':1,'version':'0.1.0',
        'source':'https://github.com/block/buzz/tree/9e8c9fc04daf20259cd259dcaec89109587cc7f5',
        'sha256':values['NETCLAW_BUZZ_BINARY_SHA256']}),kind='comms-native-dependencies')
    return observe_buzz(deploy.root,values)

def pairing_files(stage,connected_user):
    """Require the whole private auth directory and matching authenticated ID."""
    files={};total=0
    with directory(stage,private=True):pass
    for path in sorted(Path(stage).iterdir()):
        if path.is_symlink() or not path.is_file() or path.suffix!='.json':raise Conflict('comms_pairing_artifact_invalid')
        raw=guarded_read(path,4*1024*1024,private=True);total+=len(raw)
        value=json.loads(raw)
        if not isinstance(value,(dict,list,str,int,bool)):raise Conflict('comms_pairing_artifact_invalid')
        files[path.name]=hashlib.sha256(raw).hexdigest()
        if len(files)>2048 or total>16*1024*1024:raise Conflict('comms_pairing_artifact_limit')
    creds=loads(guarded_read(Path(stage)/'creds.json',4*1024*1024,private=True),4*1024*1024)
    if not connected_user or creds.get('registered') is not True or creds.get('me',{}).get('id')!=connected_user:
        raise Conflict('comms_pairing_identity_unverified')
    return files

def pairing_ready(home):
    try:
        home=Path(home);base=home/'.setup/comms/whatsapp'
        request=loads(guarded_read(base/'pair-request.json',16384,private=True))
        marker=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
        if any(request.get(k)!=marker.get(v) for k,v in [('runId','runId'),('planHash','planHash'),('owner','installationId')]):return False
        receipt=loads(guarded_read(base/'pair-result.json',1024*1024,private=True))
        if (receipt.get('schema')!=1 or receipt.get('nonce')!=request.get('nonce') or receipt.get('returncode')!=0 or
            receipt.get('state')!='paired'):return False
        installed=loads(guarded_read(base/'pair-installed.json',1024*1024,private=True))
        if (installed.get('schema')!=1 or installed.get('nonce')!=request.get('nonce') or
            installed.get('identity')!=receipt.get('connectedUser') or installed.get('files')!=receipt.get('files') or
            installed.get('sourceReceipt')!=revision(base/'pair-result.json')):return False
        # Native keys legitimately rotate after activation. The durable owned
        # promotion stays fixed; current credentials must remain private and
        # belong to that same paired identity, without matching old key bytes.
        return bool(pairing_files(home/'platforms/whatsapp/session',receipt.get('connectedUser')))
    except (OSError,ValueError,KeyError,TypeError):return False

def observe_whatsapp(effect,context,deploy,harness=None):
    """Read-only pairing recovery; caller separately validates current config."""
    home=deploy.root;base=home/'.setup/comms/whatsapp';request=base/'pair-request.json'
    if not request.exists():return 'not_started' if not (home/'platforms/whatsapp/session').exists() else 'conflict'
    try:
        artifacts={a['path']:a for a in effect.get('artifacts',[])}
        def owned(path):return str(path) in artifacts and revision(path)==artifacts[str(path)]['sha256']
        data=loads(guarded_read(request,16384,private=True))
        if not owned(request) or any(data.get(k)!=v for k,v in {'runId':context['runId'],'planHash':context['planHash'],'owner':deploy.claw['id']}.items()):return 'conflict'
        result=base/'pair-result.json';installed=base/'pair-installed.json'
        if installed.exists():
            return 'paired' if owned(result) and owned(installed) and pairing_ready(home) else 'conflict'
        if not result.exists():return 'unknown'
        receipt=loads(guarded_read(result,1024*1024,private=True))
        if str(result) in artifacts and not owned(result):return 'conflict'
        if (receipt.get('schema')!=1 or receipt.get('nonce')!=data.get('nonce') or receipt.get('state')!='paired' or
            receipt.get('returncode')!=0 or receipt.get('files')!=pairing_files(base/'pair-stage',receipt.get('connectedUser'))):return 'unknown'
        target=home/'platforms/whatsapp/session'
        if target.exists():
            for path in target.iterdir():
                if path.name not in receipt['files'] or not owned(path) or revision(path)!=receipt['files'][path.name]:return 'conflict'
        return 'retry_owned'
    except (OSError,ValueError,KeyError,TypeError):return 'conflict'

def pair_whatsapp(effect,context,deploy,harness,session):
    """Explicit native UI, one attempt; cancellation/unknown never relinks."""
    home=deploy.root;base=home/'.setup/comms/whatsapp';request=base/'pair-request.json'
    target=home/'platforms/whatsapp/session';stage=base/'pair-stage'
    if not observe_bridge(deploy.root,deploy.source,'whatsapp'):return False
    if request.exists():
        # A settled receipt can be deterministically promoted after interruption.
        try:
            expected=loads(guarded_read(request,16384,private=True));receipt=loads(guarded_read(base/'pair-result.json',1024*1024,private=True))
            recorded=next((a for a in effect.get('artifacts',[]) if a['path']==str(request)),None)
            if (not recorded or revision(request)!=recorded['sha256'] or any(expected.get(k)!=v for k,v in
                {'runId':context['runId'],'planHash':context['planHash'],'owner':deploy.claw['id']}.items())):return False
            if pairing_ready(home):return observe_whatsapp(effect,context,deploy)=='paired'
            if receipt.get('schema')!=1 or receipt.get('nonce')!=expected.get('nonce') or receipt.get('state')!='paired' or receipt.get('returncode')!=0:return False
            if receipt.get('files')!=pairing_files(stage,receipt.get('connectedUser')):return False
        except (OSError,ValueError):return False
    else:
        if session is None:return False
        if target.exists() or stage.exists():raise Conflict('comms_pairing_existing_session')
        node=shutil.which('node',path=harness.environment()['PATH'])
        if not node:return False
        deploy.write(effect,request,canonical({'schema':1,'nonce':secrets.token_hex(32),'runId':context['runId'],
            'planHash':context['planHash'],'owner':deploy.claw['id']}),kind='comms-native-attempt')
        with directory(stage,create=True,private=True):pass
        result=session.terminal([node,str(deploy.source/'installer/native-comms/hermes/whatsapp-pair.mjs')],
            cwd=home,env=harness.environment({'WHATSAPP_MODE':'bot','WHATSAPP_DM_POLICY':'disabled',
                'WHATSAPP_GROUP_POLICY':'disabled','WHATSAPP_SEND_READ_RECEIPTS':'false'}),context=context,effect=effect)
        if result.get('returncode')!=0:return False
        try:
            expected=loads(guarded_read(request,16384,private=True));receipt=loads(guarded_read(base/'pair-result.json',1024*1024,private=True))
            if receipt.get('schema')!=1 or receipt.get('nonce')!=expected['nonce'] or receipt.get('state')!='paired' or receipt.get('returncode')!=0:return False
            if receipt.get('files')!=pairing_files(stage,receipt.get('connectedUser')):return False
        except (OSError,ValueError):return False
    existing={a['path']:a for a in effect.get('artifacts',[])}
    # The native result is accepted only after the durable request and whole
    # staged account have matched. Journal its exact validated private bytes
    # before promotion, so interrupted recovery cannot substitute a result.
    receipt_path=base/'pair-result.json';receipt_raw=guarded_read(receipt_path,1024*1024,private=True)
    recorded=existing.get(str(receipt_path))
    if recorded and recorded['sha256']!=hashlib.sha256(receipt_raw).hexdigest():raise Conflict('comms_pairing_result_changed')
    deploy.write(effect,receipt_path,receipt_raw,kind='comms-pairing-receipt',expected=hashlib.sha256(receipt_raw).hexdigest())
    if target.exists() and set(p.name for p in target.iterdir())-set(receipt['files']):raise Conflict('comms_pairing_foreign_file')
    for name,digest in receipt['files'].items():
        path=target/name;raw=guarded_read(stage/name,4*1024*1024,private=True)
        if hashlib.sha256(raw).hexdigest()!=digest:raise Conflict('comms_pairing_stage_changed')
        if path.exists() and str(path) not in existing:raise Conflict('comms_pairing_foreign_file')
        deploy.write(effect,path,raw,kind='comms-pairing',expected=existing.get(str(path),{}).get('sha256'))
    deploy.write(effect,base/'pair-installed.json',canonical({'schema':1,'nonce':expected['nonce'],
        'identity':receipt['connectedUser'],'files':receipt['files'],'sourceReceipt':hashlib.sha256(receipt_raw).hexdigest()}),kind='comms-pairing-receipt')
    return pairing_ready(home)
