import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {canonical,hash,strictJson,readBytes,realParents} from './data';

export interface Handoff {schema:1;nonce:string;createdAt:number;expiresAt:number;distribution:string;answers:Record<string,unknown>;digest:string}
export function createHandoff(distribution:string,answers:Record<string,unknown>,now=Date.now()):Handoff{
  if(!distribution||distribution.length>120||/[\\/\x00-\x1f]/.test(distribution))throw Error('Invalid WSL distribution.');
  const data=canonical(answers);if(Buffer.byteLength(data)>256*1024)throw Error('Saved setup answers exceed their limit.');
  // Handoff accepts the non-secret answer model only. Credential fields are
  // references; draft literals and general environment dictionaries are refused.
  const inspect=(value:any,key='')=>{
    if(/^(?:password|token|secret|apiKey|env|environment|credentials)$/i.test(key))throw Error('Secrets cannot cross a setup handoff.');
    if(value&&typeof value==='object'){
      if(value.kind==='secret'&&('value' in value||!['prompt','later','existing'].includes(value.source)))throw Error('Secrets must be references.');
      for(const [k,v] of Object.entries(value))inspect(v,k);
    }
    if(typeof value==='string'&&/(?:\bsk-(?:ant-)?[\w-]{8,}|\bgh[pousr]_[\w]{8,}|\bBearer\s+\S+|-----BEGIN .*PRIVATE KEY-----|https?:\/\/[^/\s]+@)/i.test(value))throw Error('Remove credential literals before handoff.');
  };inspect(answers);
  const core={schema:1 as const,nonce:randomBytes(24).toString('hex'),createdAt:now,expiresAt:now+15*60*1000,distribution,answers};
  return {...core,digest:hash(canonical(core))};
}
export function acceptHandoff(data:Buffer|string,distribution:string,used:Set<string>,now=Date.now()):Handoff{
  const value=strictJson(data,300*1024) as Handoff;
  if(Object.keys(value).sort().join(',')!=='answers,createdAt,digest,distribution,expiresAt,nonce,schema'||value.schema!==1||
    !/^[a-f0-9]{48}$/.test(value.nonce)||value.distribution!==distribution||value.expiresAt<now||value.createdAt>now||
    value.expiresAt-value.createdAt!==15*60*1000||used.has(value.nonce))throw Error('Setup handoff expired or does not match this window.');
  const {digest,...core}=value;if(hash(canonical(core))!==digest)throw Error('Setup handoff changed.');
  // Revalidate all non-secret answers; its fresh nonce is deliberately ignored.
  createHandoff(distribution,value.answers,now);used.add(value.nonce);return value;
}
export function remoteFolder(distribution:string,folder:string){
  if(!folder.startsWith('/')||folder.includes('\0')||folder.split('/').includes('..'))throw Error('Choose an absolute WSL folder.');
  return {scheme:'vscode-remote',authority:'wsl+'+distribution,path:folder};
}
// Fixed shell program with data on stdin and validated positional arguments.
// Called only after a separate native review discloses distro start, creation
// of this private resume record and possible VS Code Server installation.
export const handoffProgram=`import os,pathlib,re,sys,stat
nonce=sys.argv[1]
assert re.fullmatch(r'[a-f0-9]{48}',nonce)
data=sys.stdin.buffer.read(307201)
assert len(data)<=307200
root=pathlib.Path.home()/'.local/state/netclaw/setup/handoffs'
fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
try:
 for part in root.parts[1:]:
  try:child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
  except FileNotFoundError:
   os.mkdir(part,0o700,dir_fd=fd);os.fsync(fd)
   child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
  info=os.fstat(child)
  assert info.st_uid in (0,os.getuid()) and (not info.st_mode&0o022 or info.st_mode&stat.S_ISVTX)
  os.close(fd);fd=child
 info=os.fstat(fd);assert info.st_uid==os.getuid() and not info.st_mode&0o077
 output=os.open(nonce+'.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=fd)
 with os.fdopen(output,'wb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
 os.fsync(fd)
finally:os.close(fd)
`;
export function handoffCommand(value:Handoff){
  if(!/^[a-f0-9]{48}$/.test(value.nonce))throw Error('Invalid handoff identity.');
  return ['--distribution',value.distribution,'--exec','python3','-c',handoffProgram,value.nonce];
}

export function pendingHandoffs(root:string,distribution:string,now=Date.now()):Handoff[]{
  realParents(root);if(!fs.existsSync(root))return [];
  const info=fs.statSync(root);if(!info.isDirectory()||info.mode&0o077||info.uid!==process.getuid?.())throw Error('Handoff directory must be private.');
  const files=fs.readdirSync(root).filter(name=>/^[a-f0-9]{48}\.json$/.test(name));
  if(files.length>128)throw Error('Too many pending handoffs. Inspect the local setup records.');
  const result:Handoff[]=[];
  for(const name of files){
    if(fs.existsSync(path.join(root,'.used-'+name.slice(0,48))))continue;
    const file=path.join(root,name),info=fs.lstatSync(file);if(info.mode&0o077)continue;
    try{const value=acceptHandoff(readBytes(file,300*1024),distribution,new Set(),now);
      if(name!==value.nonce+'.json')throw Error('Handoff name changed.');result.push(value);}catch{/* Invalid/expired records never import. */}
  }
  return result.sort((a,b)=>b.createdAt-a.createdAt);
}
export function claimHandoff(root:string,value:Handoff,now=Date.now()){
  realParents(root);const current=acceptHandoff(readBytes(path.join(root,value.nonce+'.json'),300*1024),value.distribution,new Set(),now);
  if(current.digest!==value.digest)throw Error('Handoff changed since review.');
  const info=fs.statSync(root);if(info.mode&0o077||info.uid!==process.getuid?.())throw Error('Handoff directory must be private.');
  const fd=fs.openSync(path.join(root,'.used-'+value.nonce),'wx',0o600);
  try{fs.writeFileSync(fd,canonical({schema:1,digest:value.digest,consumedAt:now}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  const dir=fs.openSync(root,fs.constants.O_RDONLY);try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
  return current.answers;
}
