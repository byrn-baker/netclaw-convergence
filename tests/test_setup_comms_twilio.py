"""Twilio callback contracts run locally with the real SDK and fake identities."""
import os
from pathlib import Path
import subprocess
import sys
import json
import tempfile
import threading
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))


class TwilioInstallerReceiptTests(unittest.TestCase):
    def fixture(self):
        from test_setup_plan import sample_plan
        from setup_deploy import Deployment
        from setup_schema import canonical
        from setup_secrets import _dotenv
        from test_setup_live import Session
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        plan=sample_plan(str(Path(temp.name).resolve()));claw=plan['claws'][0]
        claw.update(harness='hermes',runtimeVersion='0.21.6',workspace=claw['runtimeHome'])
        claw['channels']=[{'id':'sms','settingKeys':[]}]
        plan['verification']['channelTests']=[{'owner':claw['id'],'channel':'sms','destinationRef':'native-test'}]
        effects=[];context={'plan':plan,'runId':'receipt-fixture','planHash':'a'*64,'journal':{'effects':effects},
            'pause':threading.Event(),'save':lambda:None}
        context['artifactIntent']=lambda key,rows:next(e for e in effects if e['id']==key)['artifacts'].extend(rows)
        def effect(phase):
            value={'id':claw['id']+':'+phase,'owner':claw['id'],'phase':phase,'state':'verified','artifacts':[]}
            effects.append(value);return value
        deploy=Deployment(ROOT,claw,context);deploy.home(effect('home'))
        values={'TWILIO_ACCOUNT_SID':'AC'+'a'*32,'TWILIO_AUTH_TOKEN':'private-auth-token-canary',
            'TWILIO_PHONE_NUMBER':'+15551234567','SMS_WEBHOOK_URL':'https://installer.example.invalid/webhooks/twilio'}
        deploy.write(effect('credentials'),deploy.root/'.env', ''.join(k+'='+_dotenv.quote(v)+'\n' for k,v in values.items()).encode(),kind='credentials')
        deploy.write(effect('onboard'),deploy.root/'config.yaml',canonical({'platforms':{'sms':{'enabled':True}}}),kind='configuration')
        verification=effect('verification');calls=[]
        class Harness:
            def command(self):return ['owned-hermes']
            def call(self,selected,args,**kwargs):
                calls.append(args);return {'returncode':0,'stdout':json.dumps({'success':True,'message_id':'SM'+'b'*32}).encode()}
        probe=SimpleNamespace(claw=claw,home=deploy.root,deploy=deploy,context=context,harness=Harness(),effect=verification,
            credentials=lambda:dict(values))
        class SmsSession(Session):
            def destination(self,binding):return '+15557654321'
        return context,claw,probe,SmsSession(),calls,values

    def test_exact_reviewed_native_submission_is_separate_from_authenticated_delivery(self):
        from setup_live import LiveVerification
        from setup_comms_twilio import read_recorded_receipt,latest_recorded_evidence
        context,claw,probe,session,calls,values=self.fixture();requests=[]
        payload={'account_sid':values['TWILIO_ACCOUNT_SID'],'from':values['TWILIO_PHONE_NUMBER'],'to':'+15557654321',
            'sid':'SM'+'b'*32,'status':'delivered','direction':'outbound-api','body':'private-provider-body-canary'}
        class Response:
            status=200
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):return json.dumps(payload).encode()
        class Http:
            def open(self,request,**kwargs):requests.append(request);return Response()
        with patch('urllib.request.build_opener',return_value=Http()):
            result=LiveVerification(session,probe,context).channels(claw,context)
        self.assertEqual('verified',result['state']);self.assertEqual(1,len(calls));self.assertEqual(1,len(requests))
        self.assertEqual('GET',requests[0].method)
        self.assertTrue(requests[0].full_url.endswith('/Messages/SM'+'b'*32+'.json'))
        self.assertEqual(values['TWILIO_PHONE_NUMBER'],session.bindings[0]['details']['smsSender'])
        self.assertEqual(values['TWILIO_ACCOUNT_SID'],session.bindings[0]['details']['smsAccount'])
        evidence=latest_recorded_evidence(probe,context,claw)
        self.assertEqual('submission_accepted',evidence['submission']['code'])
        self.assertEqual('delivery_verified',evidence['delivery']['code'])
        key=claw['id']+':5:sms:native-test';path,_,envelope=read_recorded_receipt(probe,context,claw,key)
        self.assertEqual(0o600,path.stat().st_mode&0o777)
        self.assertNotIn(values['TWILIO_AUTH_TOKEN'],path.read_text())
        self.assertNotIn('private-provider-body-canary',path.read_text())
        journal=json.dumps(context['journal'])
        for private in (values['TWILIO_AUTH_TOKEN'],values['TWILIO_ACCOUNT_SID'],values['TWILIO_PHONE_NUMBER'],'+15557654321','SM'+'b'*32):
            self.assertNotIn(private,journal)
        # A later unknown attempt must never inherit an earlier receipt.
        context['journal']['liveAttempts'][key]={'tier':5,'state':'unknown','attemptId':'c'*32,'scopeHash':'d'*64,
            'configurationBinding':envelope['configurationBinding'],'sequence':2,'startedAt':1}
        self.assertIsNone(latest_recorded_evidence(probe,context,claw))

    def test_unavailable_lookup_preserves_submission_and_foreign_lookup_is_refused(self):
        from setup_comms_twilio import submission_receipt,authenticated_lookup_receipt,receipt_evidence
        from setup_schema import Invalid
        response={'account_sid':'AC'+'a'*32,'from':'+15551234567','to':'+15557654321','sid':'SM'+'b'*32,'status':'queued'}
        receipt=submission_receipt(response['account_sid'],response['from'],response['to'],'https://example.invalid/status',response)
        for changed in [{**response,'account_sid':'AC'+'c'*32},{**response,'sid':'SM'+'d'*32},{**response,'to':'+15550000000'}]:
            with self.assertRaises(Invalid):authenticated_lookup_receipt(receipt,changed)
        sent=authenticated_lookup_receipt(receipt,{**response,'status':'sent'})
        self.assertEqual('unverified',receipt_evidence(sent)['delivery']['state'])
        delivered=authenticated_lookup_receipt(sent,{**response,'status':'delivered'})
        self.assertEqual('verified',receipt_evidence(delivered)['delivery']['state'])
        self.assertEqual('delivered',authenticated_lookup_receipt(delivered,{**response,'status':'queued'})['status'])
        self.assertEqual('unknown',receipt_evidence(authenticated_lookup_receipt(delivered,{**response,'status':'failed'}))['delivery']['state'])


