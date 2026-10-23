import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Bindings, assessmentProofs, projectAssessment, readTranscript } from './bindings.js';
import { mountAssessmentRoutes } from './assessment-routes.js';
function setup(t) { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hud127-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bindings=new Bindings(dir);const cookie=bindings.create();const task=bindings.task(cookie,'canvas:root');return {dir,bindings,cookie,task}; }
const proof={assessmentId:'assessment1',ledgerTask:'operator-task',toolEventId:'tool1',parent:null};
test('server-owned task is stable across reads/retries and isolated between cookies',t=>{
 const {bindings,cookie,task}=setup(t);assert.equal(bindings.task(cookie,'canvas:root').id,task.id);const other=bindings.create();assert.notEqual(bindings.task(other,'canvas:root').id,task.id);bindings.register(cookie,task.id,[proof],'message1');assert.throws(()=>bindings.authorize(other,task.id,'assessment1'));assert.throws(()=>bindings.authorize(cookie,task.id,'forged'));assert.equal(bindings.authorize(cookie,task.id,'assessment1').ref.messageRef,'message1');
});
test('busy thread blocks concurrency; revoke denies reads',t=>{const {bindings,cookie,task}=setup(t);const release=bindings.begin(cookie,task.id);assert.throws(()=>bindings.begin(cookie,task.id));release();bindings.begin(cookie,task.id)();bindings.revoke(cookie);assert.throws(()=>bindings.read(cookie));});
test('private session records persist across restart and expire',t=>{const {bindings,cookie,task,dir}=setup(t);assert.equal(new Bindings(dir).read(cookie).tasks[task.id].id,task.id);assert.throws(()=>new Bindings(dir,()=>Date.now()+31*86400000).read(cookie));for(const name of fs.readdirSync(dir))assert.equal(fs.statSync(path.join(dir,name)).mode&0o077,0);});
test('symlink binding directory fails closed',t=>{const {dir}=setup(t);const link=path.join(dir,'link');fs.symlinkSync(dir,link);assert.throws(()=>new Bindings(link).create());});
const events=[{id:'call',type:'message',message:{role:'assistant',content:[{type:'toolCall',id:'tool1',name:'jev_evaluate'}]}},{id:'result',type:'message',message:{role:'toolResult',toolCallId:'tool1',toolName:'jev_evaluate',content:[{type:'text',text:JSON.stringify({assessment_id:'assessment1',task_id:'operator-task',status:'ok',reconsideration_of:null})}]}}];
test('only matching runtime tool result creates assessment proof; no timestamps',()=>{
 assert.equal(assessmentProofs([],events).length,1);assert.deepEqual(assessmentProofs(events,events),[]);
 assert.deepEqual(assessmentProofs([],events.slice(1)),[]);
 const forged=structuredClone(events);forged[1].message.role='assistant';assert.deepEqual(assessmentProofs([],forged),[]);
 const echo=structuredClone(events);echo[0].message.content[0].name='echo';assert.deepEqual(assessmentProofs([],echo),[]);
});
test('transcript lookup uses exact runtime mapping; no most-recent or arbitrary paths',t=>{
 const {dir}=setup(t);fs.writeFileSync(path.join(dir,'sessions.json'),JSON.stringify({'agent:main:hud:abc':{sessionId:'owned'}}));fs.writeFileSync(path.join(dir,'owned.jsonl'),events.map(e=>JSON.stringify(e)).join('\n'));assert.equal(readTranscript(dir,'agent:main:hud:abc').length,2);assert.equal(readTranscript(dir,'wrong'),null);
 fs.writeFileSync(path.join(dir,'sessions.json'),JSON.stringify({'bad':{sessionId:'../outside'}}));assert.equal(readTranscript(dir,'bad'),null);
});
test('projection excludes provider endpoint, credentials, raw state and arbitrary extras',()=>{const result=projectAssessment({assessment_id:'a',questions:{},answers:{},endpoint:'secret',api_key:'secret',state:'private',extra:'bad'});assert.deepEqual(Object.keys(result),['assessment_id','questions','answers']);});
function routes(deps) {const handlers={};const app={post:(key,fn)=>handlers[key]=fn,get:(key,fn)=>handlers[key]=fn};mountAssessmentRoutes(app,deps);return handlers;}
function response(){return {code:200,headers:{},set(k,v){this.headers[k]=v;return this},status(c){this.code=c;return this},json(value){this.value=value;return this}};}
test('detail route enforces owner, typed projection, no-store and read-only access',async t=>{
 const {bindings,cookie,task}=setup(t);bindings.register(cookie,task.id,[proof],'message1');let reads=0;
 const handler=routes({bindings,readAssessment:async()=>{reads++;return {assessment_id:'assessment1',reconsideration_of:null,status:'ok',questions:{q:{type:'noul',instructions:'fixture'}},answers:{q:{noul:.8}},endpoint:'hidden'};}})['/api/hud/tasks/:taskRef/assessments/:assessmentId'];
 const req={headers:{cookie:`nc_hud=${cookie}`},params:{taskRef:task.id,assessmentId:'assessment1'}};
 const res=response();await handler(req,res);assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.value.records[0].endpoint,undefined);assert.equal(reads,1);
 const denied=response();await handler({...req,headers:{cookie:`nc_hud=${bindings.create()}`}},denied);assert.equal(denied.code,404);assert.equal(reads,1);
 const unauth=response();await handler({...req,headers:{}},unauth);assert.equal(unauth.code,401);
});
test('cross-task reconsideration and revocation during read cannot return detail',async t=>{
 const {bindings,cookie,task}=setup(t);bindings.register(cookie,task.id,[{...proof,parent:'foreign'}],'message1');
 const handler=routes({bindings,readAssessment:async()=>({assessment_id:'assessment1',reconsideration_of:'foreign'})})['/api/hud/tasks/:taskRef/assessments/:assessmentId'];const req={headers:{cookie:`nc_hud=${cookie}`},params:{taskRef:task.id,assessmentId:'assessment1'}};const res=response();await handler(req,res);assert.equal(res.code,503);assert.equal(res.value.records,undefined);
 const revokeHandler=routes({bindings,readAssessment:async()=>{bindings.revoke(cookie);return {assessment_id:'assessment1',reconsideration_of:'foreign'};}})['/api/hud/tasks/:taskRef/assessments/:assessmentId'];const res2=response();await revokeHandler(req,res2);assert.equal(res2.value.records,undefined);
});

