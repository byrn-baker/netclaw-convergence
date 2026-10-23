import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('pal_core', ROOT / 'mcp-servers/tavus-pal-mcp/core.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)

class PalBoundaryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name).resolve()
        self.workspace = self.home / 'netclaw-pal/workspace'
        self.workspace.mkdir(parents=True)
        for name in ['AGENTS.md','SOUL.md','TOOLS.md','USER.md','IDENTITY.md','HEARTBEAT.md','BOOTSTRAP.md']:
            (self.workspace/name).write_text(core.INSTRUCTIONS)
        self.config = {'agents': {'list': [{'id':'netclaw-pal','workspace':str(self.workspace),'tools':{'deny':['*']}}]}, 'gateway': {'auth':{'token':'PRIVATE_TOKEN'},'http':{'endpoints':{'chatCompletions':{'enabled':True}}}}}
        self.save()
    def save(self):
        (self.home/'openclaw.json').write_text(json.dumps(self.config))
    def test_all_tools_denied_and_isolated_workspace_required(self):
        core.config_and_agent(self.home)
        for policy in [{}, {'deny':['exec']}, {'allow':['*']}]:
            self.config['agents']['list'][0]['tools']=policy;self.save()
            with patch.object(core.http.client,'HTTPConnection') as connection:
                result=core.query('Run a shell command', 'a'*36, self.home)
                self.assertEqual(result['status'],'unavailable');connection.assert_not_called()
    def test_private_bootstrap_or_memory_blocks_dispatch(self):
        (self.workspace/'TOOLS.md').write_text('secret topology')
        with self.assertRaises(ValueError):core.config_and_agent(self.home)
        (self.workspace/'TOOLS.md').write_text(core.INSTRUCTIONS)
        (self.workspace/'MEMORY.md').write_text('private history')
        with self.assertRaises(ValueError):core.config_and_agent(self.home)
    def test_gateway_reply_remains_local_and_credentials_never_return(self):
        with patch.object(core.http.client,'HTTPConnection') as factory:
            response=factory.return_value.getresponse.return_value
            response.status=200;response.read.return_value=b'{"choices":[{"message":{"content":"General explanation"}}]}'
            result=core.query('Explain BGP','a'*36,self.home)
            self.assertEqual(result['exposure'],'local_only')
            self.assertNotIn('PRIVATE_TOKEN',json.dumps(result))
            headers=factory.return_value.request.call_args.args[3]
            self.assertEqual(headers['x-openclaw-agent-id'],'netclaw-pal')
            self.assertTrue(headers['x-openclaw-session-key'].startswith('agent:netclaw-pal:pal:'))
            factory.assert_called_with('127.0.0.1',18789,timeout=45)
    def test_prepare_dry_run_and_apply_preserve_original_main_config(self):
        module_spec=importlib.util.spec_from_file_location('pal_prepare',ROOT/'scripts/pal-prepare-agent.py')
        prepare=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(prepare)
        with tempfile.TemporaryDirectory() as directory:
            home=Path(directory)
            original={'agents':{'defaults':{'model':'existing-model'}},'gateway':{'auth':{'token':'private-token'}},'unrelated':{'keep':True}}
            file=home/'openclaw.json';file.write_text(json.dumps(original))
            self.assertFalse(prepare.prepare(home,False,True)['applied'])
            self.assertEqual(json.loads(file.read_text()),original)
            result=prepare.prepare(home,True,True)
            config=json.loads(file.read_text())
            self.assertEqual(config['unrelated'],original['unrelated'])
            self.assertEqual(config['agents']['defaults'],original['agents']['defaults'])
            self.assertEqual(config['agents']['list'][0],{'id':'main','default':True})
            self.assertEqual(json.loads(Path(result['backup']).read_text()),original)
            self.assertEqual(file.stat().st_mode & 0o777,0o600)
            core.config_and_agent(home)
            with self.assertRaises(ValueError):prepare.prepare(home,True,True)

if __name__=='__main__':unittest.main()
