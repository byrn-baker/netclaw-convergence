"""Build and install the pinned helper inside one setup-owned OpenClaw host."""
import hashlib
from pathlib import Path
import shutil
import sys

from setup_schema import canonical, loads
from setup_state import Conflict, directory, guarded_read, guarded_write

PIN='0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c'
VERSION='2026.7.1-2'
EXTERNAL_CHANNELS=frozenset(('clickclack', 'discord', 'feishu', 'googlechat', 'irc', 'line', 'matrix', 'mattermost', 'msteams', 'nextcloud-talk', 'nostr', 'qqbot', 'raft', 'signal', 'slack', 'sms', 'synology-chat', 'tlon', 'twitch', 'whatsapp', 'zalo', 'zalouser', 'wecom', 'wechat', 'zaloclawbot'))


def helper_input_hash(deploy):
    inputs=deploy.source/'installer/native-comms/openclaw'
    return hashlib.sha256(b''.join(guarded_read(inputs/name) for name in ('entry.ts','acquire.ts','register.ts','contract.mjs'))).hexdigest()


def core_path(deploy):
    core=deploy.root/'.setup/prefix/lib/node_modules/openclaw'
    package=loads(guarded_read(core/'package.json',1024*1024))
    if package.get('name')!='openclaw' or package.get('version')!=VERSION:
        raise Conflict('comms_helper_host_changed')
    return core


def observe_helper(context,deploy):
    """All helper chunks are revision-bound, including dynamically imported ones."""
    try:
        record=deploy.root/'.setup/comms/helper.json'
        artifacts=[a for e in context['journal']['effects'] for a in e.get('artifacts',[]) if a['path']==str(record)]
        raw=guarded_read(record,4*1024*1024,private=True)
        if not artifacts or hashlib.sha256(raw).hexdigest()!=artifacts[-1]['sha256']:return False
        value=loads(raw,4*1024*1024);core=core_path(deploy);destination=core/'netclaw-comms'
        if (value.get('source')!=PIN or value.get('version')!=VERSION or value.get('root')!=str(destination) or
            value.get('inputHash')!=helper_input_hash(deploy)):return False
        entries=value.get('files',[])
        if not isinstance(entries,list) or not 1<=len(entries)<=10000:return False
        seen=set()
        for entry in entries:
            name=entry.get('path');file=Path(name) if isinstance(name,str) else Path('/')
            if file.is_absolute() or '..' in file.parts or file.as_posix()!=name or name in seen:return False
            seen.add(name)
            if hashlib.sha256(guarded_read(destination/file,16*1024*1024,private=True)).hexdigest()!=entry.get('sha256'):return False
        actual=set()
        for file in destination.rglob('*'):
            if file.is_symlink():return False
            if file.is_file():actual.add(file.relative_to(destination).as_posix())
        if actual!=seen:return False
        return {'netclaw-comms-helper.js','netclaw-comms-acquire.js','netclaw-comms-register.js','netclaw-comms-build.json'}<=seen
    except (OSError,ValueError,TypeError,KeyError):return False


