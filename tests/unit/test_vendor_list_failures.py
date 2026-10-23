"""Vendor import namespaces are isolated; real paginator code uses fixture pages."""
import os
from pathlib import Path
import subprocess
import sys
import pytest
ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize('vendor', ['auvik','halo','claroty'])
def test_malformed_list_is_not_successful_empty(vendor):
    code = r'''
import asyncio
VENDOR = '__VENDOR__'
async def run():
    if VENDOR == 'claroty':
        from clients.claroty_client import ClarotyClient
        client = ClarotyClient()
        for bad in [{}, {'error':'upstream shape changed'}, 'html']:
            async def post(*a, **kw): return bad
            client.post = post
            try: await client.collect('/fixture', items_key='devices')
            except ValueError: pass
            else: raise AssertionError('malformed list reported as empty')
        async def post(*a, **kw): return {'devices': []}
        client.post = post
        assert await client.collect('/fixture', items_key='devices') == []
    else:
        if VENDOR == 'halo':
            from clients.halo_client import HaloClient
            client = HaloClient("https://fixture.invalid", "fixture", "fixture")
        else:
            from clients.auvik_client import AuvikClient
            client = AuvikClient("https://fixture.invalid", "fixture", "fixture")
        async def bad(*a, **kw): return {'success':True,'data':{'error':'shape changed'},'error':None}
        client.get = bad
        result = await client.get_all('/fixture')
        assert result.get('error') and result['truncated'] is True, result
        async def empty(*a, **kw): return {'success':True,'data':[] if VENDOR=='halo' else {'data':[]},'error':None}
        client.get = empty
        result = await client.get_all('/fixture')
        assert not result.get('error') and not result['truncated'], result
        first = {'items':[{'id':1}], 'record_count':2} if VENDOR=='halo' else {'data':[{'id':1}], 'links':{'next':'/next'}}
        pages = iter([first, {'error':'malformed second page'}])
        async def partial(*a, **kw): return {'success':True,'data':next(pages),'error':None}
        client.get = partial
        result = await client.get_all('/fixture', params={'page_size':1})
        assert result['items'] == [{'id':1}] and result['truncated'] and result.get('error'), result
asyncio.run(run())
'''.replace('__VENDOR__', vendor)
    result = subprocess.run([sys.executable,'-c',code],env={**os.environ,'PYTHONPATH':str(ROOT/'mcp-servers'/f'{vendor}-mcp')},capture_output=True,text=True)
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize('vendor', ['auvik','halo'])
def test_incomplete_resolution_is_not_absence_or_unique_match(vendor):
    code = r'''
import asyncio
from utils import resolver
VENDOR = '__VENDOR__'
async def run():
    resolve = resolver.resolve_device if VENDOR == 'auvik' else resolver.resolve_client
    class Client:
        async def get_all(self, *args, **kwargs): return self.page
    client = Client()
    for page in [{'items':[], 'error':'fixture upstream failure'},
                 {'items':[{'id':'123456','name':'fixture','attributes':{'deviceName':'fixture'}}], 'truncated':True}]:
        client.page = page
        result = await resolve(client, 'fixture')
        identifier, error = resolver.resolve_or_error(result, 'device')
        assert identifier is None and error['error']['code'] == 'UpstreamError', (identifier, error)
    client.page = {'items':[], 'truncated':False}
    result = await resolve(client, 'fixture')
    assert resolver.resolve_or_error(result, 'device')[1]['error']['code'] == 'NotFound'
asyncio.run(run())
'''.replace('__VENDOR__', vendor)
    result = subprocess.run([sys.executable,'-c',code],env={**os.environ,'PYTHONPATH':str(ROOT/'mcp-servers'/f'{vendor}-mcp')},capture_output=True,text=True)
    assert result.returncode == 0, result.stderr
