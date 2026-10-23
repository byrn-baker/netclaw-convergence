"""Narrow Pal -> NetClaw boundary. No caller-selectable endpoint, agent or tool."""
from __future__ import annotations
import http.client
import json
import os
import re
from pathlib import Path

AGENT_ID = "netclaw-pal"
INSTRUCTIONS = """# NetClaw Pal companion
Explain networking concepts and synthetic scenarios clearly. You have no tools,
no device access and no operational memory in this companion session. Never claim
to have observed or changed a network. Real operations belong in the main NetClaw
Chat/Canvas with its existing approval workflow. Your answer is displayed locally;
the operator must explicitly approve its exact text before it is spoken by Tavus.
Keep answers under 150 words. Do not request secrets, configurations or credentials.
"""

def config_and_agent(home: Path):
    home = home.expanduser().resolve()
    config_file = home / "openclaw.json"
    if config_file.is_symlink() or config_file.stat().st_size > 2_000_000:
        raise ValueError("Unsafe runtime configuration")
    config = json.loads(config_file.read_text())
    entries = config.get("agents", {}).get("list", [])
    if not isinstance(entries, list):
        raise ValueError("Unsupported agent registry")
    matches = [entry for entry in entries if entry.get("id") == AGENT_ID]
    if len(matches) != 1:
        raise ValueError("Restricted agent not configured")
    agent = matches[0]
    # Deny wins over provider/profile allowlists in the installed OpenClaw policy.
    if agent.get("tools", {}).get("deny") != ["*"]:
        raise ValueError("All-tool deny policy is required")
    workspace = home / "netclaw-pal" / "workspace"
    if Path(agent.get("workspace", "")).expanduser() != workspace or workspace.is_symlink():
        raise ValueError("Dedicated workspace required")
    for name in ("AGENTS.md", "SOUL.md", "TOOLS.md", "USER.md", "IDENTITY.md", "HEARTBEAT.md", "BOOTSTRAP.md"):
        file = workspace / name
        if file.is_symlink() or file.read_text() != INSTRUCTIONS:
            raise ValueError("Companion bootstrap differs from reviewed content")
    for name in ("MEMORY.md", "memory.md", "memory"):
        if (workspace / name).exists():
            raise ValueError("Operational memory is not permitted in Pal workspace")
    gateway = config.get("gateway", {})
    if gateway.get("http", {}).get("endpoints", {}).get("chatCompletions", {}).get("enabled") is not True:
        raise ValueError("Gateway chat endpoint not enabled")
    port = gateway.get("port", 18789)
    token = gateway.get("auth", {}).get("token")
    if not isinstance(port, int) or not 1 <= port <= 65535 or not isinstance(token, str) or not token or "\n" in token or "\r" in token:
        raise ValueError("Gateway authentication unavailable")
    return config, port, token

def query(question: str, session_id: str, home: Path | None = None) -> dict:
    if not isinstance(question, str) or not question.strip() or len(question) > 1000:
        return {"status": "unavailable", "reason": "invalid-question"}
    if not re.fullmatch(r"[a-f0-9-]{36}", session_id):
        return {"status": "unavailable", "reason": "invalid-session"}
    home = home or Path(os.environ.get("OPENCLAW_HOME", str(Path.home() / ".openclaw"))).expanduser().resolve()
    connection = None
    try:
        _, port, token = config_and_agent(home)
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=45)
        body = json.dumps({"model": "openclaw", "stream": False, "messages": [{"role": "user", "content": question}]})
        connection.request("POST", "/v1/chat/completions", body, {
            "Content-Type": "application/json", "Authorization": "Bearer " + token,
            "x-openclaw-agent-id": AGENT_ID,
            "x-openclaw-session-key": f"agent:{AGENT_ID}:pal:{session_id}",
        })
        response = connection.getresponse()
        if response.status != 200:
            raise ValueError("Gateway unavailable")
        payload = response.read(262145)
        if len(payload) > 262144:
            raise ValueError("Oversized response")
        answer = json.loads(payload)["choices"][0]["message"]["content"]
        if not isinstance(answer, str) or not answer.strip():
            raise ValueError("Empty response")
        return {"status": "ok", "answer": answer.strip()[:8000], "exposure": "local_only", "device_access": False}
    except Exception:
        return {"status": "unavailable", "reason": "restricted-agent-unavailable"}
    finally:
        if connection:
            connection.close()