def install_helper(effect,context,deploy,harness):
    if observe_helper(context,deploy):return True
    core=core_path(deploy);destination=core/'netclaw-comms';build=deploy.root/'.setup/comms/build'
    # A failed build/install may have run package managers. It is not safe to
    # replay on resume just because the final helper receipt is absent.
    if destination.exists() or build.exists() or effect.get('commsHelperStage'):
        raise Conflict('comms_helper_observation_required')
    env=harness.environment();npm=shutil.which('npm',path=env['PATH']);git=shutil.which('git',path=env['PATH'])
    if not npm or not git:return False
    effect['commsHelperStage']='acquiring';context['save']()
    with directory(build,create=True,private=True):pass
    tools=build/'tools';inputs=deploy.source/'installer/native-comms/openclaw'
    for name in ('package.json','package-lock.json'):
        deploy.write(effect,tools/name,guarded_read(inputs/'build-tools'/name,1024*1024),kind='comms-build-input',expected=None)
    source=build/'source'
    commands=[([npm,'ci','--ignore-scripts','--no-audit','--no-fund'],tools),
        ([git,'init',str(source)],build),
        ([git,'-C',str(source),'remote','add','origin','https://github.com/openclaw/openclaw.git'],build),
        ([git,'-C',str(source),'fetch','--depth=1','origin',PIN],build),
        ([git,'-C',str(source),'checkout','--detach',PIN],build)]
    for args,cwd in commands:
        if harness.call(effect,args,cwd=cwd,capture=True,timeout=600)['returncode']:return False
    pnpm=tools/'node_modules/.bin/pnpm'
    if harness.call(effect,[str(pnpm),'install','--frozen-lockfile','--ignore-scripts'],cwd=source,capture=True,timeout=1200)['returncode']:return False
    effect['commsHelperStage']='building';context['save']()
    if harness.call(effect,[sys.executable,str(inputs/'build.py'),'--source',str(source),'--pnpm',str(pnpm)],
                    cwd=build,capture=True,timeout=1200)['returncode']:return False
    dist=source/'dist';metadata=loads(guarded_read(dist/'netclaw-comms-build.json'))
    if metadata.get('upstreamCommit')!=PIN or metadata.get('hostVersion')!=VERSION:return False
    expected=helper_input_hash(deploy)
    if metadata.get('inputSha256')!=expected:raise Conflict('comms_helper_inputs_changed')
    files=[];artifacts=[]
    for path in sorted(dist.rglob('*')):
        if path.is_symlink():raise Conflict('comms_helper_alias')
        if path.is_dir():continue
        name=path.relative_to(dist).as_posix();data=guarded_read(path,16*1024*1024)
        files.append({'path':name,'sha256':hashlib.sha256(data).hexdigest()})
        artifacts.append(deploy.artifact(destination/name,data,'native-helper'))
    if not 1<=len(files)<=10000:raise Conflict('comms_helper_file_limit')
    # One durable intent covers the complete compiled graph. Writing each file
    # afterward does not repeatedly rewrite the large artifact index.
    effect['commsHelperStage']='promoting';context['artifactIntent'](effect['id'],artifacts)
    for entry in files:
        guarded_write(destination/entry['path'],guarded_read(dist/entry['path'],16*1024*1024),expected=None)
    record={'schema':1,'source':PIN,'version':VERSION,'root':str(destination),'inputHash':expected,'files':files}
    deploy.write(effect,deploy.root/'.setup/comms/helper.json',canonical(record),kind='comms-helper-index',expected=None)
    effect['commsHelperStage']='complete';context['save']()
    return observe_helper(context,deploy)


def install_channel(effect,context,deploy,harness,channel,config):
    """Native acquisition/registration only; configuration is a separate write."""
    if channel not in EXTERNAL_CHANNELS:return channel in ('telegram','imessage')
    if effect.get('commsAcquisitionStage')=='complete' and observe_channel(effect,context,deploy,harness,channel,prerequisites=False):return True
    if not install_helper(effect,context,deploy,harness):return False
    entry=deploy.validator.comms.channel('openclaw',channel)
    dependencies=[d for d in entry['setup']['dependencies'] if d['id']=='openclaw-'+channel]
    if len(dependencies)!=1:raise Conflict('comms_dependency_changed')
    node=shutil.which('node',path=harness.environment()['PATH'])
    if not node:return False
    attempt=deploy.root/'.setup/comms'/channel
    if attempt.exists():raise Conflict('comms_acquisition_observation_required')
    request={'schema':1,'channel':channel,'config':config,'integrity':dependencies[0]['integrity']}
    deploy.write(effect,attempt/'acquire-request.json',canonical(request),kind='comms-acquisition-request',expected=None)
    helper=core_path(deploy)/'netclaw-comms'
    effect['commsAcquisitionStage']='acquiring';context['save']()
    result=harness.call(effect,[node,str(helper/'netclaw-comms-acquire.js'),str(attempt/'acquire-request.json')],capture=True,timeout=240)
    if result['returncode']:return False
    receipt=attempt/'acquire-result.json';raw=guarded_read(receipt,16384,private=True);acquired=loads(raw)
    if acquired.get('channel')!=channel or acquired.get('integrity')!=dependencies[0]['integrity'] or acquired.get('dependencies') is not True:return False
    context['artifactIntent'](effect['id'],[deploy.artifact(receipt,raw,'comms-acquisition')])
    effect['commsAcquisitionStage']='registering';context['save']()
    result=harness.call(effect,[node,str(helper/'netclaw-comms-register.js'),channel],capture=True,timeout=90)
    expected={'schema':1,'channel':channel,'registered':True,'configurationUnchanged':True,'activated':False}
    if result['returncode'] or loads(result['stdout'])!=expected:return False
    receipt=attempt/'register-result.json';raw=guarded_read(receipt,16384,private=True)
    if loads(raw)!=expected:return False
    context['artifactIntent'](effect['id'],[deploy.artifact(receipt,raw,'comms-registration')])
    effect['commsAcquisitionStage']='complete';context['save']()
    return True


