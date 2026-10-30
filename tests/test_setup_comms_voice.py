"""Managed voice contracts; placeholders only, no models, calls or listeners."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get('NETCLAW_TEST_VOICE_PYTHON'),'isolated voice dependencies required')
class ManagedVoiceTests(unittest.TestCase):
    def test_owner_binding_fallback_and_context_isolation(self):
        code=r'''
import asyncio,json,os,pathlib,socket,uuid
from unittest.mock import patch
def deny(*args,**kwargs):raise AssertionError('unexpected network operation')
socket.socket.connect=deny;socket.socket.bind=deny
home=pathlib.Path(os.environ['HOME']).resolve()/'runtime';home.mkdir(mode=0o700)
(home/'netclaw-hud').mkdir(mode=0o700)
def write(path,value):
 path.write_text(json.dumps(value));path.chmod(0o600)
identity=str(uuid.uuid5(uuid.NAMESPACE_URL,'netclaw:test-run:test-claw'))
write(home/'.netclaw-setup-owner.json',{'runId':'test-run','installationId':'test-claw'})
write(home/'netclaw-hud/installation.json',{'installationId':identity})
write(home/'openclaw.json',{'gateway':{'port':25399,'auth':{'mode':'token','token':
 {'source':'env','provider':'default','id':'OPENCLAW_GATEWAY_TOKEN'}}}})
os.environ.update(NETCLAW_COMMS_MANAGED='1',NETCLAW_RUNTIME_ENV=str(home/'.env'),
 NETCLAW_INSTALLATION_ID=identity,NETCLAW_RUNTIME='openclaw',
 OPENCLAW_GATEWAY_URL='http://127.0.0.1:25399',OPENCLAW_GATEWAY_TOKEN='x'*40)
import managed,context_manager,webhook_server as voice
assert managed.gateway_binding()=={'url':'http://127.0.0.1:25399','token':'x'*40}
async def check():
 # An unsupported runtime refuses before context or HTTP. No Claude/basic
 # fallback is permitted even when unrelated provider credentials exist.
 os.environ['NETCLAW_RUNTIME']='hermes'
 with patch.object(voice.httpx,'AsyncClient',side_effect=AssertionError('unexpected client')):
  for fn in (voice.process_with_gateway,voice.process_with_claude_agent,
             voice.process_with_claude_fallback,voice.process_basic_command):
   assert await fn('placeholder')=='Voice routing is unavailable for this installation.'
 os.environ['NETCLAW_RUNTIME']='openclaw'
 for url in ('http://localhost:25399','http://127.0.0.1:25398','https://example.invalid'):
  os.environ['OPENCLAW_GATEWAY_URL']=url;assert managed.gateway_binding() is None
 os.environ['OPENCLAW_GATEWAY_URL']='http://127.0.0.1:25399'
 # A failed owned gateway does not attempt a second destination or model.
 calls=[]
 class Client:
  def __init__(self,**kwargs):pass
  async def __aenter__(self):return self
  async def __aexit__(self,*args):pass
  async def post(self,url,**kwargs):
   calls.append(url);raise RuntimeError('private-provider-diagnostic')
 with patch.object(voice.httpx,'AsyncClient',Client):
  assert await voice.process_with_gateway('placeholder')=='Voice routing is unavailable for this installation.'
 assert calls==['http://127.0.0.1:25399/v1/chat/completions']
 with patch.object(context_manager.httpx,'AsyncClient',side_effect=AssertionError('neighbor memory contacted')):
  cm=context_manager.ContextManager('http://127.0.0.1:8765')
  ctx=await cm.load_context('../private-caller');await cm.save_context(ctx)
  assert cm.memory_mcp_url is None
  target=cm._get_context_file(ctx.caller_id)
  assert target.parent==home/'voice/contexts' and not target.stat().st_mode&0o077
  assert len(target.stem)==64
  assert not (pathlib.Path(os.environ['HOME'])/'.openclaw').exists()
  os.environ['NETCLAW_INSTALLATION_ID']='other'
  assert managed.gateway_binding() is None
  try:context_manager.ContextManager()
  except ValueError:pass
  else:raise AssertionError('foreign identity accepted')
asyncio.run(check())
voice.executor.shutdown(wait=True)
'''
        with tempfile.TemporaryDirectory() as tmp:
            result=subprocess.run([os.environ['NETCLAW_TEST_VOICE_PYTHON'],'-c',code],
                cwd=ROOT/'mcp-servers/twilio-voice-mcp',env={'PATH':os.defpath,'HOME':tmp,'PYTHONNOUSERSITE':'1'},
                capture_output=True,timeout=20)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        self.assertNotIn(b'private-provider-diagnostic',result.stdout+result.stderr)


if __name__=='__main__':unittest.main()
