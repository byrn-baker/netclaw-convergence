"""Owned messaging service observations and activation prerequisites.

No process is started, provider is contacted or message is consumed by these
observers. Native gateway state is accepted only beside the owned manager PID.
"""
from datetime import datetime
import hashlib
import copy
import json
import os
from pathlib import Path
import re
import sys
import time

from setup_report import comms_observation
from setup_schema import loads
from setup_state import Conflict,guarded_read,revision
from setup_process import WriterUncertain

# These adapters report connected only after their authenticated native
# socket/poll path. Webhook/relay "connected" often means a local listener;
# that cannot prove public reachability or provider authentication.
AUTHENTICATED_TRANSPORTS={'hermes':frozenset(('slack','discord','telegram')),
    'openclaw':frozenset(('slack','discord','telegram','whatsapp'))}


def _timestamp(value):
    try:
        parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
        return parsed.timestamp() if parsed.tzinfo is not None else None
    except (AttributeError,ValueError,TypeError):return None


def observed_owned_revision(context,path,*,effect=None):
    """Latest revision, or one exact interrupted intent's earlier owned bytes."""
    records=[(e,a) for e in context['journal']['effects'] for a in e.get('artifacts',[]) if a['path']==str(path)]
    if not records:raise Conflict('comms_revision_unowned')
    writer,artifact=records[-1];actual=revision(path)
    if actual==artifact['sha256']:return actual
    if (effect is None or effect.get('state')=='verified' or writer['id']!=effect['id'] or
        actual is None or actual!=artifact.get('before') or len(records)<2):raise Conflict('comms_revision_changed')
    previous=records[-2][1]
    if (artifact.get('owner')!=effect['owner'] or previous.get('owner')!=effect['owner'] or
        artifact.get('referencedBy')!=[effect['owner']] or previous.get('sha256')!=actual):raise Conflict('comms_revision_changed')
    return actual


def hermes_status(value,home,channel,*,pid,start_time,now):
    """Native 60s global heartbeat; platform rows are transition snapshots.

    A platform timestamp need not advance on an idle authenticated socket. Its
    writer generation must match the independently checked running gateway.
    """
    try:
        if (type(pid) is not int or pid<=1 or type(start_time) is not int or start_time<=0 or
            value.get('kind')!='hermes-gateway' or value.get('hermes_home')!=str(home) or
            value.get('pid')!=pid or value.get('start_time')!=start_time or
            value.get('gateway_state') not in ('running','connected','degraded')):return False
        heartbeat=_timestamp(value.get('updated_at'))
        platform=value.get('platforms',{}).get(channel,{})
        transition=_timestamp(platform.get('updated_at'))
        return bool(heartbeat is not None and -5<=now-heartbeat<=120 and transition is not None and
            transition<=heartbeat+5 and platform.get('writer_pid')==pid and
            platform.get('writer_start_time')==start_time and platform.get('state')=='connected' and
            not platform.get('error_code') and not platform.get('needs_attention'))
    except (AttributeError,TypeError):return False


def openclaw_status(value,channel,*,now):
    """Require an RPC snapshot and live activity, never config-only fallback."""
    try:
        stamp=value.get('ts')
        if type(stamp) not in (int,float) or not -5<=now-stamp/1000<=120:return False
        accounts=value.get('channelAccounts',{}).get(channel)
        if not isinstance(accounts,list) or len(accounts)!=1:return False
        account=accounts[0]
        if (account.get('accountId')!='default' or any(account.get(k) is not True for k in
            ('enabled','configured','running','connected')) or account.get('lastError')):return False
        return any(type(account.get(k)) in (int,float) and -5<=now-account[k]/1000<=120
            for k in ('lastTransportActivityAt','lastConnectedAt'))
    except (AttributeError,TypeError,ValueError):return False


