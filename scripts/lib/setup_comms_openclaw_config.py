"""Source-bound typed channel forms. No runtime import, provider call or file write.

The selected account uses private environment references. Group ingress is
disabled where the native channel supports that distinction. ClickClack and
Twitch restrict senders in the explicitly selected shared workspace/channel.
Shared plugin policy and every other account remain untouched.
"""
import copy
import ipaddress
import json
import re
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from setup_schema import Invalid

# config key, private environment key, validation kind. All are required unless
# the form explicitly appends the optional sender allowlist below.
CONTRACTS={
 'clickclack':[('baseUrl','CLICKCLACK_BASE_URL','https'),('token','CLICKCLACK_TOKEN','secret'),('workspace','CLICKCLACK_WORKSPACE','id')],
 'feishu':[('appId','FEISHU_APP_ID','id'),('appSecret','FEISHU_APP_SECRET','secret')],
 'googlechat':[('serviceAccount','GOOGLE_CHAT_SERVICE_ACCOUNT_JSON','service-account'),('audience','GOOGLE_CHAT_PUBLIC_URL','callback')],
 'irc':[('host','IRC_HOST','host'),('port','IRC_PORT','port'),('nick','IRC_NICK','id'),('password','IRC_PASSWORD','secret')],
 'imessage':[('cliPath','IMESSAGE_CLI_PATH','absolute-path'),('dbPath','IMESSAGE_DB_PATH','absolute-path'),('_sha','IMESSAGE_CLI_SHA256','sha256')],
 'line':[('channelAccessToken','LINE_CHANNEL_ACCESS_TOKEN','secret'),('channelSecret','LINE_CHANNEL_SECRET','secret'),('_public','NETCLAW_LINE_PUBLIC_URL','callback')],
 'matrix':[('homeserver','MATRIX_HOMESERVER','https'),('userId','MATRIX_USER_ID','id'),('accessToken','MATRIX_ACCESS_TOKEN','secret')],
 'mattermost':[('baseUrl','MATTERMOST_URL','https'),('botToken','MATTERMOST_BOT_TOKEN','secret')],
 'msteams':[('appId','MSTEAMS_APP_ID','guid'),('tenantId','MSTEAMS_TENANT_ID','guid'),('appPassword','MSTEAMS_APP_PASSWORD','secret'),('_port','MSTEAMS_WEBHOOK_PORT','port'),('_public','NETCLAW_MSTEAMS_PUBLIC_URL','callback')],
 'nextcloud-talk':[('baseUrl','NEXTCLOUD_TALK_URL','https'),('botSecret','NEXTCLOUD_TALK_BOT_SECRET','secret'),('apiUser','NEXTCLOUD_TALK_API_USER','id'),('apiPassword','NEXTCLOUD_TALK_API_PASSWORD','secret'),('webhookPort','NEXTCLOUD_TALK_WEBHOOK_PORT','port'),('webhookPublicUrl','NEXTCLOUD_TALK_PUBLIC_URL','callback')],
 'nostr':[('privateKey','NOSTR_PRIVATE_KEY','secret'),('relays','NOSTR_RELAYS','relays')],
 'qqbot':[('appId','QQBOT_APP_ID','digits'),('clientSecret','QQBOT_CLIENT_SECRET','secret')],
 'raft':[('profile','RAFT_PROFILE','profile'),('_credential','NETCLAW_RAFT_CREDENTIAL_JSON','raft-credential')],
 'signal':[('account','SIGNAL_PHONE_NUMBER','phone'),('httpUrl','SIGNAL_HTTP_URL','loopback-url')],
 'sms':[('accountSid','TWILIO_ACCOUNT_SID','account'),('authToken','TWILIO_AUTH_TOKEN','secret'),('fromNumber','TWILIO_PHONE_NUMBER','phone'),('publicWebhookUrl','SMS_PUBLIC_WEBHOOK_URL','callback')],
 'synology-chat':[('token','SYNOLOGY_CHAT_TOKEN','secret'),('incomingUrl','SYNOLOGY_CHAT_INCOMING_URL','secret-url'),('nasHost','SYNOLOGY_CHAT_NAS_HOST','https'),('_public','NETCLAW_SYNOLOGY_CHAT_PUBLIC_URL','callback')],
 'tlon':[('ship','TLON_SHIP','ship'),('url','TLON_URL','https'),('code','TLON_CODE','secret')],
 'twitch':[('username','TWITCH_USERNAME','id'),('channel','TWITCH_CHANNEL','id'),('clientId','TWITCH_CLIENT_ID','id'),('accessToken','TWITCH_ACCESS_TOKEN','secret')],
 'zalo':[('botToken','ZALO_BOT_TOKEN','secret')],
 'wecom':[('botId','WECOM_BOT_ID','id'),('secret','WECOM_SECRET','secret')],
}
PLUGIN_IDS={'wecom':'wecom-openclaw-plugin'}
CALLBACK_PATHS={'googlechat':'/googlechat','line':'/line/webhook','msteams':'/api/messages',
 'nextcloud-talk':'/nextcloud-talk-webhook','sms':'/sms/webhook','synology-chat':'/webhook/synology'}
