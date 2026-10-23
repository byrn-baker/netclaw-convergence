"""Offline Equinix authorization/transport contracts; no credentials or cloud calls."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('equinix_proxy', ROOT / 'scripts/equinix-stdio.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
from policy import verify_change


def policy(writes=True):
    p = m.Policy(writes=writes, verifier=lambda *a: None, auditor=lambda e: True)
    p.discovered = {'search_connections', 'create_connection'}
    p.baselines['b'] = {'id': 'b', 'at': time.time(), 'response_sha256': 'observed'}
    return p


def call(name, args, mid=1):
    return {'jsonrpc': '2.0', 'id': mid, 'method': 'tools/call',
            'params': {'name': name, 'arguments': args}}


def write_args():
    return {'bandwidth': 100, '_netclaw': {'baseline_id': 'b', 'change_request': 'CHG123'}}


def test_gate_strips_metadata_and_blocks_replay():
    p = policy()
    expected = m.operation_digest('create_connection', {'bandwidth': 100}, p.baselines['b'])
    seen = []
    p.verifier = lambda cr, d: seen.append((cr, d))
    forward, local = p.client(call('create_connection', write_args()))
    assert local is None
    assert forward['params']['arguments'] == {'bandwidth': 100}
    assert seen == [('CHG123', expected)]
    forward, local = p.client(call('create_connection', write_args(), 2))
    assert forward is None and local['result']['isError']


@pytest.mark.parametrize('reason', ['read-only', 'unknown', 'no-baseline', 'expired', 'gait', 'snow'])
def test_fail_closed(reason):
    p = policy(writes=reason != 'read-only')
    name = 'delete_connection' if reason == 'unknown' else 'create_connection'
    if reason == 'no-baseline': p.baselines.clear()
    if reason == 'expired': p.baselines['b']['at'] -= 3601
    if reason == 'gait': p.auditor = lambda e: False
    if reason == 'snow':
        def fail(*a): raise ValueError('unapproved')
        p.verifier = fail
    forward, local = p.client(call(name, write_args()))
    assert forward is None and local['result']['isError']


def test_catalog_filters_unknown_and_augments_write_schema():
    p = policy()
    p.client({'id': 1, 'method': 'tools/list'})
    schema = {'type': 'object', 'properties': {'bandwidth': {'type': 'integer'}}, 'required': ['bandwidth']}
    out, _ = p.server({'id': 1, 'result': {'nextCursor': 'page2', 'tools': [
        {'name': n, 'inputSchema': schema} for n in ['create_connection', 'delete_connection', 'new_write']]}})
    assert len(out['result']['tools']) == 1
    assert out['result']['nextCursor'] == 'page2'
    assert '_netclaw' in out['result']['tools'][0]['inputSchema']['required']
    assert '_netclaw' not in schema['properties']


def test_actual_read_mints_private_baseline_and_errors_do_not(tmp_path):
    p = policy(); p.artifact_dir = tmp_path
    p.client(call('search_connections', {}))
    out, _ = p.server({'id': 1, 'result': {'content': [{'type': 'text', 'text': 'observed'}]}})
    b = out['result']['_meta']['netclaw_baseline']
    artifact = Path(b['artifact'])
    assert artifact.stat().st_mode & 0o777 == 0o600
    assert json.loads(artifact.read_text())['response']['content'][0]['text'] == 'observed'
    before = len(p.baselines)
    p.client(call('search_connections', {}, 2))
    p.server({'id': 2, 'result': {'isError': True}})
    assert len(p.baselines) == before


def test_no_server_sampling_or_roots():
    p = policy()
    out, reply = p.server({'id': 7, 'method': 'sampling/createMessage'})
    assert out is None and reply['error']['code'] == -32601


def test_exact_external_approval_and_incident_gate():
    d = 'a' * 64
    cr = dict(number='CHG123', approval='approved', state='-1', cmdb_ci='b' * 32,
              implementation_plan='NETCLAW-EQUINIX-SHA256=' + d,
              backout_plan='reviewed', test_plan='read back', risk='2', impact='2')
    incidents = []
    def fetch(table, query, fields):
        return [cr] if table == 'change_request' else incidents
    assert verify_change('CHG123', d, fetch) == 'CHG123'
    for key, bad in [('number', 'CHG999'), ('state', '-2'), ('approval', 'requested'),
                     ('implementation_plan', ''), ('cmdb_ci', ''), ('backout_plan', '')]:
        old = cr[key]; cr[key] = bad
        with pytest.raises(ValueError): verify_change('CHG123', d, fetch)
        cr[key] = old
    incidents.append({'number': 'INC1', 'priority': '1'})
    with pytest.raises(ValueError): verify_change('CHG123', d, fetch)
    for bad in ['CHG123^ORstate=-1', 'CHG１２３', 'CHG123\n']:
        with pytest.raises(ValueError): verify_change(bad, d, lambda *a: pytest.fail('invalid query reached verifier'))


def test_changed_arguments_change_approval_digest():
    b = policy().baselines['b']
    assert m.operation_digest('create_connection', {'bandwidth': 1}, b) != m.operation_digest('create_connection', {'bandwidth': 2}, b)


def test_cache_partition_and_disabled_start(tmp_path):
    env = {'EQUINIX_AUTH_DIR': str(tmp_path)}
    standalone = m.cache_dir(env)
    env['N2N_MEMBER_ID'] = 'risk/a'; a = m.cache_dir(env)
    env['N2N_MEMBER_ID'] = 'risk/b'; b = m.cache_dir(env)
    assert len({standalone, a, b}) == 3
    r = subprocess.run([sys.executable, str(ROOT / 'scripts/equinix-stdio.py')],
                       env={**os.environ, 'EQUINIX_ENABLED': 'false'}, capture_output=True, text=True, timeout=5)
    assert r.returncode != 0 and 'disabled' in r.stderr


def test_federation_scope():
    spec = importlib.util.spec_from_file_location('eq_profiles', ROOT / 'scripts/in2n-profiles.py')
    p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
    assert p.MCP_SERVERS['equinix'] == ['equinix-mcp']
    assert p.env_slice_keys('equinix', ['EQUINIX_SERVICENOW_PASSWORD', 'AWS_SECRET_ACCESS_KEY', 'GAIT_MCP_SCRIPT']) == ['EQUINIX_SERVICENOW_PASSWORD', 'GAIT_MCP_SCRIPT']
    assert p._match_profile('equinix', ['equinix-network-edge', 'equinix-fabric-operations', 'pyats-network']) == ['equinix-network-edge', 'equinix-fabric-operations']


def test_stdio_fake_upstream_preserves_handshake_and_denies_unknown(tmp_path):
    fake = tmp_path / 'fake.py'
    fake.write_text('''import sys,json
for line in sys.stdin:
 m=json.loads(line)
 if m.get('method')=='initialize':
  print(json.dumps({'id':m['id'],'jsonrpc':'2.0','result':{'protocolVersion':'2024-11-05','capabilities':{},'serverInfo':{'name':'fake','version':'1'}}}),flush=True)
''')
    runner = f"import runpy,sys; m=runpy.run_path({str(ROOT / 'scripts/equinix-stdio.py')!r}); m['run']([sys.executable,{str(fake)!r}],dict(__import__('os').environ),m['Policy'](auditor=lambda e: True))"
    p = subprocess.Popen([sys.executable, '-c', runner], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    try:
        p.stdin.write(json.dumps({'id': 1, 'method': 'initialize', 'params': {'capabilities': {'roots': {}}}})+'\n'); p.stdin.flush()
        assert json.loads(p.stdout.readline())['result']['serverInfo']['name'] == 'fake'
        p.stdin.write(json.dumps(call('delete_connection', {}, 2))+'\n'); p.stdin.flush()
        assert json.loads(p.stdout.readline())['result']['isError']
        p.stdin.close(); assert p.wait(timeout=5) == 0
    finally:
        if p.poll() is None: p.kill()


def test_false_flag_never_enables_risk_member(monkeypatch):
    spec = importlib.util.spec_from_file_location('eq_profiles_flags', ROOT / 'scripts/in2n-profiles.py')
    p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
    monkeypatch.setenv('EQUINIX_ENABLED', 'false')
    assert not p._equinix_enabled()
    monkeypatch.setenv('EQUINIX_ENABLED', 'true')
    assert p._equinix_enabled()
