"""Bounded, durable receiver inbox. One receiver process owns this SQLite queue.

A dispatch checkpoint survives restarts; an uncertain hook response is observed
through the case instead of blindly starting another model run.
"""
import json
import sqlite3
import time
import uuid
from pathlib import Path

class JobStore:
    def __init__(self, path, capacity=1000):
        Path(path).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(path)
        Path(path).chmod(0o600)
        self.db.row_factory = sqlite3.Row
        self.capacity = capacity
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('''CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY, key TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
            created REAL NOT NULL, available REAL NOT NULL, dispatched REAL,
            event_id TEXT, site TEXT, error TEXT)''')
        self.db.execute("UPDATE jobs SET state='queued' WHERE state='running'")
        self.db.commit()

    def enqueue(self, key, kind, payload, repeat=False):
        with self.db:
            self.db.execute("DELETE FROM jobs WHERE state IN ('done','failed') AND created < ?", (time.time()-30*86400,))
            previous = self.db.execute("SELECT id FROM jobs WHERE key=?" +
                (" AND state IN ('queued','running')" if repeat else "") + " ORDER BY created DESC LIMIT 1", (key,)).fetchone()
            if previous: return previous['id']
            if self.db.execute("SELECT count(*) FROM jobs WHERE state IN ('queued','running')").fetchone()[0] >= self.capacity:
                raise OverflowError('Investigation inbox full')
            jid = str(uuid.uuid4())
            self.db.execute("INSERT INTO jobs(id,key,kind,payload,created,available) VALUES(?,?,?,?,?,?)",
                            (jid,key,kind,json.dumps(payload),time.time(),time.time()))
            return jid

    def claim(self, lane='investigation'):
        kinds = {
            'ingest': "kind IN ('alert','resolved')",
            'maintenance': "kind = 'snapshot'",
            'investigation': "kind IN ('investigate','manual')",
        }[lane]
        with self.db:
            r = self.db.execute(f"SELECT * FROM jobs WHERE state='queued' AND available<=? AND {kinds} ORDER BY created LIMIT 1", (time.time(),)).fetchone()
            if not r: return None
            self.db.execute("UPDATE jobs SET state='running', attempts=attempts+1 WHERE id=?", (r['id'],))
            return dict(self.db.execute('SELECT * FROM jobs WHERE id=?',(r['id'],)).fetchone())

    def checkpoint(self, jid, event_id, site, hourly_budget=None):
        with self.db:
            existing = self.db.execute('SELECT dispatched FROM jobs WHERE id=?', (jid,)).fetchone()
            if existing and not existing['dispatched'] and hourly_budget is not None and self.hourly_dispatches() >= hourly_budget:
                raise OverflowError('Hourly investigation budget exhausted')
            self.db.execute('UPDATE jobs SET event_id=?,site=?,dispatched=COALESCE(dispatched,?) WHERE id=?', (event_id,site,time.time(),jid))

    def promote(self, jid):
        """Hand a recorded alert to model workers without consuming extra capacity."""
        with self.db:
            self.db.execute("UPDATE jobs SET kind='investigate',state='queued',attempts=0 WHERE id=?", (jid,))

    def finish(self, jid, error=None):
        with self.db:
            self.db.execute('UPDATE jobs SET state=?,error=? WHERE id=?', ('failed' if error else 'done',error,jid))

    def retry(self, job, error):
        if job['attempts'] >= 3:
            self.finish(job['id'], str(error)); return
        with self.db:
            self.db.execute("UPDATE jobs SET state='queued',available=?,error=? WHERE id=?", (time.time()+15*job['attempts'], str(error), job['id']))

    def hourly_dispatches(self):
        return self.db.execute('SELECT count(*) FROM jobs WHERE dispatched>?',(time.time()-3600,)).fetchone()[0]

    def counts(self):
        return {r[0]:r[1] for r in self.db.execute('SELECT state,count(*) FROM jobs GROUP BY state')}