STARTUP_EFFECTS={c:['provider-connection','inbound-agent-dispatch','pinned-dependency-install'] for c in CONTRACTS}
for _channel in CALLBACK_PATHS:STARTUP_EFFECTS[_channel].append('public-callback-prerequisite')
STARTUP_EFFECTS['msteams'].append('public-listener')
STARTUP_EFFECTS['nextcloud-talk'].append('loopback-listener')
STARTUP_EFFECTS['signal']=['prepared-signal-daemon-prerequisite','provider-connection','inbound-agent-dispatch','pinned-dependency-install']
STARTUP_EFFECTS['imessage']=['macos-messages-account-prerequisite','full-disk-access-prerequisite','external-cli-spawn','inbound-agent-dispatch']
STARTUP_EFFECTS['raft']=['owned-cli-profile-prerequisite','external-cli-spawn','loopback-listener','inbound-agent-dispatch','pinned-dependency-install']
STARTUP_EFFECTS['wecom']+=['plugin-tool-registration','gateway-webhook-registration']
STARTUP_EFFECTS['clickclack'].append('selected-workspace-message-ingress')
STARTUP_EFFECTS['twitch'].append('selected-channel-message-ingress')


def _list(value):
    from setup_comms import access_list
    return access_list(value)


def _url(value,*,schemes=('https',),callback=False):
    try:
        u=urlsplit(value)
        if u.scheme not in schemes or not u.hostname or u.username or u.password or u.fragment:raise ValueError()
        if u.port is not None and not 1<=u.port<=65535:raise ValueError()
        if callback:
            if u.query or u.hostname=='localhost' or u.hostname.endswith('.localhost'):raise ValueError()
            try:
                if not ipaddress.ip_address(u.hostname).is_global:raise Invalid('comms_public_callback_required')
            except ValueError:pass
        return u
    except (ValueError,TypeError):raise Invalid('comms_endpoint_invalid') from None


