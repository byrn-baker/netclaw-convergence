#!/usr/bin/env python3
"""Ship rotating EVE files over verified HTTPS, advancing cursors only on ACK.

The EVE files are the durable spool. Unacknowledged files are never pruned.
Unexpected/oversized records stop shipping and are reported, never silently lost.
"""
import json
import logging
import os
from pathlib import Path
import sqlite3
import shutil
import ssl
import subprocess
import time
import urllib.request


def heartbeat(root):
    try:
        running = subprocess.check_output(['docker', 'inspect', '--format',
            '{{.State.Running}}', 'netclaw-suricata'], timeout=5, text=True,
            stderr=subprocess.DEVNULL).strip() == 'true'
    except (subprocess.SubprocessError, OSError):
        running = False
    try:
        rules = json.loads((root/'rules-status.json').read_text())
    except (OSError, ValueError):
        rules = {}
    try:
        probe = json.loads((root/'capture-status.json').read_text())
    except (OSError, ValueError):
        probe = {}
    return {'capture_running': running, 'rules_count': rules.get('rules_count', 0),
            'rules_checked_at': rules.get('rules_checked_at', 0),
            'disk_free_bytes': shutil.disk_usage(root).free, 'capture_probe': probe}


def read_batch(path, offset, max_bytes=524288):
    events, consumed = [], offset
    with path.open('rb') as stream:
        stream.seek(offset)
        while len(events) < 128:
            start = stream.tell()
            line = stream.readline(262146)
            if not line or not line.endswith(b'\n'):
                if len(line) > 262144:
                    raise ValueError(f'EVE record exceeds 256 KiB: {path.name}:{start}')
                break  # Suricata is still writing a partial record.
            if start-offset+len(line) > max_bytes and events:
                break
            event = json.loads(line)
            if event.get('event_type') not in ('alert', 'stats', 'flow', 'dns', 'tls'):
                raise ValueError(f'Unexpected event type at {path.name}:{start}; review EVE configuration')
            events.append(event)
            consumed = stream.tell()
    return events, consumed


class EveSpool:
    """Fair live delivery and complete history replay with independent ACKs.

    A new live cursor starts near the newest file's tail. Only the original
    history cursor authorizes pruning, so the skipped prefix remains durable.
    Ingest deduplicates live records when history eventually reaches them.
    """
    def __init__(self, root, state, live_tail_bytes=1048576):
        self.root, self.state = root, state
        self.live_tail_bytes = live_tail_bytes
        self.live_acks = 0
        state.execute('PRAGMA synchronous=FULL')
        for table in ('cursors', 'live_cursors'):
            state.execute(f'CREATE TABLE IF NOT EXISTS {table} (device INTEGER, inode INTEGER, offset INTEGER, PRIMARY KEY(device,inode))')
        state.commit()

    def _batch(self, file, st, offset, channel):
        if st.st_size < offset:
            raise RuntimeError(f'EVE file was truncated: {file.name}; operator recovery required')
        events, consumed = read_batch(file, offset)
        if not events:
            return None
        return {'file': file, 'device': st.st_dev, 'inode': st.st_ino,
                'events': events, 'consumed': consumed, 'channel': channel}

    def _live_batch(self, files):
        for file in reversed(files):
            st = file.stat()
            key = (st.st_dev, st.st_ino)
            cursor = self.state.execute('SELECT offset FROM live_cursors WHERE device=? AND inode=?', key).fetchone()
            if cursor is None:
                if file != files[-1]:
                    continue
                # Align the initial tail to a full record. An unfinished line
                # stays pending; only history owns the prefix before this point.
                offset = max(0, st.st_size-self.live_tail_bytes)
                if offset:
                    with file.open('rb') as stream:
                        stream.seek(offset-1)
                        if stream.read(1) != b'\n':
                            if not stream.readline().endswith(b'\n'):
                                # The first boundary is still being written.
                                # Retry discovery instead of saving its middle.
                                return None
                            offset = stream.tell()
                with self.state:
                    self.state.execute('INSERT INTO live_cursors VALUES(?,?,?)', (*key, offset))
            else:
                offset = cursor[0]
            batch = self._batch(file, st, offset, 'live')
            if batch:
                return batch
        return None

    def _history_batch(self, files):
        for file in files:
            st = file.stat()
            key = (st.st_dev, st.st_ino)
            cursor = self.state.execute('SELECT offset FROM cursors WHERE device=? AND inode=?', key).fetchone()
            offset = cursor[0] if cursor else 0
            batch = self._batch(file, st, offset, 'history')
            if batch:
                return batch
            if cursor and st.st_size == offset and time.time()-st.st_mtime > 48*3600:
                file.unlink()
                with self.state:
                    for table in ('cursors', 'live_cursors'):
                        self.state.execute(f'DELETE FROM {table} WHERE device=? AND inode=?', key)
        return None

    def next_batch(self):
        files = sorted((self.root/'logs').glob('eve-*.json'), key=lambda p: p.stat().st_mtime)
        if self.live_acks < 4:
            batch = self._live_batch(files)
            if batch:
                return batch
        batch = self._history_batch(files)
        if batch:
            return batch
        # History may have pruned completed files. Rediscover before live reads.
        files = [file for file in files if file.exists()]
        return self._live_batch(files)

    def acknowledge(self, batch):
        table = 'live_cursors' if batch['channel'] == 'live' else 'cursors'
        with self.state:
            self.state.execute(f'INSERT INTO {table} VALUES(?,?,?) ON CONFLICT(device,inode) DO UPDATE SET offset=excluded.offset',
                (batch['device'], batch['inode'], batch['consumed']))
        self.live_acks = self.live_acks+1 if batch['channel'] == 'live' else 0


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    root = Path(os.getenv('IDS_SENSOR_ROOT', '/opt/netclaw-ids'))
    endpoint = os.environ['IDS_INGEST_URL']
    if not endpoint.startswith('https://'):
        raise ValueError('Sensor delivery requires HTTPS')
    context = ssl.create_default_context(cafile=os.environ['IDS_CA_FILE'])
    token = Path(os.environ['IDS_TOKEN_FILE']).read_text().strip()
    state = sqlite3.connect(root/'shipper.sqlite')
    spool = EveSpool(root, state)
    last_heartbeat = 0
    backoff = 1
    while True:
        try:
            selected = spool.next_batch()
            events = selected['events'] if selected else []
            if not events and time.time()-last_heartbeat < 30:
                time.sleep(1)
                continue
            payload = json.dumps({'events': events, 'heartbeat': heartbeat(root)}, allow_nan=False).encode()
            request = urllib.request.Request(endpoint, data=payload,
                headers={'Authorization': 'Bearer '+token, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, context=context, timeout=30) as response:
                ack = json.load(response)
            if ack.get('status') != 'accepted' or ack.get('received') != len(events):
                raise RuntimeError('Receiver did not acknowledge the complete batch')
            if selected:
                spool.acknowledge(selected)
            last_heartbeat, backoff = time.time(), 1
        except Exception as exc:
            logging.warning('Delivery paused (%s); retaining EVE and cursor; retry in %ss', type(exc).__name__, backoff)
            time.sleep(backoff)
            backoff = min(backoff*2, 30)


if __name__ == '__main__':
    main()
