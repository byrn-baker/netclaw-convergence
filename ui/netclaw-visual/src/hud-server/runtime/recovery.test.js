import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { Bindings } from '../bindings.js';
import { mountHermesChat } from './routes.js';
import { mountHermesIntent } from './intent.js';

test('Canvas setup retry after binding restart retains original seed through later turns',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'canvas-157-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const installation={kind:'hermes',installationId:'seed-fixture'};
 let bindings=new Bindings(dir,Date.now,installation);const cookie=bindings.create();
 const prefix=[{role:'user',content:'ancestor question'},{role:'assistant',content:'ancestor answer'}];
 const opens=[],submits=[];let fail=true;
 const runtime={call:async(name,args)=>{
  if(name==='conversation_open'){opens.push(structuredClone(args));if(fail){fail=false;throw Error('before bridge');}return {state:'open'};}
  if(name==='submit'){submits.push(args);return {state:'completed',output:'answer',requestId:args.requestId};}
  throw Error(name);
 }};
 const handlers=()=>{const routes={};const app={get(){},post:(route,fn)=>routes[route]=fn};mountHermesChat(app,{runtime,bindings});return routes;};
 const send=async(nonce,context)=>{
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await handlers()['/api/chat/requests']({path:'/api/chat/requests',headers:{cookie:'nc_hud='+cookie},body:{hudThread:'canvas:branch',clientNonce:nonce,context:[...context,{role:'user',content:'follow-up'}]}},res);
  return res;
 };
 const first=await send('first',prefix);assert.equal(first.statusCode,503);assert.equal(first.body.mayHaveExecuted,false);assert.equal(submits.length,0);
 bindings=new Bindings(dir,Date.now,installation);
 const retry=await send('retry',[{role:'user',content:'changed unsent ancestry'}]);
 assert.equal(retry.statusCode,200);assert.equal(submits.length,1);
 assert.deepEqual(opens.map(o=>o.seed),[prefix,prefix]);
 await send('later',[...prefix,{role:'user',content:'later history'}]);
 assert.deepEqual(opens[2].seed,prefix);assert.equal(submits.length,2);
 assert.equal(new Set(opens.map(o=>o.conversationId)).size,1);
});

test('Hermes seed is immutable, owner-scoped, byte-bounded and absent on legacy tasks',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'seed-157-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bindings=new Bindings(dir),cookie=bindings.create(),foreign=bindings.create();
 const seed=[{role:'user',content:'original'}],task=bindings.task(cookie,'new','hermes',seed);
 seed[0].content='mutated';assert.deepEqual(bindings.ownedChat(cookie,task.id,'hermes').hermesSeed,[{role:'user',content:'original'}]);
 assert.throws(()=>bindings.ownedChat(foreign,task.id,'hermes'));
 assert.equal(bindings.task(cookie,'empty','hermes',[]).hermesSeed.length,0);
 const legacy=bindings.task(cookie,'legacy','hermes');
 assert.equal(bindings.task(cookie,'legacy','hermes',seed).hermesSeed,undefined);
 assert.equal(bindings.ownedChat(cookie,legacy.id,'hermes').hermesSeed,undefined);
 assert.throws(()=>bindings.task(cookie,'wrong','main',[]));
 assert.throws(()=>bindings.task(cookie,'oversize','hermes',[{role:'user',content:'🔥'.repeat(300000)}]));
 assert.throws(()=>bindings.task(cookie,'system','hermes',[{role:'system',content:'invalid'}]));
 const original=fs.readFileSync(bindings.file(cookie));const state=bindings.read(cookie);state.extra='x'.repeat(8*1024*1024);
 assert.throws(()=>bindings.save(cookie,state));assert.deepEqual(fs.readFileSync(bindings.file(cookie)),original);
 assert.equal(fs.statSync(bindings.file(cookie)).mode&0o077,0);
});
test('v2 binding rejects another installation and migrates legacy OpenClaw only', t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bindings-148-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const legacy=new Bindings(dir),cookie=legacy.create();legacy.task(cookie,'old');
 const hermes=new Bindings(dir,Date.now,{kind:'hermes',installationId:'B'});assert.throws(()=>hermes.read(cookie));
 const current=new Bindings(dir,Date.now,{kind:'openclaw',installationId:'A'});assert.equal(current.read(cookie).version,2);assert.ok(fs.existsSync(current.file(cookie)+'.v1-backup'));
 assert.throws(()=>new Bindings(dir,Date.now,{kind:'openclaw',installationId:'C'}).read(cookie));
 // Explicit rollback restores the untouched legacy binding, then migration is repeatable.
 const backup=fs.readFileSync(current.file(cookie)+'.v1-backup');
 fs.writeFileSync(current.file(cookie),backup);
 assert.equal(new Bindings(dir).read(cookie).version,1);
 assert.equal(current.read(cookie).version,2);
 assert.deepEqual(fs.readFileSync(current.file(cookie)+'.v1-backup'),backup);
});

