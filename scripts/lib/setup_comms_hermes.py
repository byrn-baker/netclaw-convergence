"""Pure, source-pinned Hermes channel forms.

Only reviewed non-secret fields go into config. Credentials remain in the owned
environment; hydration below is an in-memory native validation view. This module
does not import a gateway, authenticate, listen, pair an account or send anything.
"""
import copy
import ipaddress
import json
import re
from urllib.parse import urlsplit

from setup_schema import Invalid

PIN='818c13be1dc4fd28987e1e881a9408224afd4535'

# (environment key, label, kind, required). These are fixed audited fields,
# never plan-provided config paths or executable native arguments.
CONTRACTS={
 'google-chat':{'native':'google_chat','prefix':'GOOGLE_CHAT','fields':[
  ('GOOGLE_CHAT_PROJECT_ID','GCP project ID','string',True),
  ('GOOGLE_CHAT_SUBSCRIPTION_NAME','Pub/Sub subscription (projects/…/subscriptions/…)','string',True),
  ('GOOGLE_CHAT_SERVICE_ACCOUNT_JSON','Service account JSON (single-line inline JSON)','secret',True)]},
 'email':{'native':'email','prefix':'EMAIL','fields':[
  ('EMAIL_ADDRESS','Dedicated mailbox address','string',True),('EMAIL_PASSWORD','Mailbox app password','secret',True),
  ('EMAIL_IMAP_HOST','IMAP hostname','string',True),('EMAIL_IMAP_PORT','IMAP TLS port','integer',True),
  ('EMAIL_SMTP_HOST','SMTP hostname','string',True),('EMAIL_SMTP_PORT','SMTP TLS port','integer',True),
  ('EMAIL_AUTHSERV_ID','Trusted authentication-results server ID','string',True)]},
 'mattermost':{'native':'mattermost','prefix':'MATTERMOST','fields':[
  ('MATTERMOST_URL','Mattermost HTTPS server URL','string',True),('MATTERMOST_TOKEN','Bot token','secret',True),
  ('MATTERMOST_ALLOWED_CHANNELS','Allowed channel IDs','string',False)]},
 'matrix':{'native':'matrix','prefix':'MATRIX','fields':[
  ('MATRIX_HOMESERVER','Matrix HTTPS homeserver URL','string',True),('MATRIX_USER_ID','Bot user ID (@bot:server)','string',True),
  ('MATRIX_ACCESS_TOKEN','Bot access token','secret',True),('MATRIX_ALLOWED_ROOMS','Allowed room IDs','string',False)]},
 'dingtalk':{'native':'dingtalk','prefix':'DINGTALK','fields':[
  ('DINGTALK_CLIENT_ID','Application client ID','string',True),('DINGTALK_CLIENT_SECRET','Application client secret','secret',True),
  ('DINGTALK_ALLOWED_CHATS','Allowed chat IDs','string',False)]},
 'feishu':{'native':'feishu','prefix':'FEISHU','fields':[
  ('FEISHU_APP_ID','Application ID','string',True),('FEISHU_APP_SECRET','Application secret','secret',True),
  ('FEISHU_DOMAIN','Service domain: feishu or lark','string',True)]},
 'wecom':{'native':'wecom','prefix':'WECOM','fields':[
  ('WECOM_BOT_ID','Smart Robot bot ID','string',True),('WECOM_SECRET','Smart Robot secret','secret',True)]},
 'wecom-callback':{'native':'wecom_callback','prefix':'WECOM_CALLBACK','fields':[
  ('WECOM_CALLBACK_CORP_ID','Corporation ID','string',True),('WECOM_CALLBACK_CORP_SECRET','Application secret','secret',True),
  ('WECOM_CALLBACK_AGENT_ID','Application agent ID','string',True),('WECOM_CALLBACK_TOKEN','Callback verification token','secret',True),
  ('WECOM_CALLBACK_ENCODING_AES_KEY','Callback encoding AES key','secret',True),
  ('WECOM_CALLBACK_PORT','Loopback callback port','integer',True),
  ('NETCLAW_WECOM_CALLBACK_PUBLIC_URL','Prepared HTTPS URL ending /wecom/callback','string',True)]},
 'signal':{'native':'signal','prefix':'SIGNAL','fields':[
  ('SIGNAL_HTTP_URL','Prepared signal-cli HTTP loopback URL','string',True),('SIGNAL_ACCOUNT','Registered Signal number (+E.164)','string',True)]},
 'weixin':{'native':'weixin','prefix':'WEIXIN','fields':[
  ('WEIXIN_ACCOUNT_ID','iLink account ID','string',True),('WEIXIN_TOKEN','Existing iLink account token','secret',True)]},
 'bluebubbles':{'native':'bluebubbles','prefix':'BLUEBUBBLES','fields':[
  ('BLUEBUBBLES_SERVER_URL','Prepared BlueBubbles server URL','string',True),('BLUEBUBBLES_PASSWORD','BlueBubbles password','secret',True),
  ('BLUEBUBBLES_WEBHOOK_PORT','Loopback webhook port','integer',True)]},
 'qqbot':{'native':'qqbot','prefix':'QQ','fields':[
  ('QQ_APP_ID','QQ bot application ID','string',True),('QQ_CLIENT_SECRET','QQ bot client secret','secret',True)]},
 'yuanbao':{'native':'yuanbao','prefix':'YUANBAO','fields':[
  ('YUANBAO_APP_ID','Yuanbao application ID','string',True),('YUANBAO_APP_SECRET','Yuanbao application secret','secret',True)]},
 'line':{'native':'line','prefix':'LINE','fields':[
  ('LINE_CHANNEL_ACCESS_TOKEN','Channel access token','secret',True),('LINE_CHANNEL_SECRET','Channel secret','secret',True),
  ('LINE_PORT','Loopback webhook port','integer',True),('LINE_PUBLIC_URL','Prepared HTTPS base URL (webhook is /line/webhook)','string',True)]},
 'ntfy':{'native':'ntfy','prefix':'NTFY','fields':[
  ('NTFY_SERVER_URL','ntfy HTTPS server URL','string',True),('NTFY_TOPIC','Dedicated input topic','string',True),
  ('NTFY_PUBLISH_TOPIC','Separate output topic','string',True),('NTFY_TOKEN','Dedicated topic access token','secret',True)]},
 'simplex':{'native':'simplex','prefix':'SIMPLEX','fields':[
  ('SIMPLEX_WS_URL','Prepared SimpleX loopback WebSocket URL','string',True)]},
 'irc':{'native':'irc','prefix':'IRC','fields':[
  ('IRC_SERVER','IRC TLS server hostname','string',True),('IRC_PORT','IRC TLS port','integer',True),
  ('IRC_NICKNAME','Bot nickname','string',True),('IRC_CHANNEL','Explicit channels (#name, comma-separated)','string',True),
  ('IRC_SERVER_PASSWORD','Server password','secret',False),('IRC_NICKSERV_PASSWORD','NickServ password','secret',False)]},
 'photon':{'native':'photon','prefix':'PHOTON','fields':[
  ('PHOTON_PROJECT_ID','Photon project ID','string',True),('PHOTON_PROJECT_SECRET','Photon project secret','secret',True),
  ('PHOTON_SIDECAR_PORT','Owned loopback sidecar port','integer',True),
  ('PHOTON_SIDECAR_TOKEN','Dedicated local sidecar token (32 or more characters)','secret',True)]},
 'whatsapp':{'native':'whatsapp','prefix':'WHATSAPP','fields':[
  ('NETCLAW_WHATSAPP_BRIDGE_PORT','Owned loopback bridge port','integer',True)]},
 'homeassistant':{'native':'homeassistant','prefix':'HASS','fields':[
  ('HASS_URL','Home Assistant HTTPS URL','string',True),('HASS_TOKEN','Dedicated long-lived access token','secret',True),
  ('NETCLAW_HASS_ENTITIES','Explicit watched entity IDs (comma-separated; blank disables inbound events)','string',False)]},
 'raft':{'native':'raft','prefix':'RAFT','fields':[
  ('RAFT_PROFILE','Dedicated External Agent profile slug','string',True),
  ('NETCLAW_RAFT_CREDENTIAL_JSON','Prepared single External Agent credential.json (single-line JSON)','secret',True)]},
 'buzz':{'native':'buzz','prefix':'BUZZ','fields':[
  ('BUZZ_RELAY_URL','Buzz community HTTPS relay URL','string',True),('BUZZ_PRIVATE_KEY','Dedicated Nostr private key (64-character hex)','secret',True),
  ('BUZZ_CHANNELS','Explicit channel UUIDs (comma-separated)','string',True),
  ('NETCLAW_BUZZ_BINARY','Prepared buzz CLI binary absolute path','string',True),
  ('NETCLAW_BUZZ_BINARY_SHA256','Prepared binary SHA-256 (review before importing)','string',True)]},
}

