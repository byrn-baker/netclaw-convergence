import importlib.util
from pathlib import Path
import pytest

spec=importlib.util.spec_from_file_location('change_migration',Path(__file__).resolve().parents[2]/'scripts/migrate-change-gates.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def test_preflight_preserves_state_and_missing_settings_block_apply(tmp_path,monkeypatch):
    for key in m.REQUIRED:monkeypatch.delenv(key,raising=False)
    p=tmp_path/'.env';p.write_text('OTHER=fixture\n')
    m.migrate(p)
    with pytest.raises(ValueError):m.migrate(p,apply=True)
    assert p.read_text()=='OTHER=fixture\n' and not p.with_name('.env.pre-change-gates').exists()

def test_migrate_restore_and_no_secret_output(tmp_path,monkeypatch,capsys):
    values=['https://snow.example','fixture-user','synthetic-secret']
    for key,value in zip(m.REQUIRED,values):monkeypatch.setenv(key,value)
    p=tmp_path/'.env';original=b'OTHER=fixture\nNETCLAW_LAB_MODE=true\n';p.write_bytes(original)
    m.migrate(p,apply=True);changed=p.read_bytes()
    assert b'OTHER=fixture' in changed and b'NETCLAW_LAB_MODE=false' in changed
    assert p.stat().st_mode & 0o777==0o600
    m.migrate(p,apply=True);assert p.read_bytes()==changed
    m.migrate(p,restore=True);assert p.read_bytes()==changed
    m.migrate(p,restore=True,apply=True);assert p.read_bytes()==original
    assert p.with_name('.env.pre-change-gates').read_bytes()==original
    assert 'synthetic-secret' not in capsys.readouterr().out
