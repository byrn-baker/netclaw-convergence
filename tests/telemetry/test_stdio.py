"""Actual shipped entry points and local synthetic telemetry lifecycle."""
import asyncio
import json
import os
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize('name', ['syslog', 'snmptrap', 'ipfix'])
@pytest.mark.parametrize('launch', ['file', 'module'])
def test_actual_entrypoint_discovery_status(name, launch, tmp_path):
    async def scenario():
        folder = ROOT / f'mcp-servers/{name}-mcp'
        module = f'{name}_mcp_server'
        args = ['-u', str(folder / (module + '.py'))] if launch == 'file' else ['-u', '-m', module]
        params = StdioServerParameters(command=sys.executable, args=args,
            cwd=str(folder), env={**os.environ, 'HOME':str(tmp_path)})
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as client:
                await client.initialize()
                tools = await client.list_tools()
                names = {tool.name for tool in tools.tools}
                assert f'{name}_get_status' in names
                result = await client.call_tool(f'{name}_get_status', {})
                assert not result.isError
                status = json.loads(result.content[0].text)
                assert status['is_running'] is False
    asyncio.run(asyncio.wait_for(scenario(), 20))


def test_syslog_tcp_ingest_and_persist(tmp_path):
    async def scenario():
        params = StdioServerParameters(command=sys.executable,
            args=['-u', str(ROOT / 'mcp-servers/syslog-mcp/syslog_mcp_server.py')],
            env={**os.environ, 'HOME':str(tmp_path)})
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as client:
                await client.initialize()
                result = await client.call_tool('syslog_start_receiver',
                    {'port':0, 'bind_address':'127.0.0.1', 'protocol':'tcp'})
                assert not result.isError
                try:
                    status = json.loads((await client.call_tool('syslog_get_status', {})).content[0].text)
                    port = status['tcp_transport']['bound_port']
                    reader, writer = await asyncio.open_connection('127.0.0.1', port)
                    writer.write(b'<13>Mar 27 12:00:00 fixture app: synthetic audit message\n')
                    await writer.drain()
                    writer.close(); await writer.wait_closed()
                    for _ in range(50):
                        result = await client.call_tool('syslog_query', {})
                        body = json.loads(result.content[0].text)
                        if body['total']:
                            break
                        await asyncio.sleep(0.02)
                    assert body['total'] == 1
                finally:
                    await client.call_tool('syslog_stop_receiver', {})
                status = json.loads((await client.call_tool('syslog_get_status', {})).content[0].text)
                assert not status['is_running']
                assert status['audit']['persisted_count'] >= 3
                assert status['audit']['error_count'] == status['audit']['pending_count'] == 0
                assert status['audit']['last_commit']
    asyncio.run(asyncio.wait_for(scenario(), 25))
