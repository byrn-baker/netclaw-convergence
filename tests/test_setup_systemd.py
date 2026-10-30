"""Typed busctl contracts and an explicitly opted-in live WSL manager test."""
import copy
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
import unittest

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_systemd import observe_argv,unit_path
from setup_schema import canonical

def bus_reply(args,item,*,foreign=False):
    if args[0]!='/usr/bin/busctl':return None
    object_path=unit_path(Path(item['file']).name)
    if 'GetUnit' in args:value={'type':'o','data':[object_path]}
    elif args[-1]=='ExecStartEx':
        argv=item['arguments']+(['foreign'] if foreign else [])
        value={'type':'a(sasasttttuii)','data':[[argv[0],argv,item.get('execFlags',[]),0,0,0,0,0,0,0]]}
    else:raise AssertionError(args)
    return {'returncode':0,'stdout':canonical(value)}

class SystemdTests(unittest.TestCase):
    def test_absence_requires_successful_exact_name_listing_and_explicit_opt_in(self):
        item={'file':'/fixture/one.service','arguments':['/fixture/python'],'execFlags':['no-env-expand']}
        for reply,accepted in [({'returncode':0,'stdout':canonical({'type':'a(ssssssouso)','data':[[]]})},True),
                               ({'returncode':0,'stdout':canonical({'type':'a(ssssssouso)','data':[]})},False),
                               ({'returncode':1,'stdout':b''},False),
                               ({'returncode':0,'stdout':canonical({'type':'wrong','data':[]})},False),
                               ({'returncode':0,'stdout':canonical({'type':'a(ssssssouso)','data':[['present']]})},False)]:
            calls=[]
            def call(args):
                calls.append(args)
                if 'GetUnit' in args:return {'returncode':1,'stdout':b''}
                self.assertEqual(args[-5:],['ListUnitsByPatterns','asas','0','1','one.service'])
                return reply
            with self.assertRaises(Exception):observe_argv(call,item)
            self.assertEqual(len(calls),1)
            if accepted:self.assertIs(observe_argv(call,item,allow_absent=True),False)
            else:
                with self.assertRaises(Exception):observe_argv(call,item,allow_absent=True)

    @unittest.skipUnless(os.environ.get('NETCLAW_SETUP_SYSTEMD')=='1', 'opt-in disposable WSL user manager')
    def test_actual_descriptor_preserves_special_paths_and_typed_argv(self):
        from setup_observation import host_identity
        from setup_risk import descriptor
        self.assertEqual(host_identity()['platform'],'wsl2')
        with tempfile.TemporaryDirectory(prefix='nc153-systemd-') as tmp:
            root=Path(tmp).resolve();home=root/'space $literal% "quote" apostrophe\' backslash\\ trailing '
            source=home/'.setup/source';(source/'scripts').mkdir(parents=True,mode=0o700)
            output=root/'observed.json'
            (source/'scripts/setup-service.py').write_text('import json,os,sys,time\nfrom pathlib import Path\ninitial=os.getcwd()\nos.chdir(sys.argv[sys.argv.index("--home")+1])\nPath('+repr(str(output))+').write_text(json.dumps({"initial":initial,"cwd":os.getcwd(),"argv":sys.argv}))\ntime.sleep(30)\n')
            item,data=descriptor('wsl2','netclaw-spec153-test-'+secrets.token_hex(6),'hud',home,source,sys.executable,Path.home(),hot=False)
            file=Path(item['file']);file.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            def call(args):
                p=subprocess.run(args,capture_output=True,timeout=15)
                return {'returncode':p.returncode,'stdout':p.stdout}
            with file.open('xb') as f:f.write(data)
            file.chmod(0o600)
            try:
                subprocess.run(['systemctl','--user','daemon-reload'],check=True,capture_output=True)
                subprocess.run(['systemctl','--user','start',file.name],check=True,capture_output=True)
                self.assertTrue(observe_argv(call,item))
                deadline=time.monotonic()+10
                while not output.exists() and time.monotonic()<deadline:time.sleep(.05)
                observed=json.loads(output.read_text())
                self.assertEqual(observed['initial'],str(home/'.setup'))
                self.assertEqual(observed['cwd'],str(home))
                self.assertEqual(observed['argv'],item['arguments'][1:])
            finally:
                # Only this exclusive, unchanged fixture definition is stopped.
                self.assertEqual(file.read_bytes(),data)
                subprocess.run(['systemctl','--user','stop',file.name],check=True,capture_output=True)
                file.unlink()
                subprocess.run(['systemctl','--user','daemon-reload'],check=True,capture_output=True)

    def test_python_and_editor_share_typed_contract_cases(self):
        cases=json.loads((ROOT/'tests/fixtures/setup/systemd-observation.json').read_text())
        for case in cases:
            with self.subTest(case=case['name']):
                calls=[]
                def call(args):
                    calls.append(args)
                    self.assertEqual(args[:5],['/usr/bin/busctl','--user','--json=short','--no-pager','--timeout=10'])
                    self.assertNotIn('LoadUnit',args)
                    return {'returncode':case.get('returncode',0),'stdout':canonical(case['getUnit'] if 'GetUnit' in args else case['property'])}
                if case['accept']:self.assertTrue(observe_argv(call,case['item']));self.assertEqual(len(calls),2)
                else:
                    with self.assertRaises(Exception):observe_argv(call,case['item'])

    def test_bounded_or_invalid_bus_documents_never_authorize_service_control(self):
        item={'file':'/fixture/one.service','arguments':['/fixture/python','--home','/fixture/claw'],'execFlags':['no-env-expand']}
        for raw in (b'{}',b'[]',b'private-manager-error',b' '*65537,b'{"type":"o","type":"o","data":[]}'):
            with self.subTest(length=len(raw)):
                with self.assertRaises(Exception):observe_argv(lambda _:raw,item)
        for name in ('../neighbor.service','one.service\n','unit/part.service','unit\u00e9.service'):
            with self.assertRaises(Exception):unit_path(name)

if __name__=='__main__':unittest.main()