def observe_channel(effect,context,deploy,harness,channel,*,prerequisites=True):
    if prerequisites and channel in ('imessage','raft'):
        from setup_risk import latest_environment
        try:values,_=latest_environment(context,deploy.root,effect=effect)
        except (OSError,ValueError,TypeError,KeyError):return False
        if not observe_prepared_prerequisites(deploy,channel,values):return False
    if channel not in EXTERNAL_CHANNELS:return channel in ('telegram','imessage')
    if not observe_helper(context,deploy):return False
    node=shutil.which('node',path=harness.environment()['PATH'])
    if not node:return False
    result=harness.call(effect,[node,str(core_path(deploy)/'netclaw-comms/netclaw-comms-register.js'),channel,'observe'],capture=True,timeout=60)
    expected={'schema':1,'channel':channel,'registered':True,'dependencies':True,'activated':False}
    return result['returncode']==0 and loads(result['stdout'])==expected


def prepared_prerequisites(effect,context,deploy,harness,channel,values):
    """Finish local prerequisite acquisition; never activate a provider."""
    if channel=='raft':
        from setup_comms_hermes_native import install_bridge,install_raft_profile
        return install_bridge(effect,deploy,harness,'raft') and install_raft_profile(effect,deploy,harness,values)
    if channel=='imessage':
        try:observed=_imessage_prerequisite_metadata(values)
        except (OSError,ValueError,TypeError,KeyError):return False
        path=deploy.root/'.setup/comms/imessage/prepared.json'
        previous=[a for a in effect.get('artifacts',[]) if a['path']==str(path)]
        deploy.write(effect,path,canonical(observed),kind='comms-prerequisite',expected=previous[-1]['sha256'] if previous else None)
        return observe_prepared_prerequisites(deploy,channel,values)
    return True


def _imessage_prerequisite_metadata(values):
    """Inspect metadata only for Messages DB; never query chats or permissions."""
    import os
    import stat
    binary=Path(values['IMESSAGE_CLI_PATH']);database=Path(values['IMESSAGE_DB_PATH'])
    if any(not p.is_absolute() or p.resolve()!=p for p in (binary,database)):raise Conflict('comms_imessage_alias')
    b=binary.stat();d=database.stat()
    if (not stat.S_ISREG(b.st_mode) or not stat.S_ISREG(d.st_mode) or
        b.st_uid!=os.getuid() or d.st_uid!=os.getuid() or b.st_mode&0o022 or
        not os.access(binary,os.X_OK)):raise Conflict('comms_imessage_prepared_files_required')
    raw=guarded_read(binary,64*1024*1024)
    if raw[:4] not in (b'\xcf\xfa\xed\xfe',b'\xfe\xed\xfa\xcf',b'\xca\xfe\xba\xbe',b'\xbe\xba\xfe\xca'):
        raise Conflict('comms_imessage_native_binary_required')
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=values['IMESSAGE_CLI_SHA256']:raise Conflict('comms_imessage_binary_changed')
    return {'schema':1,'binary':str(binary),'sha256':digest,'database':str(database),
        'databaseIdentity':{'device':d.st_dev,'inode':d.st_ino,'owner':d.st_uid},
        'permissions':'unverified','authentication':'unverified'}


def observe_prepared_prerequisites(deploy,channel,values):
    if channel=='raft':
        from setup_comms_hermes_native import observe_bridge,observe_raft_profile
        return observe_bridge(deploy.root,deploy.source,'raft') and observe_raft_profile(deploy.root,values)
    if channel=='imessage':
        try:return loads(guarded_read(deploy.root/'.setup/comms/imessage/prepared.json',16384,private=True))==_imessage_prerequisite_metadata(values)
        except (OSError,ValueError,TypeError,KeyError):return False
    return True


