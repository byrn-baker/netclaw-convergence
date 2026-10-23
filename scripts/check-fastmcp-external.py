#!/usr/bin/env python3
"""Discover external catalogs offline in disposable subprocesses.

Pass --sources /path/to/staging/mcp-servers containing reviewed, patched copies.
Installed package integrations use --python's environment. No vendor calls occur.
"""
from __future__ import annotations
import argparse, concurrent.futures, json, os
from pathlib import Path
import subprocess, sys, tempfile

ENTRIES={
 'itential':('itential-mcp','itential_mcp.server.server','src/itential_mcp/server/server.py'),
 'cml':('cml-mcp','cml_mcp.server','src/cml_mcp/server.py'),
 'prisma-sdwan':('prisma-sdwan-mcp','prisma_sdwan_mcp.server','prisma_sdwan_mcp/server.py'),
 'percepxion':('percepxion-mcp-server','percepxion_mcp.server','src/percepxion_mcp/server.py'),
 'slc':('slc-mcp-server','slc_mcp.server','src/slc_mcp/server.py'),
 'aci':('ACI_MCP','aci_mcp.main','aci_mcp/main.py'),
 'fmc':('CiscoFMC-MCP-server-community','sfw_mcp_fmc.server','sfw_mcp_fmc/server.py'),
 'ise':('ISE_MCP','ise_mcp_server.server','src/ise_mcp_server/server.py'),
 'wikipedia':('Wikipedia_MCP','main','main.py'),
 'catalyst-center-legacy':('catalyst-center-mcp','legacy_catc','catalyst-center-mcp.py'),
 'sdwan':('cisco-sdwan-mcp','sdwan_mcp_server','sdwan_mcp_server.py'),
 'containerlab':('clab-mcp-server','clab_mcp_server','clab_mcp_server.py'),
 'f5':('f5-mcp-server','F5MCPserver','F5MCPserver.py'),
 'gait':('gait_mcp','gait_mcp','gait_mcp.py'),
 'humanrail':('humanrail-mcp-server','server','server.py'),
 'infrahub':('infrahub-mcp','infrahub_mcp.server','src/infrahub_mcp/server.py'),
 'arista-cvp':('mcp-cvp-fun','mcp_server_rest','mcp_server_rest.py'),
 'nvd-cve':('mcp-nvd','mcp_nvd.server','mcp_nvd/server.py'),
 'netbox':('netbox-mcp-server','netbox_mcp_server.server','src/netbox_mcp_server/server.py'),
 'radkit':('radkit-mcp-server-community','radkit_mcp.server','src/radkit_mcp/server.py'),
 'subnet-calc':('subnet-calculator-mcp','subnetcalculator_mcp','servers/subnetcalculator_mcp.py'),
 'te-community':('thousandeyes-mcp-community','server','src/server.py'),
 'uml':('uml-mcp','server','server.py'),
 'nmap':('nmap-mcp','nmap_server','server.py'),
 'aruba-cx':('aruba-cx-mcp','aruba_cx_mcp_server','mcp-servers/aruba-cx-mcp/aruba_cx_mcp_server.py'),
 'aap-ansible':('AAP-Enterprise-MCP-Server','aap_ansible','ansible.py'),
 'aap-eda':('AAP-Enterprise-MCP-Server','aap_eda','eda.py'),
 'aap-lint':('AAP-Enterprise-MCP-Server','aap_lint','ansible-lint.py'),
 'aap-docs':('AAP-Enterprise-MCP-Server','aap_docs','redhat_docs.py'),
 'fwrule':('fwrule-mcp','fwrule_mcp.server','src/fwrule_mcp/server.py'),
 'prometheus':('prometheus-mcp-server','prometheus_mcp_server.server','src/prometheus_mcp_server/server.py'),
 'aws-network':(None,'awslabs.aws_network_mcp_server.server',None),
 'infoblox':(None,'mcp_intent',None),
 'nso':(None,'cisco_nso_mcp_server.server',None)}

