import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM,VirtualConsole} from 'jsdom';
import {webcrypto} from 'node:crypto';
const built=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import StandardChat from './StandardChat.jsx';import {bootstrapRuntime} from '../shared/runtime-client.js';let root=createRoot(document.getElementById('root'));window.showChat=pal=>root.render(<StandardChat pal={pal}/>);window.remountChat=()=>{root.unmount();root=createRoot(document.getElementById('root'));window.showChat(false);};window.closeChat=()=>root.unmount();bootstrapRuntime().then(()=>window.showChat(false));`,resolveDir:new URL('.',import.meta.url).pathname,loader:'jsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const wait=()=>new Promise(r=>setTimeout(r,50));
async function until(check) { const deadline=Date.now()+3000; while(Date.now()<deadline) { if(check())return; await wait(); } assert.ok(check(),'UI did not settle before the deadline'); }
const button=(doc,label)=>[...doc.querySelectorAll('button')].find(b=>b.textContent===label);
test('Hermes chat restores uncertain draft, recovers without replay, and shares local Avatar context',async t=>{
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,calls=[];let state='unknown',holdStatus=null,chatThread;w.AbortSignal=AbortSignal;w.AbortController=AbortController;w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.HTMLMediaElement.prototype.play=()=>Promise.resolve();
 w.fetch=async(url,options={})=>{calls.push([url,options]);if(url==='/api/chat/requests'&&options.method==='POST')chatThread=JSON.parse(options.body).hudThread;if(url==='/api/chat/requests/owned'&&holdStatus)await holdStatus;return {ok:true,json:async()=>url==='/api/runtime'?{kind:'hermes',installationId:'11111111-1111-4111-8111-111111111111',readiness:{ready:true,executionVerified:false}}:url==='/api/chat/models'?{models:[],selectionSupported:false}:url==='/api/chat/conversations'?{conversations:chatThread?[{id:'conversation',thread:chatThread,title:'Saved'}]:[],sourceAvailable:true}:url==='/api/chat/conversations/conversation/open'?{thread:chatThread,messages:[{role:'user',content:'Remember my branch'},{role:'assistant',content:'Recovered confirmed answer'}]}:url==='/api/chat/requests'?{requestId:'owned',state:'queued'}:url==='/api/chat/requests/owned'?{requestId:'owned',state,fromGateway:state==='completed',response:'Recovered confirmed answer',runtime:{model:'qualified-model',provider:'fixture'}}:{}};};
 w.eval(built.outputFiles[0].text);await wait();t.after(()=>{w.closeChat();w.close();});
 const doc=w.document;await until(()=>doc.querySelector('textarea') && doc.querySelector('#standard-chat-model')?.disabled);let input=doc.querySelector('textarea');assert.ok(input,JSON.stringify({errors,html:doc.body.innerHTML}));assert.equal(doc.querySelector('#standard-chat-model').disabled,true);
 Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(input,'Remember my branch');input.dispatchEvent(new w.Event('input',{bubbles:true}));await wait();input.closest('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await wait();
 assert.match(doc.querySelector('[role=alert]').textContent,/Outcome unknown/);assert.equal(input.value,'Remember my branch');assert.equal(calls.filter(([u,o])=>u==='/api/chat/requests'&&o.method==='POST').length,1);
 Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(input,'UNSENT new question');input.dispatchEvent(new w.Event('input',{bubbles:true}));await wait();
 w.remountChat();await until(()=>doc.querySelector('textarea'));input=doc.querySelector('textarea');assert.equal(input.value,'UNSENT new question');
 state='completed';let releaseStatus;holdStatus=new Promise(resolve=>releaseStatus=resolve);button(doc,'Check status').click();await wait();
 const savedKey=Object.keys(w.sessionStorage).find(k=>k.endsWith('.netclaw.standard-chat.v1'));
 assert.equal(JSON.parse(JSON.parse(w.sessionStorage.getItem(savedKey)).value).draft,'UNSENT new question');
 releaseStatus();holdStatus=null;await until(()=>doc.querySelector('[role=log]').textContent.includes('Recovered confirmed answer'));
 assert.equal(input.value,'UNSENT new question');assert.match(doc.body.textContent,/qualified-model/);
 assert.equal(doc.querySelector('.chat-message.user .chat-message-text').textContent,'Remember my branch');
 button(doc,'Check status').click();await wait();assert.equal(doc.querySelectorAll('.chat-message').length,2);assert.equal(input.value,'UNSENT new question');
 button(doc,'Reload chat').click();await wait();assert.equal(doc.querySelectorAll('.chat-message').length,2);assert.equal(input.value,'UNSENT new question');
 w.showChat(true);await wait();w.showChat(false);await wait();assert.match(doc.querySelector('[role=log]').textContent,/Recovered confirmed answer/);assert.equal(calls.filter(([u,o])=>u==='/api/chat/requests'&&o.method==='POST').length,1);assert.equal(calls.some(([u])=>u==='/api/pal/sessions'),false);assert.deepEqual(errors,[]);
});

test('conditional approval UI sends only the exact pending once decision',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[];let approved=false;
 w.AbortSignal=AbortSignal;w.AbortController=AbortController;w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
 w.fetch=async(url,options={})=>{
  calls.push([url,options]);if(url==='/api/chat/requests/owned/approval')approved=true;
  return {ok:true,json:async()=>url==='/api/runtime'?{kind:'hermes',installationId:'11111111-1111-4111-8111-111111111111',readiness:{ready:true}}:url==='/api/chat/models'?{models:[],selectionSupported:false}:url==='/api/chat/conversations'?{conversations:[],sourceAvailable:true}:url==='/api/chat/requests'?{requestId:'owned',state:'queued'}:url==='/api/chat/requests/owned'?{requestId:'owned',state:approved?'completed':'waiting_approval',...(approved?{fromGateway:true,response:'Confirmed'}:{approval:{id:'exact-operation',description:'Controlled protocol fixture'}})}:{}};
 };
 w.eval(built.outputFiles[0].text);t.after(()=>{w.closeChat();w.close();});
 const doc=w.document;await until(()=>doc.querySelector('textarea'));
 const input=doc.querySelector('textarea');Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(input,'Fixture approval');input.dispatchEvent(new w.Event('input',{bubbles:true}));await wait();input.closest('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(()=>button(doc,'Allow once'));assert.ok(button(doc,'Deny'));assert.ok(!button(doc,'Allow always'));
 button(doc,'Allow once').click();await until(()=>doc.querySelector('[role=log]').textContent.includes('Confirmed'));
 const controls=calls.filter(([u])=>u.endsWith('/approval'));assert.equal(controls.length,1);
 assert.deepEqual(JSON.parse(controls[0][1].body),{approvalId:'exact-operation',choice:'once'});
 assert.equal(calls.filter(([u,o])=>u==='/api/chat/requests'&&o.method==='POST').length,1);
});

test('recovery handles untouched, cleared and already-loaded native history drafts',async()=>{
 for(const mode of ['untouched','cleared','history']) {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,doc=w.document;let state='unknown',thread,posts=0;
  w.AbortSignal=AbortSignal;w.AbortController=AbortController;w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
  w.fetch=async(url,options={})=>{
   if(url==='/api/chat/requests'&&options.method==='POST'){posts++;thread=JSON.parse(options.body).hudThread;}
   return {ok:true,json:async()=>url==='/api/runtime'?{kind:'hermes',installationId:'11111111-1111-4111-8111-111111111111',readiness:{ready:true}}:
    url==='/api/chat/models'?{models:[],selectionSupported:false}:
    url==='/api/chat/conversations'?{conversations:thread?[{id:'history',thread,title:'History'}]:[],sourceAvailable:true}:
    url==='/api/chat/conversations/history/open'?{thread,messages:[{role:'user',content:'ORIGINAL'},{role:'assistant',content:'ANSWER'}]}:
    url==='/api/chat/requests'?{requestId:'owned',state:'queued'}:
    url==='/api/chat/requests/owned'?{requestId:'owned',state,fromGateway:state==='completed',response:'ANSWER'}:{}};
  };
  try {
   w.eval(built.outputFiles[0].text);await until(()=>doc.querySelector('textarea'));const input=doc.querySelector('textarea');
   const type=value=>{Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set.call(input,value);input.dispatchEvent(new w.Event('input',{bubbles:true}));};
   type('ORIGINAL');await wait();input.closest('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
   await until(()=>doc.querySelector('[role=alert]')?.textContent.includes('Outcome unknown'));
   if(mode!=='untouched'){type(mode==='cleared'?'':'UNSENT');await wait();}
   state='completed';
   if(mode==='history'){await until(()=>button(doc,'Reload chat'));button(doc,'Reload chat').click();await until(()=>doc.querySelectorAll('.chat-message').length===2);}
   button(doc,'Check status').click();await until(()=>!doc.querySelector('[role=alert]')&&!input.disabled);
   assert.equal(doc.querySelectorAll('.chat-message').length,2,mode);
   assert.equal(doc.querySelector('.chat-message.user .chat-message-text').textContent,'ORIGINAL',mode);
   assert.equal(input.value,mode==='history'?'UNSENT':'',mode);assert.equal(posts,1,mode);
  } finally {w.closeChat();w.close();}
 }
});

test('owned historical uncertainty can release capacity after tab storage loss with separate confirmation',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,doc=w.document,calls=[];let accept=false,confirmText='';
 w.AbortSignal=AbortSignal;w.AbortController=AbortController;w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});
 w.confirm=text=>{confirmText=text;return accept;};
 w.fetch=async(url,options={})=>{
  calls.push([url,options]);return {ok:true,json:async()=>url==='/api/runtime'?{kind:'hermes',installationId:'11111111-1111-4111-8111-111111111111',readiness:{ready:true}}:
   url==='/api/chat/models'?{models:[],selectionSupported:false}:
   url==='/api/chat/conversations'&&options.method==='POST'?{thread:'fresh'}:
   url==='/api/chat/conversations'?{conversations:[{id:'old',thread:'old-thread',title:'Old unknown'}],sourceAvailable:true}:
   url==='/api/chat/conversations/old/open'?{thread:'old-thread',messages:[],pendingRequest:{requestId:'old-request',state:'unknown'}}:
   url==='/api/chat/requests/old-request'?{requestId:'old-request',state:'unknown',capacityReleaseEligible:true}:{}};
 };
 w.eval(built.outputFiles[0].text);t.after(()=>{w.closeChat();w.close();});
 await until(()=>doc.querySelector('#previous-chat option[value=old]'));
 const select=doc.querySelector('#previous-chat');select.value='old';select.dispatchEvent(new w.Event('change',{bubbles:true}));
 await until(()=>button(doc,'Check status'));button(doc,'Check status').click();await until(()=>button(doc,'Release slot and start new chat'));
 button(doc,'Release slot and start new chat').click();await wait();assert.match(confirmText,/outcome stays unknown/);
 assert.equal(calls.filter(([u,o])=>u==='/api/chat/conversations'&&o.method==='POST').length,0);
 accept=true;button(doc,'Release slot and start new chat').click();await until(()=>!button(doc,'Check status'));
 const opens=calls.filter(([u,o])=>u==='/api/chat/conversations'&&o.method==='POST');assert.equal(opens.length,1);
 assert.deepEqual(JSON.parse(opens[0][1].body),{acknowledgedUncertainRequestId:'old-request',releaseUncertainCapacity:true});
 assert.equal(calls.some(([u,o])=>u==='/api/chat/requests'&&o.method==='POST'),false);
 const receipt=Object.keys(w.sessionStorage).find(k=>k.endsWith('pending.old-thread'));assert.ok(receipt);assert.match(w.sessionStorage.getItem(receipt),/unknown/);
});
