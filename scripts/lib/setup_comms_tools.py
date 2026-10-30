"""Pinned, installation-owned Twilio/Zoom dependencies; no provider operations."""
import hashlib
import os
from pathlib import Path
import shutil

from setup_schema import canonical,loads
from setup_state import Conflict,guarded_read


def contract(component,deploy):
    if (component not in ('twilio','zoom-rtms') or component not in deploy.claw['capabilities']['components'] or
        deploy.claw['role'] not in ('focused','member') or deploy.claw['harness'] not in ('openclaw','hermes')):
        raise Conflict('comms_component_scope')
    host=deploy.context['plan']['host']
    if host['platform'] not in ('macos','wsl2'):raise Conflict('comms_component_host')
    if component=='zoom-rtms' and host['architecture']!=('arm64' if host['platform']=='macos' else 'x64'):
        raise Conflict('comms_component_architecture')
    voice=component=='twilio' and deploy.claw['harness']=='openclaw'
    lock=('zoom-'+host['platform']+'.txt') if component=='zoom-rtms' else 'twilio-voice.txt' if voice else None
    requirements=deploy.source/'installer/native-comms/tools'/lock if lock else None
    version='3.13' if component=='zoom-rtms' else '3.12'
    checksum=hashlib.sha256(guarded_read(requirements,4*1024*1024)).hexdigest() if lock else None
    npm=deploy.source/'mcp-servers/twilio-env-mcp/package-lock.json'
    return {'schema':1,'component':component,'owner':deploy.claw['id'],'runId':deploy.context['runId'],
        'harness':deploy.claw['harness'],'platform':host['platform'],
        'python':version if lock else None,'lock':checksum,
        'npm':hashlib.sha256(guarded_read(npm,4*1024*1024)).hexdigest() if component=='twilio' else None},requirements


def owned_record(component,deploy,path,kind,limit):
    records=[(e,a) for e in deploy.context['journal']['effects'] for a in e.get('artifacts',[]) if a['path']==str(path)]
    if not records:raise Conflict('comms_dependency_record_unowned')
    writer,artifact=records[-1]
    if (writer.get('owner')!=deploy.claw['id'] or writer.get('phase')!='components' or
        writer.get('component')!=component or artifact.get('owner')!=deploy.claw['id'] or
        artifact.get('class')!=kind or artifact.get('referencedBy')!=[deploy.claw['id']]):
        raise Conflict('comms_dependency_record_unowned')
    raw=guarded_read(path,limit,private=True)
    if hashlib.sha256(raw).hexdigest()!=artifact.get('sha256'):raise Conflict('comms_dependency_record_changed')
    return raw


def observe(component,effect,deploy,harness):
    try:
        expected,requirements=contract(component,deploy)
        receipt=loads(owned_record(component,deploy,deploy.root/'.setup/comms-tools'/component/'installed.json','dependency-receipt',16384))
        if receipt!=expected:return False
        if component=='twilio':
            from setup_components import twilio_ready
            if not twilio_ready(deploy,harness,effect=effect):return False
        if requirements is None:return True
        python=Path(owned_record(component,deploy,deploy.root/'python-runtimes/records'/component,'runtime-record',8192).decode().strip())
        if (python!=deploy.root/'python-runtimes'/(component+'-comms')/'bin/python' or
            not python.resolve().is_relative_to(deploy.root/'.setup/python') or not os.access(python,os.X_OK)):return False
        # Exact locked versions and actual imports, with sockets and process
        # creation denied. No operational server/module is imported here.
        code="""import sys,re,importlib.metadata as m
def audit(event,args):
 if event in ('socket.bind','socket.connect','subprocess.Popen','os.system'):raise RuntimeError('dependency_probe_effect')
sys.addaudithook(audit)
for line in open(sys.argv[1]):
 match=re.match(r'^([A-Za-z0-9_.-]+)==([^\\s;\\\\]+)',line)
 if match and m.version(match[1])!=match[2]:raise RuntimeError('dependency_version')
if sys.argv[2]=='zoom-rtms':
 import rtms,fastmcp,websockets,cryptography,fastmcp_tasks
else:
 import twilio,flask,mcp,httpx,pytz
"""
        return harness.call(effect,[str(python),'-c',code,str(requirements),component],timeout=40)['returncode']==0
    except (OSError,ValueError,KeyError):return False


def install(component,effect,context,deploy,harness):
    if (effect.get('component')!=component or effect.get('owner')!=deploy.claw['id'] or
        effect.get('phase')!='components'):raise Conflict('comms_component_scope')
    expected,requirements=contract(component,deploy);base=deploy.root/'.setup/comms-tools'/component
    complete=base/'installed.json';started=base/'started.json'
    if complete.exists():return {'state':'verified' if observe(component,effect,deploy,harness) else 'unverified'}
    if started.exists():return {'state':'unknown'}
    env=harness.environment();uv=shutil.which('uv',path=env['PATH'])
    if requirements is not None and not uv:return {'state':'configuration_required'}
    npm=shutil.which('npm',path=env['PATH'])
    if component=='twilio' and not npm:return {'state':'configuration_required'}
    deploy.write(effect,started,canonical(expected),kind='dependency-intent')
    if requirements is not None:
        version=expected['python'];venv=deploy.root/'python-runtimes'/(component+'-comms')
        if venv.exists():raise Conflict('comms_runtime_occupied')
        if harness.call(effect,[uv,'python','install',version],timeout=600)['returncode']:return {'state':'failed'}
        found=harness.call(effect,[uv,'python','find','--managed-python',version],capture=True,timeout=30)
        python=Path(found['stdout'].decode().strip())
        if found['returncode'] or not python.is_absolute() or not python.resolve().is_relative_to(deploy.root/'.setup/python'):
            return {'state':'failed'}
        if harness.call(effect,[uv,'venv','--python',str(python),str(venv)],timeout=60)['returncode']:return {'state':'failed'}
        if harness.call(effect,[uv,'pip','install','--python',str(venv/'bin/python'),'--require-hashes',
            '--only-binary',':all:','-r',str(requirements)],timeout=900)['returncode']:return {'state':'failed'}
        deploy.write(effect,deploy.root/'python-runtimes/records'/component,(str(venv/'bin/python')+'\n').encode(),kind='runtime-record')
    if component=='twilio':
        package=deploy.source/'mcp-servers/twilio-env-mcp'
        if (package/'node_modules').exists():raise Conflict('comms_dependency_occupied')
        if harness.call(effect,[npm,'ci','--ignore-scripts','--no-audit','--no-fund'],cwd=package,timeout=600)['returncode']:return {'state':'failed'}
    deploy.write(effect,complete,canonical(expected),kind='dependency-receipt')
    return {'state':'verified' if observe(component,effect,deploy,harness) else 'unverified'}
