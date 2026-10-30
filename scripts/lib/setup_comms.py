"""Inert Comms discovery and fixed, owner-scoped setup contracts.

Reading the catalog never imports a runtime, plugin or operational MCP server.
Documentation presence, source compatibility and successful setup are distinct.
"""
import copy
import ipaddress
import re
from pathlib import Path
from urllib.parse import urlsplit

from setup_schema import Invalid, loads, validate
from setup_state import guarded_read
from setup_comms_hermes import SDK_CHANNELS as HERMES_EXTRA_SDK_CHANNELS,PORT_FIELDS as HERMES_EXTRA_PORT_FIELDS


TOKEN_FIELDS = {'discord':('DISCORD_BOT_TOKEN',), 'telegram':('TELEGRAM_BOT_TOKEN',),
                'slack':('SLACK_BOT_TOKEN','SLACK_APP_TOKEN')}
HERMES_SDK_CHANNELS=frozenset((*TOKEN_FIELDS,'teams'))|HERMES_EXTRA_SDK_CHANNELS
WEBHOOK_FIELDS={'teams':('TEAMS_CLIENT_ID','TEAMS_CLIENT_SECRET','TEAMS_TENANT_ID','TEAMS_PORT','NETCLAW_TEAMS_PUBLIC_URL'),
    'sms':('TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_PHONE_NUMBER','SMS_WEBHOOK_PORT','SMS_WEBHOOK_URL')}
WHATSAPP_CLOUD_FIELDS=('WHATSAPP_CLOUD_PHONE_NUMBER_ID','WHATSAPP_CLOUD_ACCESS_TOKEN',
    'WHATSAPP_CLOUD_APP_SECRET','WHATSAPP_CLOUD_VERIFY_TOKEN','WHATSAPP_CLOUD_WEBHOOK_PORT',
    'NETCLAW_WHATSAPP_CLOUD_PUBLIC_URL')
CHANNEL_PORT_FIELDS={('hermes','whatsapp-cloud'):'WHATSAPP_CLOUD_WEBHOOK_PORT',('hermes','teams'):'TEAMS_PORT',('hermes','sms'):'SMS_WEBHOOK_PORT'}
CHANNEL_PORT_FIELDS.update({('hermes',channel):field for channel,field in HERMES_EXTRA_PORT_FIELDS.items()})
CHANNEL_PORT_FIELDS.update({('openclaw','msteams'):'MSTEAMS_WEBHOOK_PORT',
    ('openclaw','nextcloud-talk'):'NEXTCLOUD_TALK_WEBHOOK_PORT'})


def require_https_callback(value,path):
    try:
        endpoint=urlsplit(value)
        host=(endpoint.hostname or '').lower().rstrip('.')
        try:local_address=not ipaddress.ip_address(host).is_global
        except ValueError:local_address=False
        if (endpoint.scheme!='https' or not host or host=='localhost' or host.endswith('.localhost') or local_address or
            endpoint.username or endpoint.password or endpoint.query or endpoint.fragment or endpoint.path!=path):
            raise Invalid('comms_public_callback_required')
        if endpoint.port is not None and not 1<=endpoint.port<=65535:raise ValueError()
    except (ValueError,TypeError):raise Invalid('comms_public_callback_required') from None


def prepare_hermes_webhook(channel,config,values):
    if any(not values.get(k) for k in WEBHOOK_FIELDS[channel]):raise Invalid('comms_credentials_required')
    prefix=channel.upper();users=access_list(values.get(prefix+'_ALLOWED_USERS',''))
    port_key='TEAMS_PORT' if channel=='teams' else 'SMS_WEBHOOK_PORT';port=values[port_key]
    if not str(port).isdecimal() or not 1024<=int(port)<=65535:raise Invalid('comms_callback_port_required')
    updates={'GATEWAY_ALLOW_ALL_USERS':'false','GATEWAY_ALLOWED_USERS':'',prefix+'_ALLOW_ALL_USERS':'false',
        prefix+'_ALLOWED_USERS':','.join(users)}
    extra={'allow_from':users,'allow_all_users':False,'require_mention':True}
    if channel=='teams':
        guid=r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}'
        if any(not re.fullmatch(guid,v) for v in [values['TEAMS_CLIENT_ID'],values['TEAMS_TENANT_ID'],*users]):
            raise Invalid('comms_teams_object_id_required')
        require_https_callback(values['NETCLAW_TEAMS_PUBLIC_URL'],'/api/messages')
        extra.update(host='127.0.0.1',port=int(port));updates.update(TEAMS_HOST='127.0.0.1',TEAMS_REQUIRE_MENTION='true')
    else:
        if not re.fullmatch(r'AC[0-9a-fA-F]{32}',values['TWILIO_ACCOUNT_SID']):raise Invalid('comms_twilio_account_required')
        if any(not re.fullmatch(r'\+[1-9][0-9]{5,14}',v) for v in [values['TWILIO_PHONE_NUMBER'],*users]):
            raise Invalid('comms_phone_allowlist_required')
        require_https_callback(values['SMS_WEBHOOK_URL'],'/webhooks/twilio')
        updates.update(SMS_WEBHOOK_HOST='127.0.0.1',SMS_INSECURE_NO_SIGNATURE='false')
    result=copy.deepcopy(config)
    result.setdefault('platforms',{})[channel]={'enabled':True,'gateway_restart_notification':False,'extra':extra}
    return result,updates


