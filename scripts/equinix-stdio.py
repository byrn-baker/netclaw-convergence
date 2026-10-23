#!/usr/bin/env python3
"""Policy MCP proxy: exact catalog, session baselines, gated writes, isolated OAuth."""
import copy
import json
import shlex
import os
from pathlib import Path
import queue
import signal
import subprocess
import sys
import threading
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib' / 'equinix'))
from policy import BRIDGE, ENDPOINT, READS, WRITES, digest, operation_digest, verify_change

ROOT = Path(__file__).resolve().parents[1]
PREPARE = 'netclaw_prepare_change'
GATE_SCHEMA = {'type': 'object', 'properties': {
    'change_request': {'type': 'string', 'pattern': '^CHG[0-9]+$'},
    'baseline_id': {'type': 'string'}},
    'required': ['change_request', 'baseline_id'], 'additionalProperties': False}
PREPARE_TOOL = {'name': PREPARE, 'description': 'Prepare exact CR approval digest; does not execute or approve.',
    'inputSchema': {'type': 'object', 'properties': {'tool': {'type': 'string'},
        'arguments': {'type': 'object'}, 'baseline_id': {'type': 'string'}},
        'required': ['tool', 'arguments', 'baseline_id'], 'additionalProperties': False},
    'annotations': {'readOnlyHint': True}}


def audit(event):
    """Hashes and identifiers only. Never log Equinix payloads or credentials."""
    try:
        r = subprocess.run([sys.executable, str(ROOT / 'scripts/mcp-call.py'),
            shlex.join([sys.executable, str(ROOT / 'scripts/gait-stdio.py')]), 'gait_record_turn',
            json.dumps({'user': 'Equinix MCP operation', 'assistant': json.dumps(event)})],
            capture_output=True, text=True, timeout=20)
        payload = json.loads(r.stdout)
        return r.returncode == 0 and payload.get('structuredContent', {}).get('result', {}).get('ok') is True
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return False


def cache_dir(env):
    # Member identity always partitions the cache, even when a shared base is inherited.
    base = Path(env.get('EQUINIX_AUTH_DIR') or
                str(Path(env.get('OPENCLAW_STATE_DIR') or Path.home() / '.openclaw') / 'equinix-auth')).expanduser()
    member = env.get('N2N_MEMBER_ID')
    return base / ('member-' + digest(member)[:20]) if member else base / 'standalone'


def result(message_id, value, error=False):
    return {'jsonrpc': '2.0', 'id': message_id, 'result': {
        'content': [{'type': 'text', 'text': json.dumps(value)}], 'isError': error}}


