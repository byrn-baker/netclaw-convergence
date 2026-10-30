import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {load} from './load.mjs';
const {prerequisites,hostPrerequisites,remedy,preparedMacPaths}=await load('src/setup/prerequisites.ts');

test('chosen-source prerequisites apply runtime and HUD ranges without commands that install',async()=>{
  for(const [node,expected] of [['v24.18.0','unsupported'],['v24.19.0','ready'],['v25.3.0','unsupported'],['v26.1.0','ready']]){
    const calls=[];const run=async(command,args)=>{calls.push([command,args]);return {code:0,stdout:Buffer.from({node,python3:'Python 3.10.14',git:'git version 2.50.1',uv:'uv 0.8.0'}[command])};};
    const rows=await prerequisites(path.resolve('.'),'openclaw',run,path.resolve('../..'));
    assert.equal(rows.find(r=>r.id==='node').state,expected);assert.ok(rows.find(r=>r.id==='node').required.includes('HUD'));
    assert.deepEqual(calls.map(c=>c[1]),[['--version'],['--version'],['--version'],['--version']]);
  }
  assert.equal(remedy('node','macos','/fixture/.nvm/bin').command,undefined);
  assert.throws(()=>remedy('arbitrary','macos'));
});
test('reviewed Mac preparation accepts only fixed packages and tool paths',()=>{
  assert.equal(remedy('node','macos','/usr/bin').command,'node');
  assert.match(remedy('uv','macos').detail,/SHA-256/);
  assert.deepEqual(preparedMacPaths('arm64',()=>true),['/opt/homebrew/opt/node@24/bin','/opt/homebrew/opt/python@3.12/libexec/bin','/opt/homebrew/bin','/opt/homebrew/sbin']);
  assert.deepEqual(preparedMacPaths('other',()=>true),[]);
  assert.deepEqual(preparedMacPaths('x64',()=>false),[]);
  for(const choice of ['arbitrary','node; echo wrong','$(echo wrong)']){
    const result=spawnSync('/bin/bash',['resources/mac-prerequisites.sh',choice],{encoding:'utf8'});
    assert.equal(result.status,2);assert.equal(result.stdout,'');
  }
});
test('host network probes have fixed disclosed destinations and Docker is conditional and truthful',async()=>{
  const targets=[],calls=[];const reach=async url=>{targets.push(url);return false;};
  const run=async(command,args)=>{calls.push([command,args]);return {code:0,stdout:Buffer.alloc(0)};};
  await hostPrerequisites(['subnet-calc'],'macos',run,reach);assert.deepEqual(calls,[]);
  assert.deepEqual(targets,['https://api.github.com','https://registry.npmjs.org','https://pypi.org']);
  const rows=await hostPrerequisites(['github'],'macos',run,reach);
  assert.equal(rows.find(r=>r.id==='docker').state,'unknown');assert.deepEqual(calls,[['docker',['version','--format','{{.Server.Version}}']]]);
  assert.ok(rows.filter(r=>r.remedy==='network').every(r=>r.state==='unknown'));
});
