"""Opt-in content-free health for a setup-owned outbound-only member."""
import asyncio
import os
import time
from pathlib import Path
from setup_schema import canonical,loads
from setup_state import Conflict,guarded_read,guarded_write,revision

def read_status(home,installation,kind):
    value=loads(guarded_read(Path(home)/'netclaw-federation/setup-member-health.json',16384,private=True))
    now=int(time.time())
    if value.get('schema')!=1 or value.get('installationId')!=installation or value.get('kind')!=kind or not isinstance(value.get('at'),int) or not -2<=now-value['at']<=15 or type(value.get('pid')) is not int or value['pid']<2:
        raise Conflict('member_health_unverified')
    os.kill(value['pid'],0)
    return {'enabled':True,'identity':installation,'role':'member','ready':value.get('ready') is True}

def observe(service):
    runtime=service.runtime;channel=service.border_channel
    return {'schema':1,'installationId':runtime.installation,'kind':runtime.kind,'pid':os.getpid(),
            'at':int(time.time()),'ready':bool(channel and channel.trusted and not getattr(channel,'_closed',True)
                and getattr(channel,'attestation',None)=='possession'
                and (runtime.kind!='hermes' or getattr(service.hermes_runtime,'ready',False)))}

async def publish(service):
    runtime=service.runtime;home=runtime.home
    marker=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
    manifest=home/'.setup/services.json';digest=revision(manifest)
    data=loads(guarded_read(manifest,65536,private=True))
    if data['installationId']!=runtime.installation or data['home']!=str(home) or data['owner']!=marker['installationId'] or data['runId']!=marker['runId'] or data['role']!='member':raise Conflict('member_health_owner_changed')
    target=runtime.state/'setup-member-health.json'
    try:
        while True:
            if revision(manifest)!=digest:raise Conflict('member_health_owner_changed')
            guarded_write(target,canonical(observe(service)),expected=revision(target))
            await asyncio.sleep(2)
    finally:
        value=observe(service);value['ready']=False
        guarded_write(target,canonical(value),expected=revision(target))
