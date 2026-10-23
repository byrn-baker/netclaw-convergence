import importlib.util
from pathlib import Path
import subprocess
import pytest

spec = importlib.util.spec_from_file_location('gait_setup', Path(__file__).resolve().parents[2] / 'scripts/setup-gait-runtime.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


@pytest.fixture(autouse=True)
def synthetic_source_bundle(monkeypatch):
    # Runtime clones are intentionally absent in a clean checkout/CI. These
    # transaction tests stub source copying and subprocesses; the real bundle
    # is separately exercised by the spec 141 staging smoke test.
    def copy_source(source, destination, **kwargs):
        destination.mkdir(parents=True)
        (destination / 'gait_mcp.py').write_text('# fixture source\n')
    monkeypatch.setattr(m.shutil, 'copytree', copy_source)


def old_runtime(tmp_path):
    target = tmp_path / 'gait'
    target.mkdir()
    (target / 'operator-marker').write_text('preserve')
    return target


@pytest.mark.parametrize('fail_step', [1, 2, 3, 4, 5])
def test_creation_install_or_verification_failure_keeps_old_runtime(tmp_path, monkeypatch, fail_step):
    target = old_runtime(tmp_path)
    calls = []
    monkeypatch.setattr(m.shutil, 'which', lambda _: '/synthetic/uv')
    def run(argv, **kwargs):
        assert (target / 'operator-marker').read_text() == 'preserve'
        calls.append(argv)
        if len(calls) == fail_step:
            raise subprocess.CalledProcessError(1, argv)
    monkeypatch.setattr(m.subprocess, 'run', run)
    with pytest.raises(subprocess.CalledProcessError):
        m.setup(target)
    assert (target / 'operator-marker').read_text() == 'preserve'
    assert list(tmp_path.iterdir()) == [target]


def test_promotion_and_explicit_restore_preserve_both_generations(tmp_path, monkeypatch):
    target = old_runtime(tmp_path)
    monkeypatch.setattr(m.shutil, 'which', lambda _: '/synthetic/uv')
    calls = []
    monkeypatch.setattr(m.subprocess, 'run', lambda argv, **kwargs: calls.append(argv))
    m.setup(target)
    assert target.is_symlink()
    assert (tmp_path / 'gait.previous/operator-marker').read_text() == 'preserve'
    generation = target.resolve()
    assert generation.exists()
    assert all('--break-system-packages' not in argv and '--user' not in argv for argv in calls)
    m.setup(target)
    assert target.resolve() == generation
    with pytest.raises(ValueError):
        m.setup(target, rebuild=True)
    m.setup(target, restore=True)
    assert not target.is_symlink()
    assert (target / 'operator-marker').read_text() == 'preserve'
    assert generation.exists()


def test_failed_promotion_restores_old_runtime(tmp_path, monkeypatch):
    target = old_runtime(tmp_path)
    monkeypatch.setattr(m.shutil, 'which', lambda _: '/synthetic/uv')
    monkeypatch.setattr(m.subprocess, 'run', lambda *args, **kwargs: None)
    def fail(*args):
        raise OSError('synthetic promotion failure')
    monkeypatch.setattr(m.os, 'replace', fail)
    with pytest.raises(OSError):
        m.setup(target)
    assert (target / 'operator-marker').read_text() == 'preserve'
    assert list(tmp_path.iterdir()) == [target]


def test_preview_performs_no_mutation(tmp_path):
    target = tmp_path / 'absent-parent/gait'
    m.setup(target, preview=True)
    assert list(tmp_path.iterdir()) == []
