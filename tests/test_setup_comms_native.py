"""Real native registry probes through managed Comms launchers.

These fixtures borrow qualified test interpreters through owned shell shims;
they test native registration/environment/discovery, not runtime acquisition.
Only placeholder credentials are used, and server network/listener calls fail.
"""
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
from setup_secrets import child_environment,_dotenv

REQUIRED=('NETCLAW_TEST_NODE','NETCLAW_TEST_ZOOM_PYTHON','NETCLAW_TEST_HERMES_PYTHON','NETCLAW_TEST_OPENCLAW')


@unittest.skipUnless(all(os.environ.get(k) for k in REQUIRED),'qualified native runtimes required')
class NativeCommsTests(unittest.TestCase):
    def test_both_native_registries_probe_inert_zoom_and_private_twilio(self):
        for harness in ('openclaw','hermes'):
            with self.subTest(harness=harness),tempfile.TemporaryDirectory(prefix='netclaw-comms-native-') as tmp:
                home=Path(tmp).resolve()/'claw';home.mkdir(mode=0o700)
                source=home/'.setup/source'
                def write(relative,value):
                    p=home/relative;p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                    p.write_text(value);p.chmod(0o600);return p
                for relative in ('.setup/os-home','.setup/tmp','.setup/cache','workspace'):
                    (home/relative).mkdir(parents=True,exist_ok=True,mode=0o700)
                shutil.copytree(ROOT/'scripts/lib',source/'scripts/lib',ignore=shutil.ignore_patterns('__pycache__'))
                for name in ('setup-comms-launch.py','setup-hermes-discovery.py','setup-openclaw-comms-discovery.py','write-env.py'):
                    shutil.copy2(ROOT/'scripts'/name,source/'scripts'/name)
                for name in ('installer-access.json','components/catalog.json'):
                    write('.setup/source/config/'+name,(ROOT/'config'/name).read_text())
                for name in ('zoom-rtms-mcp','twilio-env-mcp'):
                    shutil.copytree(ROOT/'mcp-servers'/name,source/'mcp-servers'/name,
                        ignore=shutil.ignore_patterns('.venv','__pycache__','*.log'))
                # Guard the actual server processes, not just the probing parent.
                zoom=source/'mcp-servers/zoom-rtms-mcp/server.py'
                zoom.write_text("import sys\nsys.addaudithook(lambda event,args: (_ for _ in ()).throw(RuntimeError('network refused')) if event in ('socket.bind','socket.connect') else None)\n"+zoom.read_text())
                twilio=source/'mcp-servers/twilio-env-mcp/server.mjs'
                twilio.write_text(twilio.read_text().replace('#!/usr/bin/env node\n','')+
                    '\n')
                twilio.write_text("import net from 'node:net'; net.Socket.prototype.connect=function(){throw Error('network refused')};\n"+twilio.read_text())
                write('.netclaw-setup-owner.json',json.dumps({'runId':'fixture','installationId':'fixture'}))
                write('netclaw-components.conf','twilio\nzoom-rtms\n')
                python=Path(os.environ['NETCLAW_TEST_ZOOM_PYTHON'])
                shim=write('python-fixture/bin/python',"#!/bin/sh\nexec '"+str(python)+"' \"$@\"\n");shim.chmod(0o700)
                write('python-runtimes/records/zoom-rtms',str(shim))
                node=os.environ['NETCLAW_TEST_NODE'];write('.setup/comms-node.json',json.dumps({'command':node}))
                values={'NETCLAW_RUNTIME':harness,'NETCLAW_RUNTIME_ENV':str(home/'.env'),
                    'TWILIO_ACCOUNT_SID':'AC'+'a'*32,'TWILIO_API_KEY_SID':'SK'+'b'*32,
                    'TWILIO_API_SECRET':'fake-private-installer-key','FASTMCP_CHECK_FOR_UPDATES':'off'}
                write('.env',''.join(k+'='+_dotenv.quote(v)+'\n' for k,v in values.items()))
                entries={name:{'command':str(shim),'args':['-u',str(source/'scripts/setup-comms-launch.py'),name],
                    'cwd':str(source),'env':{'NETCLAW_RUNTIME_ENV':str(home/'.env')}} for name in ('twilio-mcp','zoom-rtms-mcp')}
                config={'mcp_servers':entries} if harness=='hermes' else {'mcp':{'servers':entries},'gateway':{'mode':'local'}}
                config_file=write('config.yaml' if harness=='hermes' else 'openclaw.json',json.dumps(config))
                before=config_file.read_bytes();env_before=(home/'.env').read_bytes()
                env=child_environment(home,harness,tool_directories=[Path(node).parent])
                if harness=='openclaw':
                    cli=home/'.setup/prefix/bin/openclaw';cli.parent.mkdir(parents=True,exist_ok=True)
                    cli.symlink_to(os.environ['NETCLAW_TEST_OPENCLAW'])
                    commands=[([str(shim),str(source/'scripts/setup-openclaw-comms-discovery.py')],'zoom'),
                        ([str(cli),'mcp','probe','twilio-mcp','--json'],'twilio')]
                else:
                    commands=[([os.environ['NETCLAW_TEST_HERMES_PYTHON'],str(source/'scripts/setup-hermes-discovery.py'),component],component)
                        for component in ('zoom-rtms','twilio')]
                for command,label in commands:
                    result=subprocess.run(command,cwd=home,env=env,capture_output=True,timeout=110)
                    self.assertEqual(0,result.returncode,(harness,label,result.stderr.decode()[-3000:],result.stdout.decode()[-1000:]))
                    reply=json.loads(result.stdout)
                    if harness=='hermes':self.assertEqual({'state':'verified','code':'discovery_verified'},reply)
                    else:
                        name='zoom-rtms-mcp' if label=='zoom' else 'twilio-mcp'
                        self.assertGreater(reply['servers'][name]['tools'],0)
                    self.assertNotIn(values['TWILIO_API_SECRET'].encode(),result.stdout+result.stderr)
                self.assertEqual(before,config_file.read_bytes());self.assertEqual(env_before,(home/'.env').read_bytes())


if __name__=='__main__':unittest.main()
