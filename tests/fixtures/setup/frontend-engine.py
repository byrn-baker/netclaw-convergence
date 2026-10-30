"""Test-only CLI/editor transport runner; no native installation or service calls.

Only acquisition, onboarding and runtime observations are synthetic. The public
entry point, review transports, engine, guarded deployment, manifest selection,
registration and report code are real. This is not a production adapter hook.
"""
import json
import os
from pathlib import Path
import runpy
import sys

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/lib'))
import setup_engine
import setup_effects
import setup_transport
from setup_deploy import Deployment
from setup_harness import Harness
from setup_schema import canonical
from setup_verify import verify_installation

mode,plan_file,state=sys.argv[1:4]
plan=json.loads(Path(plan_file).read_text())
assert mode in ('terminal','editor') and Path(state).parent==Path(plan_file).parent
assert all(Path(c['runtimeHome']).parent==Path(plan_file).parent for c in plan['claws'])
setup_engine.default_state_root=lambda:Path(state)

class Observation:
    def binding(self,plan):return {'source':plan['source'],'host':plan['host'],'inputs':[]}
    def check(self,*args):pass
    def controls(self,*args):return []
setup_engine.HostObservation=Observation

class FixtureRunner(setup_effects.EffectRunner):
    def __call__(self,effect,context):
        claw=next(c for c in context['plan']['claws'] if c['id']==effect['owner'])
        deploy=Deployment(ROOT,claw,context)
        if effect['phase']=='runtime':
            executable=deploy.root/'.setup/python/bin/python'
            deploy.write(effect,executable,b'#!/bin/sh\nexit 99\n');executable.chmod(0o700)
            deploy.write(effect,deploy.root/'.setup/python312',str(executable).encode())
            return {'state':'verified'}
        if effect['phase']=='onboard':
            name='config.yaml' if claw['harness']=='hermes' else 'openclaw.json'
            deploy.write(effect,deploy.root/name,canonical(Harness(ROOT,claw,context,deploy).base_config()))
            return {'state':'verified'}
        if effect['phase']=='components':return {'state':'failed' if effect['component']=='netbox' else 'verified'}
        if effect['phase']=='services':return {'state':'unverified'}
        if effect['phase']=='verification':
            class Probes:
                identity=json.loads((deploy.root/'netclaw-hud/installation.json').read_text())['installationId']
                def installed(self):return {'state':'unverified','code':'runtime_unavailable'}
                def component(self,name):return {'state':'failed' if name=='netbox' else 'unverified','code':'discovery_unverified'}
                def canary(self):return {'state':'unverified','code':'canary_unverified'}
                def running(self):return {'state':'unverified','code':'service_unverified'}
            return verify_installation(effect,context,deploy,None,probes=Probes())
        return super().__call__(effect,context)
setup_effects.EffectRunner=FixtureRunner

if mode=='editor':
    native=setup_transport.EditorSession;fd=int(sys.argv[4])
    setup_transport.EditorSession=lambda engine:native(engine,fd=fd)
sys.argv=[str(ROOT/'scripts/setup-engine.py'),'apply','--plan',plan_file]+(['--native'] if mode=='editor' else [])
runpy.run_path(sys.argv[0],run_name='__main__')