def owned_gateway_pid(probes):
    """Prove manifest, final source, service definition and manager identity."""
    try:
        home=probes.home;context=probes.context
        path=home/'.setup/services.json'
        artifacts=[a for e in context['journal']['effects'] for a in e.get('artifacts',[]) if a['path']==str(path)]
        if not artifacts or revision(path)!=artifacts[-1]['sha256']:return None
        data=loads(guarded_read(path,65536,private=True))
        if any(data.get(k)!=v for k,v in {'runId':context['runId'],'owner':probes.claw['id'],
            'home':str(home),'harness':probes.claw['harness'],'installationId':probes.identity}.items()):return None
        from setup_service_binding import verify
        verify(home,probes.deploy.source,data.get('sourceIndex'))
        services=[s for s in data['services'] if s.get('role')=='gateway' and s.get('hot') is True]
        if len(services)!=1:return None
        from setup_risk import native_service_pid
        return native_service_pid(probes.harness,probes.effect,data['platform'],services[0])
    except WriterUncertain:raise
    except Exception:return None


def process_generation(probes,pid):
    """Stable OS process generation, sampled on both sides of native status."""
    try:
        proc=Path('/proc')/str(pid)/'stat'
        if proc.exists():
            if proc.stat().st_uid!=os.getuid():return None
            raw=proc.read_text();parts=raw[raw.rfind(')')+2:].split()
            return 'linux:'+parts[19] if len(parts)>19 and parts[19].isdigit() else None
        from setup_risk import native_call
        response=native_call(probes.harness,probes.effect,['/bin/ps','-p',str(pid),'-o','uid=,lstart=,command='])
        if response['returncode']:return None
        raw=response['stdout'].decode('utf-8','strict').strip()
        fields=raw.split(None,1)
        if len(fields)!=2 or fields[0]!=str(os.getuid()) or len(fields[1])<25:return None
        return 'ps:'+hashlib.sha256(raw.encode()).hexdigest()
    except WriterUncertain:raise
    except Exception:return None


def observe_runtime(probes,channel):
    now=int(time.time());checker='hermes-gateway' if probes.claw['harness']=='hermes' else 'netclaw-setup'
    result={dimension:comms_observation('unverified','transport_unverified' if dimension=='transport' else 'not_checked',
        checker=checker,observed_at=now) for dimension in ('authentication','transport')}
    if channel not in AUTHENTICATED_TRANSPORTS.get(probes.claw['harness'],()):return result
    pid=owned_gateway_pid(probes)
    if not pid:return result
    generation=process_generation(probes,pid)
    if generation is None:return result
    try:
        values=probes.credentials()
        if probes.claw['harness']=='hermes':
            native=probes.deploy.validator.comms.channel('hermes',channel)['nativeId']
            python=probes.home/'python-runtimes/hermes-hud-agent/venv/bin/python'
            response=probes.harness.call(probes.effect,[str(python),str(probes.deploy.source/'scripts/lib/setup_comms_services.py'),
                'hermes-status',str(pid),native],credentials=values,capture=True,timeout=15)
            value=loads(response['stdout']) if response['returncode']==0 else {}
            connected=value=={'schema':1,'pid':pid,'channel':native,'connected':True}
        else:
            response=probes.harness.call(probes.effect,probes.harness.command()+[
                'channels','status','--channel',channel,'--json','--timeout','10000'],credentials=values,capture=True,timeout=15)
            connected=response['returncode']==0 and openclaw_status(json.loads(response['stdout']),channel,now=int(time.time()))
        # Check again after RPC/native inspection to catch manager replacement.
        if not connected or owned_gateway_pid(probes)!=pid or process_generation(probes,pid)!=generation:return result
        result['transport']=comms_observation('verified','transport_connected',checker=checker,observed_at=int(time.time()))
        # These pinned socket/poll adapters authenticate before reporting
        # connected. A webhook listener or local relay alone proves no auth.
        if channel in AUTHENTICATED_TRANSPORTS[probes.claw['harness']]:
            result['authentication']=comms_observation('verified','authentication_verified',checker=checker,observed_at=int(time.time()))
        return result
    except WriterUncertain:raise
    except Exception:return result


