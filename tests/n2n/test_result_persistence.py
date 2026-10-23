import asyncio
import json
from pathlib import Path
import pytest
from bgp.federation.audit import Auditor
from bgp.federation.tasks import TaskManager


def test_duplicate_request_ids_preserve_distinct_results(manager):
    audit = Auditor(manager)
    first = audit.store_result('peer-chosen-id', {'output_text':'original'})
    second = audit.store_result('peer-chosen-id', {'output_text':'later'})
    assert first != second
    assert json.loads(Path(first).read_text())['output_text'] == 'original'
    assert json.loads(Path(second).read_text())['output_text'] == 'later'
    assert Path(first).stat().st_mode & 0o777 == 0o600


def test_failed_storage_never_returns_reference(manager, tmp_path):
    audit = Auditor(manager)
    bad = tmp_path/'not-a-directory'
    bad.write_text('sentinel')
    audit.results_dir = bad
    with pytest.raises(OSError): audit.store_result('id', {'output_text':'fixture'})
    assert bad.read_text() == 'sentinel'


def test_task_reaches_failed_state_even_if_error_storage_fails(manager, monkeypatch):
    audit = Auditor(manager)
    tm = TaskManager(manager, audit)
    task = tm.create(direction='inbound', peer_identity='fixture', target_type='skill', target_name='fixture')
    def fail(*args): raise OSError('fixture storage failure')
    monkeypatch.setattr(audit, 'store_result', fail)
    async def run():
        async def worker(progress): return 'completed work', 0
        await asyncio.gather(tm.run(task,worker),return_exceptions=True)
    asyncio.run(run())
    assert tm.status(task)['state'] == 'failed'


def test_legacy_reference_remains_readable_and_missing_payload_is_visible(manager):
    audit = Auditor(manager)
    tm = TaskManager(manager, audit)
    task = tm.create(direction='inbound', peer_identity='fixture', target_type='skill', target_name='fixture')
    legacy = audit.results_dir/'legacy-request.json'
    legacy.write_text('{"output_text":"legacy result"}')
    tm._set(task, state='completed', result_ref=str(legacy))
    assert tm.result(task)['output_text'] == 'legacy result'
    legacy.unlink()
    result = tm.result(task)
    assert result['state'] == 'completed'
    assert result['result_available'] is False and result['error']
