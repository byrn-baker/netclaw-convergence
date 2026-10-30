"""Terminal policy selection/preservation against private synthetic homes."""
import importlib.util
import json
import os
import errno
import fcntl
import pty
import select
import termios
import time
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_cli import DraftBuilder
from setup_observation import host_identity
from setup_state import Conflict


class TestbedSetupTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve();self.home=self.root/'hermes';self.home.mkdir(mode=0o700)
        self.env=self.home/'.env';self.env.write_text('NETCLAW_PASSWORD="PRIVATE-CANARY"\nPYATS_TESTBED_PATH=/private/operator.yaml\n');self.env.chmod(0o600)

    def test_new_plan_source_picker_reprompts_and_lists_prerequisites(self):
        answers=iter(['dynamic','list','unknown','cml netbox']);questions=[]
        result=DraftBuilder(ROOT,lambda q:questions.append(q) or next(answers)).testbed('Fixture')
        self.assertEqual(result,{'mode':'dynamic','sources':['cml','netbox']})
        self.assertTrue(any('No verified CMDB reader' in q for q in questions))
        self.assertEqual(DraftBuilder(ROOT,lambda q:'static').testbed('Fixture'),{'mode':'static','sources':[]})

    def run_legacy(self,answers):
        return subprocess.run(['/bin/bash',str(ROOT/'scripts/setup.sh'),'--testbed-only'],input=answers,text=True,capture_output=True,
            env={'PATH':str(Path(sys.executable).parent)+os.pathsep+os.defpath,'HOME':str(self.root),
                 'NETCLAW_RUNTIME':'hermes','HERMES_HOME':str(self.home)},cwd=ROOT,timeout=10)

    def test_actual_setup_keep_cancel_dynamic_and_static_preserve_credentials_and_file(self):
        static=self.home/'operator.yaml';static.write_text('devices: {}\n')
        before=self.env.read_bytes()
        for answers in ('\n','dynamic\ncancel\n','dynamic\ngns3\nn\n'):
            result=self.run_legacy(answers);self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(self.env.read_bytes(),before);self.assertNotIn('PRIVATE-CANARY',result.stdout+result.stderr)
        result=self.run_legacy('dynamic\ncml gns3 netbox\ny\n');self.assertEqual(result.returncode,0,result.stderr)
        data=self.env.read_text();self.assertIn('NETCLAW_TESTBED_MODE=dynamic',data);self.assertIn('NETCLAW_TESTBED_SOURCES=cml,gns3,netbox',data)
        self.assertIn('PRIVATE-CANARY',data);self.assertIn('PYATS_TESTBED_PATH=/private/operator.yaml',data)
        self.assertFalse((self.home/'testbed').exists())
        result=self.run_legacy('static\n'+str(static)+'\nn\n');self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('NETCLAW_TESTBED_MODE=static',self.env.read_text());self.assertEqual(static.read_text(),'devices: {}\n')
        self.assertEqual(self.env.stat().st_mode&0o077,0)

    def terminal(self,args,steps,expected_code=0):
        master,slave=pty.openpty()
        def control():os.setsid();fcntl.ioctl(slave,termios.TIOCSCTTY,0)
        process=subprocess.Popen(args,stdin=slave,stdout=slave,stderr=slave,cwd=ROOT,preexec_fn=control,
            env={'PATH':str(Path(sys.executable).parent)+os.pathsep+os.defpath,'HOME':str(self.root),
                 'NETCLAW_RUNTIME':'hermes','HERMES_HOME':str(self.home)})
        os.close(slave);output=b'';index=0;deadline=time.monotonic()+30
        try:
            while process.poll() is None:
                self.assertLess(time.monotonic(),deadline,'PTY prompt timed out: '+output[-800:].decode(errors='replace'))
                if not select.select([master],[],[],.1)[0]:continue
                try:chunk=os.read(master,65536)
                except OSError as exc:
                    if exc.errno==errno.EIO:break
                    raise
                output+=chunk
                if index<len(steps) and steps[index][0].encode() in output:
                    os.write(master,(steps[index][1]+'\n').encode());index+=1;output=b''
            process.wait(timeout=5)
            self.assertEqual(process.returncode,expected_code,output.decode(errors='replace'))
            self.assertEqual(index,len(steps))
            return output.decode(errors='replace')
        finally:
            os.close(master)
            if process.poll() is None:process.kill();process.wait()

    def test_actual_new_plan_and_legacy_prompts_on_controlling_terminal(self):
        plan=self.root/'pty-plan.json'
        steps=[('Harness','hermes'),('Model provider','anthropic'),('Exact model','fixture-model'),
            ('Provider API mode','anthropic'),('Conversation channels','none'),('Installation shape','focused'),
            ('Focused display','PTY fixture'),('New, empty',str(self.root/'new-home')),
            ('Capability profile','minimal'),('Component IDs','pyats'),('Credential trust','fixture'),
            ('NETCLAW_ENABLE_PASSWORD','later'),('NETCLAW_PASSWORD','later'),('NETCLAW_USERNAME','later'),
            ('ANTHROPIC_API_KEY','later'),('Testbed mode','dynamic'),('Dynamic testbed sources','cml netbox'),
            ('soul absolute',''),('user absolute',''),('identity absolute',''),('Posture','testing'),
            ('One live','no'),('Separately reviewed','no'),('One read-only','no')]
        command=['/bin/bash',str(ROOT/'scripts/install.sh'),'--emit-plan',str(plan)]
        try:
            host_identity()
        except Conflict as exc:
            # The new-claw engine supports macOS and qualified Ubuntu WSL2,
            # not a native Linux CI host. Exercise its real refusal instead of
            # fabricating a supported host or weakening the production gate.
            self.assertIn(str(exc),('unsupported_host','unknown_wsl_distribution'))
            output=self.terminal(command,[],expected_code=2)
            self.assertIn('draft_not_saved',output);self.assertNotIn('Harness',output)
            self.assertFalse(plan.exists())
        else:
            self.terminal(command,steps)
            value=json.loads(plan.read_text());self.assertEqual(value['claws'][0]['testbed'],{'mode':'dynamic','sources':['cml','netbox']})
            self.assertEqual(value['inventory'],[]);self.assertFalse((self.root/'new-home').exists())
            self.assertEqual(plan.stat().st_mode&0o077,0)
        self.terminal(['/bin/bash',str(ROOT/'scripts/setup.sh'),'--testbed-only'],
            [('Testbed mode','dynamic'),('Source IDs','cml netbox'),('Save','y')])
        self.assertIn('NETCLAW_TESTBED_MODE=dynamic',self.env.read_text())

    def test_invalid_policy_and_symlink_do_not_write(self):
        script=ROOT/'scripts/configure-testbed.py';before=self.env.read_bytes()
        for file,sources in [(self.env,'invalid'),(self.home/'alias','netbox')]:
            if file.name=='alias':file.symlink_to(self.env)
            result=subprocess.run([sys.executable,str(script),'--env',str(file),'--mode','dynamic','--sources',sources],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertEqual(self.env.read_bytes(),before)
            self.assertNotIn('PRIVATE-CANARY',result.stdout+result.stderr)


if __name__=='__main__':unittest.main()
