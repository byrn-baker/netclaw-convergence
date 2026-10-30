"""Subprocess contracts for existing communication tools; no live provider use."""
import json
import os
from pathlib import Path
import select
import subprocess
import tempfile
import time
import unittest

ROOT=Path(__file__).resolve().parents[1]
SERVER=ROOT/'mcp-servers/twilio-env-mcp/server.mjs'


@unittest.skipUnless(os.environ.get('NETCLAW_TEST_NODE'),'isolated supported Node runtime required')
class TwilioLauncherTests(unittest.TestCase):
    def setUp(self):self.node=os.environ['NETCLAW_TEST_NODE']

    def test_missing_credentials_and_argument_injection_are_closed_and_redacted(self):
        for args,values in [([],{}),(['private-argv-canary'],{'TWILIO_API_SECRET':'private-env-canary'})]:
            result=subprocess.run([self.node,str(SERVER),*args],env={'PATH':os.defpath,**values},
                capture_output=True,timeout=10)
            self.assertEqual(8,result.returncode)
            self.assertNotIn(b'private-',result.stdout+result.stderr)

    def test_actual_stdio_discovery_keeps_secrets_out_of_argv_and_never_connects(self):
        with tempfile.TemporaryDirectory() as tmp:
            guard=Path(tmp)/'deny-network.mjs'
            guard.write_text("import net from 'node:net';net.Socket.prototype.connect=function(){throw Error('network refused during installer discovery')};\n")
            secret='private-env-canary-0123456789abcdef'
            env={'PATH':os.defpath,'HOME':tmp,'TWILIO_ACCOUNT_SID':'AC'+'a'*32,
                 'TWILIO_API_KEY_SID':'SK'+'b'*32,'TWILIO_API_SECRET':secret}
            with open(Path(tmp)/'stderr.log','wb') as log:
                child=subprocess.Popen([self.node,'--import',str(guard),str(SERVER)],cwd=tmp,env=env,
                    stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log,bufsize=0)
                def send(value):child.stdin.write((json.dumps(value)+'\n').encode());child.stdin.flush()
                def receive(identifier):
                    end=time.monotonic()+15
                    while time.monotonic()<end:
                        if select.select([child.stdout],[],[],0.1)[0]:
                            raw=child.stdout.readline()
                            if not raw:break
                            value=json.loads(raw)
                            if value.get('id')==identifier:return value
                    self.fail('MCP did not respond')
                try:
                    argv=subprocess.check_output(['/bin/ps','-p',str(child.pid),'-o','command='])
                    self.assertNotIn(secret.encode(),argv);self.assertNotIn(env['TWILIO_API_KEY_SID'].encode(),argv)
                    send({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05',
                        'capabilities':{},'clientInfo':{'name':'installer-contract','version':'1'}}})
                    self.assertIn('result',receive(1))
                    send({'jsonrpc':'2.0','method':'notifications/initialized'})
                    send({'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}})
                    result=receive(2);tools=result['result']['tools']
                    self.assertTrue(tools)
                    self.assertTrue(all('call' in t['name'].lower() or 'message' in t['name'].lower() for t in tools))
                    self.assertNotIn(secret,json.dumps(result))
                finally:
                    child.stdin.close()
                    try:child.wait(timeout=5)
                    except subprocess.TimeoutExpired:child.terminate();child.wait(timeout=5)
                    child.stdout.close()
            output=(Path(tmp)/'stderr.log').read_bytes()
            self.assertNotIn(secret.encode(),output)
            self.assertNotIn(b'network refused',output)


if __name__=='__main__':unittest.main()