def whatsapp_config(config,values,auth_dir):
    """Default account only, no inherited personal state or group ingestion."""
    import copy
    import re
    from setup_comms import access_list
    from setup_schema import Invalid
    phone=values.get('WHATSAPP_ACCOUNT_PHONE','')
    users=access_list(values.get('WHATSAPP_ALLOWED_USERS',''))
    if not re.fullmatch(r'\+[1-9][0-9]{5,14}',phone) or any(not re.fullmatch(r'\+[1-9][0-9]{5,14}',v) for v in users):
        raise Invalid('comms_phone_allowlist_required')
    result=copy.deepcopy(config);plugins=result.setdefault('plugins',{})
    if (plugins.get('enabled') is False or 'whatsapp' in plugins.get('deny',[]) or
        plugins.get('allow') and 'whatsapp' not in plugins['allow']):raise Invalid('comms_plugin_policy_blocks_selection')
    plugins.setdefault('entries',{}).setdefault('whatsapp',{})['enabled']=True
    result.setdefault('channels',{})['whatsapp']={'enabled':True,'configWrites':False,'sendReadReceipts':False,
        'dmPolicy':'allowlist' if users else 'disabled','allowFrom':users,'groupPolicy':'disabled','groupAllowFrom':[],
        'groups':{},'reactionLevel':'off','accounts':{'default':{'enabled':True,'authDir':str(auth_dir)}}}
    return result


def _whatsapp_pairing_receipt(context,deploy):
    """Verify all private staged auth files, not merely a creds.json marker."""
    import re
    attempt=deploy.root/'.setup/comms/whatsapp/pairing'
    raw=guarded_read(attempt/'request.json',16384,private=True);request=loads(raw)
    script=deploy.source/'installer/native-comms/openclaw/whatsapp-pair.mjs'
    if (request.get('schema')!=1 or request.get('owner')!=deploy.claw['id'] or request.get('runId')!=context['runId'] or
        request.get('helperSha256')!=hashlib.sha256(guarded_read(script)).hexdigest()):raise Conflict('comms_pairing_request_changed')
    result_raw=guarded_read(attempt/'result.json',4*1024*1024,private=True)
    _check_settled_receipt(context,deploy,'whatsapp',attempt/'result.json',result_raw)
    result=loads(result_raw,4*1024*1024)
    if (result.get('schema')!=1 or result.get('owner')!=request['owner'] or result.get('runId')!=request['runId'] or
        result.get('requestHash')!=hashlib.sha256(raw).hexdigest() or result.get('phone')!=request['expectedPhone'] or
        result.get('connected') is not True or result.get('closed') is not True):raise Conflict('comms_pairing_result_unverified')
    files=result.get('files')
    if not isinstance(files,list) or not 1<=len(files)<=10000:raise Conflict('comms_pairing_files_invalid')
    names=set()
    for entry in files:
        name=entry.get('path','')
        if (not isinstance(name,str) or len(name)>255 or not re.fullmatch(r'[A-Za-z0-9_.@+-]+\.json',name) or
            name in names):raise Conflict('comms_pairing_files_invalid')
        names.add(name);data=guarded_read(attempt/'auth'/name,4*1024*1024,private=True)
        if hashlib.sha256(data).hexdigest()!=entry.get('sha256'):raise Conflict('comms_pairing_auth_changed')
        loads(data,4*1024*1024)
    if names!={p.name for p in (attempt/'auth').iterdir()} or 'creds.json' not in names:raise Conflict('comms_pairing_files_invalid')
    creds=loads(guarded_read(attempt/'auth/creds.json',4*1024*1024,private=True),4*1024*1024)
    jid=creds.get('me',{}).get('id','')
    if not re.fullmatch(r'\d{6,15}(?::\d+)?@s\.whatsapp\.net',jid) or '+'+jid.split('@')[0].split(':')[0]!=request['expectedPhone']:
        raise Conflict('comms_pairing_account_mismatch')
    return request,result