def channel_test_choices(plan,manifest):
    choices=[]
    for claw in plan['claws']:
        for selected in claw['channels']:
            entry=next((e for e in manifest['entries'] if e['harness']==claw['harness'] and
                e['channelId']==selected['id'] and e['inventory']=='channel'),None)
            supported=selected['id'] in TOKEN_FIELDS or claw['harness']=='hermes' and selected['id']=='sms'
            if not entry or entry['setup']['disposition'] not in ('typed','native') or not supported:continue
            choices.append({'key':claw['id']+'/'+selected['id']+'/outbound','owner':claw['id'],
                'channel':selected['id'],'direction':'outbound','label':claw['displayName']+' · '+entry['name']+' · Outbound',
                'picked':any(t['owner']==claw['id'] and t['channel']==selected['id'] and t.get('direction','outbound')=='outbound'
                    for t in plan['verification']['channelTests'])})
    return choices


def set_channel_tests(plan,keys,manifest):
    choices={c['key']:c for c in channel_test_choices(plan,manifest)}
    if len(keys)!=len(set(keys)) or any(k not in choices for k in keys):raise Invalid('comms_test_selection_invalid')
    result=copy.deepcopy(plan)
    key_for=lambda t:t['owner']+'/'+t['channel']+'/'+t.get('direction','outbound')
    tests=[t for t in result['verification']['channelTests'] if key_for(t) not in choices or key_for(t) in keys]
    for key in keys:
        if not any(key_for(t)==key for t in tests):
            tests.append({k:choices[key][k] for k in ('owner','channel','direction')}|{'destinationRef':'native-test'})
    if len(tests)>64:raise Invalid('comms_test_limit')
    result['verification']['channelTests']=tests
    return result


def channel_listening_ports(plan):
    for claw in plan['claws']:
        for channel in claw.get('channels',[]):
            key=CHANNEL_PORT_FIELDS.get((claw['harness'],channel['id']))
            setting=claw['settings'].get(key,{}) if key else {}
            if setting.get('kind')=='value':yield setting.get('value')


def set_zoom_binding(plan,owner,port):
    """Draft only: no credential access, listener or cross-home write."""
    result=copy.deepcopy(plan);others=[b for b in result.get('commsBindings',[]) if b['owner']!=owner]
    if port is None:result['commsBindings']=others;return result
    claw=next((c for c in result['claws'] if c['id']==owner),None)
    borders=[c for c in result['claws'] if c['role']=='border']
    if result['shape']!='risk' or not claw or claw['role']=='border' or 'zoom-rtms' not in claw['capabilities']['components'] or len(borders)!=1:
        raise Invalid('comms_binding_owner_mismatch')
    if (type(port) is not int or not 1024<=port<=65535 or
        any(b['border']==borders[0]['id'] or b['port']==port for b in others) or
        any(port in c.get('endpoints',{}).values() for c in result['claws'])):raise Invalid('comms_binding_port_occupied')
    prior=next((b for b in result.get('commsBindings',[]) if b['owner']==owner),{})
    for key in ('N2N_ZOOM_CHANNEL_HOST','N2N_ZOOM_CHANNEL_PORT','N2N_ZOOM_CHANNEL_SECRET'):claw.get('settings',{}).pop(key,None)
    result['commsBindings']=[*others,{'id':prior.get('id',owner),'integration':'zoom','owner':owner,'border':borders[0]['id'],'port':port}]
    return result


