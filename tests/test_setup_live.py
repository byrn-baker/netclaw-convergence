from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_live import LiveVerification
from setup_engine import ReviewAuthority,ReviewRefused
from test_setup_plan import sample_plan

class Session:
    def __init__(self,approve=True):self.bindings=[];self.approve=approve
    def review_action(self,binding,action):
        self.bindings.append(binding)
        if not self.approve:raise ReviewRefused('declined')
        return ReviewAuthority('native-fixture').approve(binding,action)
    def destination(self,binding):return 'C0123456789'

class Probe:
    identity='00000000-0000-0000-0000-000000000001'
    def running(self):return {'state':'verified'}

class LiveTests(unittest.TestCase):
    def setUp(self):
        binding=patch('setup_comms_evidence.configuration_binding',return_value=['a'*64,'b'*64])
        binding.start();self.addCleanup(binding.stop)
    def context(self):return {'runId':'run-fixture','planHash':'a'*64,'plan':sample_plan(),'journal':{},'pause':threading.Event(),'save':lambda:None}
    def test_flags_and_native_refusal_never_invoke_provider(self):
        for enabled,session in [(False,Session()),(True,None),(True,Session(False))]:
            context=self.context();context['plan']['verification']['costConsent']=enabled
            with patch('setup_live.HudProbe') as http:
                result=LiveVerification(session,Probe(),context).verify(4,context['plan']['claws'][0],context)
                self.assertEqual(result['state'],'unverified');http.assert_not_called()
                self.assertFalse(context['journal'].get('liveAttempts'))

    def test_unsettled_native_probe_propagates_instead_of_advancing_verification(self):
        from setup_process import WriterUncertain
        context=self.context();context['plan']['verification']['costConsent']=True
        class Uncertain(Probe):
            def running(self):raise WriterUncertain()
        with self.assertRaises(WriterUncertain):
            LiveVerification(Session(),Uncertain(),context).verify(4,context['plan']['claws'][0],context)

    def test_exact_turn_journal_before_submit_and_unknown_never_silently_replayed(self):
        context=self.context();context['plan']['verification']['costConsent']=True;claw=context['plan']['claws'][0];session=Session()
        class Http:
            def __init__(self,*args):self.cookies=[1]
            def request(self,route,body=None,**kwargs):
                if route=='/api/runtime':return {'kind':'openclaw','installationId':Probe.identity}
                if route=='/api/chat':
                    assert context['journal']['liveAttempts'][claw['id']+':4']['state']=='unknown'
                    return {'fromGateway':True,'response':body['message'].split()[-1]}
                return {}
        with patch('setup_live.HudProbe',Http):
            self.assertEqual(LiveVerification(session,Probe(),context).verify(4,claw,context)['state'],'verified')
            context['journal']['liveAttempts'][claw['id']+':4']['state']='unknown'
            declined=Session(False)
            self.assertEqual(LiveVerification(declined,Probe(),context).verify(4,claw,context)['state'],'unverified')
            self.assertEqual(declined.bindings[0]['previousOutcome'],'unknown')
        self.assertNotIn('NETCLAW_SETUP_',str(context['journal']))

    def test_model_timeout_preserves_unknown_and_stops_later_work(self):
        from setup_process import WriterUncertain
        context=self.context();context['plan']['verification']['costConsent']=True;claw=context['plan']['claws'][0]
        class Http:
            def __init__(self,*args):self.cookies=[1]
            def request(self,route,body=None,**kwargs):
                if route=='/api/runtime':return {'kind':'openclaw','installationId':Probe.identity}
                if route=='/api/chat':raise TimeoutError()
                return {}
        with patch('setup_live.HudProbe',Http),self.assertRaises(WriterUncertain):
            LiveVerification(Session(),Probe(),context).verify(4,claw,context)
        self.assertEqual(context['journal']['liveAttempts'][claw['id']+':4']['state'],'unknown')

    def test_channel_each_message_requires_review_and_receipt_without_private_export(self):
        context=self.context();claw=context['plan']['claws'][0];claw['channels']=[{'id':'slack','settingKeys':[]}]
        context['plan']['verification']['channelTests']=[{'owner':claw['id'],'channel':'slack','destinationRef':name} for name in ('one','two')]
        calls=[];session=Session()
        class Harness:
            def command(self):return ['/private/owned/openclaw']
            def call(self,effect,args,**kwargs):
                assert len(session.bindings)==len(calls)+1
                assert session.bindings[-1]['details']['destination']=='C0123456789'
                assert context['journal']['liveAttempts'][claw['id']+':5:slack:'+('one' if not calls else 'two')]['state']=='unknown'
                calls.append(args)
                return {'returncode':0,'stdout':b'{"action":"send","channel":"slack","dryRun":false,"messageId":"private-receipt"}'}
        probe=Probe();probe.harness=Harness();probe.effect={};probe.credentials=lambda:{}
        self.assertEqual(LiveVerification(session,probe,context).verify(5,claw,context)['state'],'verified')
        self.assertEqual(len(calls),2)
        self.assertNotIn('C0123456789',str(context['journal']));self.assertNotIn('private-receipt',str(context['journal']))
        calls.clear()
        self.assertEqual(LiveVerification(Session(False),probe,context).verify(5,claw,context)['state'],'unverified')
        self.assertEqual(calls,[])

    def test_missing_channel_receipt_prevents_second_message(self):
        from setup_process import WriterUncertain
        context=self.context();claw=context['plan']['claws'][0];claw['channels']=[{'id':'slack','settingKeys':[]}]
        context['plan']['verification']['channelTests']=[{'owner':claw['id'],'channel':'slack','destinationRef':n} for n in ('one','two')]
        calls=[]
        class Harness:
            def command(self):return ['owned']
            def call(self,*args,**kwargs):calls.append(args);return {'returncode':0,'stdout':b'{"dryRun":true}'}
        probe=Probe();probe.harness=Harness();probe.effect={};probe.credentials=lambda:{}
        with self.assertRaises(WriterUncertain):LiveVerification(Session(),probe,context).verify(5,claw,context)
        self.assertEqual(len(calls),1)

    def test_channel_contract_rejects_default_fanout_and_false_success(self):
        from setup_channels import valid_destination,arguments,delivered
        for value in ('','slack','@everyone','C0123456789,C1111111111','https://host/','C0123456789\n','--all','../../file'):
            self.assertFalse(valid_destination('slack',value))
        self.assertEqual(arguments('hermes','slack','C0123456789','test'),['send','--to','slack:C0123456789','--json','test'])
        self.assertFalse(delivered('hermes','slack',{'success':True,'skipped':True}))
        self.assertFalse(delivered('openclaw','slack',{'action':'send','channel':'slack','dryRun':True,'messageId':'x'}))
        self.assertFalse(delivered('hermes','slack',{'success':True}))
        self.assertTrue(delivered('hermes','slack',{'success':True,'message_id':'12345.12'}))
        self.assertFalse(delivered('hermes','slack',{'success':True,'message_id':True}))

if __name__=='__main__':unittest.main()
