import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Bindings } from './bindings.js';
import { mountChatHistory, visibleChatMessages } from './chat-history.js';
function fixture(t, call) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chat139-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bindings=new Bindings(dir), cookie=bindings.create(), task=bindings.task(cookie,'original','engineer');
 const routes=new Map();const app={get:(p,f)=>routes.set(p,f),post:(p,f)=>routes.set(p,f)};
 mountChatHistory(app,{bindings,config:()=>({agents:{entries:{engineer:{}}}}),configPath:'/fixture/config',runtime:{catalog:async()=>[]},call});
 const invoke=async(route,who=cookie,id=task.id)=>{const res={code:200,set(){return this;},status(code){this.code=code;return this;},json(value){this.body=value;return this;}};await routes.get(route)({headers:{cookie:`nc_hud=${who}`},params:{id}},res);return res;};
 return {bindings,cookie,task,invoke};
}
test('history projection excludes system, tools, reasoning and raw runtime metadata',()=>{
 assert.deepEqual(visibleChatMessages([{role:'system',content:'private'}, {role:'toolResult',content:'private'}, {role:'assistant',content:[{type:'thinking',text:'private'},{type:'toolCall',name:'private'},{type:'text',text:'Answer'}],usage:{secret:1}}, {role:'user',content:'Question'}]),[{role:'assistant',content:'Answer'},{role:'user',content:'Question'}]);
});
test('list is cookie/agent scoped; legacy resume reuses original gateway context',async t=>{
 let key;
 const f=fixture(t,async(method,params)=>{if(method==='sessions.list')return {sessions:[{key:f.task.gatewayKey,derivedTitle:'Owned chat',updatedAt:5},{key:'agent:engineer:hud:other',derivedTitle:'Private other'}]};key=params.sessionKey;return {messages:[{role:'user',content:'Old question'},{role:'assistant',content:'Old answer'}],hasMore:true,sessionInfo:{}};});
 f.bindings.task(f.cookie,'different-agent','other');
 const legacy=f.bindings.read(f.cookie);delete legacy.tasks[f.task.id].publicThread;f.bindings.save(f.cookie,legacy);
 const list=await f.invoke('/api/chat/conversations');assert.equal(list.body.conversations.length,1);assert.equal(list.body.conversations[0].title,'Owned chat');assert.doesNotMatch(JSON.stringify(list.body),/Private other|gatewayKey/);
 const opened=await f.invoke('/api/chat/conversations/:id/open');assert.equal(opened.code,200);assert.equal(key,f.task.gatewayKey);assert.equal(opened.body.truncated,true);
 assert.equal(f.bindings.task(f.cookie,opened.body.thread,'engineer').gatewayKey,key);
 assert.equal(f.bindings.task(f.cookie,'original','engineer').gatewayKey,key);
 assert.equal(f.bindings.lookupTask(f.cookie,opened.body.thread,'engineer').id,f.task.id);
 assert.equal((await f.invoke('/api/chat/conversations/:id/open')).body.thread,opened.body.thread);
});
test('foreign cookie and revoked session cannot load or reopen history',async t=>{
 let calls=0; const f=fixture(t,async()=>{calls++;return {messages:[]};});
 const other=f.bindings.create();assert.equal((await f.invoke('/api/chat/conversations/:id/open',other)).code,404);assert.equal(calls,0);
 assert.equal((await f.invoke('/api/chat/conversations',other)).body.conversations.length,0);
 f.bindings.revoke(f.cookie);assert.equal((await f.invoke('/api/chat/conversations/:id/open')).code,404);
});
test('revocation during an asynchronous history read prevents transcript disclosure',async t=>{
 const f=fixture(t,async()=>{f.bindings.revoke(f.cookie);return {messages:[{role:'user',content:'private'}]};});
 const result=await f.invoke('/api/chat/conversations/:id/open');assert.equal(result.code,503);assert.doesNotMatch(JSON.stringify(result.body),/private/);
});
test('metadata preserves first title, per-chat settings and original thread',async t=>{
 const f=fixture(t,async()=>({messages:[],sessionInfo:{}}));
 f.bindings.describeChat(f.cookie,f.task.id,'engineer',{title:'First question',chatModel:'choice',chatEffort:'low'});
 f.bindings.describeChat(f.cookie,f.task.id,'engineer',{title:'Follow up'});
 const opened=await f.invoke('/api/chat/conversations/:id/open');assert.equal(opened.body.thread,'original');assert.equal(opened.body.chatModel,'choice');assert.equal(opened.body.chatEffort,'low');assert.equal(f.bindings.ownedChat(f.cookie,f.task.id,'engineer').title,'First question');
});
