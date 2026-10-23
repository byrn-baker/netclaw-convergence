import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import { Bindings } from './bindings.js';
import { createLocalAccess, localAccessMiddleware } from '../security/local-access.js';
import { localSpeech, mountLocalPal, speechText, speechRate, PAL_NOTICES } from './pal-local.js';

test('local speech bounds input and automatic notices cannot contain caller text', () => {
  assert.equal(speechText({ kind: 'notice', notice: 'ready', text: 'secret config' }), PAL_NOTICES.ready);
  for (const body of [{}, {kind:'notice',notice:'toString'}, {kind:'notice',notice:'private'}, {kind:'answer',text:'x'.repeat(1801)}, {kind:'answer',text:'a\0b'}]) {
    assert.throws(() => speechText(body), error => error.status === 400);
  }
  assert.equal(speechText({kind:'answer',text:'$(touch /tmp/no) `command`'}), '$(touch /tmp/no) `command`');
});

test('synthesis passes text through private files, serializes work and cleans after success/failure', async () => {
  let directory, release, fail = false;
  const wait = new Promise(resolve => { release = resolve; });
  const engine = localSpeech({available:true, run:async(command,args,options) => {
    assert.equal(options.timeout,30000); assert.equal(options.shell,undefined);
    if (command === '/usr/bin/say') {
      assert.deepEqual(args.slice(-2),['-r','175']);
      directory = path.dirname(args[1]);
      assert.equal((await fs.stat(directory)).mode & 0o777,0o700);
      assert.equal(await fs.readFile(args[1],'utf8'),'literal $(shell)');
      assert.ok(!args.includes('literal $(shell)'));
      await wait;
      if(fail) throw Error('synthesis failed');
    } else await fs.writeFile(args.at(-1),Buffer.alloc(64));
  }});
  const first = engine.synthesize('literal $(shell)');
  await assert.rejects(engine.synthesize('other'), error => error.status === 409);
  release(); assert.equal((await first).length,64);
  await assert.rejects(fs.stat(directory), error => error.code === 'ENOENT');
  fail=true; await assert.rejects(engine.synthesize('literal $(shell)'));
  await assert.rejects(fs.stat(directory), error => error.code === 'ENOENT');
  const abort = new AbortController();abort.abort();
  await assert.rejects(engine.synthesize('literal $(shell)',abort.signal));
  assert.equal(localSpeech({available:false}).status().available,false);
});

test('local speech HTTP requires trusted origin and live owner; revocation suppresses completed audio', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'pal-local-test-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const bindings = new Bindings(directory), owner=bindings.create();
  let calls=0, revoke=false, allowed=()=>false;
  const app=express();app.use((req,res,next)=>localAccessMiddleware(allowed)(req,res,next));app.use(express.json());
  mountLocalPal(app,{bindings,speech:{status:()=>({available:true}),synthesize:async()=>{
    calls++;if(revoke)bindings.revoke(owner);return Buffer.from('audio');
  }}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port,url=`http://127.0.0.1:${port}`;
  allowed=createLocalAccess({api:port,ui:port+1},{host:'127.0.0.1'});
  const headers={cookie:`nc_hud=${owner}`,origin:url,'Content-Type':'application/json'};
  const request=overrides=>fetch(url+'/api/pal/local/speech',{method:'POST',headers,body:JSON.stringify({kind:'notice',notice:'ready'}),...overrides});
  assert.equal((await request({headers:{origin:url,'Content-Type':'application/json'}})).status,401);
  assert.equal((await request({headers:{...headers,origin:'https://evil.example'}})).status,403);
  assert.equal(calls,0);
  const good=await request();assert.equal(good.status,200);assert.equal(good.headers.get('content-type'),'audio/wav');assert.equal(good.headers.get('cache-control'),'no-store');
  revoke=true;assert.equal((await request()).status,503);assert.equal(calls,2);
  assert.equal((await request()).status,401);assert.equal(calls,2);
});


test('speech rate accepts only bounded numeric values',()=>{
  assert.equal(speechRate(),1);assert.equal(speechRate(.75),.75);assert.equal(speechRate(1.25),1.25);
  for(const value of [0,2,'1',NaN,Infinity,null])assert.throws(()=>speechRate(value),error=>error.status===400);
});
