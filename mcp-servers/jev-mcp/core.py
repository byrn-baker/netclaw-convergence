"""Jev's advisory boundary: typed requests, disclosure consent and durable spend caps.

No network-device tools live here. Configuration and consent are operator inputs,
never inference-tool arguments. Unknown provider charges retain their reservation.
"""
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import json
import math
import os
import re
import shlex
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlsplit, urlunsplit

HOSTED = "https://api.typesafe.ai/v1/systemone"
PURPOSES = {"evidence_review", "specialist_advice", "answer_review", "diagnostic_advice", "change_review", "incident_triage"}
MAX_REQUEST_BYTES = 48_000
MAX_RESPONSE_BYTES = 256_000


class Refused(ValueError):
    def __init__(self, status: str, message: str):
        self.status, self.message = status, message
        super().__init__(message)


def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def number(value: Any, low: float = 0, high: float = float("inf")) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not low <= value <= high:
        raise Refused("invalid_request", "A numeric value is invalid or outside its allowed range.")
    return float(value)


def endpoint_url(value: str) -> str:
    try:
        parts = urlsplit(value)
        host = parts.hostname
        port = parts.port
    except ValueError:
        raise Refused("unavailable", "Invalid configured endpoint.") from None
    if not host or parts.username or parts.password or parts.query or parts.fragment:
        raise Refused("unavailable", "Endpoint must have a host and no credentials, query or fragment.")
    local = host in {"localhost", "127.0.0.1", "::1"}
    if parts.scheme != "https" and not (parts.scheme == "http" and local):
        raise Refused("unavailable", "Remote endpoints require HTTPS; HTTP is supported only for explicit loopback endpoints.")
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") or "/v1/systemone", "", ""))


@dataclass(frozen=True)
class Config:
    enabled: bool
    endpoint: str
    model: str
    api_key: str
    daily_limit: float
    case_limit: float
    price: float
    timeout: float
    data_dir: Path
    task_id: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Config":
        env = os.environ if env is None else env
        directory = Path(env.get("JEV_DATA_DIR") or "~/.openclaw/jev").expanduser()
        try:
            if directory.is_symlink() or (directory / "settings.json").is_symlink():
                raise ValueError("symlink")
            settings = json.loads((directory / "settings.json").read_text()) if (directory / "settings.json").exists() else {}
            endpoint = endpoint_url(env.get("JEV_BASE_URL") or env.get("JEV_ENDPOINT") or HOSTED)
            task = env.get("JEV_TASK_ID") or settings.get("task_id") or "unscoped"
            if not isinstance(task, str) or not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", task):
                raise ValueError("task")
            daily = number(float(settings.get("daily_limit_usd", env.get("JEV_DAILY_LIMIT_USD", "5"))))
            case = number(float(settings.get("case_overrides", {}).get(task, settings.get("case_limit_usd", env.get("JEV_CASE_LIMIT_USD", ".25")))))
            if endpoint != HOSTED and not env.get("JEV_INPUT_PRICE_PER_MILLION"):
                raise Refused("unavailable", "Compatible endpoints require an explicit input price, including zero for free services.")
            price = number(float(env.get("JEV_INPUT_PRICE_PER_MILLION") or ".042"))
            timeout = number(float(env.get("JEV_TIMEOUT_SECONDS", "5")), .05, 120)
            model = env.get("JEV_MODEL", "jev-1.13.0")
            if not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", model):
                raise ValueError("model")
            api_key = (env.get("TYPESAFE_API_KEY") or env.get("JEV_API_KEY", "")) if endpoint == HOSTED else env.get("JEV_COMPATIBLE_API_KEY", "")
            if endpoint != HOSTED and api_key and endpoint_url(env.get("JEV_COMPATIBLE_KEY_ENDPOINT", "")) != endpoint:
                raise Refused("unavailable", "Compatible API key must be bound to its exact configured endpoint by operator setup.")
            return cls(env.get("JEV_ENABLED", "false").lower() in {"1", "true", "yes"}, endpoint, model,
                       api_key, daily, case, price, timeout, directory, task)
        except (ValueError, TypeError, AttributeError, OSError):
            raise Refused("unavailable", "Invalid Jev operator configuration; check settings and environment.") from None


