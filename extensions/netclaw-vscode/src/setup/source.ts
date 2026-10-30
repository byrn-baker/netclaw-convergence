import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {canonical,hash,readData,readBytes,realParents,strictJson} from './data';

export const sourceOrigin='https://github.com/automateyournetwork/netclaw.git';
type Git=(args:string[],cwd?:string)=>Promise<Buffer>;
export interface SourceSelection {channel:'release'|'main'|'tag'|'existing';ref:string;commit:string;provenance:string}
export const git:Git=(args,cwd)=>new Promise((resolve,reject)=>{
  const env:NodeJS.ProcessEnv={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,HOME:'/nonexistent',
    GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0',LC_ALL:'C'};
  for(const key of ['HTTPS_PROXY','HTTP_PROXY','NO_PROXY','SSL_CERT_FILE','GIT_SSL_CAINFO'])if(process.env[key])env[key]=process.env[key];
  execFile('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','credential.helper=',
    '-c','protocol.file.allow=never','-c','protocol.ext.allow=never',...args],
    {cwd,env,encoding:'buffer',timeout:120000,maxBuffer:8*1024*1024,windowsHide:true},
    (error,stdout)=>error?reject(Error('Source operation failed. Check connectivity and the selected source.')):resolve(stdout));
});

export function validateRef(ref:string){
  if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(ref)||ref.includes('..')||ref.includes('//')||ref.endsWith('/')||ref.endsWith('.lock'))
    throw Error('Choose a valid explicit source ref.');
  return ref;
}

export async function resolveSelection(channel:'release'|'main'|'tag',ref?:string,
  adapters:{fetch?:typeof fetch|any;git?:Git}={}):Promise<SourceSelection>{
  const fetcher=adapters.fetch||fetch,run=adapters.git||git;
  let chosen=ref,provenance=channel==='main'?'branch':'explicit-tag';
  if(channel==='release'){
    const response=await fetcher('https://api.github.com/repos/automateyournetwork/netclaw/releases/latest',
      {headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!response.ok)throw Error('Published release lookup failed. Retry or explicitly select a tag; no latest-release claim is available.');
    // Native fetch is bounded before parsing. Test adapters may supply a small
    // decoded fixture; untrusted network bodies never use response.json().
    let release:any;
    if(response.body){
      const reader=response.body.getReader();const parts:Uint8Array[]=[];let size=0;
      try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;
        if(size>1024*1024)throw Error('Release response exceeds its limit.');parts.push(item.value);}}
      finally{await reader.cancel();}
      release=strictJson(Buffer.concat(parts),1024*1024);
    }else release=await response.json();
    if(release.draft!==false||release.prerelease!==false||typeof release.tag_name!=='string')throw Error('Published release metadata is invalid.');
    chosen=release.tag_name;provenance='published-release';
  }
  if(channel==='main')chosen='main';
  chosen=validateRef(chosen||'');
  const target=channel==='main'?'refs/heads/main':'refs/tags/'+chosen;
  const raw=await run(['ls-remote','--',sourceOrigin,target,target+'^{}']);
  const rows=raw.toString('utf8').trim().split('\n').map(l=>l.split(/\s+/));
  const entry=rows.find(r=>r[1]===target+'^{}')||rows.find(r=>r[1]===target);
  if(!entry?.[0]||!/^[a-f0-9]{40}$/.test(entry[0]))throw Error('Selected source ref could not be resolved.');
  return {channel,ref:chosen,commit:entry[0],provenance};
}

export function verifyManifest(value:any){
  const keys=['catalogSchema','entryPoint','planSchema','protocol','pythonMinimum'];
  if(!value||canonical(Object.keys(value).sort())!==canonical(keys)||value.protocol?.major!==1||value.protocol?.minor!==0||
    Object.keys(value.protocol).sort().join(',')!=='major,minor'||value.planSchema!==1||value.catalogSchema!==1||
    value.entryPoint!=='scripts/setup-engine.py'||canonical(value.pythonMinimum)!=='[3,10]')
    throw Error('This checkout does not provide a compatible setup engine.');
}

