import importlib.util
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('zoom_migration',ROOT/'scripts/migrate-zoom-auth.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)

def test_migrate_zoom_preserves_secrets_and_restores(tmp_path,capsys):
    p=tmp_path/'.env';original=b'ZOOM_CLIENT_ID=fixture-id\nZOOM_CLIENT_SECRET=fixture-secret\nZOOM_RTMS_WEBHOOK_SECRET=fixture-webhook-secret\nUNRELATED=keep\n';p.write_bytes(original)
    m.migrate(p);assert p.read_bytes()==original
    m.migrate(p,apply=True);changed=p.read_bytes()
    assert b'UNRELATED=keep' in changed and b'ZOOM_CLIENT_SECRET=fixture-secret' in changed
    assert p.stat().st_mode&0o777==0o600
    m.migrate(p,apply=True);assert p.read_bytes()==changed
    m.migrate(p,restore=True,apply=True);assert p.read_bytes()==original
    assert 'fixture-secret' not in capsys.readouterr().out

def test_migration_rejects_existing_backup_and_symlink(tmp_path,monkeypatch):
    p=tmp_path/'.env';p.write_text('UNRELATED=keep\n')
    for key in m.KEYS:monkeypatch.setenv(key,'fixture')
    backup=p.with_name('.env.pre-zoom-auth');backup.write_text('prior')
    with pytest.raises(FileExistsError):m.migrate(p,apply=True)
    assert p.read_text()=='UNRELATED=keep\n'
    backup.unlink();backup.symlink_to(p)
    with pytest.raises(ValueError):m.migrate(p,apply=True)
