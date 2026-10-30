"""Actual detached processes; no provider SDK, listener or user configuration."""
import hashlib
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_comms_discovery import bounded_probe,new_request,process_identity,stop_process,_grant
from setup_schema import canonical,loads
from setup_state import Conflict,guarded_read,guarded_write

CHILD='''import os,signal,sys,time
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from setup_comms_discovery import claim_child
claim_child(Path(sys.argv[2]),'zoom-rtms-mcp',sys.argv[3])
signal.signal(signal.SIGTERM,signal.SIG_IGN)
Path(sys.argv[4]).write_text(str(os.getpid()))
while True:time.sleep(.1)
'''
CLI='''import os,subprocess,sys,time
from pathlib import Path
child=subprocess.Popen([sys.executable,sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4],sys.argv[5]],start_new_session=True)
end=time.monotonic()+5
while not Path(sys.argv[5]).exists() and time.monotonic()<end:time.sleep(.01)
if sys.argv[6]=='stdout':os.write(1,b'x'*131072)
elif sys.argv[6]=='stderr':os.write(2,b'x'*131072)
elif sys.argv[6]=='success':
 print('{"tools":[]}');sys.exit(0)
while True:time.sleep(.1)
'''


class DiscoveryLifetimeTests(unittest.TestCase):
    def fixture(self,tmp):
        home=Path(tmp).resolve()/'claw';folder=home/'.setup/tmp/comms-discovery-fixture'
        folder.mkdir(parents=True,mode=0o700);guarded_write(home/'.netclaw-setup-owner.json',b'{"owner":"fixture"}',expected=None)
        request=new_request(folder,home,'zoom-rtms-mcp')
        child=folder/'child.py';child.write_text(CHILD)
        cli=folder/'cli.py';cli.write_text(CLI)
        marker=folder/'pid'
        return home,folder,request,child,cli,marker

    def test_timeout_and_output_limits_clean_detached_child_and_preserve_neighbor(self):
        for mode in ('timeout','stdout','stderr','success'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as tmp:
                home,folder,request,child,cli,marker=self.fixture(tmp)
                neighbor=subprocess.Popen([sys.executable,'-c','import time;time.sleep(20)'],start_new_session=True)
                identity=process_identity(neighbor.pid)
                try:
                    args=[sys.executable,str(cli),str(child),str(ROOT/'scripts/lib'),str(home),str(request),str(marker),mode]
                    if mode=='success':
                        self.assertEqual(b'{"tools":[]}\n',bounded_probe(args,home=home,env=os.environ.copy(),
                            request_path=request,server='zoom-rtms-mcp',timeout=2,output_limit=65536))
                    else:
                        with self.assertRaises(Conflict):bounded_probe(args,home=home,env=os.environ.copy(),
                            request_path=request,server='zoom-rtms-mcp',timeout=1,output_limit=65536)
                    self.assertTrue(marker.exists(),'fixture must pass the actual grant handshake')
                    self.assertIsNone(process_identity(int(marker.read_text())))
                    self.assertEqual(identity,process_identity(neighbor.pid))
                    self.assertEqual({'schema':1,'complete':True},loads(guarded_read(folder/'cleanup.json',16384,private=True)))
                    self.assertEqual('closed',loads(guarded_read(request,16384,private=True))['state'])
                finally:
                    neighbor.terminate();neighbor.wait(timeout=3)

    def test_lease_cannot_adopt_unrelated_pid_or_changed_generation(self):
        with tempfile.TemporaryDirectory() as tmp:
            home,folder,request,_,_,_=self.fixture(tmp)
            neighbor=subprocess.Popen([sys.executable,'-c','import time;time.sleep(20)'],start_new_session=True)
            cli=subprocess.Popen([sys.executable,'-c','import time;time.sleep(20)'],start_new_session=True)
            try:
                identity=process_identity(neighbor.pid);raw=guarded_read(request,16384,private=True);req=loads(raw)
                forged={'schema':1,'requestHash':hashlib.sha256(raw).hexdigest(),'nonce':req['nonce'],
                    'process':identity,'probe':process_identity(cli.pid),'watcher':process_identity(cli.pid)}
                guarded_write(folder/'child.json',canonical(forged),expected=None)
                with self.assertRaises(Conflict):_grant(request,home,'zoom-rtms-mcp',process_identity(cli.pid))
                self.assertFalse((folder/'grant.json').exists())
                self.assertTrue(stop_process({**identity,'birth':'different-generation'}))
                self.assertEqual(identity,process_identity(neighbor.pid))
            finally:
                for process in (neighbor,cli):process.terminate();process.wait(timeout=3)

    def test_ungranted_wrapper_exits_after_request_revocation_without_entering_server(self):
        with tempfile.TemporaryDirectory() as tmp:
            home,folder,request,child,cli,marker=self.fixture(tmp)
            process=subprocess.Popen([sys.executable,str(cli),str(child),str(ROOT/'scripts/lib'),str(home),str(request),str(marker),'timeout'],
                start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                raw=guarded_read(request,16384,private=True)
                guarded_write(folder/'probe.json',canonical({'schema':1,'requestHash':hashlib.sha256(raw).hexdigest(),
                    'process':process_identity(process.pid)}),expected=None)
                deadline=time.monotonic()+3
                while not (folder/'watcher-ready.json').exists() and time.monotonic()<deadline:time.sleep(.01)
                self.assertTrue((folder/'watcher-ready.json').exists())
                raw=guarded_read(request,16384,private=True);req=loads(raw);req['state']='closed'
                guarded_write(request,canonical(req),expected=hashlib.sha256(raw).hexdigest())
                lease=loads(guarded_read(folder/'child.json',16384,private=True));deadline=time.monotonic()+2
                while process_identity(lease['process']['pid']) and time.monotonic()<deadline:time.sleep(.02)
                self.assertIsNone(process_identity(lease['process']['pid']));self.assertFalse(marker.exists())
            finally:
                if process.poll() is None:process.kill();process.wait(timeout=2)

    def test_abrupt_supervisor_exit_cleans_granted_detached_server_and_probe(self):
        with tempfile.TemporaryDirectory() as tmp:
            home,folder,request,child,cli,marker=self.fixture(tmp)
            code='''import hashlib,os,sys
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from setup_comms_discovery import bounded_probe,process_identity
from setup_schema import canonical,loads
from setup_state import guarded_read,guarded_write
request=Path(sys.argv[3]);raw=guarded_read(request,16384,private=True);value=loads(raw)
value['supervisor']=process_identity(os.getpid());guarded_write(request,canonical(value),expected=hashlib.sha256(raw).hexdigest())
bounded_probe([sys.executable,sys.argv[5],sys.argv[4],sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[6],'timeout'],
home=Path(sys.argv[2]),env=os.environ.copy(),request_path=request,server='zoom-rtms-mcp',timeout=20)
'''
            supervisor=subprocess.Popen([sys.executable,'-c',code,str(ROOT/'scripts/lib'),str(home),str(request),str(child),str(cli),str(marker)],
                start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                deadline=time.monotonic()+5
                while not marker.exists() and time.monotonic()<deadline:time.sleep(.01)
                self.assertTrue(marker.exists())
                lease=loads(guarded_read(folder/'child.json',16384,private=True))
                supervisor.kill();supervisor.wait(timeout=2)
                deadline=time.monotonic()+4
                while any(process_identity(lease[key]['pid'])==lease[key] for key in ('process','probe','watcher')) and time.monotonic()<deadline:
                    time.sleep(.02)
                for key in ('process','probe','watcher'):self.assertIsNone(process_identity(lease[key]['pid']),key)
            finally:
                if supervisor.poll() is None:supervisor.kill();supervisor.wait(timeout=2)

    def test_symlink_and_owner_changed_request_refuse(self):
        from setup_comms_discovery import _request
        with tempfile.TemporaryDirectory() as tmp:
            home,folder,request,_,_,_=self.fixture(tmp)
            alias=folder.parent/'comms-discovery-aliasxx';alias.symlink_to(folder,target_is_directory=True)
            with self.assertRaises(Conflict):_request(alias/'request.json',home,'zoom-rtms-mcp')
            guarded_write(home/'.netclaw-setup-owner.json',b'{"owner":"changed"}')
            with self.assertRaises(Conflict):_request(request,home,'zoom-rtms-mcp')


if __name__=='__main__':unittest.main()
