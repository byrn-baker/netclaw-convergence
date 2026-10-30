import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {readData,realParents} from './data';

export interface KnownInstallation {home:string;harness?:'openclaw'|'hermes';label?:string;installationId?:string}
export interface DetectedInstallation extends KnownInstallation {state:'found'|'unreachable'|'unknown';netclaw:boolean;reason:string}
export function detectInstallations(registered:KnownInstallation[]=[],selected:KnownInstallation[]=[],ownerHome=os.homedir()):DetectedInstallation[]{
  const candidates=[...registered,...selected,{home:path.join(ownerHome,'.openclaw'),harness:'openclaw' as const},
    {home:path.join(ownerHome,'.hermes'),harness:'hermes' as const}];
  const seen=new Set<string>(),result:DetectedInstallation[]=[];
  if(candidates.length>130)throw Error('Installation detection is limited to 128 selected/registered homes and two defaults.');
  for(const candidate of candidates){
    if(seen.has(candidate.home))continue;seen.add(candidate.home);
    try{
      realParents(candidate.home);
      if(!fs.statSync(candidate.home).isDirectory())throw Error('Home is not a directory.');
      const harness=candidate.harness||(fs.existsSync(path.join(candidate.home,'openclaw.json'))?'openclaw':
        fs.existsSync(path.join(candidate.home,'config.yaml'))?'hermes':undefined);
      let installationId:string|undefined;
      try{const identity=readData(path.join(candidate.home,'netclaw-hud/installation.json'),8192);
        if(identity.schemaVersion!==1||!/^[a-f0-9-]{36}$/.test(identity.installationId))throw Error('Identity is invalid.');installationId=identity.installationId;}
      catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
      if(candidate.installationId&&installationId!==candidate.installationId)throw Error('Saved identity changed.');
      if(harness||installationId)result.push({...candidate,harness,installationId,state:'found',netclaw:!!installationId,
        reason:installationId?'Existing NetClaw detected. This setup creates a separate installation.':'Existing claw runtime detected. This setup creates a separate NetClaw installation.'});
    }catch(error){
      if((error as NodeJS.ErrnoException).code==='ENOENT'){
        if(registered.some(r=>r.home===candidate.home))result.push({...candidate,state:'unreachable',netclaw:false,reason:'Saved installation is unavailable. Its connection is preserved.'});
      }else result.push({...candidate,state:'unknown',netclaw:false,reason:'This path could not be safely inspected. Select a different empty home or manage the existing binding.'});
    }
  }
  return result;
}
