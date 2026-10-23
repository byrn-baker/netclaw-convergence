"""The dedicated venv, and proof it does not disturb the system interpreter.
Spec 083, FR-037a/b/c, SC-026/027.

Spec 141 pins FastMCP 4 / MCP 2 in a dedicated runtime. Legacy low-level SDK
consumers still require isolation from these framework dependencies.
"""
from __future__ import annotations
import json, os, re, subprocess
from _harness import FAILURES, check, read, repo, run, skip  # noqa: F401

VENV_PY = os.environ.get(
    "NETCLAW_ZABBIX_VENV_PY",
    repo("mcp-servers", "zabbix-mcp", ".venv", "bin", "python"),
)

def _version(python_exe: str, dist: str) -> str | None:
    out = subprocess.run([python_exe, "-c",
        f"import importlib.metadata as m;print(m.version({dist!r}))"],
        capture_output=True, text=True)
    return out.stdout.strip() if out.returncode == 0 else None

def test_venv_exists_and_holds_modern_framework():
    if not os.path.exists(VENV_PY):
        skip("venv checks", "venv not built — run the installer")
        return
    v = _version(VENV_PY, "fastmcp")
    check("the venv resolves pinned FastMCP", v == "4.0.11", f"got {v}")
    check("the venv resolves pinned MCP SDK", _version(VENV_PY, "mcp") == "2.3.0")
    check("the venv has the vendored package installed",
          _version(VENV_PY, "zabbix-mcp-server") is not None, "not installed")

def test_runtime_excludes_system_packages():
    if not os.path.exists(VENV_PY):
        skip("venv isolation", "venv not built")
        return
    probe = subprocess.run([VENV_PY, "-c", "import json,sys,site; print(json.dumps({'prefix':sys.prefix,'base':sys.base_prefix,'user_site':site.ENABLE_USER_SITE}))"],
                           capture_output=True, text=True, check=True)
    state = json.loads(probe.stdout)
    check("runtime has a distinct virtualenv prefix", state["prefix"] != state["base"])
    check("runtime excludes user site packages", state["user_site"] is False)
    cfg = os.path.join(state["prefix"], "pyvenv.cfg")
    with open(cfg, encoding="utf-8") as fh:
        config = dict(line.strip().split("=", 1) for line in fh if "=" in line)
    config = {k.strip(): v.strip().lower() for k, v in config.items()}
    check("runtime excludes system site packages", config.get("include-system-site-packages") == "false")

def test_installer_never_uses_bare_venv():
    steps = read("scripts", "lib", "install-steps.sh")
    fn = steps[steps.index("component_install_zabbix()"):]
    fn = fn[:fn.index("\n}\n")]
    # Line-aware, not string-aware: this function deliberately MENTIONS bare venv in a
    # comment and in a log_warn that tells the operator not to use it. Matching the raw
    # string would flag the warning as the offence it warns about.
    offenders = []
    for line in fn.splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith("log_warn") or stripped.startswith("echo"):
            continue
        if "python3 -m venv" in stripped:
            offenders.append(stripped)
    check("no executable line calls bare `python3 -m venv`", not offenders,
          f"bare venv fails on hosts without ensurepip (spec 077 hazard #3, hit live in "
          f"Phase 0). Offending line(s): {offenders}")
    helper = read("scripts", "lib", "pip-helper.sh")
    component_helper = re.search(r"^netclaw_component_venv\(\) \{.*?^}", helper, re.M | re.S)
    delegates_creation = ("netclaw_component_venv" in fn and component_helper
                          and "netclaw_venv_create" in component_helper[0]
                          and '_netclaw_require_python' in component_helper[0])
    check("the installer uses a supported isolated venv creation path",
          "netclaw_venv_create" in fn or "uv venv" in fn or delegates_creation,
          "no supported venv creation path")
    check("the installer explains why the venv exists",
          "isolated" in fn.lower() and "fastmcp" in fn.lower(),
          "without the rationale a maintainer will 'simplify' it away")

def test_registration_points_at_the_venv():
    cfg = json.loads(read("config", "openclaw.json"))["mcpServers"]["zabbix-mcp"]
    check("the registered command is the venv interpreter",
          ".venv/bin/python" in cfg["command"],
          f"got {cfg['command']!r} — a system python would resolve the wrong fastmcp")
    check("the command path is repo-relative", not cfg["command"].startswith("/"),
          "an absolute path breaks on every other machine")

def test_venv_is_gitignored():
    out = subprocess.run(["git", "check-ignore", "-v",
                          "mcp-servers/zabbix-mcp/.venv/pyvenv.cfg"],
                         capture_output=True, text=True, cwd=repo())
    check("the venv is git-ignored", out.returncode == 0,
          "the negation !mcp-servers/zabbix-mcp/ re-includes everything beneath it — "
          "without an explicit re-ignore the whole virtualenv gets committed")
    check("the vendored source is NOT ignored",
          subprocess.run(["git", "check-ignore",
                          "mcp-servers/zabbix-mcp/vendor/zabbix-mcp-server/pyproject.toml"],
                         capture_output=True, cwd=repo()).returncode != 0,
          "the vendored tree is invisible to git")

TESTS = [test_venv_exists_and_holds_modern_framework, test_runtime_excludes_system_packages, test_installer_never_uses_bare_venv,
         test_registration_points_at_the_venv, test_venv_is_gitignored]

if __name__ == "__main__":
    raise SystemExit(run(TESTS, "venv isolation"))
