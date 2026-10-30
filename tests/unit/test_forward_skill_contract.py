"""The forward skill must document what Forward's MCP really offers.

tests/fixtures/forward/tools-list.json is a capture of a live Forward `tools/list`
(tool and argument names only). Every tool and every argument it lists must appear
in the skill, so a tool or argument rename is caught here rather than by an agent.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILL = (ROOT / 'workspace/skills/forward/SKILL.md').read_text()
TOOLS = json.loads((ROOT / 'tests/fixtures/forward/tools-list.json').read_text())['tools']
SHARED = {'networkId', 'snapshotId'}


def test_skill_documents_every_tool():
    missing = [name for name in TOOLS if f'`{name}`' not in SKILL]
    assert not missing, missing


def test_skill_documents_every_argument():
    missing = {name: sorted(a for a in spec['properties'] if a not in SHARED and f'`{a}`' not in SKILL)
               for name, spec in TOOLS.items()}
    assert not {k: v for k, v in missing.items() if v}, missing


def test_every_tool_requires_a_network_id():
    assert all('networkId' in spec['required'] for spec in TOOLS.values())
    assert 'Always supply a networkId' in SKILL


def test_skill_covers_the_failure_modes_seen_live():
    for phrase in ('INVALID_QUERY', 'executionKey', 'No processed snapshot', '`isError: true`', 'queryUrl',
                   'NOT_VULNERABLE', 'empty list', 'session-based'):
        assert phrase in SKILL, phrase


def test_skill_stays_mcp_only():
    for forbidden in ('forward-mcp', 'list_networks', 'run_nqe_query'):
        assert forbidden not in SKILL, forbidden
