from pathlib import Path
import importlib.util, os, re, subprocess, sys
import pytest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('envwriter',ROOT/'scripts/write-env.py'); writer=importlib.util.module_from_spec(spec); spec.loader.exec_module(writer)

@pytest.mark.parametrize('filename,function',[('checkpoint-enable.sh','_set_env_var'),('ipfabric-enable.sh','_set_env_var'),('forward-enable.sh','set_env_var')])
def test_enable_writer_roundtrip(tmp_path, filename, function):
    source=(ROOT/'scripts'/filename).read_text()
    body=re.search(r'^'+function+r'\(\) \{.*?^}',source,re.M|re.S)[0]
    path=tmp_path/'.env';path.write_text('TOKEN=old\nUNRELATED=keep\n')
    value='literal&pipe|dollar$ quote"x" apostrophe\' slash\\'
    code='set -eu\nNETCLAW_DIR="$FIXTURE_ROOT"\nOPENCLAW_ENV="$FIXTURE_ENV"\n'+body+'\n'+function+' TOKEN "$FIXTURE_VALUE"'
    proc=subprocess.run(['bash','-c',code],env={**os.environ,'FIXTURE_ROOT':str(ROOT),'FIXTURE_ENV':str(path),'FIXTURE_VALUE':value},capture_output=True,text=True)
    assert proc.returncode==0,proc.stderr
    assert writer.values(path.read_text())=={'TOKEN':value,'UNRELATED':'keep'}
    assert path.stat().st_mode&0o777==0o600

def test_peering_prompt_is_literal(tmp_path):
    source=(ROOT/'scripts/peering-setup.sh').read_text();body=re.search(r'^ask\(\) \{.*?^}',source,re.M|re.S)[0]
    marker=tmp_path/'executed';value=f'$(touch {marker})'
    proc=subprocess.run(['bash','-c','set -eu\nCYAN= NC= DIM=\n'+body+'\nask ANSWER label\nprintf "\\n%s" "$ANSWER"'],input=value+'\n',capture_output=True,text=True)
    assert not marker.exists()
    assert proc.returncode==0,proc.stderr
    assert proc.stdout.endswith(value)


def fixture_checkout(tmp_path, filename):
    import shutil
    repo=tmp_path/'repo';(repo/'scripts/lib').mkdir(parents=True)
    for name in (filename,'write-env.py','setup-profile.py'):
        shutil.copy2(ROOT/'scripts'/name,repo/'scripts'/name)
    shutil.copy2(ROOT/'scripts/lib/pip-helper.sh',repo/'scripts/lib/pip-helper.sh')
    (repo/'config').mkdir();shutil.copy2(ROOT/'config/twilio-voice.json.example',repo/'config/twilio-voice.json.example')
    (repo/'config/python-shared-constraints.txt').write_text('')
    for component in ('twitter-mcp','twilio-voice-mcp'):
        p=repo/'mcp-servers'/component;p.mkdir(parents=True);(p/'requirements.txt').write_text('fixture\n')
    home=tmp_path/'home';(home/'.openclaw').mkdir(parents=True)
    return repo,home


@pytest.mark.parametrize('filename,prefix',[('twitter_install.sh','TWITTER'),('twilio_install.sh','TWILIO')])
def test_standalone_interactive_preserves_values_and_policy(tmp_path,filename,prefix):
    import json
    repo,home=fixture_checkout(tmp_path,filename)
    fake=tmp_path/'pip-python';fake.write_text('#!/bin/sh\nexit 0\n');fake.chmod(0o700)
    value='value & | quote"x" dollar$ slash\\'
    path=home/'.openclaw/.env';path.write_text('UNRELATED=keep\n')
    config=repo/'config/twilio-voice.json';original={'whitelist':[{'phone_number':'+15555550101','label':'old','can_receive_calls':False}],'rate_limits':{'daily_max':2},'custom':'keep'}
    config.write_text(json.dumps(original))
    if prefix=='TWILIO':
        inputs=['y','ACfixture','SKfixture',value,'+15555550102','y','+15555550103','quoted "label"','n']
        secret_key='TWILIO_API_SECRET'
    else:
        inputs=['y','key',value,'token','access-secret','n'];secret_key='TWITTER_API_SECRET'
    env={**os.environ,'HOME':str(home),'NETCLAW_PY':str(fake)};env.pop('NETCLAW_VENV',None)
    proc=subprocess.run(['bash',str(repo/'scripts'/filename)],input='\n'.join(inputs)+'\n',env=env,capture_output=True,text=True,timeout=15)
    assert proc.returncode==0,proc.stderr
    assert writer.values(path.read_text())[secret_key]==value
    assert writer.values(path.read_text())['UNRELATED']=='keep'
    assert path.stat().st_mode&0o777==0o600
    if prefix=='TWILIO':
        actual=json.loads(config.read_text());assert actual['whitelist'][0]==original['whitelist'][0]
        assert actual['rate_limits']==original['rate_limits'] and actual['custom']=='keep'
        assert actual['whitelist'][1]['label']=='quoted "label"'
        assert len(list((config.parent/'.setup-backups').iterdir()))==1


