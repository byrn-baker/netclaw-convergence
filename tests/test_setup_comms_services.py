import copy
import datetime
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_comms import hermes_transport_evidence
from setup_risk import roles, gateway_command
from setup_schema import canonical
from setup_state import guarded_write,Conflict


class MessagingServiceTests(unittest.TestCase):
    def test_service_install_boundary_refuses_empty_access_and_missing_dependency_before_manager(self):
        from setup_deploy import Deployment
        from setup_comms import configure_channel
        from setup_comms_services import activation_gate
        from setup_risk import install_services
        for harness_name in ('openclaw','hermes'):
            for scope,dependencies in (('',True),('123456789',False),('123456789',True)):
                with self.subTest(harness=harness_name,scope=bool(scope),dependencies=dependencies),tempfile.TemporaryDirectory() as tmp:
                    plan=sample_plan(str(Path(tmp).resolve()));claw=plan['claws'][0]
                    claw.update(harness=harness_name,workspace=claw['runtimeHome'])
                    if harness_name=='hermes':claw['runtimeVersion']='0.21.6'
                    claw['channels']=[{'id':'discord','settingKeys':[]}]
                    effects=[];context={'runId':'fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':effects}}
                    def effect(name):
                        item={'id':name,'owner':claw['id'],'phase':name,'state':'verified','artifacts':[]};effects.append(item);return item
                    context['artifactIntent']=lambda key,rows:next(e for e in effects if e['id']==key)['artifacts'].extend(rows)
                    deploy=Deployment(ROOT,claw,context);deploy.home(effect('home'))
                    deploy.write(effect('credentials'),deploy.root/'.env',('DISCORD_BOT_TOKEN=fixture\nDISCORD_ALLOWED_USERS='+scope+'\n').encode(),kind='credentials')
                    deploy.write(effect('onboard'),deploy.root/('config.yaml' if harness_name=='hermes' else 'openclaw.json'),canonical({}),kind='configuration')
                    comms=effect('comms');comms['channel']='discord'
                    native=SimpleNamespace(command=lambda:['fixture-native'],call=lambda *a,**kw:{'returncode':0,'stdout':b'{}'},
                        environment=lambda:self.fail('service manager preparation crossed an incomplete access/dependency gate'))
                    observed={'adapter':True,'dependencies':True,'configured':True}
                    with patch('setup_comms.hermes_channel_inspection',return_value=observed),patch('setup_comms_openclaw.install_channel',return_value=True):
                        self.assertEqual('verified',configure_channel(comms,context,deploy,native)['state'])
                    services=effect('services')
                    with patch('setup_comms_evidence.hermes_channel_inspection',return_value={**observed,'dependencies':dependencies}),patch(
                        'setup_comms_openclaw.observe_channel',return_value=dependencies),patch('setup_risk.native_call',side_effect=AssertionError('manager must remain untouched')):
                        if scope and dependencies:
                            binding=activation_gate(services,context,deploy,native)
                            self.assertEqual(['discord'],binding['channels'])
                        elif not scope and dependencies:
                            self.assertEqual({'state':'configuration_required'},install_services(services,context,deploy,native,user_home=Path(tmp).resolve()))
                        else:
                            with self.assertRaises(Conflict):install_services(services,context,deploy,native,user_home=Path(tmp).resolve())
                    self.assertFalse((deploy.root/'.setup/services.json').exists())
                    self.assertFalse((Path(tmp)/'Library/LaunchAgents').exists())

    def test_effective_access_distinguishes_native_account_gateway_and_entity_scopes(self):
        from setup_comms_services import effective_access_scope
        from setup_plan import PlanValidator
        catalog=PlanValidator(ROOT).comms
        def allowed(runtime,channel,values):
            return effective_access_scope({'harness':runtime},channel,catalog.channel(runtime,channel),values)
        self.assertFalse(allowed('openclaw','discord',{'DISCORD_GUILD_ID':'123','DISCORD_ALLOWED_CHANNELS':'456'}))
        self.assertTrue(allowed('openclaw','discord',{'DISCORD_ALLOWED_USERS':'123'}))
        self.assertFalse(allowed('hermes','homeassistant',{}))
        self.assertTrue(allowed('hermes','homeassistant',{'NETCLAW_HASS_ENTITIES':'sensor.fixture'}))
        self.assertFalse(allowed('hermes','raft',{}))
        self.assertTrue(allowed('hermes','raft',{'RAFT_ALLOWED_USERS':'raft-bridge'}))
        for channel in ('raft','webchat'):
            self.assertTrue(allowed('openclaw',channel,{}),'separate completed native configuration proves this scope')

    def test_duplicate_consumers_compare_owned_plan_accounts_across_harnesses(self):
        from setup_comms_services import duplicate_consumer,account_consumer_key
        from setup_secrets import write_environment
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();plan=sample_plan(str(root));first=plan['claws'][0]
            first['channels']=[{'id':'telegram'}]
            second=copy.deepcopy(first);second.update(id='second',harness='hermes',runtimeHome=str(root/'second'))
            plan['claws'].append(second);path=Path(second['runtimeHome'])/'.env'
            path.parent.mkdir(mode=0o700)
            digest=write_environment(path,{'TELEGRAM_BOT_TOKEN':'123456:second-secret'},expected=None)
            context={'plan':plan,'journal':{'effects':[{'artifacts':[{'owner':'second','path':str(path),'sha256':digest}]}]}}
            self.assertTrue(duplicate_consumer(context,first,{'TELEGRAM_BOT_TOKEN':'123456:first-secret'}))
            self.assertFalse(duplicate_consumer(context,first,{'TELEGRAM_BOT_TOKEN':'987654:first-secret'}))
            self.assertNotIn('secret',str(account_consumer_key('telegram',{'TELEGRAM_BOT_TOKEN':'123456:first-secret'})))
            # A neighboring unowned environment is never inspected/adopted.
            context['journal']['effects']=[]
            self.assertFalse(duplicate_consumer(context,first,{'TELEGRAM_BOT_TOKEN':'123456:first-secret'}))

    def test_gateway_restart_refuses_changed_account_or_access_policy(self):
        from setup_comms_services import verify_activation_binding
        from setup_state import revision
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();config=home/'config.yaml';environment=home/'.env'
            guarded_write(config,canonical({'platforms':{'discord':{'enabled':True}}}))
            guarded_write(environment,b'DISCORD_BOT_TOKEN=fixture\n')
            binding={'schema':1,'channels':['discord'],'configurationHash':revision(config),'environmentHash':revision(environment)}
            verify_activation_binding(home,'hermes',binding)
            guarded_write(environment,b'DISCORD_BOT_TOKEN=changed\n',expected=revision(environment))
            with self.assertRaises(Conflict):verify_activation_binding(home,'hermes',binding)

    def test_unsettled_channel_stops_before_service_creation(self):
        from setup_comms_services import activation_gate
        from setup_deploy import Deployment
        from setup_secrets import write_environment
        with tempfile.TemporaryDirectory() as tmp:
            plan=sample_plan(str(Path(tmp).resolve()));claw=plan['claws'][0];claw['channels']=[{'id':'discord'}]
            context={'plan':plan,'runId':'fixture','planHash':'a'*64,'journal':{'effects':[]}}
            deploy=Deployment(ROOT,claw,context)
            deploy.root.mkdir(mode=0o700)
            digest=write_environment(deploy.root/'.env',{'DISCORD_BOT_TOKEN':'fixture'},expected=None)
            context['journal']['effects'].append({'owner':claw['id'],'phase':'credentials','artifacts':[{'path':str(deploy.root/'.env'),'sha256':digest}]})
            with self.assertRaises(Conflict):activation_gate({'id':'services'},context,deploy,None)
            self.assertFalse((deploy.root/'.setup/services.json').exists())

    def test_teams_and_sms_callbacks_reserve_distinct_plan_ports(self):
        from setup_plan import PlanValidator
        validator=PlanValidator(ROOT);plan=sample_plan();claw=plan['claws'][0]
        claw.update(harness='hermes',runtimeVersion='0.21.6',workspace=claw['runtimeHome'])
        values={'TEAMS_CLIENT_ID':'11111111-1111-4111-8111-111111111111','TEAMS_TENANT_ID':'22222222-2222-4222-8222-222222222222',
            'TEAMS_PORT':21978,'NETCLAW_TEAMS_PUBLIC_URL':'https://installer.example.invalid/api/messages',
            'TWILIO_ACCOUNT_SID':'AC'+'a'*32,'TWILIO_PHONE_NUMBER':'+15551234567','SMS_WEBHOOK_PORT':21980,
            'SMS_WEBHOOK_URL':'https://installer.example.invalid/webhooks/twilio'}
        for channel in ('teams','sms'):
            fields=validator.comms.channel('hermes',channel)['setup']['settings']
            claw['channels'].append({'id':channel,'settingKeys':[f['key'] for f in fields]})
            for field in fields:
                key=field['key']
                if field['classification']=='secret':claw['settings'][key]={'kind':'secret','key':key,'owner':claw['id'],'source':'prompt'}
                elif key in values:claw['settings'][key]={'kind':'value','value':values[key]}
        self.assertTrue(validator.inspect(plan)['valid'],validator.inspect(plan)['errors'])
        claw['settings']['SMS_WEBHOOK_PORT']['value']=21978
        self.assertIn('endpoint_collision',{e['code'] for e in validator.inspect(plan)['errors']})

    def test_hermes_has_distinct_owned_gateway_only_when_channels_selected(self):
        claw=sample_plan()['claws'][0];claw['harness']='hermes'
        self.assertEqual(['hud'],roles(claw,'focused'))
        claw['channels']=[{'id':'discord','settingKeys':[]}]
        self.assertEqual(['gateway','hud'],roles(claw,'focused'))
        self.assertEqual(['gateway','hud','federation'],roles(claw,'risk'))
        self.assertEqual([str(Path(claw['runtimeHome'])/'python-runtimes/hermes-hud-agent/venv/bin/python'),
            '-m','hermes_cli.main','gateway','run','--external-supervisor'],gateway_command(Path(claw['runtimeHome']),'hermes'))
        self.assertEqual([str(Path(claw['runtimeHome'])/'.setup/prefix/bin/openclaw'),'gateway','run'],gateway_command(Path(claw['runtimeHome']),'openclaw'))
        with self.assertRaises(Conflict):gateway_command(Path(claw['runtimeHome']),'other')

    def test_transport_requires_live_owned_pid_generation_and_fresh_platform_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();now=1800000000
            stamp=lambda seconds:datetime.datetime.fromtimestamp(seconds,datetime.timezone.utc).isoformat()
            record={'kind':'hermes-gateway','pid':456,'start_time':123456789,'hermes_home':str(home),
                'updated_at':stamp(now),'platforms':{'discord':{'state':'connected','updated_at':stamp(now),
                    'writer_pid':456,'writer_start_time':123456789}}}
            def write(value):guarded_write(home/'gateway_state.json',canonical(value))
            def observe():return hermes_transport_evidence(home,'discord',pid=456,start_time=123456789,now=now)
            write(record);self.assertEqual('connected',observe())
            for mutate in [lambda r:r.update(pid=457),lambda r:r.update(hermes_home=str(home/'neighbor')),
                lambda r:r.update(start_time='reused-pid'),lambda r:r.update(updated_at=stamp(now-61)),
                lambda r:r['platforms']['discord'].update(updated_at=stamp(now-61)),
                lambda r:r['platforms']['discord'].update(writer_pid=457),
                lambda r:r['platforms']['discord'].update(writer_start_time='old'),
                lambda r:r['platforms']['discord'].update(state='configured'),
                lambda r:r.update(updated_at=stamp(now+61))]:
                bad=copy.deepcopy(record);mutate(bad);write(bad)
                self.assertEqual('unverified',observe())
            # A state file alone is not a live-process observation.
            write(record);self.assertEqual('unverified',hermes_transport_evidence(home,'discord',pid=None,start_time=None,now=now))
            import json
            record['platforms']['discord']['metrics']={'latency':0.125}
            guarded_write(home/'gateway_state.json',json.dumps(record).encode())
            self.assertEqual('connected',observe())


if __name__=='__main__':unittest.main()
