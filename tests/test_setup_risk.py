import copy
import json
from pathlib import Path
import plistlib
import sys
import tempfile
import os
import unittest
import asyncio
import types
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_risk import descriptor,roles,configure_risk,service_hot


class ServiceTests(unittest.TestCase):
    def test_native_service_pins_canonical_python_instead_of_launcher_alias(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();alias=root/'python3';alias.symlink_to(sys.executable)
            for platform in ('macos','wsl2'):
                item,_=descriptor(platform,'netclaw-canonical','hud',root/'claw',root/'source',alias,root)
                self.assertEqual(item['arguments'][0],str(Path(sys.executable).resolve()))
                self.assertNotEqual(item['arguments'][0],str(alias))

    def test_routed_self_status_is_authenticated_bounded_and_never_cold_starts(self):
        sys.path.insert(0,str(ROOT/'mcp-servers/protocol-mcp'))
        from bgp.federation.service import FederationService
        from bgp.federation.channel import RpcError
        calls=[]
        async def call(method,params,timeout):calls.append((method,params,timeout));return {'ready':True}
        channel=types.SimpleNamespace(trusted=True,attestation='possession',call=call)
        member=types.SimpleNamespace(border_channel=channel,runtime=types.SimpleNamespace(kind='hermes',installation='fixture-id'),
            hermes_runtime=types.SimpleNamespace(ready=True),risk=types.SimpleNamespace(self_member_id=lambda:'risk/member'))
        result=asyncio.run(FederationService._in2n_self_status(member,channel,{}))
        self.assertEqual(result,{'memberId':'risk/member','kind':'hermes','installationId':'fixture-id','ready':True})
        for peer,params in [(types.SimpleNamespace(trusted=True),{}),(channel,{'command':'unsafe'})]:
            with self.assertRaises(RpcError):asyncio.run(FederationService._in2n_self_status(member,peer,params))
        member.hermes_runtime.ready=False
        self.assertFalse(asyncio.run(FederationService._in2n_self_status(member,channel,{}))['ready'])
        border=types.SimpleNamespace(member_channels={'risk/member':channel},risk=types.SimpleNamespace(is_border=lambda:True))
        self.assertTrue(asyncio.run(FederationService.member_self_status(border,'risk/member'))['ready'])
        self.assertEqual(calls,[('in2n/self-status',{},10.0)])
        with self.assertRaises(ValueError):asyncio.run(FederationService.member_self_status(border,'risk/cold-member'))
        self.assertEqual(len(calls),1)

    def test_outbound_member_health_refuses_closed_unready_foreign_and_stale_state(self):
        from setup_member_health import observe,read_status
        from setup_state import guarded_write
        from setup_schema import canonical
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp).resolve();path=home/'netclaw-federation/setup-member-health.json'
            service=types.SimpleNamespace(runtime=types.SimpleNamespace(kind='hermes',installation='fixture-id'),
                border_channel=types.SimpleNamespace(trusted=True,attestation='possession',_closed=False),hermes_runtime=types.SimpleNamespace(ready=True))
            value=observe(service);guarded_write(path,canonical(value))
            self.assertTrue(read_status(home,'fixture-id','hermes')['ready'])
            with self.assertRaises(Exception):read_status(home,'foreign-id','hermes')
            value['at']=int(time.time())-16;guarded_write(path,canonical(value))
            with self.assertRaises(Exception):read_status(home,'fixture-id','hermes')
            service.border_channel._closed=True;self.assertFalse(observe(service)['ready'])
            service.border_channel._closed=False;service.hermes_runtime.ready=False;self.assertFalse(observe(service)['ready'])

    def test_local_enrollment_all_pairs_three_members_recovery_and_scope(self):
        sys.path.insert(0,str(ROOT/'mcp-servers/protocol-mcp'))
        from setup_enrollment import materialize,observe
        from setup_deploy import Deployment
        previous=os.umask(0o077)
        try:
            for border_harness in ('openclaw','hermes'):
                with tempfile.TemporaryDirectory() as tmp:
                    root=Path(tmp).resolve();plan=sample_plan(str(root));border=plan['claws'][0]
                    border.update(role='border',harness=border_harness)
                    context={'runId':'run-fixture','planHash':'a'*64,'plan':plan,'artifactIntent':lambda *_:None}
                    Deployment(ROOT,border,context).home({'id':'home'})
                    record={'runId':context['runId'],'planHash':context['planHash'],'border':border,'claw':border,'python':sys.executable}
                    self.assertTrue(materialize(record))
                    for index,harness in enumerate(('openclaw','hermes','openclaw')):
                        claw=copy.deepcopy(border);claw.update(id='member'+str(index),role='member',harness=harness,runtimeHome=str(root/('member'+str(index))),workspace=str(root/('member'+str(index))))
                        claw['provider']['id']='openai' if index%2 else 'anthropic';claw['service']['mode']='hot' if index%2 else 'on-demand'
                        Deployment(ROOT,claw,context).home({'id':'home'})
                        record['claw']=claw
                        self.assertTrue(materialize(record));self.assertTrue(observe(record));self.assertTrue(materialize(record))
                        bad=copy.deepcopy(record);bad['claw']['capabilities']['skills']=['unrequested-skill']
                        self.assertFalse(observe(bad))
                        self.assertNotIn('enrollment_token',json.dumps(record))
        finally:os.umask(previous)

    def test_scoped_native_definitions_have_no_environment_values_or_shell(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();home=root/'claw with spaces $literal% "quote"; café';source=home/'.setup/source'
            for platform in ('macos','wsl2'):
                item,data=descriptor(platform,'netclaw-one','hud',home,source,Path(sys.executable),root)
                self.assertIn('netclaw-one-hud',item['file'])
                self.assertNotIn(b'.env',data);self.assertNotIn(b'API_KEY',data)
                self.assertEqual(item['arguments'][-2:],['--role','hud'])
                if platform=='macos':
                    self.assertEqual(plistlib.loads(data)['ProgramArguments'],item['arguments'])
                    self.assertNotIn('EnvironmentVariables',plistlib.loads(data))
                else:
                    self.assertIn(b'UMask=0077',data);self.assertNotIn(b'/bin/sh',data)
                    self.assertIn(b'ExecStart=:',data);self.assertEqual(item['execFlags'],['no-env-expand'])
                    self.assertIn(b'$literal%%',data);self.assertNotIn(b'$$literal',data)

    def test_each_harness_and_member_gets_separate_service_identity(self):
        for harness in ('openclaw','hermes'):
            for mode in ('hot','on-demand'):
                claw=sample_plan()['claws'][0];claw['harness']=harness;claw['service']['mode']=mode
                selected=roles(claw,'risk')
                self.assertIn('hud',selected);self.assertIn('federation',selected)
                self.assertEqual('gateway' in selected,harness=='openclaw')

    def test_on_demand_sleeps_only_the_worker_and_preserves_management(self):
        for harness in ('openclaw','hermes'):
            claw=sample_plan()['claws'][0]
            claw.update(role='member',harness=harness)
            claw['service']['mode']='on-demand'
            for role in roles(claw,'risk'):
                self.assertEqual(service_hot(claw,role),role!='federation')
            claw['service']['mode']='hot'
            self.assertTrue(all(service_hot(claw,role) for role in roles(claw,'risk')))

    def test_risk_materialization_preserves_independent_member_credentials(self):
        from setup_deploy import Deployment
        from setup_secrets import write_environment,read_owned_environment
        from setup_state import revision
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp).resolve();plan=sample_plan(str(root));border=plan['claws'][0];border['role']='border'
            member=copy.deepcopy(border);member.update(id='member',role='member',harness='hermes',runtimeHome=str(root/'member'),workspace=str(root/'member/workspace'))
            plan['claws'].append(member);plan['shape']='risk'
            intents=[];context={'runId':'run-fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':[]},'artifactIntent':lambda _,a:intents.extend(a)}
            for claw,secret in [(border,'border-canary'),(member,'member-canary')]:
                deploy=Deployment(ROOT,claw,context);deploy.home({'id':'home'})
                path=Path(claw['runtimeHome'])/'.env';digest=write_environment(path,{'ANTHROPIC_API_KEY':secret},expected=None)
                context['journal']['effects'].append({'artifacts':[{'path':str(path),'sha256':digest}]})
                configure_risk({'id':'risk'},context,deploy,None)
                values=read_owned_environment(path,revision(path))
                self.assertEqual(values['ANTHROPIC_API_KEY'],secret)
                self.assertNotIn('TOKEN', ' '.join(values))
                self.assertEqual(values['N2N_ENABLED_STACKS'],'in2n')
                self.assertEqual(values['BGP_LISTEN_HOST'],'127.0.0.1')


if __name__=='__main__':unittest.main()
