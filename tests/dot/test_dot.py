import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "mcp-servers" / "netclaw-dot-mcp"))
import core  # noqa: E402


@pytest.fixture(autouse=True)
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("NETCLAW_DOT_AUDIT", str(tmp_path / "a.jsonl"))
    monkeypatch.delenv("NETCLAW_DOT_MODE", raising=False)
    monkeypatch.delenv("NETCLAW_DOT_ALIASES", raising=False)


def test_inventory_synthetic():
    r = core.inventory("owner")
    assert r["status"] == "ok" and r["mode"] == "synthetic" and r["observed_at"]


def test_health_ok():
    r = core.health_summary("owner", ["demo-edge-1"], ["interface_summary"])
    assert r["status"] == "ok" and "demo-edge-1" in r["data"]["observations"]


@pytest.mark.parametrize("aliases,checks,code", [
    (["nope"], ["interface_summary"], "alias_out_of_scope"),
    (["demo-edge-1; show run"], ["interface_summary"], "invalid_aliases"),
    ([], ["interface_summary"], "invalid_aliases"),
    (["demo-edge-1"] * 11, ["interface_summary"], "invalid_aliases"),
    (["demo-edge-1"], ["show running-config"], "invalid_checks"),
    (["demo-edge-1"], [], "invalid_checks"),
])
def test_negative_inputs(aliases, checks, code):
    r = core.health_summary("owner", aliases, checks)
    assert r["status"] == "denied" and r["error"] == code and r["data"] is None


def test_alias_scope_narrowed(monkeypatch):
    monkeypatch.setenv("NETCLAW_DOT_ALIASES", "demo-edge-1")
    assert core.health_summary("owner", ["demo-core-1"], ["system_summary"])["error"] == "alias_out_of_scope"


def test_live_mode_refused(monkeypatch):
    monkeypatch.setenv("NETCLAW_DOT_MODE", "live")
    assert core.inventory("owner")["error"] == "live_mode_not_approved"


def test_audit_failure_refuses_execution(monkeypatch, tmp_path):
    monkeypatch.setenv("NETCLAW_DOT_AUDIT", str(tmp_path / "f" / "sub"))
    (tmp_path / "f").write_text("x")  # parent is a file -> mkdir fails
    r = core.inventory("owner")
    assert r["status"] == "error" and r["error"] == "audit_unavailable"


def test_audit_status_scoped():
    rid = core.inventory("owner")["request_id"]
    assert core.audit_status("owner", rid)["data"]["complete"] is True
    assert core.audit_status("other", rid)["error"] == "not_found"
    assert core.audit_status("owner", "zz")["error"] == "invalid_request_id"


def test_redaction_and_no_write_surface():
    assert "10.1.2.3" not in core.redact("peer 10.1.2.3 password: hunter2")
    import server
    names = {t.name for t in __import__("asyncio").run(server.mcp.list_tools())}
    assert names == {"netclaw_inventory", "netclaw_health_summary", "netclaw_audit_status", "netclaw_ask", "netclaw_job_result"}


def test_audit_records_written():
    core.inventory("owner")
    lines = core.audit_path().read_text().splitlines()
    assert [json.loads(x)["phase"] for x in lines] == ["start", "end"]


def _run(coro):
    return __import__("asyncio").run(coro)


def test_ask_disabled_by_default():
    assert _run(core.ask("owner", "hi"))["error"] == "agent_bridge_disabled"


def test_ask_async_job_flow(monkeypatch):
    monkeypatch.setenv("NETCLAW_DOT_ENABLE_AGENT", "1")
    seen = {}

    async def fake(prompt, session_key, timeout_s):
        seen.update(prompt=prompt, key=session_key)
        await __import__("asyncio").sleep(0.2)
        return "CML has 2 labs", 10

    async def flow():
        r = await core.ask("owner", "list CML labs", runner=fake)
        assert r["status"] == "running" and r["mode"] == "agent"  # returns before the agent finishes
        jid = r["data"]["job_id"]
        first = await core.job_result("owner", jid, wait_s=0)
        assert first["status"] == "running"
        done = await core.job_result("owner", jid, wait_s=5)
        assert done["status"] == "ok" and done["data"]["reply"] == "CML has 2 labs" and done["mode"] == "agent"
        assert (await core.job_result("other", jid, wait_s=0))["error"] == "not_found"
        core.JOBS.clear()  # simulate restart: persisted record is reloaded
        assert (await core.job_result("owner", jid, wait_s=0))["data"]["reply"] == "CML has 2 labs"
    _run(flow())
    assert "change control" in seen["prompt"] and seen["key"] == "dot-owner"
    assert [json.loads(x)["phase"] for x in core.audit_path().read_text().splitlines()] == ["start", "end"]


