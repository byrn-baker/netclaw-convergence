#!/usr/bin/env node
/** Fixed, one-attempt native QR view. Raw bridge events never enter reports. */
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const fail=()=>{throw Error('Pairing did not settle; inspect the existing attempt before retrying.');};
function read(file,limit=16384){
  if(fs.realpathSync(file)!==file)fail();
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.uid!==process.getuid()||(stat.mode&0o077)||stat.size>limit)fail();
  return fs.readFileSync(file);
}
function authFiles(stage,user){
  if(fs.realpathSync(stage)!==stage)fail();
  const info=fs.lstatSync(stage);if(!info.isDirectory()||info.uid!==process.getuid()||(info.mode&0o077))fail();
  const files={};let total=0;
  for(const name of fs.readdirSync(stage).sort()){
    if(!/^[A-Za-z0-9_.:@-]+\.json$/.test(name))fail();
    const raw=read(path.join(stage,name),4*1024*1024);JSON.parse(raw);total+=raw.length;
    files[name]=createHash('sha256').update(raw).digest('hex');
    if(Object.keys(files).length>2048||total>16*1024*1024)fail();
  }
  const creds=JSON.parse(read(path.join(stage,'creds.json'),4*1024*1024));
  if(!user||creds.registered!==true||creds.me?.id!==user)fail();
  return files;
}
async function main(){
  process.umask(0o077);
  if(process.argv.length!==2)fail();
  const home=process.env.HERMES_HOME;
  if(!home||!path.isAbsolute(home)||fs.realpathSync(home)!==home)fail();
  const base=path.join(home,'.setup/comms/whatsapp'),stage=path.join(base,'pair-stage');
  const owner=JSON.parse(read(path.join(home,'.netclaw-setup-owner.json')));
  const request=JSON.parse(read(path.join(base,'pair-request.json')));
  if(request.schema!==1||!/^[a-f0-9]{64}$/.test(request.nonce)||request.runId!==owner.runId||
     request.planHash!==owner.planHash||request.owner!==owner.installationId)fail();
  const target=path.join(base,'pair-result.json');if(fs.existsSync(target))fail();
  const bridgeDir=path.join(home,'.setup/comms/native/whatsapp');
  const bridge=path.join(bridgeDir,'bridge.js');
  if(!read(bridge,4*1024*1024).includes(Buffer.from('if (PAIR_ONLY) return; // NetClaw owned installer: auth only')))fail();
  const qr=createRequire(path.join(bridgeDir,'package.json'))('qrcode-terminal');
  console.log('Link this new installation in WhatsApp → Linked devices. This step only pairs the account.');
  const env={PATH:process.env.PATH,HOME:process.env.HOME,HERMES_HOME:home,
    WHATSAPP_MODE:'bot',WHATSAPP_DM_POLICY:'disabled',WHATSAPP_GROUP_POLICY:'disabled',
    WHATSAPP_ALLOWED_USERS:'',WHATSAPP_SEND_READ_RECEIPTS:'false',WHATSAPP_FORWARD_OWNER_MESSAGES:'false'};
  const child=spawn(process.execPath,[bridge,'--pair-only','--pair-json','--session',stage,'--mode','bot'],
    {cwd:bridgeDir,env,stdio:['ignore','pipe','pipe']});
  let pending='',bytes=0,connectedUser=null,started=false,invalid=false;
  let hardStop;
  const stop=()=>{invalid=true;child.kill('SIGTERM');hardStop??=setTimeout(()=>child.kill('SIGKILL'),2500);};
  const timer=setTimeout(stop,180000);
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024)stop();});
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{
    bytes+=Buffer.byteLength(chunk);pending+=chunk;
    if(bytes>1024*1024||pending.length>65536){stop();return;}
    while(pending.includes('\n')){
      const index=pending.indexOf('\n'),line=pending.slice(0,index);pending=pending.slice(index+1);
      let event;try{event=JSON.parse(line);}catch{stop();return;}
      if(event.event==='started'){if(started||path.resolve(event.session||'')!==stage){stop();return;}started=true;}
      else if(event.event==='qr'&&started&&typeof event.qr==='string'&&event.qr.length<=8192){
        qr.generate(event.qr,{small:true},code=>process.stdout.write(code+'\n'));
      }else if(event.event==='connected'&&started&&typeof event.user?.id==='string'&&/^[0-9]+(?::[0-9]+)?@(?:s\.whatsapp\.net|lid)$/.test(event.user.id)){
        if(connectedUser&&connectedUser!==event.user.id){stop();return;}connectedUser=event.user.id;
      }else if(event.event!=='disconnected'){stop();return;}
    }
  });
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  clearTimeout(timer);clearTimeout(hardStop);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  if(invalid||code!==0||!started||!connectedUser||pending.trim())fail();
  const receipt={schema:1,nonce:request.nonce,state:'paired',returncode:0,connectedUser,files:authFiles(stage,connectedUser)};
  const fd=fs.openSync(target,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(receipt));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  console.log('Account pairing saved. Messaging activation is a separate reviewed step.');
}
main().catch(()=>{console.error('Pairing is incomplete or uncertain. The existing attempt was preserved; it will not automatically repeat.');process.exitCode=8;});