def _value(channel,key,kind,value):
    if not isinstance(value,str) or not value.strip() or len(value.encode())>16384 or any(c in value for c in '\r\n\0'):
        raise Invalid('comms_credentials_required')
    if kind in ('secret','secret-url','service-account','raft-credential'):
        if kind=='secret-url':_url(value)
        if kind=='service-account':
            try:account=json.loads(value)
            except ValueError:raise Invalid('comms_google_service_account_required') from None
            if (not isinstance(account,dict) or account.get('type')!='service_account' or
                not all(isinstance(account.get(k),str) and account[k] for k in ('project_id','client_email','private_key'))):
                raise Invalid('comms_google_service_account_required')
        return '${'+key+'}'
    if kind in ('https','callback'):
        url=_url(value,callback=kind=='callback')
        if kind=='callback' and url.path!=CALLBACK_PATHS[channel]:raise Invalid('comms_callback_path_mismatch')
    elif kind=='loopback-url':
        url=_url(value,schemes=('http',))
        if url.hostname not in ('127.0.0.1','::1') or not url.port or url.path not in ('','/') or url.query:
            raise Invalid('comms_loopback_daemon_required')
    elif kind=='absolute-path':
        path=PurePosixPath(value)
        if not path.is_absolute() or '..' in path.parts or path.as_posix()!=value or re.search(r'[\s*?\\]',value):
            raise Invalid('comms_absolute_path_required')
    elif kind=='profile' and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,63}',value):raise Invalid('comms_profile_required')
    elif kind=='sha256' and not re.fullmatch(r'[a-f0-9]{64}',value):raise Invalid('comms_binary_digest_required')
    elif kind=='relays':
        relays=[v.strip() for v in value.split(',')]
        if not relays or len(relays)>16 or any(not v or re.search(r'\s',v) for v in relays):raise Invalid('comms_relays_required')
        for relay in relays:_url(relay,schemes=('wss',))
        return relays
    elif kind=='port':
        if not value.isdecimal() or not 1024<=int(value)<=65535:raise Invalid('comms_callback_port_required')
        return int(value)
    elif kind=='guid' and not re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}',value):raise Invalid('comms_teams_object_id_required')
    elif kind=='account' and not re.fullmatch(r'AC[a-fA-F0-9]{32}',value):raise Invalid('comms_twilio_account_required')
    elif kind=='phone' and not re.fullmatch(r'\+[1-9][0-9]{5,14}',value):raise Invalid('comms_phone_allowlist_required')
    elif kind=='digits' and not value.isdecimal():raise Invalid('comms_numeric_id_required')
    elif kind=='ship' and not re.fullmatch(r'~[a-z]+(?:-[a-z]+)*',value):raise Invalid('comms_ship_id_required')
    elif kind=='host' and (not re.fullmatch(r'[A-Za-z0-9.-]+',value) or value.startswith('-')):raise Invalid('comms_host_required')
    elif kind=='id' and (re.search(r'[\s*?\\]',value) or len(value)>256):raise Invalid('comms_identifier_required')
    return value


