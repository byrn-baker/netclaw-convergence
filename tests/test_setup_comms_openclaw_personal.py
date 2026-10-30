"""Native personal-channel setup without QR scans, provider sessions or messages."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts/lib'),str(ROOT/'tests')]
from setup_comms_openclaw import (PERSONAL_CHANNELS,_personal_receipt,_personal_files,personal_config,
    personal_configuration_valid,observe_personal,configure_personal)
from setup_deploy import Deployment
from setup_schema import canonical
from setup_state import guarded_write,guarded_read,revision,Conflict
from test_setup_plan import sample_plan

class PersonalPairingTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_NODE') and os.environ.get('NETCLAW_TEST_OPENCLAW_PERSONAL_HOME'),
        'isolated acquired personal-channel plugins required')
    def test_actual_pinned_login_modules_with_fake_http_and_passive_zalo_sdk(self):
        from setup_secrets import child_environment
        home=Path(os.environ['NETCLAW_TEST_OPENCLAW_PERSONAL_HOME'])
        result=subprocess.run([os.environ['NETCLAW_TEST_NODE'],str(ROOT/'installer/native-comms/openclaw/check-personal-native.mjs'),str(home)],
            env=child_environment(home,'openclaw'),capture_output=True,timeout=30)
        self.assertEqual(0,result.returncode,result.stderr.decode())
        rows=json.loads(result.stdout)['results']
        self.assertEqual({'wechat','zalouser','zaloclawbot'},{r['channel'] for r in rows})
        self.assertTrue(all(r['providerConnections']==0 for r in rows))

    def test_receipt_binds_owner_account_and_native_auth_artifacts_for_each_channel(self):
        for channel,(native,key) in PERSONAL_CHANNELS.items():
            with self.subTest(channel=channel),tempfile.TemporaryDirectory() as tmp:
                plan=sample_plan(str(Path(tmp).resolve()));claw=plan['claws'][0]
                effect={'owner':claw['id'],'phase':'comms','channel':channel,'state':'verified','commsPairingStage':'complete'}
                ctx={'plan':plan,'runId':'fixture','journal':{'effects':[effect]}}
                deploy=Deployment(ROOT,claw,ctx);deploy.source=ROOT;stage=deploy.root/'.setup/comms'/channel/'pairing'
                request={'schema':1,'channel':channel,'owner':claw['id'],'runId':'fixture','expectedOwner':'123456',
                    'helperSha256':hashlib.sha256((ROOT/'installer/native-comms/openclaw/personal-pair.mjs').read_bytes()).hexdigest()}
                raw=canonical(request);guarded_write(stage/'request.json',raw)
                credentials={'wechat':{'token':'fixture-secret','userId':'123456','baseUrl':'https://ilinkai.weixin.qq.com'},
                    'zaloclawbot':{'botToken':'fixture-secret','botId':'987654','ownerId':'123456'},
                    'zalouser':{'imei':'fixture-device','userAgent':'fixture-agent','cookie':[{'key':'fixture-secret'}]}}
                result={'schema':1,'channel':channel,'owner':claw['id'],'runId':'fixture','requestHash':hashlib.sha256(raw).hexdigest(),
                    'connected':True,'closed':True,'ownerId':'123456','accountId':'default' if channel=='zalouser' else 'fixture-bot',
                    'credential':credentials[channel]}
                guarded_write(stage/'result.json',canonical(result))
                effect['artifacts']=[{'path':str(stage/'result.json'),'sha256':hashlib.sha256(canonical(result)).hexdigest()}]
                self.assertEqual(result,_personal_receipt(ctx,deploy,channel)[1])
                before={'channels':{'neighbor':{'account':'untouched'}},'plugins':{'entries':{'neighbor':{'enabled':True}}}}
                config=personal_config(channel,before,{key:'123456'},result)
                self.assertEqual(before['channels']['neighbor'],config['channels']['neighbor'])
                for path,data in _personal_files(deploy,channel,result).items():guarded_write(path,data)
                with patch('setup_comms.owned_configuration',return_value=(deploy.root/'openclaw.json',config,None)):
                    self.assertTrue(personal_configuration_valid(ctx,deploy,channel,{key:'123456'}))
                    self.assertFalse(personal_configuration_valid(ctx,deploy,channel,{key:'different'}))
                    config['channels'][native]['enabled']=False
                    self.assertFalse(personal_configuration_valid(ctx,deploy,channel,{key:'123456'}))
                guarded_write(stage/'result.json',canonical({**result,'ownerId':'other'}))
                with self.assertRaises(Conflict):_personal_receipt(ctx,deploy,channel)

    def test_started_attempt_never_replays_without_bound_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            plan=sample_plan(str(Path(tmp).resolve()));claw=plan['claws'][0]
            ctx={'plan':plan,'runId':'fixture','journal':{'effects':[]}};deploy=Deployment(ROOT,claw,ctx)
            effect={'channel':'wechat'}
            self.assertEqual('retry_owned',observe_personal(effect,ctx,deploy,None))
            guarded_write(deploy.root/'.setup/comms/wechat/pairing/started.json',b'{}')
            self.assertEqual('unknown',observe_personal(effect,ctx,deploy,None))

    def test_interrupted_native_artifact_promotion_resumes_without_repeating_qr(self):
        with tempfile.TemporaryDirectory() as tmp:
            plan=sample_plan(str(Path(tmp).resolve()));claw=plan['claws'][0];channel='wechat'
            effect={'id':'fixture:comms:wechat','owner':claw['id'],'phase':'comms','channel':channel,'artifacts':[]}
            ctx={'plan':plan,'runId':'fixture','planHash':'a'*64,'journal':{'effects':[effect]},'save':lambda:None}
            ctx['artifactIntent']=lambda _,items:effect['artifacts'].extend(items)
            deploy=Deployment(ROOT,claw,ctx);deploy.source=ROOT;stage=deploy.root/'.setup/comms'/channel/'pairing'
            target=deploy.root/'openclaw.json';guarded_write(target,canonical({'channels':{'neighbor':{'preserved':True}}}))
            request={'schema':1,'channel':channel,'owner':claw['id'],'runId':'fixture','expectedOwner':'123456',
                'helperSha256':hashlib.sha256((ROOT/'installer/native-comms/openclaw/personal-pair.mjs').read_bytes()).hexdigest()}
            raw=canonical(request);guarded_write(stage/'request.json',raw)
            result={'schema':1,'channel':channel,'owner':claw['id'],'runId':'fixture','requestHash':hashlib.sha256(raw).hexdigest(),
                'connected':True,'closed':True,'ownerId':'123456','accountId':'fixture-bot',
                'credential':{'token':'fixture','userId':'123456','baseUrl':'https://ilinkai.weixin.qq.com'}}
            guarded_write(stage/'result.json',canonical(result))
            class Harness:
                def command(self):return ['/fixture/openclaw']
                def call(self,*a,**kw):return {'returncode':0}
            class Session:
                def terminal(self,*a,**kw):raise AssertionError('QR must not repeat')
            def owned(*a,**kw):return target,json.loads(guarded_read(target)),revision(target)
            write=deploy.write;count=0
            def interrupted(*a,**kw):
                nonlocal count
                count+=1
                if count==2:raise RuntimeError('synthetic process interruption')
                return write(*a,**kw)
            with patch('setup_risk.latest_environment',return_value=({'WECHAT_OWNER_ID':'123456'},None)),\
                 patch('setup_comms.owned_configuration',side_effect=owned),\
                 patch('setup_comms_openclaw.install_channel',return_value=True):
                with patch.object(deploy,'write',side_effect=interrupted):
                    with self.assertRaises(RuntimeError):configure_personal(effect,ctx,deploy,Harness(),Session())
                self.assertEqual('retry_owned',observe_personal(effect,ctx,deploy,Harness()))
                self.assertEqual({'state':'verified'},configure_personal(effect,ctx,deploy,Harness(),Session()))
                effect['state']='verified'
                self.assertTrue(personal_configuration_valid(ctx,deploy,channel,{'WECHAT_OWNER_ID':'123456'}))
                self.assertEqual({'preserved':True},json.loads(guarded_read(target))['channels']['neighbor'])

    @unittest.skipUnless(os.environ.get('NETCLAW_TEST_NODE'),'isolated Node required')
    def test_native_pair_only_contracts_accept_matching_owner_and_reject_mismatch_or_decline(self):
        code=r'''
import {pathToFileURL} from 'node:url';import net from 'node:net';
net.Socket.prototype.connect=()=>{throw Error('network forbidden')};net.Server.prototype.listen=()=>{throw Error('listener forbidden')};globalThis.fetch=()=>{throw Error('fetch forbidden')};
const {pairZaloPersonal,pairWeChat,pairClawBot}=await import(pathToFileURL(process.argv[2]));
for(const mode of ['success','mismatch','declined']){
 let stopped=0,aborted=0,qr=0;
 const sdk={Zalo:class{constructor(opts){if(opts.logging!==false||opts.selfListen!==false)throw Error('unsafe SDK')}
  async loginQR(_,cb){cb({type:mode==='declined'?3:0,data:{code:'fixture-qr'},actions:{abort(){aborted++}}});
   return {getOwnId:()=>mode==='mismatch'?'other':'123456',getContext:()=>({imei:'fixture',userAgent:'fixture'}),
    getCookie:()=>({toJSON:()=>({cookies:[{key:'fixture'}]})}),listener:{start(){throw Error('listener forbidden')},stop(){stopped++}},sendMessage(){throw Error('message forbidden')}}}}};
 let ok=false;try{await pairZaloPersonal({sdk,expectedOwner:'123456',qr:async()=>{qr++},timeoutMs:50});ok=true}catch{}
 if(ok!==(mode==='success')||stopped!==1||aborted<1)throw Error('Zalo settlement '+mode);
}
for(const matching of [true,false]){
 const owner=matching?'123456':'other';let qr=0;
 const wechat={startWeixinLoginWithQr:async()=>({sessionKey:'fixture',qrcodeUrl:'fixture'}),
  waitForWeixinLogin:async opts=>({connected:true,userId:owner,accountId:'123@im.bot',botToken:'fixture',baseUrl:'https://ilinkai.weixin.qq.com'})};
 const clawbot={requestLogin:async()=>({loginUrl:'fixture',zbsk:'fixture'}),waitForLogin:async()=>({connected:true,ownerId:owner,botId:'789',botToken:'fixture'})};
 for(const [fn,api] of [[pairWeChat,wechat],[pairClawBot,clawbot]]){
  let ok=false;try{await fn({api,expectedOwner:'123456',qr:async()=>{qr++},fetcher(){throw Error('network forbidden')},timeoutMs:50});ok=true}catch{}
  if(ok!==matching)throw Error('owner guard');
 }
 if(qr!==2)throw Error('missing QR');
}
console.log('three native personal pairing contracts passed without providers');
'''
        result=subprocess.run([os.environ['NETCLAW_TEST_NODE'],'--input-type=module','-e',code,'fixture',str(ROOT/'installer/native-comms/openclaw/personal-pair.mjs')],capture_output=True,timeout=15)
        self.assertEqual(0,result.returncode,result.stderr.decode())

if __name__=='__main__':unittest.main()
