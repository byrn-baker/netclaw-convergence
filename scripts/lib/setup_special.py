"""Scoped dependency adapters for the legacy native/prompting components."""
import os
from pathlib import Path
import shutil
import re
from setup_components import dependency_ready
from setup_state import Conflict,guarded_read

SUPPORTED=frozenset(('nsm','elastic','checkpoint','nmap','aws','ipfabric','batfish',
                     'github','packet-buddy','threejs-viz','comfyui-viz','worldlabs-marble','rag-mcp','gtrace'))


def install_special(effect,context,deploy,harness):
    component=effect['component']
    if component not in SUPPORTED:raise Conflict('component_adapter_invalid')
    if component=='threejs-viz' and deploy.claw['settings'].get('NETCLAW_SKETCHFAB_ENABLED',{}).get('value') is not True:
        return {'state':'verified'}  # selected vendored procedural skills only
    env=harness.environment();python=guarded_read(deploy.root/'.setup/python312',8192).decode().strip()
    if not Path(python).is_relative_to(deploy.root):raise Conflict('component_runtime_outside_home')
    env.update(NETCLAW_PY=python,NETCLAW_RUNTIME_ROOT=str(deploy.root/'python-runtimes'))
    # Every mutable build/cache path, including Go, belongs to this installation.
    env.update(GOPATH=str(deploy.root/'.setup/go'),GOCACHE=str(deploy.root/'.setup/cache/go'),
               GOMODCACHE=str(deploy.root/'.setup/cache/gomod'),GOBIN=str(deploy.root/'.setup/prefix/bin'),
               GOTOOLCHAIN='local',GOENV='off')
    if component=='gtrace':
        go=shutil.which('go',path=env['PATH'])
        if not go:return {'state':'configuration_required'}
        probe=harness.execute([go,'version'],cwd=deploy.source,env=env,timeout=10,capture=True,
            lock_fds=context['lockFds'],started=lambda identity:context['writerStarted'](effect['id'],identity))
        version=re.search(rb'\bgo(\d+)\.(\d+)\.(\d+)\b',probe.get('stdout',b''))
        if probe['returncode'] or not version or tuple(int(v) for v in version.groups())<(1,24,2):return {'state':'configuration_required'}
    result=harness.execute(['/bin/bash',str(deploy.source/'scripts/lib/plan-special.sh'),component,str(deploy.source),str(deploy.root)],
        cwd=deploy.source,env=env,timeout=1200,lock_fds=context['lockFds'],started=lambda identity:context['writerStarted'](effect['id'],identity))
    deploy.reconcile_source(effect)
    if result['returncode']:return {'state':'configuration_required' if result['returncode']==78 else 'failed'}
    if component=='gtrace':
        binary=deploy.root/'.setup/prefix/bin/gtrace'
        if not binary.is_file() or binary.is_symlink() or not os.access(binary,os.X_OK):return {'state':'unverified'}
        result=harness.call(effect,[str(binary),'--version'],capture=True,timeout=10)
        if result['returncode'] or 'v0.15.1' not in result['stdout'].decode('utf-8','strict').split():return {'state':'unverified'}
    record=deploy.root/'python-runtimes/records'/component
    if record.exists():context['artifactIntent'](effect['id'],[deploy.artifact(record,guarded_read(record),'runtime-record')])
    # Host tools are observed only. Their absence cannot trigger sudo, package
    # installation, capabilities or changes to a neighbor's service.
    prerequisites={'nmap':['nmap'],'packet-buddy':['tshark'],'aws':['uvx'],
                   'nsm':['docker'],'elastic':['docker'],'github':['docker']}.get(component,[])
    if any(not shutil.which(tool,path=env['PATH']) for tool in prerequisites):return {'state':'configuration_required'}
    return {'state':'verified' if dependency_ready(component,deploy,harness,effect=effect) else 'unverified'}
