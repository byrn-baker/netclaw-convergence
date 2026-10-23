"""Protocol/lifecycle and migration acceptance; no appliance required."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import pytest

ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
bridge=load('pyats_bridge','scripts/pyats-stdio.py')
migration=load('pyats_migration','scripts/migrate-pyats-http.py')

@pytest.fixture
def rpc_server():
    seen=[]
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            message=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            seen.append((message,dict(self.headers)))
            if 'id' not in message:
                self.send_response(202);self.end_headers();return
            data=json.dumps({'jsonrpc':'2.0','id':message['id'],'result':{'echo':message['params']}}).encode()
            self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        def log_message(self,*args):pass
    server=HTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever);thread.start()
    yield f'http://127.0.0.1:{server.server_port}/mcp',seen
    server.shutdown();server.server_close();thread.join()

def test_rpc_forwarding_bypasses_proxy_and_preserves_schema(rpc_server,monkeypatch):
    url,seen=rpc_server
    monkeypatch.setenv('http_proxy','http://127.0.0.1:1');monkeypatch.setenv('no_proxy','')
    message={'jsonrpc':'2.0','id':7,'method':'tools/call','params':{'name':'pyats_pcall_show_command','arguments':{'device_names':['R1'],'command':'show version'}}}
    assert bridge.forward(url,message,2)['result']['echo']==message['params']
    assert seen[0][0]==message
    assert bridge.forward(url,{'jsonrpc':'2.0','method':'notifications/initialized'},2) is None

def test_owned_process_cleanup():
    proc=subprocess.Popen([sys.executable,'-c','import time;time.sleep(60)'],start_new_session=True)
    bridge.stop_process(proc)
    assert proc.poll() is not None

def fixture_runtime(tmp_path):
    root=tmp_path/'repo';venv=tmp_path/'venv'
    for p in (root/'scripts/pyats-stdio.py',root/'mcp-servers/pyATS_MCP/pyats_mcp_server.py',venv/'bin/python'):
        p.parent.mkdir(parents=True,exist_ok=True);p.touch()
    path=tmp_path/'.env';original=b'OTHER=secret-placeholder\nPYATS_TESTBED_PATH=/private/testbed.yaml\nPYATS_MCP_SCRIPT=/old/server.py\n'
    path.write_bytes(original)
    return root,venv,path,original

def test_migration_preview_apply_idempotence_restore(tmp_path):
    root,venv,path,original=fixture_runtime(tmp_path)
    migration.migrate(path,root,venv);assert path.read_bytes()==original
    migration.migrate(path,root,venv,apply=True)
    changed=path.read_bytes();assert b'OTHER=secret-placeholder' in changed and b'PYATS_TESTBED_PATH=/private/testbed.yaml' in changed
    assert path.stat().st_mode & 0o777==0o600
    assert path.with_name('.env.pre-pyats-http').read_bytes()==original
    migration.migrate(path,root,venv,apply=True);assert path.read_bytes()==changed
    migration.migrate(path,root,venv,restore=True);assert path.read_bytes()==changed
    migration.migrate(path,root,venv,restore=True,apply=True);assert path.read_bytes()==original

def test_migration_refuses_symlinks_missing_runtime_and_existing_backup(tmp_path):
    root,venv,path,original=fixture_runtime(tmp_path)
    (venv/'bin/python').unlink()
    with pytest.raises(ValueError):migration.migrate(path,root,venv,apply=True)
    assert path.read_bytes()==original
    (venv/'bin/python').touch();backup=path.with_name('.env.pre-pyats-http');backup.write_text('older')
    with pytest.raises(FileExistsError):migration.migrate(path,root,venv,apply=True)
    assert path.read_bytes()==original
    backup.unlink();backup.symlink_to(path)
    with pytest.raises(ValueError):migration.migrate(path,root,venv,apply=True)

def test_managed_adoption_preserves_legacy_recovery_point(tmp_path):
    root,venv,path,original=fixture_runtime(tmp_path)
    migration.migrate(path,root,venv,apply=True)
    legacy_state=path.read_bytes()
    managed=venv/'upstream/pyats_mcp_server.py'
    managed.parent.mkdir();managed.touch()
    migration.migrate(path,root,venv,apply=True,upstream=managed)
    assert path.with_name('.env.pre-pyats-http').read_bytes()==original
    assert path.with_name('.env.pre-pyats-managed').read_bytes()==legacy_state
    migration.migrate(path,root,venv,apply=True,upstream=managed)
    migration.migrate(path,root,venv,apply=True,restore=True,upstream=managed)
    assert path.read_bytes()==legacy_state

def test_mcp_client_does_not_deadlock_on_chatty_server(tmp_path):
    server=tmp_path/'server.py'
    server.write_text('''import sys,json
sys.stderr.write("x"*200000);sys.stderr.flush()
for line in sys.stdin:
 m=json.loads(line)
 if 'id' in m:print(json.dumps({'jsonrpc':'2.0','id':m['id'],'result':{'content':[]}}),flush=True)
''')
    result=subprocess.run([sys.executable,str(ROOT/'scripts/mcp-call.py'),f'{sys.executable} {server}','test'],capture_output=True,text=True,timeout=15)
    assert result.returncode==0,result.stderr
    assert json.loads(result.stdout)=={'content':[]}

@pytest.mark.parametrize('method,params', [
    ('tools/call', {'name':'pyats_run_show_command','arguments':{'device_name':'fixture','command':'show version'}}),
    ('tasks/get', {'taskId':'task-fixture'}),
    ('tasks/cancel', {'taskId':'task-fixture'}),
    ('tasks/update', {'taskId':'task-fixture','inputResponses':{}}),
])
def test_modern_task_metadata_and_routing_survive_stdio_bridge(rpc_server,method,params):
    url,seen=rpc_server
    params={**params,'_meta':{'io.modelcontextprotocol/protocolVersion':'2026-07-28',
            'io.modelcontextprotocol/clientCapabilities':{'extensions':{'io.modelcontextprotocol/tasks':{}}}}}
    message={'jsonrpc':'2.0','id':8,'method':method,'params':params}
    bridge.forward(url,message,2)
    received,headers=seen[-1];headers={k.lower():v for k,v in headers.items()}
    assert received==message
    assert headers['mcp-protocol-version']=='2026-07-28'
    assert headers['mcp-method']==method
    assert headers['mcp-name']==params.get('taskId',params.get('name'))


def test_bridge_rejects_header_injection(rpc_server):
    url,seen=rpc_server
    with pytest.raises(ValueError,match='protocol'):
        bridge.forward(url,{'method':'tasks/get','params':{'_meta':{'io.modelcontextprotocol/protocolVersion':'2026-07-28\r\nX-Test: bad'}}},2)
    assert not seen
