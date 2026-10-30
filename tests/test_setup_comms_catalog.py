"""Comms discovery is complete, inert and separate from implementation evidence."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/lib'))
from setup_schema import Invalid, validate
from setup_comms import CommsCatalog, check_catalog


class CommsCatalogTests(unittest.TestCase):
    def setUp(self):
        self.catalog = CommsCatalog(ROOT)
        self.inventory = json.loads((ROOT / 'specs/155-border-channel-setup/channel-inventory.json').read_text())

    def test_full_inventory_without_conflating_related_interfaces(self):
        for harness in ('openclaw', 'hermes'):
            expected = {e['canonicalId'] for e in self.inventory[harness]}
            actual = {e['channelId'] for e in self.catalog.entries if e['harness'] == harness and e['inventory'] == 'channel'}
            self.assertEqual(expected, actual)
        self.assertEqual(10, sum(e['inventory'] == 'related' for e in self.catalog.entries))
        self.assertEqual(6, sum(e['inventory'] == 'netclaw' for e in self.catalog.entries))

    def test_canonical_and_native_ids_remain_distinct(self):
        for harness, canonical, native in [('hermes', 'google-chat', 'google_chat'),
                ('hermes', 'wecom-callback', 'wecom_callback'),
                ('openclaw', 'wechat', 'openclaw-weixin'),
                ('openclaw', 'zaloclawbot', 'openclaw-zaloclawbot')]:
            self.assertEqual(native, self.catalog.channel(harness, canonical)['nativeId'])
        with self.assertRaises(Invalid): self.catalog.channel('hermes', 'google_chat')

    def test_pinned_absence_is_not_an_implementation_failure(self):
        for channel in ('a2a', 'buzz', 'reef', 'x'):
            e = self.catalog.channel('openclaw', channel)
            self.assertEqual('unavailable-baseline', e['setup']['disposition'])
        for channel in ('clickclack', 'wecom'):
            e = self.catalog.channel('openclaw', channel)
            self.assertEqual('present', e['baseline']['support'])
            self.assertNotEqual('unavailable-baseline', e['setup']['disposition'])

    def test_mixed_tool_role_and_comms_tools_preserve_border_limits(self):
        self.assertEqual(['focused'], self.catalog.channel('hermes', 'homeassistant')['roles'])
        for e in self.catalog.entries:
            if e['inventory'] == 'netclaw':
                self.assertEqual(['focused', 'member'], e['roles'])
                self.assertIn(e['component'], ('twilio', 'zoom-rtms'))
            elif e['inventory'] == 'channel': self.assertNotIn('member', e['roles'])

    def test_twilio_and_zoom_are_searchable_for_both_runtimes(self):
        for h in ('openclaw', 'hermes'):
            twilio = self.catalog.search('twilio', harness=h)
            self.assertTrue(any(e['channelId'] == 'sms' for e in twilio))
            self.assertTrue(any(e['component'] == 'twilio' for e in twilio))
            self.assertTrue(any(e['component'] == 'zoom-rtms' for e in self.catalog.search('zoom', harness=h)))
        self.assertTrue(self.catalog.search('Webex'))

    def test_schema_and_semantic_ambiguity_rejected(self):
        self.assertFalse(check_catalog(self.catalog.data, self.catalog.schema))
        for mutate in [lambda d: d['entries'].append(copy.deepcopy(d['entries'][0])),
                       lambda d: d['entries'][0].update(nativeId='bad\ncommand'),
                       lambda d: d['entries'][0].update(documentation='https://user:secret@example.com')]:
            changed = copy.deepcopy(self.catalog.data); mutate(changed)
            self.assertTrue(check_catalog(changed, self.catalog.schema))
        schema = json.loads((ROOT / 'config/components/comms.schema.json').read_text())
        import jsonschema
        jsonschema.Draft202012Validator.check_schema(schema)
        self.assertTrue(jsonschema.Draft202012Validator(schema).is_valid(self.catalog.data))
        self.assertFalse(validate(self.catalog.data, schema))

    def test_unknown_discovery_does_not_fall_back_to_other_harness(self):
        with self.assertRaises(Invalid): self.catalog.channel('hermes', 'webex')
        self.assertEqual([], self.catalog.search('no-such-comms-option'))

    def test_every_selectable_channel_discloses_activation_effects_in_exact_review(self):
        from setup_plan import PlanValidator
        from test_setup_plan import sample_plan
        from setup_comms import select_channels
        validator=PlanValidator(ROOT)
        for entry in self.catalog.entries:
            if entry['inventory']!='channel' or entry['setup']['disposition'] not in ('typed','native'):continue
            with self.subTest(entry=entry['id']):
                self.assertTrue(entry['setup']['startupEffects'])
                plan=sample_plan();claw=plan['claws'][0]
                claw.update(harness=entry['harness'],runtimeVersion=entry['baseline']['version'])
                if claw['harness']=='hermes':claw['workspace']=claw['runtimeHome']
                plan['host']['platform']=entry['hosts'][0]
                plan['claws'][0]=select_channels(claw,[entry['channelId']],validator)
                # Effects can be reviewed on an incomplete draft before private
                # credentials/prerequisites are supplied; no activation follows.
                from unittest.mock import patch
                with patch.object(validator,'inspect',return_value={'valid':True,'hash':'fixture-review'}):
                    effects=validator.explain(plan)['effects']
                reviewed=next(e for e in effects if e['phase']=='comms')
                self.assertEqual(entry['kind'],reviewed['kind'])
                self.assertEqual(entry['setup']['reason'],reviewed['setupExplanation'])
                self.assertEqual(entry['setup']['startupEffects'],reviewed['startupEffects'])
        home=self.catalog.channel('hermes','homeassistant')
        self.assertIn('device-read-and-control-tool-registration',home['setup']['startupEffects'])

    def test_legacy_no_channel_and_single_channel_plans_remain_valid(self):
        from setup_plan import PlanValidator
        from test_setup_plan import sample_plan
        validator = PlanValidator(ROOT)
        for channels in ([], ['slack'], ['telegram'], ['discord']):
            plan = sample_plan()
            plan['claws'][0]['channels'] = [{'id':cid, 'settingKeys':validator.choices[('channel',cid)]['settingKeys']} for cid in channels]
            result = validator.inspect(plan)
            self.assertTrue(result['valid'], result['errors'])

    def test_resolution_keeps_role_host_version_and_implementation_separate(self):
        self.assertEqual('role-restricted', self.catalog.resolve('hermes-homeassistant', role='border', host='macos', version='0.21.6')['state'])
        self.assertEqual('host-restricted', self.catalog.resolve('openclaw-imessage', role='focused', host='wsl2', version='2026.7.1-2')['state'])
        self.assertEqual('version-unqualified', self.catalog.resolve('openclaw-discord', role='border', host='macos', version='999')['state'])
        self.assertEqual('unavailable-baseline', self.catalog.resolve('openclaw-x', role='border', host='macos', version='2026.7.1-2')['state'])
        with self.assertRaises(Invalid): self.catalog.resolve('made-up', role='border', host='macos', version='999')

    def test_multiselect_preserves_retained_credentials_and_provider(self):
        from setup_comms import select_channels
        from setup_plan import PlanValidator
        from test_setup_plan import sample_plan
        validator=PlanValidator(ROOT);claw=sample_plan()['claws'][0]
        two=select_channels(claw,['slack','discord'],validator)
        self.assertEqual(['slack','discord'],[c['id'] for c in two['channels']])
        two['settings']['DISCORD_BOT_TOKEN']['source']='later'
        one=select_channels(two,['discord'],validator)
        self.assertEqual('later',one['settings']['DISCORD_BOT_TOKEN']['source'])
        self.assertNotIn('SLACK_BOT_TOKEN',one['settings'])
        self.assertEqual(claw['settings']['ANTHROPIC_API_KEY'],one['settings']['ANTHROPIC_API_KEY'])
        self.assertEqual([],claw['channels'])
        empty=select_channels(one,['none'],validator)
        self.assertEqual([],empty['channels'])
        self.assertNotIn('DISCORD_BOT_TOKEN',empty['settings'])
        with self.assertRaises(Invalid):select_channels(one,['none','discord'],validator)
        member=copy.deepcopy(claw);member['role']='member'
        with self.assertRaises(Invalid):select_channels(member,['discord'],validator)

    def test_access_scope_never_interprets_empty_or_wildcard_as_open(self):
        from setup_comms import access_list
        self.assertEqual([],access_list(''))
        self.assertEqual(['user-one','user-two'],access_list('user-one, user-two,user-one'))
        for value in ['*','a,*','a,,b','https://example.com','user\nother','a?','a b']:
            with self.assertRaises(Invalid):access_list(value)


if __name__ == '__main__': unittest.main()