@pytest.mark.parametrize('filename',['twitter_install.sh','twilio_install.sh'])
def test_standalone_dependency_failure_stops_before_credentials(tmp_path,filename):
    repo,home=fixture_checkout(tmp_path,filename)
    fake=tmp_path/'pip-python';fake.write_text('#!/bin/sh\ncase "$*" in *sys.version_info*|*--version*) exit 0;; esac\necho externally-managed-environment >&2\nexit 23\n');fake.chmod(0o700)
    path=home/'.openclaw/.env';path.write_text('UNRELATED=keep\n')
    env={**os.environ,'HOME':str(home),'NETCLAW_PY':str(fake)};env.pop('NETCLAW_VENV',None)
    proc=subprocess.run(['bash',str(repo/'scripts'/filename)],input='',env=env,capture_output=True,text=True,timeout=15)
    assert proc.returncode!=0
    assert 'Refusing to override system packages' in proc.stderr
    assert 'Setup Complete' not in proc.stdout
    assert path.read_text()=='UNRELATED=keep\n'


def test_actual_mesh_launcher_preserves_json_and_spaces(tmp_path):
    import json
    path=tmp_path/'.env';value='name with spaces "quotes" $(false)'
    writer.update(path,'N2N_DISPLAY_NAME',value)
    writer.update(path,'NETCLAW_BGP_PEERS','[{"ip":"127.0.0.1","as":65000}]')
    writer.update(path,'UNRELATED_TOKEN','do-not-load')
    daemon=tmp_path/'daemon.py';daemon.write_text('import os,json;print(json.dumps({k:os.environ.get(k) for k in ["N2N_DISPLAY_NAME","NETCLAW_BGP_PEERS","UNRELATED_TOKEN"]}))')
    env=dict(os.environ);env.pop('UNRELATED_TOKEN',None)
    proc=subprocess.run(['python3',str(ROOT/'scripts/peering-launch.py'),str(path),str(daemon)],env=env,capture_output=True,text=True)
    assert proc.returncode==0,proc.stderr
    data=json.loads(proc.stdout);assert data['N2N_DISPLAY_NAME']==value
    assert json.loads(data['NETCLAW_BGP_PEERS'])==[{'ip':'127.0.0.1','as':65000}]
    assert data['UNRELATED_TOKEN'] is None


def test_checkpoint_pruning_decodes_empty_values_and_retains_private_original(tmp_path):
    import json
    source=(ROOT/'scripts/checkpoint-enable.sh').read_text()
    match=re.search(r"CHKP_PRUNE_ENV=.*? <<'PY'\n(.*?)\nPY",source,re.S)
    assert match
    config=tmp_path/'openclaw.json'
    data={'mcp':{'servers':{'chkp-management':{'env':{'API_KEY':'${CHKP_MGMT_API_KEY}','S1C_URL':'${CHKP_S1C_URL}'}}}},'private_fixture':'preserve'}
    config.write_text(json.dumps(data));original=config.read_bytes()
    envpath=tmp_path/'.env';writer.update(envpath,'CHKP_MGMT_API_KEY','fixture-key');writer.update(envpath,'CHKP_S1C_URL','')
    proc=subprocess.run(['python3','-',str(config)],input=match[1],env={**os.environ,'CHKP_PRUNE_ENV':str(envpath),'CHKP_SCRIPT_DIR':str(ROOT/'scripts')},capture_output=True,text=True)
    assert proc.returncode==0,proc.stderr
    assert 'S1C_URL' not in json.loads(config.read_text())['mcp']['servers']['chkp-management']['env']
    assert config.stat().st_mode&0o777==0o600
    backups=list((tmp_path/'.setup-backups').glob('*'));assert len(backups)==1
    assert backups[0].read_bytes()==original and backups[0].stat().st_mode&0o777==0o600


