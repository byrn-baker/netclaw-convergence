"""Hermes native setup contracts; synthetic pairing events are not live links."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_comms_hermes_native import (patched_bridge,pairing_files,pairing_ready,pair_whatsapp,graph,
    install_homeassistant,observe_homeassistant,homeassistant_contract,install_buzz,observe_buzz,raft_wrapper,observe_raft_profile,observe_whatsapp)
from setup_schema import canonical
from setup_state import guarded_write,Conflict


class HermesNativeContracts(unittest.TestCase):
    def deploy(self,home):
        class D:
            root=home;source=ROOT;claw={'id':'fixture'}
            def write(self,effect,path,data,**kw):
                guarded_write(path,data,expected=kw.get('expected'))
                effect.setdefault('artifacts',[]).append({'path':str(path),'sha256':hashlib.sha256(data).hexdigest()})
        return D()

    def test_official_homeassistant_acquisition_detects_foreign_or_modified_plugin(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();home.chmod(0o700);effect={}
            self.assertTrue(install_homeassistant(effect,self.deploy(home)))
            self.assertTrue(observe_homeassistant(home,ROOT))
            guarded_write(home/'plugins/homeassistant/adapter.py',b'# modified')
            self.assertFalse(observe_homeassistant(home,ROOT))
            with self.assertRaises(Conflict):install_homeassistant(effect,self.deploy(home))

    def test_raft_launcher_never_borrows_operator_profile_and_readback_requires_receipt(self):
        from setup_comms_hermes import fixtures,prepare,raft_credential
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();home.chmod(0o700)
            values=fixtures()['raft'];config,env=prepare('raft',{},values,home=home)
            self.assertEqual(str(home/'.setup/os-home'),env['HERMES_REAL_HOME'])
            self.assertEqual(str(home/'.setup/comms/raft/profile-home'),env['RAFT_HOME'])
            raw=raft_wrapper(home,'/owned/node')
            self.assertIn(b'unset SLOCK_HOME RAFT_PROFILE_DIR',raw)
            self.assertNotIn(b'$HOME',raw)
            guarded_write(home/'.setup/comms/raft/profile-home/profiles/fixture/credential.json',canonical(raft_credential(values)))
            self.assertFalse(observe_raft_profile(home,values))

    def test_buzz_binary_digest_type_version_and_unknown_probe_are_bound(self):
        from setup_comms_hermes import fixtures
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();home.chmod(0o700);origin=home/'prepared-buzz'
            # Binary bytes are a contract fixture; no executable process runs.
            raw=b'\x7fELFsynthetic-native-fixture';guarded_write(origin,raw);origin.chmod(0o700)
            values={**fixtures()['buzz'],'NETCLAW_BUZZ_BINARY':str(origin),'NETCLAW_BUZZ_BINARY_SHA256':hashlib.sha256(raw).hexdigest()}
            calls=[]
            harness=SimpleNamespace(call=lambda effect,args,**kwargs: calls.append(args) or {'returncode':0,'stdout':b'buzz 0.1.0\n'})
            self.assertTrue(install_buzz({},self.deploy(home),harness,values))
            self.assertTrue(observe_buzz(home,values));self.assertEqual(1,len(calls))
            self.assertTrue(install_buzz({},self.deploy(home),harness,values));self.assertEqual(1,len(calls))
            guarded_write(home/'.setup/comms/native/buzz/buzz',raw+b'modified')
            self.assertFalse(observe_buzz(home,values))
            self.assertFalse(install_buzz({},self.deploy(home),harness,values));self.assertEqual(1,len(calls))

    def test_pair_only_guard_precedes_both_operational_handlers(self):
        source=b"function startSocket() {\n  sock.ev.on('connection.update', handle);\n  sock.ev.on('messages.update', async (updates) => {\n });\n  sock.ev.on('messages.upsert', handle);\n}"
        result=patched_bridge(source)
        self.assertLess(result.index(b'if (PAIR_ONLY) return'),result.index(b"sock.ev.on('messages.update'"))
        self.assertLess(result.index(b"sock.ev.on('connection.update'"),result.index(b'if (PAIR_ONLY) return'))
        with self.assertRaises(Conflict):patched_bridge(source+source)

    def test_whole_private_session_and_exact_authenticated_identity_are_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage=Path(tmp).resolve();stage.chmod(0o700);user='15551234567:1@s.whatsapp.net'
            guarded_write(stage/'creds.json',canonical({'registered':True,'me':{'id':user}}))
            guarded_write(stage/'session-key.json',canonical({'key':'private-test-secret'}))
            self.assertEqual({'creds.json','session-key.json'},set(pairing_files(stage,user)))
            with self.assertRaises(Conflict):pairing_files(stage,'15557654321:1@s.whatsapp.net')
            (stage/'session-key.json').chmod(0o644)
            with self.assertRaises(Conflict):pairing_files(stage,user)

    def test_dependency_graph_refuses_external_links_and_tracks_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();guarded_write(root/'source.js',b'fixture')
            before=graph(root);guarded_write(root/'source.js',b'changed')
            self.assertNotEqual(before,graph(root))
            (root/'alias').symlink_to('/etc/passwd')
            with self.assertRaises(Conflict):graph(root)

    def test_unknown_pair_attempt_never_reopens_native_terminal(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();home.chmod(0o700)
            guarded_write(home/'.setup/comms/whatsapp/pair-request.json',canonical({'schema':1,'nonce':'a'*64}))
            session=SimpleNamespace(terminal=lambda *_a,**_k: self.fail('unknown attempt replayed'))
            deploy=SimpleNamespace(root=home,source=ROOT,claw={'id':'fixture'})
            with patch('setup_comms_hermes_native.observe_bridge',return_value=True):
                self.assertFalse(pair_whatsapp({'artifacts':[]},{'runId':'run','planHash':'b'*64},deploy,None,session))

    def test_settled_pairing_promotes_all_files_without_reopening_ui_and_binds_owner(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();home.chmod(0o700);base=home/'.setup/comms/whatsapp';stage=base/'pair-stage'
            effect={'artifacts':[]};deploy=self.deploy(home);context={'runId':'run','planHash':'b'*64}
            guarded_write(home/'.netclaw-setup-owner.json',canonical({**context,'installationId':'fixture'}))
            request={'schema':1,'nonce':'a'*64,**context,'owner':'fixture'}
            deploy.write(effect,base/'pair-request.json',canonical(request))
            user='15551234567:1@s.whatsapp.net'
            guarded_write(stage/'creds.json',canonical({'registered':True,'me':{'id':user}}))
            guarded_write(stage/'session-key.json',canonical({'key':'private-test-secret'}))
            receipt={'schema':1,'nonce':'a'*64,'state':'paired','returncode':0,'connectedUser':user,'files':pairing_files(stage,user)}
            guarded_write(base/'pair-result.json',canonical(receipt))
            with patch('setup_comms_hermes_native.observe_bridge',return_value=True):
                self.assertTrue(pair_whatsapp(effect,context,deploy,None,None))
                self.assertTrue(pairing_ready(home))
                self.assertEqual('paired',observe_whatsapp(effect,context,deploy))
                self.assertEqual(set(receipt['files']),set(p.name for p in (home/'platforms/whatsapp/session').iterdir()))
                self.assertFalse(pair_whatsapp(effect,{**context,'runId':'other'},deploy,None,None))
                self.assertTrue(pair_whatsapp(effect,context,deploy,None,None))
                guarded_write(home/'platforms/whatsapp/session/session-key.json',canonical({'key':'rotated-private-test-secret'}))
                self.assertTrue(pairing_ready(home));self.assertEqual('paired',observe_whatsapp(effect,context,deploy))
                guarded_write(home/'platforms/whatsapp/session/creds.json',canonical({'registered':True,'me':{'id':'15557654321:1@s.whatsapp.net'}}))
                self.assertFalse(pairing_ready(home));self.assertEqual('conflict',observe_whatsapp(effect,context,deploy))

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_NODE'),'isolated supported Node required')
    def test_native_driver_matches_synthetic_events_and_saves_all_auth_files_without_leaking(self):
        for outcome in ('paired','mismatched','nonzero'):
            with self.subTest(outcome=outcome),tempfile.TemporaryDirectory() as tmp:
                home=Path(tmp).resolve();home.chmod(0o700);base=home/'.setup/comms/whatsapp';stage=base/'pair-stage'
                stage.mkdir(parents=True,mode=0o700)
                for p in (home/'.setup',home/'.setup/comms',base):p.chmod(0o700)
                owner={'schema':1,'runId':'fixture','planHash':'a'*64,'installationId':'fixture'}
                guarded_write(home/'.netclaw-setup-owner.json',canonical(owner))
                guarded_write(base/'pair-request.json',canonical({'schema':1,'runId':'fixture','planHash':'a'*64,'owner':'fixture','nonce':'b'*64}))
                native=home/'.setup/comms/native/whatsapp'
                guarded_write(native/'package.json',b'{"type":"module"}')
                guarded_write(native/'node_modules/qrcode-terminal/index.js',b"module.exports={generate(){throw Error('unexpected QR')}}")
                script="""import fs from 'node:fs';import path from 'node:path';
