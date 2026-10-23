#!/usr/bin/env python3
"""Prepare an isolated all-tools-denied companion; never restart or invoke it."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("pal_core", ROOT / "mcp-servers/tavus-pal-mcp/core.py")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)

def write_private(file, text):
    if file.is_symlink():
        raise ValueError("Refusing a symbolic link")
    file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temp = tempfile.mkstemp(prefix=".pal-", dir=file.parent)
    try:
        with os.fdopen(fd,"w") as stream:
            stream.write(text);stream.flush();os.fsync(stream.fileno())
        os.replace(temp,file)
    finally:
        if os.path.exists(temp):os.unlink(temp)

def prepare(home, apply=False, enable_http=False):
    home=home.expanduser().resolve()
    file=home/"openclaw.json"
    if file.is_symlink():raise ValueError("Refusing a linked config")
    original=file.read_text();config=json.loads(original)
    agents=config.setdefault("agents",{})
    if agents.get("entries"):raise ValueError("This setup supports the runtime agents.list schema; entries must be reviewed separately")
    entries=agents.setdefault("list",[])
    if any(a.get("id")==core.AGENT_ID for a in entries):raise ValueError("Pal agent already exists; inspect it rather than overwriting")
    if not entries:entries.append({"id":"main","default":True})
    workspace=home/"netclaw-pal/workspace"
    if workspace.exists():raise ValueError("Pal workspace already exists; inspect it rather than overwriting")
    entries.append({"id":core.AGENT_ID,"name":"NetClaw Pal (no tools)","workspace":str(workspace),"tools":{"deny":["*"]},"skills":[]})
    if enable_http:config.setdefault("gateway",{}).setdefault("http",{}).setdefault("endpoints",{}).setdefault("chatCompletions",{})["enabled"]=True
    summary={"agent_id":core.AGENT_ID,"tools":"all denied","workspace":str(workspace),"enable_http":enable_http,"applied":apply}
    if apply:
        # Check no concurrent operator edit before writing the prepared configuration.
        if file.read_text()!=original:raise ValueError("Runtime config changed during preparation")
        stamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        backup=home/f"openclaw.before-pal-{stamp}.json"
        write_private(backup,original)
        for name in ("AGENTS.md","SOUL.md","TOOLS.md","USER.md","IDENTITY.md","HEARTBEAT.md","BOOTSTRAP.md"):
            write_private(workspace/name,core.INSTRUCTIONS)
        write_private(file,json.dumps(config,indent=2)+"\n")
        summary["backup"]=str(backup)
    return summary

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home",type=Path,default=Path(os.environ.get("OPENCLAW_HOME",str(Path.home()/".openclaw"))))
    parser.add_argument("--apply",action="store_true")
    parser.add_argument("--enable-http",action="store_true",help="Also enable the authenticated local chat compatibility endpoint")
    args=parser.parse_args()
    try:print(json.dumps(prepare(args.home,args.apply,args.enable_http),indent=2))
    except (ValueError,OSError) as e:raise SystemExit(str(e))
