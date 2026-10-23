"""Real extension wire requests: lifecycle, negotiation and caller isolation."""
import asyncio
import threading
import time

from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, TokenVerifier
from fastmcp_tasks import TasksExtension
from mcp_types import CLIENT_CAPABILITIES_META_KEY, PROTOCOL_VERSION_META_KEY
from starlette.testclient import TestClient

EXTENSION = 'io.modelcontextprotocol/tasks'


class FixtureTokens(TokenVerifier):
    async def verify_token(self, token):
        if token not in ('alice', 'bob'):
            return None
        return AccessToken(token=token, client_id='shared-client', scopes=[], claims={'sub': token})


def request(client, method, *, task_id=None, name=None, arguments=None, capability=True,
            token='alice', route=None, input_responses=None):
    meta = {PROTOCOL_VERSION_META_KEY: '2026-07-28', CLIENT_CAPABILITIES_META_KEY:
            {'extensions': {EXTENSION: {}}} if capability else {}}
    params = {'_meta': meta}
    headers = {'MCP-Protocol-Version': '2026-07-28', 'MCP-Method': method,
               'Accept': 'application/json, text/event-stream', 'Authorization': 'Bearer '+token}
    if task_id is not None:
        params['taskId'] = task_id
        headers['MCP-Name'] = route if route is not None else task_id
    if name is not None:
        params.update(name=name, arguments=arguments or {})
        headers['MCP-Name'] = name
    if input_responses is not None:
        params['inputResponses'] = input_responses
    response = client.post('/mcp', json={'jsonrpc':'2.0','id':1,'method':method,'params':params}, headers=headers)
    try:
        body = response.json()
    except ValueError:
        body = {}
    if 'jsonrpc' in body:
        return body
    return {'http_status':response.status_code, 'body':response.text}


def wait(client, task_id, terminal=('completed','failed','cancelled'), timeout=5):
    deadline = time.monotonic()+timeout
    while time.monotonic()<deadline:
        body=request(client,'tasks/get',task_id=task_id)
        assert 'result' in body,body
        if body['result']['status'] in terminal:return body['result']
        time.sleep(.02)
    raise AssertionError('task did not reach expected state')


def fixture_server():
    server=FastMCP('task-wire-fixture',auth=FixtureTokens())
    server.add_extension(TasksExtension(name='netclaw-test-wire',concurrency=1))
    return server


def test_handle_precedes_completion_polling_caller_isolation_and_routing():
    server=fixture_server()
    released=threading.Event()
    @server.tool(task=True)
    async def slow(value:int)->dict:
        while not released.is_set():await asyncio.sleep(.01)
        return {'value':value}
    with TestClient(server.http_app(stateless_http=True,json_response=True)) as client:
        discovered=request(client,'server/discover')
        assert EXTENSION in discovered['result']['capabilities']['extensions']
        started=request(client,'tools/call',name='slow',arguments={'value':7})
        result=started['result'];assert result['resultType']=='task'
        assert not released.is_set()
        task_id=result['taskId']
        try:
            working=request(client,'tasks/get',task_id=task_id)['result']
            assert working['resultType']=='complete' and working['status']=='working'
            assert request(client,'tasks/get',task_id=task_id,token='bob')['error']['code']==-32602
            assert request(client,'tasks/cancel',task_id=task_id,token='bob')['error']['code']==-32602
            assert request(client,'tasks/update',task_id=task_id,token='bob',input_responses={})['error']['code']==-32602
            assert request(client,'tasks/get',task_id=task_id,capability=False)['error']['code']==-32021
            mismatch=request(client,'tasks/get',task_id=task_id,route='different')
            assert 'error' in mismatch or mismatch.get('http_status',0)>=400
            assert request(client,'tasks/get',task_id='missing')['error']['code']==-32602
        finally:released.set()
        completed=wait(client,task_id)
        assert completed['status']=='completed'
        assert completed['result']['structuredContent']=={'value':7}
        again=request(client,'tasks/get',task_id=task_id)['result']
        assert again['result']==completed['result']


def test_foreground_fallback_and_tool_error_semantics():
    server=fixture_server()
    @server.tool(task=True)
    async def answer(value:int)->dict:return {'value':value}
    @server.tool(task=True)
    async def broken()->str:raise ValueError('fixture failure')
    with TestClient(server.http_app(stateless_http=True,json_response=True)) as client:
        foreground=request(client,'tools/call',name='answer',arguments={'value':9},capability=False)['result']
        assert foreground['resultType']=='complete'
        assert foreground['structuredContent']=={'value':9}
        started=request(client,'tools/call',name='broken')['result']
        result=wait(client,started['taskId'])
        assert result['status']=='completed' and result['result']['isError'] is True
        assert request(client,'tasks/get',task_id='missing',token='invalid')['http_status']==401


def test_cancel_acknowledgement_and_capability_required_on_every_method():
    server=fixture_server()
    @server.tool(task=True)
    async def waiting()->str:
        await asyncio.sleep(5)
        return 'finished'
    with TestClient(server.http_app(stateless_http=True,json_response=True)) as client:
        started=request(client,'tools/call',name='waiting')['result'];task_id=started['taskId']
        for method in ('tasks/cancel','tasks/update'):
            body=request(client,method,task_id=task_id,capability=False,input_responses={} if method.endswith('update') else None)
            assert body['error']['code']==-32021
        ack=request(client,'tasks/cancel',task_id=task_id)['result']
        assert ack['resultType']=='complete'
        assert set(ack) <= {'resultType','_meta'}
        assert wait(client,task_id)['status']=='cancelled'


def test_input_required_update_round_trip():
    from fastmcp import Context
    from mcp.types import ElicitRequest, ElicitRequestFormParams, InputRequiredResult
    server=fixture_server()
    @server.tool(task=True)
    async def needs_input(ctx: Context) -> str | InputRequiredResult:
        if not ctx.input_responses:
            return InputRequiredResult(result_type='input_required',input_requests={
                'choice':ElicitRequest(params=ElicitRequestFormParams(message='Fixture input',
                    requested_schema={'type':'object','properties':{'name':{'type':'string'}},'required':['name']}))})
        return 'Hello '+ctx.input_responses['choice'].content['name']
    with TestClient(server.http_app(stateless_http=True,json_response=True)) as client:
        started=request(client,'tools/call',name='needs_input')['result'];task_id=started['taskId']
        pending=wait(client,task_id,terminal=('input_required',))
        assert len(pending['inputRequests'])==1
        key=next(iter(pending['inputRequests']))
        assert pending['inputRequests'][key]['method']=='elicitation/create'
        ack=request(client,'tasks/update',task_id=task_id,input_responses={
            key:{'action':'accept','content':{'name':'fixture'}}})['result']
        assert ack['resultType']=='complete'
        assert set(ack) <= {'resultType','_meta'}
        finished=wait(client,task_id)
        assert finished['status']=='completed'
        assert finished['result']['content'][0]['text']=='Hello fixture'