def account_consumer_key(channel,values):
    """Comparable private account identity; never exported or used as auth."""
    identifiers={'teams':('TEAMS_TENANT_ID','TEAMS_CLIENT_ID'),
        'sms':('TWILIO_ACCOUNT_SID','TWILIO_PHONE_NUMBER'),
        'whatsapp-cloud':('WHATSAPP_CLOUD_PHONE_NUMBER_ID',)}
    if channel in identifiers:
        fields=identifiers[channel]
        return (channel,*(values.get(k) for k in fields)) if all(values.get(k) for k in fields) else None
    fields={'slack':'SLACK_BOT_TOKEN','telegram':'TELEGRAM_BOT_TOKEN','discord':'DISCORD_BOT_TOKEN'}
    token=values.get(fields.get(channel,''))
    if not token:return None
    if channel=='telegram' and re.fullmatch(r'[0-9]+:[^\s]+',token):identity=token.split(':',1)[0]
    elif channel=='discord':
        import base64
        try:
            first=token.split('.',1)[0];identity=base64.urlsafe_b64decode(first+'='*((-len(first))%4)).decode()
            if not identity.isdecimal():identity=token
        except (ValueError,UnicodeError):identity=token
    else:identity=token
    return channel,hashlib.sha256(identity.encode()).hexdigest()


def duplicate_consumer(context,claw,values):
    """Compare only this reviewed plan's owned homes; never scan other .envs."""
    from setup_secrets import read_owned_environment
    wanted={key for c in claw.get('channels',[]) if (key:=account_consumer_key(c['id'],values)) is not None}
    if not wanted:return False
    for other in context['plan']['claws']:
        if other['id']==claw['id']:continue
        path=Path(other['runtimeHome'])/'.env'
        artifacts=[a for e in context['journal']['effects'] for a in e.get('artifacts',[]) if
            a.get('owner')==other['id'] and a.get('path')==str(path)]
        if not artifacts:continue
        candidate=read_owned_environment(path,artifacts[-1]['sha256'])
        for channel in other.get('channels',[]):
            key=account_consumer_key(channel['id'],candidate)
            if key is not None and key in wanted:return True
    return False


def effective_access_scope(claw,channel,entry,values):
    """Empty restrictive policy is safe to save, but not a ready intake scope."""
    from setup_comms import access_list
    if claw['harness']=='openclaw':
        from setup_comms_openclaw import PERSONAL_CHANNELS
        # Configuration checks separately bind these to a paired account,
        # scoped Raft credential/profile, or loopback token + device auth.
        if channel in PERSONAL_CHANNELS or channel in ('webchat','raft'):return True
        if channel in ('slack','discord','telegram'):
            # Native OpenClaw group policy also requires users; a guild ID or
            # room selection alone does not grant any effective intake here.
            return bool(access_list(values.get(channel.upper()+'_ALLOWED_USERS','')))
    keys=entry['setup'].get('access',[])
    return any(access_list(values.get(key,'')) for key in keys if not key.endswith('_GUILD_ID'))


def activation_gate(effect,context,deploy,harness):
    """All selected channel setup must still be verified before any service."""
    from types import SimpleNamespace
    from setup_comms_evidence import configuration,configuration_binding
    from setup_risk import latest_environment
    if not deploy.claw.get('channels'):return None
    values,_=latest_environment(context,deploy.root)
    if duplicate_consumer(context,deploy.claw,values):raise Conflict('comms_account_consumer_conflict')
    probe=SimpleNamespace(claw=deploy.claw,context=context,home=deploy.root,deploy=deploy,harness=harness,
        effect=effect,credentials=lambda:dict(values))
    for channel in deploy.claw['channels']:
        entry=deploy.validator.comms.channel(deploy.claw['harness'],channel['id'])
        if entry['setup']['disposition'] not in ('typed','native'):raise Conflict('comms_activation_unqualified')
        if configuration(probe,channel['id'])['state']!='verified':raise Conflict('comms_activation_unverified')
        if not effective_access_scope(deploy.claw,channel['id'],entry,values):raise Conflict('comms_access_scope_required')
    binding=configuration_binding(probe)
    if binding is None:raise Conflict('comms_activation_unbound')
    return {'schema':1,'channels':[c['id'] for c in deploy.claw['channels']],
        'configurationHash':binding[0],'environmentHash':binding[1]}


def verify_activation_binding(home,harness,binding):
    """Native restart cannot activate a later, unreviewed account or policy."""
    if binding is None:return
    if (not isinstance(binding,dict) or set(binding)!= {'schema','channels','configurationHash','environmentHash'} or
        binding['schema']!=1 or not isinstance(binding['channels'],list) or not binding['channels']):raise Conflict('comms_activation_binding_invalid')
    config=Path(home)/('config.yaml' if harness=='hermes' else 'openclaw.json')
    if revision(config)!=binding['configurationHash'] or revision(Path(home)/'.env')!=binding['environmentHash']:
        raise Conflict('comms_activation_configuration_changed')


