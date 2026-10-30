"""Every component the plan engine runs through plan-steps.sh must be routable there.

Derived from the engine contract (scripts/lib/setup_effects.py): an `isolated-shell`
component is executed as `plan-steps.sh <id> ...`, and an id with no case exits 2,
which the engine records as a failed install.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def routed():
    text = (ROOT / 'scripts/lib/plan-steps.sh').read_text()
    return dict(re.findall(r'^\s{2}([a-z0-9-]+)\) function_name=(\w+) ;;$', text, re.MULTILINE))


def test_every_isolated_shell_component_is_routed_to_its_installer_function():
    effects = json.loads((ROOT / 'config/components/effects.json').read_text())['components']
    routes = routed()
    wrong = {e['id']: routes.get(e['id']) for e in effects
             if e['adapter'] == 'isolated-shell' and routes.get(e['id']) != e['function']}
    assert not wrong, wrong


def test_forward_is_routed_and_has_no_special_adapter():
    effects = {e['id']: e for e in json.loads((ROOT / 'config/components/effects.json').read_text())['components']}
    assert effects['forward']['adapter'] == 'isolated-shell'
    assert routed()['forward'] == 'component_install_forward'
    assert 'forward)' not in (ROOT / 'scripts/lib/plan-special.sh').read_text()
