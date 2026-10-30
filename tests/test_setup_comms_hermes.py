"""Actual pinned selected-platform inspections, without services or auth."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'installer/native-comms/hermes_setup.py'
PLUGINS=('telegram','discord','slack','google_chat','whatsapp','sms','email',
    'mattermost','matrix','dingtalk','feishu','wecom','wecom_callback','photon',
    'teams','line','ntfy','simplex','raft','irc','buzz')


@unittest.skipUnless(os.environ.get('NETCLAW_TEST_HERMES_PYTHON'),'isolated pinned Hermes runtime required')
class SelectedHermesTests(unittest.TestCase):
    def invoke(self,channel,config,*,mode='inspect',credentials=None,expect=True,prepare_home=None):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();home.chmod(0o700)
            marker=home/'.netclaw-setup-owner.json';marker.write_text(json.dumps({'runId':'fixture','installationId':'selected'}));marker.chmod(0o600)
            target=home/'config.yaml';target.write_text(config if isinstance(config,str) else json.dumps(config));target.chmod(0o600)
            if prepare_home:prepare_home(home)
            before={str(p.relative_to(home)):p.read_bytes() for p in home.rglob('*') if p.is_file()}
            env={'PATH':os.defpath,'HOME':str(home),'HERMES_HOME':str(home),'PYTHONNOUSERSITE':'1',
                 'PYTHONDONTWRITEBYTECODE':'1','GATEWAY_MULTIPLEX_PROFILES':'false',**(credentials or {})}
            result=subprocess.run([os.environ['NETCLAW_TEST_HERMES_PYTHON'],str(HELPER),channel,mode],
                env=env,cwd=home,capture_output=True,timeout=30)
            after={str(p.relative_to(home)):p.read_bytes() for p in home.rglob('*') if p.is_file()}
            self.assertEqual(before,after,'inspection wrote private state')
            if expect:
                self.assertEqual(0,result.returncode,result.stderr.decode())
                value=json.loads(result.stdout)
                self.assertEqual(channel,value['channel']);self.assertTrue(value['adapter'])
                self.assertNotIn('transport',value);self.assertNotIn('authentication',value)
                self.assertNotIn('private-token-canary',result.stdout.decode()+result.stderr.decode())
                return value
            self.assertEqual(8,result.returncode)

    def test_all_bundled_channel_plugins_are_inspected_without_installing_or_starting(self):
        for channel in PLUGINS:
            with self.subTest(channel=channel):
                result=self.invoke(channel,{'platforms':{channel:{'enabled':False}}})
                self.assertFalse(result['configured'])

    def test_disabled_malformed_and_arbitrary_channels_refuse(self):
        for channel,config in [('teams',{'plugins':{'disabled':['platforms/teams']}}),
                               ('teams','- not-a-config-mapping\n'),('arbitrary',{})]:
            self.invoke(channel,config,expect=False)

    def test_actual_typed_readback_is_configuration_not_connection(self):
        for channel,credentials in [('discord',{'DISCORD_BOT_TOKEN':'private-token-canary'}),
                ('slack',{'SLACK_BOT_TOKEN':'private-token-canary','SLACK_APP_TOKEN':'private-token-canary'}),
                ('telegram',{'TELEGRAM_BOT_TOKEN':'private-token-canary'})]:
            with self.subTest(channel=channel):
                result=self.invoke(channel,{'platforms':{channel:{'enabled':True}}},mode='readback',credentials=credentials)
                self.assertTrue(result['configured'])

    def test_typed_teams_and_sms_readback_requires_restricted_callback_configuration(self):
        import sys
        sys.path.insert(0,str(ROOT/'scripts/lib'))
        from setup_comms import prepare_channel_config
        fixtures={'teams':{'TEAMS_CLIENT_ID':'11111111-1111-4111-8111-111111111111',
            'TEAMS_CLIENT_SECRET':'private-token-canary','TEAMS_TENANT_ID':'22222222-2222-4222-8222-222222222222',
            'TEAMS_PORT':'21978','NETCLAW_TEAMS_PUBLIC_URL':'https://installer.example.invalid/api/messages'},
            'sms':{'TWILIO_ACCOUNT_SID':'AC'+'a'*32,'TWILIO_AUTH_TOKEN':'private-token-canary',
                'TWILIO_PHONE_NUMBER':'+15551234567','SMS_WEBHOOK_PORT':'21980',
                'SMS_WEBHOOK_URL':'https://installer.example.invalid/webhooks/twilio'}}
        for channel,values in fixtures.items():
            claw={'harness':'hermes','role':'focused','channels':[{'id':channel}]}
            config,updates=prepare_channel_config(claw,channel,{},values)
            result=self.invoke(channel,config,mode='readback',credentials={**values,**updates})
            self.assertTrue(result['configured']);self.assertTrue(result['dependencies'])
            unsafe={**values,**updates,(channel.upper()+'_ALLOW_ALL_USERS'):'true'}
            self.assertFalse(self.invoke(channel,config,mode='readback',credentials=unsafe)['configured'])

    def test_whatsapp_cloud_readback_does_not_pair_or_bind_a_listener(self):
        result=self.invoke('whatsapp_cloud',{'platforms':{'whatsapp_cloud':{'enabled':True,
            'extra':{'dm_policy':'allowlist','group_policy':'disabled','webhook_host':'127.0.0.1'}}}},mode='readback',
            credentials={'WHATSAPP_CLOUD_PHONE_NUMBER_ID':'1234567890123','WHATSAPP_CLOUD_ACCESS_TOKEN':'private-token-canary',
                'WHATSAPP_CLOUD_APP_SECRET':'private-token-canary','WHATSAPP_CLOUD_VERIFY_TOKEN':'private-token-canary'})
        self.assertTrue(result['configured']);self.assertTrue(result['dependencies']);self.assertFalse(result['nativeSetup'])

    def test_expanded_forms_have_actual_selected_native_readback(self):
        import sys
        sys.path.insert(0,str(ROOT/'scripts/lib'))
        from setup_comms_hermes import CONTRACTS,prepare,fixtures
        extra_sdks={'google-chat','dingtalk','feishu','wecom-callback'}
        if os.environ.get('NETCLAW_TEST_HERMES_EXTRA_SDKS'):
            from setup_observation import host_identity
            catalog=json.loads((ROOT/'config/components/comms.json').read_text())
            matrix=next(entry for entry in catalog['entries'] if entry['id']=='hermes-matrix')
            # The pinned Matrix extra is WSL-only; retain its real SDK assertion
            # there without requiring an unsupported dependency on macOS.
            if host_identity()['platform'] in matrix['hosts']:extra_sdks.add('matrix')
        for channel,values in fixtures().items():
            if channel in ('photon','whatsapp','raft','buzz','homeassistant'):continue # owned native acquisition fixtures separately
            with self.subTest(channel=channel):
                config,updates=prepare(channel,{},values)
                native=CONTRACTS[channel]['native']
                result=self.invoke(native,config,mode='readback',credentials={**values,**updates})
                self.assertTrue(result['configured'])
                if os.environ.get('NETCLAW_TEST_HERMES_EXTRA_SDKS') and channel in extra_sdks:
                    self.assertTrue(result['dependencies'])
                # Dependency acquisition is independently observed. This test
                # never labels a missing SDK or external daemon ready.
                unsafe={**values,**updates,'GATEWAY_ALLOW_ALL_USERS':'true'}
                self.assertFalse(self.invoke(native,config,mode='readback',credentials=unsafe)['configured'])

    def test_official_external_homeassistant_reads_only_selected_plugin(self):
        import sys
        sys.path.insert(0,str(ROOT/'scripts/lib'))
        from setup_comms_hermes import prepare,fixtures
        from setup_comms_hermes_native import homeassistant_contract
        from setup_state import guarded_write
        values=fixtures()['homeassistant'];config,updates=prepare('homeassistant',{},values)
        def stage(home):
            source,files=homeassistant_contract(ROOT)
            for name in files:guarded_write(home/'plugins/homeassistant'/name,(source/name).read_bytes())
        result=self.invoke('homeassistant',config,mode='readback',credentials={**values,**updates},prepare_home=stage)
        self.assertTrue(result['configured']);self.assertTrue(result['dependencies'])
        config['plugins']['disabled']=['homeassistant']
        self.invoke('homeassistant',config,mode='readback',credentials={**values,**updates},prepare_home=stage,expect=False)


if __name__=='__main__':unittest.main()