def configure_whatsapp(effect,context,deploy,harness,session=None):
    from setup_comms import owned_configuration
    from setup_risk import latest_environment
    from setup_schema import Invalid
    from setup_state import revision
    if (effect.get('owner')!=deploy.claw['id'] or effect.get('phase')!='comms' or effect.get('channel')!='whatsapp' or
        deploy.claw['role'] not in ('focused','border') or deploy.claw['harness']!='openclaw'):
        raise Conflict('comms_effect_owner_mismatch')
    values,_=latest_environment(context,deploy.root,effect=effect);target,config,before=owned_configuration(context,deploy,effect=effect)
    auth_dir=deploy.root/'credentials/whatsapp/default'
    try:updated=whatsapp_config(config,values,auth_dir)
    except Invalid:return {'state':'configuration_required'}
    attempt=deploy.root/'.setup/comms/whatsapp/pairing';receipt=attempt/'result.json'
    if not receipt.exists() and session is None:return {'state':'configuration_required'}
    if not install_channel(effect,context,deploy,harness,'whatsapp',config):return {'state':'configuration_required'}
    if not receipt.exists():
        if (attempt/'started.json').exists() or auth_dir.exists():raise Conflict('comms_pairing_observation_required')
        script=deploy.source/'installer/native-comms/openclaw/whatsapp-pair.mjs'
        request={'schema':1,'owner':deploy.claw['id'],'runId':context['runId'],
                 'expectedPhone':values['WHATSAPP_ACCOUNT_PHONE'],'helperSha256':hashlib.sha256(guarded_read(script)).hexdigest()}
        data=canonical(request);request_file=attempt/'request.json'
        if request_file.exists():
            if guarded_read(request_file,16384,private=True)!=data:raise Conflict('comms_pairing_request_changed')
        else:deploy.write(effect,request_file,data,kind='comms-pairing-request',expected=None)
        node=shutil.which('node',path=harness.environment()['PATH'])
        if not node:return {'state':'configuration_required'}
        effect['commsPairingStage']='linking';context['save']()
        result=session.terminal([node,str(script),str(request_file)],cwd=deploy.root,env=harness.environment(),context=context,effect=effect)
        if result.get('returncode')!=0:return {'state':'unknown' if (attempt/'started.json').exists() else 'cancelled'}
    request,result=_whatsapp_pairing_receipt(context,deploy)
    if request['expectedPhone']!=values['WHATSAPP_ACCOUNT_PHONE']:raise Conflict('comms_pairing_account_mismatch')
    effect['commsPairingStage']='promoting';context['save']()
    # A partial promotion is resumed only from this exact authenticated attempt.
    # No sockets or re-link are involved in copying its remaining auth files.
    for entry in result['files']:
        target_auth=auth_dir/entry['path'];current=revision(target_auth)
        owned=[a for a in effect.get('artifacts',[]) if a['path']==str(target_auth)]
        if current:
            if not owned or current!=owned[-1]['sha256'] or current!=entry['sha256']:raise Conflict('comms_pairing_destination_changed')
            continue
        deploy.write(effect,target_auth,guarded_read(attempt/'auth'/entry['path'],4*1024*1024,private=True),kind='comms-auth',expected=None)
    if {p.name for p in auth_dir.iterdir()}!={e['path'] for e in result['files']}:raise Conflict('comms_pairing_destination_changed')
    deploy.write(effect,target,canonical(updated)+b'\n',kind='configuration',expected=before)
    checked=harness.call(effect,harness.command()+['config','validate'],credentials=values,timeout=30)
    if checked['returncode']:return {'state':'configuration_required'}
    context['artifactIntent'](effect['id'],[deploy.artifact(receipt,guarded_read(receipt,4*1024*1024,private=True),'comms-pairing')])
    effect['commsPairingStage']='complete';context['save']()
    return {'state':'verified'}


def observe_whatsapp(effect,context,deploy,harness):
    """Reconcile a prior link without opening a socket or repeating its QR."""
    from setup_comms import owned_configuration
    from setup_risk import latest_environment
    from setup_state import revision
    attempt=deploy.root/'.setup/comms/whatsapp/pairing'
    if not (attempt/'result.json').exists():
        return 'unknown' if (attempt/'started.json').exists() else 'retry_owned'
    try:
        request,result=_whatsapp_pairing_receipt(context,deploy)
        values,_=latest_environment(context,deploy.root,effect=effect)
        if request['expectedPhone']!=values.get('WHATSAPP_ACCOUNT_PHONE'):return 'conflict'
        auth_dir=deploy.root/'credentials/whatsapp/default';complete=True
        for entry in result['files']:
            destination=auth_dir/entry['path'];current=revision(destination)
            if not current:complete=False;continue
            own=[a for a in effect.get('artifacts',[]) if a['path']==str(destination)]
            if not own or current!=own[-1]['sha256'] or current!=entry['sha256']:return 'conflict'
        if auth_dir.exists() and any(p.name not in {e['path'] for e in result['files']} for p in auth_dir.iterdir()):return 'conflict'
        if not complete:return 'retry_owned'
        _,config,_=owned_configuration(context,deploy,effect=effect)
        if config!=whatsapp_config(config,values,auth_dir):return 'retry_owned'
        if not observe_channel(effect,context,deploy,harness,'whatsapp'):return 'conflict'
        checked=harness.call(effect,harness.command()+['config','validate'],credentials=values,timeout=30)
        return 'completed' if checked['returncode']==0 else 'unknown'
    except (OSError,ValueError,TypeError,KeyError):return 'conflict'


