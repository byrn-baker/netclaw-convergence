"""Fork investigation tools remain callable on the repository's tested SDK."""
import asyncio
import importlib.util
import json
from pathlib import Path

from fastmcp import Client
import httpx
import pytest

ROOT = Path(__file__).resolve().parents[2]


def load(name, directory):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'mcp-servers' / directory / 'server.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize('mode', ['legacy', '2026-07-28'])
def test_greynoise_lookup_preserves_unknown_and_error_results(mode, monkeypatch):
    monkeypatch.setenv('NETCLAW_GCF_MODE', 'off')
    module = load('greynoise_compat', 'greynoise-community-mcp')
    calls = []

    def lookup(url, **kwargs):
        calls.append(url)
        return httpx.Response(404)

    monkeypatch.setattr(module.httpx, 'get', lookup)

    async def run():
        async with Client(module.mcp, mode=mode) as client:
            assert 'greynoise_community_lookup' in {t.name for t in await client.list_tools()}
            result = await client.call_tool('greynoise_community_lookup', {'ip': '192.0.2.8'})
            data = json.loads(result.data) if isinstance(result.data, str) else result.data
            assert data['classification'] == 'unknown'
            assert data['ip'] == '192.0.2.8'
            empty = await client.call_tool('greynoise_community_lookup', {'ip': ''})
            data = json.loads(empty.data) if isinstance(empty.data, str) else empty.data
            assert data['error'] == 'no IP provided'
    asyncio.run(run())
    assert calls == ['https://api.greynoise.io/v3/community/192.0.2.8']


@pytest.mark.parametrize('mode', ['legacy', '2026-07-28'])
def test_case_tool_discovery_keeps_scoped_flow_contract(mode, monkeypatch):
    monkeypatch.setenv('CONVERGENCE_API_URL', 'https://fixture.invalid')
    monkeypatch.setenv('CONVERGENCE_API_TOKEN', 'fixture-only')
    monkeypatch.setenv('GUARDIAN_DEFAULT_SITE', 'branch')
    module = load('convergence_case_compat', 'convergence-case-mcp')

    async def run():
        async with Client(module.mcp, mode=mode) as client:
            tools = {t.name: t for t in await client.list_tools()}
            assert {'case_get', 'flow_top_talkers', 'flow_evidence'} <= tools.keys()
            assert {'address', 'start', 'end'} <= set(tools['flow_evidence'].input_schema['required'])
            result = await client.call_tool('flow_top_talkers', {'time_range': '1000d'}, raise_on_error=False)
            assert result.is_error
    asyncio.run(run())