def test_job_limit_and_bad_id(monkeypatch):
    monkeypatch.setenv("NETCLAW_DOT_ENABLE_AGENT", "1")
    core.JOBS.clear()

    async def slow(prompt, session_key, timeout_s):
        await __import__("asyncio").sleep(5)
        return "", 0

    async def flow():
        a = await core.ask("owner", "a", runner=slow)
        b = await core.ask("owner", "b", runner=slow)
        c = await core.ask("owner", "c", runner=slow)
        assert a["status"] == b["status"] == "running" and c["error"] == "too_many_running_jobs"
        assert (await core.job_result("owner", "nope"))["error"] == "invalid_job_id"
        for t in list(core._TASKS):
            t.cancel()
    _run(flow())
    core.JOBS.clear()


@pytest.mark.parametrize("p", ["", "   ", "x" * 4001, None])
def test_ask_rejects_bad_prompt(monkeypatch, p):
    monkeypatch.setenv("NETCLAW_DOT_ENABLE_AGENT", "1")
    assert _run(core.ask("owner", p))["error"] == "invalid_prompt"


def test_ask_hides_exception_text(monkeypatch):
    monkeypatch.setenv("NETCLAW_DOT_ENABLE_AGENT", "1")

    async def boom(prompt, session_key, timeout_s):
        raise RuntimeError("password: hunter2 at 10.0.0.1")
    async def flow():
        jid = (await core.ask("owner", "x", runner=boom))["data"]["job_id"]
        return await core.job_result("owner", jid, wait_s=5)
    r = _run(flow())
    assert r["error"] == "agent_failed" and "hunter2" not in json.dumps(r)


def test_ask_refuses_when_audit_down(monkeypatch, tmp_path):
    monkeypatch.setenv("NETCLAW_DOT_ENABLE_AGENT", "1")
    (tmp_path / "f").write_text("x")
    monkeypatch.setenv("NETCLAW_DOT_AUDIT", str(tmp_path / "f" / "a"))
    called = []

    async def fake(*a, **k):
        called.append(1)
        return "", 0
    assert _run(core.ask("owner", "x", runner=fake))["error"] == "audit_unavailable" and not called


def _oauth(tmp_path):
    import oauth
    return oauth.OAuth("owner-pass-1234567890abcd", "cid", "s" * 30, "https://h/netclaw-dot", store=tmp_path / "o.json")


def _flow(o, verifier="v" * 50, redirect="https://chatgpt.com/cb"):
    import base64, hashlib
    ch = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    q = {"response_type": "code", "client_id": "cid", "redirect_uri": redirect, "code_challenge": ch, "code_challenge_method": "S256", "state": "xyz"}
    return q, verifier


def test_oauth_full_flow(tmp_path):
    from urllib.parse import parse_qs, urlparse
    o = _oauth(tmp_path)
    q, v = _flow(o)
    assert o.authorize(q)[0] == 200  # form only, no code
    st, h, _ = o.authorize(q, "owner-pass-1234567890abcd")
    assert st == 302
    code = parse_qs(urlparse(h["location"]).query)["code"][0]
    assert parse_qs(urlparse(h["location"]).query)["state"] == ["xyz"]
    st, tok = o.token({"grant_type": "authorization_code", "code": code, "redirect_uri": q["redirect_uri"], "code_verifier": v, "client_id": "cid", "client_secret": "s" * 30})
    assert st == 200 and o.valid_access(tok["access_token"])
    assert o.token({"grant_type": "authorization_code", "code": code, "redirect_uri": q["redirect_uri"], "code_verifier": v, "client_id": "cid", "client_secret": "s" * 30})[0] == 400  # single use
    st, t2 = o.token({"grant_type": "refresh_token", "refresh_token": tok["refresh_token"], "client_id": "cid", "client_secret": "s" * 30})
    assert st == 200 and o.valid_access(t2["access_token"])
    assert oct(o.store.stat().st_mode)[-3:] == "600" and tok["access_token"] not in o.store.read_text()


def test_oauth_rejections(tmp_path, monkeypatch):
    monkeypatch.setattr("time.sleep", lambda s: None)
    o = _oauth(tmp_path)
    q, v = _flow(o)
    assert o.authorize(q, "wrong")[0] == 403
    assert o.authorize({**q, "redirect_uri": "https://evil.example/cb"})[0] == 400
    assert o.authorize({**q, "code_challenge_method": "plain"})[0] == 400
    st, h, _ = o.authorize(q, "owner-pass-1234567890abcd")
    code = h["location"].split("code=")[1].split("&")[0]
    assert o.token({"grant_type": "authorization_code", "code": code, "redirect_uri": q["redirect_uri"], "code_verifier": "bad", "client_id": "cid", "client_secret": "s" * 30})[0] == 400
    assert o.token({"grant_type": "authorization_code", "code": "x", "client_id": "cid", "client_secret": "nope"})[0] == 401
