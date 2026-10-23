"""Skill upgrades retain recoverable originals and never follow deployed links."""
import importlib.util
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location('skill_deployment', Path(__file__).resolve().parents[2] / 'scripts/deploy-skills.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def fixture(tmp_path):
    source, dest, backups = [tmp_path / name for name in ('source', 'dest', 'backups')]
    for root in (source, dest):
        (root / 'example').mkdir(parents=True)
    (source / 'example/SKILL.md').write_text('new ~/.openclaw skill')
    (dest / 'example/SKILL.md').write_text('operator original')
    return source, dest, backups


def test_transform_repeat_restore_conflict(tmp_path):
    source, dest, backups = fixture(tmp_path)
    custom = dest / 'example/custom.md'
    custom.write_text('custom ~/.openclaw')
    (source / 'example/new.py').write_text('new file')
    assert m.deploy(source, dest, backups, '.hermes', preview=True) == 2
    assert not backups.exists()
    assert (dest / 'example/SKILL.md').read_text() == 'operator original'
    generation = m.deploy(source, dest, backups, '.hermes')
    assert (dest / 'example/SKILL.md').read_text() == 'new ~/.hermes skill'
    assert custom.read_text() == 'custom ~/.openclaw'
    assert generation.stat().st_mode & 0o777 == 0o700
    assert (generation / 'originals/example/SKILL.md').stat().st_mode & 0o777 == 0o600
    assert m.deploy(source, dest, backups, '.hermes') is None
    (dest / 'example/new.py').write_text('later edit')
    with pytest.raises(ValueError, match='conflict'):
        m.restore(generation)
    assert (dest / 'example/SKILL.md').read_text() == 'new ~/.hermes skill'
    (dest / 'example/new.py').write_text('new file')
    m.restore(generation)
    m.restore(generation)
    assert (dest / 'example/SKILL.md').read_text() == 'operator original'
    assert not (dest / 'example/new.py').exists()
    assert custom.read_text() == 'custom ~/.openclaw'


@pytest.mark.parametrize('directory', [False, True])
def test_link_refusal_before_any_update(tmp_path, directory):
    source, dest, backups = fixture(tmp_path)
    outside = tmp_path / 'outside'
    outside.mkdir()
    (outside / 'SKILL.md').write_text('outside original')
    (source / 'z-linked').mkdir()
    (source / 'z-linked/SKILL.md').write_text('replacement')
    if directory:
        (dest / 'z-linked').symlink_to(outside, target_is_directory=True)
    else:
        (dest / 'z-linked').mkdir()
        (dest / 'z-linked/SKILL.md').symlink_to(outside / 'SKILL.md')
    with pytest.raises(ValueError, match='symlink'):
        m.deploy(source, dest, backups)
    assert (outside / 'SKILL.md').read_text() == 'outside original'
    assert (dest / 'example/SKILL.md').read_text() == 'operator original'
    assert not backups.exists()


def test_failed_atomic_replacement_keeps_original_and_recovery(tmp_path, monkeypatch):
    source, dest, backups = fixture(tmp_path)
    replace = m.os.replace
    def fail(source_path, target):
        if target == dest / 'example/SKILL.md':
            raise OSError('injected write failure')
        return replace(source_path, target)
    monkeypatch.setattr(m.os, 'replace', fail)
    with pytest.raises(OSError, match='injected'):
        m.deploy(source, dest, backups)
    assert (dest / 'example/SKILL.md').read_text() == 'operator original'
    generation, = backups.glob('deploy-*')
    m.restore(generation)
    assert (generation / 'originals/example/SKILL.md').read_text() == 'operator original'
