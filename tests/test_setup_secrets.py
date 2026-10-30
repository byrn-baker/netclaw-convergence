import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))


class SecretTests(unittest.TestCase):
    def test_nonce_owner_key_single_use_and_line_limits(self):
        from setup_secrets import SecretInbox
        from setup_schema import Invalid
        inbox=SecretInbox('run-one');request=inbox.request('one','API_KEY')
        frame={**request,'type':'secret','value':'private-canary'}
        for changed in ({'owner':'two'},{'key':'OTHER_KEY'},{'requestId':'wrong'},{'extra':True},{'value':'two\nlines'}):
            with self.assertRaises(Invalid):inbox.accept(json.dumps({**frame,**changed}).encode())
        inbox.accept(json.dumps(frame).encode())
        self.assertEqual(inbox.take('one','API_KEY'),'private-canary')
        self.assertIsNone(inbox.take('one','API_KEY'))
        with self.assertRaises(Invalid):inbox.accept(json.dumps(frame).encode())

    def test_child_env_has_only_selected_credentials_and_isolated_home(self):
        from setup_secrets import child_environment
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve()
            os.environ['NEIGHBOR_SECRET']='never-import'
            try:env=child_environment(root,'hermes', {'SELECTED_API_KEY':'selected'})
            finally:os.environ.pop('NEIGHBOR_SECRET')
            self.assertNotIn('NEIGHBOR_SECRET',env)
            self.assertEqual(env['SELECTED_API_KEY'],'selected')
            self.assertEqual(env['HOME'],str(root/'.setup/os-home'))
            self.assertEqual(env['HERMES_HOME'],str(root))
            self.assertEqual(env['UV_MANAGED_PYTHON'],'1')
            self.assertEqual(env['UV_PYTHON_INSTALL_DIR'],str(root/'.setup/python'))
            with self.assertRaises(Exception):child_environment(root,'hermes',{'UV_MANAGED_PYTHON':'0'})
            self.assertNotIn('OPENAI_API_KEY',env)
            # Generated scope in this run's dotenv may repeat but never change
            # the selected harness/home established by the parent.
            self.assertEqual(child_environment(root,'hermes',{'HERMES_HOME':str(root)})['HERMES_HOME'],str(root))
            with self.assertRaises(Exception):child_environment(root,'hermes',{'HERMES_HOME':str(root/'neighbor')})

    def test_env_writer_guards_revisions_and_parents_and_round_trips(self):
        from setup_secrets import write_environment, read_owned_environment
        from setup_state import Conflict, revision
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();path=root/'.env'
            value='literal $(do-not-run) `no` " quote \\ slash'
            digest=write_environment(path,{'API_KEY':value},expected=None)
            self.assertEqual(read_owned_environment(path,digest),{'API_KEY':value})
            with self.assertRaises(Conflict):write_environment(path,{'API_KEY':'changed'},expected=None)
            with self.assertRaises(Conflict):read_owned_environment(path,'0'*64)
            sibling=root/'sibling';sibling.mkdir();alias=root/'alias';alias.symlink_to(sibling)
            with self.assertRaises(Exception):write_environment(alias/'.env',{'API_KEY':'no'},expected=None)
            self.assertFalse((sibling/'.env').exists())
            self.assertEqual(path.stat().st_mode&0o777,0o600)

    def test_owned_retry_reprompts_only_missing_secret_and_preserves_generated_keys(self):
        from test_setup_plan import sample_plan
        from setup_effects import EffectRunner
        from setup_deploy import Deployment
        from setup_secrets import read_owned_environment
        from setup_state import revision
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();plan=sample_plan(str(root));claw=plan['claws'][0]
            effect={'id':'credentials','owner':claw['id'],'phase':'credentials','state':'configuration_required','artifacts':[]}
            context={'runId':'run-fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':[effect]},'artifactIntent':lambda _,a:effect['artifacts'].extend(a)}
            deploy=Deployment(ROOT,claw,context);deploy.home({'id':'home'})
            deploy.write({'id':'runtime'},deploy.root/'.setup/python312',(str(deploy.root/'python/bin/python')+'\n').encode())
            runner=EffectRunner(ROOT,secret_input=lambda *_:None)
            self.assertEqual(runner.credentials(effect,context,deploy)['state'],'configuration_required')
            before=read_owned_environment(deploy.root/'.env',revision(deploy.root/'.env'))
            self.assertEqual(runner.observe(effect,context),'retry_owned')
            runner.secret_input=lambda *_:'new-private-canary'
            self.assertEqual(runner.credentials(effect,context,deploy)['state'],'verified')
            after=read_owned_environment(deploy.root/'.env',revision(deploy.root/'.env'))
            self.assertEqual(after['ANTHROPIC_API_KEY'],'new-private-canary')
            self.assertEqual(before['HUD_API_KEY'],after['HUD_API_KEY'])
            self.assertEqual(before['OPENCLAW_GATEWAY_TOKEN'],after['OPENCLAW_GATEWAY_TOKEN'])
            self.assertNotIn('new-private-canary',json.dumps(effect))


if __name__=='__main__':unittest.main()
