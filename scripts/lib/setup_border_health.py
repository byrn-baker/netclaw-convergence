"""Read-only local Border canary, bound to its owned service manifest."""
import json
from pathlib import Path
import urllib.request
from setup_schema import loads
from setup_state import Conflict,guarded_read

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise Conflict('border_health_redirect')

def read_status(home,installation,kind):
    home=Path(home)
    identity=loads(guarded_read(home/'netclaw-hud/installation.json',16384,private=True))
    marker=loads(guarded_read(home/'.netclaw-setup-owner.json',16384,private=True))
    manifest=loads(guarded_read(home/'.setup/services.json',65536,private=True))
    if (identity.get('installationId')!=installation or manifest.get('installationId')!=installation
        or manifest.get('home')!=str(home) or manifest.get('harness')!=kind or manifest.get('role')!='border'
        or manifest.get('owner')!=marker.get('installationId') or manifest.get('runId')!=marker.get('runId')):
        raise Conflict('border_health_identity_mismatch')
    port=manifest.get('endpoints',{}).get('bgpApiPort')
    if type(port) is not int or not 1024<=port<=65535:raise Conflict('border_health_port_invalid')
    request=urllib.request.Request('http://127.0.0.1:'+str(port)+'/status',headers={'Accept':'application/json'})
    with urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect()).open(request,timeout=3) as response:
        data=response.read(65537)
        if len(data)>65536:raise Conflict('border_health_response_limit')
        value=json.loads(data)
    if not isinstance(value,dict) or value.get('installation_id')!=installation or value.get('harness_type')!=kind:
        raise Conflict('border_health_identity_mismatch')
    return {'enabled':True,'identity':installation,'role':'border','ready':value.get('federation_ready') is True}
