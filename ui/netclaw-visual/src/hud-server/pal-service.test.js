import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PalService } from './pal-service.js';
import { PalStore } from './pal-store.js';

function fixture(t,overrides={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'netclaw-pal-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  let now=1000000,valid=true,queries=0,creates=0,ends=0;
  const provider={validate:async()=>true,create:async()=>{creates++;return {conversation_id:'c123',conversation_url:'https://tavus.daily.co/test',meeting_token:'secret-room-token'};},end:async()=>{ends++;},conversations:async()=>({data:[]}),...overrides.provider};
  const store=new PalStore(dir);
  const service=new PalService({store,provider,clock:()=>now,config:()=>({enabled:true,key:'secret-provider-key',palId:'p123',faceId:'r123'}),audit:async()=>true,authorize:owner=>{if(!valid||!['owner','other'].includes(owner))throw Error('revoked');},query:async()=>{queries++;return{status:'ok',answer:'Private 10.1.2.3 topology and secret credentials.'};},...overrides,provider});
  const confirm=(remainingSeconds=1200)=>service.confirm('owner',{remainingSeconds,freePlanConfirmed:true,billingBoundConfirmed:true});
  const event=(question='Explain BGP',key='call_1')=>({message_type:'conversation',event_type:'conversation.tool_call',conversation_id:'c123',properties:{name:'netclaw_pal_query',tool_call_id:key,arguments:JSON.stringify({question})}});
  return {service,store,provider,confirm,event,advance:n=>now+=n,revoke:()=>valid=false,counts:()=>({queries,creates,ends})};
}
test('no allowance, expired confirmation or unbounded billing means no provider create',async t=>{
  const f=fixture(t);await assert.rejects(()=>f.service.start('owner'),/Confirm/);
  assert.throws(()=>f.service.confirm('owner',{remainingSeconds:1200,freePlanConfirmed:true}),/bounded billing/);
  f.confirm();f.advance(900001);await assert.rejects(()=>f.service.start('owner'),/Confirm/);assert.equal(f.counts().creates,0);
});
test('concurrent starts reserve atomically across service instances; confirmed balance cannot refill',async t=>{
  const f=fixture(t);f.confirm();
  const another=new PalService({...f.service,store:new PalStore(f.store.directory)});
  const result=await Promise.allSettled([f.service.start('owner'),another.start('owner')]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.counts().creates,1);
  assert.equal(f.store.read().consumed,180);
  const active=result.find(r=>r.status==='fulfilled').value;
  await f.service.end('owner',active.id);f.confirm(1200);assert.equal(f.service.status('owner').remainingSeconds,1020);
});
test('lost create response retains budget and blocks repeated creation across restart',async t=>{
  const f=fixture(t,{provider:{create:async()=>{throw Error('lost');}}});f.confirm();
  await assert.rejects(()=>f.service.start('owner'),/Reconcile/);
  const state=new PalStore(f.store.directory).read();assert.equal(state.consumed,180);
  assert.equal(Object.values(state.sessions)[0].state,'unknown');
  await assert.rejects(()=>f.service.start('owner'),/already active/);
});
test('end failure retains busy state and sweep confirms cleanup after deadline',async t=>{
  let fails=true;
  const f=fixture(t,{provider:{end:async()=>{if(fails)throw Error('timeout');}}});f.confirm();const call=await f.service.start('owner');
  await assert.rejects(()=>f.service.end('owner',call.id));assert.equal(f.service.status('owner').busy,true);
  fails=false;f.advance(121000);await f.service.sweep();assert.equal(f.service.status('owner').busy,false);assert.equal(f.store.read().consumed,180);
});
test('exact answer stays local; explicit speech approval releases stored text only',async t=>{
  const f=fixture(t);f.confirm();const call=await f.service.start('owner');
  const result=await f.service.turn('owner',call.id,f.event());
  assert.match(result.localAnswer,/10.1.2.3/);assert.doesNotMatch(JSON.stringify(result.event),/10.1.2.3|credentials/);
  assert.throws(()=>f.service.approveSpeech('other',call.id,'call_1'),/unavailable/);
  assert.equal(f.service.approveSpeech('owner',call.id,'call_1').properties.text,result.localAnswer);
  await f.service.end('owner',call.id);assert.throws(()=>f.service.approveSpeech('owner',call.id,'call_1'),/active/);
});
test('identity, event size, operation validation and replay protect dispatch',async t=>{
  const f=fixture(t);f.confirm();const call=await f.service.start('owner');
  await assert.rejects(()=>f.service.turn('other',call.id,f.event()),/unavailable/);
  await assert.rejects(()=>f.service.turn('owner',call.id,{...f.event(),conversation_id:'other'}),/Invalid/);
  const bad=f.event();bad.properties.name='exec';await assert.rejects(()=>f.service.turn('owner',call.id,bad),/Unsupported/);
  await assert.rejects(()=>f.service.turn('owner',call.id,f.event('😀'.repeat(1000))),/Invalid/);
  await f.service.turn('owner',call.id,f.event());await f.service.turn('owner',call.id,f.event());assert.equal(f.counts().queries,1);
  await assert.rejects(()=>f.service.turn('owner',call.id,f.event('different')),/replay/);
  f.revoke();await assert.rejects(()=>f.service.turn('owner',call.id,f.event()),/revoked/);
});
test('audit failure prevents create and query, but never prevents end',async t=>{
  let audit=true;const f=fixture(t,{audit:async()=>audit});f.confirm();audit=false;
  await assert.rejects(()=>f.service.start('owner'),/GAIT/);assert.equal(f.counts().creates,0);
  audit=true;const call=await f.service.start('owner');audit=false;
  await assert.rejects(()=>f.service.turn('owner',call.id,f.event()),/GAIT/);assert.equal(f.counts().queries,0);
  await f.service.end('owner',call.id);assert.equal(f.counts().ends,1);
});
test('ambiguous creation reconciles only the exact server-assigned conversation name',async t=>{
  const f=fixture(t,{provider:{create:async()=>{throw Error('lost');}}});f.confirm();await assert.rejects(()=>f.service.start('owner'));
  const s=Object.values(f.store.read().sessions)[0];
  f.provider.conversations=async()=>({data:[{conversation_name:'unrelated',conversation_id:'cx'}]});
  await assert.rejects(()=>f.service.reconcile('owner',s.id),/ambiguous/);
  f.provider.conversations=async()=>({data:[{conversation_name:`netclaw-pal-${s.id}`,conversation_id:'c123'}]});
  await f.service.reconcile('owner',s.id);assert.equal(f.service.status('owner').busy,false);
});
test('unsafe provider join URL is never returned and known conversation is ended',async t=>{
  const f=fixture(t,{provider:{create:async()=>({conversation_id:'c123',conversation_url:'https://attacker.example/',meeting_token:'secret'})}});f.confirm();
  await assert.rejects(()=>f.service.start('owner'));assert.equal(f.counts().ends,1);
});
test('ledger corruption and existing lock fail closed',t=>{
  const f=fixture(t);f.store.ensure();fs.writeFileSync(path.join(f.store.directory,'ledger.lock'),'crash');
  assert.throws(()=>f.confirm(),/locked/);fs.unlinkSync(path.join(f.store.directory,'ledger.lock'));
  fs.writeFileSync(f.store.file,'not json');assert.throws(()=>f.service.status('owner'),/unavailable/);
});
test('revocation during an answer prevents response delivery; late answers never speak',async t=>{
  let release;
  const f=fixture(t,{query:()=>new Promise(resolve=>{release=resolve;})});
  f.confirm();const call=await f.service.start('owner');
  const pending=f.service.turn('owner',call.id,f.event());
  await new Promise(resolve=>setImmediate(resolve));
  f.revoke();release({status:'ok',answer:'local only'});
  await assert.rejects(()=>pending,/revoked/);
  const g=fixture(t);g.confirm();const other=await g.service.start('owner');
  await g.service.turn('owner',other.id,g.event());g.advance(121000);
  assert.equal(g.service.turnResult(g.store.read().sessions[other.id],'call_1').event,null);
  assert.throws(()=>g.service.approveSpeech('owner',other.id,'call_1'),/active/);
});
test('conservative budget exhausts after six calls and does not silently renew',async t=>{
  const f=fixture(t);
  for(let i=0;i<6;i++){f.confirm();const call=await f.service.start('owner');await f.service.end('owner',call.id);}
  f.confirm();assert.equal(f.service.status('owner').remainingSeconds,120);
  await assert.rejects(()=>f.service.start('owner'),/Insufficient/);
  f.advance(30*86400000);f.confirm();assert.equal(f.service.status('owner').remainingSeconds,120);
});
