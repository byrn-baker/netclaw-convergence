"""All first-party production change gates fail closed against synthetic ServiceNow."""
import os
from pathlib import Path
import subprocess
import sys
import pytest
ROOT=Path(__file__).resolve().parents[2]

@pytest.mark.parametrize('service',['gnmi','claroty','fortinet','multivendor'])
def test_exact_approved_implement_record_required(service):
    code=r'''
import asyncio,importlib.util,os,pathlib,sys
import httpx
service=sys.argv[1];root=pathlib.Path.cwd()
paths={'gnmi':('gnmi-mcp','itsm_gate.py'), 'claroty':('claroty-mcp','utils/itsm_gate.py'),
       'fortinet':('fortinet-mcp','gates.py'),'multivendor':('multivendor-cli-mcp','tools/change.py')}
folder,filename=paths[service];sys.path.insert(0,str(root/'mcp-servers'/folder))
spec=importlib.util.spec_from_file_location('test_gate',root/'mcp-servers'/folder/filename)
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
os.environ.update(SERVICENOW_INSTANCE_URL='https://snow.example',SERVICENOW_USERNAME='fixture',SERVICENOW_PASSWORD='fixture',NETCLAW_LAB_MODE='false')
rows=[];calls=[];fail=False

def get(*args,**kwargs):
 calls.append(kwargs)
 if fail:raise httpx.ConnectError('synthetic service unavailable')
 return httpx.Response(200,json={'result':rows},request=httpx.Request('GET','https://snow.example'))
class AsyncClient:
 def __init__(self,**kwargs):pass
 async def __aenter__(self):return self
 async def __aexit__(self,*args):pass
 async def get(self,*args,**kwargs):return get(*args,**kwargs)
httpx.get=get;httpx.AsyncClient=AsyncClient

def allowed(number='CHG123'):
 if service=='fortinet':return asyncio.run(m.check_change_request(number)).allowed
 if service=='multivendor':return m.check_change_request(number)['approved']
 return m.validate_change_request(number)['valid']

for bad in ('CHG123^ORapproval=approved','CHG123\n','CHG١٢٣','','123'):
 calls.clear();assert not allowed(bad),bad;assert calls==[], 'invalid number reached ServiceNow'
for state,approval,expected in [('implement','approved',True),('-1','approved',True),('scheduled','approved',False),('-2','approved',False),('closed','approved',False),('implement','requested',False),('new','approved',False),('implement','',False)]:
 rows=[{'number':'CHG123','state':state,'approval':approval}]
 assert allowed() is expected,(state,approval,service)
 assert calls[-1]['params']['sysparm_query']=='number=CHG123'
for invalid in ([],[{'number':'CHG999','state':'implement','approval':'approved'}],[{}],[None],{},[{'number':'CHG123','state':'implement','approval':'approved'}]*2):
 rows=invalid;assert not allowed(),(service,invalid)
fail=True;assert not allowed(), 'unavailable service authorized a write'
os.environ.pop('SERVICENOW_PASSWORD');calls.clear();assert not allowed();assert calls==[]
print('PASS: '+service+' production change boundary')
'''
    result=subprocess.run([sys.executable,'-c',code,service],cwd=ROOT,env=os.environ.copy(),capture_output=True,text=True,timeout=20)
    assert result.returncode==0,result.stderr+result.stdout
