"""Interrupted selected-channel writes reconcile without new native effects."""
import copy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_comms_services import observe_channel_effect
from setup_deploy import Deployment
from setup_comms import configure_channel
from setup_schema import canonical
from setup_state import guarded_write,revision
from test_setup_plan import sample_plan


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.plan=sample_plan(str(Path(self.tmp.name).resolve()));self.claw=self.plan['claws'][0]
        self.claw.update(harness='hermes',runtimeVersion='0.21.6',workspace=self.claw['runtimeHome'])
        self.claw['channels']=[{'id':'discord','settingKeys':[]}]
        self.effects=[];self.context={'plan':self.plan,'runId':'run-fixture','planHash':'a'*64,'journal':{'effects':self.effects}}
        self.context['artifactIntent']=lambda key,rows:next(e for e in self.effects if e['id']==key)['artifacts'].extend(rows)
        self.deploy=Deployment(ROOT,self.claw,self.context)
        self.deploy.home(self.effect('home'))
        self.deploy.write(self.effect('credentials'),self.deploy.root/'.env',b'DISCORD_BOT_TOKEN=fixture-secret\n',kind='credentials')
        self.deploy.write(self.effect('onboard'),self.deploy.root/'config.yaml',canonical({'model':{'retained':True},'platforms':{}}),kind='configuration')
        self.comms=self.effect('comms');self.comms.update(channel='discord',state='unknown')
        inspection=patch('setup_comms.hermes_channel_inspection',return_value={'adapter':True,'dependencies':True,'configured':True})
        inspection.start();self.addCleanup(inspection.stop)
        evidence=patch('setup_comms_evidence.hermes_channel_inspection',return_value={'adapter':True,'dependencies':True,'configured':True})
        evidence.start();self.addCleanup(evidence.stop)

    def effect(self,phase):
        value={'id':self.claw['id']+':'+phase,'owner':self.claw['id'],'phase':phase,'state':'verified','artifacts':[]}
        self.effects.append(value);return value

    def whatsapp_receipt(self):
        from setup_comms_hermes import fixtures
        from setup_comms import prepare_channel_config
        from setup_comms_hermes_native import pairing_files
        from setup_secrets import _dotenv
        from setup_schema import loads
        self.claw['channels']=[{'id':'whatsapp','settingKeys':[]}];self.comms['channel']='whatsapp'
        values={**fixtures()['whatsapp'],'WHATSAPP_ALLOWED_USERS':'15551234567'}
        path=self.deploy.root/'config.yaml';config,updates=prepare_channel_config(self.claw,'whatsapp',loads(path.read_bytes()),values)
        values.update(updates)
        self.deploy.write(next(e for e in self.effects if e['phase']=='credentials'),self.deploy.root/'.env',
            ''.join(k+'='+_dotenv.quote(v)+'\n' for k,v in sorted(values.items())).encode(),kind='credentials',expected=revision(self.deploy.root/'.env'))
        self.deploy.write(self.comms,path,canonical(config),kind='configuration',expected=revision(path))
        base=self.deploy.root/'.setup/comms/whatsapp';stage=base/'pair-stage';user='15551234567:1@s.whatsapp.net'
        self.deploy.write(self.comms,base/'pair-request.json',canonical({'schema':1,'nonce':'b'*64,'runId':self.context['runId'],
            'planHash':self.context['planHash'],'owner':self.claw['id']}),kind='comms-native-attempt')
        guarded_write(stage/'creds.json',canonical({'registered':True,'me':{'id':user}}))
        guarded_write(stage/'session-key.json',canonical({'key':'private-fixture'}))
        guarded_write(base/'pair-result.json',canonical({'schema':1,'nonce':'b'*64,'state':'paired','returncode':0,
            'connectedUser':user,'files':pairing_files(stage,user)}))
        return base,stage

    def test_native_pairing_partial_promotion_retries_owned_files_without_pair_replay(self):
        from setup_comms_hermes_native import pair_whatsapp
        base,_=self.whatsapp_receipt();original=self.deploy.write
        def interrupt(effect,path,data,**kwargs):
            if path.parent==self.deploy.root/'platforms/whatsapp/session' and path.name=='session-key.json':raise InterruptedError()
            return original(effect,path,data,**kwargs)
        with patch('setup_comms_hermes_native.observe_bridge',return_value=True):
            with patch.object(self.deploy,'write',side_effect=interrupt),self.assertRaises(InterruptedError):
                pair_whatsapp(self.comms,self.context,self.deploy,None,None)
            self.assertEqual('retry_owned',observe_channel_effect(self.comms,self.context,self.deploy,None))
            self.assertTrue(pair_whatsapp(self.comms,self.context,self.deploy,None,None))
        self.assertEqual('completed',observe_channel_effect(self.comms,self.context,self.deploy,None))

    def test_rotated_same_account_remains_configured_and_cleanup_preserves_changed_auth(self):
        from setup_comms_hermes_native import pair_whatsapp
        from setup_cleanup import preview
        self.whatsapp_receipt()
        with patch('setup_comms_hermes_native.observe_bridge',return_value=True):
            self.assertTrue(pair_whatsapp(self.comms,self.context,self.deploy,None,None))
        self.comms['state']='verified'
        target=self.deploy.root/'platforms/whatsapp/session/session-key.json'
        guarded_write(target,canonical({'key':'rotated-private-fixture'}),expected=revision(target))
        self.assertEqual('completed',observe_channel_effect(self.comms,self.context,self.deploy,None))
        run={**self.context,'effects':self.effects}
        row=next(row for row in preview(run)['items'] if row['path']==str(target))
        self.assertEqual(('retain','revision_changed'),(row['action'],row['reason']))
        creds=target.parent/'creds.json'
        guarded_write(creds,canonical({'registered':True,'me':{'id':'15557654321:1@s.whatsapp.net'}}),expected=revision(creds))
        self.assertEqual('conflict',observe_channel_effect(self.comms,self.context,self.deploy,None))

    def test_unknown_native_pairing_does_not_run_config_probe_or_open_a_new_pairing(self):
        self.claw['channels']=[{'id':'whatsapp','settingKeys':[]}];self.comms['channel']='whatsapp'
        self.deploy.write(self.comms,self.deploy.root/'.setup/comms/whatsapp/pair-request.json',canonical({
            'schema':1,'nonce':'b'*64,'runId':self.context['runId'],'planHash':self.context['planHash'],'owner':self.claw['id']}),kind='comms-native-attempt')
        with patch('setup_comms_hermes_native.pair_whatsapp',side_effect=AssertionError('no QR replay')),patch(
            'setup_comms.hermes_channel_inspection',side_effect=AssertionError('unsettled native effect')):
            self.assertEqual('unknown',observe_channel_effect(self.comms,self.context,self.deploy,None))

    def test_verified_native_pairing_never_repromotes_removed_control_receipts(self):
        from setup_comms_hermes_native import pair_whatsapp
        base,_=self.whatsapp_receipt()
        with patch('setup_comms_hermes_native.observe_bridge',return_value=True):
            self.assertTrue(pair_whatsapp(self.comms,self.context,self.deploy,None,None))
        self.comms['state']='verified';(base/'pair-installed.json').unlink()
        self.assertEqual('conflict',observe_channel_effect(self.comms,self.context,self.deploy,None))

    def test_complete_write_rechecks_native_readback_and_never_reexecutes_setup(self):
        configure_channel(self.comms,self.context,self.deploy,None)
        self.assertEqual('completed',observe_channel_effect(self.comms,self.context,self.deploy,None))
        self.assertEqual('unknown',self.comms['state'])
        with patch('setup_comms_evidence.hermes_channel_inspection',return_value={'configured':False,'dependencies':True}):
            self.assertEqual('unknown',observe_channel_effect(self.comms,self.context,self.deploy,None))

    def test_interrupted_configuration_intent_is_retryable_only_for_owned_before_image(self):
        original_write=self.deploy.write
        def interrupt(effect,path,data,**kwargs):
            if path.name=='config.yaml':
                self.context['artifactIntent'](effect['id'],[self.deploy.artifact(path,data,'configuration',before=kwargs['expected'])])
                raise InterruptedError()
            return original_write(effect,path,data,**kwargs)
        with patch.object(self.deploy,'write',side_effect=interrupt),self.assertRaises(InterruptedError):
            configure_channel(self.comms,self.context,self.deploy,None)
        self.assertEqual('retry_owned',observe_channel_effect(self.comms,self.context,self.deploy,None))
        self.assertEqual('verified',configure_channel(self.comms,self.context,self.deploy,None)['state'])
        self.assertEqual('completed',observe_channel_effect(self.comms,self.context,self.deploy,None))

    def test_foreign_edit_and_unknown_dependency_never_gain_retry_authority(self):
        configure_channel(self.comms,self.context,self.deploy,None)
        with patch('setup_comms.hermes_channel_inspection',return_value={'adapter':True,'dependencies':False}):
            self.assertEqual('unknown',observe_channel_effect(self.comms,self.context,self.deploy,None))
        path=self.deploy.root/'config.yaml';guarded_write(path,canonical({'changed':'neighbor'}),expected=revision(path))
        self.assertEqual('conflict',observe_channel_effect(self.comms,self.context,self.deploy,None))


if __name__=='__main__':unittest.main()