class Policy:
    def __init__(self, writes=False, verifier=verify_change, auditor=audit, artifact_dir=None):
        self.writes, self.verifier, self.auditor = writes, verifier, auditor
        self.pending, self.baselines, self.discovered = {}, {}, set()
        self.artifact_dir = artifact_dir

    def baseline(self, key):
        b = self.baselines.get(key)
        if not b or time.time() - b['at'] > 3600 or b.get('consumed'):
            raise ValueError('Fresh unused baseline from this session required (one hour maximum)')
        return b

    def client(self, msg):
        """Return (forward, local response)."""
        mid, method = msg.get('id'), msg.get('method')
        if method in {'notifications/initialized', 'notifications/cancelled'}:
            return msg, None
        if method not in {'initialize', 'ping', 'tools/list', 'tools/call'}:
            return None, {'jsonrpc': '2.0', 'id': mid, 'error': {'code': -32601, 'message': 'Method unavailable'}}
        if mid is None or mid in self.pending:
            raise ValueError('Unique request ID required')
        msg = copy.deepcopy(msg)
        params = msg.get('params', {})
        name = params.get('name') if method == 'tools/call' else None
        if method == 'initialize':
            msg.setdefault('params', {})['capabilities'] = {}
        try:
            args = params.get('arguments', {})
            if method == 'tools/call':
                if not isinstance(args, dict):
                    raise ValueError('Arguments must be an object')
                if name == PREPARE:
                    if not self.writes or args.get('tool') not in WRITES & self.discovered:
                        raise ValueError('Write tool unavailable; enable writes and discover tools first')
                    if not isinstance(args.get('arguments'), dict) or '_netclaw' in args['arguments']:
                        raise ValueError('Supply upstream arguments only')
                    b = self.baseline(args.get('baseline_id'))
                    d = operation_digest(args['tool'], args['arguments'], b)
                    return None, result(mid, {'approval_marker': 'NETCLAW-EQUINIX-SHA256=' + d,
                        'baseline': b, 'expires_at': b['at'] + 3600,
                        'next': 'Human reviews exact arguments, baseline, costs and rollback; bind marker in CR implementation_plan before approval. No execution yet.'})
                if name not in READS | WRITES or name not in self.discovered:
                    raise ValueError('Unknown/unavailable tool; delete is not supported by official MCP')
                if name in WRITES:
                    if not self.writes:
                        raise ValueError('EQUINIX_ALLOW_WRITES is disabled')
                    gate = args.pop('_netclaw', {})
                    b = self.baseline(gate.get('baseline_id'))
                    d = operation_digest(name, args, b)
                    self.verifier(gate.get('change_request'), d)
                    if not self.auditor({'phase': 'before-write', 'tool': name,
                                         'digest': d, 'cr': gate.get('change_request')}):
                        raise ValueError('GAIT unavailable; write refused')
                    # Consume before dispatch: even an ambiguous timeout cannot replay it.
                    b['consumed'] = True
                elif '_netclaw' in args:
                    raise ValueError('Gate metadata is only valid on write tools')
        except Exception as exc:
            # No remote error bodies / credential-bearing URLs in local errors.
            reason = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
            self.auditor({'phase': 'refused', 'tool': name})
            return None, result(mid, {'refused': reason}, True)
        self.pending[mid] = (method, name, copy.deepcopy(params.get('arguments', {})))
        return msg, None

    def server(self, msg):
        mid = msg.get('id')
        if 'method' in msg:
            if mid is not None:
                return None, {'jsonrpc': '2.0', 'id': mid, 'error': {'code': -32601, 'message': 'Server requests disabled'}}
            if msg.get('method') == 'notifications/tools/list_changed':
                self.discovered.clear()
                return msg, None
            return None, None
        info = self.pending.pop(mid, None)
        if not info:
            return None, None
        method, name, request_args = info
        value = msg.get('result')
        if method == 'initialize' and isinstance(value, dict):
            value['capabilities'] = {'tools': {'listChanged': True}}
        if method == 'tools/list' and isinstance(value, dict):
            visible = []
            for tool in value.get('tools', []):
                name = tool.get('name')
                if name not in READS and not (self.writes and name in WRITES):
                    continue
                tool = copy.deepcopy(tool)
                if name in WRITES:
                    schema = tool.get('inputSchema', {})
                    if schema.get('type') != 'object' or '_netclaw' in schema.get('properties', {}):
                        continue
                    schema.setdefault('properties', {})['_netclaw'] = GATE_SCHEMA
                    schema.setdefault('required', []).append('_netclaw')
                    tool['description'] = 'GATED: approved Implement CR + exact digest + baseline required. ' + tool.get('description', '')
                self.discovered.add(name)
                visible.append(tool)
            if self.writes and not value.get('nextCursor'):
                visible.append(PREPARE_TOOL)
            value['tools'] = visible
        if method == 'tools/call':
            ok = isinstance(value, dict) and not value.get('isError') and 'error' not in msg
            event = {'phase': 'result', 'tool': name, 'ok': ok}
            if ok and name in READS and name != 'search_service_tokens':
                key = str(uuid.uuid4())
                b = {'id': key, 'tool': name, 'arguments_sha256': digest(request_args),
                     'response_sha256': digest(value), 'at': time.time()}
                if self.artifact_dir:
                    self.artifact_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
                    artifact = self.artifact_dir / (key + '.json')
                    with artifact.open('x') as handle:
                        os.chmod(artifact, 0o600)
                        json.dump({'baseline': b, 'arguments': request_args, 'response': value}, handle)
                    b['artifact'] = str(artifact)
                self.baselines[key] = b
                value.setdefault('_meta', {})['netclaw_baseline'] = b
                event['baseline_id'] = key
                event['response_sha256'] = b['response_sha256']
            audited = self.auditor(event)
            if isinstance(value, dict):
                value.setdefault('_meta', {})['netclaw_audit_ok'] = audited
                if name in WRITES:
                    value['_meta']['netclaw_verification'] = 'Required: re-read target; do not retry blindly or close CR on failure.'
        return msg, None


def run(command, env, policy):
    child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=sys.stderr, text=True, bufsize=1, env=env, start_new_session=(os.name == 'posix'))
    events = queue.Queue()
    def read(source, stream):
        for line in stream:
            events.put((source, line))
        events.put((source, None))
    for source, stream in [('client', sys.stdin), ('server', child.stdout)]:
        threading.Thread(target=read, args=(source, stream), daemon=True).start()
    def send(stream, message):
        if message is not None:
            stream.write(json.dumps(message, allow_nan=False) + '\n')
            stream.flush()
    try:
        while True:
            source, line = events.get()
            if line is None:
                break
            msg = json.loads(line)
            if not isinstance(msg, dict):
                raise ValueError('JSON-RPC batches unsupported')
            if source == 'client':
                forward, local = policy.client(msg)
                send(child.stdin, forward)
                send(sys.stdout, local)
            else:
                forward, local = policy.server(msg)
                send(sys.stdout, forward)
                send(child.stdin, local)
    finally:
        if os.name == 'posix':
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        else:
            child.terminate()
        try:
            child.wait(timeout=3)
        except subprocess.TimeoutExpired:
            if os.name == 'posix':
                os.killpg(child.pid, signal.SIGKILL)
            else:
                child.kill()
            child.wait()


def main():
    if os.environ.get('EQUINIX_ENABLED', '').lower() != 'true':
        raise SystemExit('Equinix disabled: opt in with EQUINIX_ENABLED=true and complete browser OAuth.')
    os.umask(0o077)
    path = cache_dir(os.environ)
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.chmod(0o700)
    # OAuth bridge never receives ServiceNow, model or network credentials.
    env = {k: v for k, v in os.environ.items() if k in {
        'PATH', 'HOME', 'USER', 'TMPDIR', 'SYSTEMROOT', 'APPDATA', 'LOCALAPPDATA',
        'NODE_EXTRA_CA_CERTS', 'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS'}}
    env['MCP_REMOTE_CONFIG_DIR'] = str(path)
    run(['npx', '-y', BRIDGE, ENDPOINT, '--transport', 'http-only'], env,
        Policy(writes=os.environ.get('EQUINIX_ALLOW_WRITES', '').lower() == 'true',
               artifact_dir=path / 'baselines'))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Equinix bridge stopped: ' + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
