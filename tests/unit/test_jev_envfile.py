"""Existing-install adoption loads an explicitly selected literal environment safely."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "mcp-servers/jev-mcp/server.py"


def clean_env(tmp_path):
    return {"PATH": os.environ["PATH"], "HOME": str(tmp_path)}


def test_env_file_real_mcp_registration_status(tmp_path):
    envfile = tmp_path / "selected-runtime.env"
    literal_key = "synthetic-$literal-key-without-interpolation"
    envfile.write_text("\n".join([
        "JEV_ENABLED=true", "TYPESAFE_API_KEY=" + literal_key,
        "JEV_DATA_DIR=" + str(tmp_path / "jev"), "JEV_TASK_ID=adoption-task",
        "JEV_GAIT_ROOT=" + str(tmp_path), "GAIT_VENV=" + str(tmp_path / "no-gait"),
    ]) + "\n")
    async def exercise():
        params = StdioServerParameters(command=sys.executable, args=[str(SERVER), "--env-file", str(envfile)],
                                      env=clean_env(tmp_path), cwd=str(tmp_path))
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                assert {tool.name for tool in (await session.list_tools()).tools} == {"jev_status", "jev_evaluate", "jev_assessment"}
                result = await session.call_tool("jev_status", {})
                text = next(item.text for item in result.content if item.type == "text")
                assert literal_key not in text
                status = json.loads(text)
                assert status["ready"] and status["enabled"]
                assert status["task_id"] == "adoption-task"
                assert status["budgets"]["daily_used_usd"] == 0
    asyncio.run(exercise())


def test_env_file_only_allowlisted_literal_settings(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("jev_envfile_server_test", SERVER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    marker = tmp_path / "should-not-exist"
    envfile = tmp_path / "literal.env"
    value = "$(touch " + str(marker) + ")"
    envfile.write_text("\n".join([
        "TYPESAFE_API_KEY=" + json.dumps(value), "JEV_ENABLED=true",
        "PATH=/untrusted/path", "PYTHONPATH=/untrusted/python", "HOME=/untrusted/home",
        "JEV_UNKNOWN_SETTING=ignored", "GAIT_VENV=/literal/gait",
    ]) + "\n")
    before = {key: os.environ.get(key) for key in ("PATH", "PYTHONPATH", "HOME", "JEV_UNKNOWN_SETTING")}
    for key in module.ENV_KEYS:
        monkeypatch.setenv(key, os.environ.get(key, ""))
    module.load_env_file(str(envfile))
    assert os.environ["TYPESAFE_API_KEY"] == value
    assert os.environ["GAIT_VENV"] == "/literal/gait"
    assert {key: os.environ.get(key) for key in before} == before
    assert not marker.exists()


@pytest.mark.parametrize("kind", ["missing", "symlink", "directory", "malformed", "oversized"])
def test_env_file_failure_is_neutral_and_distinct(tmp_path, kind):
    envfile = tmp_path / "runtime.env"
    if kind == "symlink":
        target = tmp_path / "target"
        target.write_text("TYPESAFE_API_KEY=never-disclose-me\n")
        envfile.symlink_to(target)
    elif kind == "directory":
        envfile.mkdir()
    elif kind == "malformed":
        envfile.write_text("TYPESAFE_API_KEY='never-disclose-me\n")
    elif kind == "oversized":
        envfile.write_text("TYPESAFE_API_KEY=never-disclose-me\n" + "x" * 2_000_001)
    result = subprocess.run([sys.executable, str(SERVER), "--env-file", str(envfile), "--status"],
                            env=clean_env(tmp_path), capture_output=True, text=True, timeout=5)
    assert result.returncode == 2
    assert json.loads(result.stdout)["status"] == "unavailable"
    assert "never-disclose-me" not in result.stdout + result.stderr
    assert "Traceback" not in result.stderr


def test_no_env_file_keeps_inherited_config_and_selected_file_overrides(tmp_path):
    env = {**clean_env(tmp_path), "JEV_ENABLED": "false", "JEV_DATA_DIR": str(tmp_path / "jev")}
    inherited = subprocess.run([sys.executable, str(SERVER), "--status"], env=env, capture_output=True, text=True, timeout=5)
    assert not json.loads(inherited.stdout)["enabled"]
    envfile = tmp_path / "selected.env"
    envfile.write_text("JEV_ENABLED=true\nTYPESAFE_API_KEY=synthetic-key\n")
    selected = subprocess.run([sys.executable, str(SERVER), "--env-file", str(envfile), "--status"],
                              env=env, capture_output=True, text=True, timeout=5)
    assert json.loads(selected.stdout)["ready"]
