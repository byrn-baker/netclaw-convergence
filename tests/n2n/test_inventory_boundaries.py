import json
import pytest
from bgp.federation.inventory import InventoryBuilder


@pytest.mark.parametrize('secret', ['value"withquote123', 'value\\withslash123', 'value-秘密-123'])
def test_encoded_secret_is_blocked(manager, tmp_path, secret):
    env = tmp_path / '.env'
    env.write_text('API_TOKEN=' + json.dumps(secret, ensure_ascii=False) + '\n')
    builder = InventoryBuilder(manager, env_path=str(env))
    with pytest.raises(ValueError, match='secret'):
        builder._assert_no_secrets({'description': secret})


def test_member_aggregate_respects_hidden_skill(manager, monkeypatch):
    builder = InventoryBuilder(manager)
    monkeypatch.setattr(builder, '_member_aggregate_skills', lambda _: [{'name': 'hidden-member-skill'}])
    manager._conn.execute("INSERT INTO visibility_setting VALUES ('skill','hidden-member-skill','hidden',NULL)")
    manager._conn.commit()
    assert 'hidden-member-skill' not in [x['name'] for x in builder.build('peer')['skills']]


@pytest.mark.parametrize('identity', ['../escape', '/invalid-peer-fixture/absolute', 'peer/name'])
def test_cache_refuses_path_identity(manager, identity):
    builder = InventoryBuilder(manager)
    with pytest.raises(ValueError):
        builder.cache_remote(identity, {'version': 1})
    with pytest.raises(ValueError):
        builder.load_remote(identity)


def test_missing_metadata_is_stale(manager):
    builder = InventoryBuilder(manager)
    builder.cache_remote('peer', {'version': 1})
    (manager.base_dir / 'inventories' / 'peer.meta.json').unlink()
    assert builder.load_remote('peer')['stale'] is True


def test_cache_timestamp_uses_utc_and_rejects_future(manager, monkeypatch):
    builder = InventoryBuilder(manager)
    builder.cache_remote('peer', {'version': 1})
    metadata = manager.base_dir / 'inventories' / 'peer.meta.json'
    metadata.write_text('{"received_at":"2026-01-01T00:00:00Z"}')
    monkeypatch.setattr('bgp.federation.inventory.time.time', lambda: 1767225600 + 10)
    monkeypatch.setattr('bgp.federation.inventory.time.mktime', lambda _: 0)
    assert builder.load_remote('peer')['stale'] is False
    monkeypatch.setattr('bgp.federation.inventory.time.time', lambda: 1767225600 - 10)
    assert builder.load_remote('peer')['stale'] is True


def test_cache_refuses_symlink(manager, tmp_path):
    outside = tmp_path / 'retained.json'
    outside.write_text('retained')
    (manager.base_dir / 'inventories' / 'peer.json').symlink_to(outside)
    builder = InventoryBuilder(manager)
    with pytest.raises(ValueError):
        builder.cache_remote('peer', {})
    assert outside.read_text() == 'retained'
