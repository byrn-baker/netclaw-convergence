"""Durable EVE inbox and independent log/case delivery checkpoints."""
import hashlib
import ipaddress
import json
from pathlib import Path
import sqlite3
import threading
import time
from datetime import datetime, timezone


def stamp(value):
    try:
        date = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return date.timestamp() if date.tzinfo else 0
    except (ValueError, TypeError, OverflowError):
        return 0


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def case_payload(sensor, event):
    """Correlate a signature/host pair per five-minute window, independent of LLMs."""
    alert = event['alert']
    window = int(stamp(event['timestamp']) // 300) * 300
    identity = [sensor['site'], sensor['id'], alert['signature_id'], event.get('src_ip'),
                event.get('dest_ip'), event.get('vlan', []), window]
    fingerprint = hashlib.sha256(canonical(identity).encode()).hexdigest()
    canary = alert['signature_id'] == 9000001
    source = event.get('src_ip', '')
    destination = event.get('dest_ip', '')
    # Endpoint strings are validated by the ingest boundary. Packet content is
    # evidence, never an instruction or a source of authentication/site scope.
    summary = f"{str(alert.get('signature', 'IDS signature'))[:240]} — {source} → {destination}"
    details = {k: event[k] for k in ('timestamp', 'src_ip', 'src_port', 'dest_ip',
        'dest_port', 'proto', 'vlan', 'flow_id', 'app_proto', 'alert') if k in event}
    return {'version': '4', 'status': 'firing', 'receiver': 'suricata', 'alerts': [{
        'status': 'firing', 'fingerprint': fingerprint,
        'startsAt': datetime.fromtimestamp(window, timezone.utc).isoformat(),
        'labels': {'alertname': 'SuricataCanary' if canary else 'SuricataIntrusion',
            'site': sensor['site'], 'sensor_id': sensor['id'],
            'signature_id': str(alert['signature_id']), 'source': 'suricata',
            'severity': 'info' if canary or alert.get('severity', 3) >= 3 else 'warning',
            'suricata_severity': str(alert.get('severity', 3)),
            'investigate': str(bool(sensor.get('auto_investigate')) and not canary).lower()},
        'annotations': {'summary': summary,
            'description': 'Passive IDS observation; not proof of compromise. ' + canonical(details)[:12000]},
    }]}


def validate_event(event, now):
    if not isinstance(event, dict) or event.get('event_type') not in ('alert', 'stats', 'flow', 'dns', 'tls'):
        raise ValueError('Unsupported EVE event type')
    ts = stamp(event.get('timestamp'))
    if ts <= 0 or ts > now + 300:
        raise ValueError('EVE timestamp missing, invalid or more than five minutes ahead')
    if len(canonical(event).encode()) > 262144:
        raise ValueError('EVE event exceeds 256 KiB')
    for field in ('src_ip', 'dest_ip'):
        if field in event:
            ipaddress.ip_address(event[field])
    vlans = event.get('vlan', [])
    if not isinstance(vlans, list) or len(vlans) > 3 or any(type(v) is not int or not 0 <= v <= 4094 for v in vlans):
        raise ValueError('Invalid VLAN metadata')
    if event['event_type'] == 'alert':
        alert = event.get('alert')
        if not isinstance(alert, dict) or type(alert.get('signature_id')) is not int:
            raise ValueError('Alert signature_id required')
        if type(alert.get('severity', 3)) is not int or not 1 <= alert.get('severity', 3) <= 255:
            raise ValueError('Alert severity must be a positive integer priority')
    if event['event_type'] == 'stats' and not isinstance(event.get('stats'), dict):
        raise ValueError('Stats object required')


class Store:
    def __init__(self, path, capacity=250000):
        Path(path).parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(path, check_same_thread=False)
        Path(path).chmod(0o600)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        self.capacity = capacity
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS eve (
            id TEXT PRIMARY KEY, sensor TEXT NOT NULL, site TEXT NOT NULL,
            kind TEXT NOT NULL, observed REAL NOT NULL, received_ns INTEGER NOT NULL,
            payload TEXT NOT NULL, case_payload TEXT,
            log_done INTEGER NOT NULL DEFAULT 0, case_done INTEGER NOT NULL DEFAULT 0);
          CREATE INDEX IF NOT EXISTS eve_log_pending ON eve(log_done, received_ns);
          CREATE INDEX IF NOT EXISTS eve_case_pending ON eve(case_done, received_ns);
          CREATE INDEX IF NOT EXISTS eve_observed ON eve(site, kind, observed);
          CREATE TABLE IF NOT EXISTS sensors (
            id TEXT PRIMARY KEY, seen REAL NOT NULL, heartbeat TEXT NOT NULL,
            stats_time REAL NOT NULL DEFAULT 0, packets INTEGER NOT NULL DEFAULT 0,
            drops INTEGER NOT NULL DEFAULT 0, drop_delta INTEGER NOT NULL DEFAULT 0,
            last_packet REAL NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS coverage (
            sensor TEXT NOT NULL, vlan INTEGER NOT NULL, observed REAL NOT NULL,
            PRIMARY KEY(sensor, vlan));
        ''')
        columns = {r[1] for r in self.db.execute('PRAGMA table_info(sensors)')}
        for name in ('decoder_errors', 'decoder_delta', 'packet_delta'):
            if name not in columns:
                self.db.execute(f'ALTER TABLE sensors ADD COLUMN {name} INTEGER NOT NULL DEFAULT 0')
        self.db.commit()

    def accept(self, sensor, events, heartbeat, now=None):
        now = time.time() if now is None else now
        for event in events:
            validate_event(event, now)
        with self.lock, self.db:
            pending = self.db.execute('SELECT count(*) FROM eve WHERE log_done=0 OR case_done=0').fetchone()[0]
            rows, batch_ids = [], set()
            for i, event in enumerate(events):
                payload = canonical(event)
                identity = hashlib.sha256((sensor['id'] + '\0' + payload).encode()).hexdigest()
                if identity in batch_ids or self.db.execute('SELECT 1 FROM eve WHERE id=?', (identity,)).fetchone():
                    continue
                batch_ids.add(identity)
                case = case_payload(sensor, event) if event['event_type'] == 'alert' else None
                rows.append((identity, sensor['id'], sensor['site'], event['event_type'],
                    stamp(event['timestamp']), int(now * 1e9) + i, payload, canonical(case) if case else None,
                    0 if case else 1))
            if pending + len(rows) > self.capacity:
                raise OverflowError('IDS inbox full; sensor must retain and retry its batch')
            self.db.executemany('INSERT OR IGNORE INTO eve(id,sensor,site,kind,observed,received_ns,payload,case_payload,case_done) VALUES(?,?,?,?,?,?,?,?,?)', rows)
            self.db.execute('INSERT INTO sensors(id,seen,heartbeat) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen,heartbeat=excluded.heartbeat',
                            (sensor['id'], now, canonical(heartbeat)))
            for event in events:
                ts = stamp(event['timestamp'])
                for vlan in event.get('vlan', []):
                    self.db.execute('INSERT INTO coverage VALUES(?,?,?) ON CONFLICT(sensor,vlan) DO UPDATE SET observed=max(observed,excluded.observed)', (sensor['id'], vlan, ts))
                if event['event_type'] == 'stats':
                    old = self.db.execute('SELECT * FROM sensors WHERE id=?', (sensor['id'],)).fetchone()
                    if ts <= old['stats_time']:
                        continue
                    capture = event['stats'].get('capture', {})
                    packets = int(capture.get('kernel_packets', 0))
                    drops = int(capture.get('kernel_drops', 0))
                    # A restarted capture process resets its cumulative counters.
                    reset = packets < old['packets']
                    delta = drops if reset else max(0, drops - old['drops'])
                    packet_delta = packets if reset else max(0, packets-old['packets'])
                    decoder = event['stats'].get('decoder', {})
                    errors = sum(int(decoder.get(k, 0)) for k in ('invalid', 'too_many_layers', 'unknown_ethertype'))
                    error_delta = errors if reset else max(0, errors-old['decoder_errors'])
                    last_packet = ts if packets > (0 if reset else old['packets']) else old['last_packet']
                    self.db.execute('UPDATE sensors SET stats_time=?,packets=?,drops=?,drop_delta=?,last_packet=?,decoder_errors=?,decoder_delta=?,packet_delta=? WHERE id=?',
                        (ts, packets, drops, delta, last_packet, errors, error_delta, packet_delta, sensor['id']))
            return len(rows)

    def pending(self, target, limit=128):
        column = {'log': 'log_done', 'case': 'case_done'}[target]
        with self.lock:
            return [dict(r) for r in self.db.execute(f'SELECT * FROM eve WHERE {column}=0 ORDER BY received_ns LIMIT ?', (limit,))]

    def acknowledge(self, target, ids):
        column = {'log': 'log_done', 'case': 'case_done'}[target]
        with self.lock, self.db:
            self.db.executemany(f'UPDATE eve SET {column}=1 WHERE id=?', [(i,) for i in ids])

    def prune(self, now=None):
        now = time.time() if now is None else now
        with self.lock, self.db:
            # Never expire an undelivered row. Upstream outage becomes explicit backpressure.
            self.db.execute("DELETE FROM eve WHERE log_done=1 AND case_done=1 AND received_ns < ? AND (kind!='alert' OR received_ns < ?)",
                            (int((now-86400)*1e9), int((now-30*86400)*1e9)))

    def status(self, configured, site, now=None):
        now = time.time() if now is None else now
        sensors = []
        with self.lock:
            for cfg in configured:
                if cfg['site'] != site:
                    continue
                row = self.db.execute('SELECT * FROM sensors WHERE id=?', (cfg['id'],)).fetchone()
                state, reason = 'unknown', 'No heartbeat received'
                heartbeat = json.loads(row['heartbeat']) if row else {}
                if row:
                    if now-row['seen'] > 120:
                        state, reason = 'stale', 'Sensor heartbeat is stale'
                    elif not heartbeat.get('capture_running') or now-row['stats_time'] > 120:
                        state, reason = 'degraded', 'Capture stopped or recent capture statistics missing'
                    elif not heartbeat.get('rules_count') or now-heartbeat.get('rules_checked_at', 0) > 3*86400:
                        state, reason = 'degraded', 'Detection rules missing or update check overdue'
                    elif heartbeat.get('disk_free_bytes', 0) < 512*1024*1024:
                        state, reason = 'degraded', 'Sensor disk reserve below 512 MiB'
                    elif now-row['last_packet'] > 300:
                        state, reason = 'unknown', 'No recent packets; mirror visibility is unverified'
                    elif row['drop_delta'] > 0:
                        state, reason = 'degraded', 'Capture reported packet drops in its latest interval'
                    elif row['decoder_delta'] > max(100, row['packet_delta']*0.01):
                        state, reason = 'degraded', 'High decoder-error rate; inspect mirror integrity and malformed traffic'
                    else:
                        state, reason = 'active', 'Recent mirrored packets, capture statistics and rule checks'
                pending = self.db.execute('SELECT count(*) FROM eve WHERE sensor=? AND (log_done=0 OR case_done=0)', (cfg['id'],)).fetchone()[0]
                oldest = self.db.execute('SELECT min(received_ns) FROM eve WHERE sensor=? AND (log_done=0 OR case_done=0)', (cfg['id'],)).fetchone()[0]
                if oldest and now-oldest/1e9 > 120 and state == 'active':
                    state, reason = 'degraded', 'Log or case delivery backlog exceeds two minutes'
                coverage = {r['vlan']: r['observed'] for r in self.db.execute('SELECT * FROM coverage WHERE sensor=?', (cfg['id'],))}
                sensors.append({'id': cfg['id'], 'status': state, 'reason': reason,
                    'lastSeen': row['seen'] if row else None, 'packets': row['packets'] if row else None,
                    'captureDrops': row['drops'] if row else None, 'pendingEvents': pending,
                    'decoderErrors': row['decoder_errors'] if row else None,
                    'rulesCount': heartbeat.get('rules_count'), 'rulesCheckedAt': heartbeat.get('rules_checked_at'),
                    'coverage': [{'vlan': v, 'lastObserved': coverage.get(v),
                        'status': 'observed' if now-coverage.get(v, 0) < 900 else 'unverified'} for v in cfg['vlans']],
                    'scope': cfg.get('scope', 'Configured mirror sources only'),
                    'autoInvestigate': bool(cfg.get('auto_investigate'))})
            alerts = self.db.execute("SELECT count(*) FROM eve WHERE site=? AND kind='alert' AND observed>?", (site, now-86400)).fetchone()[0]
        overall = 'not_configured' if not sensors else ('active' if all(s['status']=='active' for s in sensors) else 'degraded')
        return {'status': overall, 'reason': 'No IDS sensors configured for this site' if not sensors else
            'Passive IDS; coverage applies only to traffic reaching the configured mirror sources.',
            'alertsLast24h': alerts if sensors else None, 'sensors': sensors}
