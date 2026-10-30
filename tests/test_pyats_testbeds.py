import copy
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from pyats_testbeds import compose, policy, policy_environment, catalog, TestbedError

NOW=datetime(2026,10,30,12,1,tzinfo=timezone.utc)


class CompositionTests(unittest.TestCase):
    def fixture(self,kind='structured'):
        return json.loads((ROOT/f'tests/fixtures/pyats-testbeds/{kind}.json').read_text())

    def run_compose(self,e):return compose(e,now=NOW)

    def test_every_source_has_executable_fixture(self):
        for entry in catalog():
            with self.subTest(source=entry['id']):
                result=self.run_compose(self.fixture(entry['id']))
                self.assertEqual(result['preview']['devices'],1)
                self.assertEqual(result['arguments']['source'],'inline')
                self.assertFalse(result['arguments']['activate'])
                self.assertEqual(result['preview']['sources'][0]['kind'],entry['id'])

    def test_cross_compose_and_preserve_provenance(self):
        a=self.fixture('netbox');b=self.fixture('containerlab')
        a['sources']+=b['sources']
        out=self.run_compose(a)
        self.assertEqual(out['preview']['devices'],2)
        self.assertEqual(len(out['preview']['sources']),2)

    def test_static_compatibility_dynamic_closed_policy(self):
        self.assertEqual(policy(),{'mode':'static','sources':[]})
        for bad in ({'mode':'dynamic','sources':[]},{'mode':'dynamic','sources':['bogus']},{'mode':'static','sources':['gns3']},{'mode':'dynamic','sources':['gns3','gns3']}):
            with self.assertRaises(TestbedError):policy(bad)
        e=policy_environment({'mode':'dynamic','sources':['gns3']},'/private/operator.yaml')
        self.assertEqual(e['PYATS_TESTBED_PATH'],'')
        self.assertEqual(e['PYATS_MCP_DYNAMIC_ONLY'],'1')

    def test_unselected_source_is_refused(self):
        with self.assertRaisesRegex(TestbedError,'source_not_selected'):
            compose(self.fixture(),selected=['netbox'],now=NOW)

    def test_no_console_to_ssh_inference(self):
        for kind in ('cml','eve_ng','gns3'):
            e=self.fixture(kind);s=e['sources'][0];s.pop('endpoints');s['records'][0].update(console_host='192.0.2.1',console=5000,console_port=5000)
            with self.assertRaisesRegex(TestbedError,'management_address'):self.run_compose(e)

    def test_partial_empty_or_miscounted(self):
        for change in ({'complete':False},{'complete':None},{'total':2},{'records':[],'total':0}):
            e=self.fixture();e['sources'][0].update(change)
            with self.assertRaisesRegex(TestbedError,'complete_nonempty'):self.run_compose(e)

    def test_stale_snapshot_not_freshened_by_retrieval(self):
        e=self.fixture('ipfabric');e['sources'][0]['snapshotCapturedAt']='2026-09-01T00:00:00Z'
        with self.assertRaisesRegex(TestbedError,'stale'):self.run_compose(e)

    def test_future_or_naive_time_rejected(self):
        for t in ('2028-01-01T00:00:00Z','2026-10-30T12:00:00'):
            e=self.fixture();e['sources'][0]['capturedAt']=t
            with self.assertRaises(TestbedError):self.run_compose(e)

    def test_conflicts_not_silently_merged(self):
        a=self.fixture();s=a['sources'][0]
        for field in ('name','management_ip'):
            e=copy.deepcopy(a);r=copy.deepcopy(s['records'][0]);r.update(id='other',name='other',management_ip='192.0.2.250')
            r[field]=s['records'][0][field];e['sources'][0]['records'].append(r);e['sources'][0]['total']=2
            with self.assertRaisesRegex(TestbedError,'conflicting_'):self.run_compose(e)

    def test_no_unknown_os_or_default_port(self):
        for field,value in (('os','qemu'),('management_port','22;touch /tmp/x'),('management_port',None),('management_ip','0.0.0.0'),('management_ip','https://example.com/token'),('management_ip','999.2.3.4')):
            e=self.fixture();s=e['sources'][0];s.pop('defaults');s['records'][0][field]=value
            with self.subTest(field=field,value=value),self.assertRaises(TestbedError):self.run_compose(e)

    def test_ipv6_and_explicit_os_map(self):
        e=self.fixture('netbox');s=e['sources'][0];r=s['records'][0]
        r['primary_ip6']={'address':'2001:db8::10/64'};s['mapping']={'host':'primary_ip6.address'}
        r['platform']['slug']='cisco_iosxe';s['osMap']={'cisco_iosxe':'iosxe'}
        self.assertEqual(self.run_compose(e)['arguments']['data'][0]['host'],'2001:db8::10')

    def test_secrets_and_configuration_never_projected(self):
        e=self.fixture();r=e['sources'][0]['records'][0]
        r.update(password='CANARY',configuration='CANARY',environment={'TOKEN':'CANARY'},custom={'secret':'CANARY'})
        self.assertNotIn('CANARY',json.dumps(self.run_compose(e)))
        e['sources'][0]['mapping']={'name':'password'}
        with self.assertRaisesRegex(TestbedError,'unsafe_mapping_path'):self.run_compose(e)

    def test_only_device_env_refs(self):
        e=self.fixture();e['credentials']={'username_env':'NETCLAW_USERNAME','password_env':'AWS_SECRET_ACCESS_KEY','enable_env':'NETCLAW_PASSWORD'}
        with self.assertRaises(TestbedError):self.run_compose(e)
        e['credentials']['password_env']='NETCLAW_PASSWORD'
        self.run_compose(e)
        e['credentials']={'from':'static'}
        with self.assertRaises(TestbedError):self.run_compose(e)

    def test_old_ipfabric_field_needs_explicit_mapping(self):
        e=self.fixture('ipfabric');r=e['sources'][0]['records'][0];r['loginIp']=r.pop('loginIpv4')
        with self.assertRaises(TestbedError):self.run_compose(e)
        e['sources'][0]['mapping']={'host':'loginIp'};self.run_compose(e)

    def test_no_unmatched_or_conflicting_enrichment(self):
        e=self.fixture('gns3');s=e['sources'][0];s['endpoints']['wrong']=s['endpoints'].pop(next(iter(s['endpoints'])))
        with self.assertRaises(TestbedError):self.run_compose(e)


if __name__=='__main__':unittest.main()
