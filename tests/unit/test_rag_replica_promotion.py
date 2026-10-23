"""Replica promotion preserves a real persistent Chroma corpus on failure."""
import importlib.util
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('replica_chroma', ROOT/'mcp-servers/rag-mcp/storage/chroma_store.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def populate(store, name, identity):
    store.add_chunks(name, [identity], [[1., 0.]], [identity], [{'document_id':identity}])


def test_failed_promotion_retains_original_and_staging(tmp_path, monkeypatch):
    store = module.ChromaStore(str(tmp_path))
    populate(store, 'stable-corpus', 'original')
    populate(store, 'staging-corpus', 'replacement')
    cls = type(store._collection('staging-corpus'))
    original_modify = cls.modify
    def fail_stage(self, *args, **kwargs):
        if self.name == 'staging-corpus':
            raise OSError('synthetic rename failure')
        return original_modify(self, *args, **kwargs)
    monkeypatch.setattr(cls, 'modify', fail_stage)
    with pytest.raises(OSError):
        store.promote_staging('staging-corpus', 'stable-corpus')
    assert store._ensure_client().get_collection('stable-corpus').get()['ids'] == ['original']
    assert store._ensure_client().get_collection('staging-corpus').get()['ids'] == ['replacement']


def test_missing_stage_never_replaces_stable(tmp_path):
    store = module.ChromaStore(str(tmp_path))
    populate(store, 'stable-corpus', 'original')
    with pytest.raises(Exception):
        store.promote_staging('missing-stage', 'stable-corpus')
    assert store._ensure_client().get_collection('stable-corpus').get()['ids'] == ['original']


def test_successful_promotion_replaces_contents(tmp_path):
    store = module.ChromaStore(str(tmp_path))
    populate(store, 'stable-corpus', 'original')
    populate(store, 'staging-corpus', 'replacement')
    store.promote_staging('staging-corpus', 'stable-corpus')
    assert store._ensure_client().get_collection('stable-corpus').get()['ids'] == ['replacement']


def test_process_interruption_gap_recovers_before_empty_creation(tmp_path):
    store = module.ChromaStore(str(tmp_path))
    populate(store, 'stable-corpus', 'original')
    store._collection('stable-corpus').modify(name=store._rollback_name('stable-corpus'))
    restarted = module.ChromaStore(str(tmp_path))
    assert restarted.count('stable-corpus') == 1
    assert restarted._collection('stable-corpus').get()['ids'] == ['original']


def test_retained_previous_generation_is_not_overwritten(tmp_path):
    store = module.ChromaStore(str(tmp_path))
    populate(store, 'stable-corpus', 'current')
    populate(store, 'staging-corpus', 'replacement')
    populate(store, store._rollback_name('stable-corpus'), 'retained')
    with pytest.raises(RuntimeError, match='retained'):
        store.promote_staging('staging-corpus', 'stable-corpus')
    assert store._collection('stable-corpus').get()['ids'] == ['current']