def probe(root, component):
    import asyncio, importlib, importlib.util, importlib.metadata
    from fastmcp import Client
    versions={name:importlib.metadata.version(name) for name in ('fastmcp','mcp')}
    assert versions == {'fastmcp':'4.0.11','mcp':'2.3.0'}, versions
    def no_network(event,args):
        if event in ('socket.connect','socket.getaddrinfo'):
            raise RuntimeError('offline fixture refuses network access')
    sys.addaudithook(no_network)
    directory,name,source=ENTRIES[component]
    base=root/directory if directory else root
    if directory:sys.path[:0]=[str(base/'src'),str(base),str((base/source).parent)]
    if component=='cml':
        from unittest.mock import patch
        patch('cml_mcp.cml_client.CMLClient.__init__', return_value=None).start()
    if component=='aci':os.environ['URLS_PATH']=str(base/'aci_mcp/urls.json')
    sys.argv=[str(base/source) if source else name]
    if not source or '.' in name:mod=importlib.import_module(name)
    else:
     spec=importlib.util.spec_from_file_location(name,base/source);mod=importlib.util.module_from_spec(spec);sys.modules[name]=mod;spec.loader.exec_module(mod)
    if component=='ise':
     s=mod.ISEMCPServer();s.register_tools();server=s.mcp
    elif component=='cml':
        server=mod.server_mcp
        # Exercise the migrated SDK2 error constructor on a denied URL.
        from cml_mcp.tools.middleware import CustomHttpRequestMiddleware
        from mcp.shared.exceptions import MCPError
        try:
            CustomHttpRequestMiddleware._validate_url('https://fixture.invalid', [], None)
        except MCPError as exc:
            assert exc.code == -31003
        else:
            raise AssertionError('CML URL policy unexpectedly allowed an untrusted origin')
    elif component=='itential':
        from itential_mcp import config
        async def build():
            async with mod.Server(config.get()) as wrapper:return wrapper.mcp
        server=asyncio.run(build())
    elif component=='nso':
     captured=[]
     from fastmcp import FastMCP
     FastMCP.run=lambda self,*a,**kw:captured.append(self)
     mod.main();server=captured[0]
    else:server=mod.mcp
    async def run():
     catalogs=[]
     for mode in ('legacy','2026-07-28'):
      async with Client(server,mode=mode) as c:catalogs.append(sorted(t.name for t in await c.list_tools()))
     assert catalogs[0]==catalogs[1]
     return catalogs[0], sorted(t.name for t in await server.list_tools() if t.task_config.supports_tasks())
    names, task_tools=asyncio.run(run())
    return {'status':'pass',**versions,'task_tools':task_tools,'tools':names,'protocol_modes':['legacy','2026-07-28'],
            'fixture_note':'vendor client constructor stubbed; URL denial checked' if component=='cml' else 'no vendor tool invocation'}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources',type=Path,required=True)
    parser.add_argument('--python',default=sys.executable)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--worker',choices=ENTRIES)
    parser.add_argument('--components',nargs='+',choices=ENTRIES)
    args=parser.parse_args()
    if args.worker:
        try: result=probe(args.sources.resolve(),args.worker)
        except BaseException as exc:
            result={'status':'error','error':type(exc).__name__+': '+str(exc)}
        print(json.dumps(result));return
    def run(component):
        with tempfile.TemporaryDirectory() as td:
            env={'PATH':os.environ.get('PATH',''),'HOME':td,'PYTHON_DOTENV_DISABLED':'1',
                 'FASTMCP_CHECK_FOR_UPDATES':'off','USERNAME':'fixture','PASSWORD':'fixture',
                 'APIC_URL':'https://fixture.invalid','ISE_BASE':'https://fixture.invalid',
                 'NETBOX_URL':'https://fixture.invalid','NETBOX_TOKEN':'fixture',
                 'CVP':'fixture.invalid','CVPTOKEN':'fixture','NVD_API_KEY':'fixture',
                 'FMC_HOST':'fixture.invalid','FMC_USERNAME':'fixture','FMC_PASSWORD':'fixture',
                 'USE_REAL_FASTMCP':'true','MOCK_FASTMCP':'false','AAP_URL':'https://fixture.invalid',
                 'AAP_TOKEN':'fixture','EDA_URL':'https://fixture.invalid','EDA_TOKEN':'fixture',
                 'CML_URL':'https://fixture.invalid','CML_USERNAME':'fixture','CML_PASSWORD':'fixture','NSO_ADDRESS':'fixture.invalid','NSO_USERNAME':'fixture','NSO_PASSWORD':'fixture',
                 'PROMETHEUS_URL':'https://fixture.invalid','AWS_EC2_METADATA_DISABLED':'true',
                 'AWS_ACCESS_KEY_ID':'fixture','AWS_SECRET_ACCESS_KEY':'fixture','AWS_DEFAULT_REGION':'us-east-1'}
            try:
                p=subprocess.run([args.python,str(Path(__file__).resolve()),'--sources',str(args.sources.resolve()),
                                  '--worker',component],env=env,cwd=td,capture_output=True,text=True,timeout=60)
                result=json.loads(p.stdout.splitlines()[-1])
            except Exception as exc:result={'status':'error','error':str(exc)}
            print(component,result['status'],len(result.get('tools',[])),result.get('error',''),flush=True)
            return component,result
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=dict(pool.map(run,args.components or ENTRIES))
    if args.output:args.output.write_text(json.dumps(results,indent=2)+'\n')
    return int(any(r['status']!='pass' for r in results.values()))

if __name__=='__main__':
    raise SystemExit(main())