export async function inspectSource(root:string,run:Git=git){
  realParents(root);if(!fs.statSync(root).isDirectory())throw Error('Select a source directory.');
  const top=(await run(['rev-parse','--show-toplevel'],root)).toString().trim();
  if(fs.realpathSync(top)!==fs.realpathSync(root))throw Error('Select the checkout root.');
  const origin=(await run(['config','--get','remote.origin.url'],root)).toString().trim();
  if(![sourceOrigin,sourceOrigin.slice(0,-4)].includes(origin))throw Error('Checkout origin is not the NetClaw project.');
  const commit=(await run(['rev-parse','--verify','HEAD'],root)).toString().trim();
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('Checkout commit is invalid.');
  // Do not run status/diff here: a reused checkout can configure executable
  // clean filters. Raw tree/index/blob comparison executes no such filter.
  const head=new Map<string,string>();
  for(const row of (await run(['ls-tree','-rz','--full-tree','HEAD'],root)).toString('utf8').split('\0').filter(Boolean)){
    const at=row.indexOf('\t'),[mode,kind,oid]=row.slice(0,at).split(' ');
    if(at<0||kind!=='blob')throw Error('Source submodules are not qualified.');head.set(row.slice(at+1),mode+' '+oid);
  }
  const indexed=new Map<string,string>();let dirty=false;
  for(const row of (await run(['ls-files','--stage','-z'],root)).toString('utf8').split('\0').filter(Boolean)){
    const at=row.indexOf('\t'),[mode,oid,stage]=row.slice(0,at).split(' ');if(at<0)throw Error('Source index is invalid.');
    if(stage!=='0')dirty=true;indexed.set(row.slice(at+1),mode+' '+oid);
  }
  if(indexed.size!==head.size||[...indexed].some(([name,value])=>head.get(name)!==value))dirty=true;
  const files=(await run(['ls-files','-z','--cached','--others','--exclude-standard'],root)).toString('utf8').split('\0').filter(Boolean);
  const unique=[...new Set(files)].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
  if(unique.length>50000)throw Error('Source inventory exceeds its limit.');
  const digest=createHash('sha256');let total=0;
  for(const name of unique){
    if(path.isAbsolute(name)||name.split('/').includes('..')||name.includes('\n'))throw Error('Source path is invalid.');
    const file=path.join(root,name);realParents(path.dirname(file),true);let data:Buffer,mode:string;
    try{const info=fs.lstatSync(file);
      if(info.isSymbolicLink()){data=Buffer.from(fs.readlinkSync(file));mode='l';}
      else{if(!info.isFile()||info.size>64*1024*1024)throw Error('Source file is unavailable.');
        data=readBytes(file,64*1024*1024,true);mode=info.mode&0o111?'x':'f';}
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;data=Buffer.alloc(0);mode='d';}
    total+=data.length;if(total>2*1024*1024*1024)throw Error('Source bytes exceed their limit.');
    const gitMode=({l:'120000',x:'100755',f:'100644',d:'d'} as Record<string,string>)[mode];
    const blob=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
    if(head.get(name)!==gitMode+' '+blob)dirty=true;
    digest.update(Buffer.from(name+'\0'+mode+'\0'));digest.update(Buffer.from(hash(data),'hex'));
  }
  if(unique.length!==head.size||unique.some(name=>!head.has(name)))dirty=true;
  verifyManifest(readData(path.join(root,'config/setup-engine.json'),16384));
  realParents(path.join(root,'scripts/setup-engine.py'));
  if(!fs.lstatSync(path.join(root,'scripts/setup-engine.py')).isFile())throw Error('Setup engine entry is unavailable.');
  return {path:root,commit,dirty,treeHash:digest.digest('hex')};
}

export async function acquireSource(selection:SourceSelection,destination:string,options:{
  reviewed:boolean;git?:Git;record:(value:object)=>Promise<void>;
}){
  if(!options.reviewed)throw Error('Native source acquisition review is required.');
  if(!/^[a-f0-9]{40}$/.test(selection.commit))throw Error('Resolve the source commit before acquisition.');
  realParents(destination);
  const existed=fs.existsSync(destination);
  if(existed&&(!fs.statSync(destination).isDirectory()||fs.readdirSync(destination).length))throw Error('Choose an empty destination. Existing NetClaw source is preserved.');
  const parent=path.dirname(destination);realParents(parent);
  const run=options.git||git,owner=randomUUID();
  await options.record({schema:1,owner,destination,existedBefore:existed,commit:selection.commit,state:'intent'});
  if(!existed)fs.mkdirSync(destination,{mode:0o700});
  // An exclusive Git directory claims an existing empty destination too. Two
  // reviewed windows must not initialize/fetch into the same worktree at once.
  fs.mkdirSync(path.join(destination,'.git'),{mode:0o700});
  await run(['init','--',destination]);
  await run(['remote','add','origin',sourceOrigin],destination);
  await run(['config','netclaw.setup-owner',owner],destination);
  await run(['fetch','--depth=1','--no-tags','origin',selection.commit],destination);
  await run(['checkout','--detach',selection.commit],destination);
  const actual=await inspectSource(destination,run);
  if(actual.commit!==selection.commit||actual.dirty)throw Error('Acquired source differs from the reviewed commit.');
  await options.record({schema:1,owner,destination,existedBefore:existed,commit:selection.commit,treeHash:actual.treeHash,state:'verified'});
  return {...selection,...actual};
}
