import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {load} from './load.mjs';
const {SetupBroker}=await load('src/setup/broker.ts');
const {SetupDraft}=await load('src/setup/plan.ts');
const schema=JSON.parse(fs.readFileSync('../../config/claw-plan.schema.json'));
const catalog=JSON.parse(fs.readFileSync('../../config/components/catalog.json'));
test('actual MCP adapter initializes without PATH Node and has identical safe tools for three clients',async()=>{
  const root=fs.mkdtempSync(path.join(fs.realpathSync('/tmp'),'nc-mcp-fixture-'));fs.chmodSync(root,0o700);
  const broker=new SetupBroker(async(op,args)=>{
    if(op==='netclaw_setup_draft'){const draft=new SetupDraft(schema,catalog);draft.replace(args.plan,0);return {complete:draft.complete,applyReady:false};}
    return {state:'observed'};
  });
  try{
    const file=await broker.start(root,'fixture');let expected;
    for(const client of ['copilot','codex','claude-code']){
      const child=spawn(process.execPath,[path.resolve('dist/assistant.mjs'),'--setup-registration',file],{env:{PATH:'/no-path-node',HOME:root,ELECTRON_RUN_AS_NODE:'1'},stdio:['pipe','pipe','pipe']});
      let next=1,buffer='',errors='';const pending=new Map();
      child.stderr.on('data',b=>errors+=b);
      child.stdout.on('data',b=>{buffer+=b;let at;while((at=buffer.indexOf('\n'))>=0){const row=JSON.parse(buffer.slice(0,at));buffer=buffer.slice(at+1);if(row.id&&pending.has(row.id)){pending.get(row.id)(row);pending.delete(row.id);}}});
      const call=(method,params)=>new Promise((resolve,reject)=>{const id=next++,timer=setTimeout(()=>reject(Error('MCP fixture timeout: '+errors)),10000);pending.set(id,value=>{clearTimeout(timer);resolve(value);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
      try{
        const init=await call('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:client,version:'fixture'}});assert.ok(init.result.serverInfo);
        child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
        const listed=await call('tools/list',{}),names=listed.result.tools.map(t=>t.name).sort();
        assert.equal(names.length,8);assert.ok(names.every(n=>!/(apply|resume|cleanup|command)/.test(n)));
        if(expected)assert.deepEqual(names,expected);else expected=names;
        const observed=await call('tools/call',{name:'netclaw_setup_observe',arguments:{}});assert.equal(observed.result.structuredContent.state,'observed');
        const draft=await call('tools/call',{name:'netclaw_setup_draft',arguments:{plan:{schema:1,shape:'risk',unresolved:['host','members'],assumptions:[]}}});assert.equal(draft.result.structuredContent.applyReady,false);
        const bad=await call('tools/call',{name:'netclaw_setup_draft',arguments:{plan:{schema:1,approved:true}}});assert.equal(bad.result.isError,true);
        const secret=await call('tools/call',{name:'netclaw_setup_secret_entry',arguments:{planRef:'draft-'+'a'.repeat(32),owner:'claw',key:'KEY',value:'never'}});assert.ok(secret.error||secret.result?.isError);
        const matrix=JSON.parse(fs.readFileSync('../../tests/fixtures/setup/intent-matrix.json'));
        for(const entry of matrix){
          const response=await call('tools/call',{name:'netclaw_setup_draft',arguments:{plan:entry.plan}});
          if(entry.error)assert.ok(response.error||response.result?.isError,client+' '+entry.id);
          else{assert.equal(response.result.structuredContent.complete,entry.complete,client+' '+entry.id);assert.equal(response.result.structuredContent.applyReady,false);}
        }
      }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));}
    }
  }finally{broker.dispose();fs.rmSync(root,{recursive:true,force:true});}
});
