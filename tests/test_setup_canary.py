import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
spec=importlib.util.spec_from_file_location('setup_canary',ROOT/'scripts/setup-canary.py')
canary=importlib.util.module_from_spec(spec);spec.loader.exec_module(canary)


class CanaryTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('NETCLAW_SETUP_CANARY_PYTHON'),'opt-in isolated MCP 2.3 interpreter')
    def test_actual_pinned_sdk_results_decode_without_old_wire_field_names(self):
        code='''import importlib.util,importlib.metadata,sys
from pathlib import Path
from mcp.types import CallToolResult,TextContent
assert importlib.metadata.version('mcp')=='2.3.0'
def load(name):
 s=importlib.util.spec_from_file_location(name,Path(sys.argv[1])/'scripts'/name)
 m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
canary=load('setup-canary.py');network=load('setup-network-check.py')
for result in (CallToolResult(content=[],structured_content={'fixture':True}),CallToolResult(content=[TextContent(type='text',text='{"fixture":true}')])):
 assert canary.result_values(result)==[{'fixture':True}]
 assert network.decoded(result)=={'fixture':True}
error=CallToolResult(content=[],structured_content={'fixture':True},is_error=True)
assert canary.result_values(error)==[] and network.decoded(error)=={}
print('MCP 2.3 result decoding verified')
'''
        result=subprocess.run([os.environ['NETCLAW_SETUP_CANARY_PYTHON'],'-c',code,str(ROOT)],capture_output=True,timeout=20)
        self.assertEqual(result.returncode,0,result.stderr.decode())
        self.assertEqual(result.stdout,b'MCP 2.3 result decoding verified\n')

    def test_only_fixed_local_calls_and_typed_results_qualify(self):
        self.assertEqual(canary.call_for('anta'),('anta_list_tests',{'category':'','keyword':'','limit':1}))
        with self.assertRaises(ValueError):canary.call_for('anta_run_tests')
        catalog={'total_in_catalogue':208,'matched':208,'returned':1,'truncated':True,
                 'tests':[{'name':'VerifyCPUUtilization','category':'system','description':'Local catalog entry'}]}
        self.assertTrue(canary.valid_result('anta',catalog,'owned'))
        for changed in ({'returned':True},{'total_in_catalogue':0},{'tests':[]},{'matched':207},{'truncated':False}):
            self.assertFalse(canary.valid_result('anta',{**catalog,**changed},'owned'))
        self.assertTrue(canary.valid_result('n2n',{'enabled':True,'role':'member','ready':True,'identity':'owned'},'owned'))
        for changed in ({'identity':'neighbor'},{'ready':False},{'role':'border'}):
            self.assertFalse(canary.valid_result('n2n',{'enabled':True,'role':'member','ready':True,'identity':'owned',**changed},'owned'))
        self.assertFalse(canary.valid_result('subnet-calc',{'network_address':'192.0.2.0','prefix_length':28,'usable_hosts_count':True},'owned'))

    def test_local_launch_does_not_load_credentials_or_script_overrides(self):
        from setup_secrets import child_environment
        from setup_state import guarded_write
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp).resolve();source=home/'.setup/source';source.mkdir(parents=True)
            for name in ('scripts/component-launch.py','scripts/runtime-selection.py','scripts/write-env.py','config/installer-access.json','mcp-servers/anta-mcp/server.py'):
                target=source/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
            executable=home/'python-runtimes/anta/bin/python';executable.parent.mkdir(parents=True)
            executable.write_text('#!/bin/sh\nexit 0\n');executable.chmod(0o700)
            guarded_write(home/'python-runtimes/records/anta',(str(executable)+'\n').encode())
            guarded_write(home/'netclaw-hud/installation.json',b'{"installationId":"owned"}')
            guarded_write(home/'.env',b'ANTA_PASSWORD="private-canary"\nANTA_MCP_SCRIPT="/not-owned/script.py"\n')
            env=child_environment(home,'openclaw',{'ANTA_PASSWORD':'private-canary','ANTA_MCP_SCRIPT':'/not-owned/script.py'})
            argv,clean,cwd,identity=canary.launch_parameters('anta',env,source)
            self.assertEqual(identity,'owned');self.assertEqual(argv[0],str(executable))
            self.assertEqual(argv[-1],str(source/'mcp-servers/anta-mcp/server.py'))
            self.assertEqual(clean['NETCLAW_RUNTIME_ENV'],'/dev/null')
            self.assertNotIn('ANTA_PASSWORD',clean);self.assertNotIn('ANTA_MCP_SCRIPT',clean)
            executable.unlink();executable.symlink_to(sys.executable)
            with self.assertRaises(ValueError):canary.launch_parameters('anta',env,source)


if __name__=='__main__':unittest.main()
