"""Actual Hermes Comms effect wiring with isolated placeholder accounts.

Opt in to public, frozen npm acquisition. No QR, provider request, service,
model or device action runs. The Buzz binary is explicitly a C contract stub.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_comms import configure_channel
from setup_comms_hermes import fixtures
from setup_comms_hermes_native import source_contract,observe_bridge
from setup_deploy import Deployment
from setup_schema import canonical
from setup_secrets import child_environment,_dotenv
from setup_state import guarded_write

@unittest.skipUnless(os.environ.get('NETCLAW_TEST_HERMES_OWNED_ACQUISITION') and os.environ.get('NETCLAW_TEST_HERMES_PYTHON') and os.environ.get('NETCLAW_TEST_NODE'),'explicit native acquisition fixture required')
class HermesOwnedEffects(unittest.TestCase):
    def test_four_configuration_effects_and_unpaired_whatsapp_preserve_other_state(self):
        with tempfile.TemporaryDirectory(prefix='netclaw-hermes-owned-') as tmp:
            base=Path(tmp).resolve();plan=sample_plan(str(base));claw=plan['claws'][0]
            claw.update(harness='hermes',runtimeVersion='0.21.6')
            channels=('photon','homeassistant','raft','buzz','whatsapp')
            claw['channels']=[{'id':c,'settingKeys':[]} for c in channels]
            effects=[];context={'runId':'owned-fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':effects}}
            context['artifactIntent']=lambda key,items:next(e for e in effects if e['id']==key)['artifacts'].extend(items)
            def effect(phase,channel=None):
                value={'id':claw['id']+':'+phase+(':'+channel if channel else ''),'owner':claw['id'],'phase':phase,'channel':channel,'artifacts':[],'state':'running'}
                effects.append(value);return value
            deploy=Deployment(ROOT,claw,context);deploy.source=ROOT
            deploy.home(effect('home'))
            home=deploy.root;python=Path(os.environ['NETCLAW_TEST_HERMES_PYTHON']);source=python.parents[2]/'source'
            for channel in ('photon','whatsapp'):
                files,_=source_contract(ROOT,channel)
                for relative in files:guarded_write(home/'python-runtimes/hermes-hud-agent/source'/relative,(source/relative).read_bytes())
            # This fixture tests importing a reviewed native binary, not Buzz
            # itself. Its actual native --version process is bounded/local.
            native_c=base/'buzz-fixture.c';native_c.write_text('#include <stdio.h>\nint main(int n,char **v){if(n!=2)return 8;puts("buzz 0.1.0");return 0;}\n')
            binary=base/'buzz-fixture';subprocess.run(['/usr/bin/cc',str(native_c),'-o',str(binary)],check=True,capture_output=True)
            values={}
            for channel in channels:values.update(fixtures()[channel])
            values.update(NETCLAW_BUZZ_BINARY=str(binary),NETCLAW_BUZZ_BINARY_SHA256=hashlib.sha256(binary.read_bytes()).hexdigest(),UNRELATED_CANARY='preserved')
            deploy.write(effect('credentials'),home/'.env',''.join(k+'='+_dotenv.quote(v)+'\n' for k,v in sorted(values.items())).encode(),kind='credentials')
            initial={'model':{'provider':'retained'},'mcp_servers':{'neighbor':{'command':'retained'}},'platforms':{'telegram':{'enabled':False,'extra':{'retained':True}}}}
            deploy.write(effect('onboard'),home/'config.yaml',canonical(initial),kind='configuration')
            node=Path(os.environ['NETCLAW_TEST_NODE']);tool_dirs=[node.parent,Path('/opt/homebrew/bin')]
            calls=[]
            class H:
                def command(self):return [str(python),'-m','hermes_cli.main']
                def environment(self,credentials=None):return child_environment(home,'hermes',credentials,tool_directories=tool_dirs)
                def call(self,eff,args,**kw):
                    calls.append(args)
                    result=subprocess.run(args,cwd=kw.get('cwd',home),env=self.environment(kw.get('credentials')),capture_output=True,timeout=kw.get('timeout',60))
                    return {'returncode':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
            for channel in channels:
                with self.subTest(channel=channel):
                    before=(home/'config.yaml').read_bytes();env_before=(home/'.env').read_bytes()
                    result=configure_channel(effect('comms',channel),context,deploy,H())
                    if channel=='whatsapp':
                        self.assertEqual('configuration_required',result['state']);self.assertTrue(observe_bridge(home,ROOT,channel))
                        self.assertEqual(before,(home/'config.yaml').read_bytes());self.assertEqual(env_before,(home/'.env').read_bytes())
                        self.assertFalse((home/'.setup/comms/whatsapp/pair-request.json').exists())
                    else:
                        self.assertEqual('verified',result['state']);self.assertEqual('unverified',result['comms']['authentication'])
                        saved=json.loads((home/'config.yaml').read_bytes())
                        for key in ('model','mcp_servers'):self.assertEqual(initial[key],saved[key])
                        self.assertEqual(initial['platforms']['telegram'],saved['platforms']['telegram'])
                        self.assertIn(b'UNRELATED_CANARY=preserved',(home/'.env').read_bytes())
            self.assertFalse(any('gateway' in args or 'agent' in args or '--pair-only' in args for args in calls))
