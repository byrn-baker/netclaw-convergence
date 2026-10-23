import json
import os
from pathlib import Path
import subprocess
import sys
import yaml
import importlib.util

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('hermes_writer', ROOT / 'scripts/write-env.py')
writer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(writer)


def test_hermes_literal_private_config_and_sidecar(tmp_path):
    source, env, config, sidecar = [tmp_path / name for name in ('source.json','.env','config.yaml','sidecar.yaml')]
    source.write_text(json.dumps({'mcpServers': {'fixture': {'command':'python3','env':{'FIXTURE_TOKEN':'${FIXTURE_TOKEN}'}}}}))
    value = 'literal "quotes" apostrophe\' dollar$ backslash\\ tab\t'
    writer.update(env, 'FIXTURE_TOKEN', value)
    config.write_text('operator: keep\n')
    command = [sys.executable,str(ROOT/'scripts/openclaw-to-hermes-mcp.py'),'--source',str(source),'--env',str(env),'--repo',str(ROOT),'--config',str(config),'--sidecar',str(sidecar)]
    for target in [config, sidecar]:
        result = subprocess.run(command,capture_output=True,text=True)
        assert result.returncode == 0, result.stderr
        data = yaml.safe_load(target.read_text())
        assert data['mcp_servers']['fixture']['env']['FIXTURE_TOKEN'] == value
        assert target.stat().st_mode & 0o777 == 0o600
    assert yaml.safe_load(config.read_text())['operator'] == 'keep'
    original = config.read_bytes()
    sidecar.unlink()
    victim = tmp_path / 'victim'
    victim.write_text('untouched')
    sidecar.symlink_to(victim)
    result = subprocess.run(command,capture_output=True,text=True)
    assert result.returncode != 0
    assert victim.read_text() == 'untouched'
    assert config.read_bytes() == original


def test_private_writer_failure_preserves_original(tmp_path, monkeypatch):
    config = tmp_path / 'config.json'
    config.write_text('original')
    def fail(*args): raise OSError('injected replacement failure')
    monkeypatch.setattr(writer.os, 'replace', fail)
    import pytest
    with pytest.raises(OSError): writer.write_private(config, 'replacement')
    assert config.read_text() == 'original'
    assert sorted(p.name for p in tmp_path.iterdir()) == ['config.json']
