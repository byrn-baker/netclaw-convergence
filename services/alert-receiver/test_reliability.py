import asyncio
import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock
import pytest
import httpx
sys.path.insert(0, str(Path(__file__).parent))
from jobs import JobStore
import server as receiver


def test_queue_survives_restart_and_resumes_dispatch(tmp_path):
    path=tmp_path/'jobs.db'
    store=JobStore(path)
    jid=store.enqueue('incident', 'investigate', {'labels':{}})
    assert store.enqueue('incident', 'investigate', {}) == jid
    job=store.claim()
    store.checkpoint(jid, 'case-id', 'home')
    store.db.close()
    recovered=JobStore(path)
    job=recovered.claim()
    assert job['event_id']=='case-id' and job['dispatched']
    assert recovered.hourly_dispatches()==1
    recovered.finish(jid)
    assert recovered.claim() is None


def test_bounded_queue_retains_existing_work(tmp_path):
    store=JobStore(tmp_path/'jobs.db', capacity=1)
    jid=store.enqueue('one', 'alert', {})
    with pytest.raises(OverflowError): store.enqueue('two','alert',{})
    assert store.enqueue('one','alert',{})==jid


def test_ingest_and_recovery_do_not_wait_for_model_jobs(tmp_path):
    store = JobStore(tmp_path/'jobs.db', capacity=3)
    store.enqueue('busy', 'manual', {})
    busy = store.claim()
    jid = store.enqueue('new', 'alert', {})
    assert store.claim('ingest')['id'] == jid
    store.promote(jid)
    assert store.claim()['id'] == jid
    clear = store.enqueue('clear', 'resolved', {})
    assert store.claim('ingest')['id'] == clear
    assert store.counts() == {'running': 3}


def test_dispatch_checkpoint_enforces_shared_hourly_budget(tmp_path):
    store = JobStore(tmp_path/'jobs.db')
    a = store.enqueue('automatic', 'investigate', {})
    b = store.enqueue('manual', 'manual', {})
    store.checkpoint(a, 'first-case', 'home', hourly_budget=1)
    with pytest.raises(OverflowError, match='budget exhausted'):
        store.checkpoint(b, 'second-case', 'home', hourly_budget=1)
    assert store.hourly_dispatches() == 1
    # Recovery of an already dispatched job does not spend another slot.
    store.checkpoint(a, 'first-case', 'home', hourly_budget=1)


def test_case_failure_keeps_alert_retryable(monkeypatch):
    import investigation_policy as policy
    monkeypatch.setattr(policy, 'resolve_tier', lambda a: policy.TierDecision('T0','test'))
    monkeypatch.setattr(receiver, 'post_guardian_event', AsyncMock(return_value=None))
    alert = receiver.Alert(status='firing', labels=receiver.AlertLabel(alertname='Test'), annotations=receiver.AlertAnnotation())
    with pytest.raises(RuntimeError, match='persist alert case'):
        asyncio.run(receiver.process_alert(alert))


def test_recovery_matches_episode_even_after_investigation_completed(monkeypatch):
    monkeypatch.setattr(receiver, 'NETWORK_GUARDIAN_URL', 'http://cases')
    monkeypatch.setattr(receiver, 'NETWORK_GUARDIAN_TOKEN', 'test')
    seen = {}
    class Client:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, **kwargs):
            seen.update(kwargs['params'])
            return httpx.Response(200, request=httpx.Request('GET', url), json={'events': [
                {'id':'wrong', 'alert_fingerprint':'fp', 'incident_key':'fp:older', 'status':'investigating'},
                {'id':'correct', 'alert_fingerprint':'fp', 'incident_key':'fp:start', 'status':'escalated'},
            ]})
    monkeypatch.setattr(receiver.httpx, 'AsyncClient', Client)
    assert asyncio.run(receiver.find_open_guardian_event('fp', 'home', starts_at='start')) == 'correct'
    assert seen['incident_key'] == 'fp:start'


