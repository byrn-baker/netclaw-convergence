from pathlib import Path
import importlib.util, os, re, subprocess
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


def test_forward_failed_smoke_is_not_installed(tmp_path):
    repo,home=fixture_checkout(tmp_path,'forward-enable.sh')
    (repo/'scripts/mcp-call.py').write_text('raise SystemExit(7)\n')
    forward=repo/'mcp-servers/forward-mcp';(forward/'.git').mkdir(parents=True)
    bins=tmp_path/'bin';bins.mkdir()
    for name,code in {'git':'exit 0','go':'case "$1" in version) echo "go version go1.25.0 linux/amd64";; env) echo 1;; esac'}.items():
        p=bins/name;p.write_text('#!/bin/sh\n'+code+'\n');p.chmod(0o700)
    proc=subprocess.run(['bash',str(repo/'scripts/forward-enable.sh')],input='n\n',env={**os.environ,'HOME':str(home),'PATH':str(bins)+os.pathsep+os.environ['PATH']},capture_output=True,text=True,timeout=15)
    assert proc.returncode!=0
    assert 'Smoke test failed' in proc.stdout
    assert 'integration is installed.' not in proc.stdout