def prepare_config(channel,config,values):
    if channel not in CONTRACTS:raise Invalid('comms_adapter_unavailable')
    result=copy.deepcopy(config);plugins=result.setdefault('plugins',{});plugin=PLUGIN_IDS.get(channel,channel)
    if (plugins.get('enabled') is False or plugin in plugins.get('deny',[]) or
        plugins.get('allow') and plugin not in plugins['allow']):raise Invalid('comms_plugin_policy_blocks_selection')
    plugins.setdefault('entries',{}).setdefault(plugin,{})['enabled']=True
    inputs={field:_value(channel,key,kind,values.get(key)) for field,key,kind in CONTRACTS[channel]}
    users=_list(values.get(channel.upper().replace('-','_')+'_ALLOWED_USERS',''))
    if channel in ('sms','signal') and any(not re.fullmatch(r'\+[1-9][0-9]{5,14}',u) for u in users):raise Invalid('comms_phone_allowlist_required')
    if channel=='msteams' and any(not re.fullmatch(r'[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}',u) for u in users):raise Invalid('comms_teams_object_id_required')
    selected={'enabled':True,**{k:v for k,v in inputs.items() if not k.startswith('_')}}
    dm={'dmPolicy':'allowlist' if users else 'disabled','allowFrom':users}
    groups={'groupPolicy':'disabled','groupAllowFrom':[]}
    if channel=='clickclack':selected.update(allowFrom=users,agentActivity=False)
    elif channel=='raft':
        from setup_comms_hermes import raft_credential
        raft_credential(values) # Native authorization belongs to the selected External Agent profile.
    elif channel=='googlechat':
        selected.update(dm={'enabled':bool(users),'policy':'allowlist' if users else 'disabled','allowFrom':users},
            **groups,groups={},requireMention=True,allowBots=False,configWrites=False,
            audienceType='app-url',webhookUrl=inputs['audience'],webhookPath=CALLBACK_PATHS[channel],typingIndicator='none')
    elif channel=='matrix':
        selected.update(dm={'enabled':bool(users),'policy':'allowlist' if users else 'disabled','allowFrom':users},
            **groups,groups={},rooms={},allowlistOnly=True,allowBots=False,autoJoin='off',autoJoinAllowlist=[],
            startupVerification='off',reactionNotifications='off',ackReactionScope='off',encryption=False)
    elif channel=='twitch':selected.update(allowFrom=users,allowedRoles=[],requireMention=True)
    elif channel=='tlon':
        if any(not re.fullmatch(r'~[a-z]+(?:-[a-z]+)*',u) for u in users):raise Invalid('comms_ship_id_required')
        selected.update(dmAllowlist=users,groupInviteAllowlist=[],groupChannels=[],defaultAuthorizedShips=users,
            autoDiscoverChannels=False,autoAcceptDmInvites=False,autoAcceptGroupInvites=False,showModelSignature=False)
    elif channel=='synology-chat':
        selected.update(dmPolicy='allowlist' if users else 'disabled',allowedUserIds=users,
            webhookPath=CALLBACK_PATHS[channel],allowInsecureSsl=False,
            dangerouslyAllowNameMatching=False,dangerouslyAllowInheritedWebhookPath=False)
    else:
        selected.update(dm)
        if channel not in ('nostr','sms'):selected.update(groups)
        if channel=='feishu':selected.update(connectionMode='websocket',domain='feishu',requireMention=True,
            configWrites=False,typingIndicator=False,resolveSenderNames=False,reactionNotifications='off',
            dynamicAgentCreation={'enabled':False},tools={k:False for k in ('doc','chat','wiki','drive','perm','scopes','bitable','base')})
        elif channel=='irc':selected.update(tls=True,channels=[],groups={},nickserv={'enabled':False,'register':False})
        elif channel=='imessage':selected.update(configWrites=False,service='imessage',sendTransport='applescript',
            includeAttachments=False,sendReadReceipts=False,reactionNotifications='off',catchup={'enabled':False},
            groups={},actions={k:False for k in ('reactions','edit','unsend','reply','sendWithEffect','sendAttachment',
                'renameGroup','setGroupIcon','addParticipant','removeParticipant','leaveGroup','polls')})
        elif channel=='line':selected.update(webhookPath=CALLBACK_PATHS[channel],groups={})
        elif channel=='mattermost':selected.update(requireMention=True,configWrites=False,groups={},commands={'native':False,'nativeSkills':False})
        elif channel=='msteams':selected.update(authType='secret',cloud='Public',configWrites=False,requireMention=True,
            webhook={'port':inputs['_port'],'path':CALLBACK_PATHS[channel]},teams={},typingIndicator=False,
            welcomeCard=False,groupWelcomeCard=False,feedbackEnabled=False,delegatedAuth={'enabled':False},sso={'enabled':False})
        elif channel=='nextcloud-talk':selected.update(webhookHost='127.0.0.1',webhookPath=CALLBACK_PATHS[channel],rooms={})
        elif channel=='qqbot':selected.update(groups={},execApprovals={'enabled':False},upgradeMode='doc')
        elif channel=='sms':selected.update(webhookPath=CALLBACK_PATHS[channel],dangerouslyDisableSignatureValidation=False)
        elif channel=='signal':selected.update(autoStart=False,apiMode='native',configWrites=False,
            ignoreAttachments=True,ignoreStories=True,sendReadReceipts=False,
            reactionNotifications='off',reactionLevel='off',actions={'reactions':False},groups={})
        elif channel=='wecom':selected.update(sendThinkingMessage=False,welcomeText='',
            dynamicAgents={'enabled':False},groups={})
    result.setdefault('channels',{})[channel]=selected
    return result,{}


