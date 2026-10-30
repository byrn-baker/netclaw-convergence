"""Pinned OpenClaw setup contracts preserve unrelated state and deny broad access."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))


class OpenClawTypedConfigTests(unittest.TestCase):
    def test_every_declared_form_has_a_private_required_fixture_and_preserves_other_state(self):
        from setup_comms_openclaw_config import CONTRACTS,PLUGIN_IDS,prepare_config,fixture_values,settings
        for channel in CONTRACTS:
            with self.subTest(channel=channel):
                values=fixture_values(channel)
                before={'provider':{'key':'untouched'},'channels':{'neighbor':{'token':'untouched'}},
                        'plugins':{'allow':[PLUGIN_IDS.get(channel,channel),'neighbor'],'entries':{'neighbor':{'enabled':True}}}}
                snapshot=copy.deepcopy(before)
                after,updates=prepare_config(channel,before,values)
                self.assertEqual(before,snapshot)
                self.assertEqual(after['provider'],before['provider'])
                self.assertEqual(after['channels']['neighbor'],before['channels']['neighbor'])
                self.assertEqual(after['plugins']['allow'],before['plugins']['allow'])
                self.assertEqual(after['plugins']['entries']['neighbor'],before['plugins']['entries']['neighbor'])
                self.assertEqual({},updates)
                self.assertTrue(after['channels'][channel]['enabled'])
                for field in settings(channel):
                    if field['classification']=='secret':self.assertNotIn(values[field['key']],json.dumps(after))

    def test_missing_credentials_wildcards_and_conflicting_shared_policy_refuse(self):
        from setup_comms_openclaw_config import CONTRACTS,PLUGIN_IDS,prepare_config,fixture_values,settings
        from setup_schema import Invalid
        for channel in CONTRACTS:
            with self.subTest(channel=channel):
                values=fixture_values(channel)
                required=next(f['key'] for f in settings(channel) if f['required']=='always')
                incomplete={**values,required:''}
                with self.assertRaises(Invalid):prepare_config(channel,{},incomplete)
                for policy in ({'enabled':False},{'deny':[PLUGIN_IDS.get(channel,channel)]},{'allow':['neighbor']}):
                    with self.assertRaises(Invalid):prepare_config(channel,{'plugins':policy},values)
                for wildcard in ('*','user,*','user?'):
                    unsafe={**values,channel.upper().replace('-','_')+'_ALLOWED_USERS':wildcard}
                    with self.assertRaises(Invalid):prepare_config(channel,{},unsafe)

    def test_empty_access_never_becomes_open_or_pairing(self):
        from setup_comms_openclaw_config import CONTRACTS,prepare_config,fixture_values
        for channel in CONTRACTS:
            values=fixture_values(channel);values[channel.upper().replace('-','_')+'_ALLOWED_USERS']=''
            selected=prepare_config(channel,{},values)[0]['channels'][channel]
            data=json.dumps(selected)
            self.assertNotIn('"open"',data)
            self.assertNotIn('"pairing"',data)
            self.assertNotIn('"*"',data)
            self.assertFalse(selected.get('autoJoin')=='always')

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_OPENCLAW_SOURCE') and os.environ.get('NETCLAW_TEST_NODE'),
                         'isolated pinned OpenClaw source and Node required')
    def test_actual_pinned_native_schemas_accept_every_form_without_network(self):
        from setup_comms_openclaw_config import CONTRACTS,prepare_config,fixture_values
        # WeCom publishes a permissive manifest rather than a native schema;
        # its exact packaged account/access contract is qualified separately.
        payload={c:prepare_config(c,{},fixture_values(c))[0]['channels'][c] for c in CONTRACTS if c!='wecom'}
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'fixtures.json';p.write_text(json.dumps(payload))
            result=subprocess.run([os.environ['NETCLAW_TEST_NODE'],str(ROOT/'installer/native-comms/openclaw/check-typed-schemas.mjs'),
                os.environ['NETCLAW_TEST_OPENCLAW_SOURCE'],str(p)],capture_output=True,timeout=90)
            self.assertEqual(0,result.returncode,result.stderr.decode())
            self.assertEqual(set(CONTRACTS)-{'wecom'},set(json.loads(result.stdout)['verified']))


if __name__=='__main__':unittest.main()
