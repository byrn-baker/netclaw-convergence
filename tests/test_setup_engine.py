import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/lib'))
from test_setup_plan import sample_plan


class StateTests(unittest.TestCase):
    def setUp(self):
        from setup_state import StateStore, ResourceLocks
        self.Store, self.Locks = StateStore, ResourceLocks
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()

    def test_private_durable_journal_and_symlink_refusal(self):
        from setup_state import guarded_write
        store = self.Store(self.root/'state')
        store.save('run-one', {'schema':1,'state':'running','effects':[]})
        self.assertEqual(store.load('run-one')['state'], 'running')
        self.assertEqual((self.root/'state').stat().st_mode&0o777, 0o700)
        self.assertEqual((self.root/'state/runs/run-one.json').stat().st_mode&0o777, 0o600)
        target=self.root/'sibling';target.write_text('untouched')
        alias=self.root/'alias';alias.symlink_to(target)
        with self.assertRaises(Exception): guarded_write(alias,b'changed')
        self.assertEqual(target.read_text(),'untouched')
        with self.assertRaises(Exception): store.load('../sibling')

    def test_lock_survives_inheriting_child(self):
        from setup_state import Conflict
        locks=self.Locks(self.root/'locks',['target']);locks.acquire()
        with self.assertRaises(Conflict): self.Locks(self.root/'locks',['target']).acquire()
        child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(0.4)'],pass_fds=tuple(locks.fds))
        locks.close(unlock=False)
        with self.assertRaises(Conflict): self.Locks(self.root/'locks',['target']).acquire()
        child.wait(timeout=3)
        second=self.Locks(self.root/'locks',['target']);second.acquire();second.close()

    def test_expected_revision_and_parent_alias(self):
        from setup_state import guarded_write, revision, Conflict
        p=self.root/'config';guarded_write(p,b'one');rev=revision(p)
        guarded_write(p,b'two',expected=rev)
        with self.assertRaises(Conflict): guarded_write(p,b'three',expected=rev)
        outside=self.root/'outside';outside.mkdir()
        alias=self.root/'alias';alias.symlink_to(outside,target_is_directory=True)
        with self.assertRaises(Exception): guarded_write(alias/'data',b'bad')
        self.assertFalse((outside/'data').exists())

    def test_artifact_indexes_are_durable_digest_bound_and_not_needed_for_status(self):
        from setup_state import guarded_write,Conflict
        store=self.Store(self.root/'state')
        artifacts=[{'path':'/fixture/'+str(i),'sha256':'a'*64} for i in range(1000)]
        store.save('run-one',{'schema':1,'effects':[{'id':'one','artifacts':artifacts}]})
        disk=json.loads(store.path('run-one').read_text());self.assertNotIn('artifacts',disk['effects'][0])
        self.assertEqual(store.load('run-one')['effects'][0]['artifacts'],artifacts)
        ref=disk['effects'][0]['artifactRef']['sha256'];file=store.root/'artifacts/run-one'/(ref+'.json')
        guarded_write(file,b'[]')
        self.assertEqual(store.load('run-one',hydrate=False)['effects'][0]['artifactRef']['count'],1000)
        with self.assertRaises(Conflict):store.load('run-one')