def whatsapp_configuration_valid(context,deploy,values):
    """Check owned current auth state after normal runtime key rotation.

    This establishes local configuration only. A prior successful QR and an
    account-shaped file are never proof of a current authenticated transport.
    Unknown/interrupted promotion uses observe_whatsapp's stricter hashes.
    """
    import re
    try:
        request,result=_whatsapp_pairing_receipt(context,deploy)
        if request['expectedPhone']!=values.get('WHATSAPP_ACCOUNT_PHONE'):return False
        effect=next(e for e in context['journal']['effects'] if e.get('owner')==deploy.claw['id'] and
            e.get('phase')=='comms' and e.get('channel')=='whatsapp')
        if effect.get('state')!='verified' or effect.get('commsPairingStage')!='complete':return False
        auth_dir=deploy.root/'credentials/whatsapp/default';files=list(auth_dir.iterdir())
        if not 1<=len(files)<=10000:return False
        for file in files:
            if not re.fullmatch(r'[A-Za-z0-9_.@+-]+\.json',file.name) or len(file.name)>255:return False
            loads(guarded_read(file,4*1024*1024,private=True),4*1024*1024)
        creds=loads(guarded_read(auth_dir/'creds.json',4*1024*1024,private=True),4*1024*1024)
        jid=creds.get('me',{}).get('id','')
        return bool(re.fullmatch(r'\d{6,15}(?::\d+)?@s\.whatsapp\.net',jid) and
            '+'+jid.split('@')[0].split(':')[0]==request['expectedPhone'])
    except (OSError,ValueError,TypeError,KeyError,StopIteration):return False


PERSONAL_CHANNELS={'wechat':('openclaw-weixin','WECHAT_OWNER_ID'),
                  'zalouser':('zalouser','ZALOUSER_OWNER_ID'),
                  'zaloclawbot':('openclaw-zaloclawbot','ZALOCLAWBOT_OWNER_ID')}


def _check_settled_receipt(context,deploy,channel,path,raw):
    """A completed setup receipt is immutable even when runtime auth rotates."""
    effects=[e for e in context['journal']['effects'] if e.get('owner')==deploy.claw['id'] and
        e.get('phase')=='comms' and e.get('channel')==channel]
    artifacts=[a for e in effects for a in e.get('artifacts',[]) if a['path']==str(path)]
    if artifacts and artifacts[-1]['sha256']!=hashlib.sha256(raw).hexdigest():raise Conflict('comms_pairing_receipt_changed')
    if not artifacts and any(e.get('state')=='verified' and e.get('commsPairingStage')=='complete' for e in effects):
        raise Conflict('comms_pairing_receipt_not_owned')


def personal_settings(channel):
    native,key=PERSONAL_CHANNELS[channel]
    return [{'key':key,'label':'Expected account owner ID','help':
        'Exact owner ID of the dedicated account that will scan the private QR. Setup refuses a different account; only this owner is authorized.',
        'classification':'private','valueType':'string','required':'always','condition':None,'example':'','sharedWith':[],
        'input':'user','provenance':[{'source':'https://docs.openclaw.ai/channels/'+channel,'checkedAt':'2026-10-25',
        'note':'Exact pinned native account login and storage contract; no gateway activation.'}]}]


def _personal_owner(channel,values):
    import re
    from setup_schema import Invalid
    value=values.get(PERSONAL_CHANNELS[channel][1],'')
    if not re.fullmatch(r'[A-Za-z0-9_.@-]{1,160}',value) or '..' in value:raise Invalid('comms_personal_owner_required')
    return value


