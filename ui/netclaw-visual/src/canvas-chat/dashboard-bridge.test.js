import test from 'node:test';
import assert from 'node:assert/strict';
import { installDashboardBridge } from './dashboard-bridge.js';
import { unbindImportedSession } from './assessment-link.js';
function setup(accept) { const sent=[]; let handler; const parent={postMessage:value=>sent.push(value)};const win={parent,location:{origin:'http://localhost:3000'},addEventListener:(_,fn)=>handler=fn,removeEventListener:()=>handler=null};const cleanup=installDashboardBridge({window:win,accept});return { sent, parent, cleanup, dispatch:(data,origin=win.location.origin,source=parent)=>handler({data,origin,source}) }; }
test('same-origin parent adds context only; foreign origin and window are ignored',()=>{
 const values=[];const h=setup(value=>values.push(value));h.dispatch({type:'netclaw:context',content:'selected evidence'});h.dispatch({type:'netclaw:context',content:'evil'},'http://evil.invalid');h.dispatch({type:'netclaw:context',content:'wrong window'},undefined,{});assert.deepEqual(values,['selected evidence']);assert.equal(h.sent.at(-1).type,'netclaw:context-accepted');h.cleanup();
});
test('busy canvas rejects context without changing state; oversized context ignored',()=>{
 let called=0;const h=setup(()=>{called++;throw Error('busy')});h.dispatch({type:'netclaw:context',content:'evidence'});assert.equal(h.sent.at(-1).type,'netclaw:context-rejected');h.dispatch({type:'netclaw:context',content:'x'.repeat(16001)});assert.equal(called,1);
});
test('imports preserve content, branch/synthesis relationships and layout but strip authority',()=>{
 const fixture={active:'synthesis',nodes:[{id:'root',x:41,messages:[{role:'assistant',content:'retained',tabs:{context:'context',summary:'summary',sources:'sources',action:'action'},assessmentRefs:[{taskRef:'foreign',assessmentId:'a'}]}]},{id:'branch',parentId:'root',sourceQuote:'quote',messages:[{role:'user',files:[{name:'fixture.txt',content:'evidence'}]}]},{id:'synthesis',synthFrom:['root','branch'],messages:[]}]};
 const result=unbindImportedSession(JSON.parse(JSON.stringify(fixture)));assert.equal(result.nodes[0].messages[0].content,'retained');assert.equal(result.nodes[0].messages[0].assessmentRefs,undefined);assert.equal(result.nodes[0].messages[0].assessmentBinding,'unbound');assert.deepEqual(result.nodes[0].messages[0].tabs,fixture.nodes[0].messages[0].tabs);assert.deepEqual(result.nodes.slice(1),fixture.nodes.slice(1));assert.equal(result.active,fixture.active);assert.equal(result.nodes[0].x,41);
});