def validate_questions(questions: dict) -> None:
    if not isinstance(questions, dict) or not 1 <= len(questions) <= 64:
        raise Refused("invalid_request", "Supply between 1 and 64 dynamically authored questions.")
    for identifier, q in questions.items():
        if not isinstance(identifier, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", identifier) or not isinstance(q, dict):
            raise Refused("invalid_request", "Question IDs and question objects are invalid.")
        if set(q) - {"type", "instructions", "criteria"} or q.get("type") not in {"noul", "choice", "score"}:
            raise Refused("invalid_request", "Only typed Noul, Choice and Score questions are supported.")
        if not isinstance(q.get("instructions"), (str, dict, list)) or not q["instructions"]:
            raise Refused("invalid_request", "Every question requires nonempty instructions.")
        criteria = q.get("criteria")
        if q["type"] == "noul":
            if criteria is not None and (not isinstance(criteria, dict) or set(criteria) != {"true", "false"}):
                raise Refused("invalid_request", "Noul criteria must describe true and false.")
        elif q["type"] == "choice":
            if not isinstance(criteria, dict) or not 2 <= len(criteria) <= 255 or any(not isinstance(k, str) or not k or len(k) > 128 for k in criteria):
                raise Refused("invalid_request", "Choice requires 2–255 labeled criteria.")
        elif not isinstance(criteria, list) or not 2 <= len(criteria) <= 10:
            raise Refused("invalid_request", "Score requires 2–10 ordered descriptive criteria.")
        values = criteria.values() if isinstance(criteria, dict) else criteria or []
        if any(not isinstance(v, (str, dict, list)) or not v or (isinstance(v, str) and not v.strip()) for v in values):
            raise Refused("invalid_request", "Criteria must contain descriptions, not numeric ratings.")


def validate_response(data: Any, questions: dict) -> dict:
    try:
        if not isinstance(data, dict) or not isinstance(data.get("model"), str) or not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", data["model"]):
            raise ValueError()
        answers = data["answers"]
        if not isinstance(answers, dict) or set(answers) != set(questions):
            raise ValueError()
        clean = {}
        for identifier, q in questions.items():
            answer = answers[identifier]
            if not isinstance(answer, dict) or answer.get("type") != q["type"]:
                raise ValueError()
            if q["type"] == "noul":
                clean[identifier] = {"type": "noul", "noul": number(answer["noul"], 0, 1)}
                continue
            labels = set(q["criteria"]) if q["type"] == "choice" else {str(i) for i in range(len(q["criteria"]))}
            probs = answer["probabilities"]
            if not isinstance(probs, dict) or set(probs) != labels:
                raise ValueError()
            probs = {label: number(p, 0, 1) for label, p in probs.items()}
            if abs(sum(probs.values()) - 1) > .005:
                raise ValueError()
            result = {"type": q["type"], "probabilities": probs, "confidence": number(answer["confidence"], 0, 1)}
            if q["type"] == "choice":
                choice = answer["choice"]
                if choice not in labels or probs[choice] < max(probs.values()) - .005:
                    raise ValueError()
                result["choice"] = choice
            else:
                score = number(answer["score"], 0, len(labels) - 1)
                if abs(score - sum(int(k) * p for k, p in probs.items())) > .03:
                    raise ValueError()
                legend = {str(i): item for i, item in enumerate(q["criteria"])}
                if answer.get("legend") != legend:
                    raise ValueError()
                result.update(score=score, legend=legend)
            clean[identifier] = result
        usage = data["usage"]
        if not isinstance(usage, dict) or any(type(usage.get(k)) is not int or usage[k] < 0 for k in ("input_tokens", "output_tokens")):
            raise ValueError()
        return {"model": data["model"], "answers": clean, "usage": {k: usage[k] for k in ("input_tokens", "output_tokens")}}
    except (KeyError, TypeError, ValueError):
        raise Refused("incompatible_provider", "Provider returned an invalid typed assessment or usage record.") from None


SECRET_PATTERN = re.compile(r"(?i)(?:-----BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+[A-Za-z0-9_.-]{8,}|(?:password|passwd|api[_ -]?key|access[_ -]?token|client[_ -]?secret|community)[\"']?\s*[=:]\s*[\"']?[^\s\"',}]{3,}|(?:enable secret|snmp-server community|username\s+\S+\s+(?:password|secret))\s+\S+)")
CONFIG_SECRET_PATTERN = re.compile(r"(?im)^\s*(?:enable\s+)?(?:password|secret)\s+\S+")
PRIVATE_PATTERN = re.compile(r"(?i)(?:\b(?:running-config|startup-config)\b|\b(?:router (?:bgp|ospf)|interface (?:Gigabit|Ethernet|Loopback)|hostname)\s+\S+|\b(?:\d{1,3}\.){3}\d{1,3}\b)")
SECRET_KEYS = {"password", "passwd", "apikey", "accesskey", "accesstoken", "refreshtoken", "clientsecret", "privatekey", "authorization", "community", "credential", "credentials"}


def contains_secret(value: Any) -> bool:
    if isinstance(value, dict):
        return any(re.sub(r"[^a-z]", "", str(key).lower()) in SECRET_KEYS and bool(item) or contains_secret(item) for key, item in value.items())
    if isinstance(value, list):
        return any(contains_secret(item) for item in value)
    return isinstance(value, str) and bool(SECRET_PATTERN.search(value) or CONFIG_SECRET_PATTERN.search(value))


def contains_private(value: str) -> bool:
    if PRIVATE_PATTERN.search(value):
        return True
    for token in re.findall(r"[a-fA-F0-9:]{4,}", value):
        if ":" in token:
            try:
                ipaddress.IPv6Address(token)
                return True
            except ValueError:
                pass
    return False


class Ledger:
    def __init__(self, directory: Path):
        self.directory = Path(directory).expanduser()
        if self.directory.is_symlink() or any((self.directory / name).is_symlink() for name in ("ledger.sqlite3", "ledger.sqlite3-journal", "ledger.sqlite3-wal", "ledger.sqlite3-shm", "settings.json")):
            raise Refused("unavailable", "Jev state files must not be symbolic links.")
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.directory.stat().st_mode & 0o077:
            raise Refused("unavailable", "Jev state directory must have private permissions (0700).")
        self.path = self.directory / "ledger.sqlite3"
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS calls (
                    id TEXT PRIMARY KEY, day TEXT NOT NULL, task TEXT NOT NULL,
                    cost REAL NOT NULL, parent TEXT UNIQUE, digest TEXT NOT NULL,
                    status TEXT NOT NULL, record TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS grants (
                    digest TEXT, task_id TEXT, endpoint TEXT, expires_at REAL,
                    consumed INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY(digest,task_id,endpoint));
            """)
        os.chmod(self.path, 0o600)

    def connect(self):
        return sqlite3.connect(self.path, timeout=10)

    def approve(self, digest: str, task_id: str, endpoint: str, expires_in: int = 300) -> dict:
        if not re.fullmatch(r"[a-f0-9]{64}", digest) or not 1 <= expires_in <= 3600:
            raise ValueError("Invalid approval digest or expiry (1–3600 seconds).")
        endpoint = endpoint_url(endpoint)
        expiry = time.time() + expires_in
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO grants VALUES (?,?,?,?,0)", (digest, task_id, endpoint, expiry))
        return {"digest": digest, "task_id": task_id, "endpoint": endpoint, "expires_at": expiry, "single_use": True}

    def totals(self, task: str) -> tuple[float, float]:
        with self.connect() as db:
            day = datetime.now(timezone.utc).date().isoformat()
            daily = db.execute("SELECT COALESCE(SUM(cost),0) FROM calls WHERE day=?", (day,)).fetchone()[0]
            case = db.execute("SELECT COALESCE(SUM(cost),0) FROM calls WHERE task=?", (task,)).fetchone()[0]
            return daily, case

    def reserve(self, config: Config, record: dict, cost: float, approval: bool) -> None:
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if db.execute("SELECT 1 FROM calls WHERE status='usage_bound_exceeded' LIMIT 1").fetchone():
                raise Refused("incompatible_provider", "A provider exceeded the supported accounting bound; operator review of the ledger is required before more calls.")
            parent = record.get("reconsideration_of")
            if parent:
                previous = db.execute("SELECT task,parent,status,digest FROM calls WHERE id=?", (parent,)).fetchone()
                if not previous or previous[0] != config.task_id or previous[1] is not None or previous[2] != "ok" or db.execute("SELECT 1 FROM calls WHERE parent=?", (parent,)).fetchone():
                    raise Refused("invalid_request", "Reconsideration requires an initial successful assessment in this task with no prior reconsideration.")
            day = datetime.now(timezone.utc).date().isoformat()
            daily = db.execute("SELECT COALESCE(SUM(cost),0) FROM calls WHERE day=?", (day,)).fetchone()[0]
            case = db.execute("SELECT COALESCE(SUM(cost),0) FROM calls WHERE task=?", (config.task_id,)).fetchone()[0]
            if daily + cost > config.daily_limit or case + cost > config.case_limit:
                raise Refused("budget_exhausted", "Daily or originating-task Jev budget is exhausted; an operator may adjust it.")
            if approval:
                consumed = db.execute("UPDATE grants SET consumed=1 WHERE digest=? AND task_id=? AND endpoint=? AND expires_at>? AND consumed=0", (record["request_digest"], config.task_id, config.endpoint, time.time())).rowcount
                if not consumed:
                    raise Refused("approval_required", "Private disclosure requires exact-request, destination and task-bound operator approval.")
            record.update(approval_required=False, disclosure_required=approval,
                          disclosure_status="approved_consumed" if approval else "not_required")
            record.pop("disclosure_approval", None)
            db.execute("INSERT INTO calls VALUES (?,?,?,?,?,?,?,?)", (record["assessment_id"], day, config.task_id, cost, parent, record["request_digest"], "pending", canonical(record)))

    def finish(self, identifier: str, record: dict, cost: float | None = None):
        with self.connect() as db:
            if cost is None:
                db.execute("UPDATE calls SET status=?,record=? WHERE id=?", (record["status"], canonical(record), identifier))
            else:
                db.execute("UPDATE calls SET status=?,record=?,cost=? WHERE id=?", (record["status"], canonical(record), cost, identifier))

    def assessment(self, identifier: str, task: str) -> dict | None:
        with self.connect() as db:
            row = db.execute("SELECT record FROM calls WHERE id=? AND task=?", (identifier, task)).fetchone()
        if not row:
            return None
        record = json.loads(row[0])
        # Older records retained preview-only approval fields. A calls row is
        # inserted only after successful admission (including atomic grant
        # consumption), so reading it must not ask for another disclosure.
        if record.get("approval_required"):
            record.update(approval_required=False, disclosure_required=True,
                          disclosure_status="approved_consumed")
            record.pop("disclosure_approval", None)
        return record


def gait_audit(record: dict) -> dict:
    """Isolate optional GAIT dependencies and bound their wall time; never expose errors."""
    venv = Path(os.environ.get("GAIT_VENV", "~/.openclaw/gait-venv")).expanduser()
    python = str(venv / "bin/python") if (venv / "bin/python").exists() else sys.executable
    try:
        result = subprocess.run([python, str(Path(__file__).with_name("audit_worker.py"))],
                                input=canonical(record), capture_output=True, text=True, timeout=3)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            if isinstance(data.get("commit"), str) and re.fullmatch(r"[a-f0-9]{8,64}", data["commit"]):
                return {"status": "recorded", "commit": data["commit"]}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        pass
    return {"status": "unavailable", "message": "Local audit retained; GAIT could not be recorded."}


def status(config: Config | None = None) -> dict:
    config = config or Config.from_env()
    ledger = Ledger(config.data_dir)
    daily, case = ledger.totals(config.task_id)
    result = {"enabled": config.enabled, "ready": config.enabled and (config.endpoint != HOSTED or bool(config.api_key)),
              "advisory_only": True, "model": config.model, "endpoint": config.endpoint,
              "task_id": config.task_id, "updated_at": now(),
              "budgets": {"daily_limit_usd": config.daily_limit, "case_limit_usd": config.case_limit,
                          "daily_used_usd": daily, "case_used_usd": case}}
    with ledger.connect() as db:
        row = db.execute("SELECT record FROM calls ORDER BY rowid DESC LIMIT 1").fetchone()
    if row:
        latest = json.loads(row[0])
        # No dynamic labels, questions or raw answers enter the browser snapshot.
        result["latest_assessment"] = {key: latest[key] for key in ("assessment_id", "created_at", "purpose", "status", "advisory_only") if key in latest}
        result["latest_assessment"]["question_count"] = len(latest.get("questions", {}))
        result["latest_assessment"]["audit"] = latest.get("audit", {})
    fd, name = tempfile.mkstemp(prefix="status-", suffix=".json", dir=config.data_dir)
    try:
        with os.fdopen(fd, "w") as output:
            json.dump(result, output)
        os.replace(name, config.data_dir / "status.json")
    finally:
        if os.path.exists(name):
            os.unlink(name)
    return result


async def provider_call(config: Config, payload: dict) -> dict:
    import httpx
    headers = {"Content-Type": "application/json"}
    if config.api_key:
        headers["Authorization"] = "Bearer " + config.api_key
    async def send():
        async with httpx.AsyncClient(timeout=config.timeout, follow_redirects=False, trust_env=False) as client:
            async with client.stream("POST", config.endpoint, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    raise Refused("unavailable", "Provider rejected the assessment; no automatic retry was made.")
                chunks, size = [], 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_RESPONSE_BYTES:
                        raise Refused("incompatible_provider", "Provider response exceeded the allowed size.")
                    chunks.append(chunk)
                try:
                    return json.loads(b"".join(chunks))
                except ValueError:
                    raise Refused("incompatible_provider", "Provider response was not valid JSON.") from None
    try:
        return await asyncio.wait_for(send(), timeout=config.timeout)
    except (asyncio.TimeoutError, httpx.TimeoutException):
        raise Refused("timeout", "Assessment deadline elapsed; the charge reservation is retained.") from None
    except httpx.HTTPError:
        raise Refused("unavailable", "Provider transport unavailable; the charge reservation is retained.") from None


async def evaluate(state: str | dict, questions: dict, purpose: str, evidence_metadata: list[dict],
                   data_classification: str = "sanitized", prepare_only: bool = False,
                   reconsideration_of: str | None = None, *, config: Config | None = None,
                   transport=None, auditor=None) -> dict:
    """All caller inputs are untrusted; config/transport/auditor are host-only dependencies."""
    record = None
    ledger = None
    try:
        config = config or Config.from_env()
        if not isinstance(state, (str, dict)) or not state or purpose not in PURPOSES or data_classification not in {"sanitized", "private"}:
            raise Refused("invalid_request", "Supply state, a supported advisory purpose and a data classification.")
        if not isinstance(evidence_metadata, list) or len(evidence_metadata) > 64 or any(not isinstance(e, dict) for e in evidence_metadata):
            raise Refused("invalid_request", "Evidence provenance must be a list of up to 64 metadata objects.")
        validate_questions(questions)
        payload = {"model": config.model, "state": state, "questions": questions}
        binding = {"payload": payload, "endpoint": config.endpoint, "task_id": config.task_id,
                   "purpose": purpose, "evidence_metadata": evidence_metadata,
                   "data_classification": data_classification, "reconsideration_of": reconsideration_of}
        try:
            encoded = canonical(binding)
        except (ValueError, TypeError, RecursionError):
            raise Refused("invalid_request", "Request must be finite, serializable JSON.") from None
        if len(encoded.encode()) > MAX_REQUEST_BYTES:
            raise Refused("invalid_request", "Request exceeds the 48,000-byte supported input bound.")
        if contains_secret(binding) or SECRET_PATTERN.search(encoded) or (config.api_key and config.api_key in encoded):
            raise Refused("invalid_request", "Credentials must be removed before any evaluation or disclosure approval.")
        private = data_classification == "private" or contains_private(encoded)
        remote = urlsplit(config.endpoint).hostname not in {"localhost", "127.0.0.1", "::1"}
        approval = private and remote
        digest = hashlib.sha256(encoded.encode()).hexdigest()
        # Reserve the complete supported provider context, not a characters/4 guess.
        # Actual valid usage releases the unused amount; unknown charges keep it.
        reserved_tokens = 65_536
        reserved_cost = reserved_tokens * config.price / 1_000_000
        preview = {"status": "prepared", "advisory_only": True, "request_digest": digest,
                   "endpoint": config.endpoint, "task_id": config.task_id, "approval_required": approval,
                   "reserved_input_tokens": reserved_tokens, "reserved_cost_usd": reserved_cost}
        if approval:
            command = [sys.executable, str(Path(__file__).resolve().parents[2] / "scripts/jev-settings.py"),
                       "--data-dir", str(config.data_dir), "approve-disclosure", digest,
                       "--endpoint", config.endpoint, "--task", config.task_id]
            preview["disclosure_approval"] = {
                "gate": "local_operator_ledger", "operator_command": shlex.join(command),
                "instructions": "Operator must record the exact disclosure grant locally. A Slack confirmation "
                "alone does not record it. Preserve all tool arguments, including metadata, and resend unchanged "
                "once after approval is recorded. Do not request repeated confirmations or change the payload.",
            }
        if prepare_only:
            return preview
        if not config.enabled:
            raise Refused("disabled", "Jev is disabled; enable it through operator setup.")
        if config.endpoint == HOSTED and not config.api_key:
            raise Refused("unavailable", "Hosted Jev requires a configured API key.")
        ledger = Ledger(config.data_dir)
        record = {**preview, "assessment_id": uuid.uuid4().hex, "created_at": now(), "purpose": purpose,
                  "questions": questions, "evidence_metadata": evidence_metadata,
                  "state_digest": hashlib.sha256(canonical(state).encode()).hexdigest(),
                  "reconsideration_of": reconsideration_of, "status": "pending"}
        ledger.reserve(config, record, reserved_cost, approval)
        try:
            raw = await (transport or provider_call)(config, payload)
            answer = validate_response(raw, questions)
            if answer["model"] != config.model:
                raise Refused("incompatible_provider", "Provider returned a different model than the configured model.")
            actual_tokens = answer["usage"]["input_tokens"]
            if actual_tokens > reserved_tokens:
                record.update(status="usage_bound_exceeded", message="Provider exceeded its supported accounting bound; further calls are blocked pending operator review.",
                              usage=answer["usage"], cost_usd=actual_tokens * config.price / 1_000_000, charge_status="reported_above_bound")
                ledger.finish(record["assessment_id"], record, record["cost_usd"])
                raise Refused("incompatible_provider", record["message"])
            actual_cost = actual_tokens * config.price / 1_000_000
            record.update(answer, status="ok", cost_usd=actual_cost, charge_status="reconciled")
            ledger.finish(record["assessment_id"], record, actual_cost)
        except Refused as exc:
            if record["status"] != "usage_bound_exceeded":
                record.update(status=exc.status, message=exc.message, charge_status="reserved_unknown")
            ledger.finish(record["assessment_id"], record)
        except Exception:
            record.update(status="unavailable", message="Assessment unavailable; reservation retained.", charge_status="reserved_unknown")
            ledger.finish(record["assessment_id"], record)
        record["audit"] = {"local": "recorded", "gait": await asyncio.to_thread(auditor or gait_audit, record)}
        ledger.finish(record["assessment_id"], record)
        record["budgets"] = status(config)["budgets"]
        return record
    except Refused as exc:
        return {"status": exc.status, "message": exc.message, "advisory_only": True,
                **({"request_digest": record["request_digest"], "task_id": config.task_id, "endpoint": config.endpoint} if record else {}),
                **({"disclosure_approval": record["disclosure_approval"]}
                   if record and exc.status == "approval_required" and "disclosure_approval" in record else {})}
    except (OSError, sqlite3.Error):
        return {"status": "unavailable", "message": "Local Jev ledger or settings unavailable; assessment stopped.", "advisory_only": True}