def hermes_transport_evidence(home, native_id, *, pid, start_time, now):
    """Require an independently observed owned live process plus fresh status.

    Callers obtain pid/start_time from their service/process observation, never
    from this status file. Configuration is not transport evidence.
    """
    from datetime import datetime
    import json
    if type(pid) is not int or pid<=1 or type(start_time) is not int or start_time<=0:return 'unverified'
    def fresh(value):
        try:
            parsed=datetime.fromisoformat(value.replace('Z','+00:00'))
            return parsed.tzinfo is not None and -5<=now-parsed.timestamp()<=30
        except (AttributeError,TypeError,ValueError):return False
    try:
        # Native status metrics may be floating point. They are never exported
        # or used as identity evidence; the plan-only JSON parser forbids them.
        def invalid_constant(_):raise ValueError('invalid_status_number')
        value=json.loads(guarded_read(Path(home)/'gateway_state.json',1024*1024,private=True),parse_constant=invalid_constant)
        if (value.get('kind')!='hermes-gateway' or value.get('hermes_home')!=str(home) or
            value.get('pid')!=pid or value.get('start_time')!=start_time or not fresh(value.get('updated_at'))):return 'unverified'
        platform=value.get('platforms',{}).get(native_id,{})
        if (platform.get('writer_pid')!=pid or platform.get('writer_start_time')!=start_time or
            not fresh(platform.get('updated_at')) or platform.get('state')!='connected'):return 'unverified'
        return 'connected'
    except (OSError,ValueError,TypeError,AttributeError):return 'unverified'