@pytest.mark.parametrize('stage',['dependencies','build','verification'])
def test_checkpoint_required_failure_is_not_success(tmp_path,stage):
    repo,home=fixture_checkout(tmp_path,'checkpoint-enable.sh')
    (repo/'mcp-servers/checkpoint-mcp-servers').mkdir()
    bins=tmp_path/'bin';bins.mkdir()
    for name,code in {'node':'echo v22.0.0','git':'exit 0','npm':f'case "$*" in install*) [ "{stage}" != dependencies ];; *build*) [ "{stage}" != build ];; esac'}.items():
        p=bins/name;p.write_text('#!/bin/sh\n'+code+'\n');p.chmod(0o700)
    proc=subprocess.run(['bash',str(repo/'scripts/checkpoint-enable.sh')],input='n\n',env={**os.environ,'HOME':str(home),'PATH':str(bins)+os.pathsep+os.environ['PATH']},capture_output=True,text=True,timeout=15)
    assert proc.returncode!=0
    assert 'Integration Complete' not in proc.stdout
    if stage!='verification':assert not (home/'.openclaw/.env').exists()


class FakeForwardMcp:
    """Local stand-in for Forward's /api/mcp: records requests, answers with `status`.

    `sessions` makes it a strict stateful server: it issues an Mcp-Session-Id on initialize and
    rejects tools/list unless that id came back and notifications/initialized was sent first.
    """
    def __init__(self, status, sessions=False):
        import http.server, json, threading
        outer=self;self.status=status;self.requests=[];self.initialized=False
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                outer.requests.append((self.path,self.headers.get('Authorization'),body['method']))
                if body['method']=='notifications/initialized' and outer.status==200:
                    outer.initialized=True;self.send_response(202);self.send_header('Content-Length','0');self.end_headers();return
                if self.path!='/api/mcp':
                    self.send_response(200);self.send_header('Content-Length','0');self.end_headers();return
                if 300<=outer.status<400:
                    self.send_response(outer.status);self.send_header('Location','/elsewhere');self.send_header('Content-Length','0');self.end_headers();return
                if outer.status!=200:
                    data=json.dumps({'message':'MCP is not enabled for this organization','status':str(outer.status)}).encode()
                    self.send_response(outer.status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
                if sessions and body['method']=='tools/list' and (self.headers.get('Mcp-Session-Id')!='sess-1' or not outer.initialized):
                    self.send_response(400);self.send_header('Content-Length','0');self.end_headers();return
                result={'initialize':{'serverInfo':{'name':'fake-forward','version':'1'}},'tools/list':{'tools':[{'name':'get_paths'},{'name':'get_device'}]}}[body['method']]
                data=json.dumps({'jsonrpc':'2.0','id':body['id'],'result':result}).encode()
                self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)))
                if sessions and body['method']=='initialize':self.send_header('Mcp-Session-Id','sess-1')
                self.end_headers();self.wfile.write(data)
            def log_message(self,*args):pass
        self.server=http.server.HTTPServer(('127.0.0.1',0),Handler)
        self.url=f'http://127.0.0.1:{self.server.server_port}'
        threading.Thread(target=self.server.serve_forever,daemon=True).start()
    def close(self):
        self.server.shutdown();self.server.server_close()


def clean_env(home):
    # Loopback fixtures must never be routed through a developer's proxy.
    env={k:v for k,v in os.environ.items() if k.lower() not in ('http_proxy','https_proxy','all_proxy','no_proxy')}
    return {**env,'HOME':str(home)}


def run_forward_enable(tmp_path,inputs):
    import shutil
    repo,home=fixture_checkout(tmp_path,'forward-enable.sh')
    shutil.copy2(ROOT/'scripts/forward-mcp-check.py',repo/'scripts/forward-mcp-check.py')
    proc=subprocess.run(['bash',str(repo/'scripts/forward-enable.sh')],input=inputs,env=clean_env(home),capture_output=True,text=True,timeout=30,check=False)
    return proc,home/'.openclaw/.env'


