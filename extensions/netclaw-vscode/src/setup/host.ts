import fs from 'node:fs';
import os from 'node:os';
import {execFile} from 'node:child_process';

export type ProbeResult={code:number;stdout:Buffer};
export type Probe=(command:string,args:string[])=>Promise<ProbeResult>;
export interface HostInput {platform:string;remote?:string;kernel?:string;osRelease?:string}
export interface HostGate {kind:'macos'|'wsl2'|'windows-gate'|'unsupported';reason:string;release?:string}
export interface Distribution {name:string;version:1|2;default:boolean;state:string}

export const probe:Probe=(command,args)=>new Promise(resolve=>{
  execFile(command,args,{encoding:'buffer',timeout:10000,maxBuffer:128*1024,windowsHide:true,
    env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,LANG:'C',LC_ALL:'C'}},
    (error,stdout)=>resolve({code:error?1:0,stdout:Buffer.isBuffer(stdout)?stdout:Buffer.from(stdout||'')}));
});

export function decodeWsl(bytes:Buffer):string {
  if(bytes.length>128*1024)throw Error('WSL response exceeds its limit.');
  let encoding='utf-8',data=bytes;
  if(bytes[0]===0xff&&bytes[1]===0xfe){encoding='utf-16le';data=bytes.subarray(2);}
  else if(bytes[0]===0xfe&&bytes[1]===0xff){encoding='utf-16be';data=bytes.subarray(2);}
  else if(bytes.length>=4&&bytes[1]===0&&bytes[3]===0)encoding='utf-16le';
  const result=new TextDecoder(encoding,{fatal:true}).decode(data).replace(/^\ufeff/,'');
  if(/[\0\x01-\x08\x0b\x0c\x0e-\x1f]/.test(result))throw Error('WSL response has invalid control characters.');
  return result;
}

export function parseWslList(text:string):Distribution[]{
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length)return [];
  const rows:Distribution[]=[];
  for(const line of lines.slice(1)){
    const match=line.match(/^\s*(\*)?\s*(.+?)\s{2,}(.+?)\s{2,}([12])\s*$/);
    if(!match||!match[2]||!match[3]||!match[4]||match[2].length>120||/[\\/\x00-\x1f]/.test(match[2]))
      throw Error('WSL distribution version could not be verified.');
    if(rows.some(row=>row.name.toLowerCase()===match[2]!.toLowerCase())||(match[1]&&rows.some(row=>row.default)))
      throw Error('WSL distribution identity is ambiguous.');
    rows.push({name:match[2],state:match[3],version:Number(match[4]) as 1|2,default:!!match[1]});
  }
  // A one-line error cannot masquerade as an empty supported distribution list.
  if(!rows.length&&!/^\s*(?:NAME|NOM|NAME\s+STATUS)/i.test(lines[0]!))
    throw Error('WSL distribution list is unknown.');
  return rows;
}

export function classifyHost(input:HostInput):HostGate{
  if(input.platform==='win32'&&!input.remote)return {kind:'windows-gate',reason:'Setup runs inside an explicitly selected WSL2 Ubuntu distribution.'};
  if(input.platform==='darwin'&&!input.remote)return {kind:'macos',reason:'Local macOS extension host.'};
  if(input.platform==='linux'&&input.remote==='wsl'&&/microsoft-standard-wsl2/i.test(input.kernel||'')){
    const release=Object.fromEntries((input.osRelease||'').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{
      const p=l.indexOf('=');return [l.slice(0,p),l.slice(p+1).replace(/^"|"$/g,'')];
    }));
    if(release.ID==='ubuntu'&&['24.04','26.04'].includes(release.VERSION_ID||''))
      return {kind:'wsl2',reason:'Ubuntu identity verified in the active WSL2 extension host.',release:release.VERSION_ID};
  }
  return {kind:'unsupported',reason:'Use local macOS or a WSL2 remote window running Ubuntu 24.04 or 26.04.'};
}

export function currentHost(remote?:string):HostGate{
  return classifyHost({platform:process.platform,remote,kernel:os.release(),
    osRelease:process.platform==='linux'?fs.readFileSync('/etc/os-release','utf8'):undefined});
}

export async function windowsGate(run:Probe=probe){
  // These are the only gate commands. No --distribution, shell, WSL update,
  // install, shutdown, distro start or VS Code Server installation here.
  try{
    const status=await run('wsl.exe',['--status']);
    const list=await run('wsl.exe',['--list','--verbose']);
    if(status.code||list.code)return {state:'unknown',distributions:[] as Distribution[],reason:'WSL status could not be verified. Open the prerequisite guide or retry.'};
    decodeWsl(status.stdout);
    const distributions=parseWslList(decodeWsl(list.stdout));
    return {state:distributions.length?'available':'missing',distributions,
      reason:'Distribution names are candidates. Ubuntu release identity is rechecked after the explicit handoff.'};
  }catch{return {state:'unknown',distributions:[] as Distribution[],reason:'WSL returned an unrecognized response. No distribution was started.'};}
}