def prepare_channel_config(claw, channel, config, values):
    """Pure pinned typed adapters. Empty access lists grant no inbound access.

    The installer owns one account per selected platform. This function never
    authenticates, imports a gateway, starts a listener or embeds credential
    values in native config. All writes are performed separately with revisions.
    """
    if claw['role'] not in ('focused','border') or channel not in {c['id'] for c in claw['channels']}:
        raise Invalid('comms_owner_mismatch')
    if claw['harness']=='hermes':
        from setup_comms_hermes import CONTRACTS,prepare
        if channel in CONTRACTS:return prepare(channel,config,values,home=claw['runtimeHome'])
    if claw['harness']=='openclaw':
        if channel=='webchat':
            gateway=config.get('gateway',{})
            token={'source':'env','provider':'default','id':'OPENCLAW_GATEWAY_TOKEN'}
            if (gateway.get('mode')!='local' or gateway.get('bind')!='loopback' or
                gateway.get('port')!=claw['endpoints']['gatewayPort'] or
                gateway.get('auth',{}).get('mode')!='token' or gateway['auth'].get('token')!=token or
                len(values.get('OPENCLAW_GATEWAY_TOKEN',''))<32 or
                'webchat' in config.get('channels',{}) or 'webchat' in gateway or
                gateway.get('controlUi',{}).get('dangerouslyDisableDeviceAuth') or
                gateway.get('controlUi',{}).get('allowInsecureAuth')):
                raise Invalid('comms_webchat_owned_gateway_required')
            return copy.deepcopy(config),{}
        from setup_comms_openclaw_config import CONTRACTS,prepare_config
        if channel in CONTRACTS:return prepare_config(channel,config,values)
        if channel=='whatsapp':
            from setup_comms_openclaw import whatsapp_config
            return whatsapp_config(config,values,Path(claw['runtimeHome'])/'credentials/whatsapp/default'),{}
    if claw['harness']=='hermes' and channel in WEBHOOK_FIELDS:return prepare_hermes_webhook(channel,config,values)
    cloud=claw['harness']=='hermes' and channel=='whatsapp-cloud'
    if not cloud and (channel not in TOKEN_FIELDS or claw['harness'] not in ('openclaw','hermes')):
        raise Invalid('comms_adapter_unavailable')
    if any(not values.get(k) for k in (WHATSAPP_CLOUD_FIELDS if cloud else TOKEN_FIELDS[channel])):
        raise Invalid('comms_credentials_required')
    if cloud:
        users=access_list(values.get('WHATSAPP_CLOUD_ALLOWED_USERS',''))
        if any(not re.fullmatch(r'\+?[0-9]{6,15}',u) for u in users):raise Invalid('comms_phone_allowlist_required')
        if not re.fullmatch(r'[0-9]{5,32}',values['WHATSAPP_CLOUD_PHONE_NUMBER_ID']):raise Invalid('comms_phone_number_id_required')
        port=values['WHATSAPP_CLOUD_WEBHOOK_PORT']
        if not str(port).isdecimal() or not 1024<=int(port)<=65535:raise Invalid('comms_callback_port_required')
        require_https_callback(values['NETCLAW_WHATSAPP_CLOUD_PUBLIC_URL'],'/whatsapp/webhook')
        result=copy.deepcopy(config)
        result.setdefault('platforms',{})['whatsapp_cloud']={'enabled':True,'gateway_restart_notification':False,
            'extra':{'allow_from':users,'allow_all_users':False,'dm_policy':'allowlist','group_policy':'disabled',
                'require_mention':True,'webhook_host':'127.0.0.1','webhook_port':int(port),'webhook_path':'/whatsapp/webhook'}}
        updates={'GATEWAY_ALLOW_ALL_USERS':'false','GATEWAY_ALLOWED_USERS':'','WHATSAPP_CLOUD_ALLOW_ALL_USERS':'false',
            'WHATSAPP_CLOUD_ALLOWED_USERS':','.join(users),'WHATSAPP_CLOUD_ALLOW_FROM':','.join(users),
            'WHATSAPP_CLOUD_DM_POLICY':'allowlist','WHATSAPP_CLOUD_GROUP_POLICY':'disabled',
            'WHATSAPP_CLOUD_WEBHOOK_HOST':'127.0.0.1','WHATSAPP_CLOUD_WEBHOOK_PATH':'/whatsapp/webhook'}
        return result,updates
    prefix=channel.upper();users=access_list(values.get(prefix+'_ALLOWED_USERS',''))
    rooms=access_list(values.get(prefix+'_ALLOWED_CHANNELS',''))
    result=copy.deepcopy(config);updates={}
    if claw['harness']=='openclaw':
        plugins=result.setdefault('plugins',{})
        if (plugins.get('enabled') is False or channel in plugins.get('deny',[]) or
            plugins.get('allow') and channel not in plugins['allow']):raise Invalid('comms_plugin_policy_blocks_selection')
        # Selecting a channel authorizes that plugin's entry only. Shared
        # enablement policy, allow/deny lists and other entries are preserved.
        plugins.setdefault('entries',{}).setdefault(channel,{})['enabled']=True
        selected={'enabled':True,'configWrites':False,'dmPolicy':'allowlist','allowFrom':users,
                  'groupPolicy':'allowlist' if rooms and users else 'disabled'}
        if channel=='discord':
            guilds=access_list(values.get('DISCORD_GUILD_ID',''))
            if len(guilds)>1 or rooms and not guilds:raise Invalid('comms_discord_guild_required')
            selected['token']='${DISCORD_BOT_TOKEN}'
            selected['guilds']={g:{'requireMention':True,'users':users,
                'channels':{r:{'enabled':True,'requireMention':True,'users':users} for r in rooms}} for g in guilds}
        elif channel=='slack':
            selected.update(mode='socket',botToken='${SLACK_BOT_TOKEN}',appToken='${SLACK_APP_TOKEN}',
                requireMention=True,channels={r:{'enabled':True,'requireMention':True,'users':users} for r in rooms})
        else:
            selected.update(botToken='${TELEGRAM_BOT_TOKEN}',groupAllowFrom=users,
                groups={r:{'enabled':True,'requireMention':True,'allowFrom':users} for r in rooms})
        # Replace only this installation's single selected account. Other
        # channels, provider configuration and MCP registrations are untouched.
        result.setdefault('channels',{})[channel]=selected
    else:
        extra={'allow_from':users,'allow_all_users':False,'require_mention':True,
               'thread_require_mention':True}
        if channel=='telegram':
            extra.update(allowed_chats=rooms,group_allowed_chats=rooms,group_allow_from=users)
        else:extra['allowed_channels']=rooms
        if channel=='discord':extra.update(allowed_roles=[],allow_bots=False)
        result.setdefault('platforms',{})[channel]={'enabled':True,'gateway_restart_notification':False,'extra':extra}
        updates={'GATEWAY_ALLOW_ALL_USERS':'false','GATEWAY_ALLOWED_USERS':'',
                 prefix+'_ALLOW_ALL_USERS':'false',prefix+'_REQUIRE_MENTION':'true',
                 prefix+'_ALLOWED_USERS':','.join(users),prefix+'_ALLOWED_CHANNELS':','.join(rooms)}
        if channel in ('discord','slack'):updates[prefix+'_THREAD_REQUIRE_MENTION']='true'
        if channel=='discord':updates.update(DISCORD_ALLOWED_ROLES='',DISCORD_ALLOW_BOTS='false')
        if channel=='telegram':updates.update(TELEGRAM_ALLOWED_CHATS=','.join(rooms),
            TELEGRAM_GROUP_ALLOWED_CHATS=','.join(rooms),TELEGRAM_GROUP_ALLOWED_USERS=','.join(users))
    return result,updates


def owned_configuration(context, deploy,*,effect=None):
    from setup_state import Conflict
    import hashlib
    target=deploy.root/('config.yaml' if deploy.claw['harness']=='hermes' else 'openclaw.json')
    artifacts=[a for e in context['journal']['effects'] for a in e.get('artifacts',[]) if a['path']==str(target)]
    if not artifacts:raise Conflict('comms_configuration_not_owned')
    from setup_comms_services import observed_owned_revision
    before=observed_owned_revision(context,target,effect=effect);data=guarded_read(target,4*1024*1024,private=True)
    if hashlib.sha256(data).hexdigest()!=before:raise Conflict('comms_configuration_changed')
    # Managed typed writes use the JSON subset of YAML. Native YAML handoffs
    # have a separate installed-runtime parser and revision contract.
    return target,loads(data,4*1024*1024),before


