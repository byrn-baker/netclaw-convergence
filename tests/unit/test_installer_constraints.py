import importlib.util
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('dependency_scan',ROOT/'scripts/check-dependency-pins.py')
scan=importlib.util.module_from_spec(spec);spec.loader.exec_module(scan)

def test_effective_constraints_require_enforcement(tmp_path,monkeypatch):
    (tmp_path/'scripts/lib').mkdir(parents=True);(tmp_path/'config').mkdir()
    helper=tmp_path/'scripts/lib/pip-helper.sh';helper.write_text('no enforcement')
    (tmp_path/'config/python-shared-constraints.txt').write_text('mcp>=1,<2\n')
    monkeypatch.setattr(scan,'REPO_ROOT',str(tmp_path))
    assert scan.shared_constraints()=={}
    helper.write_text('set -- -c "$NETCLAW_SHARED_CONSTRAINTS" "$@"')
    assert scan.shared_constraints()=={'mcp':'>=1,<2'}

def test_pip_constraints_target_shared_only(tmp_path):
    fake=tmp_path/'python';log=tmp_path/'args'
    fake.write_text('#!/bin/sh\ncase "$*" in *--version*) exit 0;; esac\nprintf "%s\\n" "$@" > "$INSTALL_ARGS"\n')
    fake.chmod(0o755)
    env=dict(os.environ,NETCLAW_PY=str(fake),INSTALL_ARGS=str(log));env.pop('NETCLAW_VENV',None)
    command=['bash','-c','source "$1/scripts/lib/pip-helper.sh"; netclaw_pip_install example','probe',str(ROOT)]
    subprocess.run(command,env=env,check=True,capture_output=True)
    args=log.read_text();assert '-c\n' in args and 'python-shared-constraints.txt' in args
    venv=tmp_path/'venv';(venv/'bin').mkdir(parents=True);(venv/'bin/python').symlink_to(fake)
    subprocess.run(command,env=dict(env,NETCLAW_VENV=str(venv)),check=True,capture_output=True)
    assert '-c\n' not in log.read_text()

def test_default_interpreter_matches_path():
    env=dict(os.environ);env.pop('NETCLAW_PY',None);env.pop('NETCLAW_VENV',None)
    p=subprocess.run(['bash','-c','source "$1/scripts/lib/pip-helper.sh"; test "$NETCLAW_PY" = "$(command -v python3)"','probe',str(ROOT)],env=env)
    assert p.returncode==0


def test_uml_constraints_apply_only_in_its_isolated_runtime(tmp_path):
    runtime = tmp_path / 'runtimes/uml-component-bounds'
    (runtime / 'bin').mkdir(parents=True)
    (runtime / '.netclaw-managed').write_text('uml\n')
    python = runtime / 'bin/python'
    log = tmp_path / 'args'
    python.write_text('#!/bin/sh\ncase "$*" in *--version*) exit 0;; esac\nprintf "%s\\n" "$@" > "$INSTALL_ARGS"\n')
    python.chmod(0o700)
    env = dict(os.environ, NETCLAW_INSTALL_COMPONENT='uml',
        NETCLAW_RUNTIME_ROOT=str(runtime.parent), INSTALL_ARGS=str(log))
    env.pop('NETCLAW_VENV', None)
    subprocess.run(['bash', '-c', 'source scripts/lib/pip-helper.sh; netclaw_pip_install uml-mcp'],
        cwd=ROOT, env=env, check=True, capture_output=True)
    assert 'python-components/uml.txt' in log.read_text()
    assert 'python-shared-constraints.txt' not in log.read_text()
    assert not (tmp_path / 'runtimes/uml').exists()
    assert (tmp_path / 'runtimes/records/uml').read_text().strip() == str(python)
