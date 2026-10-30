"""Messaging observations must bind a live manager PID and fresh native state."""
import copy
import datetime
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import subprocess
import shutil
import time
from unittest.mock import patch
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_comms_services import hermes_status,openclaw_status,observe_runtime


class NativeStatusContracts(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_HERMES_PYTHON'),'isolated pinned Hermes Python required')
    def test_actual_native_lock_and_birth_observer_with_controlled_status_and_no_gateway(self):
        """Native status API + real lock/PID; synthetic connected is no provider pass."""
        native=Path(os.environ['NETCLAW_TEST_HERMES_PYTHON']);upstream=native.parents[2]/'source'
        compatibility=json.loads((ROOT/'config/hermes-hud-compatibility.json').read_bytes())
        packages=subprocess.check_output([str(native),'-c','import sysconfig;print(sysconfig.get_paths()["purelib"])'],
            env={'PATH':os.defpath,'PYTHONDONTWRITEBYTECODE':'1'},timeout=10).decode().strip()
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve()/'fixture';source=home/'python-runtimes/hermes-hud-agent/source'
            for relative in compatibility['files']:
                target=source/relative;target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                shutil.copyfile(upstream/relative,target)
            python=home/'python-runtimes/hermes-hud-agent/venv/bin/python';python.parent.mkdir(parents=True,mode=0o700)
            python.symlink_to(native.resolve())
            shutil.copyfile(native.parent.parent/'pyvenv.cfg',python.parent.parent/'pyvenv.cfg')
            from setup_state import guarded_write
            from setup_schema import canonical
            for name in ('setup_comms_services.py','setup_report.py','setup_schema.py','setup_state.py','setup_process.py'):
                guarded_write(home/'.setup/source/scripts/lib'/name,(ROOT/'scripts/lib'/name).read_bytes())
            guarded_write(home/'.setup/source/config/hermes-hud-compatibility.json',canonical(compatibility))
            guarded_write(home/'.netclaw-setup-owner.json',canonical({'runId':'fixture','installationId':'fixture'}))
            fixture=home/'desktop-gateway.py'
            fixture.write_text('''import datetime,json,os,sys,time
from pathlib import Path
os.umask(0o077);home=Path(os.environ['HERMES_HOME'])
sys.path.insert(0,str(home/'python-runtimes/hermes-hud-agent/source'))
def audit(event,args):
 if event in ('socket.connect','socket.bind','subprocess.Popen'):raise RuntimeError('fixture effect refused')
sys.addaudithook(audit)
from gateway.status import acquire_gateway_runtime_lock,write_pid_file,_build_pid_record
assert acquire_gateway_runtime_lock();write_pid_file()
record=_build_pid_record();stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
record.update(gateway_state='running',updated_at=stamp,platforms={'discord':{'state':'connected','updated_at':stamp,
 'writer_pid':record['pid'],'writer_start_time':record['start_time']}})
(home/'gateway_state.json').write_text(json.dumps(record))
while True:time.sleep(.1)
''')
            env={'PATH':os.defpath,'HOME':str(home/'.setup/os-home'),'HERMES_HOME':str(home),
                'PYTHONPATH':packages,'PYTHONDONTWRITEBYTECODE':'1','PYTHONNOUSERSITE':'1'}
            child=subprocess.Popen([str(python),str(fixture)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            def inspect(pid):
                result=subprocess.run([str(python),str(home/'.setup/source/scripts/lib/setup_comms_services.py'),
                    'hermes-status',str(pid),'discord'],env=env,capture_output=True,timeout=15)
                return result,json.loads(result.stdout)
            try:
                end=time.monotonic()+5
                while not (home/'gateway_state.json').exists() and time.monotonic()<end and child.poll() is None:time.sleep(.02)
                self.assertTrue((home/'gateway_state.json').exists(),'native status fixture failed to start')
                before={p.name:p.read_bytes() for p in (home/'gateway.pid',home/'gateway.lock',home/'gateway_state.json')}
                result,row=inspect(child.pid)
                if result.returncode:
                    diagnostic=subprocess.run([str(python),'-c',"import sys,os;print(sys.executable,os.environ.get('HERMES_HOME'));sys.path.insert(0,sys.argv[1]);from setup_comms_services import _native_hermes_status;print(_native_hermes_status(int(sys.argv[2]),'discord'))",
                        str(home/'.setup/source/scripts/lib'),str(child.pid)],env=env,capture_output=True,timeout=15)
                    self.fail(diagnostic.stdout.decode()+diagnostic.stderr.decode())
                self.assertEqual(0,result.returncode,result.stderr.decode());self.assertTrue(row['connected'])
                self.assertFalse(inspect(child.pid+1)[1]['connected'])
                self.assertEqual(before,{(home/name).name:(home/name).read_bytes() for name in before})
                child.terminate();child.wait(timeout=5)
                self.assertFalse(inspect(child.pid)[1]['connected'])
            finally:
                if child.poll() is None:child.terminate();child.wait(timeout=5)
                child.stdout.close();child.stderr.close()

    def test_hermes_heartbeat_is_distinct_from_platform_transition_time(self):
        now=1800000000
        stamp=lambda n:datetime.datetime.fromtimestamp(n,datetime.timezone.utc).isoformat()
        value={'kind':'hermes-gateway','hermes_home':'/owned','pid':456,'start_time':123456,
            'gateway_state':'running','updated_at':stamp(now-60),'platforms':{'discord':{
                'state':'connected','updated_at':stamp(now-3600),'writer_pid':456,'writer_start_time':123456}}}
        def check(v):return hermes_status(v,'/owned','discord',pid=456,start_time=123456,now=now)
        self.assertTrue(check(value))
        for change in [lambda v:v.update(pid=457),lambda v:v.update(hermes_home='/neighbor'),
            lambda v:v.update(gateway_state='stopped'),lambda v:v.update(updated_at=stamp(now-121)),
            lambda v:v['platforms']['discord'].update(writer_start_time=123457),
            lambda v:v['platforms']['discord'].update(writer_pid=457),
            lambda v:v['platforms']['discord'].update(state='configured'),
            lambda v:v['platforms']['discord'].update(updated_at=stamp(now+30))]:
            bad=copy.deepcopy(value);change(bad);self.assertFalse(check(bad))

    def test_openclaw_config_fallback_and_stale_or_foreign_accounts_are_not_transport(self):
        now=1800000000
        value={'ts':now*1000,'channelAccounts':{'discord':[{'accountId':'default','enabled':True,
            'configured':True,'running':True,'connected':True,'lastTransportActivityAt':(now-10)*1000}]}}
        self.assertTrue(openclaw_status(value,'discord',now=now))
        self.assertFalse(openclaw_status({'channels':{'discord':{'configured':True}}},'discord',now=now))
        for change in [lambda v:v.update(ts=(now-121)*1000),
            lambda v:v['channelAccounts']['discord'][0].update(lastTransportActivityAt=(now-121)*1000),
            lambda v:v['channelAccounts']['discord'][0].update(accountId='neighbor'),
            lambda v:v['channelAccounts']['discord'][0].update(connected=False),
            lambda v:v['channelAccounts']['discord'].append(copy.deepcopy(v['channelAccounts']['discord'][0]))]:
            bad=copy.deepcopy(value);change(bad);self.assertFalse(openclaw_status(bad,'discord',now=now))

    def test_no_owned_manager_means_no_native_or_provider_probe(self):
        probe=SimpleNamespace(claw={'harness':'hermes'},home=Path('/unowned'))
        with patch('setup_comms_services.owned_gateway_pid',return_value=None):
            row=observe_runtime(probe,'discord')
        self.assertEqual('unverified',row['transport']['state'])
        self.assertEqual('unverified',row['authentication']['state'])

    def test_local_webhook_listener_is_never_public_authenticated_transport(self):
        for channel in ('sms','teams','whatsapp-cloud'):
            probe=SimpleNamespace(claw={'harness':'hermes'},home=Path('/owned'))
            with patch('setup_comms_services.owned_gateway_pid',side_effect=AssertionError('must not probe unsafe surface')):
                row=observe_runtime(probe,channel)
            self.assertEqual('unverified',row['transport']['state'])
            self.assertEqual('unverified',row['authentication']['state'])

    def test_actual_os_process_generation_is_stable_and_dead_pid_is_unverified(self):
        import subprocess
        from setup_comms_services import process_generation
        def call(_h,_e,args):
            result=subprocess.run(args,capture_output=True,timeout=5)
            return {'returncode':result.returncode,'stdout':result.stdout}
        probe=SimpleNamespace(harness=None,effect=None)
        with patch('setup_risk.native_call',side_effect=call):
            first=process_generation(probe,os.getpid())
            self.assertIsNotNone(first);self.assertEqual(first,process_generation(probe,os.getpid()))
            self.assertIsNone(process_generation(probe,2147483647))

    def test_wrong_manager_definition_never_exposes_a_pid(self):
        from setup_risk import native_service_pid
        from setup_schema import canonical
        from setup_state import guarded_write,revision
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp).resolve()/'owned.plist';guarded_write(path,b'fixture')
            item={'file':str(path),'sha256':revision(path),'label':'owned-gateway','arguments':['/owned/python','/owned/service.py']}
            value='\n path = '+str(path)+'\n arguments = {\n /owned/python\n /owned/service.py\n }\n pid = 456\n'
            with patch('setup_risk.native_call',return_value={'returncode':0,'stdout':value.encode()}):
                self.assertEqual(456,native_service_pid(None,None,'macos',item))
            for changed in (value.replace('/owned/service.py','/neighbor/service.py'),value.replace('pid = 456','pid = 0'),value.replace(str(path),'/neighbor/service.plist')):
                with patch('setup_risk.native_call',return_value={'returncode':0,'stdout':changed.encode()}):
                    self.assertIsNone(native_service_pid(None,None,'macos',item))


if __name__=='__main__':unittest.main()
