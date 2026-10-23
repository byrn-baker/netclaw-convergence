"""Contract --prepare must never consume unowned state or lose a working runtime."""
import importlib.util
import json
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location('prepare_runner', Path(__file__).resolve().parents[2] / 'scripts/run-contract-tests.py')
runner = importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)


def config(path):
    return {'kind':'pytest', 'paths':[], 'environment':{'path':path, 'requirements':[],
            'packages':[], 'required_imports':[], 'prepend_path':True}}


@pytest.mark.parametrize('path', ['.', 'scripts', 'mcp-servers', '.contract-test-envs/..'])
def test_refuse_source_or_root_paths(tmp_path, path):
    sentinel = tmp_path / 'keep'; sentinel.write_text('operator state')
    with pytest.raises(runner.ManifestError):
        runner.prepare_suite('fixture', config(path), {}, tmp_path)
    assert sentinel.read_text() == 'operator state'


def test_unowned_and_symlink_runtimes_preserved(tmp_path):
    path = tmp_path / 'mcp-servers/fixture/.venv'; path.mkdir(parents=True)
    sentinel = path / 'keep'; sentinel.write_text('operator runtime')
    with pytest.raises(RuntimeError, match='unowned'):
        runner.prepare_suite('fixture', config('mcp-servers/fixture/.venv'), {}, tmp_path)
    assert sentinel.read_text() == 'operator runtime'
    (tmp_path / '.contract-test-envs').symlink_to(path, target_is_directory=True)
    with pytest.raises(runner.ManifestError, match='symlink'):
        runner.prepare_suite('fixture', config('.contract-test-envs/fixture'), {}, tmp_path)
    assert sentinel.read_text() == 'operator runtime'


@pytest.mark.parametrize('failure', [True, False])
def test_owned_refresh_restores_on_failure(tmp_path, monkeypatch, failure):
    relative = '.contract-test-envs/fixture'
    path = tmp_path / relative; path.mkdir(parents=True)
    (path / 'pyvenv.cfg').write_text('home=fixture')
    (path / 'keep').write_text('working runtime')
    (path / runner.MARKER_NAME).write_text(json.dumps({'definition':{
        'suite':'fixture', 'environment':{'path':relative}}, 'fingerprint':'old'}))
    monkeypatch.setattr(runner, '_fingerprint', lambda *args: ('new', {}))
    def build(*args):
        path.mkdir()
        (path / 'partial').write_text('new runtime')
        if failure:
            raise RuntimeError('synthetic dependency failure')
    monkeypatch.setattr(runner, '_build_suite_environment', build)
    if failure:
        with pytest.raises(RuntimeError, match='synthetic'):
            runner.prepare_suite('fixture', config(relative), {}, tmp_path)
        assert (path / 'keep').read_text() == 'working runtime'
        assert not (path / 'partial').exists()
    else:
        runner.prepare_suite('fixture', config(relative), {}, tmp_path)
        assert (path / 'partial').read_text() == 'new runtime'
    assert not list(path.parent.glob('fixture.previous-*'))
