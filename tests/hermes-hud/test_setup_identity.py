import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'mcp-servers/hermes-hud-mcp'))
from setup_identity import load_identity
from policy import ToolPolicy
from ledger import HudError

class IdentityTests(unittest.TestCase):
    def test_only_manifest_selected_private_identity_is_admitted_and_drift_fails(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp).resolve();(home/'.setup').mkdir(mode=0o700)
            def write(file,data):
                file.write_bytes(data);file.chmod(0o600)
            soul=home/'SOUL.md';write(soul,b'Fixture persona: use concise answers.')
            self.assertEqual(load_identity(home),('',{}))
            write(home/'.netclaw-setup-owner.json',json.dumps({'schema':1,'runId':'run-fixture','planHash':'a'*64}).encode())
            digest=hashlib.sha256(soul.read_bytes()).hexdigest()
            write(home/'.setup/identity.json',json.dumps({'schema':1,'files':{'SOUL.md':digest}}).encode())
            text,hashes=load_identity(home)
            self.assertIn('use concise answers',text);self.assertIn('grants no additional tools',text)
            config=home/'config.yaml';write(config,b'{}')
            policy=ToolPolicy({},config,hashlib.sha256(b'{}').hexdigest());policy.identity_hashes=hashes;policy.check_sources()
            write(soul,b'Changed externally')
            with self.assertRaises(HudError):policy.check_sources()
            with self.assertRaises(HudError):load_identity(home)
            write(soul,b'Fixture persona: use concise answers.');soul.chmod(0o644)
            with self.assertRaises(HudError):load_identity(home)
            soul.unlink();soul.symlink_to(config)
            with self.assertRaises(HudError):load_identity(home)

if __name__=='__main__':unittest.main()