def _personal_receipt(context,deploy,channel):
    import re
    stage=deploy.root/'.setup/comms'/channel/'pairing'
    raw=guarded_read(stage/'request.json',16384,private=True);request=loads(raw,16384)
    result_raw=guarded_read(stage/'result.json',4*1024*1024,private=True)
    _check_settled_receipt(context,deploy,channel,stage/'result.json',result_raw)
    result=loads(result_raw,4*1024*1024)
    script=deploy.source/'installer/native-comms/openclaw/personal-pair.mjs'
    if (request.get('schema')!=1 or request.get('owner')!=deploy.claw['id'] or request.get('runId')!=context['runId'] or
        request.get('channel')!=channel or request.get('helperSha256')!=hashlib.sha256(guarded_read(script)).hexdigest() or
        result.get('schema')!=1 or result.get('owner')!=request['owner'] or result.get('runId')!=request['runId'] or
        result.get('channel')!=channel or result.get('requestHash')!=hashlib.sha256(raw).hexdigest() or
        result.get('connected') is not True or result.get('closed') is not True or result.get('ownerId')!=request.get('expectedOwner')):
        raise Conflict('comms_personal_receipt_invalid')
    account=result.get('accountId','');credential=result.get('credential')
    if (not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,63}',account) or account in ('constructor','prototype','__proto__') or
        not isinstance(credential,dict)):raise Conflict('comms_personal_account_invalid')
    if channel=='wechat':
        from urllib.parse import urlsplit
        url=urlsplit(credential.get('baseUrl',''))
        if (credential.get('userId')!=request['expectedOwner'] or not isinstance(credential.get('token'),str) or not credential['token'] or
            url.scheme!='https' or not url.hostname or not url.hostname.endswith('.weixin.qq.com') or url.username or url.password or url.port or url.query or url.fragment):
            raise Conflict('comms_personal_account_invalid')
    elif channel=='zaloclawbot':
        if credential.get('ownerId')!=request['expectedOwner'] or not all(isinstance(credential.get(k),str) and credential[k] for k in ('botToken','botId')):
            raise Conflict('comms_personal_account_invalid')
    elif channel=='zalouser':
        if account!='default' or not all(isinstance(credential.get(k),str) and credential[k] for k in ('imei','userAgent')) or not isinstance(credential.get('cookie'),list) or not credential['cookie']:
            raise Conflict('comms_personal_account_invalid')
    return request,result


def personal_config(channel,config,values,result):
    import copy
    from setup_schema import Invalid
    native,_=PERSONAL_CHANNELS[channel];owner=_personal_owner(channel,values)
    if result['ownerId']!=owner:raise Conflict('comms_personal_account_mismatch')
    updated=copy.deepcopy(config);plugins=updated.setdefault('plugins',{})
    if (plugins.get('enabled') is False or native in plugins.get('deny',[]) or
        plugins.get('allow') and native not in plugins['allow']):raise Invalid('comms_plugin_policy_blocks_selection')
    plugins.setdefault('entries',{}).setdefault(native,{})['enabled']=True
    selected={'enabled':True}
    if channel=='zalouser':selected.update(profile='default',dmPolicy='allowlist',allowFrom=[owner],groupPolicy='disabled',groupAllowFrom=[],groups={},dangerouslyAllowNameMatching=False)
    else:selected['accounts']={result['accountId']:{'enabled':True}}
    if channel=='wechat':selected['replyProgressMessages']=False
    updated.setdefault('channels',{})[native]=selected
    return updated


def _personal_files(deploy,channel,result):
    native,_=PERSONAL_CHANNELS[channel];account=result['accountId'];credential=result['credential']
    if channel=='zalouser':return {deploy.root/'credentials/zalouser/credentials.json':canonical(credential)}
    files={deploy.root/native/'accounts.json':canonical([account]),deploy.root/native/'accounts'/str(account+'.json'):canonical(credential)}
    if channel=='wechat':files[deploy.root/'credentials'/str('openclaw-weixin-'+account+'-allowFrom.json')]=canonical({'version':1,'allowFrom':[result['ownerId']]})
    return files


def _personal_destination_scope(deploy,channel,files):
    """A staged account must not make neighboring account files unreachable."""
    native,_=PERSONAL_CHANNELS[channel]
    base=deploy.root/('credentials/zalouser' if channel=='zalouser' else native)
    if not base.exists():return
    if base.is_symlink() or not base.is_dir():raise Conflict('comms_personal_destination_changed')
    allowed=set(files)
    for path in base.rglob('*'):
        if path.is_symlink() or (not path.is_dir() and (not path.is_file() or path not in allowed)):raise Conflict('comms_personal_destination_changed')


