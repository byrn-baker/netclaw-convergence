"""WhatsApp linked-device setup contracts; no real account link or messages."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts/lib'),str(ROOT/'tests')]
from setup_comms_openclaw import whatsapp_config,_whatsapp_pairing_receipt,whatsapp_configuration_valid
from setup_deploy import Deployment
from setup_schema import canonical,Invalid
from setup_state import guarded_write,Conflict
from test_setup_plan import sample_plan


class WhatsAppPairingTests(unittest.TestCase):
    def test_policy_phone_and_scoped_auth_location(self):
        values={'WHATSAPP_ACCOUNT_PHONE':'+15551234567','WHATSAPP_ALLOWED_USERS':'+15557654321'}
        before={'channels':{'slack':{'token':'unchanged'}},'plugins':{'deny':['neighbor']}}
        config=whatsapp_config(before,values,Path('/owned/credentials/whatsapp/default'))
        self.assertEqual(before['channels']['slack'],config['channels']['slack'])
        self.assertEqual('disabled',config['channels']['whatsapp']['groupPolicy'])
        self.assertFalse(config['channels']['whatsapp']['sendReadReceipts'])
        self.assertEqual('/owned/credentials/whatsapp/default',config['channels']['whatsapp']['accounts']['default']['authDir'])
        for bad in ('*','+15557654321,*','private-not-phone'):
            with self.assertRaises(Invalid):whatsapp_config(before,{**values,'WHATSAPP_ALLOWED_USERS':bad},Path('/owned'))
        self.assertEqual('disabled',whatsapp_config({},dict(values,WHATSAPP_ALLOWED_USERS=''),Path('/owned'))['channels']['whatsapp']['dmPolicy'])

    def test_receipt_binds_owner_request_account_and_every_multifile_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            plan=sample_plan(str(Path(tmp).resolve()));claw=plan['claws'][0]
            ctx={'plan':plan,'runId':'fixture','planHash':'a'*64,'journal':{'effects':[]}}
            deploy=Deployment(ROOT,claw,ctx);deploy.source=ROOT
            attempt=deploy.root/'.setup/comms/whatsapp/pairing'
            script=ROOT/'installer/native-comms/openclaw/whatsapp-pair.mjs'
            request={'schema':1,'owner':claw['id'],'runId':'fixture','expectedPhone':'+15551234567',
                'helperSha256':hashlib.sha256(script.read_bytes()).hexdigest()}
            raw=canonical(request);guarded_write(attempt/'request.json',raw)
            creds=canonical({'me':{'id':'15551234567:1@s.whatsapp.net'}});key=canonical({'key':'synthetic-fixture'})
            guarded_write(attempt/'auth/creds.json',creds);guarded_write(attempt/'auth/session-1555.0.json',key)
            files=[{'path':name,'sha256':hashlib.sha256(data).hexdigest()} for name,data in [('creds.json',creds),('session-1555.0.json',key)]]
            receipt={'schema':1,'owner':claw['id'],'runId':'fixture','requestHash':hashlib.sha256(raw).hexdigest(),
                'phone':request['expectedPhone'],'connected':True,'closed':True,'files':files,'observedAt':1}
            guarded_write(attempt/'result.json',canonical(receipt))
            self.assertEqual(request,_whatsapp_pairing_receipt(ctx,deploy)[0])
            for changed in ({**receipt,'connected':False},{**receipt,'closed':False},{**receipt,'owner':'neighbor'},
                            {**receipt,'phone':'+15550000000'},{**receipt,'files':files[:1]}):
                guarded_write(attempt/'result.json',canonical(changed))
                with self.assertRaises(Conflict):_whatsapp_pairing_receipt(ctx,deploy)
            guarded_write(attempt/'result.json',canonical(receipt))
            # Runtime key rotation is valid local configuration only after the
            # authenticated setup attempt completed for this same account.
            ctx['journal']['effects']=[{'owner':claw['id'],'phase':'comms','channel':'whatsapp',
                'state':'verified','commsPairingStage':'complete','artifacts':[{'path':str(attempt/'result.json'),
                'sha256':hashlib.sha256(canonical(receipt)).hexdigest()}]}]
            active=deploy.root/'credentials/whatsapp/default'
            guarded_write(active/'creds.json',creds)
            guarded_write(active/'session-new.json',canonical({'key':'rotated-fixture'}))
            values={'WHATSAPP_ACCOUNT_PHONE':request['expectedPhone']}
            self.assertTrue(whatsapp_configuration_valid(ctx,deploy,values))
            ctx['journal']['effects'][0]['state']='unknown'
            self.assertFalse(whatsapp_configuration_valid(ctx,deploy,values))
            ctx['journal']['effects'][0]['state']='verified'
            guarded_write(active/'creds.json',canonical({'me':{'id':'15550000000@s.whatsapp.net'}}))
            self.assertFalse(whatsapp_configuration_valid(ctx,deploy,values))
            guarded_write(active/'creds.json',creds)
            self.assertTrue(whatsapp_configuration_valid(ctx,deploy,values))
            guarded_write(attempt/'auth/session-1555.0.json',b'{}')
            with self.assertRaises(Conflict):_whatsapp_pairing_receipt(ctx,deploy)
            self.assertFalse(whatsapp_configuration_valid(ctx,deploy,values))

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_NODE'),'isolated supported Node required')
    def test_sdk_event_contract_blocks_operations_and_closes_on_mismatch_timeout_and_success(self):
        code=r'''
import {EventEmitter} from 'node:events';
import {pathToFileURL} from 'node:url';
import net from 'node:net';
net.Socket.prototype.connect=()=>{throw Error('network forbidden')};
const {pairOnly}=await import(pathToFileURL(process.argv[2]));
for(const mode of ['success','mismatch','timeout','restart']){
 let saved=0,ended=0,instances=0;
 const state={creds:{},keys:{}};const sockets=[];
 const sdk={useMultiFileAuthState:async()=>({state,saveCreds:async()=>{saved++}}),makeCacheableSignalKeyStore:x=>x,
  default:options=>{
   instances++;if(options.syncFullHistory!==false||options.markOnlineOnConnect!==false||options.fireInitQueries!==false||options.shouldSyncHistoryMessage({})!==false||options.shouldIgnoreJid('foreign')!==true)throw Error('unsafe socket options');
   const socket={ev:new EventEmitter(),end(){ended++},sendMessage(){throw Error('unreachable operation')}};sockets.push(socket);
   setImmediate(()=>{
    if(socket.ev.eventNames().some(name=>!['creds.update','connection.update'].includes(name)))throw Error('operational handler');
    let denied=false;try{socket.sendMessage('foreign','forbidden')}catch(e){denied=e.message==='pairing_operation_refused'}if(!denied)throw Error('send permitted');
    if(mode==='timeout')return;
    state.creds.me={id:mode==='mismatch'?'15550000000@s.whatsapp.net':'15551234567:3@s.whatsapp.net'};
    socket.ev.emit('creds.update',{});
    if(mode==='restart'&&instances===1){socket.ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:515}}}});return}
    socket.ev.emit('connection.update',{connection:'open'});
   });return socket;
  }};
 let ok=false;try{await pairOnly({sdk,authDir:'/never-used-fixture',expectedPhone:'+15551234567',qr(){},timeoutMs:50});ok=true}catch{}
 if(ok!==['success','restart'].includes(mode)||ended!==1)throw Error('incorrect settlement '+mode);
 if(ok&&saved<1)throw Error('credentials not saved');
}
console.log('pair-only event contracts passed without an account connection');
'''
        result=subprocess.run([os.environ['NETCLAW_TEST_NODE'],'--input-type=module','-e',code,'fixture-runner',
            str(ROOT/'installer/native-comms/openclaw/whatsapp-pair.mjs')],capture_output=True,timeout=15)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        self.assertIn(b'pair-only event contracts passed',result.stdout)


if __name__=='__main__':unittest.main()
