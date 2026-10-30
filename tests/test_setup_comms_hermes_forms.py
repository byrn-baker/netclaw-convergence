"""Pinned Hermes forms: private values, explicit scope and no runtime side effects."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_schema import Invalid
from setup_comms_hermes import CONTRACTS, prepare, fixtures, hydrate, settings


class HermesFormTests(unittest.TestCase):
    def test_all_forms_preserve_neighbors_and_keep_secrets_in_environment(self):
        for channel,values in fixtures().items():
            with self.subTest(channel=channel):
                before={'model':{'provider':'test'},'mcp_servers':{'neighbor':{'command':'untouched'}},
                        'platforms':{'telegram':{'enabled':True,'extra':{'neighbor':True}}}}
                config,updates=prepare(channel,before,values,home='/owned/fixture')
                self.assertEqual(before['model'],config['model'])
                self.assertEqual(before['mcp_servers'],config['mcp_servers'])
                self.assertEqual(before['platforms']['telegram'],config['platforms']['telegram'])
                native=CONTRACTS[channel]['native']
                self.assertFalse(config['platforms'][native]['gateway_restart_notification'])
                self.assertEqual('false',updates['GATEWAY_ALLOW_ALL_USERS'])
                self.assertNotIn('private-test-secret',json.dumps(config))
                self.assertFalse(config['platforms'][native]['extra']['allow_all_users'])
                self.assertEqual([],config['platforms'][native]['extra']['allow_from'])
                self.assertEqual(before,{'model':{'provider':'test'},'mcp_servers':{'neighbor':{'command':'untouched'}},
                    'platforms':{'telegram':{'enabled':True,'extra':{'neighbor':True}}}})
                self.assertTrue(hydrate(channel,config['platforms'][native],{**values,**updates},home='/owned/fixture'))

    def test_required_credentials_and_nonpublic_scope_refuse_without_mutation(self):
        for channel,values in fixtures().items():
            with self.subTest(channel=channel):
                before={'platforms':{}}
                for field in settings(channel):
                    if field['required']=='always':
                        missing=dict(values);missing.pop(field['key'],None)
                        with self.assertRaises(Invalid):prepare(channel,before,missing,home='/owned/fixture')
                key=CONTRACTS[channel]['prefix']+'_ALLOWED_USERS'
                with self.assertRaises(Invalid):prepare(channel,before,{**values,key:'*'},home='/owned/fixture')
                self.assertEqual({'platforms':{}},before)

    def test_provider_and_callback_urls_reject_embedded_secrets_and_unsafe_schemes(self):
        for channel,key in [('mattermost','MATTERMOST_URL'),('ntfy','NTFY_SERVER_URL'),('bluebubbles','BLUEBUBBLES_SERVER_URL')]:
            for value in ('http://remote.invalid','https://user:secret@server.invalid','https://server.invalid/?secret=token'):
                with self.assertRaises(Invalid):prepare(channel,{},dict(fixtures()[channel],**{key:value}))
        for channel,key in [('line','LINE_PUBLIC_URL'),('wecom-callback','NETCLAW_WECOM_CALLBACK_PUBLIC_URL')]:
            with self.assertRaises(Invalid):prepare(channel,{},dict(fixtures()[channel],**{key:'http://127.0.0.1/x'}))

    def test_callback_and_local_bridge_ports_are_explicit(self):
        from setup_comms_hermes import PORT_FIELDS
        for channel,key in PORT_FIELDS.items():
            if channel not in fixtures():continue
            for port in ('0','80','65536','abc'):
                with self.assertRaises(Invalid):prepare(channel,{},dict(fixtures()[channel],**{key:port}))

    def test_google_credentials_are_inline_service_account_and_no_file_reads(self):
        for value in ('/etc/passwd','{}',json.dumps({'type':'authorized_user'})):
            with self.assertRaises(Invalid):prepare('google-chat',{},dict(fixtures()['google-chat'],GOOGLE_CHAT_SERVICE_ACCOUNT_JSON=value))


if __name__=='__main__':unittest.main()
