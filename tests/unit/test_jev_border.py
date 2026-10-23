"""Verify generated Border workspaces actually receive advisory workflows."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/in2n-border-workspace.py"


def test_border_generation_preserves_routing_and_includes_jev_procedures(tmp_path):
    live = tmp_path / "live"
    (live / "skills/jev-evidence-review").mkdir(parents=True)
    (live / "skills/jev-evidence-review/SKILL.md").write_text("dynamic questions")
    (live / "skills/pyats-network").mkdir()
    out = tmp_path / "border"
    subprocess.run([sys.executable, str(SCRIPT), "--risk", "test-risk", "--members", "pyats",
                    "--live-workspace", str(live), "--out", str(out)], check=True, capture_output=True)
    assert (out / "skills/jev-evidence-review/SKILL.md").read_text() == "dynamic questions"
    assert not (out / "skills/pyats-network").exists()
    assert (out.parent / "docs/JEV-SCIENCE-OFFICER.md").read_text() == (
        ROOT / "docs/JEV-SCIENCE-OFFICER.md").read_text()
    assert (out / "docs/JEV-SCIENCE-OFFICER.md").read_text() == (
        ROOT / "docs/JEV-SCIENCE-OFFICER.md").read_text()
    persona = (out / "SOUL.md").read_text()
    for rule in ["jev_status", "jev_evaluate", "before final operational summaries",
                 "Never invent task IDs", "at most one bounded reconsideration",
                 "not an enrolled execution member", "never a static question library",
                 "deterministic routing", "Never send credentials"]:
        assert rule in persona
    assert "Always-on: pyats" in persona
    assert "pyats-config-mgmt" in persona
    assert "prior reset exception does not authorize a new deployment" in persona
