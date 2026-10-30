"""Inert discovery cannot start the Zoom ingress process or invoke tools."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]


class ZoomDiscoveryTests(unittest.TestCase):
    def test_binding_draft_is_explicit_and_rejects_wrong_owner_or_port(self):
        import copy
        sys.path[:0]=[str(ROOT/'scripts/lib'),str(ROOT/'tests')]
        from test_setup_plan import sample_plan
        from setup_comms import set_zoom_binding
        from setup_schema import Invalid
        plan=sample_plan();plan['shape']='risk';border=plan['claws'][0];border['role']='border'
        member=copy.deepcopy(border);member.update(id='test-claw',role='member')
        member['capabilities']['components']=['zoom-rtms'];member['endpoints']={'hudPort':19002}
        border['endpoints']={'hudPort':19001};plan['claws'].append(member)
        bound=set_zoom_binding(plan,'test-claw',19876)
        self.assertEqual([{'id':'test-claw','integration':'zoom','owner':'test-claw','border':border['id'],'port':19876}],bound['commsBindings'])
        self.assertNotIn('commsBindings',plan)
        self.assertEqual([],set_zoom_binding(bound,'test-claw',None)['commsBindings'])
        for port in (19001,19002,0,65536,1.5,True):
            with self.assertRaises(Invalid):set_zoom_binding(plan,'test-claw',port)
        with self.assertRaises(Invalid):set_zoom_binding(plan,border['id'],19876)
        with self.assertRaises(Invalid):set_zoom_binding(dict(plan,shape='focused'),'test-claw',19876)
        from setup_observation import HostObservation
        from setup_state import Conflict
        from unittest.mock import patch
        observed=[]
        class Socket:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def bind(self,address):
                observed.append(address)
                if address[1]==19876:raise OSError('occupied')
        observation=HostObservation();observation.binding=lambda _:None
        with patch('setup_observation.socket.socket',return_value=Socket()):
            with self.assertRaises(Conflict):observation.check(bound)
        self.assertIn(('127.0.0.1',19876),observed)

    def test_binding_is_dedicated_private_recoverable_and_preserves_both_owners(self):
        import copy,json
        sys.path[:0]=[str(ROOT/'scripts/lib'),str(ROOT/'tests')]
        from test_setup_plan import sample_plan
        from setup_comms import configure_zoom_binding, observe_zoom_binding
        from setup_deploy import Deployment
        from setup_secrets import read_owned_environment
        from setup_state import revision,Conflict
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();plan=sample_plan(str(root));plan['shape']='risk'
            border=plan['claws'][0];border['role']='border'
            member=copy.deepcopy(border);member.update(id='comms-member',role='member',runtimeHome=str(root/'member'),workspace=str(root/'member/workspace'))
            member['capabilities']['components']=['zoom-rtms'];plan['claws'].append(member)
            plan['commsBindings']=[{'id':'zoom-link','integration':'zoom','owner':member['id'],'border':border['id'],'port':19876}]
            effects=[];context={'plan':plan,'runId':'run-fixture','planHash':'a'*64,'journal':{'effects':effects}}
            def effect(owner,phase):
                e={'id':owner+':'+phase,'phase':phase,'owner':owner,'artifacts':[]};effects.append(e);return e
            context['artifactIntent']=lambda key,items:next(e for e in effects if e['id']==key)['artifacts'].extend(items)
            deployments=[Deployment(ROOT,c,context) for c in (member,border)]
            for d in deployments:
                d.home(effect(d.claw['id'],'home'))
                d.write(effect(d.claw['id'],'credentials'),d.root/'.env',('PROVIDER_KEY='+d.claw['id']+'\n').encode(),kind='credentials')
            e=effect(member['id'],'comms-binding');e['binding']='zoom-link'
            own=deployments[0];original=own.write
            def interrupted(*args,**kwargs):
                original(*args,**kwargs);raise InterruptedError('fixture after first write')
            own.write=interrupted
            with self.assertRaises(InterruptedError):configure_zoom_binding(e,context,own)
            self.assertEqual('retry_owned',observe_zoom_binding(e,context,own))
            from setup_effects import EffectRunner
            e['state']='unknown'
            self.assertEqual('retry_owned',EffectRunner(ROOT).observe(e,context))
            first=read_owned_environment(own.root/'.env',revision(own.root/'.env'))['N2N_ZOOM_CHANNEL_SECRET']
            own.write=original
            self.assertEqual('verified',configure_zoom_binding(e,context,own)['state'])
            for d in deployments:
                values=read_owned_environment(d.root/'.env',revision(d.root/'.env'))
                self.assertEqual(first,values['N2N_ZOOM_CHANNEL_SECRET'])
                self.assertEqual(d.claw['id'],values['PROVIDER_KEY'])
                self.assertEqual('127.0.0.1',values['N2N_ZOOM_CHANNEL_HOST'])
                self.assertEqual(0,(d.root/'.env').stat().st_mode&0o077)
            self.assertNotIn(first,json.dumps(effects))
            self.assertEqual('completed',observe_zoom_binding(e,context,own))
            # A rollback to an older settled environment is not an authorized
            # interrupted-write recovery, even when its hash exists in history.
            prior=(deployments[1].root/'.env').read_bytes()
            (deployments[1].root/'.env').write_text('PROVIDER_KEY='+border['id']+'\n')
            e['state']='verified'
            with self.assertRaises(Conflict):configure_zoom_binding(e,context,own)
            self.assertEqual('conflict',observe_zoom_binding(e,context,own))
            (deployments[1].root/'.env').write_bytes(prior)
            (deployments[1].root/'.env').write_text('FOREIGN=changed\n')
            with self.assertRaises(Conflict):configure_zoom_binding(e,context,own)

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_ZOOM_PYTHON'),'isolated Zoom dependency environment required')
    def test_actual_mcp_discovery_and_refusal_with_no_network_authority(self):
        runtime=os.environ['NETCLAW_TEST_ZOOM_PYTHON']
        code=r'''
import asyncio,json,os,sys
from fastmcp import Client
from fastmcp.client.transports import StdioTransport
async def check():
 wrapper="import sys,runpy; sys.path.insert(0,sys.argv[1]); sys.addaudithook(lambda event,args: (_ for _ in ()).throw(RuntimeError('network forbidden in discovery')) if event in ('socket.bind','socket.connect') else None); runpy.run_path(sys.argv[1]+'/server.py',run_name='__main__')"
 transport=StdioTransport(sys.executable,['-c',wrapper,sys.argv[1]],env={'NETCLAW_MCP_DISCOVERY_ONLY':'1','HOME':os.getcwd()},cwd=os.getcwd(),keep_alive=False)
 async with Client(transport) as client:
  tools=await client.list_tools()
  assert len(tools)==9
  result=await client.call_tool('zoom_enable_listening',{'meeting_id':'installer-inert-fixture'})
  assert result.data=={'error':'installer_discovery_only','active':False},result.data
 print('inert-mcp-contract-passed')
asyncio.run(check())
'''
        with tempfile.TemporaryDirectory() as tmp:
            result=subprocess.run([runtime,'-c',code,str(ROOT/'mcp-servers/zoom-rtms-mcp')],cwd=tmp,
                env={'PATH':os.defpath,'HOME':tmp,'PYTHONNOUSERSITE':'1'},capture_output=True,timeout=30)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        self.assertIn(b'inert-mcp-contract-passed',result.stdout)

    def test_subprocess_inert_import_and_all_tools_refuse_without_background_imports(self):
        # Lightweight import sentinels verify the boundary even on a host with
        # no Zoom SDK. Actual MCP wire acceptance uses the isolated environment.
        code=r'''
import importlib.abc,sys,types,asyncio
class RefuseOperationalImports(importlib.abc.MetaPathFinder):
 def find_spec(self,fullname,*args):
  if fullname.split('.')[0] in {'panel_feed','recognition','rtms_listener','webhook','zoom_channel_client','rtms'}:
   raise AssertionError('operational module imported during discovery')
sys.meta_path.insert(0,RefuseOperationalImports())
class MCP:
 def __init__(self,*args,**kwargs):self.tools=[]
 def add_extension(self,*args):pass
 def tool(self,**kwargs):
  def register(fn):self.tools.append(fn);return fn
  return register
m=types.ModuleType('fastmcp');m.FastMCP=MCP;sys.modules['fastmcp']=m
tasks=types.ModuleType('fastmcp_tasks');tasks.TasksExtension=lambda **kwargs:None;sys.modules['fastmcp_tasks']=tasks
utils=types.ModuleType('fastmcp.utilities.async_utils')
async def invoke(fn,*args,**kwargs):return fn(*args,**kwargs)
utils.call_sync_fn_in_threadpool=invoke;sys.modules['fastmcp.utilities.async_utils']=utils
import server
assert server._DISCOVERY_ONLY and server._bg_loop is None and len(server.mcp.tools)==9
for fn in server.mcp.tools:
 result=fn()
 if hasattr(result,'__await__'):result=asyncio.run(result)
 assert result=={'error':'installer_discovery_only','active':False}
assert server._bg_loop is None
'''
        env={'PATH':os.defpath,'HOME':'/nonexistent','NETCLAW_MCP_DISCOVERY_ONLY':'1','PYTHONNOUSERSITE':'1'}
        result=subprocess.run([sys.executable,'-c',code],cwd=ROOT/'mcp-servers/zoom-rtms-mcp',env=env,
            capture_output=True,timeout=10)
        self.assertEqual(0,result.returncode,result.stderr.decode())

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_ZOOM_PYTHON'),'isolated Zoom environment required')
    def test_actual_mcp_lifetime_owns_one_registry_and_stops_its_background_services(self):
        # Real MCP lifecycle, with local service adapters substituted to keep
        # this installer test free of listeners, meetings and provider traffic.
        code=r'''
import asyncio,os,socket,sys,threading
sys.path.insert(0,sys.argv[1])
def forbidden(*args,**kwargs):raise AssertionError('installer lifetime test attempted network')
socket.socket.bind=forbidden;socket.socket.connect=forbidden
import server,panel_feed,webhook,rtms_listener,recognition,zoom_channel_client
from fastmcp import Client
assert server._bg_thread is None and server._bg_loop is None
assert server.registry is webhook.registry is panel_feed.registry is rtms_listener.registry
events=[];pid=os.getpid()
class Panel:
 def close(self):events.append(('panel-close',os.getpid()))
 async def wait_closed(self):pass
async def panel():events.append(('panel-start',os.getpid()));return Panel()
async def border():events.append(('border-start',os.getpid()))
async def border_close():events.append(('border-close',os.getpid()))
def web():events.append(('web-start',os.getpid()));return object()
def web_close(handle):events.append(('web-close',os.getpid()))
panel_feed.start_panel_feed_server=panel
zoom_channel_client.get_client=border;zoom_channel_client.close_client=border_close
webhook.start_webhook_server=web;webhook.stop_webhook_server=web_close
async def run():
 for cycle in range(2):
  async with Client(server.mcp) as client:
   assert server._bg_thread.is_alive() and server._bg_loop.is_running()
   assert len(await client.list_tools())==9
   try:server._start_background_services()
   except RuntimeError:pass
   else:raise AssertionError('duplicate background owner accepted')
  assert server._bg_thread is None and server._bg_loop is None
  assert server._webhook_thread is None
  assert not [t for t in threading.enumerate() if t.name=='zoom-rtms-bg-loop']
asyncio.run(run())
assert all(p==pid for _,p in events)
for name in ('panel-start','panel-close','border-start','border-close','web-start','web-close'):
 assert sum(e==name for e,_ in events)==2,(name,events)
print('single-process MCP lifetime passed')
'''
        with tempfile.TemporaryDirectory() as tmp:
            result=subprocess.run([os.environ['NETCLAW_TEST_ZOOM_PYTHON'],'-c',code,str(ROOT/'mcp-servers/zoom-rtms-mcp')],
                cwd=tmp,env={'PATH':os.defpath,'HOME':tmp,'PYTHONNOUSERSITE':'1','FASTMCP_CHECK_FOR_UPDATES':'off'},
                capture_output=True,timeout=30)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        self.assertIn(b'single-process MCP lifetime passed',result.stdout)

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_ZOOM_PYTHON'),'isolated Zoom environment required')
    def test_actual_local_ingress_lifetime_without_meetings_or_external_connections(self):
        code=r'''
import asyncio,os,sys,socket,threading
sys.path.insert(0,sys.argv[1])
def audit(event,args):
 if event in ('socket.bind','socket.connect') and isinstance(args[1],tuple) and args[1][0] not in ('127.0.0.1','::1'):
  raise AssertionError('non-loopback network attempted')
sys.addaudithook(audit)
import server,webhook,panel_feed,rtms_listener
from fastmcp import Client
assert server._bg_thread is None
async def run():
 async with Client(server.mcp) as client:
  assert len(await client.list_tools())==9
  assert server.registry is webhook.registry is panel_feed.registry is rtms_listener.registry
  assert not rtms_listener._active_listeners
  address=server._webhook_thread.netclaw_http_server.server_address
  port=server._panel_server.sockets[0].getsockname()[1]
  assert address[0]=='127.0.0.1' and port>0
  for p in (address[1],port):
   connection=socket.create_connection(('127.0.0.1',p),timeout=2);connection.close()
 assert server._bg_loop is None and server._bg_thread is None and server._webhook_thread is None
 assert not rtms_listener._active_listeners
 for p in (address[1],port):
  try:connection=socket.create_connection(('127.0.0.1',p),timeout=.2)
  except OSError:pass
  else:connection.close();raise AssertionError('owned listener survived MCP shutdown')
asyncio.run(run())
assert not [t for t in threading.enumerate() if t.name.startswith('zoom-rtms-')]
print('local ingress lifetime passed; no meeting or provider operation')
'''
        with tempfile.TemporaryDirectory() as tmp:
            result=subprocess.run([os.environ['NETCLAW_TEST_ZOOM_PYTHON'],'-c',code,str(ROOT/'mcp-servers/zoom-rtms-mcp')],
                cwd=tmp,env={'PATH':os.defpath,'HOME':tmp,'PYTHONNOUSERSITE':'1','FASTMCP_CHECK_FOR_UPDATES':'off',
                    'ZOOM_RTMS_WEBHOOK_PORT':'0','ZOOM_PANEL_FEED_PORT':'0','N2N_ZOOM_CHANNEL_PORT':'0'},
                capture_output=True,timeout=30)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        self.assertIn(b'local ingress lifetime passed',result.stdout)


if __name__=='__main__':unittest.main()
