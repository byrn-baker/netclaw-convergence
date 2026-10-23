"""Installer environment values remain literal and writes stay private."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('env_writer', ROOT/'scripts/write-env.py')
writer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(writer)

@pytest.mark.parametrize('value', ['plain', '/path with spaces', 'a&b|c\\d', 'quote\'"`$(false); # literal', ''])
def test_literal_dotenv_roundtrip_and_private_atomic_write(tmp_path, value):
    path = tmp_path/'.env'
    path.write_text('# keep comment\nOTHER=untouched\nTEST=old\nexport TEST=older\n')
    writer.update(path, 'TEST', value)
    after = path.read_bytes()
    writer.update(path, 'TEST', value)
    assert path.read_bytes() == after
    assert path.stat().st_mode & 0o777 == 0o600
    assert path.read_text().count('TEST=') == 1
    from dotenv import dotenv_values
    assert dotenv_values(path, interpolate=False)['TEST'] == value
    assert writer.values(path.read_text())['TEST'] == value
    assert '# keep comment\nOTHER=untouched\n' in path.read_text()


def test_refuses_invalid_input_and_symlinks(tmp_path):
    path = tmp_path/'.env';path.write_text('ORIGINAL=yes\n')
    for key, value in [('X;false', 'yes'), ('GOOD', 'a\nEVIL=true'), ('GOOD', '\0')]:
        with pytest.raises(ValueError):writer.update(path, key, value)
    link = tmp_path/'link';link.symlink_to(path)
    with pytest.raises(ValueError):writer.update(link, 'GOOD', 'yes')
    assert path.read_text() == 'ORIGINAL=yes\n'


def test_shell_helper_uses_atomic_writer(tmp_path):
    path = tmp_path/'space directory/.env'
    result = subprocess.run(['bash', '-c', 'source scripts/lib/common.sh; RUNTIME_ENV="$FIXTURE_ENV"; _set_env_var TEST "$FIXTURE_VALUE"'], cwd=ROOT,
        env={**os.environ, 'FIXTURE_ENV':str(path), 'FIXTURE_VALUE':'literal & value|with spaces'}, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert path.stat().st_mode & 0o777 == 0o600
    assert writer.values(path.read_text())['TEST'] == 'literal & value|with spaces'
