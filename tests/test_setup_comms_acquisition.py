"""Optional actual Comms dependency installation in fresh owned homes."""
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_comms_tools import install,observe,contract
from setup_deploy import Deployment
from setup_harness import Harness
from setup_schema import canonical
from setup_state import Conflict
from test_setup_plan import sample_plan


class CommsAcquisitionTests(unittest.TestCase):
    def fixture(self,root,harness):
        plan=sample_plan(str(root));claw=plan['claws'][0]
        claw.update(harness=harness,runtimeVersion='0.21.6' if harness=='hermes' else '2026.7.1-2')
        claw['capabilities'].update(components=['twilio','zoom-rtms'],skills=[])
        effects=[];context={'plan':plan,'runId':'acquisition-fixture','planHash':'a'*64,'journal':{'effects':effects},
            'save':lambda:None,'lockFds':(),'writerStarted':lambda *a:None}
        def intent(key,items):next(e for e in effects if e['id']==key)['artifacts'].extend(items)
        context['artifactIntent']=intent
        def effect(name,component=None):
            e={'id':name,'owner':claw['id'],'phase':name if component is None else 'components','component':component,
                'state':'running','artifacts':[]};effects.append(e);return e
        deploy=Deployment(ROOT,claw,context);deploy.home(effect('home'))
        return plan,claw,context,deploy,effect

    def test_started_dependency_acquisition_never_replays_without_completion_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            _,_,context,deploy,effect=self.fixture(Path(tmp).resolve(),'hermes')
            source=deploy.source/'mcp-servers/twilio-env-mcp';source.mkdir(parents=True)
            for name in ('package.json','package-lock.json'):shutil.copy2(ROOT/'mcp-servers/twilio-env-mcp'/name,source/name)
            e=effect('twilio','twilio');expected,_=contract('twilio',deploy)
            deploy.write(e,deploy.root/'.setup/comms-tools/twilio/started.json',canonical(expected))
            class NoCalls:
                def __getattr__(self,name):raise AssertionError('unknown acquisition attempted execution')
            self.assertEqual({'state':'unknown'},install('twilio',e,context,deploy,NoCalls()))

    def test_wrong_phase_role_selection_and_unowned_or_changed_records_refuse_before_execution(self):
        with tempfile.TemporaryDirectory() as tmp:
            _,claw,context,deploy,effect=self.fixture(Path(tmp).resolve(),'hermes')
            shutil.copytree(ROOT/'installer/native-comms/tools',deploy.source/'installer/native-comms/tools')
            e=effect('zoom-rtms','zoom-rtms')
            class NoCalls:
                def __getattr__(self,name):raise AssertionError('unowned dependency attempted execution')
            for changes in ({'owner':'foreign'},{'phase':'verification'}):
                with self.assertRaises(Conflict):install('zoom-rtms',{**e,**changes},context,deploy,NoCalls())
            claw['role']='border'
            with self.assertRaises(Conflict):install('zoom-rtms',e,context,deploy,NoCalls())
            claw['role']='focused';claw['capabilities']['components']=[]
            with self.assertRaises(Conflict):install('zoom-rtms',e,context,deploy,NoCalls())
            claw['capabilities']['components']=['zoom-rtms']
            expected,_=contract('zoom-rtms',deploy)
            receipt=deploy.root/'.setup/comms-tools/zoom-rtms/installed.json'
            receipt.parent.mkdir(parents=True,mode=0o700);receipt.write_bytes(canonical(expected));receipt.chmod(0o600)
            self.assertFalse(observe('zoom-rtms',e,deploy,NoCalls()))
            context['artifactIntent'](e['id'],[deploy.artifact(receipt,receipt.read_bytes(),'dependency-receipt')])
            record=deploy.root/'python-runtimes/records/zoom-rtms'
            deploy.write(e,record,str(deploy.root/'arbitrary-executable').encode(),kind='runtime-record')
            self.assertFalse(observe('zoom-rtms',e,deploy,NoCalls()))
            record.write_text(str(deploy.root/'python-runtimes/zoom-rtms-comms/bin/python'))
            self.assertFalse(observe('zoom-rtms',e,deploy,NoCalls()))

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_COMMS_ACQUIRE')=='1','explicit isolated acquisition pass required')
    def test_fresh_actual_twilio_and_zoom_installers_for_both_runtimes(self):
        from setup_observation import host_identity
        host = host_identity()
        base=Path(os.environ['NETCLAW_TEST_COMMS_ACQUIRE_ROOT']).resolve()
        base.mkdir(mode=0o700,parents=True,exist_ok=True)
        for harness in ('openclaw','hermes'):
            with self.subTest(harness=harness):
                run=Path(tempfile.mkdtemp(prefix=harness+'-',dir=base))
                plan,_,context,deploy,effect=self.fixture(run,harness)
                # The generic plan fixture describes macOS/ARM. Actual installs
                # must select the observed host's lock, especially Zoom's wheel.
                plan['host']=host
                for name in ('twilio-env-mcp','zoom-rtms-mcp'):
                    shutil.copytree(ROOT/'mcp-servers'/name,deploy.source/'mcp-servers'/name,
                        ignore=shutil.ignore_patterns('node_modules','.venv','__pycache__'))
                shutil.copytree(ROOT/'installer/native-comms/tools',deploy.source/'installer/native-comms/tools')
                tools=[Path(os.environ['NETCLAW_TEST_NODE']).parent,Path(os.environ['NETCLAW_TEST_UV']).parent,Path('/opt/homebrew/bin')]
                native=Harness(ROOT,deploy.claw,context,deploy,tool_directories=tools)
                for component in ('twilio','zoom-rtms'):
                    e=effect(component,component)
                    self.assertEqual({'state':'verified'},install(component,e,context,deploy,native))
                    e['state']='verified'
                    self.assertTrue(observe(component,e,deploy,native))
                    self.assertFalse((deploy.root/'.env').exists(),'dependency install read/wrote credentials')
                    self.assertEqual({'state':'verified'},install(component,e,context,deploy,native))


if __name__=='__main__':unittest.main()