def hermes_channel_inspection(effect,deploy,harness,channel,*,mode='inspect',values=None):
    """One selected native plugin, no setup wizard or adapter construction."""
    args=harness.command()[:1]+[str(deploy.source/'installer/native-comms/hermes_setup.py'),channel,mode]
    checked=harness.call(effect,args,credentials=values,capture=True,timeout=45)
    if checked['returncode']:return None
    try:
        result=loads(checked['stdout'],16384)
        if result.get('schema')!=1 or result.get('channel')!=channel or result.get('source')!='818c13be1dc4fd28987e1e881a9408224afd4535':return None
        return result
    except ValueError:return None


def install_hermes_channel_dependencies(effect,deploy,harness,channel):
    """Hash-locked SDK-only additions constrained against the qualified core."""
    import hashlib
    import shutil
    if channel not in HERMES_SDK_CHANNELS:return False
    entry=deploy.validator.comms.channel('hermes',channel)
    requirements=deploy.source/'installer/native-comms/hermes'/(channel+'.txt')
    checksum='sha256-'+hashlib.sha256(guarded_read(requirements,1024*1024)).hexdigest()
    deps=entry['setup']['dependencies']
    source_build=channel in ('dingtalk','matrix')
    if len(deps)!=(2 if source_build else 1) or deps[0]['id']!='hermes-'+channel+'-sdk' or deps[0]['integrity']!=checksum:return False
    uv=shutil.which('uv',path=harness.environment()['PATH'])
    if not uv:return False
    if source_build:
        build=deploy.source/'installer/native-comms/hermes/build-tools.txt'
        if deps[1]['id']!='hermes-source-build-tools' or deps[1]['integrity']!='sha256-'+hashlib.sha256(guarded_read(build,1024*1024)).hexdigest():return False
        result=harness.call(effect,[uv,'pip','install','--python',harness.command()[0],'--require-hashes','--only-binary',':all:','-r',str(build)],timeout=600)
        if result['returncode']:return False
    mode=['--no-build-isolation'] if source_build else ['--only-binary',':all:']
    result=harness.call(effect,[uv,'pip','install','--python',harness.command()[0],'--require-hashes',*mode,
        '-c',str(deploy.source/'config/hermes-hud-agent-constraints.txt'),'-r',str(requirements)],timeout=600)
    if result['returncode']:return False
    observed=hermes_channel_inspection(effect,deploy,harness,entry['nativeId'])
    return bool(observed and observed.get('adapter') is True and observed.get('dependencies') is True)


