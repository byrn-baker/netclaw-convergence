import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from './load.mjs';
const {SetupDraft}=await load('src/setup/plan.ts');
const schema=JSON.parse(fs.readFileSync('../../config/claw-plan.schema.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('../../config/components/catalog.json','utf8'));
test('partial intent remains a draft, stores gaps, and refuses literal/unknown fields',()=>{
  const draft=new SetupDraft(schema,catalog);
  draft.replace({schema:1,shape:'risk',assumptions:[],unresolved:['host','members']},0);
  assert.equal(draft.complete,false);assert.equal(draft.snapshot().answers.unresolved.length,2);
  assert.throws(()=>draft.replace({schema:1,approved:true},1));
  assert.throws(()=>draft.replace({schema:1,claws:[{settings:{ANTHROPIC_API_KEY:{kind:'value',value:'private-canary'}}}]},1));
  assert.throws(()=>draft.replace({schema:1,assumptions:['sk-ant-private-canary']},1));
});
test('harness changes preview discarded dependent choices, update inherited members and preserve overrides',()=>{
  const draft=new SetupDraft(schema,catalog);
  draft.replace({schema:1,shape:'risk',claws:[
    {id:'border',role:'border',harness:'openclaw',provider:{id:'anthropic'},settings:{}},
    {id:'inherit',role:'member',harness:'openclaw',harnessChoice:'inherit',provider:{id:'anthropic'}},
    {id:'explicit',role:'member',harness:'openclaw',harnessChoice:'explicit',provider:{id:'openai'}}]},0);
  const change={path:'/claws/0/harness',value:'hermes'};
  assert.ok(draft.preview(change).discarded.includes('/claws/0/provider'));
  assert.throws(()=>draft.update(change,1,false));
  draft.update(change,1,true);const claws=draft.snapshot().answers.claws;
  assert.equal(claws[0].harness,'hermes');assert.equal(claws[0].provider,undefined);
  assert.equal(claws[1].harness,'hermes');assert.equal(claws[1].provider,undefined);
  assert.equal(claws[2].harness,'openclaw');assert.equal(claws[2].provider.id,'openai');
  assert.throws(()=>draft.update(change,1,true));
});
test('shape follows primary runtime choices and discards only reviewed dependent members and capabilities',()=>{
  const draft=new SetupDraft(schema,catalog);
  draft.replace({schema:1,claws:[{id:'primary',harness:'hermes',provider:{id:'anthropic'},channels:[],settings:{}}]},0);
  draft.update({path:'/shape',value:'focused'},1,true);
  assert.equal(draft.snapshot().answers.claws[0].harness,'hermes');
  assert.equal(draft.snapshot().answers.claws[0].role,'focused');
  const next=draft.snapshot();next.answers.claws[0].capabilities={profile:'minimal',components:['subnet-calc'],skills:[]};
  draft.replace(next.answers,next.revision);
  assert.ok(draft.preview({path:'/shape',value:'risk'}).discarded.includes('/claws/0/capabilities'));
  assert.throws(()=>draft.update({path:'/shape',value:'risk'},3));
  draft.update({path:'/shape',value:'risk'},3,true);
  assert.equal(draft.snapshot().answers.claws[0].role,'border');
  assert.equal(draft.snapshot().answers.claws[0].provider.id,'anthropic');
  assert.equal(draft.snapshot().answers.claws[0].capabilities,undefined);
  assert.equal(draft.complete,false);
});
