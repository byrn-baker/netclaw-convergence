"""Exercise isolation and failure accounting without touching operator Python."""
import os
from pathlib import Path
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[2]


def run(tmp_path, body, **extra):
    return subprocess.run(['bash', '-c', 'set -eu\nsource scripts/lib/pip-helper.sh\n' + body],
        cwd=ROOT, env={**os.environ, 'NETCLAW_INSTALL_COMPONENT': 'gnmi',
            'NETCLAW_RUNTIME_ROOT': str(tmp_path / 'runtimes'),
            'NETCLAW_INSTALL_FAILURE_FILE': str(tmp_path / 'failure'),
            'NETCLAW_VENV': '', **extra}, capture_output=True, text=True, timeout=10)


def test_automatic_runtime_is_used_and_recorded(tmp_path):
    fake = tmp_path / 'fake-python'
    fake.write_text('#!/bin/sh\nexit 0\n')
    fake.chmod(0o700)
    result = run(tmp_path, '''
netclaw_venv_create() { mkdir -p "$1/bin"; cp "$FAKE_PY" "$1/bin/python"; }
netclaw_pip_install example
''', NETCLAW_PY='/nonexistent/system-python', FAKE_PY=str(fake))
    assert result.returncode == 0, result.stderr
    python = tmp_path / 'runtimes/gnmi-component-bounds/bin/python'
    assert (tmp_path / 'runtimes/records/gnmi').read_text().strip() == str(python)
    assert not (tmp_path / 'failure').exists()


@pytest.mark.parametrize('subshell', [False, True])
def test_swallowed_failure_is_recorded(tmp_path, subshell):
    call = '(netclaw_pip_install example)' if subshell else 'netclaw_pip_install example'
    result = run(tmp_path, 'netclaw_venv_create() { return 17; }\n' + call + ' || true\n')
    assert result.returncode == 0
    assert 'failed' in (tmp_path / 'failure').read_text()
    assert not (tmp_path / 'runtimes/records/gnmi').exists()


def test_suppressed_stderr_preserves_failure_detail(tmp_path):
    result = run(tmp_path, '''
netclaw_venv_create() { echo "fixture: seed installation failed" >&2; return 17; }
(netclaw_pip_install example 2>/dev/null) || true
''')
    assert result.returncode == 0
    assert 'fixture: seed installation failed' in (tmp_path / 'failure').read_text()


def test_unmanaged_environment_preserved(tmp_path):
    target = tmp_path / 'runtimes/gnmi-component-bounds'
    target.mkdir(parents=True)
    (target / 'operator-file').write_text('preserve me')
    result = run(tmp_path, 'netclaw_pip_install example')
    assert result.returncode != 0
    assert (target / 'operator-file').read_text() == 'preserve me'
    assert not (target / '.netclaw-managed').exists()


def test_explicit_environment_wins(tmp_path):
    target = tmp_path / 'dedicated/bin'
    target.mkdir(parents=True)
    python = target / 'python'
    python.write_text('#!/bin/sh\nexit 0\n')
    python.chmod(0o700)
    result = run(tmp_path, 'netclaw_pip_install example', NETCLAW_VENV=str(target.parent))
    assert result.returncode == 0, result.stderr
    assert (tmp_path / 'runtimes/records/gnmi').read_text().strip() == str(python)
    assert not (tmp_path / 'runtimes/gnmi-component-bounds').exists()