test('Intent preparation failure is known nonexecution, admission failure remains uncertain',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'intent-148-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bindings=new Bindings(dir,Date.now,{kind:'hermes',installationId:'A'}),cookie=bindings.create();
 let failAt='conversation_open';const calls=[];
 const runtime={call:async name=>{calls.push(name);if(name===failAt)throw Error('controlled failure');return {};}};
 const app=express();app.use(express.json());mountHermesIntent(app,{runtime,bindings});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const send=id=>fetch(`http://127.0.0.1:${server.address().port}/api/terminal/intent/runs`,{method:'POST',headers:{Cookie:'nc_hud='+cookie,'Content-Type':'application/json'},body:JSON.stringify({id,request:'Read-only acceptance'})});
 const failed=await send('11111111-1111-4111-8111-111111111111');
 assert.equal(failed.status,503);assert.equal((await failed.json()).mayHaveExecuted,false);assert.deepEqual(calls,['conversation_open']);
 failAt='submit';const unknown=await send('22222222-2222-4222-8222-222222222222');
 assert.equal(unknown.status,202);assert.equal((await unknown.json()).mayHaveExecuted,true);
 assert.deepEqual(calls,['conversation_open','conversation_open','submit']);
});
test('owned request routes reject foreign owners before upstream and recheck after I/O',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'routes-148-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bindings=new Bindings(dir,Date.now,{kind:'hermes',installationId:'A'}),cookie=bindings.create(),foreign=bindings.create();
 const task=bindings.task(cookie,'t','hermes'),request=bindings.request(cookie,task.id,'n','hash');
 let calls=0,revoke=false;
 const runtime={call:async()=>{calls++;if(revoke)bindings.revoke(cookie);return {state:'completed',output:'PRIVATE'};}};
 const app=express();app.use(express.json());mountHermesChat(app,{runtime,bindings});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const url=`http://127.0.0.1:${server.address().port}/api/chat/requests/${request.id}`;
 assert.equal((await fetch(url,{headers:{Cookie:'nc_hud='+foreign}})).status,404);assert.equal(calls,0);
 revoke=true;const response=await fetch(url,{headers:{Cookie:'nc_hud='+cookie}});assert.equal(response.status,503);assert.ok(!(await response.text()).includes('PRIVATE'));
});

test('reviewed conversation recovery validates owner and explicit boolean; history restores only owned identity',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'capacity-159-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bindings=new Bindings(dir,Date.now,{kind:'hermes',installationId:'A'}),cookie=bindings.create(),foreign=bindings.create();
 const task=bindings.task(cookie,'old','hermes'),request=bindings.request(cookie,task.id,'n','hash');bindings.requestState(cookie,request.id,'unknown');
 let revoke=false;const calls=[];
 const runtime={call:async(name,args)=>{calls.push([name,args]);if(revoke)bindings.revoke(cookie);return name==='history'?{messages:[]}:{state:'open'};}};
 const app=express();app.use(express.json());mountHermesChat(app,{runtime,bindings});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const url=`http://127.0.0.1:${server.address().port}/api/chat/conversations`;
 const post=(body,owner=cookie,suffix='')=>fetch(url+suffix,{method:'POST',headers:{Cookie:'nc_hud='+owner,'Content-Type':'application/json'},body:JSON.stringify(body)});
 for(const body of [{releaseUncertainCapacity:true},{acknowledgedUncertainRequestId:request.id,releaseUncertainCapacity:'true'}])assert.equal((await post(body)).status,409);
 const review={acknowledgedUncertainRequestId:request.id,releaseUncertainCapacity:true};
 assert.equal((await post(review,foreign)).status,409);assert.equal(calls.length,0);
 assert.equal((await post(review)).status,201);assert.equal(calls[0][1].releaseUncertainCapacity,true);assert.equal(calls[0][1].acknowledgedUncertainRequestId,request.id);
 assert.equal((await post({acknowledgedUncertainRequestId:request.id})).status,201);assert.equal(calls[1][1].releaseUncertainCapacity,undefined);
 const history=await post({},cookie,`/${task.id}/open`);assert.equal(history.status,200);
 assert.deepEqual((await history.json()).pendingRequest,{requestId:request.id,state:'unknown'});
 const before=calls.length;assert.equal((await post({},foreign,`/${task.id}/open`)).status,404);assert.equal(calls.length,before);
 revoke=true;assert.equal((await post(review)).status,409);
});
