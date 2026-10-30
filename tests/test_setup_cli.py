import json
import os
import copy
import errno
import fcntl
from pathlib import Path
import pty
import re
import select
import socket
import subprocess
import sys
import tempfile
import termios
import time
import unittest
ROOT=Path(__file__).resolve().parents[1]
from test_setup_plan import sample_plan


class CLITests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve();self.file=self.root/'plan.json'
        self.file.write_text(json.dumps(sample_plan(str(self.root))))

    def call(self,*args):
        return subprocess.run([sys.executable,str(ROOT/'scripts/setup-engine.py'),*args],cwd=ROOT,
            env={'HOME':str(self.root),'PATH':os.defpath},capture_output=True,text=True,timeout=10)

    def test_validate_explain_no_target_or_state_effects(self):
        for operation in ('validate','explain'):
            result=self.call(operation,'--plan',str(self.file))
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            self.assertTrue(json.loads(result.stdout)['valid'])
        self.assertEqual([p.name for p in self.root.iterdir()],['plan.json'])

    def test_existing_netclaw_notice_requires_observed_identity(self):
        from setup_cli import existing_notice
        from setup_state import guarded_write
        self.assertTrue(existing_notice(self.root).startswith('New setup'))
        home=self.root/'.openclaw';home.mkdir(mode=0o700)
        self.assertTrue(existing_notice(self.root).startswith('Existing claw directory'))
        guarded_write(home/'netclaw-hud/installation.json',json.dumps({'schemaVersion':1,'installationId':'00000000-0000-0000-0000-000000000001'}).encode())
        self.assertEqual(existing_notice(self.root),'Existing NetClaw detected. This setup creates a separate installation.')

    def test_approval_flags_and_fake_native_channel_do_not_apply(self):
        result=self.call('apply','--plan',str(self.file),'--yes')
        self.assertNotEqual(result.returncode,0)
        result=self.call('apply','--plan',str(self.file),'--native')
        self.assertEqual(result.returncode,3,result.stdout+result.stderr)
        self.assertEqual(json.loads(result.stdout)['code'],'native_channel_required')
        self.assertFalse((self.root/'claw').exists())

    def test_installer_dispatch_precedes_legacy_runtime_resolution(self):
        env={'HOME':str(self.root),'PATH':str(Path(sys.executable).parent)+':'+os.defpath,
             'NETCLAW_RUNTIME':'invalid-legacy-selector','OPENCLAW_STATE_DIR':str(self.root/'must-not-exist')}
        for flag in ('--validate-plan','--explain-plan'):
            result=subprocess.run(['/bin/bash',str(ROOT/'scripts/install.sh'),flag,str(self.file)],env=env,
                                  capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertTrue(json.loads(result.stdout)['valid'])
        self.assertFalse((self.root/'must-not-exist').exists())

    def test_terminal_and_editor_share_real_manifests_registration_and_honest_readiness(self):
        from setup_plan import PlanValidator
        snapshots=[]
        for harness in ('openclaw','hermes'):
            for mode in ('terminal','editor'):
                base=self.root/(harness+'-'+mode);base.mkdir(mode=0o700)
                plan=sample_plan(str(base));claw=plan['claws'][0]
                if harness=='hermes':claw.update(harness=harness,runtimeVersion='v0.21.6',workspace=claw['runtimeHome'])
                claw['capabilities']['components']=['subnet-calc','netbox']
                # The missing NetBox credentials and failed dependency must be
                # retained honestly in both frontends' actual report paths.
                file=base/'plan.json';file.write_text(json.dumps(plan));state=base/'state'
                for operation in ('validate','explain'):
                    result=self.call(operation,'--plan',str(file));self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                    actual=json.loads(result.stdout);validator=PlanValidator(ROOT)
                    self.assertEqual(actual,validator.explain(plan) if operation=='explain' else validator.inspect(plan))
                args=[sys.executable,str(ROOT/'tests/fixtures/setup/frontend-engine.py'),mode,str(file),str(state)]
                transcript=b'';secret='fixture-parity-key'
                env={'HOME':str(base),'PATH':os.defpath,'PYTHONNOUSERSITE':'1'}
                output_file=base/'output';error_file=base/'errors'
                with output_file.open('wb') as output,error_file.open('wb') as error:
                    if mode=='terminal':
                        master,slave=pty.openpty()
                        def terminal():os.setsid();fcntl.ioctl(slave,termios.TIOCSCTTY,0)
                        process=subprocess.Popen(args,stdin=slave,stdout=output,stderr=error,env=env,preexec_fn=terminal)
                        os.close(slave);approved=False;provided=False;deadline=time.monotonic()+15
                        try:
                            while process.poll() is None:
                                self.assertLess(time.monotonic(),deadline,'Terminal fixture timed out')
                                if not select.select([master],[],[],.1)[0]:continue
                                try:chunk=os.read(master,65536)
                                except OSError as exc:
                                    if exc.errno==errno.EIO:break
                                    raise
                                transcript+=chunk
                                match=re.search(rb'Type (APPLY [a-f0-9]{12}) to proceed:',transcript)
                                if match and not approved:os.write(master,match[1]+b'\n');approved=True
                                if b'ANTHROPIC_API_KEY (blank: configure later):' in transcript and not provided:
                                    os.write(master,secret.encode()+b'\n');provided=True
                            process.wait(timeout=5)
                            self.assertTrue(approved,(output_file.read_bytes()+error_file.read_bytes()+transcript).decode(errors='replace').replace(secret,'[redacted]')[-3000:])
                            self.assertTrue(provided,(output_file.read_bytes()+error_file.read_bytes()+transcript).decode(errors='replace').replace(secret,'[redacted]')[-3000:])
                        finally:
                            os.close(master)
                            if process.poll() is None:process.kill();process.wait()
                    else:
                        parent,child=socket.socketpair();parent.settimeout(10)
                        process=subprocess.Popen(args+[str(child.fileno())],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=error,env=env,pass_fds=(child.fileno(),));child.close()
                        stream=parent.makefile('rwb',buffering=0)
                        try:
                            process.stdin.write(b'{"protocol":1,"type":"heartbeat"}\n');process.stdin.flush()
                            request=json.loads(stream.readline());self.assertEqual(request['type'],'native-review')
                            stream.write((json.dumps({'protocol':1,'type':'native-review-answer','requestId':request['requestId'],'planHash':request['binding']['planHash'],'approved':True})+'\n').encode())
                            while True:
                                line=process.stdout.readline()
                                if not line:break
                                output.write(line);event=json.loads(line)
                                if event.get('type')=='secret-request':
                                    process.stdin.write((json.dumps({**event,'type':'secret','value':secret})+'\n').encode());process.stdin.flush()
                            process.wait(timeout=5)
                        finally:
                            stream.close();parent.close();process.stdin.close();process.stdout.close()
                            if process.poll() is None:process.kill();process.wait()
                self.assertEqual(process.returncode,5,error_file.read_text())
                public=output_file.read_bytes();self.assertNotIn(secret.encode(),public+transcript+error_file.read_bytes())
                result=json.loads(public.splitlines()[-1]);self.assertEqual(result['state'],'failed')
                home=Path(claw['runtimeHome']);self.assertIn(secret,(home/'.env').read_text())
                self.assertEqual((home/'.env').stat().st_mode&0o077,0)
                manifest=(home/'netclaw-components.conf').read_text();self.assertIn('subnet-calc',manifest);self.assertNotIn('netbox',manifest)
                registered=(home/'netclaw-mcp-config.json').read_text().replace(str(home),'<home>')
                self.assertEqual(set(json.loads(registered)['mcpServers']),{'subnet-calc-mcp'})
                report=json.loads((home/'.setup/verification.json').read_text())
                self.assertNotEqual(report['tiers'][2]['state'],'verified')
                snapshot=(manifest,registered,json.loads((home/'.setup/components.json').read_text()),report['tiers'],report['components'])
                if mode=='terminal':snapshots.append(snapshot)
                else:self.assertEqual(snapshot,snapshots[-1])

    def test_interactive_tree_preserves_order_and_exact_private_input_references(self):
        from setup_cli import DraftBuilder
        import hashlib
        inventory=self.root/'inventory.yaml';inventory.write_text('devices: {}\n')
        soul=self.root/'persona.md';soul.write_text('Fixture persona\n')
        questions=[]
        def ask(prompt):
            questions.append(prompt)
            values={'Harness':'openclaw','Model provider':'anthropic','Exact model':'fixture-model','Provider API':'anthropic',
                'Conversation channel':'none','Installation shape':'focused','Focused display':'Fixture',
                'New, empty':str(self.root/'new-claw'),'Capability profile':'minimal','Component IDs':'subnet-calc',
                'Credential trust':'fixture','ANTHROPIC_API_KEY':'prompt','Inventory for':'testbed-yaml',
                'testbed-yaml absolute':str(inventory),'soul absolute':str(soul),'user absolute':'','identity absolute':'',
                'Posture':'testing','One live':'no','Separately reviewed':'no','One read-only':'no'}
            for prefix,value in values.items():
                if prompt.startswith(prefix):return value
            self.fail('Unexpected interactive question: '+prompt)
        builder=DraftBuilder(ROOT,ask);sample=sample_plan(str(self.root));source={k:sample['source'][k] for k in ('commit','treeHash','dirty')}
        plan=builder.build(sample['host'],source)
        report=builder.validator.inspect(plan)
        self.assertTrue(report['valid'],report);self.assertTrue(report['applyReady'])
        self.assertLess(next(i for i,q in enumerate(questions) if q.startswith('Conversation channel')),next(i for i,q in enumerate(questions) if q.startswith('Installation shape')))
        self.assertLess(next(i for i,q in enumerate(questions) if q.startswith('Inventory')),next(i for i,q in enumerate(questions) if q.startswith('Posture')))
        self.assertEqual(plan['identity'][0]['sha256'],hashlib.sha256(soul.read_bytes()).hexdigest())
        self.assertNotIn('Fixture persona',json.dumps(plan));self.assertFalse((self.root/'new-claw').exists())


if __name__=='__main__':unittest.main()
