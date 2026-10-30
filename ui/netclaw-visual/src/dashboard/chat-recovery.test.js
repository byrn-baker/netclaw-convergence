import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryAnchor,mergeRecoveredTurn,recoveredDraft} from './chat-recovery.js';
const before=[{role:'user',content:'same question'},{role:'assistant',content:'same answer'}];
const receipt=async()=>({requestId:'request-two',submission:{prompt:'same question',nonce:'second',anchor:await recoveryAnchor(before)},response:'same answer'});
test('recovery uses submission identity and preserves repeated identical questions',async()=>{
 const data=await receipt(),result=await mergeRecoveredTurn(before,data);
 assert.equal(result.length,4);assert.equal(result[2].requestId,'request-two');
 assert.deepEqual(await mergeRecoveredTurn(result,data),result);
 assert.equal(recoveredDraft('UNSENT','same question'),'UNSENT');
 assert.equal(recoveredDraft('','same question'),'');
 assert.equal(recoveredDraft('same question','same question'),'');
 assert.equal(recoveredDraft('same question ','same question'),'same question ');
});
test('native history is adopted only at the complete anchored prefix and position',async()=>{
 const data=await receipt(),user={role:'user',content:'same question'},answer={role:'assistant',content:'same answer'};
 for(const history of [[...before,user],[...before,user,answer]]) {
  const result=await mergeRecoveredTurn(history,data);assert.equal(result.length,4);
  assert.equal(result[2].requestId,'request-two');assert.equal(result[3].requestId,'request-two');
 }
 const later={role:'user',content:'a later turn'};
 const result=await mergeRecoveredTurn([...before,user,answer,later],data);
 assert.equal(result.length,5);assert.deepEqual(result.at(-1),later);
 for(const bad of [[],before.slice(1),[...before,{role:'user',content:'different'}],
    [...before,user,{role:'assistant',content:'partial'}],[{role:'user',content:'changed'},before[1],user,answer]]) {
  const original=structuredClone(bad);await assert.rejects(mergeRecoveredTurn(bad,data),/cannot be matched safely/);assert.deepEqual(bad,original);
 }
});
test('full prefix includes older messages and legacy missing origin never uses draft',async()=>{
 const long=Array.from({length:80},(_,i)=>({role:i%2?'assistant':'user',content:String(i)}));
 const anchor=await recoveryAnchor(long);const changed=structuredClone(long);changed[0].content='changed';
 assert.notEqual((await recoveryAnchor(changed)).sha256,anchor.sha256);
 assert.equal((await recoveryAnchor(long.map(m=>({...m,requestId:'presentation'})))).sha256,anchor.sha256);
 await assert.rejects(mergeRecoveredTurn([],{requestId:'legacy',response:'answer'}),/cannot be matched safely/);
});