@unittest.skipUnless(os.environ.get('NETCLAW_TEST_HERMES_PYTHON'),'isolated pinned Hermes environment required')
class HermesSmsNativeContract(unittest.TestCase):
    def test_actual_selected_standalone_sender_uses_one_exact_request_without_listener(self):
        code=r'''
import asyncio,sys,os,json,socket
from pathlib import Path
source=Path(sys.executable).parents[2]/'source'
sys.path.insert(0,str(source))
def no_network(*args,**kwargs):raise AssertionError('network/listener attempted')
socket.socket.connect=no_network;socket.socket.bind=no_network
from hermes_cli.plugins_discovery import suppress_plugin_discovery
with suppress_plugin_discovery():
 from hermes_cli.plugins import PluginManager
 from hermes_cli.plugins_manifest import parse_manifest_file
 from gateway.platform_registry import platform_registry
 from gateway.config import PlatformConfig
 directory=source/'plugins/platforms/sms'
 manifest=parse_manifest_file(directory/'plugin.yaml',directory,'bundled','platforms')
 manager=PluginManager(scope_key=os.environ['HERMES_HOME']);manager._load_plugin(manifest)
 entry=platform_registry.get('sms');sender=entry.standalone_sender_fn
 assert entry and sender
 calls=[]
 class Response:
  status=201
  async def __aenter__(self):return self
  async def __aexit__(self,*args):pass
  async def json(self):return {'sid':'SM'+'b'*32}
 class Session:
  async def __aenter__(self):return self
  async def __aexit__(self,*args):pass
  def post(self,url,*,data,headers,**kwargs):
   assert url=='https://api.twilio.com/2010-04-01/Accounts/'+os.environ['TWILIO_ACCOUNT_SID']+'/Messages.json'
   fields={row[0]['name']:row[2] for row in data._fields}
   assert fields=={'From':'+15551234567','To':'+15557654321','Body':'NetClaw isolated installer fixture'}
   assert headers['Authorization'].startswith('Basic ')
   calls.append(url);return Response()
 sender.__globals__['_new_session']=lambda **kwargs:Session()
 result=asyncio.run(sender(PlatformConfig.from_dict({'enabled':True}),' +15557654321'.strip(),'NetClaw isolated installer fixture'))
 assert result=={'success':True,'platform':'sms','chat_id':'+15557654321','message_id':'SM'+'b'*32},result
 assert len(calls)==1
 print('native SMS request contract passed; fixture HTTP only')
'''
        with tempfile.TemporaryDirectory() as tmp:
            env={'PATH':os.defpath,'HOME':tmp,'HERMES_HOME':tmp,'PYTHONNOUSERSITE':'1',
                'TWILIO_ACCOUNT_SID':'AC'+'a'*32,'TWILIO_AUTH_TOKEN':'fixture-token', 'TWILIO_PHONE_NUMBER':'+15551234567'}
            result=subprocess.run([os.environ['NETCLAW_TEST_HERMES_PYTHON'],'-c',code],cwd=tmp,env=env,capture_output=True,timeout=45)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        self.assertIn(b'native SMS request contract passed',result.stdout)


