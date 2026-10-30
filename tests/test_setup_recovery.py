import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_deploy import Deployment
from setup_effects import EffectRunner
from setup_state import guarded_write,Conflict

class Crash(BaseException):pass

class RecoveryTests(unittest.TestCase):
    def test_engine_persists_source_boundary_and_resumes_before_dependency_install(self):
        from setup_engine import Engine,ReviewAuthority
        names=b'config/installer-runtime.json\0scripts/install.sh\0'
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp).resolve();plan=sample_plan(str(root));installed=[]
            class Observation:
                def binding(self,plan):return {'source':plan['source'],'host':plan['host'],'inputs':[]}
                def check(self,*_):pass
                def controls(self,*_):return []
            def engine():return Engine(ROOT,root/'state',EffectRunner(ROOT),observation=Observation())
            e=engine();review=ReviewAuthority('fixture').approve(e.review_binding(plan))
            def crash_copy(path,data,**kwargs):
                guarded_write(path,data,**kwargs)
                if '.setup/source/' in str(path):raise Crash()
            with patch('setup_deploy.git',return_value=names),patch('setup_observation.source_identity',return_value=plan['source']),patch('setup_harness.Harness.install',side_effect=lambda *_:installed.append(True) or {'state':'unverified'}):
                with patch('setup_deploy.guarded_write',side_effect=crash_copy):
                    with self.assertRaises(Crash):e.apply(plan,review)
                run_id=next((root/'state/runs').glob('*.json')).stem
                saved=e._state().load(run_id)
                runtime=next(v for v in saved['effects'] if v['phase']=='runtime')
                self.assertEqual(runtime['runtimeStage'],'source');self.assertFalse(installed)
                resumed=engine();fresh=ReviewAuthority('fixture-reopened').approve(resumed.review_binding(plan))
                result=resumed.resume(plan,run_id,fresh)
                self.assertEqual(result['state'],'unverified');self.assertEqual(installed,[True])
                settled=resumed._state().load(run_id)
                runtime=next(v for v in settled['effects'] if v['phase']=='runtime')
                self.assertEqual(runtime['runtimeStage'],'dependencies')
                self.assertTrue(all(v['state']=='pending' for v in settled['effects'] if v['phase'] not in ('home','runtime')))

    def test_source_copy_checkpoint_repairs_exact_owned_files_before_any_package_manager(self):
        names=b'config/installer-runtime.json\0scripts/install.sh\0'
        with tempfile.TemporaryDirectory() as temp,patch('setup_deploy.git',return_value=names):
            plan,context,deploy,effect=self.fixture(Path(temp).resolve());deploy.home(effect('home'))
            current=effect('runtime');current['runtimeStage']='source';calls=[]
            def crash_after_first(path,data,**kwargs):
                guarded_write(path,data,**kwargs);calls.append(Path(path));raise Crash()
            with patch('setup_deploy.guarded_write',side_effect=crash_after_first):
                with self.assertRaises(Crash):deploy.copy_source(current)
            first=calls[0];before=first.stat();current['state']='unknown'
            runner=EffectRunner(ROOT);self.assertEqual(runner.observe(current,context),'retry_owned')
            self.assertEqual(len(current['artifacts']),2)
            deploy.copy_source(current)
            self.assertEqual(len(current['artifacts']),2)
            self.assertEqual((first.stat().st_ino,first.stat().st_mtime_ns),(before.st_ino,before.st_mtime_ns))
            self.assertEqual((deploy.source/'scripts/install.sh').stat().st_mode&0o777,0o700)
            current['runtimeStage']='dependencies'
            with patch('setup_harness.Harness.observe_runtime',return_value=False):
                self.assertEqual(runner.observe(current,context),'unknown')
            current['runtimeStage']='source';first.write_bytes(b'changed')
            self.assertEqual(runner.observe(current,context),'conflict')

    def test_source_copy_refuses_to_claim_identical_unowned_files(self):
        names=b'config/installer-runtime.json\0'
        with tempfile.TemporaryDirectory() as temp,patch('setup_deploy.git',return_value=names):
            plan,context,deploy,effect=self.fixture(Path(temp).resolve());deploy.home(effect('home'))
            current=effect('runtime');current['runtimeStage']='source'
            target=deploy.source/'config/installer-runtime.json';guarded_write(target,(ROOT/'config/installer-runtime.json').read_bytes())
            self.assertEqual(deploy.observe_source_copy(current),'conflict')
            with self.assertRaises(Conflict):deploy.copy_source(current)
            self.assertEqual(current['artifacts'],[])

    def test_verified_component_with_missing_launch_artifacts_cannot_resume(self):
        with tempfile.TemporaryDirectory() as temp:
            plan,context,deploy,effect=self.fixture(Path(temp).resolve());deploy.home(effect('home'))
            current=effect('components');current.update(component='subnet-calc',state='verified')
            with patch('setup_components.dependency_ready',return_value=False):
                self.assertEqual(EffectRunner(ROOT).observe(current,context),'conflict')
            with patch('setup_components.dependency_ready',return_value=True):
                self.assertEqual(EffectRunner(ROOT).observe(current,context),'completed')
            current['state']='unknown'
            with patch('setup_components.dependency_ready',return_value=True):
                self.assertEqual(EffectRunner(ROOT).observe(current,context),'unknown')

    def fixture(self,root):
        plan=sample_plan(str(root));claw=plan['claws'][0]
        claw['capabilities']['skills']=['subnet-calculator','aap-automation']
        identity=root/'operator.md';identity.write_bytes(b'Reviewed operator identity')
        plan['identity']=[{'owner':claw['id'],'kind':kind,'path':str(identity),'sha256':hashlib.sha256(identity.read_bytes()).hexdigest()} for kind in ('user','identity')]
        effects=[]
        context={'runId':'run-fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':effects},'lockFds':(), 'writerStarted':lambda *_:None}
        def effect(phase):
            value={'id':phase,'owner':claw['id'],'phase':phase,'component':'','state':'running','artifacts':[]};effects.append(value);return value
        context['artifactIntent']=lambda key,items:next(e for e in effects if e['id']==key)['artifacts'].extend(items)
        return plan,context,Deployment(ROOT,claw,context),effect

    def test_interrupted_file_sets_repair_only_missing_owned_outputs_and_keep_settled_inodes(self):
        for phase in ('home','skills','identity'):
            with self.subTest(phase=phase),tempfile.TemporaryDirectory() as temp:
                plan,context,deploy,effect=self.fixture(Path(temp).resolve());runner=EffectRunner(ROOT)
                if phase!='home':deploy.home(effect('home'))
                current=effect(phase);calls=[]
                def crash_after_one(path,data,**kwargs):
                    guarded_write(path,data,**kwargs);calls.append(Path(path))
                    if len(calls)==1:raise Crash()
                method=deploy.home if phase=='home' else deploy.skills if phase=='skills' else deploy.inputs
                with patch('setup_deploy.guarded_write',side_effect=crash_after_one):
                    with self.assertRaises(Crash):method(current)
                first=calls[0];before=first.stat();current['state']='unknown'
                self.assertEqual(runner.observe(current,context),'retry_owned')
                self.assertEqual(method(current)['state'],'verified')
                self.assertEqual((first.stat().st_ino,first.stat().st_mtime_ns),(before.st_ino,before.st_mtime_ns))
                self.assertEqual(runner.observe(current,context),'completed')
                current['state']='verified'
                deploy.file_outputs(phase)[-1][0].unlink()
                self.assertEqual(runner.observe(current,context),'conflict')

    def test_changed_or_unjournaled_identical_files_cannot_be_adopted_or_repaired(self):
        with tempfile.TemporaryDirectory() as temp:
            plan,context,deploy,effect=self.fixture(Path(temp).resolve());deploy.home(effect('home'))
            current=effect('skills');outputs=deploy.file_outputs('skills');target,data,_=outputs[0]
            guarded_write(target,data)
            self.assertEqual(deploy.observe_files(current),'conflict')
            with self.assertRaises(Conflict):deploy.skills(current)
            self.assertEqual(current['artifacts'],[])
            self.assertEqual(deploy.observe_files(current),'conflict')
            self.assertEqual(target.read_bytes(),data)

    def test_partial_inventory_or_registration_is_unknown_not_completed_from_a_prefix(self):
        for phase in ('inventory','registration'):
            with self.subTest(phase=phase),tempfile.TemporaryDirectory() as temp:
                plan,context,deploy,effect=self.fixture(Path(temp).resolve());deploy.home(effect('home'))
                current=effect(phase);deploy.write(current,deploy.root/'prefix',b'only first output',kind=phase)
                current['state']='unknown'
                self.assertEqual(EffectRunner(ROOT).observe(current,context),'unknown')

    def test_engine_requires_fresh_review_then_repairs_interrupted_home(self):
        from setup_engine import Engine,ReviewAuthority
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp).resolve();plan=sample_plan(str(root));calls=[]
            class Observation:
                def binding(self,plan):return {'source':plan['source'],'host':plan['host'],'inputs':[]}
                def check(self,*_):pass
                def controls(self,*_):return []
            class Runner(EffectRunner):
                def __call__(self,effect,context):
                    calls.append(effect['phase'])
                    if effect['phase']=='home':return super().__call__(effect,context)
                    return {'state':'unverified'}
            def engine():return Engine(ROOT,root/'state',Runner(ROOT),observation=Observation())
            e=engine();review=ReviewAuthority('fixture').approve(e.review_binding(plan))
            def crash_after_marker(path,data,**kwargs):
                guarded_write(path,data,**kwargs)
                if Path(path).name=='.netclaw-setup-owner.json':raise Crash()
            with patch('setup_deploy.guarded_write',side_effect=crash_after_marker):
                with self.assertRaises(Crash):e.apply(plan,review)
            run_id=next((root/'state/runs').glob('*.json')).stem
            resumed=engine();self.assertEqual(resumed.status(run_id)['state'],'unknown')
            with self.assertRaises(Exception):resumed.resume(plan,run_id,review)
            self.assertEqual(calls,['home'])
            fresh=ReviewAuthority('fixture-reopened').approve(resumed.review_binding(plan))
            result=resumed.resume(plan,run_id,fresh)
            self.assertEqual(result['effects'][0]['state'],'verified')
            self.assertEqual(calls[:2],['home','home'])
            self.assertTrue((Path(plan['claws'][0]['runtimeHome'])/'netclaw-hud/installation.json').is_file())

if __name__=='__main__':unittest.main()
