import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Bindings } from './bindings.js';
import { mountPal } from './pal-routes.js';
import { createLocalAccess, localAccessMiddleware } from '../security/local-access.js';

test('Pal HTTP routes require trusted origin and a live HUD binding; no secrets in status',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pal-http-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const bindings=new Bindings(path.join(dir,'bindings'));const owner=bindings.create();
  const app=express();let allowed=()=>false;
  app.use((req,res,next)=>localAccessMiddleware(allowed)(req,res,next));app.use(express.json());
  let calls=0;
  const dispose=mountPal(app,{root:dir,home:dir,bindings,getEnv:()=>({}),service:{
    sweep:async()=>{},status:()=>({enabled:false}),confirm:()=>{calls++;return{confirmed:true};},
  }});t.after(dispose);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;allowed=createLocalAccess({api:port,ui:port+1},{host:'127.0.0.1'});
  const url=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(url+'/api/pal/status')).status,401);
  const headers={cookie:`nc_hud=${owner}`,'Content-Type':'application/json',origin:url};
  const status=await fetch(url+'/api/pal/status',{headers});
  assert.equal(status.headers.get('cache-control'),'no-store');assert.deepEqual(await status.json(),{enabled:false});
  assert.equal((await fetch(url+'/api/pal/allowance',{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{}'})).status,403);
  assert.equal(calls,0);
  assert.equal((await fetch(url+'/api/pal/allowance',{method:'POST',headers,body:'{}'})).status,200);
  bindings.revoke(owner);
  assert.equal((await fetch(url+'/api/pal/allowance',{method:'POST',headers,body:'{}'})).status,401);
  assert.equal(calls,1);
});