class EngineTests(unittest.TestCase):
    def setUp(self):
        from setup_engine import Engine, ReviewAuthority
        self.Engine,self.Authority=Engine,ReviewAuthority
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve();self.plan=sample_plan(str(self.root))
        self.events=[];self.calls=[]

    def engine(self, runner=None):
        # Test adapters are injected in-process; no public production switch.
        class FixtureObservation:
            def binding(self, plan): return {'source': plan['source'], 'host': plan['host'], 'inputs': []}
            def check(self, plan, run=None): pass
            def controls(self, plan, required): return []
        observation=FixtureObservation()
        return self.Engine(ROOT,self.root/'state',runner or self.runner,observation=observation,emit=self.events.append)

    def runner(self,effect,context):
        self.calls.append(effect['id'])
        if effect['phase']=='home':
            from setup_state import directory, guarded_write
            from setup_schema import canonical
            home=Path(self.plan['claws'][0]['runtimeHome'])
            with directory(home,create=True,private=True):pass
            guarded_write(home/'.netclaw-setup-owner.json',canonical({'schema':1,'runId':context['runId'],
                'installationId':effect['owner'],'planHash':context['planHash']}),expected=None)
        return {'state':'verified','code':'fixture_postcondition','artifacts':[]}

    def review(self,engine,plan=None):
        return self.Authority('test-native-session').approve(engine.review_binding(plan or self.plan))

    def test_comms_manifest_is_bound_and_incomplete_setup_stops_activation(self):
        self.plan['claws'][0]['channels']=[{'id':'discord','settingKeys':[]}]
        def runner(effect,context):
            result=self.runner(effect,context)
            if effect['phase']=='comms':return {'state':'configuration_required'}
            return result
        engine=self.engine(runner)
        import hashlib
        self.assertEqual(hashlib.sha256((ROOT/'config/components/comms.json').read_bytes()).hexdigest(),
                         engine.review_binding(self.plan)['commsHash'])
        result=engine.apply(self.plan,self.review(engine))
        self.assertEqual('configuration_required',result['state'])
        self.assertTrue(any(':comms:' in c for c in self.calls))
        self.assertFalse(any(c.endswith(':services') or c.endswith(':verification') for c in self.calls))

    def test_changed_plan_review_and_occupied_home_refused_before_effect(self):
        engine=self.engine();review=self.review(engine)
        self.plan['claws'][0]['displayName']='Changed'
        with self.assertRaises(Exception):engine.apply(self.plan,review)
        self.assertFalse(self.calls)
        Path(self.plan['claws'][0]['runtimeHome']).mkdir();Path(self.plan['claws'][0]['runtimeHome'],'existing').write_text('keep')
        with self.assertRaises(Exception):engine.apply(self.plan,self.review(engine))
        self.assertFalse(self.calls)

    def test_pause_does_not_start_later_phase_and_resume_requires_action(self):
        engine=None
        def runner(effect,context):
            result=self.runner(effect,context);engine.request_pause();return result
        engine=self.engine(runner)
        run=engine.apply(self.plan,self.review(engine))
        self.assertEqual(run['state'],'paused');self.assertEqual(len(self.calls),1)
        restored=self.engine();status=restored.status(run['runId'])
        self.assertEqual(status['state'],'paused');self.assertEqual(len(self.calls),1)
        done=restored.resume(self.plan,run['runId'],self.review(restored))
        self.assertEqual(done['state'],'completed');self.assertEqual(len(self.calls),len(set(self.calls)))

    def test_unknown_is_not_replayed(self):
        def fail(effect,context):self.calls.append(effect['id']);raise TimeoutError('private output must not leak')
        engine=self.engine(fail);run=engine.apply(self.plan,self.review(engine))
        self.assertEqual(run['state'],'unknown');self.assertEqual(len(self.calls),1)
        restored=self.engine();run2=restored.resume(self.plan,run['runId'],self.review(restored))
        self.assertEqual(run2['state'],'unknown');self.assertEqual(len(self.calls),1)
        self.assertNotIn('private output',json.dumps(self.events))

    def test_unsettled_onboarding_never_starts_later_effects(self):
        for state in ('configuration_required','unverified','skipped'):
            with self.subTest(state=state),tempfile.TemporaryDirectory() as tmp:
                self.root=Path(tmp).resolve();self.plan=sample_plan(str(self.root));self.calls=[]
                def runner(effect,context):
                    result=self.runner(effect,context)
                    return {'state':state} if effect['phase']=='onboard' else result
                runner.observe=lambda effect,context:'completed' if effect['state']=='verified' else 'configuration_required'
                engine=self.engine(runner);run=engine.apply(self.plan,self.review(engine))
                expected='configuration_required' if state=='skipped' else state
                self.assertEqual(run['state'],expected)
                index=next(i for i,e in enumerate(run['effects']) if e['phase']=='onboard')
                self.assertTrue(all(e['state']=='pending' for e in run['effects'][index+1:]))
                self.assertFalse(any(e['phase'] in ('components','registration','services','verification') and e['state']!='pending' for e in run['effects']))
                before=list(self.calls)
                resumed=engine.resume(self.plan,run['runId'],self.review(engine))
                self.assertEqual(self.calls,before)
                self.assertEqual(resumed['state'],expected)
                self.assertTrue(all(e['state']=='pending' for e in resumed['effects'][index+1:]))

    def test_component_failure_isolated_and_production_no_downgrade(self):
        def runner(effect,context):
            result=self.runner(effect,context)
            return {'state':'failed','code':'fixture_failure','artifacts':[]} if effect['phase']=='components' else result
        engine=self.engine(runner);run=engine.apply(self.plan,self.review(engine))
        self.assertEqual(run['state'],'failed');self.assertTrue(any(x.endswith(':verification') for x in self.calls))
        self.plan['posture']['mode']='production';other=self.engine()
        before=len(self.calls)
        with self.assertRaises(Exception):other.apply(self.plan,self.review(other))
        self.assertEqual(len(self.calls),before);self.assertEqual(self.plan['posture']['mode'],'production')

    def test_production_refusal_identifies_host_and_selected_claw_controls(self):
        from setup_engine import ControlRefusal
        self.plan['posture']['mode']='production';engine=self.engine()
        with self.assertRaises(ControlRefusal) as error:engine.apply(self.plan,self.review(engine))
        blocked=error.exception.blocked_controls
        self.assertIn({'owner':'host','control':'openshell-confinement','state':'unverified'},blocked)
        self.assertIn({'owner':'fixture-claw','control':'defenseclaw-model-guard','state':'unverified'},blocked)
        self.assertFalse(self.calls);self.assertFalse(Path(self.plan['claws'][0]['runtimeHome']).exists())

    def test_crash_intent_is_unknown_and_status_does_not_execute(self):
        class Crash(BaseException):pass
        def crash(effect,context):raise Crash()
        engine=self.engine(crash)
        with self.assertRaises(Crash):engine.apply(self.plan,self.review(engine))
        journals=list((self.root/'state/runs').glob('*.json'));self.assertEqual(len(journals),1)
        journal=json.loads(journals[0].read_text())
        self.assertEqual(journal['effects'][0]['state'],'running')
        self.assertEqual(self.engine().status(journal['runId'])['state'],'unknown')
        self.assertFalse(self.calls)

    def test_review_is_one_use_and_sibling_is_preserved(self):
        sibling=self.root/'existing-claw';sibling.mkdir();secret=sibling/'.env';secret.write_text('SIBLING=fixture-canary\n')
        before=secret.read_bytes();engine=self.engine();review=self.review(engine)
        result=engine.apply(self.plan,review)
        self.assertEqual(result['state'],'completed')
        self.assertEqual(secret.read_bytes(),before)
        with self.assertRaises(Exception):self.engine().apply(self.plan,review)

    def test_disconnect_request_finishes_owned_checkpoint_only(self):
        engine=None
        def work(effect,context):
            engine.request_pause()
            self.assertTrue(context['pause'].is_set())
            return self.runner(effect,context)
        engine=self.engine(work);run=engine.apply(self.plan,self.review(engine))
        self.assertEqual(run['state'],'paused')
        self.assertEqual([e['state'] for e in run['effects']].count('verified'),1)


if __name__=='__main__':unittest.main()
