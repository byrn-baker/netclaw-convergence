import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {bytes,fileHash,safePath,safeExecutable,json,hash,utf8} from './claw-files.mjs';
import {observeSystemdArgv} from './claw-systemd.mjs';

export function setupSourceInputs(t,m){
  const index=path.join(t.home,'.setup/service-source.json'),raw=bytes(index,8*1024*1024).b;
  if(hash(raw)!==m.sourceIndex?.sha256)throw Error('Setup source index changed.');
  const data=JSON.parse(utf8(raw));
  if(data.schema!==1||data.source!==t.root||!Array.isArray(data.files)||!data.files.length||data.files.length>20000||data.files.length!==m.sourceIndex.count)
    throw Error('Setup source index is invalid.');
  const seen=new Set(),inputs=[[index,index,hash(raw)]];
  for(const item of data.files){
    const name=item?.path;
    if(typeof name!=='string'||!name||name.includes('\\')||name.includes('\0')||path.posix.isAbsolute(name)||path.posix.normalize(name)!==name||name.split('/').some(p=>p==='..'||p==='')||seen.has(name)||!/^[a-f0-9]{64}$/.test(item.sha256))
      throw Error('Setup source index is invalid.');
    seen.add(name);const file=path.join(t.root,name);
    if(fileHash(file)!==item.sha256)throw Error('Setup service source changed.');
    inputs.push([file,file,item.sha256]);
  }
  if(!seen.has('scripts/setup-service.py'))throw Error('Setup launcher is not owned.');
  return inputs;
}

// Explicit Spec153 manifest; never broaden the legacy service-name heuristic.
export async function setupServices(t,run,platform=process.platform){
  const manifest=path.join(t.home,'.setup/services.json');
  if(!fs.existsSync(manifest))return [];
  const m=json(manifest),owner=json(path.join(t.home,'.netclaw-setup-owner.json'));
  if(m.schema!==1||m.installationId!==t.installationId||m.home!==t.home||m.source!==t.root||m.harness!==t.kind||m.owner!==owner.installationId||m.runId!==owner.runId||m.userHome!==os.userInfo().homedir||!Array.isArray(m.services)||m.services.length>3)
    throw Error('Setup service ownership changed.');
  const expectedPlatform=platform==='darwin'?'macos':platform==='linux'?'wsl2':undefined;
  if(!expectedPlatform||m.platform!==expectedPlatform)throw Error('Setup service host is unsupported.');
  const sourceInputs=setupSourceInputs(t,m);
  const base=path.join(m.userHome,platform==='darwin'?'Library/LaunchAgents':'.config/systemd/user'),seen=new Set(),result=[];
  for(const item of m.services){
    const suffix=platform==='darwin'?'.plist':'.service';
    if(!['gateway','hud','federation'].includes(item.role)||seen.has(item.role)||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,140}$/.test(item.label)||!item.label.endsWith('-'+item.role)||item.file!==path.join(base,item.label+suffix)||fileHash(item.file)!==item.sha256||!Array.isArray(item.arguments)||item.arguments.length!==6)
      throw Error('Setup service definition changed.');
    seen.add(item.role);
    const expected=[item.arguments[0],path.join(t.root,'scripts/setup-service.py'),'--home',t.home,'--role',item.role];
    if(JSON.stringify(item.arguments)!==JSON.stringify(expected))throw Error('Setup launcher is unsupported.');
    safeExecutable(item.arguments[0]);safePath(item.arguments[1]);
    const inputs=[manifest,path.join(t.home,'.netclaw-setup-owner.json'),item.file].map(p=>[p,p,fileHash(p)]).concat(sourceInputs);
    const executable=fs.realpathSync(item.arguments[0]);inputs.push([item.arguments[0],executable,fileHash(executable,true)]);
    const role=item.role,port=m.endpoints?.[role==='hud'?'hudPort':role==='gateway'?'gatewayPort':'bgpApiPort'];
    if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Setup endpoint is invalid.');
    const health=role==='hud'?{url:`http://127.0.0.1:${port}/api/runtime`,httpUrls:[`http://127.0.0.1:${m.endpoints.hudUiPort}/`],installationId:t.installationId,identityKey:'installationId'}:
      role==='gateway'?{url:`http://127.0.0.1:${port}/health`}:
      m.role==='member'?{type:'setup-member',file:path.join(t.home,'netclaw-federation/setup-member-health.json')}:
      {url:`http://127.0.0.1:${port}/status`,installationId:t.installationId,identityKey:'installation_id',kind:t.kind,kindKey:'harness_type',readyKey:'federation_ready'};
    if(platform==='darwin'){
      const d=JSON.parse(await run('/usr/bin/plutil',['-convert','json','-o','-',item.file]));
      if(d.Label!==item.label||d.WorkingDirectory!==t.home||d.Program||d.EnvironmentVariables||JSON.stringify(d.ProgramArguments)!==JSON.stringify(expected))throw Error('Setup launchd definition is invalid.');
      const domain='gui/'+process.getuid();let loaded='';
      try{loaded=await run('/bin/launchctl',['print',domain+'/'+item.label]);}catch{}
      if(loaded){
        const args=loaded.match(/\n\s*arguments = \{\n([\s\S]*?)\n\s*\}/)?.[1].split('\n').map(s=>s.trim()).filter(Boolean);
        if(!loaded.includes('path = '+item.file)||!loaded.includes('program = '+expected[0])||JSON.stringify(args)!==JSON.stringify(expected))throw Error('Loaded setup service differs from disk.');
      }
      result.push({role,controller:'launchd',label:item.label,domain,file:item.file,inputs,installationId:t.installationId,home:t.home,kind:t.kind,health});
    }else{
      const unit=path.basename(item.file),raw=await run('/usr/bin/systemctl',['--user','show',unit,'--no-pager','--property=FragmentPath,DropInPaths,NeedDaemonReload']);
      const values=Object.fromEntries(raw.split('\n').filter(v=>v.includes('=')).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
      if(values.FragmentPath!==item.file||values.DropInPaths||values.NeedDaemonReload!=='no')throw Error('Loaded setup unit differs from disk.');
      await observeSystemdArgv(run,item);
      result.push({role,controller:'systemd',unit,inputs,installationId:t.installationId,home:t.home,kind:t.kind,health});
    }
  }
  return result;
}
