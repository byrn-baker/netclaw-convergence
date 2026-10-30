import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './load.mjs';
const {NativeTerminalSession}=await load('src/setup/native-terminal.ts');
const {canonical,hash}=await load('src/setup/data.ts');
const plan={claws:[{id:'one',capabilities:{components:['gait']}}]};
const request={protocol:1,type:'native-terminal',requestId:'b'.repeat(48),binding:{planHash:hash(canonical(plan)),owner:'one',phase:'onboard',effectId:'one:onboard'}};
const frame={protocol:1,planHash:request.binding.planHash,requestId:request.requestId};

test('Comms terminal permits only a selected owner and exact channel effect',async()=>{
  const selected={claws:[{id:'border',capabilities:{components:[]},channels:[{id:'whatsapp'}]}]};
  const base={protocol:1,type:'native-terminal',requestId:'c'.repeat(48),binding:{planHash:hash(canonical(selected)),owner:'border',phase:'comms',effectId:'border:comms:whatsapp'}};
  const session=()=>new NativeTerminalSession(selected,async()=>({write(){},dispose(){}}),()=>{},()=>{});
  const valid=session();assert.equal(valid.accept(base),true);await Promise.resolve();valid.dispose();
  for(const changes of [{owner:'member'},{effectId:'border:comms:discord'},{phase:'services'},{effectId:'border:comms:whatsapp:command'}])
    assert.throws(()=>session().accept({...base,binding:{...base.binding,...changes}}));
});

test('native terminal is private, bound to the selected effect and waits for its visible view',async()=>{
  let input,resize;const sent=[],visible=[];let disposed=0,cancelled=0;
  const session=new NativeTerminalSession(plan,async(_b,onInput,_cancel,onResize)=>{
    input=onInput;resize=onResize;
    resize(80,24);input('ignored-before-ready');
    return {write:text=>visible.push(text),dispose:()=>disposed++};
  },value=>sent.push(value),()=>cancelled++);
  assert.equal(session.accept(request),true);assert.equal(sent.length,0);await Promise.resolve();
  assert.equal(sent[0].type,'native-terminal-ready');input('private-fixture');resize(120,40);
  assert.equal(sent[1].type,'native-terminal-input');assert.equal(Buffer.from(sent[1].data,'base64').toString(),'private-fixture');
  assert.equal(sent[2].type,'native-terminal-resize');
  // Split Unicode remains readable; terminal content has no event callback.
  const bytes=Buffer.from('🦞');for(const chunk of [bytes.subarray(0,2),bytes.subarray(2)])session.accept({...frame,type:'native-terminal-output',data:chunk.toString('base64')});
  assert.equal(visible.join(''),'🦞');
  session.accept({...frame,type:'native-terminal-exit',returncode:0});assert.equal(disposed,1);assert.equal(session.busy,false);
  assert.equal(cancelled,0);assert.throws(()=>session.accept({...frame,type:'native-terminal-output',data:'YQ=='}));
});

test('native terminal refuses stale, foreign, oversized and overlapping requests',async()=>{
  for(const binding of [{...request.binding,owner:'neighbor'},{...request.binding,planHash:'a'.repeat(64)},
    {...request.binding,effectId:'one:components:unselected'},{...request.binding,phase:'services'}]){
    const session=new NativeTerminalSession(plan,async()=>({write(){},dispose(){}}),()=>{},()=>{});
    assert.throws(()=>session.accept({...request,binding}));
  }
  for(const bad of [{...frame,type:'native-terminal-output',requestId:'c'.repeat(48),data:'YQ=='},
    {...frame,type:'native-terminal-output',data:'YQ==',secret:'extra'},
    {...frame,type:'native-terminal-output',data:Buffer.alloc(16385).toString('base64')},
    {...frame,type:'native-terminal-exit',returncode:'0'}]){
    const session=new NativeTerminalSession(plan,async()=>({write(){assert.fail('invalid bytes rendered');},dispose(){}}),()=>{},()=>{});
    session.accept(request);await Promise.resolve();assert.throws(()=>session.accept(request));assert.throws(()=>session.accept(bad));session.dispose();
  }
});

test('editor close while native view opens cannot revive the session',async()=>{
  let resolve;let disposed=0;const sent=[];
  const session=new NativeTerminalSession(plan,()=>new Promise(r=>resolve=r),v=>sent.push(v),()=>{});
  session.accept(request);session.dispose();resolve({write(){assert.fail();},dispose(){disposed++;}});await Promise.resolve();
  assert.equal(disposed,1);assert.deepEqual(sent,[]);
});