def observe_channel_effect(effect,context,deploy,harness):
    """Reconcile deterministic typed writes without replaying native effects.

    A before-image only qualifies when it was already an owned earlier write.
    Dependency acquisition and QR/login outcomes without receipts stay unknown.
    """
    from types import SimpleNamespace
    from setup_comms import prepare_channel_config,hermes_channel_inspection
    from setup_secrets import read_owned_environment
    from setup_comms_evidence import configuration
    channel=effect.get('channel');claw=deploy.claw
    try:
        if effect['owner']!=claw['id'] or channel not in {c['id'] for c in claw['channels']}:return 'conflict'
        marker=loads(guarded_read(deploy.root/'.netclaw-setup-owner.json',16384,private=True))
        if marker!={'schema':1,'runId':context['runId'],'planHash':context['planHash'],'installationId':claw['id']}:return 'conflict'
        entry=deploy.validator.comms.channel(claw['harness'],channel)
        if claw['harness']=='openclaw':
            from setup_comms_openclaw import PERSONAL_CHANNELS
        if claw['harness']=='openclaw' and (channel=='whatsapp' or channel in PERSONAL_CHANNELS):
            from setup_comms_openclaw import observe_whatsapp,observe_personal
            if effect.get('state')=='verified':
                from setup_risk import latest_environment
                values,_=latest_environment(context,deploy.root)
                inspection=SimpleNamespace(claw=claw,context=context,deploy=deploy,harness=harness,
                    effect=effect,home=deploy.root,credentials=lambda:dict(values))
                return 'completed' if configuration(inspection,channel)['state']=='verified' else 'conflict'
            observer=observe_whatsapp if channel=='whatsapp' else observe_personal
            return observer(effect,context,deploy,harness)
        hermes_paired=False
        if claw['harness']=='hermes' and channel=='whatsapp':
            from setup_comms_hermes_native import observe_whatsapp
            state=observe_whatsapp(effect,context,deploy,harness)
            if state!='paired':
                if effect.get('state')=='verified':return 'conflict'
                return 'configuration_required' if state=='not_started' else state
            hermes_paired=True
        if entry['setup']['disposition']!='typed' and not hermes_paired:return 'unknown'
        journal=copy.deepcopy(context['journal']);latest={};prior={};partial=False
        for item in journal['effects']:
            for artifact in item.get('artifacts',[]):
                path=artifact['path'];previous=latest.get(path)
                if item['id']==effect['id']:prior[path]=previous
                latest[path]=(item,artifact)
        for path,(writer,artifact) in latest.items():
            if writer['id']!=effect['id']:continue
            if (artifact.get('owner')!=claw['id'] or artifact.get('referencedBy')!=[claw['id']] or
                not Path(path).is_relative_to(deploy.root)):return 'conflict'
            if (hermes_paired and artifact.get('class')=='comms-pairing' and
                Path(path).parent==deploy.root/'platforms/whatsapp/session'):continue
            actual=revision(path)
            if actual==artifact['sha256']:continue
            before=prior.get(path)
            if (effect.get('state')=='verified' or actual!=artifact.get('before') or
                before is None or before[1].get('owner')!=claw['id'] or before[1].get('sha256')!=actual):return 'conflict'
            partial=True;artifact['sha256']=actual
        env_path=deploy.root/'.env';config_path=deploy.root/('config.yaml' if claw['harness']=='hermes' else 'openclaw.json')
        for path in (env_path,config_path):
            latest_item=latest.get(str(path))
            if not latest_item or revision(path)!=latest_item[1]['sha256']:return 'conflict'
        values=read_owned_environment(env_path,latest[str(env_path)][1]['sha256'])
        current=loads(guarded_read(config_path,4*1024*1024,private=True))
        prepared,updates=prepare_channel_config(claw,channel,current,values)
        if claw['harness']=='hermes':
            observed=hermes_channel_inspection(effect,deploy,harness,entry['nativeId'],values=values)
            dependency=bool(observed and observed.get('adapter') is True and observed.get('dependencies') is True)
        else:
            from setup_comms_openclaw import observe_channel,observe_prepared_prerequisites
            dependency=(channel=='webchat' or observe_channel(effect,context,deploy,harness,channel)) and observe_prepared_prerequisites(deploy,channel,values)
        if not dependency:return 'unknown'
        if current==prepared and all(values.get(k)==v for k,v in updates.items()) and not partial:
            # This temporary observation view allows the existing complete
            # checker to examine an interrupted effect; it changes no journal.
            next(e for e in journal['effects'] if e['id']==effect['id'])['state']='verified'
            inspection=SimpleNamespace(claw=claw,context={**context,'journal':journal},deploy=deploy,harness=harness,
                effect=effect,home=deploy.root,credentials=lambda:dict(values))
            return 'completed' if configuration(inspection,channel)['state']=='verified' else 'unknown'
        if effect.get('state')=='verified':return 'conflict'
        return 'retry_owned' if effect.get('artifacts') else 'configuration_required'
    except WriterUncertain:raise
    except Exception:return 'conflict'


