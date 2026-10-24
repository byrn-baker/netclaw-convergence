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


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    root = Path(os.getenv('IDS_SENSOR_ROOT', '/opt/netclaw-ids'))
    endpoint = os.environ['IDS_INGEST_URL']
    if not endpoint.startswith('https://'):
        raise ValueError('Sensor delivery requires HTTPS')
    context = ssl.create_default_context(cafile=os.environ['IDS_CA_FILE'])
    token = Path(os.environ['IDS_TOKEN_FILE']).read_text().strip()
    state = sqlite3.connect(root/'shipper.sqlite')
    state.execute('PRAGMA synchronous=FULL')
    state.execute('CREATE TABLE IF NOT EXISTS cursors (device INTEGER, inode INTEGER, offset INTEGER, PRIMARY KEY(device,inode))')
    last_heartbeat = 0
    backoff = 1
    while True:
        try:
            files = sorted((root/'logs').glob('eve-*.json'), key=lambda p: p.stat().st_mtime)
            selected, events, consumed = None, [], 0
            for file in files:
                st = file.stat()
                cursor = state.execute('SELECT offset FROM cursors WHERE device=? AND inode=?', (st.st_dev, st.st_ino)).fetchone()
                offset = cursor[0] if cursor else 0
                if st.st_size < offset:
                    raise RuntimeError(f'EVE file was truncated: {file.name}; operator recovery required')
                if st.st_size > offset:
                    events, consumed = read_batch(file, offset)
                    if events:
                        selected = (file, st)
                        break
                # Only delete completed, acknowledged files older than 48 hours.
                if cursor and st.st_size == offset and time.time()-st.st_mtime > 48*3600:
                    file.unlink()
                    with state:
                        state.execute('DELETE FROM cursors WHERE device=? AND inode=?', (st.st_dev, st.st_ino))
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
                st = selected[1]
                with state:
                    state.execute('INSERT INTO cursors VALUES(?,?,?) ON CONFLICT(device,inode) DO UPDATE SET offset=excluded.offset', (st.st_dev, st.st_ino, consumed))
            last_heartbeat, backoff = time.time(), 1
        except Exception as exc:
            logging.warning('Delivery paused (%s); retaining EVE and cursor; retry in %ss', type(exc).__name__, backoff)
            time.sleep(backoff)
            backoff = min(backoff*2, 30)


if __name__ == '__main__':
    main()
