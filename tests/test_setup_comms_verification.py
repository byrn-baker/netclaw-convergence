"""No private provider data or inferred live success in Comms reports."""
import copy
import json
from pathlib import Path
import sys
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_report import project,comms_observation,COMMS_DIMENSIONS
from setup_comms_evidence import observe
from setup_comms import channel_test_choices,set_channel_tests
from test_setup_plan import sample_plan


class CommsEvidenceTests(unittest.TestCase):
    def test_cleanup_invalidates_current_comms_readiness_without_rewriting_history(self):
        from setup_report import invalidate_for_cleanup
        report={'comms':[{'channel':'slack',**{d:comms_observation('verified','configuration_valid',observed_at=int(time.time())) for d in COMMS_DIMENSIONS}}]}
        history=copy.deepcopy(report);invalidate_for_cleanup(report)
        self.assertTrue(all(report['comms'][0][d]['state']=='unverified' for d in COMMS_DIMENSIONS))
        self.assertTrue(all(history['comms'][0][d]['state']=='verified' for d in COMMS_DIMENSIONS))

    def test_test_request_drafts_preserve_imported_directions_and_destination_references(self):
        manifest=json.loads((ROOT/'config/components/comms.json').read_text())
        plan=sample_plan();claw=plan['claws'][0];claw['channels']=[{'id':'slack'},{'id':'discord'}]
        legacy={'owner':claw['id'],'channel':'slack','destinationRef':'retained-destination'}
        inbound={'owner':claw['id'],'channel':'slack','direction':'inbound','destinationRef':'retained-inbound'}
        plan['verification']['channelTests']=[legacy,inbound]
        choices=channel_test_choices(plan,manifest)
        self.assertEqual([claw['id']+'/slack/outbound',claw['id']+'/discord/outbound'],[c['key'] for c in choices])
        chosen=set_channel_tests(plan,[c['key'] for c in choices],manifest)
        self.assertEqual([legacy,inbound,{'owner':claw['id'],'channel':'discord','direction':'outbound','destinationRef':'native-test'}],chosen['verification']['channelTests'])
        self.assertEqual([legacy,inbound],plan['verification']['channelTests'])
        self.assertEqual([inbound],set_channel_tests(plan,[],manifest)['verification']['channelTests'])
        with self.assertRaises(ValueError):set_channel_tests(plan,[claw['id']+'/slack/inbound'],manifest)

    def test_public_and_detailed_exports_structurally_exclude_private_provider_evidence(self):
        catalog=json.loads((ROOT/'config/components/catalog.json').read_text())
        channel={'channel':'slack','account':'private-account','destination':'private-destination','raw':'secret-token'}
        for dimension in COMMS_DIMENSIONS:
            channel[dimension]={'state':'verified','code':'configuration_valid','checker':'openclaw-config',
                'observedAt':int(time.time()),'receipt':'private-provider-receipt','evidencePath':'/private/credential-file'}
        raw={'installations':[{'harness':'openclaw','comms':[channel,{'channel':'private-new-channel'},copy.deepcopy(channel)]}]}
        for detailed in (False,True):
            projected=project(raw,catalog,detailed=detailed);serialized=json.dumps(projected)
            self.assertNotIn('private-',serialized);self.assertNotIn('secret-token',serialized)
            self.assertEqual(1,len(projected['installations'][0]['comms']))
            observed=projected['installations'][0]['comms'][0]
            self.assertEqual('account-1',observed['account'])
            self.assertTrue(all(d in observed for d in COMMS_DIMENSIONS))
            self.assertEqual('verified',observed['configuration']['state'])
            for dimension in ('authentication','transport','inbound','outbound'):
                self.assertEqual('unverified',observed[dimension]['state'])

    def test_unknown_states_checkers_times_and_codes_cannot_be_exported_as_evidence(self):
        row=comms_observation('private-state','private-code',checker='private-checker',observed_at=True)
        self.assertEqual({'state':'unverified','code':'effect_unsettled','checker':'netclaw-setup'},row)
        for stamp in [-1,0,99999999999999,'private-time']:
            self.assertNotIn('observedAt',comms_observation(observed_at=stamp))

    def test_configuration_does_not_imply_authentication_transport_or_message_checks(self):
        plan=sample_plan();claw=plan['claws'][0];claw['channels']=[{'id':'slack'}]
        plan['verification']['channelTests']=[{'owner':claw['id'],'channel':'slack','direction':'inbound','destinationRef':'test'}]
        probe=SimpleNamespace(claw=claw,context={'plan':plan,'journal':{}})
        with patch('setup_comms_evidence.configuration',return_value=comms_observation('verified','configuration_valid')):
            row=observe(probe)[0]
        self.assertEqual('verified',row['configuration']['state'])
        for dimension in ('authentication','transport','inbound'):self.assertEqual('unverified',row[dimension]['state'])
        self.assertEqual('unsupported',row['inbound']['code'])
        self.assertEqual({'state':'skipped','code':'not_requested','checker':'netclaw-setup'},row['outbound'])

    def test_submission_is_distinct_from_delivery_and_invalidated_by_configuration_change(self):
        from setup_comms_evidence import record_message_observation
        plan=sample_plan();claw=plan['claws'][0];claw['channels']=[{'id':'slack'}]
        plan['verification']['channelTests']=[{'owner':claw['id'],'channel':'slack','destinationRef':'test'}]
        context={'plan':plan,'journal':{},'save':lambda:None};probe=SimpleNamespace(claw=claw,context=context)
        with patch('setup_comms_evidence.configuration_binding',return_value=['a'*64,'b'*64]),patch(
            'setup_comms_evidence.configuration',return_value=comms_observation('verified','configuration_valid')):
            record_message_observation(probe,context,claw,'slack','outbound','verified','submission_accepted')
            row=observe(probe)[0];self.assertEqual('submission_accepted',row['outbound']['code'])
            self.assertEqual('verified',row['outbound']['state'])
        with patch('setup_comms_evidence.configuration_binding',return_value=['c'*64,'b'*64]),patch(
            'setup_comms_evidence.configuration',return_value=comms_observation('verified','configuration_valid')):
            self.assertEqual('unverified',observe(probe)[0]['outbound']['state'])

    def test_declining_a_later_request_cannot_erase_an_earlier_unknown_send(self):
        from setup_comms_evidence import record_message_observation
        plan=sample_plan();claw=plan['claws'][0];claw['channels']=[{'id':'slack'}]
        context={'plan':plan,'journal':{},'save':lambda:None};probe=SimpleNamespace(claw=claw,context=context)
        record_message_observation(probe,context,claw,'slack','outbound','unknown','attempt_unknown')
        record_message_observation(probe,context,claw,'slack','outbound','cancelled','cancelled')
        self.assertEqual('unknown',context['journal']['commsObservations'][claw['id']]['slack']['outbound']['observation']['state'])


if __name__=='__main__':unittest.main()
