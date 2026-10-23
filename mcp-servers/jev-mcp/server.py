#!/usr/bin/env python3
"""Optional read-only Jev Science Officer MCP server (stdio only)."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sqlite3
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import core

ENV_KEYS = frozenset({
    "JEV_ENABLED", "JEV_BASE_URL", "JEV_ENDPOINT", "JEV_MODEL", "JEV_API_KEY",
    "TYPESAFE_API_KEY", "JEV_COMPATIBLE_API_KEY", "JEV_COMPATIBLE_KEY_ENDPOINT",
    "JEV_DAILY_LIMIT_USD", "JEV_CASE_LIMIT_USD", "JEV_INPUT_PRICE_PER_MILLION",
    "JEV_TIMEOUT_SECONDS", "JEV_DATA_DIR", "JEV_TASK_ID", "JEV_GAIT_ROOT", "GAIT_VENV",
})


def load_env_file(path: str) -> None:
    """Read operator-selected literal dotenv data, never shell or unrelated settings."""
    filename = Path(path).expanduser()
    if filename.is_symlink():
        raise ValueError("Environment file must not be a symbolic link")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    descriptor = os.open(filename, flags)
    with os.fdopen(descriptor, "r", encoding="utf-8") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > 2_000_000:
            raise ValueError("Environment file must be a bounded regular file")
        text = stream.read(2_000_001)
        if len(text) > 2_000_000:
            raise ValueError("Environment file is too large")
    helper_path = Path(__file__).resolve().parents[2] / "scripts" / "write-env.py"
    spec = importlib.util.spec_from_file_location("jev_literal_dotenv", helper_path)
    if spec is None or spec.loader is None:
        raise ValueError("Literal environment parser unavailable")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    values = helper.values(text)
    allowed = {key: value for key, value in values.items() if key in ENV_KEYS}
    if any("\0" in value or "\n" in value or "\r" in value for value in allowed.values()):
        raise ValueError("Environment values must be single-line strings")
    # Parsing succeeds completely before changing the process environment.
    os.environ.update(allowed)


def safe_status() -> dict:
    try:
        return core.status()
    except (core.Refused, OSError, sqlite3.Error) as exc:
        return {"status": "unavailable", "enabled": False, "ready": False,
                "advisory_only": True, "message": exc.message if isinstance(exc, core.Refused) else "Local Jev status unavailable."}


def serve(read_only: bool = False):
    from fastmcp import FastMCP
    mcp = FastMCP("jev-mcp")

    @mcp.tool()
    def jev_status() -> dict:
        """Read Jev configuration, UTC daily/task budgets and latest local assessment; no inference."""
        return safe_status()

    @mcp.tool()
    async def jev_evaluate(state: str | dict, questions: dict, purpose: str,
                           evidence_metadata: list[dict], data_classification: str = "sanitized",
                           prepare_only: bool = False, reconsideration_of: str | None = None) -> dict:
        """Request advisory Noul/Choice/Score judgments over shared permitted evidence.

        Author questions dynamically from the user's task and member evidence. This
        cannot execute actions, grant approval, select task identity or raise budgets.
        purpose must be evidence_review, specialist_advice, answer_review,
        diagnostic_advice, change_review, or incident_triage.
        questions maps caller-authored IDs to objects with type and instructions:
        Noul: {"type":"noul","instructions":"a yes/no proposition"}.
        Choice: {"type":"choice","instructions":"select an alternative",
                 "criteria":{"label":"description","uncertain":"insufficient evidence"}}.
        Score: {"type":"score","instructions":"evaluate one dimension",
                "criteria":["lowest descriptive level","highest descriptive level"]}.
        Choice requires 2–255 labeled criteria; Score requires 2–10 ordered levels.
        Do not use text, options, output, or scale_levels as question fields.
        prepare_only returns the exact request digest for operator disclosure approval
        without sending. approval_required is a local ledger gate: show its operator
        command, retain the exact arguments, and do not claim a Slack confirmation
        alone records the grant. Use at most one reconsideration of a successful initial result.
        """
        if read_only:
            return {"status": "unavailable", "message": "This task-bound process permits assessment reads only."}
        return await core.evaluate(state, questions, purpose, evidence_metadata,
                                   data_classification, prepare_only, reconsideration_of)

    @mcp.tool()
    def jev_assessment(assessment_id: str) -> dict:
        """Read an assessment from the active trusted task's local audit; no inference."""
        try:
            config = core.Config.from_env()
            result = core.Ledger(config.data_dir).assessment(assessment_id, config.task_id)
            return result or {"status": "not_found", "advisory_only": True}
        except (core.Refused, OSError, sqlite3.Error):
            return {"status": "unavailable", "advisory_only": True}

    mcp.run(transport="stdio")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--status", action="store_true", help="Print secret-free local status without inference")
    parser.add_argument("--env-file", metavar="PATH", help="Load allowlisted literal Jev settings from this operator-selected environment file")
    parser.add_argument("--read-task-id", help="Operator-owned task binding for a read-only assessment process; never a model argument")
    args = parser.parse_args()
    if args.env_file is not None:
        try:
            load_env_file(args.env_file)
        except (ValueError, OSError, ImportError, UnicodeError):
            failure = {"status": "unavailable", "enabled": False, "ready": False,
                       "advisory_only": True, "message": "Cannot load the selected Jev environment file; use an existing regular, nonsymlink literal dotenv file."}
            if args.status:
                print(json.dumps(failure))
            else:
                print(failure["message"], file=sys.stderr)
            raise SystemExit(2)
    if args.read_task_id is not None:
        if not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", args.read_task_id):
            raise SystemExit("Invalid read task binding")
        os.environ["JEV_TASK_ID"] = args.read_task_id
    if args.status:
        print(json.dumps(safe_status()))
    else:
        serve(read_only=args.read_task_id is not None)
