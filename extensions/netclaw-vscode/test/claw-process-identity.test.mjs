import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileFixture} from './claw-fixture.mjs';
import {resolveTarget} from '../../../scripts/lib/claw-files.mjs';
import {processIdentity,sameProcessStart,registerOwned,startOwned,stopOwned,ownedState} from '../../../scripts/lib/claw-process.mjs';

test('kernel start identity takes precedence over a changed wall-clock start label',()=>{
  const identity={birth:'old wall clock',startId:'linux:boot:123'};
  assert.equal(sameProcessStart({...identity,birth:'adjusted wall clock'},identity),true);
  assert.equal(sameProcessStart({...identity,startId:'linux:boot:124'},identity),false);
  assert.equal(sameProcessStart({...identity,startId:'linux:other-boot:123'},identity),false);
  assert.equal(sameProcessStart({birth:identity.birth},identity),false);
  assert.equal(sameProcessStart({birth:'unchanged'},{birth:'unchanged'}),true);
  assert.equal(sameProcessStart(null,identity),false);
});

test('Linux owned service can stop after its displayed start timezone changes', {skip:process.platform!=='linux'}, async()=>{
  const f=fileFixture('hermes'),t=await resolveTarget(f.target);
  const {freePort}=await import('./real-hud-fixture.mjs');const port=await freePort();
  const script=path.join(f.base,'clock-fixture.mjs');
  fs.writeFileSync(script,`import http from 'node:http';const server=http.createServer((q,r)=>r.end(JSON.stringify({installationId:${JSON.stringify(t.installationId)}})));server.listen(${port},'127.0.0.1');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));`,{mode:0o600});
  const d=registerOwned(t,'hud',fs.realpathSync(process.execPath),[script],{PATH:process.env.PATH},f.base,{url:`http://127.0.0.1:${port}`,installationId:t.installationId});
  const previous=process.env.TZ;
  try{
    await startOwned(t,d);const before=await processIdentity(process.pid);
    process.env.TZ='Pacific/Honolulu';const after=await processIdentity(process.pid);
    assert.equal(sameProcessStart(after,before),true);
    assert.match(after.startId,/^linux:[a-f0-9-]{36}:\d+$/);
    assert.equal((await ownedState(t,d)).state,'ready');
    assert.equal((await stopOwned(t,d)).state,'stopped');
  }finally{
    if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;
    await stopOwned(t,d);
  }
});