def test_corrected_evidence_replaces_searchable_snapshot(monkeypatch):
    from types import SimpleNamespace
    registry = SimpleNamespace(set_status=lambda doc, status: superseded.append((doc,status)))
    superseded, snapshots, patches = [], [], []
    def snapshot(**kwargs):
        snapshots.append(kwargs)
        return {'success': True, 'data': {'snapshot_id':'new', 'collection':'snapshot_new'}}
    monkeypatch.setitem(sys.modules, 'rag_mcp_server', SimpleNamespace(registry=registry, _do_snapshot=snapshot))
    class Client:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def patch(self, url, **kwargs):
            patches.append(kwargs['json'])
            return httpx.Response(200)
    monkeypatch.setattr(receiver.httpx, 'AsyncClient', Client)
    event = {'id':'case', 'status':'resolved', 'root_cause':'Original conclusion',
             'expert_feedback':'Correction supported by packet capture', 'rag_document_id':'old', 'rag_content_hash':'oldhash'}
    result = asyncio.run(receiver._snapshot_event_to_rag(event, 'home'))
    assert result['status'] == 'success'
    assert ('old','superseded') in superseded
    assert event['expert_feedback'] in snapshots[0]['content']
    assert patches[0]['rag_content_hash'] != 'oldhash'
    event.update(patches[0])
    assert asyncio.run(receiver._snapshot_event_to_rag(event, 'home'))['status'] == 'skipped'
    assert len(snapshots) == 1


def test_receiver_auth_and_durable_acceptance(tmp_path, monkeypatch):
    monkeypatch.setattr(receiver,'RECEIVER_TOKEN','test-secret')
    monkeypatch.setattr(receiver,'job_store',JobStore(tmp_path/'jobs.db'))
    async def check():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=receiver.app),base_url='http://test') as client:
            body={'alerts':[{'status':'firing','labels':{'alertname':'WanHardDown'},'annotations':{},'fingerprint':'test','startsAt':'2026-01-01'}]}
            assert (await client.post('/webhook',json=body)).status_code==401
            assert (await client.post('/reinvestigate',json={})).status_code==401
            reply=await client.post('/webhook',json=body,headers={'Authorization':'Bearer test-secret'})
            assert reply.status_code==200
            assert receiver.job_store.counts()=={'queued':1}
    asyncio.run(check())


def test_site_alert_is_recorded_without_device(monkeypatch):
    import investigation_policy as policy
    monkeypatch.setattr(policy,'resolve_tier',lambda a: policy.TierDecision('T0','test'))
    post=AsyncMock(return_value='case');monkeypatch.setattr(receiver,'post_guardian_event',post)
    monkeypatch.setattr(receiver,'post_discord',AsyncMock())
    alert=receiver.Alert(status='firing',labels=receiver.AlertLabel(alertname='WanHardDown',site='home'),annotations=receiver.AlertAnnotation())
    asyncio.run(receiver.process_alert(alert))
    assert post.await_count==1 and post.call_args.args[1]['role']=='site'


def test_concurrent_duplicate_admission(monkeypatch):
    monkeypatch.setattr(receiver,'_investigation_sem',None)
    monkeypatch.setattr(receiver,'_investigation_gate_lock',None)
    monkeypatch.setattr(receiver,'_investigation_recent',[])
    monkeypatch.setattr(receiver,'_investigation_dedup',{})
    async def check():
        results=await asyncio.gather(receiver.admit_investigation('same'),receiver.admit_investigation('same'))
        assert sum(ok for ok,_ in results)==1
    asyncio.run(check())


def test_hook_acceptance_waits_for_case(monkeypatch):
    monkeypatch.setattr(receiver,'OPENCLAW_GATEWAY_URL','http://gateway')
    monkeypatch.setattr(receiver,'OPENCLAW_HOOK_TOKEN','test')
    monkeypatch.setattr(receiver,'DISCORD_WEBHOOK_URL','')
    monkeypatch.setattr(receiver,'job_store',None)
    monkeypatch.setattr(receiver,'post_guardian_event',AsyncMock(return_value='case'))
    monkeypatch.setattr(receiver,'patch_guardian_event',AsyncMock(return_value=True))
    monkeypatch.setattr(receiver,'build_investigation_prompt',lambda *a,**kw:'test')
    wait=AsyncMock();monkeypatch.setattr(receiver,'wait_for_case',wait)
    class Client:
        def __init__(self,**kw):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,*args,**kwargs):return httpx.Response(202)
    monkeypatch.setattr(receiver.httpx,'AsyncClient',Client)
    alert=receiver.Alert(status='firing',labels=receiver.AlertLabel(alertname='Test'),annotations=receiver.AlertAnnotation())
    asyncio.run(receiver.trigger_netclaw(alert,{'name':'site:home','site':'home','ip':'','role':'site','platform':'site'}))
    assert wait.await_count==1 and wait.call_args.args[:2]==('case','home')
