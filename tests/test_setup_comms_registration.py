"""Comms registrations bind private launchers and selected credential ownership."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_schema import canonical
from setup_state import Conflict,guarded_write
spec=importlib.util.spec_from_file_location('comms_launch',ROOT/'scripts/setup-comms-launch.py')
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)


class ManagedCommsTests(unittest.TestCase):
    def test_registration_preserves_unrelated_and_refuses_tampered_replacement_authority(self):
        from test_setup_plan import sample_plan
        from setup_deploy import Deployment
        from setup_state import guarded_read,revision
        for harness in ('openclaw','hermes'):
            with self.subTest(harness=harness),tempfile.TemporaryDirectory() as tmp:
                plan=sample_plan(str(Path(tmp).resolve()));claw=plan['claws'][0]
                claw.update(harness=harness,workspace=claw['runtimeHome'])
                claw['capabilities']['components']=['subnet-calc']
                effects=[];context={'runId':'fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':effects}}
                def effect(name,**extra):
                    item={'id':name,'owner':claw['id'],'phase':name,'artifacts':[],**extra};effects.append(item);return item
                context['artifactIntent']=lambda key,rows:next(e for e in effects if e['id']==key)['artifacts'].extend(rows)
                deploy=Deployment(ROOT,claw,context);deploy.home(effect('home'));runtime=effect('runtime')
                python=deploy.root/'python/bin/python';deploy.write(runtime,python,b'#!/bin/sh\nexit 0\n');python.chmod(0o700)
                deploy.write(runtime,deploy.root/'.setup/python312',str(python).encode())
                deploy.write(effect('credentials'),deploy.root/'.env',b'FIXTURE=local\n',kind='credentials')
                neighbor={'command':'/unrelated/server','args':['kept']}
                config=deploy.root/('openclaw.json' if harness=='openclaw' else 'config.yaml')
                native={'mcp':{'servers':{'unrelated':neighbor}}} if harness=='openclaw' else {'mcp_servers':{'unrelated':neighbor}}
                deploy.write(effect('onboard'),config,canonical(native),kind='configuration')
                effect('component',phase='components',component='subnet-calc',state='verified')
                self.assertEqual('verified',deploy.registration(effect('registration'))['state'])
                original=guarded_read(config);current=json.loads(original)
                servers=current['mcp']['servers'] if harness=='openclaw' else current['mcp_servers']
                self.assertEqual(neighbor,servers['unrelated'])
                foreign={'command':'/neighbor/private-runtime','args':[]};servers['subnet-calc-mcp']=foreign
                guarded_write(config,canonical(current),expected=revision(config));before=guarded_read(config)
                with self.assertRaises(Conflict):deploy.registration(effect('foreign-name'))
                self.assertEqual(before,guarded_read(config))
                # Forging the old registration file must not bless that foreign
                # same-name entry as an installer-owned replacement target.
                prior=deploy.root/'netclaw-mcp-config.json'
                guarded_write(prior,canonical({'mcpServers':{'subnet-calc-mcp':foreign}}),expected=revision(prior))
                with self.assertRaises(Conflict):deploy.registration(effect('forged-prior'))
                self.assertEqual(before,guarded_read(config))
                self.assertEqual(neighbor,(json.loads(before)['mcp']['servers'] if harness=='openclaw' else json.loads(before)['mcp_servers'])['unrelated'])

    def fixture(self,tmp,harness='hermes'):
        home=Path(tmp).resolve()/'claw';home.mkdir(mode=0o700)
        def write(relative,data):
            path=home/relative;path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            guarded_write(path,data,expected=None);return path
        write('.netclaw-setup-owner.json',canonical({'runId':'fixture','installationId':'fixture'}))
        write('.env',('NETCLAW_RUNTIME='+harness+'\nNETCLAW_RUNTIME_ENV='+str(home/'.env')+'\nTWILIO_API_SECRET=owned-secret\n').encode())
        write('netclaw-components.conf',b'twilio\nzoom-rtms\n')
        binary=write('python/bin/python',b'#!/bin/sh\nexit 0\n');binary.chmod(0o700)
        write('python-runtimes/records/zoom-rtms',str(binary).encode())
        write('python-runtimes/records/twilio',str(binary).encode())
        write('.setup/comms-node.json',canonical({'command':str(binary)}))
        for _,relative in launcher.SERVERS.values():write('.setup/source/'+relative,b'# fixture')
        return home

    def test_two_runtimes_use_owned_secrets_and_transient_discovery(self):
        for harness in ('hermes','openclaw'):
            with self.subTest(harness=harness),tempfile.TemporaryDirectory() as tmp:
                home=self.fixture(tmp,harness)
                inherited={'NETCLAW_RUNTIME_ENV':str(home/'.env'),'TWILIO_API_SECRET':'neighbor-secret'}
                for server in ('twilio-mcp','zoom-rtms-mcp'):
                    args,env,cwd=launcher.resolve(server,source=home/'.setup/source',inherited=inherited)
                    self.assertEqual('owned-secret',env['TWILIO_API_SECRET'])
                    self.assertNotIn('NETCLAW_MCP_DISCOVERY_ONLY',env)
                    self.assertNotIn('owned-secret',str(args))
                    _,discovery,_=launcher.resolve(server,source=home/'.setup/source',inherited={**inherited,'NETCLAW_MCP_DISCOVERY_ONLY':'1'})
                    self.assertEqual('1',discovery['NETCLAW_MCP_DISCOVERY_ONLY'])
                    self.assertNotIn('NETCLAW_MCP_DISCOVERY_ONLY',(home/'.env').read_text())

    def test_foreign_path_persisted_flag_unowned_runtime_and_hermes_voice_refuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=self.fixture(tmp);source=home/'.setup/source';env={'NETCLAW_RUNTIME_ENV':str(home/'.env')}
            for server,inherited in [('foreign',env),('twilio-voice-mcp',env),('twilio-mcp',{'NETCLAW_RUNTIME_ENV':str(home.parent/'.env')})]:
                with self.assertRaises(Conflict):launcher.resolve(server,source=source,inherited=inherited)
            record=home/'python-runtimes/records/zoom-rtms';record.write_text(sys.executable)
            with self.assertRaises(Conflict):launcher.resolve('zoom-rtms-mcp',source=source,inherited=env)
            with (home/'.env').open('a') as stream:stream.write('NETCLAW_MCP_DISCOVERY_ONLY=1\n')
            with self.assertRaises(Conflict):launcher.resolve('twilio-mcp',source=source,inherited=env)


if __name__=='__main__':unittest.main()
