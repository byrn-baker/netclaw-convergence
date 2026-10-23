"""Border and member cwd must not split an explicitly tilde-prefixed store."""
import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def run_memory(cwd, home, code, configured="~/.openclaw/memory"):
    env = {**os.environ, "HOME": str(home), "MEMORY_DATA_DIR": configured}
    program = (
        "import sys,json; sys.path.insert(0, " + repr(str(ROOT / "mcp-servers/memory-mcp")) + "); "
        "import memory_mcp_server as m; " + code
    )
    result = subprocess.run([sys.executable, "-c", program], cwd=cwd, env=env,
                            capture_output=True, text=True, check=True, timeout=20)
    return json.loads(result.stdout)


def test_tilde_store_shared_across_border_and_member_working_directories(tmp_path):
    home = tmp_path / "operator"
    border = tmp_path / "border"
    member = tmp_path / "member"
    for directory in (home, border, member):
        directory.mkdir()
    written = run_memory(border, home,
        "print(json.dumps(m.sqlite_store.insert_decision('synthetic context', "
        "'synthetic scoped decision', 'test rationale', ['test-lab'])))")
    assert written["success"]
    read = run_memory(member, home,
        "print(json.dumps({'path':m.DB_PATH,'result':m.memory_get_decisions(entity='test-lab')}))")
    assert read["path"] == str(home / ".openclaw/memory/memory.db")
    assert read["result"]["data"]["decisions"][0]["id"] == written["data"]["id"]
    assert not (border / "~").exists()
    assert not (member / "~").exists()


def test_explicit_absolute_store_remains_operator_selected(tmp_path):
    chosen = tmp_path / "shared risk memory"
    result = run_memory(tmp_path, tmp_path, "print(json.dumps(m.DATA_DIR))", str(chosen))
    assert result == str(chosen)
