import httpx
import pytest
from clients.auvik_client import AuvikClient


@pytest.mark.parametrize('cursor', [
    'https://foreign.example/page2',
    'http://api.example/page2',
    'https://api.example:444/page2',
    'https://user:password@api.example/page2',
])
async def test_untrusted_cursor_never_receives_credentials(cursor):
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={'data': [{'id': 'first'}],
                                        'links': {'next': cursor} if len(requests) == 1 else {}})
    client = AuvikClient('https://api.example', 'fixture-user', 'fixture-key',
                         transport=httpx.MockTransport(handler))
    try:
        result = await client.get_all('/v1/devices')
    finally:
        await client.close()
    assert len(requests) == 1
    assert result['items'] == [{'id': 'first'}]
    assert result['truncated'] is True
    assert 'origin' in result['error']


@pytest.mark.parametrize('cursor', ['https://api.example/v1/devices?page=2', '/v1/devices?page=2'])
async def test_same_origin_cursor_retains_pagination(cursor):
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={'data': [{'id': len(requests)}],
                                        'links': {'next': cursor} if len(requests) == 1 else {}})
    client = AuvikClient('https://api.example', 'fixture-user', 'fixture-key',
                         transport=httpx.MockTransport(handler))
    try:
        result = await client.get_all('/v1/devices')
    finally:
        await client.close()
    assert len(requests) == 2
    assert result['items'] == [{'id': 1}, {'id': 2}]
    assert result['truncated'] is False