def settings(channel):
    fields=[];url='https://docs.openclaw.ai/channels/'+channel
    for _,key,kind in CONTRACTS[channel]:
        fields.append({'key':key,'label':key.replace('_',' ').title(),'help':
            ('Prepared public HTTPS URL ending in '+CALLBACK_PATHS[channel]+'. Setup does not create a tunnel or provider route.' if kind=='callback' else
             'Prepared signal-cli native daemon on this installation\'s loopback endpoint. Link its dedicated account separately; setup never starts or registers the daemon.' if kind=='loopback-url' else
             'Prepared Raft External Agent profile authenticated in this installation\'s private CLI home. Its workspace authorization controls access; setup does not copy another profile.' if channel=='raft' else
             'Prepared same-user native imsg binary: enter its resolved real path and SHA-256, plus the dedicated Messages database path. Prepare macOS permissions separately. Setup checks file identity without reading chats or changing permissions.' if channel=='imessage' else
             'Minified service-account JSON for this installation; entered privately.' if kind=='service-account' else
             'Selected account setting. Secrets stay in this installation; configuration does not prove authentication.'),
            'classification':'secret' if kind in ('secret','secret-url','service-account','raft-credential') else 'public' if kind=='port' else 'private',
            'valueType':'integer' if kind=='port' else 'string','required':'always','condition':None,'example':'','sharedWith':[],'input':'user',
            'provenance':[{'source':url,'checkedAt':'2026-10-25','note':'Pinned 2026.7.1 channel schema and account/access source.'}]})
    if channel=='raft':return fields
    fields.append({'key':channel.upper().replace('-','_')+'_ALLOWED_USERS','label':'Allowed sender IDs',
        'help':('Comma-separated exact sender IDs. Empty grants no access. Applies to messages in the selected workspace, including shared channels; the native plugin has no separate group switch.' if channel=='clickclack' else
                'Comma-separated exact sender IDs for the selected Twitch channel. Empty grants no access; role-wide access is disabled.' if channel=='twitch' else
                'Comma-separated exact sender IDs. Empty grants no access. This form disables group ingress; no wildcard or automatic pairing.'),
        'classification':'private','valueType':'string','required':'optional','condition':None,'example':'','sharedWith':[],
        'input':'user','provenance':[{'source':url,'checkedAt':'2026-10-25','note':'Restrictive source-bound access policy.'}]})
    return fields


def fixture_values(channel):
    """Non-secret fixtures for contract qualification, never provider identities."""
    fixtures={'secret':'fixture-private-credential','secret-url':'https://chat.example.invalid/incoming?token=fixture-private-credential',
        'service-account':json.dumps({'type':'service_account','project_id':'fixture','client_email':'bot@example.invalid','private_key':'fixture-private-key'}),
        'https':'https://service.example.invalid','callback':'https://callback.example.invalid'+CALLBACK_PATHS.get(channel,''),
        'relays':'wss://relay.example.invalid','port':'19765','guid':'11111111-1111-1111-1111-111111111111',
        'account':'AC'+'a'*32,'phone':'+15551234567','digits':'123456','ship':'~zod','host':'irc.example.invalid','id':'fixture-id',
        'absolute-path':'/isolated-fixture/path','profile':'fixture-profile','loopback-url':'http://127.0.0.1:19765','sha256':'a'*64}
    fixtures['raft-credential']=json.dumps({'schemaVersion':1,'serverUrl':'https://raft.example.invalid',
        'agentId':'fixture-agent','serverId':'fixture-server','apiKey':'fixture-private-credential'})
    result={key:fixtures[kind] for _,key,kind in CONTRACTS[channel]}
    result[channel.upper().replace('-','_')+'_ALLOWED_USERS']=('~nec' if channel=='tlon' else '+15557654321' if channel in ('sms','signal') else fixtures['guid'] if channel=='msteams' else '123456')
    return result
