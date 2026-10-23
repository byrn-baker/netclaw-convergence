import test from 'node:test';
import assert from 'node:assert/strict';
import { loadChat, saveChat } from './chat-storage.js';
function storage(){let text=null;return {getItem:()=>text,setItem:(_k,v)=>{text=v;}};}
const state={thread:'chat-owned',messages:[{role:'user',content:'Hello'},{role:'assistant',content:'Hi'}],draft:'Next question',chatModel:'model-id',interrupted:false};
test('saved chat restores thread, transcript, draft and selected model',()=>{
 const s=storage();assert.equal(saveChat(s,state),'');
 assert.deepEqual(loadChat(s).state,{version:1,...state,messages:state.messages.map(m=>({...m,assessmentRefs:[]}))});
});
test('interrupted marker survives and storage failures do not throw',()=>{
 const s=storage();saveChat(s,{...state,interrupted:true});assert.equal(loadChat(s).state.interrupted,true);
 assert.ok(saveChat({setItem(){throw Error('quota');}},state));
 assert.ok(loadChat({getItem(){return '{broken';}}).error);
});
test('invalid stored roles rejected, assessment refs sanitized and new chat replaces old',()=>{
 const s=storage();assert.ok(saveChat(s,{...state,messages:[{role:'system',content:'bad'}]}));
 saveChat(s,{...state,messages:[{role:'assistant',content:'ok',assessmentRefs:[{taskRef:'../bad',assessmentId:'x'}]}]});
 assert.deepEqual(loadChat(s).state.messages[0].assessmentRefs,[]);
 saveChat(s,{...state,thread:'chat-new',messages:[],draft:''});
 assert.equal(loadChat(s).state.messages.length,0);
});

test('effort survives storage and old chats remain readable', () => {
  const s = storage();
  assert.equal(saveChat(s, { ...state, chatEffort: 'low' }), '');
  assert.equal(loadChat(s).state.chatEffort, 'low');
  assert.equal(saveChat(s, state), '');
  assert.equal(loadChat(s).state.chatEffort, undefined);
});

test('archive keeps independent transcripts, drafts and model settings without replacing other chats', async () => {
 const { archiveChat, loadChatArchive } = await import('./chat-storage.js');
 const data=new Map(), s={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 archiveChat(s,{...state,chatEffort:'low'});
 archiveChat(s,{...state,thread:'second',draft:'Second draft',chatModel:'other'});
 const rows=loadChatArchive(s);assert.equal(rows.length,2);assert.equal(rows.find(r=>r.thread===state.thread).draft,'Next question');assert.equal(rows.find(r=>r.thread===state.thread).chatEffort,'low');
 archiveChat(s,{...state,draft:'Updated'});assert.equal(loadChatArchive(s).length,2);
 assert.equal(loadChatArchive(s).find(r=>r.thread==='second').chatModel,'other');
});