PORT_FIELDS={'wecom-callback':'WECOM_CALLBACK_PORT','bluebubbles':'BLUEBUBBLES_WEBHOOK_PORT','line':'LINE_PORT',
             'photon':'PHOTON_SIDECAR_PORT','whatsapp':'NETCLAW_WHATSAPP_BRIDGE_PORT'}
SDK_CHANNELS=frozenset(('google-chat','matrix','dingtalk','feishu','wecom-callback'))

def settings(channel):
    contract=CONTRACTS[channel]
    fields=list(contract['fields'])
    if channel!='homeassistant':fields.append((contract['prefix']+'_ALLOWED_USERS','Allowed sender IDs (blank denies all)','string',False))
    url='https://hermes-agent.nousresearch.com/docs/user-guide/messaging/'+channel
    return [{'key':key,'label':label,'help':('Secure native entry; never saved to the plan.' if kind=='secret' else
        'Selected account only. Empty access lists deny everyone; configuration does not authenticate the account.'),
        'classification':'secret' if kind=='secret' else 'public' if kind=='integer' else 'private',
        'valueType':'integer' if kind=='integer' else 'string','required':'always' if required else 'optional',
        'condition':None,'example':'','sharedWith':[],'input':'user','provenance':[{'source':url,'checkedAt':'2026-10-25',
        'note':'Fields audited against Hermes '+PIN+'; no operational invocation.'}]} for key,label,kind,required in fields]

