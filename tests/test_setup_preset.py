import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
PRESET=ROOT/'installer/spec-kit/netclaw-claw'

class PresetTests(unittest.TestCase):
    def test_all_workflows_are_non_executable_native_review_contracts(self):
        for name in ('specify','clarify','plan','tasks','analyze','implement'):
            text=(PRESET/'commands'/('speckit.'+name+'.md')).read_text()
            self.assertIn('NETCLAW_DEPLOYMENT_PRESET_153_V1',text)
            self.assertIn('No command in this workflow authorizes executing',text)
            self.assertIn('Native secret entry returns presence only',text)
        sys.path.insert(0,str(ROOT/'scripts/lib'))
        from setup_plan import PlanValidator
        self.assertFalse(PlanValidator(ROOT).inspect(json.loads((PRESET/'example-plan.json').read_text()))['applyReady'])

    @unittest.skipUnless(os.environ.get('NETCLAW_SETUP_SPECIFY'),'Pinned CLI fixture explicitly required')
    def test_actual_pinned_cli_three_clients_combined_and_override_refusal(self):
        specify=Path(os.environ['NETCLAW_SETUP_SPECIFY']);python=specify.with_name('python')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();home=root/'home';home.mkdir(mode=0o700)
            env={'PATH':os.environ['PATH'],'HOME':str(home),'GIT_CONFIG_GLOBAL':'/dev/null','GIT_CONFIG_NOSYSTEM':'1','SPECKIT_ALLOW_ALL_TOOLS':'0','NO_COLOR':'1','COLUMNS':'300'}
            def run(args,cwd):
                result=subprocess.run([str(a) for a in args],cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
                self.assertEqual(result.returncode,0,result.stdout[-3000:].decode(errors='replace')+result.stderr[-1000:].decode(errors='replace'));return result
            for client in ('codex','claude','copilot'):
                destination=root/client
                run([specify,'init',destination,'--integration',client,'--script','sh','--no-git','--ignore-agent-tools'],root)
                run([specify,'preset','add','--dev',PRESET],destination)
                value=run([python,PRESET/'verify.py',destination,PRESET,client],destination)
                self.assertTrue(json.loads(value.stdout)['effective'])
                self.assertFalse((destination/'.git').exists())
            # Install each integration deliberately in the disposable combined
            # fixture, then let the pinned registrar re-emit the preset.
            combined=root/'combined'
            run([specify,'init',combined,'--integration','codex','--script','sh','--no-git','--ignore-agent-tools'],root)
            for client in ('claude','copilot'):
                run([specify,'init','--here','--force','--integration',client,'--script','sh','--no-git','--ignore-agent-tools'],combined)
            run([specify,'preset','add','--dev',PRESET],combined)
            run([python,PRESET/'verify.py',combined,PRESET,'codex','claude','copilot'],combined)
            override=combined/'.specify/templates/overrides/spec-template.md';override.parent.mkdir(parents=True,exist_ok=True);override.write_text('Displaced template')
            check=subprocess.run([str(python),str(PRESET/'verify.py'),str(combined),str(PRESET),'copilot'],env=env,capture_output=True)
            self.assertNotEqual(check.returncode,0);self.assertIn(b'preset_verification_failed',check.stdout)

if __name__=='__main__':unittest.main()