def configure_personal(effect,context,deploy,harness,session=None):
    from setup_comms import owned_configuration
    from setup_risk import latest_environment
    from setup_state import revision
    from setup_schema import Invalid
    channel=effect.get('channel')
    if channel not in PERSONAL_CHANNELS or effect.get('owner')!=deploy.claw['id'] or effect.get('phase')!='comms' or deploy.claw['harness']!='openclaw' or deploy.claw['role'] not in ('focused','border'):raise Conflict('comms_effect_owner_mismatch')
    values,_=latest_environment(context,deploy.root,effect=effect)
    target,config,before=owned_configuration(context,deploy,effect=effect)
    try:owner=_personal_owner(channel,values)
    except Invalid:return {'state':'configuration_required'}
    stage=deploy.root/'.setup/comms'/channel/'pairing';receipt=stage/'result.json'
    if not receipt.exists() and session is None:return {'state':'configuration_required'}
    if not install_channel(effect,context,deploy,harness,channel,config):return {'state':'configuration_required'}
    if not receipt.exists():
        if (stage/'started.json').exists():return {'state':'unknown'}
        script=deploy.source/'installer/native-comms/openclaw/personal-pair.mjs'
        request={'schema':1,'channel':channel,'owner':deploy.claw['id'],'runId':context['runId'],'expectedOwner':owner,
            'helperSha256':hashlib.sha256(guarded_read(script)).hexdigest()}
        path=stage/'request.json';raw=canonical(request)
        if path.exists():
            if guarded_read(path,16384,private=True)!=raw:raise Conflict('comms_personal_request_changed')
        else:deploy.write(effect,path,raw,kind='comms-pairing-request',expected=None)
        node=shutil.which('node',path=harness.environment()['PATH'])
        if not node:return {'state':'configuration_required'}
        effect['commsPairingStage']='linking';context['save']()
        status=session.terminal([node,str(script),str(path)],cwd=deploy.root,env=harness.environment(),context=context,effect=effect)
        if status.get('returncode')!=0:return {'state':'unknown' if (stage/'started.json').exists() else 'cancelled'}
    request,result=_personal_receipt(context,deploy,channel)
    updated=personal_config(channel,config,values,result)
    effect['commsPairingStage']='promoting';context['save']()
    files=_personal_files(deploy,channel,result);_personal_destination_scope(deploy,channel,files)
    for path,raw in files.items():
        current=revision(path);own=[a for a in effect.get('artifacts',[]) if a['path']==str(path)]
        if current:
            if not own or current!=own[-1]['sha256'] or current!=hashlib.sha256(raw).hexdigest():raise Conflict('comms_personal_destination_changed')
        else:deploy.write(effect,path,raw,kind='comms-auth',expected=None)
    deploy.write(effect,target,canonical(updated)+b'\n',kind='configuration',expected=before)
    checked=harness.call(effect,harness.command()+['config','validate'],credentials=values,timeout=30)
    if checked['returncode']:return {'state':'configuration_required'}
    context['artifactIntent'](effect['id'],[deploy.artifact(receipt,guarded_read(receipt,4*1024*1024,private=True),'comms-pairing')])
    effect['commsPairingStage']='complete';context['save']()
    return {'state':'verified'}


def personal_configuration_valid(context,deploy,channel,values):
    """Complete local configuration only, never current provider authentication."""
    try:
        from setup_comms import owned_configuration
        request,result=_personal_receipt(context,deploy,channel)
        if request['expectedOwner']!=_personal_owner(channel,values):return False
        effect=next(e for e in context['journal']['effects'] if e.get('owner')==deploy.claw['id'] and e.get('phase')=='comms' and e.get('channel')==channel)
        if effect.get('state')!='verified' or effect.get('commsPairingStage')!='complete':return False
        _,config,_=owned_configuration(context,deploy)
        if config!=personal_config(channel,config,values,result):return False
        return all(guarded_read(path,4*1024*1024,private=True)==raw for path,raw in _personal_files(deploy,channel,result).items())
    except (OSError,ValueError,TypeError,KeyError,StopIteration):return False


def observe_personal(effect,context,deploy,harness):
    from setup_comms import owned_configuration
    from setup_risk import latest_environment
    from setup_state import revision
    channel=effect['channel'];stage=deploy.root/'.setup/comms'/channel/'pairing'
    if not (stage/'result.json').exists():return 'unknown' if (stage/'started.json').exists() else 'retry_owned'
    try:
        request,result=_personal_receipt(context,deploy,channel);values,_=latest_environment(context,deploy.root,effect=effect)
        _personal_destination_scope(deploy,channel,_personal_files(deploy,channel,result))
        complete=True
        for path,raw in _personal_files(deploy,channel,result).items():
            current=revision(path);own=[a for a in effect.get('artifacts',[]) if a['path']==str(path)]
            if current is None:complete=False;continue
            if not own or current!=own[-1]['sha256'] or current!=hashlib.sha256(raw).hexdigest():return 'conflict'
        if not complete:return 'retry_owned'
        _,config,_=owned_configuration(context,deploy,effect=effect)
        if config!=personal_config(channel,config,values,result):return 'retry_owned'
        if not observe_channel(effect,context,deploy,harness,channel):return 'conflict'
        return 'completed' if harness.call(effect,harness.command()+['config','validate'],credentials=values,timeout=30)['returncode']==0 else 'unknown'
    except (OSError,ValueError,TypeError,KeyError):return 'conflict'
