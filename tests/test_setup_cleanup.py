from pathlib import Path
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_state import guarded_write,revision
from setup_schema import canonical

class CleanupTests(unittest.TestCase):
    def test_management_lock_refuses_active_or_unsettled_operations_and_retains_unknown_cleanup(self):
        import os
        from setup_cleanup import management_lock
        from setup_state import Conflict
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();state=home/'netclaw-hud/management';lock=state/'mutation.lock'
            guarded_write(lock,canonical({'pid':os.getpid(),'started':0}))
            with self.assertRaises(Conflict):
                with management_lock(home,'run-fixture'):self.fail('active management entered')
            lock.unlink();guarded_write(state/'operations/aaaa.json',canonical({'phase':'unknown'}))
            with self.assertRaises(Conflict):
                with management_lock(home,'run-fixture'):self.fail('unsettled management entered')
            self.assertFalse(lock.exists());guarded_write(state/'operations/aaaa.json',canonical({'phase':'verified'}))
            with self.assertRaises(RuntimeError):
                with management_lock(home,'run-fixture'):raise RuntimeError('interrupted')
            self.assertTrue(lock.exists());self.assertTrue(__import__('json').loads(lock.read_text())['setupCleanup'])
            lock.unlink()
            import subprocess
            child=subprocess.run([sys.executable,'-c','import sys;sys.path.insert(0,sys.argv[1]);from setup_cleanup import management_lock\nwith management_lock(sys.argv[2],"run-fixture"):raise RuntimeError("fixture interruption")',str(ROOT/'scripts/lib'),str(home)],capture_output=True)
            self.assertNotEqual(child.returncode,0);self.assertTrue(lock.exists())
            from setup_state import ResourceLocks
            with ResourceLocks(home/'setup-locks',['home:'+str(home)]):
                with management_lock(home,'run-fixture'):self.assertTrue(lock.exists())
            self.assertFalse(lock.exists())

    def test_only_unchanged_run_created_unshared_files_are_removed(self):
        from setup_cleanup import preview,apply_cleanup,cleanup_binding
        from setup_engine import ReviewAuthority
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve()/'claw';home.mkdir(mode=0o700)
            run={'runId':'run-fixture','planHash':'a'*64,'plan':{'claws':[{'id':'one','runtimeHome':str(home)}]},'effects':[]}
            guarded_write(home/'.netclaw-setup-owner.json',canonical({'schema':1,'runId':run['runId'],'planHash':run['planHash'],'installationId':'one'}))
            artifacts=[]
            for name in ['owned','changed','preexisting','shared']:
                guarded_write(home/name,b'initial')
                artifacts.append({'path':str(home/name),'owner':'one','class':'file','sha256':revision(home/name),'existedBefore':name=='preexisting','before':None,'referencedBy':['one','two'] if name=='shared' else ['one']})
            guarded_write(home/'changed',b'operator edit')
            run['effects']=[{'artifacts':artifacts}]
            plan=preview(run);self.assertEqual([r['action'] for r in plan['items']].count('remove'),1)
            review=ReviewAuthority('fixture').approve(cleanup_binding(run,plan),'cleanup')
            result=apply_cleanup(run,review);self.assertFalse((home/'owned').exists())
            self.assertTrue((home/'preexisting').exists());self.assertEqual((home/'changed').read_bytes(),b'operator edit')
            self.assertTrue((home/'shared').exists());self.assertEqual(result['removed'],1)
            self.assertEqual({Path(i['path']).name:i['outcome'] for i in result['items']},
                {'owned':'removed','changed':'retained','preexisting':'retained','shared':'retained'})

    def test_expired_cleanup_review_leaves_run_resumable_and_absence_is_reported_separately(self):
        from setup_cleanup import preview,cleanup_binding
        from setup_engine import Engine,ReviewAuthority,ReviewRefused
        from setup_state import StateStore
        from test_setup_plan import sample_plan
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();plan=sample_plan(str(root));home=Path(plan['claws'][0]['runtimeHome']);owner=plan['claws'][0]['id'];home.mkdir(mode=0o700)
            run={'runId':'run-fixture','planHash':'a'*64,'state':'paused','plan':plan,'effects':[]}
            run['reports']={owner:{'harness':'openclaw','tiers':[{'tier':3,'state':'verified','code':'identity_verified'}],'components':[]}}
            guarded_write(home/'.netclaw-setup-owner.json',canonical({'schema':1,'runId':run['runId'],'planHash':run['planHash'],'installationId':owner}))
            guarded_write(home/'owned',b'owned');row={'path':str(home/'owned'),'owner':owner,'class':'file','sha256':revision(home/'owned'),'existedBefore':False,'referencedBy':[owner]}
            absent={**row,'path':str(home/'absent')};run['effects']=[{'id':'home','artifacts':[row,absent]}]
            store=StateStore(root/'state');store.save(run['runId'],run)
            before=store.path(run['runId']).read_bytes();engine=Engine(ROOT,root/'state')
            review=ReviewAuthority('fixture').approve(cleanup_binding(run,preview(run)),'cleanup');review.expires=0
            with self.assertRaises(ReviewRefused):engine.cleanup(run['runId'],review)
            self.assertEqual(store.path(run['runId']).read_bytes(),before);self.assertTrue((home/'owned').exists())
            review=ReviewAuthority('fixture').approve(cleanup_binding(run,preview(run)),'cleanup')
            result=engine.cleanup(run['runId'],review)
            self.assertEqual((result['removed'],result['retained'],result['alreadyAbsent']),(1,0,1))
            self.assertEqual(store.load(run['runId'])['cleanup']['state'],'verified')
            saved=store.load(run['runId']);self.assertEqual(saved['reports'][owner]['tiers'][0]['state'],'unverified')
            self.assertEqual(saved['preCleanupReports'][owner]['tiers'][0]['state'],'verified')
            self.assertEqual(engine.connections(run['runId']),{'candidates':[]})

    def test_changed_review_symlink_and_service_owners_are_preserved(self):
        from setup_cleanup import preview,apply_cleanup,cleanup_binding
        from setup_engine import ReviewAuthority,ReviewRefused
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();home=root/'claw';home.mkdir(mode=0o700)
            run={'runId':'run-fixture','planHash':'a'*64,'plan':{'claws':[{'id':'one','runtimeHome':str(home)}]},'effects':[]}
            guarded_write(home/'.netclaw-setup-owner.json',canonical({'schema':1,'runId':run['runId'],'planHash':run['planHash'],'installationId':'one'}))
            guarded_write(home/'file',b'owned');row={'path':str(home/'file'),'owner':'one','class':'file','sha256':revision(home/'file'),'existedBefore':False,'referencedBy':['one']};run['effects']=[{'artifacts':[row]}]
            review=ReviewAuthority('fixture').approve(cleanup_binding(run,preview(run)),'cleanup')
            guarded_write(home/'file',b'changed')
            with self.assertRaises(ReviewRefused):apply_cleanup(run,review)
            (home/'file').unlink();(home/'file').symlink_to(root/'neighbor')
            self.assertEqual(preview(run)['items'][0]['action'],'retain')
            (home/'file').unlink();guarded_write(home/'file',b'owned');guarded_write(home/'.setup/services.json',b'{}')
            self.assertEqual(preview(run)['items'][0]['reason'],'service_ownership_requires_reconciliation')

if __name__=='__main__':unittest.main()
