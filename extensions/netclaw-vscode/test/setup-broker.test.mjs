import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {load} from './load.mjs';
const {SetupBroker,brokerCall}=await load('src/setup/broker.ts');
test('private window broker authenticates, rejects replay and unknown operations and expires on close',async()=>{
  const root=fs.mkdtempSync(path.join(fs.realpathSync('/tmp'),'nc-broker-test-'));fs.chmodSync(root,0o700);
  let calls=0;const broker=new SetupBroker(async(name,args)=>{calls++;return {state:'observed'};});
  try{
    const file=await broker.start(root,'fixture');
    assert.equal(fs.statSync(file).mode&0o777,0o600);
    assert.equal((await brokerCall(file,'netclaw_setup_observe',{})).state,'observed');
    const r=JSON.parse(fs.readFileSync(file)),request={protocol:1,registrationId:r.registrationId,sessionId:r.sessionId,requestId:'a'.repeat(32),token:r.token,operation:'netclaw_setup_observe',params:{}};
    const raw=()=>new Promise((resolve,reject)=>{const s=net.connect(r.socket);let bytes='';s.on('error',reject);s.on('data',b=>bytes+=b);s.on('end',()=>resolve(JSON.parse(bytes)));s.on('connect',()=>s.end(JSON.stringify(request)+'\n'));});
    assert.equal((await raw()).ok,true);assert.equal((await raw()).ok,false);
    await assert.rejects(brokerCall(file,'apply',{}));
    await assert.rejects(brokerCall(file,'netclaw_setup_observe',{command:'sh'}));
    await assert.rejects(brokerCall(file,'netclaw_setup_secret_entry',{planRef:'draft-fixture',owner:'claw',key:'KEY',value:'canary'}));
    assert.equal(calls,2);
    const saved=JSON.parse(fs.readFileSync(file));saved.token='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(saved));
    await assert.rejects(brokerCall(file,'netclaw_setup_observe',{}));
    broker.dispose();await assert.rejects(brokerCall(file,'netclaw_setup_observe',{}));
  }finally{broker.dispose();fs.rmSync(root,{recursive:true,force:true});}
});
test('registration symlinks and public permissions are refused before connecting',async()=>{
  const root=fs.mkdtempSync(path.join(fs.realpathSync('/tmp'),'nc-broker-test-'));const file=path.join(root,'registration.json');
  try{
    fs.writeFileSync(file,'{}',{mode:0o644});await assert.rejects(brokerCall(file,'netclaw_setup_observe',{}));
    const link=path.join(root,'link');fs.symlinkSync(file,link);await assert.rejects(brokerCall(link,'netclaw_setup_observe',{}));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