test('failed baseline cannot bind prior tool results to a new message',()=>{assert.deepEqual(assessmentProofs(null,events),[]);assert.deepEqual(assessmentProofs([],null),[]);});
test('an existing assessment cannot be reassigned to another originating message',t=>{const {bindings,cookie,task}=setup(t);bindings.register(cookie,task.id,[proof],'first');assert.deepEqual(bindings.register(cookie,task.id,[proof],'second'),[]);assert.equal(bindings.authorize(cookie,task.id,proof.assessmentId).ref.messageRef,'first');});

import { attachInfluences, displayBorderText } from './bindings.js';
test('Border interpretation is linked only to proven assessment IDs; user prose cannot bind',()=>{
 const block='```jev-influence\n'+JSON.stringify({assessment_id:'assessment1',status:'challenged',explanation:'Check the other side.'})+'\n```';
 const entry={id:'reply',message:{role:'assistant',content:[{type:'text',text:block}]}};
 assert.equal(attachInfluences([proof],[],[entry])[0].influence.status,'challenged');
 assert.equal(attachInfluences([proof],[],[{...entry,message:{...entry.message,role:'user'}}])[0].influence,undefined);
 assert.deepEqual(attachInfluences([],[],[entry]),[]);
 assert.match(displayBorderText(block),/Check the other side/);assert.doesNotMatch(displayBorderText(block),/```/);
});
test('configured agent owns the session key and cannot reuse another agent task', t => {
 const { bindings, cookie, task } = setup(t);
 const selected = bindings.task(cookie, 'canvas:root', 'senior-engineer');
 assert.match(selected.gatewayKey, /^agent:senior-engineer:hud:/);
 assert.notEqual(selected.id, task.id);
 assert.equal(bindings.task(cookie, 'canvas:root', 'senior-engineer').id, selected.id);
 assert.throws(() => bindings.task(cookie, 'canvas:root', '../outside'));
});
test('usage lookup cannot read another cookie or create a task', t => {
 const {bindings,cookie,task}=setup(t);
 assert.equal(bindings.lookupTask(cookie,'canvas:root','main').id,task.id);
 assert.equal(bindings.lookupTask(bindings.create(),'canvas:root','main'),null);
 assert.equal(bindings.lookupTask(cookie,'unknown','main'),null);
 assert.equal(bindings.lookupTask(cookie,'canvas:root','other'),null);
 assert.equal(Object.keys(bindings.read(cookie).tasks).length,1);
});
