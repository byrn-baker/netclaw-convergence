"""Exercise production audit functions with actual GAIT, without model startup."""
import ast
import logging
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict
import pytest
from gait.repo import GaitRepo

ROOT = Path(__file__).resolve().parents[2]


def functions(component, names):
    path = ROOT / 'mcp-servers' / component / ('rag_mcp_server.py' if component == 'rag-mcp' else 'memory_mcp_server.py')
    tree = ast.parse(path.read_text())
    body = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
    for node in body:
        node.decorator_list = []
    namespace = {'Dict': Dict, 'Any': Any, 'Optional': __import__('typing').Optional,
                 'log': logging.getLogger('audit-test')}
    exec(compile(ast.Module(body=body, type_ignores=[]), str(path), 'exec'), namespace)
    return namespace


@pytest.mark.parametrize('component', ['rag-mcp', 'memory-mcp'])
def test_real_audit_commit_and_unavailable_status(component, tmp_path, monkeypatch, caplog):
    monkeypatch.chdir(tmp_path)
    ns = functions(component, {'gait_log'})
    result = ns['gait_log']('fixture', 'synthetic-private-detail')
    assert result['status'] == 'unavailable'
    assert 'synthetic-private-detail' not in caplog.text
    repo = GaitRepo(tmp_path)
    repo.init()
    result = ns['gait_log']('fixture', 'synthetic-private-detail')
    assert result['status'] == 'recorded'
    assert repo.head_commit_id() == result['commit']
    assert len(list(repo.iter_commit_ids_from_head_first_parent())) == 1


def test_memory_mutation_reports_audit_status_without_duplicate_write(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    ns = functions('memory-mcp', {'gait_log', 'memory_record_fact'})
    writes = []
    def insert(*args):
        writes.append(args)
        return {'success': True, 'data': {'id': 'fixture'}}
    ns['sqlite_store'] = SimpleNamespace(insert_fact=insert)
    result = ns['memory_record_fact']('fixture', 'os', 'synthetic')
    assert result['success'] is True
    assert result['audit']['status'] == 'unavailable'
    assert len(writes) == 1
