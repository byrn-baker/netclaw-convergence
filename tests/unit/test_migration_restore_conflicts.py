"""A rollback must not silently overwrite edits made after a migration."""
import importlib.util
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location('migration_restore', Path(__file__).resolve().parents[2] / 'scripts/migrate-voice-auth.py')
helpers = importlib.util.module_from_spec(spec); spec.loader.exec_module(helpers)


def fixture(tmp_path):
    path, backup = tmp_path / '.env', tmp_path / '.env.backup'
    path.write_bytes(b'UNCHANGED=original\n')
    backup.write_bytes(path.read_bytes())
    return path, backup


def test_restore_preview_repeat_and_private_journal(tmp_path):
    path, backup = fixture(tmp_path)
    helpers.write_migrated(path, b'UNCHANGED=original\nNEW=synthetic-secret\n', backup)
    journal = backup.with_name(backup.name + '.state.json')
    assert journal.stat().st_mode & 0o777 == 0o600
    assert 'synthetic-secret' not in journal.read_text()
    helpers.restore_backup(path, backup)
    assert b'NEW=' in path.read_bytes()
    helpers.restore_backup(path, backup, True)
    assert path.read_bytes() == backup.read_bytes()
    helpers.restore_backup(path, backup, True)
    assert path.read_bytes() == backup.read_bytes()


def test_later_edits_and_legacy_backup_refused(tmp_path):
    path, backup = fixture(tmp_path)
    helpers.write_migrated(path, b'NEW=synthetic\n', backup)
    path.write_bytes(path.read_bytes() + b'OTHER_MIGRATION=preserve\n')
    later = path.read_bytes()
    for apply in (False, True):
        with pytest.raises(ValueError, match='changed after'):
            helpers.restore_backup(path, backup, apply)
        assert path.read_bytes() == later
    backup.with_name(backup.name + '.state.json').unlink()
    with pytest.raises(ValueError, match='Legacy'):
        helpers.restore_backup(path, backup, True)
    assert path.read_bytes() == later


def test_interrupted_apply_keeps_original_restorable(tmp_path, monkeypatch):
    path, backup = fixture(tmp_path)
    write = helpers.write_atomic
    def fail(*args):
        raise OSError('synthetic full disk')
    monkeypatch.setattr(helpers, 'write_atomic', fail)
    with pytest.raises(OSError):
        helpers.write_migrated(path, b'NEW=fixture\n', backup)
    assert path.read_bytes() == backup.read_bytes()
    monkeypatch.setattr(helpers, 'write_atomic', write)
    helpers.restore_backup(path, backup, True)
    assert path.read_bytes() == backup.read_bytes()
