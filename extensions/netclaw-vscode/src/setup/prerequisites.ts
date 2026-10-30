import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {Probe,probe} from './host';
import {readData} from './data';

export interface Prerequisite {id:string;state:'ready'|'missing'|'unsupported'|'unknown';version?:string;required?:string;url?:string;reason:string;remedy:string}
export function preparedMacPaths(arch:string,exists=(file:string)=>fs.existsSync(file)){
  const prefix=arch==='arm64'?'/opt/homebrew':arch==='x64'?'/usr/local':undefined;
  if(!prefix)return [];
  return [prefix+'/opt/node@24/bin',prefix+'/opt/python@3.12/libexec/bin',prefix+'/bin',prefix+'/sbin'].filter(exists);
}
export function version(text:string):number[]|undefined{const m=text.match(/\b(?:v)?(\d+)\.(\d+)\.(\d+)\b/);return m?m.slice(1).map(Number):undefined;}
const compare=(a:number[],b:number[])=>{for(let i=0;i<Math.max(a.length,b.length);i++){const difference=(a[i]||0)-(b[i]||0);if(difference)return difference;}return 0;};
export function supportsNode(value:number[],rules:{min:number[];max_exclusive?:number[]}[]){return rules.some(rule=>compare(value,rule.min)>=0&&(!rule.max_exclusive||compare(value,rule.max_exclusive)<0));}
export async function prerequisites(extensionRoot:string,harness:'openclaw'|'hermes',run:Probe=probe,source?:string):Promise<Prerequisite[]>{
  const policy=readData(path.join(source||extensionRoot,source?'config/installer-runtime.json':'dist/setup/installer-runtime.json'));
  const preflight=readData(path.join(source||extensionRoot,source?'config/installer-preflight.json':'dist/setup/installer-preflight.json'));
  const checks=[['git',['--version']],['python3',['--version']],['node',['--version']],['uv',['--version']]] as const;
  return Promise.all(checks.map(async([id,args])=>{
    const result=await run(id,[...args]);
    if(result.code)return {id,state:'missing' as const,reason:'Executable unavailable in this extension host.',remedy:id};
    const actual=version(result.stdout.toString('utf8'));
    if(!actual)return {id,state:'unknown' as const,reason:'Version response was not recognized.',remedy:id};
    const ready=id==='node'?supportsNode(actual,policy.node_ranges[harness])&&supportsNode(actual,policy.node_ranges.hud):id==='python3'?compare(actual,preflight.defaults.python_min)>=0:true;
    return {id,state:ready?'ready' as const:'unsupported' as const,version:actual.join('.'),
      required:id==='node'?policy.node_descriptions[harness]+'; HUD '+policy.node_descriptions.hud:id==='python3'?'>='+preflight.defaults.python_min.join('.'):'available executable',
      reason:id==='node'?'Selected runtime and HUD policy both apply.':id==='python3'?'Setup engine needs Python 3.10+. Component interpreters remain isolated.':'Read-only version probe.',remedy:id};
  }));
}
export async function hostPrerequisites(components:string[],hostKind:string,run:Probe=probe,reach=async(url:string)=>{
  const r=await fetch(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(7000)});return r.ok;
}):Promise<Prerequisite[]>{
  const rows:Prerequisite[]=[{id:'host',state:['macos','wsl2'].includes(hostKind)?'ready':'unsupported',version:os.release()+' · '+os.arch(),
    required:'macOS arm64/x64 or WSL2 Ubuntu 24.04/26.04 x64/arm64',reason:'Active extension host; native Windows does not install claws.',remedy:'host',url:'https://code.visualstudio.com/docs/remote/wsl'}];
  try{const disk=fs.statfsSync(os.homedir());rows.push({id:'disk',state:'unknown',version:String(Math.floor(disk.bavail*disk.bsize/1024**3))+' GiB free',required:'Selected dependencies and models; exact download total unknown',reason:'Observed on the home filesystem. A different destination may have different capacity.',remedy:'disk',url:'https://github.com/automateyournetwork/netclaw'});}catch{}
  if(components.some(c=>['nsm','elastic','batfish','github'].includes(c))){const r=await run('docker',['version','--format','{{.Server.Version}}']),actual=version(r.stdout.toString('utf8'));rows.push({id:'docker',state:r.code?'missing':actual?'ready':'unknown',version:actual?.join('.'),required:'Reachable Docker engine with a recognized server version',reason:'Selected container-backed components need an engine; this probe starts no container.',remedy:'docker',url:'https://docs.docker.com/engine/install/'});}
  const urls=['https://api.github.com','https://registry.npmjs.org','https://pypi.org'];
  rows.push(...await Promise.all(urls.map(async url=>{let ready=false;try{ready=await reach(url);}catch{}return {id:new URL(url).hostname,state:ready?'ready' as const:'unknown' as const,version:ready?'reachable':'not verified',required:'HTTPS package/source reachability',reason:'User-started HEAD request; redirects, credentials and response bodies are not followed.',remedy:'network',url};})));
  return rows;
}
export function remedy(id:string,platform:'macos'|'wsl2',resolvedNode=''):{command?:string;url:string;detail:string}{
  const docs:{[key:string]:string}={node:'https://nodejs.org/en/download',python3:'https://www.python.org/downloads/',git:'https://git-scm.com/downloads',uv:'https://docs.astral.sh/uv/getting-started/installation/'};
  if(!Object.hasOwn(docs,id))throw Error('Unknown prerequisite.');
  if(id==='node'&&/nvm|fnm|volta/.test(resolvedNode))return {url:docs.node!,detail:'Select Node 24.19+ or 26.1+ with your existing version manager, then reload this window.'};
  if(platform==='macos')return {command:id,url:docs[id]!,detail:'Install '+({git:'Git',python3:'Python 3.12',node:'Node 24',uv:'uv'} as Record<string,string>)[id]+' using Homebrew on this Mac. If Homebrew is missing, a pinned SHA-256-checked official installer prepares it and Apple Command Line Tools. This downloads packages, changes host package directories and may ask for your Mac password. It does not start a claw. Close the terminal when it finishes, then recheck. No shell commands need to be typed.'};
  const commands=
    {git:'sudo apt-get install git',python3:'sudo apt-get install python3 python3-venv',node:undefined,uv:undefined};
  return {command:commands[id as keyof typeof commands],url:docs[id]!,detail:'A separately reviewed terminal step changes host packages. Recheck afterward; terminal completion is not proof.'};
}
