"""Exercise real local GAIT persistence and bounded telemetry admission."""
import importlib.util
from pathlib import Path
import threading

import pytest
from gait.repo import GaitRepo

ROOT = Path(__file__).resolve().parents[2]


def logger_class(name):
    path = ROOT / f'mcp-servers/{name}-mcp/gait_logger.py'
    spec = importlib.util.spec_from_file_location(f'audit_{name}', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.GAITLogger


@pytest.mark.parametrize('name', ['syslog', 'snmptrap', 'ipfix'])
def test_actual_sdk_persistence(name, tmp_path):
    log = logger_class(name)(name, audit_root=tmp_path)
    for i in range(80):
        assert log.log_event('fixture', '127.0.0.1', {'sequence': i})
    stats = log.close()
    assert stats['persisted_count'] == 80
    assert stats['pending_count'] == stats['error_count'] == 0
    assert stats['last_commit'] == GaitRepo(tmp_path / name).head_commit_id()
    assert (tmp_path / name).stat().st_mode & 0o777 == 0o700
    assert not log.log_event('late', '127.0.0.1', {})
    assert log.get_stats() == stats


@pytest.mark.parametrize('name', ['syslog', 'snmptrap', 'ipfix'])
def test_overload_failure_and_close_status(name, tmp_path, monkeypatch, caplog):
    log = logger_class(name)(name, audit_root=tmp_path, queue_size=2)
    entered, release = threading.Event(), threading.Event()
    def failed(records):
        entered.set()
        assert release.wait(3)
        raise OSError('private-fixture-secret')
    monkeypatch.setattr(log, '_persist', failed)
    assert log.log_event('fixture', '127.0.0.1', {})
    assert entered.wait(2)
    assert log.log_event('fixture', '127.0.0.1', {})
    assert log.log_event('fixture', '127.0.0.1', {})
    assert not log.log_event('overflow', '127.0.0.1', {})
    stats = log.close(timeout=0)
    assert stats['pending_count'] == 3
    assert stats['persisted_count'] == 0
    release.set()
    stats = log.close()
    assert stats['error_count'] == 4
    assert stats['pending_count'] == stats['persisted_count'] == 0
    assert stats['last_error'] == 'OSError'
    assert 'private-fixture-secret' not in caplog.text


def test_rejects_unsupported_endpoint_large_event_and_symlink(tmp_path):
    cls = logger_class('syslog')
    with pytest.raises(ValueError):
        cls('syslog', gait_endpoint='https://example.invalid')
    log = cls('syslog', audit_root=tmp_path)
    assert not log.log_event('oversized', '127.0.0.1', {'payload':'x' * 16384})
    assert log.close()['error_count'] == 1
    target = tmp_path / 'target'; target.mkdir()
    (tmp_path / 'linked').symlink_to(target, target_is_directory=True)
    log = cls('linked', audit_root=tmp_path)
    assert log.log_event('fixture', '127.0.0.1', {})
    assert log.close()['last_error'] == 'PermissionError'
    assert not list(target.iterdir())


def test_two_writers_share_history_without_losing_events(tmp_path):
    import json
    cls = logger_class('syslog')
    writers = [cls('shared', audit_root=tmp_path) for _ in range(2)]
    for i in range(80):
        assert writers[i % 2].log_event('fixture', '127.0.0.1', {'id': i})
    for log in writers:
        assert log.close()['persisted_count'] == 40
    turns = GaitRepo(tmp_path / 'shared').iter_turns_from_head(limit_turns=100)
    records = []
    for turn in turns:
        records.extend(json.loads(turn['assistant']['text']))
    assert sorted(record['data']['id'] for record in records) == list(range(80))
