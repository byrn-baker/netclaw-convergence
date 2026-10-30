"""Stdlib engine adapter for an owned pinned-trust host certificate.

No ACME account, network registration, CA rotation, peer enrollment or control
enablement. Risk CA/enrollment remains the separate Risk materialization phase.
"""
import hashlib
import os
from pathlib import Path
from setup_schema import canonical,loads
from setup_state import Conflict,guarded_read,revision

def binding(context,deploy):
    identity=loads(guarded_read(deploy.root/'netclaw-hud/installation.json',8192,private=True))
    return {'schema':1,'home':str(deploy.root),'runId':context['runId'],'planHash':context['planHash'],
            'owner':deploy.claw['id'],'installationId':identity['installationId']}

def runtime(effect,deploy):
    path=deploy.root/'python-runtimes/records/claw-certs'
    prior=next((a for a in reversed(effect.get('artifacts',[])) if a['path']==str(path)),None)
    if not prior or prior.get('owner')!=deploy.claw['id'] or prior.get('class')!='runtime-record' or prior.get('referencedBy')!=[deploy.claw['id']] or prior['sha256']!=revision(path):return None
    value=guarded_read(path,8192,private=True).decode().strip();file=Path(value)
    if not file.is_absolute() or not file.is_relative_to(deploy.root) or not file.resolve().is_relative_to(deploy.root) or not os.access(file,os.X_OK):raise Conflict('certificate_runtime_unowned')
    return value

def material(effect,context,deploy):
    request=deploy.root/'.setup/certificate-input.json'
    recorded=next((a for a in reversed(effect.get('artifacts',[])) if a['path']==str(request)),None)
    if not recorded or revision(request)!=recorded.get('sha256') or loads(guarded_read(request,16384,private=True))!=binding(context,deploy):raise Conflict('certificate_input_changed')
    path=deploy.root/'.setup/claw-certificate.json'
    prior=next((a for a in reversed(effect.get('artifacts',[])) if a['path']==str(path)),None)
    raw=guarded_read(path,65536,private=True)
    if not prior or prior.get('owner')!=deploy.claw['id'] or prior.get('class')!='credentials' or hashlib.sha256(raw).hexdigest()!=prior['sha256']:raise Conflict('certificate_material_unowned')
    value=loads(raw,65536)
    if set(value)!={'binding','certificate','key'} or value['binding']!=binding(context,deploy) or not all(isinstance(value[k],str) and 0<len(value[k])<=16384 for k in ('certificate','key')):raise Conflict('certificate_material_invalid')
    return value

def install(effect,context,deploy,harness):
    python=runtime(effect,deploy)
    if python is None:
        if not harness.install_python_component(effect,'claw-certs'):return {'state':'failed'}
        python=runtime(effect,deploy)
        if python is None:return {'state':'unverified'}
    record=deploy.root/'.setup/certificate-input.json';expected=binding(context,deploy)
    deploy.write(effect,record,canonical(expected),kind='certificate-input')
    bundle=deploy.root/'.setup/claw-certificate.json'
    if revision(bundle) is None:
        # No installed key may be silently replaced by a newly generated pair.
        if any(revision(deploy.root/'n2n/keys/host'/name) is not None for name in ('host.crt','host.key')):raise Conflict('certificate_target_occupied')
        if any(a['path']==str(bundle) for a in effect.get('artifacts',[])):raise Conflict('certificate_material_missing')
        result=harness.call(effect,[python,str(deploy.source/'scripts/setup-certificates.py'),'generate-private','--record',str(record)],capture=True,timeout=30)
        if result['returncode']:return {'state':'failed'}
        # Captured bytes stay in engine memory and then a guarded private file;
        # never return them as adapter output, events, diagnostics or reports.
        value=loads(result['stdout'],65536)
        if not isinstance(value,dict) or value.get('binding')!=expected or set(value)!={'binding','certificate','key'}:raise Conflict('certificate_material_invalid')
        deploy.write(effect,bundle,canonical(value),kind='credentials')
        result.clear();value.clear()
    value=material(effect,context,deploy)
    check=harness.call(effect,[python,str(deploy.source/'scripts/setup-certificates.py'),'observe','--record',str(record)],capture=True,timeout=30)
    if check['returncode'] or loads(check['stdout'])!={'schema':1,'valid':True}:return {'state':'unverified'}
    for name,key in (('host.key','key'),('host.crt','certificate')):
        deploy.write(effect,deploy.root/'n2n/keys/host'/name,value[key].encode(),kind='credentials')
    value.clear()
    return {'state':'verified'}

def observe(effect,context,deploy,harness):
    python=runtime(effect,deploy)
    if python is None:return 'unknown'
    value=material(effect,context,deploy)
    result=harness.call(effect,[python,str(deploy.source/'scripts/setup-certificates.py'),'observe','--record',str(deploy.root/'.setup/certificate-input.json')],capture=True,timeout=30)
    if result['returncode'] or loads(result['stdout'])!={'schema':1,'valid':True}:return 'unknown'
    pending=False;own={a['path']:a for a in effect.get('artifacts',[])}
    for name,key in (('host.key','key'),('host.crt','certificate')):
        path=deploy.root/'n2n/keys/host'/name;actual=revision(path);digest=hashlib.sha256(value[key].encode()).hexdigest()
        if actual is None:pending=True;continue
        if actual!=digest or own.get(str(path),{}).get('sha256')!=digest:return 'conflict'
        guarded_read(path,16384,private=True)
    return 'conflict' if pending and effect['state']=='verified' else 'retry_owned' if pending else 'completed'
