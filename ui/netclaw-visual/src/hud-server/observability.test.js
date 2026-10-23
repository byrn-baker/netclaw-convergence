import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aggregateUsage, readUsage, runtimeInventory } from './tokenomics.js';
import { documentContent } from './documentation.js';
import { logRows, redactLogs, tailFile, mountLogs } from './logs.js';
const tmp=t=>{const d=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'hud-observe-')));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
test('tokenomics keeps recorded costs, cache counters and missing coverage separate; no message content escapes',()=>{
  const entry={id:'a',type:'message',message:{role:'assistant',model:'provider/model',provider:'provider',content:'PRIVATE',usage:{input:10,output:4,cacheRead:5,cacheWrite:2,cost:{total:.02}}}};
  const line=JSON.stringify(entry);const out=aggregateUsage([{source:'s',line},{source:'s',line},{source:'s',line:JSON.stringify({...entry,id:'b',message:{...entry.message,usage:{input:7,output:2,cost:{total:-9}}}})},{source:'s',line:JSON.stringify({...entry,id:'c',message:{role:'assistant'}})}]);
  assert.equal(out.records,2);assert.equal(out.missingUsage,1);assert.equal(out.groups[0].input,17);assert.equal(out.groups[0].cacheRead,5);assert.equal(out.groups[0].costUsd,.02);assert.equal(out.groups[0].costRecords,1);assert.equal(out.groups[0].incompleteTokenRecords,1);assert.doesNotMatch(JSON.stringify(out),/PRIVATE/);
});
test('usage reader excludes symlinks and oversized files; missing source never reports a false zero',t=>{
  const dir=tmp(t);fs.writeFileSync(path.join(dir,'a.jsonl'),JSON.stringify({type:'message',message:{role:'assistant'}}));fs.symlinkSync('/etc/passwd',path.join(dir,'b.jsonl'));fs.writeFileSync(path.join(dir,'c.jsonl'),'x'.repeat(2*1024*1024+1));
  const out=readUsage(dir);assert.equal(out.missingUsage,1);assert.equal(out.skippedFiles,1);assert.equal(readUsage(path.join(dir,'missing')).available,false);
});
test('runtime inventory strips commands, environment, URLs and secrets',()=>{
  const out=runtimeInventory({agents:{defaults:{model:{primary:'local/model',fallbacks:['local/fallback']}}},mcp:{servers:{rag:{url:'https://secret',headers:{authorization:'secret'},tools:['rag_search']}}}});assert.equal(out.mcp_servers[0].transport,'HTTP');assert.doesNotMatch(JSON.stringify(out),/secret|authorization/);
});
test('documentation reader allows only indexed files and rejects traversal IDs and symlink substitutions',t=>{
  const root=tmp(t);fs.writeFileSync(path.join(root,'guide.md'),'# Guide');const entries=[{id:'ok',path:'guide.md'}];assert.equal(documentContent(root,entries,'ok').content,'# Guide');assert.throws(()=>documentContent(root,entries,'../guide.md'));fs.symlinkSync('/etc/passwd',path.join(root,'linked.md'));assert.throws(()=>documentContent(root,[{id:'bad',path:'linked.md'}],'bad'));
});
test('log reader redacts credential lines and PEM blocks before severity/text filtering',()=>{
  const value='INFO hello\nERROR password=supersecret\n{"level":"warning","message":"heartbeat late","time":"2026-09-28T12:00:00Z"}\n-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----';
  const clean=redactLogs(value);assert.doesNotMatch(clean,/supersecret|\nprivate/);const rows=logRows(value,{query:'heartbeat',severity:'warning'});assert.equal(rows.length,1);assert.equal(rows[0].timestamp,'2026-09-28T12:00:00Z');
});
test('log files are bounded regular files; symlinks cannot read arbitrary content',t=>{
  const dir=tmp(t),file=path.join(dir,'service.log');fs.writeFileSync(file,('INFO event\n').repeat(50000));const data=tailFile(file);assert.equal(data.truncated,true);assert.ok(data.content.length<=256*1024);assert.ok(logRows(data.content).length<=250);fs.symlinkSync(file,path.join(dir,'link'));assert.throws(()=>tailFile(path.join(dir,'link')));
});
test('logging route accepts fixed IDs only and no shell expression or arbitrary path',async()=>{
  const routes={};let called;mountLogs({get:(url,fn)=>routes[url]=fn},'/synthetic',{readFile:async file=>{called=file;return{content:'ERROR fixture',truncated:false};}});
  const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},setHeader(){},json(body){this.body=body;return this;}});
  const bad=response();await routes['/api/hud/logs/:id']({params:{id:'../../etc/passwd'},query:{}},bad);assert.equal(bad.statusCode,404);assert.equal(called,undefined);
  const good=response();await routes['/api/hud/logs/:id']({params:{id:'mesh'},query:{q:'$(command)',severity:'all'}},good);assert.equal(called,'/tmp/bgp-daemon-v2.log');assert.deepEqual(good.body.rows,[]);
});
test('empty scoped MCP registry cannot inherit legacy global servers and main-agent model override wins',()=>{
  const result=runtimeInventory({agents:{defaults:{model:'default/model'},list:[{id:'main',model:'agent/model'}]},mcp:{servers:{}},mcpServers:{'global-server':{}}});assert.equal(result.llm.primary_model,'agent/model');assert.deepEqual(result.mcp_servers,[]);
});
test('security settings separate LAB, federation policy and guard modes without exposing secret fields',async()=>{
  const {securitySettings}=await import('./security-posture.js');const result=securitySettings({NETCLAW_LAB_MODE:'true',N2N_RISK_MODE:'production',SECRET:'private'},{security:{mode:'defenseclaw',key:'private'}},{guardrail:{mode:'observe',key:'private'}});assert.equal(result.labMode,true);assert.equal(result.riskMode,'production');assert.equal(result.guardMode,'observe');assert.doesNotMatch(JSON.stringify(result),/private/);assert.equal(securitySettings({},null,null).defenseMode,'unknown');
});
test('OpenShell probes use only fixed read-only arguments and redact output',async()=>{
  const {openshellStatus}=await import('./security-posture.js');const calls=[];const result=await openshellStatus((command,args,opts,callback)=>{calls.push([command,args]);assert.equal(opts.timeout,4000);callback(null,'token=private');});assert.deepEqual(calls,[['openshell',['gateway','status']],['openshell',['sandbox','list']]]);assert.doesNotMatch(JSON.stringify(result),/private/);
});