def run_forward_check(tmp_path,url,auth='a2V5OnNlY3JldA=='):
    return subprocess.run([sys.executable,str(ROOT/'scripts/forward-mcp-check.py')],env={**clean_env(tmp_path),'FORWARD_URL':url,'FORWARD_AUTH_BASE64':auth},capture_output=True,text=True,timeout=30,check=False)


def test_forward_enable_stores_basic_credential_and_verifies_endpoint(tmp_path):
    import base64
    server=FakeForwardMcp(200)
    try:
        proc,env=run_forward_enable(tmp_path,f'y\n{server.url}/api/mcp\naccess-key\nsecret&|$x\n')
    finally:server.close()
    assert proc.returncode==0,proc.stderr
    expected=base64.b64encode(b'access-key:secret&|$x').decode()
    stored=writer.values(env.read_text())
    assert stored['FORWARD_URL']==server.url
    assert stored['FORWARD_AUTH_BASE64']==expected
    assert server.requests==[('/api/mcp','Basic '+expected,m) for m in ('initialize','notifications/initialized','tools/list')]
    assert 'integration is installed.' in proc.stdout
    assert 'secret&|$x' not in proc.stdout+proc.stderr and expected not in proc.stdout+proc.stderr


@pytest.mark.parametrize('status',[401,403])
def test_forward_enable_rejected_endpoint_is_not_installed(tmp_path,status):
    server=FakeForwardMcp(status)
    try:
        proc,_=run_forward_enable(tmp_path,f'y\n{server.url}\naccess-key\nsecret\n')
    finally:server.close()
    assert proc.returncode!=0
    assert 'Smoke test failed' in proc.stdout
    assert f'HTTP {status}' in proc.stderr
    assert 'MCP is not enabled for this organization' in proc.stderr
    assert 'integration is installed.' not in proc.stdout


def test_forward_enable_skipped_credentials_do_not_claim_installed(tmp_path):
    proc,env=run_forward_enable(tmp_path,'n\n')
    assert proc.returncode==0,proc.stderr
    assert 'skipping the smoke test' in proc.stdout
    assert 'integration is installed.' not in proc.stdout
    assert 'FORWARD_AUTH_BASE64' not in writer.values(env.read_text())


def test_forward_enable_key_without_secret_is_not_stored(tmp_path):
    proc,env=run_forward_enable(tmp_path,'y\nhttps://fwd.example.com\naccess-key\n\n')
    assert proc.returncode==0,proc.stderr
    assert 'Both the access key and the secret are required' in proc.stdout
    assert 'FORWARD_AUTH_BASE64' not in writer.values(env.read_text())


def test_forward_check_completes_the_handshake_for_a_stateful_server(tmp_path):
    server=FakeForwardMcp(200,sessions=True)
    try:proc=run_forward_check(tmp_path,server.url)
    finally:server.close()
    assert proc.returncode==0,proc.stderr
    assert 'tools (2): get_device, get_paths' in proc.stdout


def test_forward_check_never_follows_a_redirect_with_the_credential(tmp_path):
    server=FakeForwardMcp(302)
    try:proc=run_forward_check(tmp_path,server.url)
    finally:server.close()
    assert proc.returncode!=0
    assert 'HTTP 302' in proc.stderr
    assert [r[0] for r in server.requests]==['/api/mcp']


def test_forward_check_refuses_plain_http_to_a_remote_host(tmp_path):
    proc=run_forward_check(tmp_path,'http://fwd.example.com')
    assert proc.returncode==2
    assert 'must be https' in proc.stderr


@pytest.mark.parametrize('url',['http://localhost.example.com','http://127.0.0.1.evil.example.com','http://fwd.example.com'])
def test_forward_enable_refuses_to_store_a_non_loopback_http_url(tmp_path,url):
    proc,env=run_forward_enable(tmp_path,f'y\n{url}\nkey\nsecret\n')
    assert 'must start with https://' in proc.stdout
    assert 'FORWARD_URL' not in writer.values(env.read_text())
