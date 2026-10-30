import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {load} from './load.mjs';
const {SetupRuns}=await load('src/setup/runs.ts');
const {documents}=await load('src/setup/engine.ts');

test('reload restores references as unknown without starting an engine, serialized events preserve newest state',async()=>{
  let saved;const local={get:()=>saved,update:async(_,value)=>{await new Promise(r=>setTimeout(r,2));saved=value;}};
  const runs=new SetupRuns(local),plan={schema:1,source:{path:'/fixture/source'}};
  const first=runs.event({protocol:1,runId:'run-'+'a'.repeat(32),sequence:1,state:'applying'},plan,'/fixture/plan.json');
  const second=runs.event({protocol:1,runId:'run-'+'a'.repeat(32),sequence:2,state:'paused'},plan,'/fixture/plan.json');
  await Promise.all([first,second]);assert.equal(runs.saved().state,'paused');
  assert.throws(()=>runs.event({protocol:1,runId:saved.runId,sequence:2,state:'completed'},plan,'/fixture/plan.json'));
  saved.state='applying';assert.equal(new SetupRuns(local).saved().state,'unknown');
  assert.deepEqual(Object.keys(saved).sort(),['planFile','planHash','runId','source','state']);
});

test('large bounded documents require exact order, binding, length and digest',()=>{
  const data=Buffer.from(JSON.stringify({effects:Array(5000).fill({state:'unverified',phase:'components'})}));
  const start={protocol:1,type:'document-start',id:'a'.repeat(32),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
  const parts=[];for(let i=0;i<data.length;i+=32768)parts.push({protocol:1,type:'document-part',id:start.id,index:parts.length,data:data.subarray(i,i+32768).toString('base64')});
  const end={protocol:1,type:'document-end',id:start.id};let result;
  const receive=documents(value=>{result=value;});for(const value of [start,...parts,end])receive(Buffer.from(JSON.stringify(value)+'\n'));
  assert.equal(result.effects.length,5000);
  for(const bad of [{...parts[0],index:2},{...parts[0],id:'b'.repeat(32)},end]){
    const decoder=documents(()=>assert.fail('invalid document accepted'));decoder(Buffer.from(JSON.stringify(start)+'\n'));
    assert.throws(()=>decoder(Buffer.from(JSON.stringify(bad)+'\n')));
  }
  const decoder=documents(()=>assert.fail('changed digest accepted'));
  for(const value of [{...start,sha256:'0'.repeat(64)},...parts])decoder(Buffer.from(JSON.stringify(value)+'\n'));
  assert.throws(()=>decoder(Buffer.from(JSON.stringify(end)+'\n')));
});
