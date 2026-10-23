"""Reproduce full-log installer defects without downloads, sudo or device calls."""
import os
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]


def run(tmp_path, body, **extra):
    return subprocess.run(['/bin/bash', '-c', '''set -eu
source scripts/lib/common.sh
source scripts/lib/install-steps.sh
''' + body], cwd=ROOT, env={**os.environ, 'NETCLAW_PY': sys.executable,
        'FIXTURE_ROOT': str(tmp_path), **extra}, capture_output=True, text=True, timeout=10)


@pytest.mark.parametrize('component', ['anta', 'multivendor_cli', 'zabbix', 'percepxion', 'slc', 'jev'])
@pytest.mark.parametrize('failure', [0, 23])
def test_dedicated_components_use_selected_runtime_and_propagate_failure(tmp_path, component, failure):
    for directory in ('anta-mcp', 'multivendor-cli-mcp', 'zabbix-mcp', 'percepxion-mcp-server', 'slc-mcp-server', 'jev-mcp'):
        folder = tmp_path / 'mcp-servers' / directory
        folder.mkdir(parents=True)
        (folder / 'requirements.txt').touch()
    venv = tmp_path / 'compatible/bin'
    venv.mkdir(parents=True)
    (venv / 'python').write_text('#!/bin/sh\nexit 0\n')
    (venv / 'python').chmod(0o700)
    result = run(tmp_path, '''
NETCLAW_DIR="$FIXTURE_ROOT"
MCP_DIR="$FIXTURE_ROOT/mcp-servers"
RUNTIME_ENV="$FIXTURE_ROOT/.env"
clone_or_pull() { :; }
_set_env_default() { :; }
netclaw_component_venv() { NETCLAW_COMPONENT_VENV="$FIXTURE_ROOT/compatible"; }
netclaw_pip_install() {
    echo "$NETCLAW_VENV" >> "$FIXTURE_ROOT/pip-targets"
    return "$FIXTURE_FAILURE"
}
virtualenv() { echo unexpected-virtualenv >&2; return 42; }
component_install_"$FIXTURE_COMPONENT"
''', FIXTURE_COMPONENT=component, FIXTURE_FAILURE=str(failure))
    assert (result.returncode == 0) == (failure == 0), result.stdout + result.stderr
    assert (tmp_path / 'pip-targets').read_text().strip() == str(venv.parent)
    assert 'unexpected-virtualenv' not in result.stderr
    if failure:
        assert 'MCP prepared:' not in result.stdout
        assert 'Multivendor CLI Driver ready' not in result.stdout


@pytest.mark.parametrize('failure_stage', ['dependencies', 'generation', 'none'])
def test_certification_dependencies_runtime_and_failure_reporting(tmp_path, failure_stage):
    cert_python = tmp_path / 'certificate-python'
    cert_python.write_text('#!/bin/sh\ncat >/dev/null\necho certificate-python-used\nexit "$FIXTURE_GENERATION_FAILURE"\n')
    cert_python.chmod(0o700)
    records = tmp_path / 'runtimes/records'
    records.mkdir(parents=True)
    (records / 'claw-certs').write_text(str(cert_python) + '\n')
    result = run(tmp_path, '''
NETCLAW_INSTALL_COMPONENT=claw-certs
NETCLAW_RUNTIME_ROOT="$FIXTURE_ROOT/runtimes"
netclaw_pip_install() { echo "$*"; return "$FIXTURE_DEPENDENCY_FAILURE"; }
bash() { echo fixture-lego-fetch; }
python3() { echo unexpected-system-python >&2; return 42; }
component_install_claw_certs
''', FIXTURE_DEPENDENCY_FAILURE='23' if failure_stage == 'dependencies' else '0',
        FIXTURE_GENERATION_FAILURE='23' if failure_stage == 'generation' else '0')
    assert (result.returncode == 0) == (failure_stage == 'none'), result.stdout + result.stderr
    assert 'cryptography>=46' in result.stdout
    assert 'unexpected-system-python' not in result.stderr
    assert 'log_success: command not found' not in result.stderr
    assert ('Claw Certification installed.' in result.stdout) == (failure_stage == 'none')
    if failure_stage == 'dependencies':
        assert 'fixture-lego-fetch' not in result.stdout
        assert 'certificate-python-used' not in result.stdout
    else:
        assert 'certificate-python-used' in result.stdout


def test_gtrace_macos_parsing_and_denied_install_do_not_claim_success(tmp_path):
    result = run(tmp_path, r'''
uname() { if [ "${1:-}" = -m ]; then echo arm64; else echo Darwin; fi; }
go() { if [ "$1" = version ]; then echo 'go version go1.23.2 darwin/arm64'; else return 1; fi; }
curl() {
    case "$*" in
        *releases/latest*) printf '{"tag_name":"v1.2.3"}' ;;
        *) while [ $# -gt 0 ]; do
             if [ "$1" = -o ]; then touch "$2"; break; fi
             shift
           done ;;
    esac
}
tar() { touch "$4/gtrace"; }
sudo() { echo fixture-sudo-denied >&2; return 1; }
component_install_gtrace
''')
    assert result.returncode != 0, result.stdout + result.stderr
    assert 'fixture-sudo-denied' in result.stderr
    assert 'invalid option' not in result.stderr
    assert 'installed from GitHub release' not in result.stdout
    assert 'Could not install gtrace' in result.stdout


def test_gtrace_bad_release_metadata_aborts_without_sudo(tmp_path):
    result = run(tmp_path, '''
go() { return 1; }
curl() { echo invalid-json; }
sudo() { echo unexpected-sudo; return 42; }
component_install_gtrace
''')
    assert result.returncode != 0
    assert 'Could not read the gtrace release tag' in result.stdout
    assert 'unexpected-sudo' not in result.stdout


@pytest.mark.parametrize('component', ['anta', 'multivendor_cli'])
def test_failed_imports_fail_component_after_dependency_install(tmp_path, component):
    directory = 'anta-mcp' if component == 'anta' else 'multivendor-cli-mcp'
    source = tmp_path / 'mcp-servers' / directory
    source.mkdir(parents=True)
    (source / 'requirements.txt').touch()
    runtime = tmp_path / 'compatible/bin'
    runtime.mkdir(parents=True)
    (runtime / 'python').write_text('#!/bin/sh\nexit 42\n')
    (runtime / 'python').chmod(0o700)
    result = run(tmp_path, '''
NETCLAW_DIR="$FIXTURE_ROOT"
clone_or_pull() { :; }
netclaw_component_venv() { NETCLAW_COMPONENT_VENV="$FIXTURE_ROOT/compatible"; }
netclaw_pip_install() { return 0; }
component_install_"$FIXTURE_COMPONENT"
''', FIXTURE_COMPONENT=component)
    assert result.returncode != 0
    assert 'imports failed' in result.stdout
    assert 'Multivendor CLI Driver ready' not in result.stdout
