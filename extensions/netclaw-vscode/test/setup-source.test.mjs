import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {load} from './load.mjs';
const {strictJson,canonical}=await load('src/setup/data.ts');
const {resolveSelection,verifyManifest,validateRef,acquireSource,inspectSource}=await load('src/setup/source.ts');
test('bootstrap data uses the engine canonical ordering and rejects ambiguous values',()=>{
  assert.equal(canonical({'2':2,'10':10,a:'🦞'}),'{"10":10,"2":2,"a":"🦞"}');
  for(const text of ['{"x":1,"x":2}','{"x":1.2}','{"x":NaN}','{"x":"\\ud800"}'])assert.throws(()=>strictJson(text));
});
test('latest release means published release, not latest tag; errors stay explicit',async()=>{
  const git=async()=>Buffer.from('a'.repeat(40)+'\trefs/tags/v1.2.3\n');
  const chosen=await resolveSelection('release',undefined,{fetch:async()=>({ok:true,json:async()=>({tag_name:'v1.2.3',draft:false,prerelease:false})}),git});
  assert.equal(chosen.commit,'a'.repeat(40));assert.equal(chosen.provenance,'published-release');
  await assert.rejects(resolveSelection('release',undefined,{fetch:async()=>({ok:false}),git}),/release/);
  assert.throws(()=>validateRef('--upload-pack=bad'));assert.throws(()=>validateRef('a..b'));
});
test('source resolution keeps API failures, main and explicit tags distinct and bounds metadata',async()=>{
  let calls=0;
  const run=async args=>{calls++;assert.equal(args[0],'ls-remote');assert.equal(args[2],'https://github.com/automateyournetwork/netclaw.git');
    const ref=args[3];return Buffer.from('a'.repeat(40)+'\t'+ref+'\n'+'b'.repeat(40)+'\t'+ref+'^{}\n');};
  for(const status of [401,403,404,429,500])await assert.rejects(resolveSelection('release',undefined,{fetch:async()=>new Response('{}',{status}),git:run}));
  await assert.rejects(resolveSelection('release',undefined,{fetch:async()=>{throw Error('offline');},git:run}));
  for(const data of [{draft:true,prerelease:false,tag_name:'v1'},{draft:false,prerelease:true,tag_name:'v1'},{draft:false,prerelease:false,tag_name:'--bad'}])
    await assert.rejects(resolveSelection('release',undefined,{fetch:async()=>new Response(JSON.stringify(data)),git:run}));
  await assert.rejects(resolveSelection('release',undefined,{fetch:async()=>new Response(' '.repeat(1024*1024+1)),git:run}),/limit/);
  assert.equal(calls,0);
  const main=await resolveSelection('main',undefined,{git:run});assert.equal(main.ref,'main');assert.equal(main.provenance,'branch');
  const tag=await resolveSelection('tag','v1',{git:run});assert.equal(tag.provenance,'explicit-tag');assert.equal(tag.commit,'b'.repeat(40));
  await assert.rejects(resolveSelection('tag','v1',{git:async()=>Buffer.from('not-a-sha\trefs/tags/v1')}));
});
test('manifest is read as closed data before engine execution',()=>{
  const manifest={protocol:{major:1,minor:0},planSchema:1,catalogSchema:1,entryPoint:'scripts/setup-engine.py',pythonMinimum:[3,10]};
  verifyManifest(manifest);
  for(const changed of [{entryPoint:'other.py'},{protocol:{major:2,minor:0}},{approved:true}])assert.throws(()=>verifyManifest({...manifest,...changed}));
});
test('occupied or aliased acquisition target is refused without invoking git',async(t)=>{
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'nc153-source-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const occupied=path.join(root,'occupied');fs.mkdirSync(occupied);fs.writeFileSync(path.join(occupied,'keep'),'untouched');
  const alias=path.join(root,'alias');fs.symlinkSync(occupied,alias);let calls=0;
  const selection={channel:'main',ref:'main',commit:'a'.repeat(40),provenance:'branch'};
  for(const target of [occupied,alias])await assert.rejects(acquireSource(selection,target,{reviewed:true,git:async()=>{calls++;return Buffer.alloc(0);},record:async()=>{}}));
  assert.equal(calls,0);assert.equal(fs.readFileSync(path.join(occupied,'keep'),'utf8'),'untouched');
});
test('source acquisition claims an empty destination once and retains interrupted ownership',async(t)=>{
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'nc153-source-race-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const destination=path.join(root,'empty');fs.mkdirSync(destination);const records=[];let count=0;
  const selection={channel:'main',ref:'main',commit:'a'.repeat(40),provenance:'branch'};
  const options={reviewed:true,record:async value=>{records.push(value);},git:async()=>{count++;throw Error('interrupted download');}};
  const results=await Promise.allSettled([acquireSource(selection,destination,options),acquireSource(selection,destination,options)]);
  assert.ok(results.every(r=>r.status==='rejected'));assert.equal(count,1);
  assert.ok(fs.statSync(path.join(destination,'.git')).isDirectory());assert.ok(records.every(r=>r.state==='intent'));
  await assert.rejects(acquireSource(selection,destination,options),/empty destination/);assert.equal(count,1);
  const unreviewed=path.join(root,'unreviewed');await assert.rejects(acquireSource(selection,unreviewed,{...options,reviewed:false}),/review/);
  assert.equal(fs.existsSync(unreviewed),false);
});
test('actual Git trees have Python/editor hash parity and never execute configured filters',async(t)=>{
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'nc153-tree-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const repo=path.join(root,'source');fs.mkdirSync(repo);fs.mkdirSync(path.join(repo,'config'));fs.mkdirSync(path.join(repo,'scripts'));
  const run=args=>execFileSync('/usr/bin/git',['-c','core.hooksPath=/dev/null',...args],{cwd:repo,env:{PATH:'/usr/bin:/bin',HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},stdio:['ignore','pipe','pipe']});
  run(['init']);run(['config','user.name','Setup Fixture']);run(['config','user.email','fixture@example.invalid']);
  run(['remote','add','origin','https://github.com/automateyournetwork/netclaw.git']);
  fs.copyFileSync('../../config/setup-engine.json',path.join(repo,'config/setup-engine.json'));fs.writeFileSync(path.join(repo,'scripts/setup-engine.py'),'# fixture entry; never executed\n');
  fs.writeFileSync(path.join(repo,'.gitattributes'),'*.txt filter=untrusted\n');fs.writeFileSync(path.join(repo,'data.txt'),'original\n');
  run(['add','.']);run(['commit','-m','fixture']);
  const sentinel=path.join(root,'filter-ran');run(['config','filter.untrusted.clean','touch '+sentinel]);
  const python=()=>JSON.parse(execFileSync('python3',['-c','import json,sys;sys.path.insert(0,sys.argv[1]);from setup_observation import source_identity;print(json.dumps(source_identity(sys.argv[2])))',path.resolve('../../scripts/lib'),repo],{encoding:'utf8'}));
  for(const change of [()=>{},()=>fs.writeFileSync(path.join(repo,'data.txt'),'dirty\n'),()=>fs.symlinkSync('/unread-neighbor',path.join(repo,'reference')),
    ()=>fs.unlinkSync(path.join(repo,'data.txt'))]){
    change();const editor=await inspectSource(repo),engine=python();assert.equal(editor.treeHash,engine.treeHash);assert.equal(editor.dirty,engine.dirty);
    assert.equal(fs.existsSync(sentinel),false);
  }
  await assert.rejects(inspectSource(path.join(repo,'scripts')),/root/);
});
test('actual Git acquisition checks out the reviewed commit and retains ownership after failures',async(t)=>{
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'nc153-acquire-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const upstream=path.join(root,'upstream');fs.mkdirSync(upstream);fs.mkdirSync(path.join(upstream,'config'));fs.mkdirSync(path.join(upstream,'scripts'));
  const run=(args,cwd=upstream)=>execFileSync('/usr/bin/git',['-c','core.hooksPath=/dev/null',...args],{cwd,env:{PATH:'/usr/bin:/bin',HOME:root,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},stdio:['ignore','pipe','pipe']});
  run(['init']);run(['config','user.name','Source Fixture']);run(['config','user.email','fixture@example.invalid']);
  fs.copyFileSync('../../config/setup-engine.json',path.join(upstream,'config/setup-engine.json'));fs.writeFileSync(path.join(upstream,'scripts/setup-engine.py'),'raise RuntimeError("fixture must never execute")\n');
  run(['add','.']);run(['commit','-m','fixture']);const commit=run(['rev-parse','HEAD']).toString().trim();
  const selection={channel:'tag',ref:'v-fixture',commit,provenance:'explicit-tag'};
  for(const existing of [false,true]){
    const destination=path.join(root,existing?'empty':'new'),records=[],commands=[];if(existing)fs.mkdirSync(destination);
    const result=await acquireSource(selection,destination,{reviewed:true,record:async record=>records.push(record),git:async(args,cwd)=>{
      commands.push(args);
      // Fixture transport substitutes only fetch with the isolated local source.
      // Production's fixed remote identity and all real checkout/inspection remain unchanged.
      return run(args[0]==='fetch'?['fetch','--no-tags',upstream,commit]:args,cwd||root);
    }});
    assert.equal(result.commit,commit);assert.equal(result.dirty,false);assert.equal(records.length,2);
    assert.equal(records[0].state,'intent');assert.equal(records[1].state,'verified');assert.equal(records[0].existedBefore,existing);
    assert.equal(run(['config','netclaw.setup-owner'],destination).toString().trim(),records[0].owner);
    assert.equal(commands.some(args=>args.includes('pull')),false);assert.equal(run(['status','--porcelain'],destination).length,0);
    run(['remote','set-url','origin','https://example.invalid/foreign.git'],destination);
    await assert.rejects(inspectSource(destination),/origin/);
    run(['remote','set-url','origin','https://github.com/automateyournetwork/netclaw.git'],destination);
    fs.writeFileSync(path.join(destination,'config/setup-engine.json'),JSON.stringify({protocol:{major:99}}));
    await assert.rejects(inspectSource(destination),/compatible/);
  }
});
test('Git proxy/CA support preserves the closed subprocess environment and redacts transport errors',async()=>{
  const require=createRequire(import.meta.url),calls=[];
  const bundle=await build({entryPoints:['src/setup/source.ts'],bundle:true,write:false,platform:'node',format:'cjs'});
  const module={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(name=>name==='node:child_process'?{execFile:(command,args,options,callback)=>{
    calls.push({command,args,options});callback(Error('private-proxy-canary'),Buffer.alloc(0));
  }}:require(name),module,module.exports);
  const injected={HTTPS_PROXY:'http://fixture-proxy.invalid:8443',HTTP_PROXY:'http://fixture-proxy.invalid:8080',NO_PROXY:'localhost',SSL_CERT_FILE:'/fixture/ca.pem',GIT_SSL_CAINFO:'/fixture/git-ca.pem',
    ANTHROPIC_API_KEY:'private-proxy-canary',GIT_SSH_COMMAND:'unsafe-command',NODE_OPTIONS:'unsafe-options',OPENCLAW_STATE_DIR:'/fixture/neighbor'};
  const previous=Object.fromEntries(Object.keys(injected).map(key=>[key,process.env[key]]));
  try{
    Object.assign(process.env,injected);await assert.rejects(module.exports.git(['ls-remote','--','https://github.com/automateyournetwork/netclaw.git','refs/heads/main']),error=>!error.message.includes('canary'));
    assert.equal(calls.length,1);const {command,args,options}=calls[0];assert.equal(command,'git');assert.equal(options.timeout,120000);assert.equal(options.maxBuffer,8*1024*1024);
    for(const key of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','SSL_CERT_FILE','GIT_SSL_CAINFO'])assert.equal(options.env[key],injected[key]);
    for(const key of ['ANTHROPIC_API_KEY','GIT_SSH_COMMAND','NODE_OPTIONS','OPENCLAW_STATE_DIR'])assert.equal(options.env[key],undefined);
    assert.equal(options.env.GIT_TERMINAL_PROMPT,'0');assert.equal(options.env.GIT_CONFIG_GLOBAL,'/dev/null');
    for(const value of ['core.hooksPath=/dev/null','credential.helper=','protocol.file.allow=never','protocol.ext.allow=never'])assert.ok(args.includes(value));
  }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
