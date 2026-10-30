"""Exact account/direction review, immutable attempts and no implicit replay."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_live import LiveVerification
from setup_process import WriterUncertain
import test_setup_live as fixtures


class ChannelConsentTests(unittest.TestCase):
    def setUp(self):
        binding=patch('setup_comms_evidence.configuration_binding',return_value=['a'*64,'b'*64])
        binding.start();self.addCleanup(binding.stop)
    def fixture(self):
        context=fixtures.LiveTests().context();claw=context['plan']['claws'][0]
        claw['channels']=[{'id':'slack','settingKeys':[]}]
        context['plan']['verification']['channelTests']=[{'owner':claw['id'],'channel':'slack','destinationRef':'native-test'}]
        calls=[]
        class Harness:
            def command(self):return ['owned']
            def call(self,*a,**k):calls.append(a);return {'returncode':0,'stdout':b'{}'}
        probes=fixtures.Probe();probes.harness=Harness();probes.credentials=lambda:{};probes.effect={}
        return context,claw,probes,calls

    def test_unknown_requires_new_review_and_preserves_prior_attempt_identity(self):
        context,claw,probes,calls=self.fixture();session=fixtures.Session()
        with self.assertRaises(WriterUncertain):LiveVerification(session,probes,context).channels(claw,context)
        key=claw['id']+':5:slack:native-test';first=dict(context['journal']['liveAttempts'][key])
        self.assertEqual('outbound',session.bindings[0]['details']['direction'])
        self.assertEqual('default',session.bindings[0]['details']['sender']['account'])
        denied=fixtures.Session(False);LiveVerification(denied,probes,context).channels(claw,context)
        self.assertEqual(1,len(calls));self.assertEqual(first,context['journal']['liveAttempts'][key])
        second=fixtures.Session()
        with self.assertRaises(WriterUncertain):LiveVerification(second,probes,context).channels(claw,context)
        self.assertEqual('unknown',second.bindings[0]['previousOutcome'])
        self.assertEqual([first],context['journal']['liveAttemptHistory'][key])
        self.assertNotEqual(first['attemptId'],context['journal']['liveAttempts'][key]['attemptId'])
        self.assertNotIn('C0123456789',str(context['journal']))

    def test_configuration_change_during_native_review_does_not_send(self):
        context,claw,probes,calls=self.fixture()
        with patch('setup_comms_evidence.configuration_binding',side_effect=[['a'*64,'b'*64],['a'*64,'b'*64],['c'*64,'b'*64],None]):
            result=LiveVerification(fixtures.Session(),probes,context).channels(claw,context)
        self.assertEqual('unverified',result['state']);self.assertEqual([],calls)
        self.assertFalse(context['journal'].get('liveAttempts'))

    def test_inbound_never_converts_to_send_or_opens_provider_connection(self):
        context,claw,probes,calls=self.fixture();context['plan']['verification']['channelTests'][0]['direction']='inbound'
        session=fixtures.Session();result=LiveVerification(session,probes,context).channels(claw,context)
        self.assertEqual('unverified',result['state']);self.assertEqual([],calls);self.assertEqual([],session.bindings)


if __name__=='__main__':unittest.main()
