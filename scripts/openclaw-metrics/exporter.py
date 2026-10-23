#!/usr/bin/env python3
"""OpenClaw token/cost Prometheus exporter (pull / scrape).

Exposes NetClaw LLM token usage as Prometheus metrics for a PERSISTENT OpenClaw
host (stable IP), so the OBS-stack Prometheus can scrape it directly. This is the
pull counterpart to the ephemeral demo VMs' Vector push.

Source of truth: OpenClaw's canonical agent SQLite databases, with session logs
as a fallback for older installations. Assistant transcript events carry a
`usage` block ({input, output, cacheRead, cacheWrite, cost}) plus the
model/provider. We sum those per (agent, provider, model) and expose cumulative
counters, matching the metric names the demo dashboard already uses.

Metrics (labels: model, provider, agent, instance):
  netclaw_model_input_tokens_total        counter
  netclaw_model_output_tokens_total       counter
  netclaw_model_cache_read_tokens_total   counter
  netclaw_model_cache_write_tokens_total  counter
  netclaw_model_cost_usd_total            counter
  netclaw_model_calls_total               counter
  netclaw_model_call_duration_ms          gauge   (most recent call)
  netclaw_token_exporter_sessions         gauge   (sessions scanned)

Efficiency: aggregates are cached by file timestamps and sizes, including the
SQLite WAL so newly committed turns invalidate the cache.

Correctness: checkpoint / reset / deleted session files are skipped so turns are
never double-counted.

Config (env):
  OPENCLAW_HOME        default ~/.openclaw
  NETCLAW_INSTANCE     instance label, default "netclaw"
  EXPORTER_PORT        default 9110
  EXPORTER_BIND        default 0.0.0.0
"""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

OPENCLAW_HOME = Path(os.environ.get("OPENCLAW_HOME", os.path.expanduser("~/.openclaw")))
INSTANCE = os.environ.get("NETCLAW_INSTANCE", "netclaw")
PORT = int(os.environ.get("EXPORTER_PORT", "9110"))
BIND = os.environ.get("EXPORTER_BIND", "0.0.0.0")

AGENTS_DIR = OPENCLAW_HOME / "agents"

# Per-file parse cache: path -> (mtime, size, aggregate_dict, last_duration_dict)
_cache: dict[str, tuple] = {}


def _is_session_file(p: Path) -> bool:
    n = p.name
    if not n.endswith(".jsonl"):
        return False
    # Skip checkpoints/resets/deleted — they duplicate turns.
    bad = ("checkpoint", ".reset.", ".deleted.")
    return not any(b in n for b in bad)


def _parse_events(events):
    """Aggregate JSONL-compatible events, resetting duration at session boundaries."""
    agg, last_dur = {}, {}
    prev_ts = None
    previous_session = None
    for session_id, raw in events:
        if session_id != previous_session:
            prev_ts = None
            previous_session = session_id
        try:
            d = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        m = d.get("message") or {}
        ts = m.get("timestamp")
        usage = m.get("usage")
        if m.get("role") == "assistant" and isinstance(usage, dict):
            provider = (m.get("provider") or "unknown").strip()
            model = (m.get("model") or "unknown").strip()
            if provider != "openclaw":
                key = (provider, model)
                a = agg.setdefault(key, {"input": 0, "output": 0, "cacheRead": 0,
                                         "cacheWrite": 0, "cost": 0.0, "calls": 0})
                for field in ("input", "output", "cacheRead", "cacheWrite"):
                    a[field] += int(usage.get(field) or 0)
                cost = usage.get("cost")
                if isinstance(cost, dict):
                    a["cost"] += float(cost.get("total") or 0.0)
                a["calls"] += 1
                if isinstance(ts, (int, float)) and isinstance(prev_ts, (int, float)):
                    duration = ts - prev_ts
                    if 0 <= duration < 3_600_000:
                        last_dur[key] = (ts, duration)
        if isinstance(ts, (int, float)):
            prev_ts = ts
    return agg, last_dur


def _parse_file(path: Path):
    try:
        with path.open("r", encoding="utf-8", errors="replace") as stream:
            return _parse_events((None, line) for line in stream if line.strip())
    except OSError:
        return {}, {}


_sqlite_cache = {}


def _parse_sqlite(path: Path):
    """Read canonical events without writing the DB; include live WAL changes."""
    wal = path.with_name(path.name + "-wal")
    signature = tuple((f.stat().st_mtime_ns, f.stat().st_size) if f.exists() else None
                      for f in (path, wal))
    cached = _sqlite_cache.get(str(path))
    if cached and cached[0] == signature:
        return cached[1]
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=5)) as db:
        db.execute("BEGIN")
        columns = {row[1] for row in db.execute("PRAGMA table_info(transcript_events)")}
        compressed = "event_zstd" if "event_zstd" in columns else "NULL"
        count = db.execute("SELECT count(DISTINCT session_id) FROM transcript_events").fetchone()[0]
        rows = db.execute(f"SELECT session_id, event_json, {compressed} FROM transcript_events ORDER BY session_id, seq")

        def events():
            decompressor = None
            for session_id, raw, packed in rows:
                if raw is None and packed is not None:
                    if decompressor is None:
                        import zstandard
                        decompressor = zstandard.ZstdDecompressor()
                    raw = decompressor.decompress(packed, max_output_size=64 * 1024 * 1024)
                if raw is not None:
                    yield session_id, raw

        aggregates, durations = _parse_events(events())
    result = (aggregates, durations, count)
    _sqlite_cache[str(path)] = (signature, result)
    return result


