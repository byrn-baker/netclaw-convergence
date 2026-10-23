"""Real FastMCP4 protocol negotiation and existing Dot security boundaries."""
import asyncio
import importlib.util
from pathlib import Path
import sys
from unittest.mock import Mock

from fastmcp import Client, FastMCP
from fastmcp.client.transports import StdioTransport
from mcp_types import CLIENT_CAPABILITIES_META_KEY, PROTOCOL_VERSION_META_KEY
import pytest
from starlette.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]


def modern(method, name=None, arguments=None):
    params = {'_meta': {PROTOCOL_VERSION_META_KEY: '2026-07-28', CLIENT_CAPABILITIES_META_KEY: {}}}
    headers = {'MCP-Protocol-Version': '2026-07-28', 'MCP-Method': method,
               'Accept': 'application/json, text/event-stream'}
    if name:
        params.update(name=name, arguments=arguments or {})
        headers['MCP-Name'] = name
    return {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}, headers


def response_body(response):
    assert response.status_code == 200, response.text
    if response.headers.get('content-type', '').startswith('text/event-stream'):
        import json
        return json.loads(next(line[6:] for line in response.text.splitlines() if line.startswith('data: ')))
    return response.json()


def test_independent_modern_http_requests_and_validation():
    server = FastMCP('offline-fixture')
    calls = []
    @server.tool()
    def echo(value: int) -> dict:
        calls.append(value)
        return {'value': value}
    app = server.http_app(stateless_http=True, json_response=True)
    with TestClient(app) as client:
        for value in [1, 2]:
            body, headers = modern('tools/call', 'echo', {'value': value})
            result = client.post('/mcp', json=body, headers=headers)
            assert 'mcp-session-id' not in result.headers
            assert response_body(result)['result']['structuredContent'] == {'value': value}
        body, headers = modern('tools/call', 'echo', {'value': 'not-an-integer'})
        result = response_body(client.post('/mcp', json=body, headers=headers))
        assert 'error' in result or result['result']['isError']
        assert calls == [1, 2]
        body, headers = modern('tools/call', 'echo', {'value': 3})
        headers['MCP-Name'] = 'different-tool'
        assert client.post('/mcp', json=body, headers=headers).status_code >= 400
        assert calls == [1, 2]


@pytest.mark.parametrize('mode', ['legacy', '2026-07-28'])
def test_stdio_real_owned_server_both_protocol_eras(mode, tmp_path):
    # Policy checker is local, deterministic and cannot execute a device command.
    script = ROOT/'mcp-servers/multivendor-cli-mcp/server.py'
    async def run():
        transport = StdioTransport(command=sys.executable, args=['-u', str(script)],
                                   env={'PYTHON_DOTENV_DISABLED': '1', 'HOME': str(tmp_path),
                                        'FASTMCP_CHECK_FOR_UPDATES': 'off'})
        async with Client(transport, mode=mode) as client:
            names = {tool.name for tool in await client.list_tools()}
            assert 'check_command_policy' in names
            assert 'apply_config' not in names
            tool = next(t for t in await client.list_tools() if t.name == 'check_command_policy')
            assert 'command' in tool.input_schema['properties']
            result = await client.call_tool('check_command_policy', {'command': 'reload'})
            assert result.data['allowed'] is False
            assert result.data['denied_reason']
    asyncio.run(run())


@pytest.fixture
def dot(monkeypatch):
    path = ROOT/'mcp-servers/netclaw-dot-mcp'
    monkeypatch.syspath_prepend(str(path))
    for name in ('core', 'oauth'):
        monkeypatch.delitem(sys.modules, name, raising=False)
    spec = importlib.util.spec_from_file_location('dot_mcp_protocol', path/'server.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_dot_sessionless_auth_host_origin_and_no_vendor_call(dot, monkeypatch):
    token = 'fixture-token-at-least-24-characters'
    oauth = Mock(base='https://fixture.invalid')
    oauth.valid_access.return_value = False
    monkeypatch.setattr(dot.core, 'inventory', lambda principal: {'principal': principal, 'devices': []})
    app = dot.DotAuth(dot.http_app(), token, oauth)
    with TestClient(app, base_url='http://localhost') as client:
        body, headers = modern('tools/call', 'netclaw_inventory')
        assert client.post('/mcp', json=body, headers=headers).status_code == 401
        headers['Authorization'] = 'Bearer '+token
        result = client.post('/mcp', json=body, headers=headers)
        assert 'mcp-session-id' not in result.headers
        assert response_body(result)['result']['structuredContent']['principal'] == 'owner'
        assert client.post('/mcp', json=body, headers={**headers, 'host': 'evil.invalid'}).status_code >= 400
        assert client.post('/mcp', json=body, headers={**headers, 'origin': 'https://evil.invalid'}).status_code >= 400
        headers['Authorization'] = 'Bearer wrong-token'
        assert client.post('/mcp', json=body, headers=headers).status_code == 401
