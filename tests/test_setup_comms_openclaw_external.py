"""Evidence-backed external adapter restrictions against exact published code."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))

class OpenClawExternalRestrictionTests(unittest.TestCase):
    @unittest.skipUnless(all(os.environ.get(k) for k in ('NETCLAW_TEST_NODE','NETCLAW_TEST_OPENCLAW_CORE','NETCLAW_TEST_YUANBAO_PACKAGE')),
        'isolated exact published package and OpenClaw core required')
    def test_pinned_yuanbao_does_not_enforce_ordinary_sender_allowlist(self):
        result=subprocess.run([os.environ['NETCLAW_TEST_NODE'],str(ROOT/'installer/native-comms/openclaw/check-yuanbao-access.mjs'),
            os.environ['NETCLAW_TEST_YUANBAO_PACKAGE'],os.environ['NETCLAW_TEST_OPENCLAW_CORE']],capture_output=True,timeout=30)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        evidence=json.loads(result.stdout)
        self.assertEqual(0,evidence['providerConnections'])
        self.assertEqual(['disabled','allowlist'],[r['policy'] for r in evidence['results']])
        self.assertTrue(all(r['unlistedOrdinarySenderPassed'] for r in evidence['results']))

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_NODE') and os.environ.get('NETCLAW_TEST_OPENCLAW_WECOM_HOME'),
        'isolated pinned acquired WeCom plugin required')
    def test_exact_wecom_account_and_ordinary_sender_access_without_network(self):
        from setup_comms_openclaw_config import prepare_config,fixture_values
        values=fixture_values('wecom');config=prepare_config('wecom',{},values)[0]
        config['channels']['wecom']['secret']=values['WECOM_SECRET']
        with tempfile.TemporaryDirectory() as tmp:
            fixture=Path(tmp)/'config.json';fixture.write_text(json.dumps(config));fixture.chmod(0o600)
            result=subprocess.run([os.environ['NETCLAW_TEST_NODE'],str(ROOT/'installer/native-comms/openclaw/check-wecom-contract.mjs'),
                os.environ['NETCLAW_TEST_OPENCLAW_WECOM_HOME'],str(fixture)],capture_output=True,timeout=30)
            self.assertEqual(0,result.returncode,result.stderr.decode())

if __name__=='__main__':unittest.main()