def collect() -> dict:
    """Read each agent's canonical database or legacy session logs."""
    totals: dict[tuple, dict] = {}   # (agent, provider, model) -> aggregate
    durations: dict[tuple, tuple] = {}
    session_count = 0

    if not AGENTS_DIR.is_dir():
        return {"totals": totals, "durations": durations, "sessions": 0}

    for agent_dir in AGENTS_DIR.iterdir():
        agent = agent_dir.name
        database = agent_dir / "agent" / "openclaw-agent.sqlite"
        sources = []
        if database.is_file():
            # Canonical SQLite supersedes retained JSONL migration originals.
            agg, last_dur, count = _parse_sqlite(database)
            session_count += count
            sources.append((agg, last_dur))
        else:
            for f in (agent_dir / "sessions").glob("*.jsonl"):
                if not _is_session_file(f):
                    continue
                try:
                    st = f.stat()
                except OSError:
                    continue
                session_count += 1
                cached = _cache.get(str(f))
                if cached and cached[0] == st.st_mtime_ns and cached[1] == st.st_size:
                    agg, last_dur = cached[2], cached[3]
                else:
                    agg, last_dur = _parse_file(f)
                    _cache[str(f)] = (st.st_mtime_ns, st.st_size, agg, last_dur)
                sources.append((agg, last_dur))
        for agg, last_dur in sources:
            for (provider, model), usage in agg.items():
                key = (agent, provider, model)
                total = totals.setdefault(key, {"input": 0, "output": 0, "cacheRead": 0,
                                                "cacheWrite": 0, "cost": 0.0, "calls": 0})
                for field in total:
                    total[field] += usage[field]
            for (provider, model), (timestamp, duration) in last_dur.items():
                key = (agent, provider, model)
                if key not in durations or timestamp > durations[key][0]:
                    durations[key] = (timestamp, duration)

    return {"totals": totals, "durations": durations, "sessions": session_count}


# ── Prometheus text exposition ────────────────────────────────────────────────
def _esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _labels(agent: str, provider: str, model: str, with_agent: bool = True) -> str:
    # NOTE: no `instance` label here. For pull/scrape, Prometheus applies the
    # instance label from the scrape target (set it to "netclaw" in the scrape
    # job's static_configs, per README). Emitting it here would collide and be
    # renamed to `exported_instance`.
    parts = [f'model="{_esc(model)}"', f'provider="{_esc(provider)}"']
    if with_agent:
        parts.append(f'agent="{_esc(agent)}"')
    return "{" + ",".join(parts) + "}"


def render() -> str:
    data = collect()
    totals = data["totals"]
    durations = data["durations"]
    out: list[str] = []

    def emit(name, mtype, help_text, rows):
        out.append(f"# HELP {name} {help_text}")
        out.append(f"# TYPE {name} {mtype}")
        out.extend(rows)

    counters = [
        ("netclaw_model_input_tokens_total", "input", "Total input (prompt) tokens.", True),
        ("netclaw_model_output_tokens_total", "output", "Total output (completion) tokens.", True),
        ("netclaw_model_cache_read_tokens_total", "cacheRead", "Total cache-read tokens.", False),
        ("netclaw_model_cache_write_tokens_total", "cacheWrite", "Total cache-write tokens.", False),
        ("netclaw_model_cost_usd_total", "cost", "Total model cost in USD.", True),
        ("netclaw_model_calls_total", "calls", "Total model calls (assistant turns).", True),
    ]
    for name, field, help_text, with_agent in counters:
        rows = []
        for (agent, provider, model), a in sorted(totals.items()):
            val = a[field]
            val = f"{val:.6f}" if field == "cost" else str(int(val))
            rows.append(f"{name}{_labels(agent, provider, model, with_agent)} {val}")
        emit(name, "counter", help_text, rows)

    # Duration gauge (most recent call per model).
    drows = []
    for (agent, provider, model), (_ts, dur) in sorted(durations.items()):
        drows.append(f"netclaw_model_call_duration_ms{_labels(agent, provider, model, False)} {int(dur)}")
    emit("netclaw_model_call_duration_ms", "gauge",
         "Duration of the most recent model call in milliseconds.", drows)

    emit("netclaw_token_exporter_sessions", "gauge",
         "Number of session files scanned.",
         [f"netclaw_token_exporter_sessions {data['sessions']}"])

    return "\n".join(out) + "\n"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.rstrip("/") in ("/metrics", ""):
            try:
                body = render().encode("utf-8")
            except Exception as e:  # never crash the scrape
                body = f"# exporter error: {e}\n".encode("utf-8")
                self.send_response(500)
            else:
                self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.rstrip("/") == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok\n")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *_args):  # quiet
        pass


def main():
    srv = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"openclaw token exporter on http://{BIND}:{PORT}/metrics "
          f"(instance={INSTANCE}, home={OPENCLAW_HOME})", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
