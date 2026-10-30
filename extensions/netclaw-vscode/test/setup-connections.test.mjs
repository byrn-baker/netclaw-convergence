import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {load} from './load.mjs';
import {serviceFixture} from './claw-fixture.mjs';
import {readManaged,prepareWrite,applyWrite,json} from '../../../scripts/lib/claw-files.mjs';
import {prepareLifecycle,applyLifecycle} from '../../../scripts/lib/claw-services.mjs';
const {inspectSetupConnection}=await load('src/setup/connections.ts');
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const candidate=(n,harness)=>({id:'claw-'+n,label:'Fixture '+n,harness,installationId:id(n),home:'/fixture/'+n,workspace:harness==='hermes'?'/fixture/'+n:'/fixture/'+n+'/workspace',url:'http://127.0.0.1:'+(3000+n)});
function client(c,overrides={}){let closed=false,revoke=0;return {get closed(){return closed;},get revoke(){return revoke;},connect:async()=>({kind:c.harness,installationId:c.installationId,readiness:{ready:true}}),session:async()=>{},request:async(method,route)=>{
  if(route.endsWith('/revoke')){revoke++;return {};}
  return {kind:c.harness,installationId:c.installationId,home:c.home,expectedWorkspace:c.harness==='openclaw'?c.workspace:undefined,...overrides};
},close:()=>{closed=true;}};}
test('same-harness and mixed connections each verify their own identity/home and revoke temporary sessions',async()=>{
  const claws=[candidate(1,'openclaw'),candidate(2,'openclaw'),candidate(3,'hermes'),candidate(4,'hermes')];
  for(const c of claws){const native=client(c);assert.deepEqual(await inspectSetupConnection(c,native),c);assert.equal(native.closed,true);assert.equal(native.revoke,1);}
  for(const c of claws){const native=client(c,{installationId:id(8)});await assert.rejects(inspectSetupConnection(c,native));assert.equal(native.closed,true);}
  await assert.rejects(inspectSetupConnection(claws[0],client(claws[0],{home:claws[1].home})));
  await assert.rejects(inspectSetupConnection(claws[0],client(claws[0],{expectedWorkspace:claws[1].workspace})));
  await assert.rejects(inspectSetupConnection({...claws[2],workspace:claws[3].home},client(claws[2])));
});
test('all four harness switching pairs isolate reviewed saves and actual owned process restarts',async()=>{
  const fixtures=[];
  const processRecord=f=>json(path.join(f.home,'netclaw-hud/management/services/hud.process.json'));
  try{
    for(const harness of ['openclaw','openclaw','hermes','hermes'])fixtures.push(await serviceFixture(harness));
    const candidates=fixtures.map((f,i)=>({...candidate(i+1,f.target.kind),installationId:f.target.installationId,home:f.home,workspace:f.workspace,url:f.url}));
    for(const [from,to] of [[0,1],[0,2],[2,0],[2,3]]){
      await inspectSetupConnection(candidates[from],client(candidates[from]));
      const selected=await inspectSetupConnection(candidates[to],client(candidates[to]));
      const f=fixtures.find(row=>row.target.installationId===selected.installationId);
      const before=await readManaged(f.target,'USER.md'),neighbors=fixtures.filter(row=>row!==f).map(row=>({row,pid:processRecord(row).pid,content:fs.readFileSync(path.join(row.workspace,'USER.md'))}));
      const content=`Fixture switch ${from} to ${to}\n`,write=await prepareWrite(f.target,{name:'USER.md',baseline:before.revision,content});
      await assert.rejects(applyWrite(fixtures[from].target,{...write,content}));
      const saved=await applyWrite(f.target,{...write,content});assert.equal(saved.outcome,'verified');
      const pid=processRecord(f).pid,restart=await prepareLifecycle(f.target,{action:'restart'});
      await assert.rejects(applyLifecycle(fixtures[from].target,{id:restart.id,acknowledged:true}));
      const result=await applyLifecycle(f.target,{id:restart.id,acknowledged:true});assert.equal(result.outcome,'verified');
      assert.notEqual(processRecord(f).pid,pid);assert.equal((await readManaged(f.target,'USER.md')).content,content);
      for(const neighbor of neighbors){
        assert.equal(processRecord(neighbor.row).pid,neighbor.pid);
        assert.deepEqual(fs.readFileSync(path.join(neighbor.row.workspace,'USER.md')),neighbor.content);
        assert.equal((await fetch(neighbor.row.url)).status,200);
      }
    }
  }finally{for(const f of fixtures)await f.close();}
});
