"""Migration coverage and drift/rollback behavior, independent of vendor credentials."""
import importlib.util
import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


patcher = load('fastmcp_patcher', 'apply-fastmcp-patches.py')
checker = load('fastmcp_checker', 'check-fastmcp-compat.py')


def test_all_owned_servers_have_current_dependency_contract():
    assert checker.audit() == []
    assert len(checker.owned_servers()) >= 35


def fixture(tmp_path):
    base = tmp_path/'mcp-servers/example'
    base.mkdir(parents=True)
    patches = []
    for name in ['one.py', 'two.py']:
        old = 'from mcp.server.fastmcp import FastMCP\n'
        new = 'from fastmcp import FastMCP\n'
        (base/name).write_text(old)
        patches.append({'path': name, 'before_sha256': patcher.digest(old),
                        'after_sha256': patcher.digest(new),
                        'edits': [{'start': 0, 'old': old, 'new': new}]})
    return base, {'components': {'example': {'directory': 'example', 'patches': patches}}}


def test_patch_is_idempotent(tmp_path):
    base, manifest = fixture(tmp_path)
    assert patcher.apply(tmp_path, 'example', manifest, check=True) == 2
    assert 'mcp.server' in (base/'one.py').read_text()
    assert patcher.apply(tmp_path, 'example', manifest) == 2
    assert patcher.apply(tmp_path, 'example', manifest) == 0


def test_drift_refused_before_any_file_changes(tmp_path):
    base, manifest = fixture(tmp_path)
    (base/'two.py').write_text('operator edit\n')
    with pytest.raises(ValueError, match='unreviewed'):
        patcher.apply(tmp_path, 'example', manifest)
    assert 'mcp.server' in (base/'one.py').read_text()
    assert (base/'two.py').read_text() == 'operator edit\n'


def test_write_failure_restores_preceding_file(tmp_path, monkeypatch):
    base, manifest = fixture(tmp_path)
    original = patcher.write_atomic
    def fail_second(path, text):
        if path.name == 'two.py':
            raise OSError('fixture failure')
        original(path, text)
    monkeypatch.setattr(patcher, 'write_atomic', fail_second)
    with pytest.raises(OSError):
        patcher.apply(tmp_path, 'example', manifest)
    assert all('mcp.server' in (base/name).read_text() for name in ['one.py', 'two.py'])


def test_symlink_escape_refused(tmp_path):
    base, manifest = fixture(tmp_path)
    external = tmp_path/'outside.py'
    external.write_text((base/'two.py').read_text())
    (base/'two.py').unlink()
    (base/'two.py').symlink_to(external)
    with pytest.raises(ValueError, match='unsafe'):
        patcher.apply(tmp_path, 'example', manifest)
    assert 'mcp.server' in external.read_text()


def test_reviewed_patch_manifest_has_safe_paths_and_full_hashes():
    import re
    manifest = json.loads((ROOT/'config/fastmcp-external-patches.json').read_text())
    for component, entry in manifest['components'].items():
        assert re.fullmatch(r'[0-9a-f]{40}', entry['reviewed_commit']), component
        for patch in entry['patches']:
            assert not Path(patch['path']).is_absolute()
            assert '..' not in Path(patch['path']).parts
            for key in ('before_sha256', 'after_sha256'):
                assert re.fullmatch(r'[0-9a-f]{64}', patch[key])


def test_previously_installed_source_variant_is_supported(tmp_path):
    base, manifest = fixture(tmp_path)
    patch = manifest['components']['example']['patches'][0]
    variant = '# existing operator-compatible installer patch\n'+(base/'one.py').read_text()
    patch['variants'] = [{'before_sha256': patcher.digest(variant),
                          'edits': [{'start': 0, 'old': variant,
                                     'new': patch['edits'][0]['new']}]}]
    (base/'one.py').write_text(variant)
    assert patcher.apply(tmp_path, 'example', manifest) == 2
    assert patcher.digest((base/'one.py').read_text()) == patch['after_sha256']


@pytest.mark.parametrize('existing', [False, True])
def test_reviewed_clone_pins_new_sources_and_preserves_existing_edits(tmp_path, existing):
    import os
    import subprocess
    revision = 'a'*40
    config = tmp_path/'config'
    config.mkdir()
    (config/'fastmcp-external-patches.json').write_text(json.dumps({'components': {
        'example': {'directory': 'example', 'reviewed_commit': revision}}}))
    checkout = tmp_path/'example'
    if existing:
        checkout.mkdir()
        (checkout/'operator.txt').write_text('preserve')
    commands = tmp_path/'commands'
    bin_dir = tmp_path/'bin'
    bin_dir.mkdir()
    git = bin_dir/'git'
    git.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\n')
    git.chmod(0o700)
    result = subprocess.run(['bash', '-c',
        'source scripts/lib/common.sh\nclone_or_pull "$CHECKOUT" https://fixture.invalid/source.git'],
        cwd=ROOT, env={**os.environ, 'NETCLAW_DIR': str(tmp_path),
                       'CHECKOUT': str(checkout), 'COMMAND_LOG': str(commands),
                       'PATH': str(bin_dir)+os.pathsep+os.environ['PATH']},
        capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    if existing:
        assert (checkout/'operator.txt').read_text() == 'preserve'
        assert not commands.exists()
    else:
        calls = commands.read_text().splitlines()
        assert calls[0].startswith('clone --no-checkout https://fixture.invalid/source.git ')
        assert calls[1].endswith('checkout --detach '+revision)
