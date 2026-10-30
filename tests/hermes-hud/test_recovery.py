from pathlib import Path
import json
import sys
import tempfile
import unittest
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'mcp-servers/hermes-hud-mcp'))
from bridge import Bridge
from ledger import HudError
class RecoveryTests(unittest.TestCase):
    def test_reviewed_release_survives_failed_session_setup_without_execution(self):
        with tempfile.TemporaryDirectory() as tmp:
            calls=[]
            def transport(request):
                calls.append(request.url.path)
                if len(calls)==1:raise httpx.ConnectError('session setup failed')
                return httpx.Response(200,json={'session':{'id':'native'}})
            bridge=Bridge(tmp,'i',key='k'*32,client=httpx.Client(base_url='http://127.0.0.1',transport=httpx.MockTransport(transport)))
            bridge.ledger.open('old');bridge.ledger.admit('old','r','n','operation',1000);bridge.ledger.update('old','r','unknown')
            with self.assertRaises(HudError):bridge.open('fresh',acknowledgment='r',release_capacity=True)
            self.assertTrue(bridge.request_status('old','r')['capacityReleased'])
            bridge.open('fresh',acknowledgment='r',release_capacity=True)
            self.assertEqual(calls,['/api/sessions','/api/sessions'])
            with bridge.ledger.db() as db:self.assertEqual(db.execute('SELECT count(*) FROM capacity_releases').fetchone()[0],1)
    def test_four_lost_admissions_review_restart_and_new_capacity_without_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            posts=[]
            def transport(request):
                if request.url.path=='/api/sessions':return httpx.Response(200,json={'session':{'id':'new-native'}})
                if request.method=='POST':
                    posts.append(request.headers['Idempotency-Key'])
                    if len(posts)<=4:raise httpx.ReadTimeout('lost admission')
                    return httpx.Response(200,json={'id':'new-run'})
                raise AssertionError('Unexpected native observation')
            client=httpx.Client(base_url='http://127.0.0.1',transport=httpx.MockTransport(transport))
            bridge=Bridge(tmp,'i',key='k'*32,client=client)
            for n in range(4):
                bridge.ledger.open(f'c{n}');bridge.ledger.bind(f'c{n}',f'native{n}')
                self.assertEqual(bridge.submit(f'c{n}',f'r{n}',f'n{n}','operation')['state'],'unknown')
            bridge.open('fresh',acknowledgment='r3')
            with self.assertRaises(HudError):bridge.submit('fresh','blocked','blocked','new operation')
            bridge.open('reviewed',acknowledgment='r3',release_capacity=True)
            restarted=Bridge(tmp,'i',key='k'*32,client=client)
            restarted.open('reviewed',acknowledgment='r3',release_capacity=True)
            released=restarted.request_status('c3','r3')
            self.assertEqual(released['state'],'unknown');self.assertTrue(released['mayHaveExecuted'])
            self.assertTrue(released['capacityReleased']);self.assertFalse(released['capacityReleaseEligible'])
            for n in range(4):self.assertEqual(restarted.submit(f'c{n}',f'r{n}',f'n{n}','operation')['state'],'unknown')
            with self.assertRaises(HudError):restarted.submit('c3','different','different','new operation')
            self.assertEqual(restarted.submit('reviewed','new','new','new operation')['state'],'queued')
            restarted.open('sixth')
            with self.assertRaises(HudError):restarted.submit('sixth','sixth','sixth','too many')
            self.assertEqual(posts,['r0','r1','r2','r3','new'])
            federation=Bridge(tmp,'i',namespace='federation',key='k'*32,client=client)
            with self.assertRaises(HudError):federation.open('f',acknowledgment='r3',release_capacity=True)
            with federation.ledger.db() as db:self.assertEqual(db.execute('SELECT count(*) FROM conversations').fetchone()[0],0)
    def test_setup_retry_retains_seed_in_first_native_run_without_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            seed=[{'role':'user','content':'ancestor question'}, {'role':'assistant','content':'ancestor answer'}]
            calls=[]
            def transport(request):
                calls.append((request.url.path,json.loads(request.content)))
                if request.url.path=='/api/sessions':
                    if len(calls)==1:raise httpx.ConnectError('setup unavailable')
                    return httpx.Response(200,json={'session':{'id':'native'}})
                return httpx.Response(200,json={'id':'run'})
            client=httpx.Client(base_url='http://127.0.0.1',transport=httpx.MockTransport(transport))
            bridge=Bridge(tmp,'i',key='k'*32,client=client)
            with self.assertRaises(HudError):bridge.open('c',seed)
            restarted=Bridge(tmp,'i',key='k'*32,client=client)
            restarted.open('c',seed)
            restarted.submit('c','r','n','follow-up')
            restarted.submit('c','r','n','follow-up')
            runs=[body for path,body in calls if path=='/v1/runs']
            self.assertEqual(len(runs),1)
            self.assertEqual(runs[0]['conversation_history'],seed)
            self.assertEqual(runs[0]['input'],'follow-up')
    def test_lost_post_restart_and_nonce_never_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            posts=[]
            def transport(request):
                if request.method=='POST':posts.append(request);raise httpx.ReadTimeout('lost response')
                return httpx.Response(404,json={})
            client=httpx.Client(base_url='http://127.0.0.1',transport=httpx.MockTransport(transport))
            bridge=Bridge(tmp,'i',key='k'*32,client=client)
            bridge.ledger.open('c');bridge.ledger.bind('c','native')
            self.assertEqual(bridge.submit('c','r','nonce','operation')['state'],'unknown')
            restarted=Bridge(tmp,'i',key='k'*32,client=client)
            self.assertEqual(restarted.submit('c','r','nonce','operation')['state'],'unknown')
            self.assertEqual(restarted.request_status('c','r')['state'],'unknown');self.assertEqual(len(posts),1)
            with self.assertRaises(HudError):restarted.submit('c','other','other','operation')
    def test_late_result_reconciles_without_post_and_stop_is_not_cancellation(self):
        with tempfile.TemporaryDirectory() as tmp:
            calls=[];state=['running']
            def transport(request):
                calls.append(request.method)
                return httpx.Response(200,json={'status':state[0],'output':'finished'})
            bridge=Bridge(tmp,'i',key='k'*32,client=httpx.Client(base_url='http://127.0.0.1',transport=httpx.MockTransport(transport)))
            bridge.ledger.open('c');bridge.ledger.bind('c','native');bridge.ledger.admit('c','r','n','operation',10000)
            bridge.ledger.update('c','r','unknown',run_id='run')
            self.assertEqual(bridge.request_status('c','r')['state'],'running')
            self.assertEqual(bridge.stop('c','r')['state'],'stopping')
            state[0]='completed';self.assertEqual(bridge.request_status('c','r')['state'],'completed')
            self.assertEqual(calls,['GET','POST','GET'])
    def test_failed_persistence_never_posts_and_approval_is_exact(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            calls=[]
            def transport(request):
                calls.append(request.method)
                return httpx.Response(200,json={'status':'awaiting_approval','approval':{'id':'pending'}})
            bridge=Bridge(tmp,'i',key='k'*32,client=httpx.Client(base_url='http://127.0.0.1',transport=httpx.MockTransport(transport)))
            bridge.ledger.open('c');bridge.ledger.bind('c','native')
            with patch.object(bridge.ledger,'admit',side_effect=OSError('disk full')):
                with self.assertRaises(OSError):bridge.submit('c','r','n','operation')
            self.assertEqual(calls,[])
            bridge.ledger.admit('c','r','n','operation',60000);bridge.ledger.update('c','r','running',run_id='run')
            for choice in ('always','session'):
                with self.assertRaises(HudError):bridge.approval('c','r','pending',choice)
            with self.assertRaises(HudError):bridge.approval('c','r','stale','once')
            self.assertNotIn('POST',calls)
            bridge.approval('c','r','pending','deny');self.assertEqual(calls.count('POST'),1)
            bridge.approval('c','r','pending','once');self.assertEqual(calls.count('POST'),2)
if __name__=='__main__':unittest.main()