def _url(value,*,loopback=False,websocket=False,allow_local=False):
    try:
        parsed=urlsplit(value);host=parsed.hostname or '';port=parsed.port
        local=ipaddress.ip_address(host).is_loopback if host else False
    except ValueError:
        try:parsed=urlsplit(value);host=parsed.hostname or '';port=parsed.port;local=False
        except (ValueError,TypeError):raise Invalid('comms_url_invalid') from None
    allowed=('ws',) if loopback and websocket else ('http',) if loopback else ('https',)
    if allow_local and local:allowed=('http','https')
    if (not host or parsed.scheme not in allowed or parsed.username or parsed.password or parsed.query or parsed.fragment or
        loopback and not local or port is not None and not 1<=port<=65535):raise Invalid('comms_url_invalid')
    return parsed

def _host(value):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,252}',value) or '..' in value:raise Invalid('comms_hostname_invalid')

def prepare(channel,config,values,*,home=None):
    from setup_comms import access_list,require_https_callback
    if channel not in CONTRACTS:raise Invalid('comms_adapter_unavailable')
    contract=CONTRACTS[channel];prefix=contract['prefix'];native=contract['native']
    for field in settings(channel):
        value=values.get(field['key'],'')
        if not isinstance(value,str) or len(value)>16384 or any(c in value for c in '\r\n\0') or field['required']=='always' and not value.strip():
            raise Invalid('comms_credentials_required')
        if field['valueType']=='integer' and (not value.isdecimal() or not 1<=int(value)<=65535):raise Invalid('comms_port_required')
    if channel in PORT_FIELDS and int(values[PORT_FIELDS[channel]])<1024:raise Invalid('comms_callback_port_required')
    users=access_list(values.get(prefix+'_ALLOWED_USERS',''))
    updates={'GATEWAY_ALLOW_ALL_USERS':'false','GATEWAY_ALLOWED_USERS':'',prefix+'_ALLOW_ALL_USERS':'false',
             prefix+'_ALLOWED_USERS':','.join(users)}
    extra={'allow_from':users,'allow_all_users':False,'require_mention':True}
    if channel=='google-chat':
        project=values['GOOGLE_CHAT_PROJECT_ID'];subscription=values['GOOGLE_CHAT_SUBSCRIPTION_NAME']
        if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]',project) or not re.fullmatch(r'projects/'+re.escape(project)+r'/subscriptions/[A-Za-z][A-Za-z0-9._~+%-]{2,254}',subscription):
            raise Invalid('comms_google_subscription_invalid')
        try:account=json.loads(values['GOOGLE_CHAT_SERVICE_ACCOUNT_JSON'])
        except (ValueError,TypeError):raise Invalid('comms_google_service_account_invalid') from None
        if (not isinstance(account,dict) or account.get('type')!='service_account' or account.get('project_id')!=project or
            not all(isinstance(account.get(k),str) and account[k] for k in ('client_email','private_key','private_key_id')) or
            not account['client_email'].endswith('.iam.gserviceaccount.com') or account.get('token_uri')!='https://oauth2.googleapis.com/token'):
            raise Invalid('comms_google_service_account_invalid')
        extra.update(project_id=project,subscription_name=subscription)
        updates.update(GOOGLE_CHAT_BOOTSTRAP_SPACES='false',GOOGLE_CHAT_DEBUG_RAW='false')
    elif channel=='email':
        if not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+',values['EMAIL_ADDRESS']):raise Invalid('comms_email_invalid')
        for key in ('EMAIL_IMAP_HOST','EMAIL_SMTP_HOST','EMAIL_AUTHSERV_ID'):_host(values[key])
        extra.update(address=values['EMAIL_ADDRESS'],imap_host=values['EMAIL_IMAP_HOST'],smtp_host=values['EMAIL_SMTP_HOST'])
        updates.update(EMAIL_IMAP_SECURITY='ssl',EMAIL_SMTP_SECURITY='ssl',EMAIL_IMAP_TLS_VERIFY='true',
                       EMAIL_SMTP_TLS_VERIFY='true',EMAIL_TRUST_FROM_HEADER='false')
    elif channel in ('mattermost','matrix','ntfy'):
        key={'mattermost':'MATTERMOST_URL','matrix':'MATRIX_HOMESERVER','ntfy':'NTFY_SERVER_URL'}[channel]
        _url(values[key]);extra[{'mattermost':'url','matrix':'homeserver','ntfy':'server'}[channel]]=values[key].rstrip('/')
        if channel=='mattermost':
            rooms=access_list(values.get('MATTERMOST_ALLOWED_CHANNELS',''))
            updates.update(MATTERMOST_ALLOWED_CHANNELS=','.join(rooms),MATTERMOST_FREE_RESPONSE_CHANNELS='',MATTERMOST_REQUIRE_MENTION='true')
        elif channel=='matrix':
            if not re.fullmatch(r'@[^\s:]+:[^\s]+',values['MATRIX_USER_ID']):raise Invalid('comms_matrix_user_invalid')
            rooms=access_list(values.get('MATRIX_ALLOWED_ROOMS',''))
            if any(not re.fullmatch(r'![^\s:]+:[^\s]+',r) for r in rooms):raise Invalid('comms_matrix_room_invalid')
            extra.update(user_id=values['MATRIX_USER_ID'],encryption=False)
            updates.update(MATRIX_ALLOWED_ROOMS=','.join(rooms),MATRIX_REQUIRE_MENTION='true',MATRIX_ALLOW_PUBLIC_ROOMS='false',
                MATRIX_FREE_RESPONSE_ROOMS='',MATRIX_ENCRYPTION='false',MATRIX_ALLOW_ROOM_MENTIONS='false')
        else:
            for key in ('NTFY_TOPIC','NTFY_PUBLISH_TOPIC'):
                if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',values[key]):raise Invalid('comms_ntfy_topic_invalid')
            if values['NTFY_TOPIC']==values['NTFY_PUBLISH_TOPIC']:raise Invalid('comms_ntfy_topic_loop')
            extra.update(topic=values['NTFY_TOPIC'],publish_topic=values['NTFY_PUBLISH_TOPIC'])
    elif channel=='dingtalk':
        chats=access_list(values.get('DINGTALK_ALLOWED_CHATS',''));extra['client_id']=values['DINGTALK_CLIENT_ID']
        updates.update(DINGTALK_REQUIRE_MENTION='true',DINGTALK_ALLOWED_CHATS=','.join(chats),DINGTALK_FREE_RESPONSE_CHATS='')
    elif channel=='feishu':
        if values['FEISHU_DOMAIN'] not in ('feishu','lark'):raise Invalid('comms_feishu_domain_invalid')
        extra.update(app_id=values['FEISHU_APP_ID'],domain=values['FEISHU_DOMAIN'],connection_mode='websocket')
        updates.update(FEISHU_CONNECTION_MODE='websocket',FEISHU_GROUP_POLICY='disabled',FEISHU_REQUIRE_MENTION='true',FEISHU_ALLOW_BOTS='false')
    elif channel=='wecom':
        extra.update(bot_id=values['WECOM_BOT_ID'],dm_policy='allowlist',group_policy='disabled')
        updates.update(WECOM_DM_POLICY='allowlist',WECOM_GROUP_POLICY='disabled')
    elif channel=='wecom-callback':
        if not re.fullmatch(r'[0-9]+',values['WECOM_CALLBACK_AGENT_ID']) or not re.fullmatch(r'[A-Za-z0-9+/]{43}',values['WECOM_CALLBACK_ENCODING_AES_KEY']):
            raise Invalid('comms_wecom_callback_invalid')
        require_https_callback(values['NETCLAW_WECOM_CALLBACK_PUBLIC_URL'],'/wecom/callback')
        extra.update(corp_id=values['WECOM_CALLBACK_CORP_ID'],agent_id=values['WECOM_CALLBACK_AGENT_ID'],host='127.0.0.1',port=int(values['WECOM_CALLBACK_PORT']),path='/wecom/callback')
        updates['WECOM_CALLBACK_HOST']='127.0.0.1'
    elif channel=='signal':
        _url(values['SIGNAL_HTTP_URL'],loopback=True)
        if not re.fullmatch(r'\+[1-9][0-9]{5,14}',values['SIGNAL_ACCOUNT']):raise Invalid('comms_phone_required')
        extra.update(http_url=values['SIGNAL_HTTP_URL'],account=values['SIGNAL_ACCOUNT'],ignore_stories=True)
        updates.update(SIGNAL_GROUP_ALLOWED_USERS='',SIGNAL_REQUIRE_MENTION='true',SIGNAL_REACTIONS='false',SIGNAL_IGNORE_STORIES='true')
    elif channel=='weixin':
        extra.update(account_id=values['WEIXIN_ACCOUNT_ID'],dm_policy='allowlist',group_policy='disabled',group_allow_from=[])
        updates.update(WEIXIN_DM_POLICY='allowlist',WEIXIN_GROUP_POLICY='disabled',WEIXIN_GROUP_ALLOWED_USERS='')
    elif channel=='bluebubbles':
        _url(values['BLUEBUBBLES_SERVER_URL'],allow_local=True)
        extra.update(server_url=values['BLUEBUBBLES_SERVER_URL'],webhook_host='127.0.0.1',webhook_port=int(values['BLUEBUBBLES_WEBHOOK_PORT']),
                     webhook_path='/bluebubbles-webhook',send_read_receipts=False)
        updates.update(BLUEBUBBLES_WEBHOOK_HOST='127.0.0.1',BLUEBUBBLES_WEBHOOK_PATH='/bluebubbles-webhook',BLUEBUBBLES_SEND_READ_RECEIPTS='false',BLUEBUBBLES_REQUIRE_MENTION='true')
    elif channel=='qqbot':
        extra.update(app_id=values['QQ_APP_ID'],group_allow_from=[])
        updates.update(QQ_GROUP_ALLOWED_USERS='')
    elif channel=='yuanbao':
        extra.update(app_id=values['YUANBAO_APP_ID'],dm_policy='allowlist',dm_allow_from=','.join(users),group_policy='disabled',group_allow_from='')
        updates.update(YUANBAO_DM_POLICY='allowlist',YUANBAO_DM_ALLOW_FROM=','.join(users),YUANBAO_GROUP_POLICY='disabled',YUANBAO_GROUP_ALLOW_FROM='')
    elif channel=='line':
        endpoint=_url(values['LINE_PUBLIC_URL'])
        if endpoint.path not in ('','/'):raise Invalid('comms_line_public_base_invalid')
        extra.update(host='127.0.0.1',port=int(values['LINE_PORT']),public_url=values['LINE_PUBLIC_URL'].rstrip('/'))
        updates.update(LINE_HOST='127.0.0.1',LINE_ALLOWED_GROUPS='',LINE_ALLOWED_ROOMS='')
    elif channel=='simplex':
        _url(values['SIMPLEX_WS_URL'],loopback=True,websocket=True)
        extra.update(ws_url=values['SIMPLEX_WS_URL'],auto_accept=False,group_allowed='')
        updates.update(SIMPLEX_AUTO_ACCEPT='false',SIMPLEX_GROUP_ALLOWED='')
    elif channel=='irc':
        _host(values['IRC_SERVER'])
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_\[\]{}|^`-]{0,29}',values['IRC_NICKNAME']):raise Invalid('comms_irc_nickname_invalid')
        channels=access_list(values['IRC_CHANNEL'])
        if not channels or any(not re.fullmatch(r'#[^\s,:]{1,100}',c) for c in channels):raise Invalid('comms_irc_channel_invalid')
        extra.update(server=values['IRC_SERVER'],channel=','.join(channels),nickname=values['IRC_NICKNAME'],port=int(values['IRC_PORT']),use_tls=True)
        updates['IRC_USE_TLS']='true'
    elif channel=='homeassistant':
        if users:raise Invalid('comms_homeassistant_uses_entity_scope')
        _url(values['HASS_URL'],allow_local=True)
        entities=access_list(values.get('NETCLAW_HASS_ENTITIES',''))
        if any(not re.fullmatch(r'[a-z_][a-z0-9_]*\.[a-z0-9_]+',entity) for entity in entities):raise Invalid('comms_homeassistant_entity_invalid')
        extra.update(url=values['HASS_URL'].rstrip('/'),watch_entities=entities,watch_domains=[],watch_all=False,ignore_entities=[],cooldown=30)
        updates['PYTHONDONTWRITEBYTECODE']='1'
    elif channel in ('photon','whatsapp','raft','buzz'):
        from pathlib import Path
        if not home or not Path(home).is_absolute() or '..' in Path(home).parts:raise Invalid('comms_native_home_required')
        home=Path(home)
        if channel=='photon':
            if len(values['PHOTON_SIDECAR_TOKEN'])<32:raise Invalid('comms_sidecar_token_required')
            extra.update(project_id=values['PHOTON_PROJECT_ID'],sidecar_port=int(values['PHOTON_SIDECAR_PORT']),require_mention=True)
            updates.update(PHOTON_SIDECAR_DIR=str(home/'.setup/comms/native/photon'),PHOTON_SIDECAR_BIND='127.0.0.1',
                PHOTON_SIDECAR_AUTOSTART='true',PHOTON_SIDECAR_WATCH_STDIN='1',PHOTON_REQUIRE_MENTION='true')
        elif channel=='whatsapp':
            extra.update(bridge_port=int(values['NETCLAW_WHATSAPP_BRIDGE_PORT']),bridge_script=str(home/'.setup/comms/native/whatsapp/bridge.js'),
                session_path=str(home/'platforms/whatsapp/session'),dm_policy='allowlist',group_policy='disabled',group_allow_from=[],send_read_receipts=False)
            updates.update(WHATSAPP_ENABLED='true',WHATSAPP_MODE='bot',WHATSAPP_DM_POLICY='allowlist',WHATSAPP_GROUP_POLICY='disabled',
                WHATSAPP_GROUP_ALLOW_FROM='',WHATSAPP_GROUP_ALLOWED_USERS='',WHATSAPP_FREE_RESPONSE_CHATS='',
                WHATSAPP_REQUIRE_MENTION='true',WHATSAPP_SEND_READ_RECEIPTS='false',WHATSAPP_FORWARD_OWNER_MESSAGES='false')
        elif channel=='raft':
            raft_credential(values)
            extra.update(host='127.0.0.1',port=0,path='/wake',enabled=True)
            updates.update(RAFT_HOME=str(home/'.setup/comms/raft/profile-home'),HERMES_REAL_HOME=str(home/'.setup/os-home'))
        else:
            import uuid
            _url(values['BUZZ_RELAY_URL'])
            if not re.fullmatch(r'[0-9a-f]{64}',values['BUZZ_PRIVATE_KEY']) or int(values['BUZZ_PRIVATE_KEY'],16)==0:
                raise Invalid('comms_buzz_key_invalid')
            channels=access_list(values['BUZZ_CHANNELS'])
            try:
                if not channels or any(str(uuid.UUID(c))!=c for c in channels):raise ValueError()
            except ValueError:raise Invalid('comms_buzz_channels_invalid') from None
            if any(not re.fullmatch(r'[0-9a-f]{64}',u) for u in users):raise Invalid('comms_buzz_users_invalid')
            binary=Path(values['NETCLAW_BUZZ_BINARY'])
            if not binary.is_absolute() or '..' in binary.parts or not re.fullmatch(r'[0-9a-f]{64}',values['NETCLAW_BUZZ_BINARY_SHA256']):
                raise Invalid('comms_buzz_binary_invalid')
            owned=str(home/'.setup/comms/native/buzz/buzz')
            extra.update(relay_url=values['BUZZ_RELAY_URL'].rstrip('/'),channels=channels,cli_path=owned,credentials_file='',
                allowed_users=users,attachment_hosts=[],transport='websocket',reaction_only_users=[])
            updates.update(BUZZ_CLI_PATH=owned,BUZZ_CREDENTIALS_FILE='',BUZZ_AUTH_TAG='',BUZZ_CHANNELS=','.join(channels),
                BUZZ_HOME_CHANNEL='',BUZZ_REQUIRE_MENTION='true',BUZZ_TRANSPORT='websocket',BUZZ_REACTION_ONLY_USERS='')
    result=copy.deepcopy(config)
    if channel=='homeassistant':
        plugins=result.setdefault('plugins',{})
        if 'homeassistant' in plugins.get('disabled',[]) or 'platforms/homeassistant' in plugins.get('disabled',[]):
            raise Invalid('comms_plugin_explicitly_disabled')
        plugins.setdefault('enabled',[])
        if 'homeassistant' not in plugins['enabled']:plugins['enabled'].append('homeassistant')
    result.setdefault('platforms',{})[native]={'enabled':True,'gateway_restart_notification':False,'extra':extra}
    return result,updates

def raft_credential(values):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}',values['RAFT_PROFILE']):raise Invalid('comms_raft_profile_invalid')
    try:credential=json.loads(values['NETCLAW_RAFT_CREDENTIAL_JSON'])
    except (ValueError,TypeError):raise Invalid('comms_raft_credential_invalid') from None
    allowed={'schemaVersion','serverUrl','agentId','apiKey','serverId','createdAt','agentName','credentialId','scopes'}
    if (not isinstance(credential,dict) or set(credential)-allowed or credential.get('schemaVersion')!=1 or
        any(not isinstance(credential.get(k),str) or not credential[k] or len(credential[k])>8192 for k in ('serverUrl','agentId','apiKey','serverId'))):
        raise Invalid('comms_raft_credential_invalid')
    _url(credential['serverUrl'])
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',credential['agentId']):raise Invalid('comms_raft_credential_invalid')
    return credential

# Native validation needs these fields in memory; they are NEVER written back.
HYDRATION={
 'mattermost':{'token':'MATTERMOST_TOKEN'},'matrix':{'token':'MATRIX_ACCESS_TOKEN'},'weixin':{'token':'WEIXIN_TOKEN'},
 'dingtalk':{'extra.client_secret':'DINGTALK_CLIENT_SECRET'},'feishu':{'extra.app_secret':'FEISHU_APP_SECRET'},
 'wecom':{'extra.secret':'WECOM_SECRET'},'wecom-callback':{'extra.corp_secret':'WECOM_CALLBACK_CORP_SECRET',
 'extra.token':'WECOM_CALLBACK_TOKEN','extra.encoding_aes_key':'WECOM_CALLBACK_ENCODING_AES_KEY'},
 'bluebubbles':{'extra.password':'BLUEBUBBLES_PASSWORD'},'qqbot':{'extra.client_secret':'QQ_CLIENT_SECRET'},
 'yuanbao':{'extra.app_secret':'YUANBAO_APP_SECRET'},'ntfy':{'extra.token':'NTFY_TOKEN'},
 'photon':{'extra.project_secret':'PHOTON_PROJECT_SECRET'},
 'homeassistant':{'token':'HASS_TOKEN'},
}

def hydrate(channel,selected,values,*,home=None):
    """Private in-memory validation view; enforce our complete restricted form."""
    native=CONTRACTS[channel]['native']
    expected,updates=prepare(channel,{},values,home=home)
    if selected!=expected['platforms'][native] or any(values.get(k)!=v for k,v in updates.items()):return None
    result=copy.deepcopy(selected)
    for key,env in HYDRATION.get(channel,{}).items():
        if key.startswith('extra.'):result['extra'][key[6:]]=values[env]
        else:result[key]=values[env]
    return result

def fixtures():
    """Non-network contract inputs, also used by source-pinned runtime checks."""
    values={}
    for channel,contract in CONTRACTS.items():
        values[channel]={key:'private-test-secret' if kind=='secret' else '21990' if kind=='integer' else 'fixture-id'
            for key,_,kind,required in contract['fields'] if required}
    values['google-chat'].update(GOOGLE_CHAT_PROJECT_ID='fixture-project',GOOGLE_CHAT_SUBSCRIPTION_NAME='projects/fixture-project/subscriptions/fixture-sub',
        GOOGLE_CHAT_SERVICE_ACCOUNT_JSON=json.dumps({'type':'service_account','project_id':'fixture-project',
        'client_email':'fixture@fixture-project.iam.gserviceaccount.com','private_key':'private-test-secret','private_key_id':'fixture-key',
        'token_uri':'https://oauth2.googleapis.com/token'},separators=(',',':')))
    values['email'].update(EMAIL_ADDRESS='bot@example.invalid',EMAIL_IMAP_HOST='imap.example.invalid',EMAIL_SMTP_HOST='smtp.example.invalid',EMAIL_AUTHSERV_ID='mx.example.invalid')
    values['mattermost']['MATTERMOST_URL']='https://mattermost.example.invalid'
    values['matrix'].update(MATRIX_HOMESERVER='https://matrix.example.invalid',MATRIX_USER_ID='@bot:matrix.example.invalid')
    values['feishu']['FEISHU_DOMAIN']='feishu'
    values['wecom-callback'].update(WECOM_CALLBACK_AGENT_ID='1000001',WECOM_CALLBACK_ENCODING_AES_KEY='a'*43,NETCLAW_WECOM_CALLBACK_PUBLIC_URL='https://callback.example.invalid/wecom/callback')
    values['signal'].update(SIGNAL_ACCOUNT='+15551234567',SIGNAL_HTTP_URL='http://127.0.0.1:21991')
    values['bluebubbles']['BLUEBUBBLES_SERVER_URL']='http://127.0.0.1:21992'
    values['line']['LINE_PUBLIC_URL']='https://line.example.invalid'
    values['ntfy'].update(NTFY_SERVER_URL='https://ntfy.example.invalid',NTFY_TOPIC='fixture-in',NTFY_PUBLISH_TOPIC='fixture-out')
    values['simplex']['SIMPLEX_WS_URL']='ws://127.0.0.1:21993'
    values['irc'].update(IRC_SERVER='irc.example.invalid',IRC_NICKNAME='fixture_bot',IRC_CHANNEL='#fixture')
    values['photon']['PHOTON_SIDECAR_TOKEN']='private-test-secret'+'a'*32
    values['homeassistant']['HASS_URL']='https://homeassistant.example.invalid'
    values['raft'].update(RAFT_PROFILE='fixture',NETCLAW_RAFT_CREDENTIAL_JSON=json.dumps({'schemaVersion':1,'serverUrl':'https://raft.example.invalid',
        'agentId':'fixture-agent','serverId':'fixture-server','apiKey':'private-test-secret'}))
    values['buzz'].update(BUZZ_RELAY_URL='https://buzz.example.invalid',BUZZ_PRIVATE_KEY='1'*64,
        BUZZ_CHANNELS='11111111-1111-4111-8111-111111111111',NETCLAW_BUZZ_BINARY='/fixture/buzz',NETCLAW_BUZZ_BINARY_SHA256='a'*64)
    return values
