import importlib.util
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('install_mcp', ROOT / 'scripts/install-mcp-config.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_interpreter_and_console_entrypoint_match_runtime(tmp_path):
    bin_dir = tmp_path / 'venv/bin'
    bin_dir.mkdir(parents=True)
    for name in ('python', 'fwrule-mcp'):
        (bin_dir / name).write_text('#!/bin/sh\nexit 0\n')
        (bin_dir / name).chmod(0o700)
    python = str(bin_dir / 'python')
    entry = module.bind_entry({'command': 'python3', 'args': ['-u', 'mcp-servers/x/server.py']}, tmp_path, python)
    assert entry['command'] == python
    assert entry['args'][1] == str(tmp_path / 'mcp-servers/x/server.py')
    assert entry['cwd'] == str(tmp_path)
    assert module.bind_entry({'command': 'fwrule-mcp'}, tmp_path, python)['command'] == str(bin_dir / 'fwrule-mcp')
    assert module.bind_entry({'command': 'uvx', 'args': ['example']}, tmp_path, python)['command'] == 'uvx'


@pytest.mark.parametrize('flat', [True, False])
def test_merge_preserves_credentials_custom_fields_and_unrelated_servers(tmp_path, flat):
    path = tmp_path / 'openclaw.json'
    old = {'command': 'python3', 'args': ['server.py']}
    original = {'agents': {'defaults': {'model': 'keep'}}, 'auth': {'opaque': 'private'}}
    servers = {'gnmi-mcp': {**old, 'env': {'GNMI_PASSWORD': 'private'}, 'timeout': 99},
               'custom': {'command': '/operator/tool'}}
    original.update({'mcpServers': servers} if flat else {'mcp': {'servers': servers}})
    path.write_text(json.dumps(original))
    generated = {'gnmi-mcp': {'command': '/venv/bin/python', 'args': ['server.py'], 'cwd': '/repo'}}
    module.merge_config(path, generated, {'gnmi-mcp': old})
    result = json.loads(path.read_text())
    merged = result['mcpServers'] if flat else result['mcp']['servers']
    assert result['auth'] == original['auth']
    assert result['agents'] == original['agents']
    assert merged['custom'] == servers['custom']
    assert merged['gnmi-mcp']['env'] == servers['gnmi-mcp']['env']
    assert merged['gnmi-mcp']['timeout'] == 99
    assert merged['gnmi-mcp']['command'] == '/venv/bin/python'
    assert list(tmp_path.glob('openclaw.json.before-netclaw-*'))
    assert path.stat().st_mode & 0o777 == 0o600
    before = path.read_text()
    module.merge_config(path, generated, {'gnmi-mcp': old})
    assert path.read_text() == before


def test_custom_command_conflict_does_not_write(tmp_path):
    path = tmp_path / 'openclaw.json'
    original = json.dumps({'mcp': {'servers': {'gnmi-mcp': {'command': '/custom/python'}}}})
    path.write_text(original)
    with pytest.raises(ValueError, match='custom launch'):
        module.merge_config(path, {'gnmi-mcp': {'command': '/managed/python'}}, {'gnmi-mcp': {'command': 'python3'}})
    assert path.read_text() == original


def test_previously_normalized_template_is_migrated(tmp_path):
    path = tmp_path / 'openclaw.json'
    template = {'command': 'python3', 'args': ['mcp-servers/x/server.py']}
    existing = module.bind_entry(template, tmp_path, None)
    path.write_text(json.dumps({'mcpServers': {'x-mcp': existing}}))
    generated = {**existing, 'command': '/managed/bin/python'}
    module.merge_config(path, {'x-mcp': generated}, {'x-mcp': template})
    assert json.loads(path.read_text())['mcpServers']['x-mcp']['command'] == '/managed/bin/python'


def test_cli_registers_only_successful_selection(tmp_path):
    output = tmp_path / 'selected.json'
    result = subprocess.run([sys.executable, str(ROOT / 'scripts/install-mcp-config.py'),
        '--repo', str(ROOT), '--runtime-root', str(tmp_path / 'runtimes'),
        '--components', 'bgp-intel nautobot', '--output', str(output)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert set(json.loads(output.read_text())['mcpServers']) == {'bgp-intel-mcp', 'nautobot-mcp'}


@pytest.mark.parametrize('component', ['anta', 'multivendor-cli', 'zabbix', 'jev'])
def test_canonical_source_venv_launch_uses_successful_recovery_record(tmp_path, component):
    python = tmp_path / 'recovered/bin/python'
    python.parent.mkdir(parents=True)
    python.write_text('#!/bin/sh\nexit 0\n')
    python.chmod(0o700)
    template = {'command': f'mcp-servers/{component}-mcp/.venv/bin/python', 'args': ['-u', 'server.py']}
    assert module.bind_entry(template, tmp_path, str(python))['command'] == str(python)
    assert module.bind_entry({'command': '/operator/venv/bin/python'}, tmp_path, str(python))['command'] == '/operator/venv/bin/python'


def test_reviewed_revision_refuses_config_or_sidecar_changes(tmp_path):
    import hashlib
    path = tmp_path / 'openclaw.json'
    path.write_text('{}')
    revision = hashlib.sha256(b'{}').hexdigest()
    module.merge_config(path, {}, {}, expected_revision=revision, expected_managed_revision='missing')
    before = path.read_text()
    with pytest.raises(ValueError, match='changed'):
        module.merge_config(path, {}, {}, expected_revision='stale', expected_managed_revision='missing')
    assert path.read_text() == before
    with pytest.raises(ValueError, match='changed'):
        module.merge_config(path, {}, {}, expected_revision=hashlib.sha256(before.encode()).hexdigest(), expected_managed_revision='missing')
