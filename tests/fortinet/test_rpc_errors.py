"""Actual HTTP client -> manager outcomes, with no appliance or credentials."""
import asyncio
import os
from pathlib import Path
import sys
import tempfile
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'mcp-servers/fortinet-mcp'))
import httpx
from credentials import PlaneCredentials
from envelope import Plane
from planes import manager
from transport import jsonrpc


async def run():
    original = httpx.AsyncClient
    cases = [({}, 'request_failed'), ({'result': []}, 'request_failed'),
             ({'result': [{'data': []}]}, 'request_failed'),
             ({'result': [{'status': {'code': -3}}]}, 'request_failed'),
             ({'result': [{'status': {'code': -11}}]}, 'auth_expired'),
             ({'result': [{'status': {'code': 0}, 'data': []}]}, 'empty_result'),
             ({'result': [{'status': {'code': 0}, 'data': [{'name':'root'}]}]}, 'ok')]
    with tempfile.TemporaryDirectory() as tmp:
        os.environ['FORTINET_AUDIT_LOG'] = str(Path(tmp) / 'audit.jsonl')
        for body, expected in cases:
            transport = httpx.MockTransport(lambda req: httpx.Response(200, json=body))
            jsonrpc.httpx.AsyncClient = lambda **kw: original(transport=transport, **kw)
            try:
                client = jsonrpc.JsonRpcClient(PlaneCredentials(Plane.MANAGER, 'https://fixture.invalid', 'fixture-token', True))
                result = await manager.list_adoms(client)
                assert result['outcome'] == expected, (body, result)
            finally:
                jsonrpc.httpx.AsyncClient = original
    print('PASS: malformed, error, auth, empty and successful RPC outcomes remain distinct')


if __name__ == '__main__':
    asyncio.run(run())