@unittest.skipUnless(os.environ.get('NETCLAW_TEST_VOICE_PYTHON'),'isolated Twilio SDK environment required')
class TwilioReceiptTests(unittest.TestCase):
    def test_real_sdk_signatures_scope_replay_and_delivery_are_independent(self):
        code=r'''
import sys,json,copy,socket,time
sys.path.insert(0,sys.argv[1])
from setup_comms_twilio import submission_receipt,callback_receipt,receipt_evidence
from setup_schema import Invalid
from twilio.request_validator import RequestValidator
def no_network(*a,**k):raise AssertionError('network attempted')
socket.socket.connect=no_network;socket.socket.bind=no_network
token='fake-local-auth-token-0123456789ab';account='AC'+'a'*32;sid='SM'+'b'*32
response={'account_sid':account,'from':'+15551234567','to':'+15557654321','sid':sid,'status':'queued'}
receipt=submission_receipt(account,response['from'],response['to'],'https://installer.example.invalid/status',response)
assert receipt_evidence(receipt)['submission']['state']=='verified'
assert receipt_evidence(receipt)['delivery']['state']=='unverified'
signer=RequestValidator(token)
def callback(current,status,**extra):
 data={'AccountSid':account,'MessageSid':sid,'MessageStatus':status,**extra}
 return callback_receipt(current,data,signer.compute_signature(current['callbackUrl'],data),token)
sent=callback(receipt,'sent',NewProviderField='included-in-signature')
assert receipt_evidence(sent)['delivery']['state']=='unverified'
delivered=callback(sent,'delivered');assert receipt_evidence(delivered)['delivery']['state']=='verified'
assert callback(delivered,'delivered')==delivered
late=callback(delivered,'queued');assert late['status']=='delivered'
conflict=callback(late,'undelivered');assert receipt_evidence(conflict)['delivery']['state']=='unknown'
assert receipt_evidence(callback(conflict,'delivered'))['delivery']['state']=='unknown'
failed=callback(receipt,'failed');assert receipt_evidence(failed)['delivery']['state']=='failed'
for changes,signature in [({},'bad-signature'),({'MessageSid':'SM'+'c'*32},None),({'AccountSid':'AC'+'c'*32},None),
 ({'From':'+15550000000'},None),({'To':'+15550000000'},None),({'MessageStatus':['sent','delivered']},None)]:
 data={'AccountSid':account,'MessageSid':sid,'MessageStatus':'delivered',**changes}
 if isinstance(data['MessageStatus'],list):
  from setup_comms_twilio import _Form
  data=_Form(data)
 signed=signature or signer.compute_signature(receipt['callbackUrl'],data)
 before=copy.deepcopy(receipt)
 try:callback_receipt(receipt,data,signed,token)
 except Invalid:pass
 else:raise AssertionError('forged, ambiguous or foreign callback accepted')
 assert receipt==before
# The configured external URL is authoritative, not a reverse proxy's local URL.
data={'AccountSid':account,'MessageSid':sid,'MessageStatus':'delivered'}
try:callback_receipt(receipt,data,signer.compute_signature('http://127.0.0.1/status',data),token)
except Invalid:pass
else:raise AssertionError('different URL signature accepted')
for changed in [{**response,'account_sid':'AC'+'c'*32},{**response,'to':'+15550000000'},{**response,'sid':''}]:
 try:submission_receipt(account,response['from'],response['to'],receipt['callbackUrl'],changed)
 except Invalid:pass
 else:raise AssertionError('foreign submission accepted')
evidence=json.dumps(receipt_evidence(delivered))
assert all(private not in evidence for private in [token,account,sid,response['from'],response['to'],receipt['callbackUrl']])
print('Twilio SDK callback contracts passed; no provider calls or messages')
'''
        result=subprocess.run([os.environ['NETCLAW_TEST_VOICE_PYTHON'],'-c',code,str(ROOT/'scripts/lib')],
            env={'PATH':os.defpath,'PYTHONNOUSERSITE':'1'},capture_output=True,timeout=30)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        self.assertIn(b'Twilio SDK callback contracts passed',result.stdout)


if __name__=='__main__':unittest.main()