def _native_hermes_status(pid,channel):
    home=Path(os.environ.get('HERMES_HOME',''))
    source=Path(sys.executable).parents[2]/'source'
    if (not home.is_absolute() or home.resolve()!=home or not re.fullmatch(r'[a-z][a-z0-9_]{0,63}',channel) or
        Path(sys.executable)!=home/'python-runtimes/hermes-hud-agent/venv/bin/python' or
        Path(__file__).resolve()!=home/'.setup/source/scripts/lib/setup_comms_services.py'):raise Conflict('comms_scope_changed')
    marker=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
    if not marker.get('runId') or not marker.get('installationId'):raise Conflict('comms_scope_changed')
    compatibility=loads(guarded_read(home/'.setup/source/config/hermes-hud-compatibility.json',4*1024*1024))
    if compatibility['revision']!='818c13be1dc4fd28987e1e881a9408224afd4535':raise Conflict('comms_source_changed')
    for relative,digest in compatibility['files'].items():
        if hashlib.sha256(guarded_read(source/relative,8*1024*1024)).hexdigest()!=digest:raise Conflict('comms_source_changed')
    # Strict native liveness opens the existing lock r+ solely to test flock.
    # Refuse aliases/foreign permissions before allowing that one open.
    guarded_read(home/'gateway.lock',16384,private=True)
    guarded_read(home/'gateway.pid',16384,private=True)
    sys.dont_write_bytecode=True
    def audit(event,args):
        if event in ('socket.connect','socket.bind','subprocess.Popen','os.system','os.mkdir','os.remove','os.rename'):
            raise PermissionError('comms_observer_effect_refused')
        if event=='open':
            mode,flags=args[1:3]
            if str(args[0])==str(home/'gateway.lock') and mode=='r+' and not flags&(os.O_CREAT|os.O_TRUNC|os.O_APPEND):return
            if isinstance(mode,str) and any(c in mode for c in 'wax+') or isinstance(flags,int) and flags&(os.O_WRONLY|os.O_CREAT|os.O_TRUNC):
                raise PermissionError('comms_observer_write_refused')
    sys.addaudithook(audit)
    sys.path.insert(0,str(source))
    from gateway.status import get_running_pid_identity_strict
    # The ordinary get_running_pid opens a+ and can remove a poisoned lock.
    # Its strict counterpart only probes existing metadata and never cleans it.
    identity=get_running_pid_identity_strict(home/'gateway.pid')
    live,start=(identity[0],int(identity[1])) if identity else (None,None)
    raw=json.loads(guarded_read(home/'gateway_state.json',1024*1024,private=True))
    connected=live==pid and hermes_status(raw,home,channel,pid=pid,start_time=start,now=time.time())
    return {'schema':1,'pid':pid,'channel':channel,'connected':bool(connected)}


if __name__=='__main__':
    try:
        if len(sys.argv)!=4 or sys.argv[1]!='hermes-status' or not sys.argv[2].isdigit():raise ValueError()
        result=_native_hermes_status(int(sys.argv[2]),sys.argv[3])
        print(json.dumps(result))
    except Exception:
        print('{"schema":1,"connected":false}')
        raise SystemExit(8)
