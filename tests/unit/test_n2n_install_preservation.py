"""Actual N2N component, isolated paths and a non-network package installer."""
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def run_component(tmp_path, fail=False):
    mcp=tmp_path/'mcp'
    for name in ('n2n-mcp','protocol-mcp'):
        (mcp/name).mkdir(parents=True,exist_ok=True)
        (mcp/name/'requirements.txt').touch()
    script='''
source scripts/lib/common.sh
source scripts/lib/install-steps.sh
MCP_DIR="$FIXTURE_MCP"
RUNTIME_ENV="$FIXTURE_ENV"
netclaw_pip_install() { return "$FIXTURE_RC"; }
component_install_n2n || exit $?
_in2n_setenv N2N_RISK_NAME 'lab & primary | literal'
'''
    return subprocess.run(['bash','-c',script],cwd=ROOT,capture_output=True,text=True,
        env={**os.environ,'FIXTURE_MCP':str(mcp),'FIXTURE_ENV':str(tmp_path/'runtime/.env'),
             'FIXTURE_RC':'1' if fail else '0'})


def test_failed_dependencies_do_not_configure_success(tmp_path):
    result=run_component(tmp_path,fail=True)
    assert result.returncode != 0
    assert not (tmp_path/'runtime/.env').exists()


def test_runtime_settings_are_literal_private_and_preserved(tmp_path):
    path=tmp_path/'runtime/.env';path.parent.mkdir()
    path.write_text('export N2N_ENABLED=false\nN2N_DISPLAY_NAME="operator name"\n')
    for _ in range(2):
        result=run_component(tmp_path)
        assert result.returncode == 0,result.stderr
    text=path.read_text()
    assert 'export N2N_ENABLED=false' in text
    assert 'N2N_DISPLAY_NAME="operator name"' in text
    assert 'N2N_RISK_NAME="lab & primary | literal"' in text
    assert path.stat().st_mode & 0o777 == 0o600
