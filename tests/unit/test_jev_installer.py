"""Jev setup stays opt-in, private and isolated; no provider calls in these tests."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('jev_settings', ROOT/'scripts/jev-settings.py')
settings = importlib.util.module_from_spec(spec)
spec.loader.exec_module(settings)


def test_declining_setup_preserves_key_and_disables(tmp_path, monkeypatch):
    env = tmp_path/'.env'
    env.write_text('TYPESAFE_API_KEY=existing-secret\nOTHER=keep\n')
    monkeypatch.setattr('builtins.input', lambda _: '')
    settings.setup(env, tmp_path/"data")
    values = settings.writer.values(env.read_text())
    assert values == {'TYPESAFE_API_KEY':'existing-secret', 'OTHER':'keep', 'JEV_ENABLED':'false'}
    assert env.stat().st_mode & 0o777 == 0o600


def test_setup_local_requires_price_and_keeps_key_out_of_output(tmp_path, monkeypatch, capsys):
    answers = iter(['y', 'http://localhost:8080', '5', '.25', '0', 'local-model'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    monkeypatch.setattr(settings.getpass, 'getpass', lambda _: 'private-key')
    env = tmp_path/'.env'
    settings.setup(env, tmp_path/"data")
    values = settings.writer.values(env.read_text())
    assert values['JEV_ENABLED'] == 'true'
    assert values['JEV_INPUT_PRICE_PER_MILLION'] == '0.0'
    assert values['JEV_COMPATIBLE_API_KEY'] == 'private-key'
    assert values['JEV_COMPATIBLE_KEY_ENDPOINT'] == 'http://localhost:8080/v1/systemone'
    assert 'TYPESAFE_API_KEY' not in values
    assert 'private-key' not in capsys.readouterr().out


@pytest.mark.parametrize('value', ['nan', 'inf', '-1'])
def test_invalid_limits_rejected(value):
    with pytest.raises(Exception):
        settings.money(value)


def test_operator_overrides_preserve_settings_and_spend(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "refresh_status", lambda *_: None)
    data = tmp_path/'data'; data.mkdir()
    path = data/'settings.json'
    path.write_text('{"task_id":"existing"}')
    ledger = data/'ledger.sqlite3'; ledger.write_bytes(b'untouched')
    assert settings.main(['--env-file',str(tmp_path/'.env'),'--data-dir',str(data),'limits','--daily','8','--case','.5','--task','incident-1']) == 0
    result = json.loads(path.read_text())
    assert result == {'task_id':'existing', 'daily_limit_usd':8, 'case_overrides':{'incident-1':.5}}
    assert ledger.read_bytes() == b'untouched'
    assert path.stat().st_mode & 0o777 == 0o600


def run_component(tmp_path, fail=False):
    repo = tmp_path/'repo'; server = repo/'mcp-servers/jev-mcp'
    server.mkdir(parents=True); (server/'requirements.txt').touch()
    script = '''
source scripts/lib/common.sh
source scripts/lib/install-steps.sh
NETCLAW_DIR="$FIXTURE_REPO"
RUNTIME_ENV="$FIXTURE_ENV"
netclaw_component_venv() {
    test "$1" = "$FIXTURE_REPO/mcp-servers/jev-mcp/.venv" || return 9
    NETCLAW_COMPONENT_VENV="$1"
}
netclaw_pip_install() { test "$NETCLAW_VENV" = "$FIXTURE_REPO/mcp-servers/jev-mcp/.venv" || return 9; return "$FIXTURE_RC"; }
component_install_jev
'''
    return subprocess.run(['bash','-c',script],cwd=ROOT,capture_output=True,text=True,
        env={**os.environ,'FIXTURE_REPO':str(repo),'FIXTURE_ENV':str(tmp_path/'.env'),'FIXTURE_RC':'1' if fail else '0'})


def test_noninteractive_install_never_enables_calls(tmp_path):
    result = run_component(tmp_path)
    assert result.returncode == 0, result.stderr
    values = settings.writer.values((tmp_path/'.env').read_text())
    assert values == {'JEV_ENABLED':'false', 'JEV_DAILY_LIMIT_USD':'5', 'JEV_CASE_LIMIT_USD':'0.25'}


def test_dependency_failure_does_not_write_configuration(tmp_path):
    result = run_component(tmp_path, fail=True)
    assert result.returncode != 0
    assert not (tmp_path/'.env').exists()


@pytest.mark.parametrize('url', ['http://remote.example/v1/systemone', 'https://name:secret@example.com', 'https://example.com?api_key=secret'])
def test_setup_rejects_unsafe_endpoint(url):
    with pytest.raises(ValueError):
        settings.endpoint(url)


def test_invalid_setup_never_activates(tmp_path, monkeypatch):
    answers = iter(['y', 'http://localhost:8080', 'nan'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    monkeypatch.setattr(settings.getpass, 'getpass', lambda _: '')
    env = tmp_path/'.env'
    with pytest.raises(Exception):
        settings.setup(env, tmp_path/'data')
    assert not env.exists()


def test_setup_updates_existing_operator_caps(tmp_path, monkeypatch):
    data = tmp_path/'data'; data.mkdir()
    path = data/'settings.json'
    path.write_text('{"daily_limit_usd": 100, "case_limit_usd": 10, "case_overrides": {"old-task": 1}}')
    answers = iter(['y', 'http://localhost:8080', '5', '.25', '0', 'local'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    monkeypatch.setattr(settings.getpass, 'getpass', lambda _: '')
    settings.setup(tmp_path/'.env', data)
    assert json.loads(path.read_text()) == {'daily_limit_usd':5, 'case_limit_usd':.25, 'case_overrides':{'old-task':1}}


def test_task_binding_preserves_existing_totals_and_caps(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'refresh_status', lambda *_: None)
    data = tmp_path/'data'; data.mkdir()
    path = data/'settings.json'; path.write_text('{"daily_limit_usd": 5}')
    ledger = data/'ledger.sqlite3'; ledger.write_bytes(b'preexisting spending')
    assert settings.main(['--env-file',str(tmp_path/'.env'),'--data-dir',str(data),'task','incident-42']) == 0
    assert json.loads(path.read_text()) == {'daily_limit_usd':5, 'task_id':'incident-42'}
    assert ledger.read_bytes() == b'preexisting spending'


def test_task_id_validation(tmp_path):
    assert settings.main(['--env-file',str(tmp_path/'.env'),'--data-dir',str(tmp_path/'data'),'task','bad\nidentity']) == 1
    assert not (tmp_path/'data/settings.json').exists()


def test_real_ledger_cli_binding_limits_and_scoped_grant(tmp_path, monkeypatch):
    import sqlite3
    import datetime
    for name in list(os.environ):
        if name.startswith('JEV_') or name == 'TYPESAFE_API_KEY':
            monkeypatch.delenv(name)
    data = tmp_path/'data'
    base = ['--env-file',str(tmp_path/'.env'),'--data-dir',str(data)]
    assert settings.main(base+['task','task-1']) == 0
    db = sqlite3.connect(data/'ledger.sqlite3')
    day = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    db.execute('INSERT INTO calls VALUES (?,?,?,?,?,?,?,?)', ('existing',day,'task-1',.1,None,'a'*64,'ok','{}'))
    db.commit()
    assert settings.main(base+['limits','--daily','6','--case','.5']) == 0
    assert settings.main(base+['task','task-2']) == 0
    snapshot = json.loads((data/'status.json').read_text())
    assert snapshot['budgets']['daily_used_usd'] == .1
    assert snapshot['budgets']['case_used_usd'] == 0
    assert settings.main(base+['task','task-1']) == 0
    snapshot = json.loads((data/'status.json').read_text())
    assert snapshot['budgets']['case_used_usd'] == .1
    assert settings.main(base+['approve-disclosure','b'*64,'--endpoint','https://api.typesafe.ai/v1/systemone','--task','task-1']) == 0
    grant = db.execute('SELECT digest,task_id,endpoint,consumed FROM grants').fetchone()
    assert grant == ('b'*64,'task-1','https://api.typesafe.ai/v1/systemone',0)
    db.close()


@pytest.mark.parametrize('same_endpoint', [False, True])
def test_endpoint_switch_never_reuses_unbound_credentials(tmp_path, monkeypatch, same_endpoint):
    env = tmp_path/'.env'
    destination = 'https://compatible.example/v1/systemone'
    previous = destination if same_endpoint else 'https://old-service.example/v1/systemone'
    env.write_text('TYPESAFE_API_KEY=hosted-secret\nJEV_COMPATIBLE_API_KEY=compatible-secret\nJEV_COMPATIBLE_KEY_ENDPOINT='+previous+'\n')
    answers = iter(['y', destination, '5', '.25', '0', 'local'])
    monkeypatch.setattr('builtins.input', lambda _: next(answers))
    monkeypatch.setattr(settings.getpass, 'getpass', lambda _: '')
    settings.setup(env, tmp_path/'data')
    values = settings.writer.values(env.read_text())
    assert values['TYPESAFE_API_KEY'] == 'hosted-secret'
    assert values['JEV_COMPATIBLE_API_KEY'] == ('compatible-secret' if same_endpoint else '')
    assert values['JEV_COMPATIBLE_KEY_ENDPOINT'] == destination


def test_installer_jev_prompts_are_not_redirected_to_hidden_log(tmp_path):
    import re
    source = (ROOT/'scripts/install.sh').read_text()
    interactive = re.search(r'^INTERACTIVE_COMPONENTS=.*$', source, re.M).group()
    runner = source[source.index('run_component() {'):source.index('\nFAILED_COMPONENTS=', source.index('run_component() {'))]
    script = interactive+'\n'+runner+'''
INSTALL_LOG_DIR="$FIXTURE_LOG"
NETCLAW_VERBOSE=0
log_info() { :; }
log_warn() { :; }
log_error() { :; }
fixture_component() { echo visible-setup-prompt; }
run_component jev fixture_component Jev
'''
    result = subprocess.run(['bash','-c',script],capture_output=True,text=True,
        env={**os.environ,'FIXTURE_LOG':str(tmp_path)})
    assert result.returncode == 0
    assert 'visible-setup-prompt' in result.stdout
    assert not (tmp_path/'jev.log').exists()
