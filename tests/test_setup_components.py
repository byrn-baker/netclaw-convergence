import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_components import dependency_ready
from setup_deploy import helper

class ComponentTests(unittest.TestCase):
    def test_gait_generation_requires_owned_marker_source_and_exact_record(self):
        from setup_components import gait_runtime,launcher_runtime
        from setup_state import guarded_write,Conflict
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp).resolve();generation=home/'.gait-venv-generation-fixture'
            python=generation/'bin/python';guarded_write(python,b'#!/bin/sh\nexit 0\n');python.chmod(0o700)
            guarded_write(generation/'.netclaw-gait-generation',b'Verified GAIT generation; setup-gait-runtime.py\n')
            guarded_write(generation/'netclaw-source/mcp-servers/gait_mcp/gait_mcp.py',b'# fixture')
            (home/'gait-venv').symlink_to(generation,target_is_directory=True)
            self.assertEqual(gait_runtime(home),python)
            guarded_write(home/'python-runtimes/records/gait',str(python).encode())
            deploy=types.SimpleNamespace(root=home)
            self.assertEqual(launcher_runtime('gait',deploy,{'command':'python3','args':['-u','scripts/gait-stdio.py']},'gait-mcp'),str(python))
            (home/'gait-venv').unlink();(home/'gait-venv').symlink_to(home.parent,target_is_directory=True)
            with self.assertRaises(Conflict):gait_runtime(home)
            with self.assertRaises(Conflict):launcher_runtime('gait',deploy,{},'gait-mcp')

    def test_non_python_wrapper_uses_owned_bootstrap_and_checks_real_script(self):
        from setup_state import guarded_write
        from setup_components import launcher_runtime
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp).resolve();source=home/'.setup/source';core=home/'.setup/python/bin/python'
            guarded_write(core,b'#!/bin/sh\nexit 0\n');core.chmod(0o700)
            guarded_write(home/'.setup/python312',str(core).encode())
            guarded_write(source/'scripts/component-launch.py',b'# stdlib launcher')
            server=source/'mcp-servers/tool/server.js';guarded_write(server,b'// fixture')
            raw={'command':'python3','args':['-u','scripts/component-launch.py','fixture','--server','fixture-mcp']}
            guarded_write(source/'config/openclaw.json',json.dumps({'mcpServers':{'fixture-mcp':raw}}).encode())
            guarded_write(source/'config/installer-access.json',json.dumps({'components':{'fixture':{'servers':['fixture-mcp'],'command':sys.executable,'script':'mcp-servers/tool/server.js'}}}).encode())
            claw={'runtimeHome':str(home),'workspace':str(home/'workspace'),'settings':{},'capabilities':{'components':['fixture']}}
            deploy=types.SimpleNamespace(root=home,source=source,claw=claw,validator=types.SimpleNamespace(components={'fixture':{'servers':['fixture-mcp'],'settings':[]}}))
            harness=types.SimpleNamespace(environment=lambda:{'PATH':os.defpath})
            binder=helper(ROOT,'install-mcp-config.py')
            with patch('setup_components.helper',return_value=binder):
                self.assertEqual(launcher_runtime('fixture',deploy,raw,'fixture-mcp'),str(core))
                self.assertTrue(dependency_ready('fixture',deploy,harness))
                server.unlink();self.assertFalse(dependency_ready('fixture',deploy,harness))
                self.assertIsNone(launcher_runtime('fixture',deploy,{'command':'python3','args':['other.py']},'fixture-mcp'))

    def test_real_binder_requires_owned_source_and_no_engine_python_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            home=Path(temp).resolve();source=home/'source';(source/'config').mkdir(parents=True)
            server=source/'mcp-servers/fixture/server.py';server.parent.mkdir(parents=True);server.write_text('pass')
            file=source/'config/openclaw.json'
            deploy=types.SimpleNamespace(root=home,source=source,claw={'settings':{}},validator=types.SimpleNamespace(components={'fixture':{'servers':['fixture-mcp']}}))
            harness=types.SimpleNamespace(environment=lambda:{'PATH':str(Path(sys.executable).parent)+':'+os.defpath})
            binder=helper(ROOT,'install-mcp-config.py')
            with patch('setup_components.helper',return_value=binder):
                file.write_text(json.dumps({'mcpServers':{'fixture-mcp':{'command':'python3','args':['mcp-servers/fixture/server.py']}}}))
                self.assertFalse(dependency_ready('fixture',deploy,harness))
                file.write_text(json.dumps({'mcpServers':{'fixture-mcp':{'command':sys.executable,'args':['mcp-servers/fixture/server.py']}}}))
                self.assertTrue(dependency_ready('fixture',deploy,harness))
                server.unlink();self.assertFalse(dependency_ready('fixture',deploy,harness))
                server.symlink_to(file);self.assertFalse(dependency_ready('fixture',deploy,harness))
                file.write_text(json.dumps({'mcpServers':{'fixture-mcp':{'url':'https://example.invalid/mcp'}}}))
                self.assertTrue(dependency_ready('fixture',deploy,harness))

    def test_optional_stencil_mode_never_downloads_without_explicit_selection(self):
        from setup_special import install_special
        from setup_components import selected_servers
        deploy=types.SimpleNamespace(claw={'settings':{}})
        self.assertEqual(install_special({'component':'threejs-viz'},{},deploy,None),{'state':'verified'})
        descriptor={'servers':['sketchfab-mcp']}
        self.assertEqual(selected_servers('threejs-viz',deploy.claw,descriptor),[])
        deploy.claw['settings']['SKETCHFAB_API_KEY']={'kind':'secret','source':'prompt'}
        self.assertEqual(selected_servers('threejs-viz',deploy.claw,descriptor),[])
        deploy.claw['settings']['NETCLAW_SKETCHFAB_ENABLED']={'kind':'value','value':True}
        self.assertEqual(selected_servers('threejs-viz',deploy.claw,descriptor),['sketchfab-mcp'])

if __name__=='__main__':unittest.main()
