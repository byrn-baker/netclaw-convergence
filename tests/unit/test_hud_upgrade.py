"""The scoped upgrader must not perform an implicit install or modify runtime state."""
import os
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'scripts/upgrade-hud.sh'


def test_help_and_invalid_install_do_not_require_runtime_or_mutate_home(tmp_path):
    env = {**os.environ, 'HOME': str(tmp_path)}
    before = list(tmp_path.iterdir())
    help_result = subprocess.run(['bash', str(SCRIPT), '--help'], env=env, text=True, capture_output=True)
    assert help_result.returncode == 0
    assert '--check' in help_result.stdout and '--apply' in help_result.stdout
    refused = subprocess.run(['bash', str(SCRIPT), '--install-deps'], env=env, text=True, capture_output=True)
    assert refused.returncode == 2
    assert 'requires --apply' in refused.stderr
    assert list(tmp_path.iterdir()) == before


def test_missing_entry_stops_before_any_install_or_build(tmp_path):
    env = {**os.environ, 'HOME': str(tmp_path / 'home')}
    result = subprocess.run(['bash', str(SCRIPT), '--repo', str(tmp_path), '--apply'], env=env, text=True, capture_output=True)
    assert result.returncode != 0
    assert 'Missing HUD source' in result.stderr or 'Missing prerequisite' in result.stderr or 'Node.js 22+' in result.stderr
    assert not (tmp_path/'home').exists()
