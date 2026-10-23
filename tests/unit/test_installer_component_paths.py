"""Component paths must not depend on installing Claw Certification first."""
import os
from pathlib import Path
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize('component,variable,directory', [
    ('bgp_intel', 'BGP_INTEL_MCP_DIR', 'bgp-intel-mcp'),
    ('document', 'DOCUMENT_MCP_DIR', 'document-mcp'),
    ('fortinet', 'FORTINET_MCP_DIR', 'fortinet-mcp'),
    ('catc', 'CATC_MCP_DIR', 'catc-mcp'),
    ('zabbix', 'ZABBIX_MCP_DIR', 'zabbix-mcp'),
])
def test_component_path_without_prior_components(tmp_path, component, variable, directory):
    result = subprocess.run(['bash', '-c', '''
set -eu
unset REPO_ROOT
source scripts/lib/common.sh
source scripts/lib/install-steps.sh
NETCLAW_DIR="$FIXTURE_REPO"
component_install_"$FIXTURE_COMPONENT"
test "${!FIXTURE_VARIABLE}" = "$FIXTURE_REPO/mcp-servers/$FIXTURE_DIRECTORY"
'''], cwd=ROOT, env={**os.environ, 'FIXTURE_REPO': str(tmp_path),
        'FIXTURE_COMPONENT': component, 'FIXTURE_VARIABLE': variable,
        'FIXTURE_DIRECTORY': directory}, capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, result.stdout + result.stderr
