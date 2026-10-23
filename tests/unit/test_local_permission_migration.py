import importlib.util
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location('permission_migration', Path(__file__).resolve().parents[2] / 'scripts/migrate-local-file-permissions.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


def test_preview_apply_repeat_restore_and_conflict(tmp_path):
    file, journal = tmp_path / 'config', tmp_path / 'journal'
    file.write_text('synthetic-secret'); file.chmod(0o644)
    module.migrate([file], journal)
    assert file.stat().st_mode & 0o777 == 0o644
    assert not journal.exists()
    module.migrate([file], journal, apply=True)
    assert file.stat().st_mode & 0o777 == 0o600
    assert journal.stat().st_mode & 0o777 == 0o600
    assert 'synthetic-secret' not in journal.read_text()
    module.migrate([file], journal, apply=True)
    module.migrate([], journal, apply=True, restore=True)
    assert file.stat().st_mode & 0o777 == 0o644
    file.write_text('later secret')
    with pytest.raises(ValueError, match='changed'):
        module.migrate([], journal, apply=True, restore=True)
    assert file.read_text() == 'later secret'


def test_links_and_failed_apply_preserve_modes(tmp_path, monkeypatch):
    first, second, journal = tmp_path / 'first', tmp_path / 'second', tmp_path / 'journal'
    for path in (first, second):
        path.write_text('fixture'); path.chmod(0o644)
    link = tmp_path / 'link'; link.symlink_to(first)
    with pytest.raises(ValueError):
        module.migrate([link], journal, apply=True)
    assert not journal.exists()
    original = module.set_mode
    def fail(record, mode):
        if record['path'] == str(second) and mode == 0o600:
            raise OSError('synthetic failure')
        original(record, mode)
    monkeypatch.setattr(module, 'set_mode', fail)
    with pytest.raises(OSError):
        module.migrate([first, second], journal, apply=True)
    assert first.stat().st_mode & 0o777 == second.stat().st_mode & 0o777 == 0o644
