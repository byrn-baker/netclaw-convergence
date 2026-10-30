import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan


class TransportTests(unittest.TestCase):
    def test_real_engine_native_terminal_reconciles_and_stops_after_cancel(self):
        import base64
        for cancelled in (False,True):
            with self.subTest(cancelled=cancelled),tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp).resolve();planfile=root/'plan.json';planfile.write_text(json.dumps(sample_plan(str(root))))
                parent,child=socket.socketpair();parent.settimeout(10)
                script=root/'terminal-session.py'
                script.write_text('''import json,sys,threading
from pathlib import Path
sys.path.insert(0,sys.argv[1]+"/scripts/lib")
from setup_engine import Engine
from setup_transport import EditorSession,emit
from setup_deploy import Deployment
class Observation:
 def binding(self,plan):return {'source':plan['source'],'host':plan['host'],'inputs':[]}
 def check(self,*args):pass
 def controls(self,*args):return []
plan=json.loads(Path(sys.argv[2]).read_text());target=Path(sys.argv[2]).parent/'native-result'
def runner(effect,context):
 if effect['phase']=='home':return Deployment(sys.argv[1],plan['claws'][0],context).home(effect)
 if effect['phase']=='onboard':
  code='import getpass,pathlib,sys; value=getpass.getpass("Private fixture: "); assert value=="native-secret-canary"; pathlib.Path(sys.argv[1]).write_text("selected-config-verified")'
  result=session.terminal([sys.executable,'-c',code,str(target)],cwd=target.parent,env={'PATH':'/usr/bin:/bin','HOME':str(target.parent)},context=context,effect=effect)
  # Exit zero alone cannot satisfy this trusted fixture adapter's postcondition.
  return {'state':'verified' if result['returncode']==0 and target.read_text()=='selected-config-verified' else 'failed'}
 return {'state':'verified'}
engine=Engine(sys.argv[1],Path(sys.argv[2]).parent/'state',runner,observation=Observation(),emit=emit)
session=EditorSession(engine,fd=int(sys.argv[3]))
try:emit(engine.apply(plan,session.review(engine,plan)))
finally:session.close()
''')
                process=subprocess.Popen([sys.executable,str(script),str(ROOT),str(planfile),str(child.fileno())],
                    pass_fds=(child.fileno(),),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                child.close();stream=parent.makefile('rwb',buffering=0);terminal_output=[];answered=False
                try:
                    while True:
                        line=stream.readline()
                        if not line:break
                        frame=json.loads(line)
                        if frame['type']=='native-review':
                            response={'protocol':1,'type':'native-review-answer','requestId':frame['requestId'],'planHash':frame['binding']['planHash'],'approved':True}
                        elif frame['type']=='native-terminal':
                            response={'protocol':1,'type':'native-terminal-ready','requestId':frame['requestId'],'planHash':frame['binding']['planHash']}
                        elif frame['type']=='native-terminal-output':
                            terminal_output.append(base64.b64decode(frame['data']))
                            if answered:continue
                            answered=True
                            response={k:frame[k] for k in ('protocol','requestId','planHash')}
                            response.update(type='native-terminal-cancel' if cancelled else 'native-terminal-input')
                            if not cancelled:response['data']=base64.b64encode(b'native-secret-canary\n').decode()
                        elif frame['type']=='native-terminal-exit':continue
                        else:self.fail('Unexpected private frame')
                        stream.write((json.dumps(response)+'\n').encode())
                    output=process.stdout.read();error=process.stderr.read();process.wait(timeout=10)
                    result=json.loads(output.splitlines()[-1]);self.assertEqual(result['state'],'unknown' if cancelled else 'completed')
                    if cancelled:
                        onboard=next(e for e in result['effects'] if e['phase']=='onboard');self.assertEqual(onboard['state'],'unknown')
                        self.assertTrue(all(e['state']=='pending' for e in result['effects'] if e['phase'] in ('components','registration','services','verification')))
                    else:self.assertTrue((root/'native-result').is_file())
                    self.assertNotIn(b'native-secret-canary',output+error+b''.join(terminal_output))
                    self.assertEqual(process.returncode,0)
                finally:
                    stream.close();parent.close();process.stdin.close()
                    if process.poll() is None:process.kill();process.wait()
                    process.stdout.close();process.stderr.close()

    def test_native_destination_is_nonce_bound_and_disconnect_cancels_pending_input(self):
        # Exercise the inherited socket boundary in a real child process. No
        # destination is ever emitted on the public progress stream.
        cases=('valid','wrong-nonce','wrong-hash','extra-field','wildcard','disconnect')
        for case in cases:
            with self.subTest(case=case),tempfile.TemporaryDirectory() as tmp:
                parent,child=socket.socketpair();parent.settimeout(5)
                script=Path(tmp)/'destination.py'
                script.write_text('''import json,sys
sys.path.insert(0,sys.argv[1]+"/scripts/lib")
from setup_transport import EditorSession
class Engine:
 def request_pause(self):pass
session=EditorSession(Engine(),fd=int(sys.argv[2]))
try:
 value=session.destination({'planHash':'a'*64,'owner':'one','tier':5,'channel':'slack','destinationRef':'native-test'})
 print(json.dumps({'accepted':value=='C0123456789'}),flush=True)
except Exception:print(json.dumps({'accepted':False}),flush=True)
finally:session.close()
''')
                process=subprocess.Popen([sys.executable,str(script),str(ROOT),str(child.fileno())],pass_fds=(child.fileno(),),
                    stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                child.close();stream=parent.makefile('rwb',buffering=0)
                try:
                    request=json.loads(stream.readline());self.assertEqual(request['type'],'native-destination')
                    if case=='disconnect':
                        process.stdin.close();process.stdin=None
                    else:
                        response={'protocol':1,'type':'native-destination-answer','requestId':request['requestId'],
                            'planHash':'a'*64,'destination':'C0123456789'}
                        if case=='wrong-nonce':response['requestId']='stale'
                        if case=='wrong-hash':response['planHash']='b'*64
                        if case=='extra-field':response['approved']=True
                        if case=='wildcard':response['destination']='*'
                        stream.write((json.dumps(response)+'\n').encode())
                    # Keep stdin live for valid native requests until the result.
                    line=process.stdout.readline()
                    self.assertEqual(json.loads(line),{'accepted':case=='valid'})
                    output,error=process.communicate(timeout=5)
                    self.assertEqual(process.returncode,0);self.assertNotIn(b'C0123456789',line+output+error)
                finally:
                    stream.close();parent.close()
                    if process.poll() is None:process.kill();process.wait()

    def test_real_editor_channel_eof_pauses_at_first_checkpoint(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();planfile=root/'plan.json';planfile.write_text(json.dumps(sample_plan(str(root))))
            parent,child=socket.socketpair();parent.settimeout(10)
            script=root/'session.py'
            script.write_text('''import json,sys,time
from pathlib import Path
sys.path.insert(0,sys.argv[1]+"/scripts/lib")
from setup_engine import Engine
from setup_transport import EditorSession,emit
from setup_deploy import Deployment
class Observation:
 def binding(self,plan):return {'source':plan['source'],'host':plan['host'],'inputs':[]}
 def check(self,*args):pass
 def controls(self,*args):return []
plan=json.loads(Path(sys.argv[2]).read_text())
def runner(effect,context):
 Deployment(sys.argv[1],plan['claws'][0],context).home(effect)
 time.sleep(.2)
 return {'state':'verified'}
engine=Engine(sys.argv[1],Path(sys.argv[2]).parent/'state',runner,observation=Observation(),emit=emit)
session=EditorSession(engine,fd=int(sys.argv[3]))
try:
 review=session.review(engine,plan)
 emit(engine.apply(plan,review))
finally:session.close()
''')
            process=subprocess.Popen([sys.executable,str(script),str(ROOT),str(planfile),str(child.fileno())],
                pass_fds=(child.fileno(),),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            child.close()
            try:
                process.stdin.write(b'{"protocol":1,"type":"heartbeat"}\n');process.stdin.flush()
                stream=parent.makefile('rwb',buffering=0);request=json.loads(stream.readline())
                response={'protocol':1,'type':'native-review-answer','requestId':request['requestId'],'planHash':request['binding']['planHash'],'approved':True}
                stream.write((json.dumps(response)+'\n').encode())
                first=json.loads(process.stdout.readline());self.assertEqual(first['code'],'effect_started')
                process.stdin.close();process.stdin=None
                output,_=process.communicate(timeout=10)
                self.assertEqual(process.returncode,0)
                result=json.loads(output.splitlines()[-1]);self.assertEqual(result['state'],'paused')
                self.assertEqual(sum(e['state']=='verified' for e in result['effects']),1)
                self.assertEqual(sum(e['state']=='pending' for e in result['effects']),len(result['effects'])-1)
            finally:
                parent.close()
                if process.poll() is None:process.kill();process.wait()

    def test_large_document_emission_stays_within_frame_limits(self):
        code='import sys;sys.path.insert(0,sys.argv[1]);from setup_transport import emit;emit({"effects":[{"phase":"components"}]*5000})'
        result=subprocess.run([sys.executable,'-c',code,str(ROOT/'scripts/lib')],capture_output=True,check=True)
        frames=[json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(frames[0]['type'],'document-start');self.assertEqual(frames[-1]['type'],'document-end')
        self.assertTrue(all(len(line)<65536 for line in result.stdout.splitlines()))
        import base64,hashlib
        data=b''.join(base64.b64decode(frame['data']) for frame in frames[1:-1])
        self.assertEqual(hashlib.sha256(data).hexdigest(),frames[0]['sha256'])
        self.assertEqual(len(json.loads(data)['effects']),5000)


if __name__=='__main__':unittest.main()
