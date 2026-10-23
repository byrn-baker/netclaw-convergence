import test from 'node:test';
import assert from 'node:assert/strict';
import { configurationInventory } from './configuration.js';
import { ragSearchHandler } from './rag-search.js';
const response=()=>({code:200,status(n){this.code=n;return this;},setHeader(){},json(value){this.value=value;return this;}});
test('configuration exposes presence without any credential fragments or unrelated environment values',()=>{
  const data=configurationInventory({rag:{env:['TOKEN','MISSING'],files:['local.env'],notes:'Setup'}},{TOKEN:'secret-1234',UNRELATED:'private'},'~/.openclaw/.env');
  assert.deepEqual(data.integrations[0].fields,[{key:'TOKEN',isSet:true},{key:'MISSING',isSet:false}]);
  assert.doesNotMatch(JSON.stringify(data),/secret|1234|private/);
});
test('RAG HTTP handler validates query and only dispatches retrieval with bounded arguments',async()=>{
  const calls=[];const handler=ragSearchHandler(async(...args)=>{calls.push(args);return {success:true,data:{results:[{citation:'[Runbook p.2]'}]}};});
  for(const body of [{query:''},{query:'x',k:21},{query:'x',collection:'../secret'},{query:'x'.repeat(4001)}]){const res=response();await handler({body},res);assert.equal(res.code,400);}
  const res=response();await handler({body:{query:' counters ',tool:'rag_delete',filters:{document_id:'untrusted'}}},res);
  assert.equal(res.code,200);assert.deepEqual(calls,[['rag_search',{query:'counters',collection:'documents',k:5},120]]);assert.equal(res.value.results[0].citation,'[Runbook p.2]');
});
test('RAG failures do not expose backend stderr and concurrent reads are bounded',async()=>{
  let release;const handler=ragSearchHandler(()=>new Promise(resolve=>{release=()=>resolve({success:false,error:'secret stderr'});}));
  const one=response();const p1=handler({body:{query:'a'}},one);const release1=release;
  const two=response();const p2=handler({body:{query:'b'}},two);const three=response();await handler({body:{query:'c'}},three);assert.equal(three.code,429);
  release1();release();await Promise.all([p1,p2]);assert.equal(one.code,503);assert.doesNotMatch(JSON.stringify(one.value),/secret/);
});
