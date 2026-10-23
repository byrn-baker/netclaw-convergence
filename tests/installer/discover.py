"""Credential-free MCP startup checks for fresh installer runtimes."""
import asyncio
import json
import os
from pathlib import Path
import sys

from fastmcp import Client
from fastmcp.client.transports import StdioTransport


async def main(directory):
    entries = json.loads((directory / 'selected.json').read_text())['mcpServers']
    for name, entry in entries.items():
        env = {
            'PATH': os.environ['PATH'],
            'NAUTOBOT_URL': 'http://127.0.0.1:9',
            'NAUTOBOT_TOKEN': 'fixture-not-a-secret',
            'SUZIEQ_API_URL': 'http://127.0.0.1:9',
            'SUZIEQ_API_KEY': 'fixture-not-a-secret',
        }
        for mode in ('legacy', '2026-07-28'):
            with (directory / (name + '-' + mode + '-startup.log')).open('w') as errors:
                async with asyncio.timeout(40):
                    transport = StdioTransport(command=entry['command'],
                        args=entry.get('args', []), env=env, cwd=str(directory),
                        log_file=errors)
                    async with Client(transport, mode=mode, timeout=30) as client:
                        tools = await client.list_tools()
                        assert tools, name + ': no tools discovered'
                        print(f'{name}: {mode} tools-list PASS ({len(tools)} tools)', flush=True)



if __name__ == '__main__':
    asyncio.run(main(Path(sys.argv[1])))