def configure_channel(effect, context, deploy, harness,*,session=None):
    from setup_schema import canonical
    from setup_state import Conflict
    from setup_risk import latest_environment
    from setup_secrets import _dotenv
    claw=deploy.claw;channel=effect.get('channel')
    if effect['owner']!=claw['id'] or effect['phase']!='comms':raise Conflict('comms_effect_owner_mismatch')
    entry=deploy.validator.comms.channel(claw['harness'],channel)
    resolved=deploy.validator.comms.resolve(entry['id'],role=claw['role'],host=context['plan']['host']['platform'],version=claw['runtimeVersion'])
    if resolved['state']=='native' and claw['harness']=='openclaw' and channel=='whatsapp':
        from setup_comms_openclaw import configure_whatsapp
        return configure_whatsapp(effect,context,deploy,harness,session=session)
    if resolved['state']=='native' and claw['harness']=='openclaw' and channel in ('wechat','zalouser','zaloclawbot'):
        from setup_comms_openclaw import configure_personal
        return configure_personal(effect,context,deploy,harness,session=session)
    hermes_pair=resolved['state']=='native' and claw['harness']=='hermes' and channel=='whatsapp'
    if (resolved['state']!='typed' and not hermes_pair or entry['setup']['adapter'] not in
        ('typed-bot-v1','typed-whatsapp-cloud-v1','typed-hermes-webhook-v1','typed-hermes-platform-v1',
         'typed-openclaw-channel-v1','typed-webchat-v1','native-hermes-whatsapp-v1')):return {'state':'configuration_required'}
    values,env_revision=latest_environment(context,deploy.root,effect=effect)
    target,config,before=owned_configuration(context,deploy,effect=effect)
    try:updated,env_updates=prepare_channel_config(claw,channel,config,values)
    except Invalid:return {'state':'configuration_required'}
    if claw['harness']=='hermes':
        from setup_comms_hermes_native import install_bridge,install_homeassistant,install_buzz,install_raft_profile,pair_whatsapp
        if channel in ('whatsapp','photon','raft') and not install_bridge(effect,deploy,harness,channel):return {'state':'configuration_required'}
        if channel=='homeassistant' and not install_homeassistant(effect,deploy):return {'state':'configuration_required'}
        if channel=='buzz' and not install_buzz(effect,deploy,harness,values):return {'state':'configuration_required'}
        if channel=='raft' and not install_raft_profile(effect,deploy,harness,values):return {'state':'configuration_required'}
        if channel=='whatsapp' and not pair_whatsapp(effect,context,deploy,harness,session):return {'state':'configuration_required'}
        if channel!='homeassistant':
            observed=hermes_channel_inspection(effect,deploy,harness,entry['nativeId'],values=values)
            if not observed or not observed.get('adapter'):return {'state':'configuration_required'}
            if not observed.get('dependencies') and not install_hermes_channel_dependencies(effect,deploy,harness,channel):return {'state':'configuration_required'}
    elif channel!='webchat':
        from setup_comms_openclaw import install_channel,prepared_prerequisites
        if not install_channel(effect,context,deploy,harness,channel,config):return {'state':'configuration_required'}
        if not prepared_prerequisites(effect,context,deploy,harness,channel,values):return {'state':'configuration_required'}
    if env_updates:
        values.update(env_updates)
        data=''.join(k+'='+_dotenv.quote(values[k])+'\n' for k in sorted(values)).encode()
        deploy.write(effect,deploy.root/'.env',data,kind='credentials',expected=env_revision)
    data=canonical(updated)+b'\n'
    deploy.write(effect,target,data,kind='configuration',expected=before)
    if guarded_read(target,4*1024*1024,private=True)!=data:return {'state':'failed'}
    if claw['harness']=='openclaw':args=harness.command()+['config','validate']
    else:
        observed=hermes_channel_inspection(effect,deploy,harness,entry['nativeId'],mode='readback',values=values)
        if not observed or observed.get('configured') is not True or observed.get('dependencies') is not True:return {'state':'configuration_required'}
        return {'state':'verified','comms':{'channel':channel,'configuration':'configured',
            'authentication':'unverified','transport':'unverified','inbound':'unverified','outbound':'unverified'}}
    checked=harness.call(effect,args,credentials=values,timeout=30)
    if checked['returncode']:return {'state':'configuration_required'}
    return {'state':'verified','comms':{'channel':channel,'configuration':'configured',
        'authentication':'unverified','transport':'unverified','inbound':'unverified','outbound':'unverified'}}


def configure_zoom_binding(effect, context, deploy):
    """Pair two run-owned environments; partial writes never start services."""
    import hashlib
    import secrets
    from setup_deploy import Deployment
    from setup_schema import canonical
    from setup_secrets import read_owned_environment, _dotenv
    from setup_state import Conflict, revision
    plan=context['plan']
    binding=next((b for b in plan.get('commsBindings',[]) if b['id']==effect.get('binding')),None)
    if (not binding or binding['integration']!='zoom' or plan['shape']!='risk' or
        binding['owner']!=effect['owner'] or deploy.claw['id']!=binding['owner'] or
        'zoom-rtms' not in deploy.claw['capabilities']['components']):raise Conflict('comms_binding_owner_mismatch')
    border=next((c for c in plan['claws'] if c['id']==binding['border'] and c['role']=='border'),None)
    if not border or border['id']==binding['owner']:raise Conflict('comms_binding_owner_mismatch')
    if sum(b['border']==border['id'] for b in plan.get('commsBindings',[]))!=1:raise Conflict('comms_binding_border_occupied')
    deployments=[deploy,Deployment(deploy.repository,border,context)];snapshots=[]
    for target in deployments:
        marker=loads(guarded_read(target.root/'.netclaw-setup-owner.json',16384,private=True))
        if any(marker.get(k)!=v for k,v in {'runId':context['runId'],'planHash':context['planHash'],'installationId':target.claw['id']}.items()):raise Conflict('comms_binding_foreign_home')
        path=target.root/'.env';current=revision(path)
        recorded=[(e,a) for e in context['journal']['effects'] for a in e.get('artifacts',[]) if a['path']==str(path)]
        if not current or not recorded:raise Conflict('comms_binding_environment_changed')
        writer,artifact=recorded[-1]
        interrupted=(writer['id']==effect['id'] and effect.get('state')!='verified' and current==artifact.get('before'))
        if current!=artifact['sha256'] and not interrupted:raise Conflict('comms_binding_environment_changed')
        snapshots.append((target,read_owned_environment(path,current),current))
    own,values,current=snapshots[0]
    settled=any(a['path']==str(own.root/'.env') and a['sha256']==current for a in effect.get('artifacts',[]))
    secret=values.get('N2N_ZOOM_CHANNEL_SECRET') if settled else secrets.token_urlsafe(32)
    if not secret or len(secret)<32:raise Conflict('comms_binding_secret_missing')
    receipt={'schema':1,'binding':binding['id'],'owner':binding['owner'],'border':binding['border'],
             'host':'127.0.0.1','port':binding['port'],'environments':[]}
    for target,values,before in snapshots:
        values.update(N2N_ZOOM_CHANNEL_HOST='127.0.0.1',N2N_ZOOM_CHANNEL_PORT=str(binding['port']),N2N_ZOOM_CHANNEL_SECRET=secret)
        data=''.join(k+'='+_dotenv.quote(values[k])+'\n' for k in sorted(values)).encode()
        target.write(effect,target.root/'.env',data,kind='credentials',expected=before)
        expected=hashlib.sha256(data).hexdigest()
        if read_owned_environment(target.root/'.env',expected).get('N2N_ZOOM_CHANNEL_SECRET')!=secret:raise Conflict('comms_binding_readback_failed')
        receipt['environments'].append({'owner':target.claw['id'],'sha256':expected})
    target=deploy.root/'.setup/comms-bindings'/(binding['id']+'.json')
    deploy.write(effect,target,canonical(receipt),kind='comms-binding')
    return {'state':'verified'}


