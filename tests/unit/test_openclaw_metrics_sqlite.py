"""Token metrics survive OpenClaw's JSONL-to-SQLite migration."""
import importlib.util
import json
from pathlib import Path
import sqlite3

import zstandard

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('token_exporter', ROOT / 'scripts/openclaw-metrics/exporter.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def event(tokens):
    return {'message': {'role': 'assistant', 'provider': 'test', 'model': 'fixture',
                        'usage': {'input': tokens, 'output': 2, 'cost': {'total': .01}}}}


def test_sqlite_usage_includes_compressed_events_without_legacy_duplicates(tmp_path, monkeypatch):
    agents = tmp_path / 'agents'
    agent = agents / 'main'
    (agent / 'agent').mkdir(parents=True)
    (agent / 'sessions').mkdir()
    database = agent / 'agent/openclaw-agent.sqlite'
    db = sqlite3.connect(database)
    db.execute('pragma journal_mode=wal')
    db.execute('create table transcript_events(session_id text, seq integer, event_json text, event_zstd blob)')
    db.execute('insert into transcript_events values (?,?,?,?)', ('one', 0, json.dumps(event(3)), None))
    db.execute('insert into transcript_events values (?,?,?,?)', ('two', 0, None, zstandard.ZstdCompressor().compress(json.dumps(event(5)).encode())))
    db.commit()
    (agent / 'sessions/one.jsonl').write_text(json.dumps(event(3)) + '\n')
    monkeypatch.setattr(exporter, 'AGENTS_DIR', agents)
    try:
        collected = exporter.collect()
        usage = collected['totals'][('main', 'test', 'fixture')]
        assert usage['input'] == 8
        assert usage['calls'] == 2
        assert collected['sessions'] == 2
        db.execute('insert into transcript_events values (?,?,?,?)', ('two', 1, json.dumps(event(7)), None))
        db.commit()
        assert exporter.collect()['totals'][('main', 'test', 'fixture')]['input'] == 15
    finally:
        db.close()


def test_legacy_jsonl_still_counts_without_a_database(tmp_path, monkeypatch):
    agents = tmp_path / 'agents'
    sessions = agents / 'old/sessions'
    sessions.mkdir(parents=True)
    (sessions / 'one.jsonl').write_text(json.dumps(event(4)) + '\n')
    monkeypatch.setattr(exporter, 'AGENTS_DIR', agents)
    assert exporter.collect()['totals'][('old', 'test', 'fixture')]['input'] == 4
