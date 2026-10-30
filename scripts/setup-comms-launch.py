#!/usr/bin/env python3
"""Fixed managed Comms launchers. Secrets come only from this source's owner.

Both native runtimes filter inherited environment variables. A registration
therefore passes only private file references; this launcher reads the selected
home, restores its scoped environment and execs one declared server. It never
downloads dependencies or starts a second Zoom process.
"""
import os
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_state import Conflict,guarded_read,revision
from setup_schema import loads
from setup_secrets import child_environment,read_owned_environment

SERVERS={'twilio-mcp':('twilio','mcp-servers/twilio-env-mcp/server.mjs'),
    'twilio-voice-mcp':('twilio','mcp-servers/twilio-voice-mcp/server.py'),
    'zoom-rtms-mcp':('zoom-rtms','mcp-servers/zoom-rtms-mcp/server.py')}


def resolve(server,*,source=ROOT,inherited=None):
    inherited=os.environ if inherited is None else inherited
    source=Path(source);home=source.parent.parent
    if (server not in SERVERS or source!=home/'.setup/source' or source.resolve()!=source or
        inherited.get('NETCLAW_RUNTIME_ENV')!=str(home/'.env')):raise Conflict('comms_launcher_scope')
    owner=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
    if not owner.get('runId') or not owner.get('installationId'):raise Conflict('comms_launcher_owner')
    values=read_owned_environment(home/'.env',revision(home/'.env'))
    harness=values.get('NETCLAW_RUNTIME')
    if harness not in ('openclaw','hermes') or values.get('NETCLAW_RUNTIME_ENV')!=str(home/'.env'):
        raise Conflict('comms_launcher_environment')
    if server=='twilio-voice-mcp' and harness!='openclaw':raise Conflict('comms_voice_runtime_unqualified')
    component,relative=SERVERS[server]
    installed=guarded_read(home/'netclaw-components.conf',65536,private=True).decode().splitlines()
    if component not in installed:raise Conflict('comms_component_not_installed')
    if any(key in values for key in ('NETCLAW_MCP_DISCOVERY_ONLY','NETCLAW_MCP_DISCOVERY_LEASE')):
        raise Conflict('comms_discovery_flag_persisted')
    if inherited.get('NETCLAW_MCP_DISCOVERY_LEASE') and inherited.get('NETCLAW_MCP_DISCOVERY_ONLY')!='1':
        raise Conflict('comms_discovery_lease_without_mode')
    if server=='twilio-mcp':
        command=loads(guarded_read(home/'.setup/comms-node.json',16384,private=True))['command']
    else:
        command=guarded_read(home/'python-runtimes/records'/component,8192,private=True).decode().strip()
        if not Path(command).resolve().is_relative_to(home):raise Conflict('comms_runtime_outside_home')
    binary=Path(command)
    if not binary.is_absolute() or not binary.is_file() or not os.access(binary,os.X_OK):raise Conflict('comms_runtime_unavailable')
    script=source/relative
    guarded_read(script,1024*1024)
    env=child_environment(home,harness,values,tool_directories=[binary.parent])
    if inherited.get('NETCLAW_MCP_DISCOVERY_ONLY')=='1':env['NETCLAW_MCP_DISCOVERY_ONLY']='1'
    args=[str(binary)]+([] if server=='twilio-mcp' else ['-u'])+[str(script)]
    return args,env,str(script.parent)


def main():
    try:
        if len(sys.argv)!=2:raise Conflict('comms_launcher_arguments')
        args,env,cwd=resolve(sys.argv[1])
        if env.get('NETCLAW_MCP_DISCOVERY_ONLY')=='1' and env.get('NETCLAW_RUNTIME')=='openclaw':
            from setup_comms_discovery import claim_child
            claim_child(ROOT.parent.parent,sys.argv[1],os.environ.get('NETCLAW_MCP_DISCOVERY_LEASE',''))
        os.chdir(cwd);os.execve(args[0],args,env)
    except Exception:
        print('Managed Comms launch refused; check the selected installation and dependencies.',file=sys.stderr)
        return 8


if __name__=='__main__':raise SystemExit(main())
