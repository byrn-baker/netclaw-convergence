"""Failure and recovery boundaries for staged pyATS source/runtime generations."""
import importlib.util
import json
from pathlib import Path
import subprocess
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('pyats_runtime', ROOT/'scripts/setup-pyats-runtime.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fake_build(monkeypatch, fail=False):
    monkeypatch.setattr(module.shutil, 'which', lambda name: '/fixture/uv')
    def run(args, **kwargs):
        if args[1] == 'venv':
            root = Path(args[2]);(root/'bin').mkdir();(root/'bin/python').write_text('new interpreter')
        elif args[0] == 'git' and args[1] == 'clone':
            source = Path(args[-1]);source.mkdir();(source/'pyats_mcp_server.py').write_text('new source');(source/'pyats_tasks.py').write_text('task source')
        elif args[1:3] == ['pip','install'] and fail:
            raise subprocess.CalledProcessError(23, args)
        return subprocess.CompletedProcess(args, 0)
    monkeypatch.setattr(module.subprocess, 'run', run)


def old_runtime(tmp_path):
    target=tmp_path/'runtime';target.mkdir();(target/'sentinel').write_bytes(b'old runtime state')
    return target


def test_package_failure_leaves_old_runtime_untouched(tmp_path, monkeypatch):
    target=old_runtime(tmp_path);fake_build(monkeypatch, fail=True)
    with pytest.raises(subprocess.CalledProcessError):module.setup(target)
    assert not target.is_symlink()
    assert (target/'sentinel').read_bytes()==b'old runtime state'
    assert not (tmp_path/'runtime.previous').exists()
    assert list(tmp_path.iterdir()) == [target]


def test_preview_apply_repeat_restore_preserves_generations(tmp_path, monkeypatch):
    target=old_runtime(tmp_path);fake_build(monkeypatch)
    module.setup(target,preview=True)
    assert not target.is_symlink()
    module.setup(target)
    generation=target.resolve()
    assert json.loads((target/module.MARKER).read_text())['revision']==module.REVISION
    assert (tmp_path/'runtime.previous/sentinel').read_bytes()==b'old runtime state'
    module.setup(target)
    assert target.resolve()==generation
    module.setup(target,restore=True)
    assert not target.is_symlink()
    assert (target/'sentinel').read_bytes()==b'old runtime state'
    assert generation.is_dir()
    assert len(list(tmp_path.glob('runtime.retained-*')))==1


def test_failed_promotion_restores_old_runtime(tmp_path, monkeypatch):
    target=old_runtime(tmp_path);fake_build(monkeypatch)
    def fail(*args):raise OSError('synthetic promotion failure')
    monkeypatch.setattr(module.os,'replace',fail)
    with pytest.raises(OSError):module.setup(target)
    assert (target/'sentinel').read_bytes()==b'old runtime state'
    assert list(tmp_path.iterdir())==[target]


def test_existing_recovery_point_refuses_overwrite(tmp_path, monkeypatch):
    target=old_runtime(tmp_path);(tmp_path/'runtime.previous').mkdir();fake_build(monkeypatch)
    with pytest.raises(ValueError,match='retained'):module.setup(target)
    assert (target/'sentinel').read_bytes()==b'old runtime state'
