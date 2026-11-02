#!/usr/bin/env python3
"""Read passive Proxmox snapshots over pinned SSH; publish using a separate role."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

MAX_BYTES = 512 * 1024
STOP = False


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def strict_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ValueError('Duplicate JSON key')
        out[key] = value
    return out


def load_json(raw):
    return json.loads(raw, object_pairs_hook=strict_object,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))


def validate_config(config):
    url = urllib.parse.urlsplit(config['url'])
    if (url.scheme != 'https' or not url.hostname or url.username or url.password
            or url.path != '/v1/hypervisor-events' or url.query or url.fragment):
        raise ValueError('A fixed HTTPS hypervisor ingestion URL is required')
    # SSH destination cannot be interpreted as an option or shell syntax.
    host = config['ssh_host']
    import re
    if not re.fullmatch(r'root@[A-Za-z0-9][A-Za-z0-9.:-]{0,252}', host):
        raise ValueError('Invalid SSH host')
    for key in ('identity_file', 'known_hosts_file', 'ca_file'):
        if not Path(config[key]).is_absolute() or not Path(config[key]).is_file():
            raise ValueError('Missing trusted local file')
    if type(config.get('interval_seconds', 15)) is not int or not 5 <= config.get('interval_seconds', 15) <= 60:
        raise ValueError('Invalid polling interval')
    return config


def read_snapshot(config):
    args = ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
            '-o', 'ConnectTimeout=5', '-o', 'IdentitiesOnly=yes',
            '-o', 'GlobalKnownHostsFile=/dev/null', '-o', 'UpdateHostKeys=no',
            '-o', 'UserKnownHostsFile=' + config['known_hosts_file'],
            '-i', config['identity_file'], config['ssh_host'],
            'head -c 524289 /var/lib/netclaw-proxmox-observer/snapshot.json']
    result = subprocess.run(args, capture_output=True, timeout=12)
    if result.returncode:
        raise RuntimeError('Snapshot read failed')
    raw = result.stdout
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError('Snapshot exceeds bound')
    data = load_json(raw)
    if data.get('node') != config['node'] or data.get('schema_version') != 1:
        raise ValueError('Snapshot identity mismatch')
    stamp = data.get('observed_at')
    if type(stamp) not in (int, float) or not time.time() - 120 <= stamp <= time.time() + 30:
        raise ValueError('Snapshot is not current')
    return raw, data


def opener(config):
    context = ssl.create_default_context(cafile=config['ca_file'])
    return urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=context))


def publish(client, config, token, raw):
    request = urllib.request.Request(config['url'], data=raw,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, method='POST')
    with client.open(request, timeout=8) as response:
        body = response.read(4097)
        if response.status != 200 or len(body) > 4096:
            raise RuntimeError('Invalid receiver acknowledgment')
        ack = load_json(body)
        if ack.get('status') != 'accepted':
            raise RuntimeError('Receiver did not acknowledge snapshot')


def status_file(path, status):
    if not path:
        return
    target = Path(path)
    temporary = target.with_name(target.name + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(status, stream)
        stream.write('\n')
    os.replace(temporary, target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    config = validate_config(load_json(Path(args.config).read_bytes()))
    credentials = os.environ.get('CREDENTIALS_DIRECTORY')
    token_path = Path(credentials) / 'ingest-token' if credentials else Path(config['token_file'])
    token = token_path.read_text().strip()
    if len(token) < 32 or len(token) > 256 or any(c.isspace() for c in token):
        raise ValueError('Invalid credential')
    client = opener(config)
    status = {'last_success': None, 'failures': 0, 'last_error_type': None}
    previous = None
    while not STOP:
        started = time.monotonic()
        try:
            raw, data = read_snapshot(config)
            identity = (data['collector_started_at'], data['sequence'], hashlib.sha256(raw).hexdigest())
            if identity != previous:
                publish(client, config, token, raw)
                previous = identity
                status.update(last_success=time.time(), sequence=data['sequence'], last_error_type=None)
            status['checked_at'] = time.time()
        except Exception as exc:
            status['failures'] += 1
            status['last_error_type'] = type(exc).__name__
            status['checked_at'] = time.time()
            # Remote errors can contain private URLs or config; keep only type.
            print(json.dumps({'event': 'publication_failed', 'error_type': type(exc).__name__}), flush=True)
        status_file(config.get('status_file'), status)
        if args.once:
            return 1 if status['last_error_type'] else 0
        remaining = config.get('interval_seconds', 15) - (time.monotonic() - started)
        while remaining > 0 and not STOP:
            time.sleep(min(remaining, 0.5))
            remaining = config.get('interval_seconds', 15) - (time.monotonic() - started)
    return 0


def stop(*_):
    global STOP
    STOP = True


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    raise SystemExit(main())
