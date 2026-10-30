import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_deploy import Deployment
from setup_schema import canonical,loads
from setup_state import guarded_read,guarded_write,revision,Conflict
from setup_certificate_material import generate,validate
from setup_certificates import install,observe,binding

class Crash(BaseException):pass

class CertificateTests(unittest.TestCase):
    def fixture(self,root,*,actual_python=None):
        plan=sample_plan(str(root));claw=plan['claws'][0];effects=[];calls=[]
        context={'runId':'run-fixture','planHash':'a'*64,'plan':plan,'journal':{'effects':effects}}
        def effect(phase):
            value={'id':phase,'owner':claw['id'],'phase':phase,'component':'claw-certs' if phase=='components' else '', 'state':'running','artifacts':[]};effects.append(value);return value
        context['artifactIntent']=lambda key,items:next(e for e in effects if e['id']==key)['artifacts'].extend(items)
        deploy=Deployment(ROOT,claw,context);deploy.home(effect('home'));source=effect('runtime');current=effect('components')
        executable=deploy.root/'python-runtimes/claw-certs/bin/python'
        deploy.write(current,executable,b'#!/bin/sh\nexit 99\n',kind='file');executable.chmod(0o700)
        deploy.write(current,deploy.root/'python-runtimes/records/claw-certs',str(executable).encode(),kind='runtime-record')
        if actual_python:
            for name in ('scripts/setup-certificates.py','scripts/lib/setup_certificate_material.py','scripts/lib/setup_schema.py','scripts/lib/setup_state.py','mcp-servers/protocol-mcp/bgp/federation/certs.py'):
                deploy.write(source,deploy.source/name,(ROOT/name).read_bytes(),kind='source')
        def call(effect,args,**kwargs):
            calls.append(args)
            record=loads(guarded_read(args[-1],16384,private=True))
            if actual_python:
                env={'HOME':str(deploy.root/'.setup/os-home'),'PATH':os.defpath,'PYTHONNOUSERSITE':'1','PYTHONDONTWRITEBYTECODE':'1'}
                result=subprocess.run([actual_python,*args[1:]],cwd=deploy.root,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20)
                self.assertEqual(result.stderr,b'','Helper must not expose private diagnostic output')
                return {'returncode':result.returncode,'stdout':result.stdout}
            if args[2]=='generate-private':return {'returncode':0,'stdout':canonical(generate(record))}
            value=loads(guarded_read(deploy.root/'.setup/claw-certificate.json',65536,private=True))
            validate(value,record);return {'returncode':0,'stdout':canonical({'schema':1,'valid':True})}
        harness=types.SimpleNamespace(call=call,install_python_component=lambda *_:self.fail('An owned runtime already exists'))
        return context,deploy,current,harness,calls

    def test_owned_keypair_is_valid_independent_idempotent_and_absent_from_public_results(self):
        pairs=[]
        for _ in range(2):
            with tempfile.TemporaryDirectory() as temp:
                context,deploy,effect,harness,calls=self.fixture(Path(temp).resolve())
                result=install(effect,context,deploy,harness);self.assertEqual(result,{'state':'verified'})
                cert=deploy.root/'n2n/keys/host/host.crt';key=cert.with_suffix('.key')
                raw=key.read_text();pairs.append(raw);before=key.stat()
                validate(loads(guarded_read(deploy.root/'.setup/claw-certificate.json',65536,private=True)),binding(context,deploy))
                self.assertEqual(observe(effect,context,deploy,harness),'completed')
                self.assertEqual(install(effect,context,deploy,harness),result)
                self.assertEqual(sum('generate-private' in c for c in calls),1)
                self.assertEqual((key.stat().st_ino,key.stat().st_mtime_ns),(before.st_ino,before.st_mtime_ns))
                self.assertEqual(key.stat().st_mode&0o077,0)
                self.assertNotIn(raw,json.dumps([result,effect,calls]))
                effect['state']='verified'
                from setup_verify import Probes
                probes=Probes({'id':'verification'},context,deploy,harness)
                self.assertEqual(probes.component('claw-certs'),{'state':'verified','code':'certificate_verified'})
                key.unlink()
                self.assertEqual(observe(effect,context,deploy,harness),'conflict')
                self.assertEqual(probes.component('claw-certs')['state'],'unverified')
        self.assertNotEqual(pairs[0],pairs[1])

    def test_interrupted_materialization_reuses_exact_pair_without_generating_new_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            context,deploy,effect,harness,calls=self.fixture(Path(temp).resolve());original=deploy.write
            def crash_after_bundle(*args,**kwargs):
                result=original(*args,**kwargs)
                if Path(args[1]).name=='claw-certificate.json':raise Crash()
                return result
            with patch.object(deploy,'write',side_effect=crash_after_bundle):
                with self.assertRaises(Crash):install(effect,context,deploy,harness)
            effect['state']='unknown';before=revision(deploy.root/'.setup/claw-certificate.json')
            self.assertEqual(observe(effect,context,deploy,harness),'retry_owned')
            self.assertEqual(install(effect,context,deploy,harness),{'state':'verified'})
            self.assertEqual(revision(deploy.root/'.setup/claw-certificate.json'),before)
            self.assertEqual(sum('generate-private' in c for c in calls),1)

    def test_existing_foreign_or_modified_material_is_never_replaced(self):
        with tempfile.TemporaryDirectory() as temp:
            context,deploy,effect,harness,calls=self.fixture(Path(temp).resolve())
            key=deploy.root/'n2n/keys/host/host.key';guarded_write(key,b'existing key')
            with self.assertRaises(Conflict):install(effect,context,deploy,harness)
            self.assertEqual(key.read_bytes(),b'existing key');self.assertFalse(calls)
            key.unlink();install(effect,context,deploy,harness)
            bundle=deploy.root/'.setup/claw-certificate.json';value=loads(guarded_read(bundle,65536,private=True))
            changed=copy.deepcopy(value);changed['key']=generate(binding(context,deploy))['key']
            with self.assertRaises(Conflict):validate(changed,binding(context,deploy))
            guarded_write(bundle,canonical(changed))
            before=key.read_bytes()
            with self.assertRaises(Conflict):install(effect,context,deploy,harness)
            self.assertEqual(key.read_bytes(),before)

    @unittest.skipUnless(os.environ.get('NETCLAW_SETUP_CERT_PYTHON'),'optional isolated cryptography 46.0.5 interpreter')
    def test_actual_qualified_helper_uses_private_pipe_and_refuses_file_output(self):
        python=os.environ['NETCLAW_SETUP_CERT_PYTHON']
        with tempfile.TemporaryDirectory() as temp:
            context,deploy,effect,harness,calls=self.fixture(Path(temp).resolve(),actual_python=python)
            self.assertEqual(install(effect,context,deploy,harness),{'state':'verified'})
            self.assertEqual(observe(effect,context,deploy,harness),'completed')
            output=deploy.root/'refused-output'
            with output.open('wb') as stream:
                result=subprocess.run([python,str(deploy.source/'scripts/setup-certificates.py'),'generate-private','--record',str(deploy.root/'.setup/certificate-input.json')],stdout=stream,stderr=subprocess.PIPE,timeout=20)
            self.assertEqual(result.returncode,8);self.assertEqual(output.read_bytes(),b'');self.assertEqual(result.stderr,b'')

if __name__=='__main__':unittest.main()
