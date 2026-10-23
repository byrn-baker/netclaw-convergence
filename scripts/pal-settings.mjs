#!/usr/bin/env node
// Provider setup never creates a conversation or enables video usage.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseEnvData, updateEnvironment } from '../ui/netclaw-visual/src/security/private-files.js';
import { tavusClient } from '../ui/netclaw-visual/src/hud-server/pal-provider.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const home=process.env.OPENCLAW_HOME || path.join(os.homedir(),'.openclaw');
const read=file=>fs.existsSync(file)?parseEnvData(fs.readFileSync(file,'utf8')):{};
const env={...read(path.join(root,'.env')),...read(path.join(home,'.env')),...process.env};
const [command,...args]=process.argv.slice(2);
const provider=tavusClient({key:env.TAVUS_API_KEY});
try {
  if(command==='status') console.log(JSON.stringify({keyPresent:!!env.TAVUS_API_KEY,palConfigured:!!env.TAVUS_PAL_ID,stockFaceConfigured:!!env.TAVUS_FACE_ID,enabled:env.NETCLAW_PAL_ENABLED==='true'},null,2));
  else if(command==='faces') console.log(JSON.stringify(await provider.faces(),null,2));
  else if(command==='provision') {
    if(args.length!==3 || args[0]!=='--face' || args[2]!=='--free-plan-confirmed') throw Error('Usage: provision --face STOCK_ID --free-plan-confirmed. Check account eligibility first; no upgrade is performed.');
    if(env.TAVUS_PAL_ID) throw Error('An existing PAL is configured; inspect it instead of provisioning another.');
    const configured=await provider.provision(args[1]);
    updateEnvironment(path.join(home,'.env'),{TAVUS_PAL_ID:configured.palId,TAVUS_FACE_ID:configured.faceId,NETCLAW_PAL_ENABLED:'false'});
    console.log(JSON.stringify({...configured,enabled:false,conversationsCreated:0},null,2));
  } else if(command==='verify') {
    await provider.validate(env.TAVUS_PAL_ID,env.TAVUS_FACE_ID);
    console.log('PAL configuration and stock catalog verified. Balance, live playback and billing remain separate checks.');
  } else console.log('Usage: node scripts/pal-settings.mjs status|faces|provision --face STOCK_ID --free-plan-confirmed|verify');
}catch(error){console.error(error.message);process.exitCode=1;}
