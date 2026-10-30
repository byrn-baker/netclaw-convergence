import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {healthy,endpointOwned} from '../../../scripts/lib/claw-process.mjs';
import {setupSourceInputs} from '../../../scripts/lib/claw-setup-services.mjs';
import {hash} from '../../../scripts/lib/claw-files.mjs';
import {locked,reconcileFiles} from '../../../scripts/lib/claw-files.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {observeSystemdArgv,systemdUnitPath} from '../../../scripts/lib/claw-systemd.mjs';

test('editor and Python share typed systemd argv cases without text splitting or shell evaluation',async()=>{
  const cases=JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/setup/systemd-observation.json',import.meta.url),'utf8'));
  for(const c of cases){
    const calls=[];
    const run=async(exe,args)=>{
      calls.push([exe,...args]);assert.equal(exe,'/usr/bin/busctl');
      assert.deepEqual(args.slice(0,4),['--user','--json=short','--no-pager','--timeout=10']);assert.ok(!args.includes('LoadUnit'));
      if(c.returncode)throw Error('fixture bus unavailable');
      return JSON.stringify(args.includes('GetUnit')?c.getUnit:c.property);
    };
    if(c.accept){assert.equal(await observeSystemdArgv(run,c.item),true,c.name);assert.equal(calls.length,2);}
    else await assert.rejects(observeSystemdArgv(run,c.item),undefined,c.name);
  }
  for(const name of ['../neighbor.service','one.service\n','unit/part.service','unité.service'])assert.throws(()=>systemdUnitPath(name));
  for(const raw of ['{}','[]','private-manager-error',' '.repeat(65537)])await assert.rejects(observeSystemdArgv(async()=>raw,cases[0].item));
});

test('cleanup and existing management share the actual exclusive lock and cannot steal recovery ownership',async()=>{
  const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'netclaw153-cleanup-lock-'))),state=path.join(home,'netclaw-hud/management');
  const script='import sys;sys.path.insert(0,sys.argv[1]);from setup_cleanup import management_lock\nwith management_lock(sys.argv[2],"run-fixture"):\n print("ready",flush=True)\n sys.stdin.readline()\n';
  const child=spawn('python3',['-c',script,path.resolve('../../scripts/lib'),home],{stdio:['pipe','pipe','pipe']});
  const exited=once(child,'exit');
  try{
    const [data]=await once(child.stdout,'data');assert.match(data.toString(),/ready/);
    await assert.rejects(locked({state},async()=>assert.fail('overlapping mutation')),/lock/);
    assert.throws(()=>reconcileFiles({state}),/Setup cleanup owns/);
    child.stdin.end('finish\n');assert.deepEqual(await exited,[0,null]);
    let reached=false;await locked({state},async()=>{reached=true;});assert.equal(reached,true);
    fs.writeFileSync(path.join(state,'mutation.lock'),JSON.stringify({pid:99999999,setupCleanup:true,setupRunId:'run-fixture'}),{mode:0o600});
    assert.throws(()=>reconcileFiles({state}),/Setup cleanup owns/);assert.ok(fs.existsSync(path.join(state,'mutation.lock')));
  }finally{if(child.exitCode===null){child.kill();await exited;}fs.rmSync(home,{recursive:true,force:true});}
});

test('setup management refuses changed, aliased or path-escaping bound service source',()=>{
  const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'netclaw153-source-binding-'))),root=path.join(home,'.setup/source');
  try{
    fs.mkdirSync(path.join(root,'scripts'),{recursive:true,mode:0o700});
    const file=path.join(root,'scripts/setup-service.py'),index=path.join(home,'.setup/service-source.json');
    fs.writeFileSync(file,'owned',{mode:0o600});
    const data={schema:1,source:root,files:[{path:'scripts/setup-service.py',sha256:hash('owned')}]};
    const write=()=>{const raw=JSON.stringify(data);fs.writeFileSync(index,raw,{mode:0o600});return {sourceIndex:{sha256:hash(raw),count:1}};};
    let m=write();assert.equal(setupSourceInputs({home,root},m).length,2);
    fs.writeFileSync(file,'changed');assert.throws(()=>setupSourceInputs({home,root},m),/source changed/);
    fs.unlinkSync(file);fs.symlinkSync(index,file);assert.throws(()=>setupSourceInputs({home,root},m));
    data.files[0].path='../neighbor';m=write();assert.throws(()=>setupSourceInputs({home,root},m),/index is invalid/);
  }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('setup member lifecycle binds fresh readiness to the exact owned process and installation',async()=>{
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'netclaw153-member-health-')));
  try{
    const home=path.join(root,'claw');fs.mkdirSync(path.join(home,'netclaw-federation'),{recursive:true,mode:0o700});
    const file=path.join(home,'netclaw-federation/setup-member-health.json');
    const d={home,kind:'hermes',installationId:'fixture-id',health:{type:'setup-member',file}};
    const value={schema:1,kind:'hermes',installationId:'fixture-id',ready:true,at:Math.floor(Date.now()/1000),pid:process.pid};
    const write=v=>fs.writeFileSync(file,JSON.stringify(v),{mode:0o600});write(value);
    assert.equal(await healthy(d),true);assert.equal(await endpointOwned(d,process.pid),true);
    assert.equal(await endpointOwned(d,process.pid+1),false);
    for(const changed of [{...value,at:value.at-16},{...value,installationId:'neighbor'},{...value,kind:'openclaw'},{...value,ready:false}]){
      write(changed);assert.equal(await healthy(d),false);
    }
    write(value);fs.chmodSync(file,0o644);assert.equal(await healthy(d),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