// if (PAIR_ONLY) return; // NetClaw owned installer: auth only
const stage=process.argv[process.argv.indexOf('--session')+1];
const user='15551234567:1@s.whatsapp.net';
fs.writeFileSync(path.join(stage,'creds.json'),JSON.stringify({registered:true,me:{id:user}}),{mode:0o600});
fs.writeFileSync(path.join(stage,'session-key.json'),JSON.stringify({key:'private-test-secret'}),{mode:0o600});
console.log(JSON.stringify({event:'started',session:stage}));
console.log(JSON.stringify({event:'connected',user:{id:USER}}));
process.exitCode=CODE;
""".replace('USER',"'15557654321:1@s.whatsapp.net'" if outcome=='mismatched' else 'user').replace('CODE','1' if outcome=='nonzero' else '0')
                guarded_write(native/'bridge.js',script.encode())
                result=subprocess.run([os.environ['NETCLAW_TEST_NODE'],str(ROOT/'installer/native-comms/hermes/whatsapp-pair.mjs')],
                    env={'PATH':os.defpath,'HOME':str(home),'HERMES_HOME':str(home)},capture_output=True,timeout=10)
                self.assertNotIn(b'private-test-secret',result.stdout+result.stderr)
                self.assertNotIn(b'15551234567',result.stdout+result.stderr)
                if outcome=='paired':
                    self.assertEqual(0,result.returncode,result.stderr.decode())
                    receipt=json.loads((base/'pair-result.json').read_bytes())
                    self.assertEqual({'creds.json','session-key.json'},set(receipt['files']))
                    self.assertFalse(pairing_ready(home),'staged credentials are not promoted readiness')
                else:self.assertEqual(8,result.returncode)


if __name__=='__main__':unittest.main()
