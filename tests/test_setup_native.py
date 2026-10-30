import base64
import json
import os
from pathlib import Path
import select
import signal
import socket
import sys
import tempfile
import threading
import time
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_native import editor_terminal,OwnedTerminal
from setup_process import WriterUncertain


class NativeTerminalTests(unittest.TestCase):
    def test_actual_private_pty_input_exit_and_invalid_binding_never_reach_public_output(self):
        for case in ('success','wrong-nonce','wrong-hash','extra-field','cancel','disconnect'):
            with self.subTest(case=case),tempfile.TemporaryDirectory() as tmp:
                parent,engine=socket.socketpair();parent.settimeout(5)
                pause=threading.Event();writers=[];results=[];errors=[];output=[]
                context={'pause':pause,'lockFds':(),'writerStarted':lambda _id,identity:writers.append(identity)}
                # getpass must see an actual controlling TTY; its secret never
                # appears in public stdout or the returned structured result.
                code='import getpass; value=getpass.getpass("Fixture credential: "); assert value=="private-native-canary"; print("local-native-complete")'
                def run():
                    try:results.append(editor_terminal(engine,{'planHash':'a'*64},'b'*48,[sys.executable,'-c',code],
                        cwd=tmp,env={'PATH':os.defpath,'HOME':tmp,'PYTHONNOUSERSITE':'1'},context=context,effect={'id':'one:onboard'},timeout=5))
                    except BaseException as error:errors.append(error)
                worker=threading.Thread(target=run);worker.start();stream=parent.makefile('rwb',buffering=0)
                try:
                    prompt=json.loads(stream.readline());self.assertEqual(prompt['type'],'native-terminal-output')
                    output.append(base64.b64decode(prompt['data']))
                    if case=='cancel':pause.set()
                    elif case=='disconnect':parent.shutdown(socket.SHUT_RDWR)
                    else:
                        frame={'protocol':1,'type':'native-terminal-input','requestId':'b'*48,'planHash':'a'*64,
                            'data':base64.b64encode(b'private-native-canary\n').decode()}
                        if case=='wrong-nonce':frame['requestId']='c'*48
                        if case=='wrong-hash':frame['planHash']='c'*64
                        if case=='extra-field':frame['command']='never-executed'
                        stream.write((json.dumps(frame)+'\n').encode())
                    if case=='success':
                        while True:
                            frame=json.loads(stream.readline())
                            if frame['type']=='native-terminal-exit':self.assertEqual(frame['returncode'],0);break
                            output.append(base64.b64decode(frame['data']))
                    worker.join(7);self.assertFalse(worker.is_alive())
                    self.assertNotIn(b'private-native-canary',b''.join(output))
                    self.assertEqual(results,[{'returncode':0}] if case=='success' else [])
                    if case=='success':self.assertIn(b'local-native-complete',b''.join(output));self.assertEqual(errors,[])
                    else:self.assertIsInstance(errors[0],WriterUncertain)
                    self.assertEqual(len(writers),1)
                finally:
                    pause.set();stream.close();parent.close();engine.close();worker.join(7)
                    # Closing the controlling PTY settles this getpass fixture;
                    # the production adapter reaps it without sending signals.

    def test_surviving_descendant_retains_writer_lock_and_is_unknown(self):
        import fcntl
        with tempfile.TemporaryDirectory() as tmp:
            lock=os.open(str(Path(tmp)/'writer.lock'),os.O_RDWR|os.O_CREAT,0o600)
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            # Linux sends SIGHUP to the foreground process group when its
            # controlling-terminal leader exits. Ignore it before spawning so
            # this fixture actually leaves a surviving writer on both hosts.
            code='''import os,signal,subprocess,sys
signal.signal(signal.SIGHUP,signal.SIG_IGN)
subprocess.Popen([sys.executable,'-c','import time; time.sleep(10)'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,pass_fds=(int(sys.argv[1]),))
'''
            process=OwnedTerminal([sys.executable,'-c',code,str(lock)],cwd=tmp,env={'PATH':os.defpath},lock_fds=(lock,))
            try:
                process.process.wait(timeout=5)
                with self.assertRaises(WriterUncertain):process.settle()
                os.close(lock);lock=None
                other=os.open(str(Path(tmp)/'writer.lock'),os.O_RDWR)
                try:
                    with self.assertRaises(BlockingIOError):fcntl.flock(other,fcntl.LOCK_EX|fcntl.LOCK_NB)
                finally:os.close(other)
            finally:
                process.close()
                if lock is not None:os.close(lock)
                try:os.killpg(process.process.pid,signal.SIGTERM)
                except ProcessLookupError:pass

    def test_pause_before_native_start_creates_no_writer(self):
        a,b=socket.socketpair();pause=threading.Event();pause.set();writers=[]
        try:
            with self.assertRaises(WriterUncertain):editor_terminal(a,{'planHash':'a'*64},'b'*48,[sys.executable,'-c','raise SystemExit(99)'],
                cwd=ROOT,env={'PATH':os.defpath},context={'pause':pause,'lockFds':(),'writerStarted':lambda *args:writers.append(args)},effect={'id':'one:onboard'})
            self.assertEqual(writers,[])
        finally:a.close();b.close()


if __name__=='__main__':unittest.main()
