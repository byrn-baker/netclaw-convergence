"""Owned compiled-helper revision and native acquisition boundaries."""
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts/lib'),str(ROOT/'tests')]
from setup_comms_openclaw import (PIN,VERSION,observe_helper,install_helper,install_channel,helper_input_hash,
    prepared_prerequisites,observe_prepared_prerequisites)
from setup_deploy import Deployment
from setup_schema import canonical
from setup_state import guarded_write,Conflict
from test_setup_plan import sample_plan


class OpenClawHelperTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.plan=sample_plan(str(Path(self.temp.name).resolve()))
        self.claw=self.plan['claws'][0];self.effects=[]
        self.context={'plan':self.plan,'journal':{'effects':self.effects},'save':lambda:None}
        self.effect={'id':'helper-fixture','owner':self.claw['id'],'artifacts':[]};self.effects.append(self.effect)
        self.context['artifactIntent']=lambda _,items:self.effect['artifacts'].extend(items)
        self.deploy=Deployment(ROOT,self.claw,self.context)
        for name in ('entry.ts','acquire.ts','register.ts','contract.mjs'):
            guarded_write(self.deploy.source/'installer/native-comms/openclaw'/name,(ROOT/'installer/native-comms/openclaw'/name).read_bytes())
        self.core=self.deploy.root/'.setup/prefix/lib/node_modules/openclaw'
        guarded_write(self.core/'package.json',canonical({'name':'openclaw','version':VERSION}))

    def installed(self):
        base=self.core/'netclaw-comms';files=[]
        for name in ['netclaw-comms-helper.js','netclaw-comms-acquire.js','netclaw-comms-register.js','netclaw-comms-build.json','dependency-chunk.js']:
            data=b'fixture';guarded_write(base/name,data)
            files.append({'path':name,'sha256':hashlib.sha256(data).hexdigest()})
        record={'schema':1,'source':PIN,'version':VERSION,'root':str(base),'inputHash':helper_input_hash(self.deploy),'files':files}
        self.deploy.write(self.effect,self.deploy.root/'.setup/comms/helper.json',canonical(record),kind='comms-helper-index')
        return base

    def test_every_compiled_chunk_and_receipt_is_bound_to_this_owner(self):
        base=self.installed();self.assertTrue(observe_helper(self.context,self.deploy))
        guarded_write(base/'dependency-chunk.js',b'changed')
        self.assertFalse(observe_helper(self.context,self.deploy))
        guarded_write(base/'dependency-chunk.js',b'fixture');self.assertTrue(observe_helper(self.context,self.deploy))
        guarded_write(base/'unreviewed.js',b'extra');self.assertFalse(observe_helper(self.context,self.deploy))

    def test_partial_build_or_changed_graph_does_not_replay_package_managers(self):
        self.effect['commsHelperStage']='building'
        with self.assertRaises(Conflict):install_helper(self.effect,self.context,self.deploy,None)
        self.effect.pop('commsHelperStage');self.installed()
        guarded_write(self.core/'netclaw-comms/dependency-chunk.js',b'changed')
        with self.assertRaises(Conflict):install_helper(self.effect,self.context,self.deploy,None)

    def test_non_external_telegram_does_not_acquire_or_build(self):
        with patch('setup_comms_openclaw.install_helper') as acquire:
            self.assertTrue(install_channel(self.effect,self.context,self.deploy,None,'telegram',{}))
            self.assertFalse(install_channel(self.effect,self.context,self.deploy,None,'unknown',{}))
            acquire.assert_not_called()

    def test_imessage_prepared_binary_and_database_identity_without_reading_messages(self):
        binary=Path(self.temp.name).resolve()/'imsg';database=Path(self.temp.name).resolve()/'chat.db'
        # Non-executable fixture bytes: only metadata/hash is inspected.
        raw=b'\xcf\xfa\xed\xfe'+b'synthetic fixture, never executed'
        guarded_write(binary,raw);binary.chmod(0o700)
        guarded_write(database,b'private fixture message data, never read')
        values={'IMESSAGE_CLI_PATH':str(binary),'IMESSAGE_DB_PATH':str(database),
            'IMESSAGE_CLI_SHA256':hashlib.sha256(raw).hexdigest()}
        original=__import__('setup_comms_openclaw').guarded_read
        def no_database_read(path,*args,**kwargs):
            self.assertNotEqual(database,Path(path))
            return original(path,*args,**kwargs)
        with patch('setup_comms_openclaw.guarded_read',side_effect=no_database_read):
            self.assertTrue(prepared_prerequisites(self.effect,self.context,self.deploy,None,'imessage',values))
            self.assertTrue(observe_prepared_prerequisites(self.deploy,'imessage',values))
            guarded_write(binary,raw+b'changed')
            self.assertFalse(observe_prepared_prerequisites(self.deploy,'imessage',values))


if __name__=='__main__':unittest.main()
