"""Spec 125: typed advisory, private disclosure and durable spend boundaries."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import importlib.util
import json
import shlex
import subprocess
import sys
import time
from pathlib import Path

import pytest

PATH = Path(__file__).resolve().parents[2] / "mcp-servers/jev-mcp/core.py"
spec = importlib.util.spec_from_file_location("jev_core_test", PATH)
jev = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = jev
spec.loader.exec_module(jev)

QUESTIONS = {
    "support": {"type": "noul", "instructions": "Does the observation support the conclusion?"},
    "next": {"type": "choice", "instructions": "Which diagnostic is most relevant?", "criteria": {"inspect": "Read another observation", "none": "No further observation"}},
    "complete": {"type": "score", "instructions": "How complete is the evidence?", "criteria": ["Missing observations", "All observations present"]},
}
RESPONSE = {"model": "jev-1.13.0", "answers": {
    "support": {"type": "noul", "noul": .8},
    "next": {"type": "choice", "choice": "inspect", "confidence": .5, "probabilities": {"inspect": .8, "none": .2}},
    "complete": {"type": "score", "score": .8, "confidence": .5, "probabilities": {"0": .2, "1": .8}, "legend": {"0": "Missing observations", "1": "All observations present"}},
}, "usage": {"input_tokens": 100, "output_tokens": 20}}


@pytest.fixture
def config(tmp_path):
    return jev.Config.from_env({"JEV_ENABLED": "true", "TYPESAFE_API_KEY": "synthetic-test-token", "JEV_DATA_DIR": str(tmp_path / "jev"), "JEV_TASK_ID": "task-a"})


async def good_transport(config, payload):
    return json.loads(json.dumps(RESPONSE))


def call(config, **kwargs):
    args = {"state": {"observation": "The synthetic link is operational"}, "questions": QUESTIONS,
            "purpose": "evidence_review", "evidence_metadata": [{"source": "synthetic", "observed_at": "2026-09-27T15:24:00Z"}],
            "config": config, "transport": good_transport, "auditor": lambda _: {"status": "recorded", "commit": "12345678"}}
    args.update(kwargs)
    return asyncio.run(jev.evaluate(**args))


def test_typed_batch_reconciles_cost_and_keeps_provenance(config):
    result = call(config)
    assert result["status"] == "ok"
    assert result["answers"] == RESPONSE["answers"]
    assert result["questions"] == QUESTIONS
    assert result["advisory_only"] is True
    assert result["audit"]["gait"]["status"] == "recorded"
    assert result["cost_usd"] == pytest.approx(.0000042)
    persisted = jev.Ledger(config.data_dir).assessment(result["assessment_id"], config.task_id)
    assert persisted["answers"] == result["answers"]
    assert "state" not in persisted
    snapshot = json.loads((config.data_dir / "status.json").read_text())
    assert "answers" not in snapshot["latest_assessment"]
    assert "questions" not in snapshot["latest_assessment"]
    assert config.api_key not in json.dumps(snapshot)


def test_disabled_and_missing_key_never_send(config):
    async def forbidden(*_):
        pytest.fail("must not send")
    assert call(replace(config, enabled=False), transport=forbidden)["status"] == "disabled"
    assert call(replace(config, api_key=""), transport=forbidden)["status"] == "unavailable"


@pytest.mark.parametrize("state", [{"password": "abc"}, {"nested": [{"api_key": "abc"}]}, '{"password":"abc"}', "username admin secret s3cr3t", "-----BEGIN RSA PRIVATE KEY-----", "Bearer 12345678", " password 7 encrypted-value", "enable password abc"])
def test_credentials_cannot_be_approved_or_prepared(config, state):
    assert call(config, state=state, data_classification="private", prepare_only=True)["status"] == "invalid_request"
    assert not (config.data_dir / "ledger.sqlite3").exists()


def test_private_approval_exact_scope_expiry_and_replay(config):
    args = {"state": {"observation": "private observation"}, "data_classification": "private"}
    preview = call(config, **args, prepare_only=True)
    assert preview["approval_required"]
    assert not (config.data_dir / "ledger.sqlite3").exists()
    assert call(config, **args)["status"] == "approval_required"
    ledger = jev.Ledger(config.data_dir)
    ledger.approve(preview["request_digest"], config.task_id, config.endpoint)
    assert call(config, **{**args, "state": {"observation": "changed private observation"}})["status"] == "approval_required"
    assert call(replace(config, task_id="task-b"), **args)["status"] == "approval_required"
    admitted = call(config, **args)
    assert admitted["status"] == "ok"
    assert admitted["approval_required"] is False
    assert admitted["disclosure_status"] == "approved_consumed"
    assert "disclosure_approval" not in admitted
    assert call(config, **args)["status"] == "approval_required"
    ledger.approve(preview["request_digest"], config.task_id, config.endpoint)
    with ledger.connect() as db:
        db.execute("UPDATE grants SET expires_at=?", (time.time() - 1,))
    assert call(config, **args)["status"] == "approval_required"


def test_disclosure_guidance_records_grant_for_exact_retry(config):
    args = {"state": "private synthetic observation", "data_classification": "private"}
    blocked = call(config, **args)
    assert blocked["status"] == "approval_required"
    guidance = blocked["disclosure_approval"]
    assert guidance["gate"] == "local_operator_ledger"
    assert "Slack confirmation" in guidance["instructions"]
    assert jev.Ledger(config.data_dir).totals(config.task_id) == (0, 0)
    command = shlex.split(guidance["operator_command"])
    assert command[command.index("--data-dir") + 1] == str(config.data_dir)
    assert command[command.index("approve-disclosure") + 1] == blocked["request_digest"]
    assert command[command.index("--endpoint") + 1] == config.endpoint
    assert command[command.index("--task") + 1] == config.task_id
    subprocess.run(command, check=True, capture_output=True, text=True)
    assert call(config, **args)["status"] == "ok"
    assert call(config, **args)["status"] == "approval_required"


def test_legacy_assessment_readback_does_not_request_repeat_approval(config):
    args = {"state": "private synthetic observation", "data_classification": "private"}
    preview = call(config, **args, prepare_only=True)
    ledger = jev.Ledger(config.data_dir)
    ledger.approve(preview["request_digest"], config.task_id, config.endpoint)
    result = call(config, **args)
    legacy = {**result, "approval_required": True, "disclosure_approval": preview["disclosure_approval"]}
    ledger.finish(result["assessment_id"], legacy)
    before = ledger.totals(config.task_id)
    readback = ledger.assessment(result["assessment_id"], config.task_id)
    assert readback["approval_required"] is False
    assert readback["disclosure_status"] == "approved_consumed"
    assert "disclosure_approval" not in readback
    assert readback["answers"] == result["answers"]
    assert ledger.totals(config.task_id) == before
    assert ledger.assessment(result["assessment_id"], "different-task") is None
    assert call(config, **args)["status"] == "approval_required"


@pytest.mark.parametrize("state", ["peer 10.0.0.1", "peer 2001:db8::1", "router bgp 65001", "hostname private-router"])
def test_private_heuristics_require_approval_even_when_mislabeled(config, state):
    assert call(config, state=state)["status"] == "approval_required"


def test_loopback_private_allowed_but_credentials_denied(config):
    local = replace(config, endpoint="http://127.0.0.1:8000/v1/systemone", api_key="", price=0)
    assert call(local, state="peer 10.0.0.1", data_classification="private")["status"] == "ok"
    assert call(local, state={"password": "abc"})["status"] == "invalid_request"


def test_invalid_provider_and_timeouts_retain_reservation(config):
    async def fail(*_):
        raise jev.Refused("timeout", "Synthetic timeout")
    result = call(config, transport=fail)
    assert result["status"] == "timeout"
    assert result["charge_status"] == "reserved_unknown"
    assert jev.Ledger(config.data_dir).totals(config.task_id)[0] == pytest.approx(65536 * .042 / 1e6)
    async def malformed(*_):
        return {"error": "upstream-secret-content"}
    result = call(config, transport=malformed)
    assert result["status"] == "incompatible_provider"
    assert "upstream-secret-content" not in json.dumps(result)


@pytest.mark.parametrize("mutate", [
    lambda d: d["answers"]["support"].update(noul=float("nan")),
    lambda d: d["answers"]["support"].update(noul=True),
    lambda d: d["answers"]["support"].update(noul=1.1),
    lambda d: d["answers"]["next"].update(choice="none"),
    lambda d: d["answers"]["next"].update(probabilities={"inspect": .4, "none": .4}),
    lambda d: d["answers"]["complete"].update(score=.1),
    lambda d: d["answers"].pop("support"),
    lambda d: d["usage"].update(input_tokens=-1),
    lambda d: d.update(model="different-model"),
])
def test_incompatible_provider_values(config, mutate):
    async def changed(*_):
        data = json.loads(json.dumps(RESPONSE))
        mutate(data)
        return data
    assert call(config, transport=changed)["status"] == "incompatible_provider"


def test_concurrent_reservations_survive_restart_and_cannot_overspend(config):
    config = replace(config, case_limit=.006)
    async def failed(*_):
        raise jev.Refused("timeout", "Synthetic timeout")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: call(config, transport=failed), range(8)))
    assert sum(r["status"] == "timeout" for r in results) == 2
    assert sum(r["status"] == "budget_exhausted" for r in results) == 6
    assert jev.Ledger(config.data_dir).totals(config.task_id)[1] <= .006
    assert call(config)["status"] == "budget_exhausted"


def test_daily_budget_crosses_tasks_and_case_budget_spans_days(config):
    config = replace(config, daily_limit=.003)
    async def failed(*_):
        raise jev.Refused("timeout", "Synthetic timeout")
    assert call(config, transport=failed)["status"] == "timeout"
    assert call(replace(config, task_id="task-b"))["status"] == "budget_exhausted"
    with jev.Ledger(config.data_dir).connect() as db:
        db.execute("UPDATE calls SET day='2000-01-01'")
    assert jev.Ledger(config.data_dir).totals(config.task_id)[0] == 0
    assert jev.Ledger(config.data_dir).totals(config.task_id)[1] > 0


def test_one_reconsideration_same_task_only(config):
    first = call(config)
    assert call(replace(config, task_id="task-b"), reconsideration_of=first["assessment_id"])["status"] == "invalid_request"
    second = call(config, reconsideration_of=first["assessment_id"])
    assert second["status"] == "ok"
    assert call(config, reconsideration_of=first["assessment_id"])["status"] == "invalid_request"
    assert call(config, reconsideration_of=second["assessment_id"])["status"] == "invalid_request"
    assert jev.Ledger(config.data_dir).assessment(first["assessment_id"], "task-b") is None


def test_operator_settings_bind_task_and_caps(config):
    config.data_dir.mkdir()
    (config.data_dir / "settings.json").write_text(json.dumps({"task_id": "operator-task", "daily_limit_usd": 1, "case_overrides": {"operator-task": .1}}))
    loaded = jev.Config.from_env({"JEV_DATA_DIR": str(config.data_dir), "JEV_INPUT_PRICE_PER_MILLION": ""})
    assert loaded.task_id == "operator-task"
    assert loaded.daily_limit == 1 and loaded.case_limit == .1 and loaded.price == .042
    assert jev.Config.from_env({"JEV_DATA_DIR": str(config.data_dir), "JEV_TASK_ID": "runtime-task"}).task_id == "runtime-task"


def test_endpoint_security_and_custom_price():
    for endpoint in ("http://example.com", "https://user:password@example.com", "https://example.com?key=abc", "https://example.com/#key"):
        with pytest.raises(jev.Refused):
            jev.endpoint_url(endpoint)
    assert jev.endpoint_url("http://127.0.0.1:8000") == "http://127.0.0.1:8000/v1/systemone"
    with pytest.raises(jev.Refused):
        jev.Config.from_env({"JEV_BASE_URL": "http://localhost:8000", "JEV_INPUT_PRICE_PER_MILLION": ""})
    custom = jev.Config.from_env({"JEV_BASE_URL": "http://localhost:8000", "JEV_INPUT_PRICE_PER_MILLION": "0", "TYPESAFE_API_KEY": "hosted-secret"})
    assert custom.api_key == "" and custom.price == 0
    with pytest.raises(jev.Refused):
        jev.Config.from_env({"JEV_BASE_URL": "https://other.example", "JEV_INPUT_PRICE_PER_MILLION": "0", "JEV_COMPATIBLE_API_KEY": "custom-secret"})


def test_symlink_state_refused(tmp_path):
    actual = tmp_path / "actual"
    actual.mkdir()
    link = tmp_path / "linked"
    link.symlink_to(actual, target_is_directory=True)
    with pytest.raises(jev.Refused):
        jev.Ledger(link)
    (actual / "ledger.sqlite3").symlink_to(tmp_path / "other")
    with pytest.raises(jev.Refused):
        jev.Ledger(actual)


def test_provider_accounting_overrun_records_claim_and_blocks(config):
    async def overrun(*_):
        data = json.loads(json.dumps(RESPONSE))
        data["usage"]["input_tokens"] = 100000
        return data
    result = call(config, transport=overrun)
    assert result["status"] == "usage_bound_exceeded"
    assert result["cost_usd"] == pytest.approx(.0042)
    assert call(config)["status"] == "incompatible_provider"


def test_audit_unavailable_is_explicit(config):
    result = call(config, auditor=lambda _: {"status": "unavailable"})
    assert result["status"] == "ok" and result["audit"]["gait"]["status"] == "unavailable"


def test_http_redirects_never_follow_or_leak_header(config, monkeypatch):
    import httpx
    requests = []
    def handler(request):
        requests.append(request)
        return httpx.Response(307, headers={"location": "https://attacker.invalid"})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    result = call(config, transport=jev.provider_call)
    assert result["status"] == "unavailable"
    assert len(requests) == 1


def test_http_call_deadline(config, monkeypatch):
    import httpx
    async def handler(request):
        await asyncio.sleep(.5)
        return httpx.Response(200, json=RESPONSE)
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    start = time.monotonic()
    result = call(replace(config, timeout=.05), transport=jev.provider_call)
    assert result["status"] == "timeout"
    assert time.monotonic() - start < .4


@pytest.mark.parametrize("criteria", [{"a": None, "b": "Description"}, {"a": "", "b": "Description"}, {"a": "   ", "b": "Description"}])
def test_empty_choice_descriptions_rejected(config, criteria):
    questions = {"q": {"type": "choice", "instructions": "Which applies?", "criteria": criteria}}
    assert call(config, questions=questions, prepare_only=True)["status"] == "invalid_request"


def test_existing_nonprivate_directory_not_silently_chmodded(tmp_path):
    directory = tmp_path / "unrelated"
    directory.mkdir(mode=0o755)
    with pytest.raises(jev.Refused):
        jev.Ledger(directory)
    assert directory.stat().st_mode & 0o777 == 0o755
