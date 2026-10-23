import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('task_adoption',ROOT/'scripts/check-mcp-tasks.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


def test_owned_task_inventory_and_runtime_declarations():
    assert module.audit()==[]
