import importlib.util
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('in2n_migration',ROOT/'scripts/migrate-in2n-transport.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

def test_local_preview_apply_restore(tmp_path):
    p=tmp_path/'.env';original=b'OTHER=fixture\nN2N_IN2N_PORT=8178\n';p.write_bytes(original)
    m.migrate(p);assert p.read_bytes()==original
    m.migrate(p,apply=True);changed=p.read_bytes();assert b'N2N_IN2N_BIND=127.0.0.1' in changed and original in changed
    assert p.stat().st_mode&0o777==0o600
    m.migrate(p,apply=True);assert p.read_bytes()==changed
    m.migrate(p,restore=True,apply=True);assert p.read_bytes()==original

def test_remote_without_valid_cert_is_rejected_before_writes(tmp_path):
    p=tmp_path/'.env';p.write_text('OTHER=fixture\n')
    with pytest.raises(ValueError):m.migrate(p,bind='0.0.0.0',apply=True)
    with pytest.raises(OSError):m.migrate(p,bind='0.0.0.0',cert='/nonexistent/cert',key='/nonexistent/key',apply=True)
    assert p.read_text()=='OTHER=fixture\n'
    assert not p.with_name('.env.pre-in2n-tls').exists()
