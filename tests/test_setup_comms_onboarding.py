"""Owned Comms writes: no provider calls, service launch or borrowed settings."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_schema import Invalid, canonical, loads
from setup_state import Conflict, guarded_read
from setup_deploy import Deployment
from setup_comms import prepare_channel_config, configure_channel


class OnboardingTests(unittest.TestCase):
    def test_native_terminal_authority_is_exact_selected_channel_and_owner(self):
        from setup_transport import validate_native_effect
        from setup_engine import ReviewRefused
        plan=sample_plan();claw=plan['claws'][0];claw['channels']=[{'id':'whatsapp','settingKeys':[]}]
        effect={'owner':claw['id'],'phase':'comms','id':claw['id']+':comms:whatsapp'}
        validate_native_effect({'plan':plan},effect)
        for values in [{'owner':'neighbor'},{'phase':'services'},{'id':claw['id']+':comms:discord'},{'id':effect['id']+':command'}]:
            with self.assertRaises(ReviewRefused):validate_native_effect({'plan':plan},dict(effect,**values))

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.plan=sample_plan(str(Path(self.temp.name).resolve()))
        self.claw=self.plan['claws'][0]
        self.claw['channels']=[{'id':'discord','settingKeys':[]}]
        self.effects=[]
        self.context={'runId':'run-fixture','planHash':'a'*64,'plan':self.plan,
                      'journal':{'effects':self.effects}}
        self.context['artifactIntent']=lambda key,items:next(e for e in self.effects if e['id']==key)['artifacts'].extend(items)

    def effect(self,phase):
        e={'id':self.claw['id']+':'+phase,'owner':self.claw['id'],'phase':phase,
           'channel':'discord','artifacts':[]}
        self.effects.append(e);return e

    def test_openclaw_restrictive_merge_preserves_other_channels_provider_and_mcp(self):
        config={'models':{'fixture':{}},'mcp':{'servers':{'fixture':{}}},
                'channels':{'slack':{'fixture':'retained'}}}
        before=copy.deepcopy(config)
        out,env=prepare_channel_config(self.claw,'discord',config,{'DISCORD_BOT_TOKEN':'private-canary'})
        self.assertEqual(before,config)
        self.assertEqual(before['models'],out['models']);self.assertEqual(before['mcp'],out['mcp'])
        self.assertEqual(before['channels']['slack'],out['channels']['slack'])
        discord=out['channels']['discord']
        self.assertEqual('allowlist',discord['dmPolicy']);self.assertEqual([],discord['allowFrom'])
        self.assertEqual('disabled',discord['groupPolicy'])
        self.assertEqual('${DISCORD_BOT_TOKEN}',discord['token'])
        self.assertNotIn('private-canary',json.dumps(out));self.assertEqual({},env)

    def test_explicit_openclaw_channel_scope_and_mentions(self):
        values={'DISCORD_BOT_TOKEN':'private','DISCORD_ALLOWED_USERS':'123,456',
                'DISCORD_GUILD_ID':'789','DISCORD_ALLOWED_CHANNELS':'987,654'}
        out,_=prepare_channel_config(self.claw,'discord',{},values)
        cfg=out['channels']['discord'];self.assertEqual(['123','456'],cfg['allowFrom'])
        self.assertEqual('allowlist',cfg['groupPolicy'])
        self.assertEqual({'987','654'},set(cfg['guilds']['789']['channels']))
        self.assertTrue(all(c['requireMention'] for c in cfg['guilds']['789']['channels'].values()))
        for key,value in [('DISCORD_ALLOWED_USERS','*'),('DISCORD_ALLOWED_CHANNELS','987,*'),('DISCORD_GUILD_ID','*')]:
            with self.assertRaises(Invalid):prepare_channel_config(self.claw,'discord',{},dict(values,**{key:value}))

    def test_hermes_merge_and_safe_defaults_without_raw_credentials(self):
        self.claw['harness']='hermes'
        config={'model':{'provider':'fixture'},'mcp_servers':{'fixture':{}},'platforms':{'slack':{'enabled':True}}}
        out,env=prepare_channel_config(self.claw,'discord',config,{'DISCORD_BOT_TOKEN':'private-canary'})
        self.assertEqual(config['model'],out['model']);self.assertEqual(config['mcp_servers'],out['mcp_servers'])
        self.assertEqual(config['platforms']['slack'],out['platforms']['slack'])
        self.assertTrue(out['platforms']['discord']['enabled'])
        self.assertFalse(out['platforms']['discord']['extra']['allow_all_users'])
        self.assertEqual('false',env['GATEWAY_ALLOW_ALL_USERS'])
        self.assertEqual('false',env['DISCORD_ALLOW_ALL_USERS'])
        self.assertNotIn('private-canary',json.dumps(out))

    def test_whatsapp_cloud_is_separate_private_and_restrictive(self):
        self.claw['harness']='hermes';self.claw['channels']=[{'id':'whatsapp-cloud','settingKeys':[]}]
        config={'platforms':{'whatsapp':{'enabled':True,'extra':{'bridge_port':3100}}},'model':{'preserved':True}}
        values={'WHATSAPP_CLOUD_PHONE_NUMBER_ID':'1234567890123','WHATSAPP_CLOUD_ACCESS_TOKEN':'private-canary',
            'WHATSAPP_CLOUD_APP_SECRET':'private-canary','WHATSAPP_CLOUD_VERIFY_TOKEN':'private-canary',
            'WHATSAPP_CLOUD_WEBHOOK_PORT':'19878','NETCLAW_WHATSAPP_CLOUD_PUBLIC_URL':'https://example.invalid/whatsapp/webhook'}
        out,env=prepare_channel_config(self.claw,'whatsapp-cloud',config,values)
        self.assertEqual(config['platforms']['whatsapp'],out['platforms']['whatsapp'])
        self.assertEqual(config['model'],out['model']);self.assertNotIn('private-canary',json.dumps(out))
        extra=out['platforms']['whatsapp_cloud']['extra']
        self.assertEqual('allowlist',extra['dm_policy']);self.assertEqual([],extra['allow_from'])
        self.assertEqual('disabled',extra['group_policy']);self.assertEqual('127.0.0.1',extra['webhook_host'])
        self.assertEqual('false',env['WHATSAPP_CLOUD_ALLOW_ALL_USERS'])
        for updates in ({'WHATSAPP_CLOUD_ALLOWED_USERS':'*'},{'WHATSAPP_CLOUD_PHONE_NUMBER_ID':'+15555550123'},
                        {'WHATSAPP_CLOUD_WEBHOOK_PORT':'80'},{'NETCLAW_WHATSAPP_CLOUD_PUBLIC_URL':'http://127.0.0.1/x'}):
            with self.assertRaises(Invalid):prepare_channel_config(self.claw,'whatsapp-cloud',config,dict(values,**updates))

    def test_only_selected_owner_and_channel_can_configure(self):
        for mutate in [lambda c:c.update(role='member'),lambda c:c.update(channels=[])]:
            claw=copy.deepcopy(self.claw);mutate(claw)
            with self.assertRaises(Invalid):prepare_channel_config(claw,'discord',{}, {'DISCORD_BOT_TOKEN':'private'})

    def test_webchat_requires_owned_authenticated_loopback_without_retired_channel_config(self):
        self.claw['channels']=[{'id':'webchat','settingKeys':[]}]
        config={'gateway':{'mode':'local','bind':'loopback','port':self.claw['endpoints']['gatewayPort'],
            'auth':{'mode':'token','token':{'source':'env','provider':'default','id':'OPENCLAW_GATEWAY_TOKEN'}}},
            'channels':{},'mcp':{'servers':{'neighbor':{}}}}
        values={'OPENCLAW_GATEWAY_TOKEN':'fixture-not-real-'*3}
        self.assertEqual((config,{}),prepare_channel_config(self.claw,'webchat',config,values))
        for mutate in (lambda c:c['gateway'].update(bind='lan'),lambda c:c['gateway']['auth'].update(mode='none'),
                       lambda c:c['channels'].update(webchat={}),
                       lambda c:c['gateway'].update(controlUi={'dangerouslyDisableDeviceAuth':True})):
            changed=copy.deepcopy(config);mutate(changed)
            with self.assertRaises(Invalid):prepare_channel_config(self.claw,'webchat',changed,values)

    def prepare(self):
        deploy=Deployment(ROOT,self.claw,self.context)
        deploy.home(self.effect('home'))
        deploy.write(self.effect('credentials'),deploy.root/'.env',b'DISCORD_BOT_TOKEN=private-canary\n',kind='credentials')
        config={'models':{'preserve':True},'mcp':{'servers':{'preserve':{}}},'channels':{}}
        deploy.write(self.effect('onboard'),deploy.root/'openclaw.json',canonical(config),kind='configuration')
        return deploy

    def harness(self,code=0):
        # This suite covers owned configuration promotion/readback. Native
        # dependency acquisition has a separate actual packaged-helper gate.
        acquisition=patch('setup_comms_openclaw.install_channel',return_value=True)
        acquisition.start();self.addCleanup(acquisition.stop)
        calls=[]
        class Fixture:
            def command(self):return ['/owned/openclaw']
            def call(self,effect,args,**kwargs):
                calls.append(args);return {'returncode':code,'stdout':b''}
        return Fixture(),calls

    def test_selected_plugin_respects_existing_shared_enablement_policy(self):
        values={'DISCORD_BOT_TOKEN':'private-canary'}
        for policy in [{'enabled':False},{'deny':['discord']},{'allow':['slack']}]:
            original={'plugins':policy}
            with self.assertRaises(Invalid):prepare_channel_config(self.claw,'discord',original,values)
            self.assertEqual({'plugins':policy},original)
        original={'plugins':{'allow':['slack','discord'],'deny':['matrix'],
            'entries':{'slack':{'enabled':True},'discord':{'config':{'retained':True}}}}}
        out,_=prepare_channel_config(self.claw,'discord',original,values)
        self.assertEqual(original['plugins']['allow'],out['plugins']['allow'])
        self.assertEqual(original['plugins']['deny'],out['plugins']['deny'])
        self.assertEqual(original['plugins']['entries']['slack'],out['plugins']['entries']['slack'])
        self.assertEqual({'enabled':True,'config':{'retained':True}},out['plugins']['entries']['discord'])

    def test_hermes_webhook_channels_keep_credentials_private_and_access_restricted(self):
        original={'model':{'provider':'retained'},'mcp_servers':{'fixture':{}},'platforms':{'slack':{'enabled':True}}}
        fixtures={'teams':{'TEAMS_CLIENT_ID':'11111111-1111-4111-8111-111111111111',
            'TEAMS_CLIENT_SECRET':'private-canary','TEAMS_TENANT_ID':'22222222-2222-4222-8222-222222222222',
            'TEAMS_PORT':'21978','NETCLAW_TEAMS_PUBLIC_URL':'https://installer.example.invalid/api/messages'},
            'sms':{'TWILIO_ACCOUNT_SID':'AC'+'a'*32,'TWILIO_AUTH_TOKEN':'private-canary',
                'TWILIO_PHONE_NUMBER':'+15551234567','SMS_WEBHOOK_PORT':'21980',
                'SMS_WEBHOOK_URL':'https://installer.example.invalid/webhooks/twilio'}}
        for channel,values in fixtures.items():
            claw={'harness':'hermes','role':'border','channels':[{'id':channel}]}
            result,updates=prepare_channel_config(claw,channel,original,values)
            for key in ('model','mcp_servers'):self.assertEqual(original[key],result[key])
            self.assertEqual(original['platforms']['slack'],result['platforms']['slack'])
            self.assertNotIn('private-canary',json.dumps(result))
            self.assertFalse(result['platforms'][channel]['gateway_restart_notification'])
            self.assertEqual('false',updates[channel.upper()+'_ALLOW_ALL_USERS'])
            self.assertEqual('',updates[channel.upper()+'_ALLOWED_USERS'])
            callback='NETCLAW_TEAMS_PUBLIC_URL' if channel=='teams' else 'SMS_WEBHOOK_URL'
            for url in ['http://example.com/api/messages','https://127.0.0.2/api/messages','https://user:secret@example.com/api/messages']:
                with self.assertRaises(Invalid):prepare_channel_config(claw,channel,original,{**values,callback:url})
        sms={'harness':'hermes','role':'focused','channels':[{'id':'sms'}]}
        missing=dict(fixtures['sms']);missing.pop('TWILIO_AUTH_TOKEN');missing['TWILIO_API_SECRET']='not-an-auth-token'
        with self.assertRaises(Invalid):prepare_channel_config(sms,'sms',original,missing)

    def test_owned_write_and_readback_not_authentication(self):
        deploy=self.prepare();harness,calls=self.harness()
        result=configure_channel(self.effect('comms'),self.context,deploy,harness)
        self.assertEqual('verified',result['state'])
        self.assertEqual('configured',result['comms']['configuration'])
        self.assertEqual('unverified',result['comms']['authentication'])
        self.assertEqual('unverified',result['comms']['transport'])
        self.assertEqual([['/owned/openclaw','config','validate']],calls)
        self.assertTrue(loads(guarded_read(deploy.root/'openclaw.json'))['models']['preserve'])
        self.assertNotIn('private-canary',json.dumps(self.effects))
        self.assertEqual(0,(deploy.root/'openclaw.json').stat().st_mode&0o077)

    def test_changed_revision_and_wrong_effect_owner_refuse_before_native_call(self):
        deploy=self.prepare();harness,calls=self.harness()
        target=deploy.root/'openclaw.json';target.write_text('{"foreign":true}')
        with self.assertRaises(Conflict):configure_channel(self.effect('comms'),self.context,deploy,harness)
        self.assertEqual([],calls);self.assertEqual('{"foreign":true}',target.read_text())
        e=self.effect('comms-other');e['owner']='neighbor'
        with self.assertRaises(Conflict):configure_channel(e,self.context,deploy,harness)

    def test_native_validation_failure_cannot_be_configuration_success(self):
        deploy=self.prepare();harness,_=self.harness(code=1)
        self.assertEqual('configuration_required',configure_channel(self.effect('comms'),self.context,deploy,harness)['state'])

    def test_partial_write_never_authorizes_activation_or_overwrites_neighbor(self):
        deploy=self.prepare();harness,calls=self.harness();original=deploy.write
        def interrupted(*args,**kwargs):
            original(*args,**kwargs);raise InterruptedError('fixture interruption after write')
        deploy.write=interrupted
        with self.assertRaises(InterruptedError):configure_channel(self.effect('comms'),self.context,deploy,harness)
        self.assertEqual([],calls)
        self.assertTrue(self.effects[-1]['artifacts'])


if __name__=='__main__':unittest.main()
