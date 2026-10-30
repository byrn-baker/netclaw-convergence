import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from test_setup_plan import sample_plan
from setup_report import project,export_report,export_binding
from setup_verify import verify_installation,HudProbe


class VerificationTests(unittest.TestCase):
    def test_testbed_export_projects_selection_without_source_inventory_or_claims(self):
        report={'installations':[{'harness':'hermes','testbed':{'mode':'dynamic','sources':['netbox','cml'],
            'scope':'private-host','records':[{'password':'private-password'}],'execution':'verified','sourceAccess':'verified'}}]}
        value=project(report,{'components':[]})['installations'][0]['testbed']
        self.assertEqual(value,{'mode':'dynamic','sources':['cml','netbox'],'sourceAccess':'unverified',
            'candidate':'not_built','activation':'not_observed','execution':'not_checked'})
        self.assertNotIn('private',json.dumps(value))

    def test_startup_polling_waits_for_readiness_but_not_failures_or_cancellation(self):
        from setup_verify import wait_for_readiness
        class Pause:
            def __init__(self):self.now=0;self.cancelled=False;self.cancel_on_wait=False
            def is_set(self):return self.cancelled
            def wait(self,delay):
                self.now+=delay;self.cancelled=self.cancel_on_wait;return self.cancelled
        for case in ('ready','identity-mismatch','deadline','cancel'):
            pause=Pause();calls=[];pause.cancel_on_wait=case=='cancel'
            def probe():
                calls.append(pause.now)
                if case=='identity-mismatch':return {'state':'failed','code':'identity_mismatch'}
                if case=='ready' and len(calls)==3:return {'state':'verified','code':'identity_verified'}
                return {'state':'unverified','code':'probe_failed'}
            result=wait_for_readiness(probe,pause,timeout=3,clock=lambda:pause.now)
            self.assertEqual(result['state'],{'ready':'verified','identity-mismatch':'failed','deadline':'unverified','cancel':'unverified'}[case])
            self.assertEqual(len(calls),{'ready':3,'identity-mismatch':1,'deadline':4,'cancel':1}[case])

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve();self.plan=sample_plan(str(self.root));self.claw=self.plan['claws'][0]
        self.catalog=json.loads((ROOT/'config/components/catalog.json').read_text())

    def test_nested_free_text_private_identifiers_and_secrets_never_export(self):
        private='private-host.example /Users/private-user/secret 192.0.2.10 sk-secret-canary'
        report={'installations':[{'harness':'openclaw','version':'2026.7.1-2','identity':{'home':str(self.root),'source':str(self.root/'source'),
            'hudEndpoint':'http://user:secret@127.0.0.1:3001/path?token=secret','installationId':'11111111-1111-4111-8111-111111111111','token':private},
            'label':private,'errors':{'nested':[private]},'tiers':[{'tier':1,'state':'verified','code':'artifact_present','evidence':private}],
            'components':[{'id':'subnet-calc','state':'failed','code':private,'raw':private},{'id':private,'state':'verified'}]}]}
        default=project(report,self.catalog);serialized=json.dumps(default)
        for needle in ('private-host','private-user','192.0.2.10','secret','/Users/',str(self.root),'11111111'):self.assertNotIn(needle,serialized)
        self.assertEqual(default['installations'][0]['tiers'][0]['state'],'verified')
        detailed=json.dumps(project(report,self.catalog,detailed=True))
        self.assertIn(str(self.root),detailed)
        for needle in ('sk-secret','user:secret','token=',private):self.assertNotIn(needle,detailed)

    def test_detailed_export_is_separate_one_use_review_and_refuses_overwrite(self):
        from setup_engine import ReviewAuthority,ReviewRefused
        from setup_state import Conflict
        run={'runId':'run-fixture','planHash':'a'*64,'plan':self.plan,'reports':{}}
        target=self.root/'report.json'
        with self.assertRaises(ReviewRefused):export_report(run,self.catalog,target,detailed=True)
        review=ReviewAuthority('native').approve(export_binding(run,target,detailed=True),'export-detailed')
        export_report(run,self.catalog,target,detailed=True,review=review)
        self.assertEqual(target.stat().st_mode&0o077,0)
        with self.assertRaises(ReviewRefused):export_report(run,self.catalog,self.root/'other',detailed=True,review=review)
        with self.assertRaises(Conflict):export_report(run,self.catalog,target)

    def test_selected_optional_tiers_and_cost_boolean_do_not_authorize_live_calls(self):
        class Probes:
            identity='11111111-1111-4111-8111-111111111111'
            def component(self,_):return {'state':'verified','code':'discovery_verified'}
            def installed(self):return {'state':'verified','code':'artifact_present'}
            def canary(self):return {'state':'unverified','code':'canary_unverified'}
            def running(self):return {'state':'verified','code':'identity_verified'}
        from setup_deploy import Deployment
        context={'runId':'run-fixture','planHash':'a'*64,'plan':self.plan,'journal':{'effects':[]},'artifactIntent':lambda *_:None}
        deploy=Deployment(ROOT,self.claw,context);deploy.home({'id':'home'})
        self.plan['verification']['tiers']=[1,2,3,4,5,6];self.plan['verification']['costConsent']=True
        result=verify_installation({'id':'verify'},context,deploy,None,probes=Probes())
        self.assertEqual(result['state'],'unverified')
        tiers=context['journal']['reports'][self.claw['id']]['tiers']
        self.assertEqual(tiers[1]['state'],'unverified')
        self.assertTrue(all(t['state']=='unverified' and t['code']=='native_consent_required' for t in tiers[3:]))

    def test_hud_requires_identity_session_binding_and_runtime_readiness(self):
        identity='11111111-1111-4111-8111-111111111111'
        for mismatch in ('identity','home','harness','readiness','cookie',None):
            probe=HudProbe(self.claw,identity);calls=[]
            def request(route,body=None):
                calls.append(route)
                if route=='/api/runtime':return {'installationId':'foreign' if mismatch=='identity' else identity,
                    'kind':'hermes' if mismatch=='harness' else 'openclaw','readiness':{'ready':mismatch!='readiness'}}
                if route=='/api/hud/session':
                    if mismatch!='cookie':
                        from http.cookiejar import Cookie
                        probe.cookies.set_cookie(Cookie(0,'nc_hud_fixture','secret',None,False,'127.0.0.1',False,False,'/',True,False,None,True,None,None,{}))
                    return {}
                if route=='/api/hud/management':return {'installationId':identity,'kind':'openclaw',
                    'home':'foreign' if mismatch=='home' else self.claw['runtimeHome'],'expectedWorkspace':self.claw['workspace']}
                return {}
            probe.request=request
            result=probe.check()
            self.assertEqual(result['state']=='verified',mismatch is None,mismatch)
            self.assertFalse(list(probe.cookies))
            if mismatch not in ('identity','harness','cookie'):self.assertIn('/api/hud/session/revoke',calls)


if __name__=='__main__':unittest.main()
