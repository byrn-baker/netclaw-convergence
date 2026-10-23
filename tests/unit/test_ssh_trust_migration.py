import importlib.util
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location('ssh_migration', Path(__file__).resolve().parents[2] / 'scripts/migrate-ssh-trust.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_preview_apply_repeat_restore(tmp_path):
    env = tmp_path / '.env'
    original = b'OTHER=fixture\nMULTIVENDOR_SSH_STRICT=false\n'
    env.write_bytes(original)
    hosts = tmp_path / 'known_hosts'
    hosts.write_text('# Trusted host keys managed independently\n')
    m.migrate(env, hosts)
    assert env.read_bytes() == original
    m.migrate(env, hosts, apply=True)
    changed = env.read_bytes()
    assert b'MULTIVENDOR_SSH_STRICT=true' in changed and b'OTHER=fixture' in changed
    assert env.stat().st_mode & 0o777 == 0o600
    m.migrate(env, hosts, apply=True)
    assert env.read_bytes() == changed
    m.migrate(env, restore=True)
    assert env.read_bytes() == changed
    m.migrate(env, apply=True, restore=True)
    assert env.read_bytes() == original
    assert env.with_name('.env.pre-ssh-trust').stat().st_mode & 0o777 == 0o600


def test_missing_trust_or_symlink_preserves_environment(tmp_path):
    env = tmp_path / '.env'
    env.write_text('OTHER=fixture\n')
    with pytest.raises(ValueError):
        m.migrate(env, tmp_path / 'absent', apply=True)
    link = tmp_path / 'link'
    link.symlink_to(env)
    with pytest.raises(ValueError):
        m.migrate(link, env, apply=True)
    assert env.read_text() == 'OTHER=fixture\n'