def observe_zoom_binding(effect,context,deploy):
    """Read-only binding recovery; an owned partial prefix is safe to finish."""
    from setup_schema import canonical
    from setup_secrets import read_owned_environment
    from setup_state import revision
    try:
        plan=context['plan'];binding=next(b for b in plan.get('commsBindings',[]) if b['id']==effect.get('binding'))
        if binding['owner']!=deploy.claw['id'] or effect['owner']!=binding['owner']:return 'conflict'
        receipt={'schema':1,'binding':binding['id'],'owner':binding['owner'],'border':binding['border'],
                 'host':'127.0.0.1','port':binding['port'],'environments':[]}
        secrets=[];complete=True
        for owner in (binding['owner'],binding['border']):
            claw=next(c for c in plan['claws'] if c['id']==owner);home=Path(claw['runtimeHome'])
            marker=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
            if marker!={'schema':1,'runId':context['runId'],'planHash':context['planHash'],'installationId':owner}:return 'conflict'
            target=home/'.env';current=revision(target)
            recorded=[(e,a) for e in context['journal']['effects'] for a in e.get('artifacts',[]) if a['path']==str(target)]
            if not current or not recorded:return 'conflict'
            writer,artifact=recorded[-1]
            if current!=artifact['sha256']:
                if writer['id']!=effect['id'] or effect.get('state')=='verified' or current!=artifact.get('before'):return 'conflict'
                complete=False
            values=read_owned_environment(target,current)
            own=[a for a in effect.get('artifacts',[]) if a['path']==str(target)]
            if not own:complete=False;continue
            receipt['environments'].append({'owner':owner,'sha256':own[-1]['sha256']})
            secret=values.get('N2N_ZOOM_CHANNEL_SECRET','')
            if len(secret)<32 or values.get('N2N_ZOOM_CHANNEL_HOST')!='127.0.0.1' or values.get('N2N_ZOOM_CHANNEL_PORT')!=str(binding['port']):complete=False
            secrets.append(secret)
        if not complete or len(secrets)!=2 or secrets[0]!=secrets[1]:return 'retry_owned' if effect.get('state')!='verified' else 'conflict'
        target=deploy.root/'.setup/comms-bindings'/(binding['id']+'.json')
        own=[a for a in effect.get('artifacts',[]) if a['path']==str(target)]
        if not own or not target.exists():return 'retry_owned' if effect.get('state')!='verified' else 'conflict'
        return 'completed' if guarded_read(target,16384,private=True)==canonical(receipt) and revision(target)==own[-1]['sha256'] else 'conflict'
    except (OSError,ValueError,KeyError,StopIteration):return 'conflict'


def access_list(value):
    """Explicit identifiers only; empty means no grant, never public access."""
    if not isinstance(value, str) or len(value) > 4096 or any(c in value for c in '\r\n\0'):
        raise Invalid('invalid_comms_access')
    if not value.strip():
        return []
    values = [v.strip() for v in value.split(',')]
    if len(values) > 128 or any(not v or len(v)>256 or re.search(r'[\s*?\\]', v) or '://' in v for v in values):
        raise Invalid('invalid_comms_access')
    return list(dict.fromkeys(values))


