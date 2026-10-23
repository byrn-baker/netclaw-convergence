"""Selective OpenClaw Jev registration/recovery without runtime mutation."""
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('jev_adopt', ROOT/'scripts/jev-adopt.py')
adoption = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adoption)


@pytest.fixture
def fixture(tmp_path):
    repo = tmp_path/'repo'
    server = repo/'mcp-servers/jev-mcp'
    (server/'.venv/bin').mkdir(parents=True)
    (server/'server.py').write_text('# fixture')
    python = server/'.venv/bin/python'; python.write_text('#! fixture'); python.chmod(0o700)
    env = tmp_path/'.env'; env.write_text('TYPESAFE_API_KEY=fixture-secret\nJEV_ENABLED=false\n'); env.chmod(0o600)
    config = tmp_path/'openclaw.json'
    data = {'mcp':{'servers':{'existing':{'command':'keep','env':{'SECRET':'retain'}}}}, 'agents':{'defaults':{'workspace':'operator-workspace'}}, 'channels':{'custom':'keep'}}
    original = json.dumps(data, indent=4).encode()
    config.write_bytes(original)
    return config, env, repo, original


def test_preview_apply_repeat_restore_preserve_operator_fields(fixture):
    config, env, repo, original = fixture
    adoption.adopt(config, env, repo)
    assert config.read_bytes() == original
    assert not config.with_name(config.name+'.pre-jev-registration').exists()
    adoption.adopt(config, env, repo, apply=True)
    applied = config.read_bytes()
    data = json.loads(applied)
    entry = data['mcp']['servers'].pop('jev-mcp')
    assert data == json.loads(original)
    assert entry['args'][-2:] == ['--env-file',str(env)]
    assert 'fixture-secret' not in applied.decode()
    assert config.stat().st_mode & 0o777 == 0o600
    adoption.adopt(config, env, repo, apply=True)
    assert config.read_bytes() == applied
    adoption.adopt(config, None, repo, restore=True)
    assert config.read_bytes() == applied
    adoption.adopt(config, None, repo, apply=True, restore=True)
    assert config.read_bytes() == original


def test_existing_custom_entry_and_unknown_shape_refused(fixture):
    config, env, repo, _ = fixture
    config.write_text('{"mcpServers": {}}')
    with pytest.raises(ValueError, match='mcp.servers'):
        adoption.adopt(config, env, repo, apply=True)
    custom = {'mcp':{'servers':{'jev-mcp':{'command':'operator-owned'}}}}
    config.write_text(json.dumps(custom))
    with pytest.raises(ValueError, match='differs'):
        adoption.adopt(config, env, repo, apply=True)
    assert json.loads(config.read_text()) == custom


def test_restore_refuses_later_edits(fixture):
    config, env, repo, _ = fixture
    adoption.adopt(config, env, repo, apply=True)
    changed = json.loads(config.read_text()); changed['newer']='operator edit'
    config.write_text(json.dumps(changed))
    with pytest.raises(ValueError, match='changed after'):
        adoption.adopt(config, env, repo, apply=True, restore=True)
    assert json.loads(config.read_text()) == changed


def test_symlink_config_refused(fixture):
    config, env, repo, _ = fixture
    link = config.with_name('alias.json'); link.symlink_to(config)
    with pytest.raises(ValueError, match='Symlink'):
        adoption.adopt(link, env, repo, apply=True)


def test_registered_command_launches_real_mcp_with_selected_env(fixture, tmp_path):
    """Use precisely the adopted entry, with no inherited Jev/provider variables."""
    import asyncio
    import os
    import sys
    import shlex
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    config, env_file, repo, _ = fixture
    server = repo/'mcp-servers/jev-mcp/server.py'
    server.unlink(); server.symlink_to(ROOT/'mcp-servers/jev-mcp/server.py')
    python = repo/'mcp-servers/jev-mcp/.venv/bin/python'
    # A symlink outside the test venv loses pyvenv.cfg on Linux. Execute the
    # original interpreter path so the registered fixture retains its dependencies.
    python.write_text('#!/bin/sh\nexec ' + shlex.quote(sys.executable) + ' "$@"\n')
    python.chmod(0o700)
    env_file.write_text('JEV_ENABLED=false\nJEV_DATA_DIR='+str(tmp_path/'private-jev')+'\nJEV_TASK_ID=adoption-fixture\nTYPESAFE_API_KEY=fixture-only-not-real\n')
    adoption.adopt(config, env_file, repo, apply=True)
    entry = json.loads(config.read_text())['mcp']['servers']['jev-mcp']

    async def run():
        params = StdioServerParameters(**entry, env={'PATH':os.environ['PATH'],'HOME':str(tmp_path)})
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                names = {tool.name for tool in (await session.list_tools()).tools}
                assert names == {'jev_status','jev_evaluate','jev_assessment'}
                result = await session.call_tool('jev_status', {})
                status = json.loads(next(c.text for c in result.content if c.type == 'text'))
                assert status['enabled'] is False
                assert status['task_id'] == 'adoption-fixture'
                assert 'fixture-only-not-real' not in json.dumps(status)
                evaluation = await session.call_tool('jev_evaluate', {
                    'state':'Synthetic state', 'questions':{'q':{'type':'noul','instructions':'Does the state report a fault?'}},
                    'purpose':'evidence_review','evidence_metadata':[]})
                answer = json.loads(next(c.text for c in evaluation.content if c.type == 'text'))
                assert answer['status'] == 'disabled'
    asyncio.run(run())