def select_channels(claw, channel_ids, validator):
    """Draft an additive selection while retaining other owners' references.

    This function never reads credentials or performs onboarding. Unknown fields
    remain available to the validator instead of being silently cleaned away.
    """
    if not isinstance(channel_ids,list) or len(channel_ids)>64 or len(set(channel_ids))!=len(channel_ids):
        raise Invalid('invalid_channel_selection')
    if 'none' in channel_ids:
        if channel_ids != ['none']:
            raise Invalid('invalid_channel_selection')
        channel_ids = []
    draft=copy.deepcopy(claw)
    previous_keys={key for c in claw['channels'] for key in c['settingKeys']}
    channels=[]
    for cid in channel_ids:
        entry=validator.comms.channel(claw['harness'],cid)
        if claw['role'] not in entry['roles']:
            raise Invalid('comms_role_restricted')
        descriptor=validator.choices.get(('channel',cid))
        if descriptor is None:
            raise Invalid('unsupported_comms_channel')
        fields=entry['setup']['settings'] or descriptor['settings']
        channels.append({'id':cid,'settingKeys':[f['key'] for f in fields]})
    draft['channels']=channels
    retained_fields=validator.fields(draft)
    for key in previous_keys-set(retained_fields):
        draft['settings'].pop(key,None)
    for key,field in retained_fields.items():
        if field['classification']=='secret' and key not in draft['settings'] and any(key in c['settingKeys'] for c in channels):
            draft['settings'][key]={'kind':'secret','key':key,'owner':draft['id'],'source':'prompt'}
    return draft


def check_catalog(data, schema):
    errors = validate(data, schema)
    if errors:
        return errors
    seen, channels = set(), set()
    for entry in data['entries']:
        def bad(code):
            errors.append({'pointer': '/entries/*', 'code': code})
        if entry['id'] in seen:
            bad('duplicate_comms_id')
        seen.add(entry['id'])
        if entry['inventory'] == 'channel':
            key = (entry['harness'], entry['channelId'])
            if key in channels:
                bad('duplicate_channel_contract')
            channels.add(key)
            if 'member' in entry['roles'] or entry['component'] is not None:
                bad('conversation_owner_contract')
        if entry['inventory'] == 'netclaw' and ('border' in entry['roles'] or entry['component'] is None):
            bad('comms_tool_owner_contract')
        try:
            url = urlsplit(entry['documentation'])
            if url.scheme != 'https' or not url.hostname or url.username or url.password:
                bad('unsafe_documentation_url')
        except ValueError:
            bad('unsafe_documentation_url')
        setup = entry['setup']
        if setup['disposition'] in ('typed', 'native') and (not setup['adapter'] or not setup['readback']):
            bad('missing_setup_contract')
        if setup['disposition'] == 'unavailable-baseline' and entry['baseline']['support'] != 'not-found':
            bad('unproven_baseline_absence')
        if entry['baseline']['support'] == 'not-found' and setup['disposition'] != 'unavailable-baseline':
            bad('absent_baseline_activation')
        keys = [f['key'] for f in setup['settings']]
        if len(set(keys)) != len(keys) or not set(setup['access']) <= set(keys):
            bad('invalid_comms_setting_join')
        for field in setup['settings']:
            if field['classification'] == 'secret' and field['example']:
                bad('secret_example')
    return errors


class CommsCatalog:
    def __init__(self, repository):
        root = Path(repository) / 'config/components'
        self.schema = loads(guarded_read(root / 'comms.schema.json', 1024*1024))
        self.data = loads(guarded_read(root / 'comms.json', 4*1024*1024), 4*1024*1024)
        if check_catalog(self.data, self.schema):
            raise Invalid('invalid_comms_catalog')
        self.entries = self.data['entries']

    def channel(self, harness, channel):
        for entry in self.entries:
            if entry['harness'] == harness and entry['channelId'] == channel and (
                    entry['inventory'] == 'channel' or channel == 'webex'):
                return copy.deepcopy(entry)
        raise Invalid('unsupported_comms_channel')

    def search(self, query='', *, harness=None):
        query = query.casefold().strip()
        return [copy.deepcopy(e) for e in self.entries
                if (harness is None or e['harness'] == harness) and
                query in ' '.join([e['name'], e['channelId'], e['kind'], *e['aliases']]).casefold()]

    def resolve(self, entry_id, *, role, host, version):
        entry = next((e for e in self.entries if e['id'] == entry_id), None)
        if entry is None:
            raise Invalid('unknown_comms_option')
        if entry['harness'] == 'hermes' and version.startswith('v'):
            version = version[1:]
        state = ('role-restricted' if role not in entry['roles'] else
                 'host-restricted' if host not in entry['hosts'] else
                 'version-unqualified' if version != entry['baseline']['version'] else
                 entry['setup']['disposition'])
        return {'entry': copy.deepcopy(entry), 'state': state,
                'selectable': state in ('typed', 'native'),
                'qualified': entry['qualification']}
