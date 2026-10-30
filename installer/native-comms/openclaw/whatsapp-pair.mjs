/** Single fresh linked-device attempt. No gateway, message handlers or sends. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const hash=(data)=>createHash('sha256').update(data).digest('hex');
function read(file){
 if(fs.realpathSync(file)!==file)throw Error('alias');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const s=fs.fstatSync(fd);if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)||s.size>4*1024*1024)throw Error('private_input');
  return JSON.parse(fs.readFileSync(fd,'utf8'));}finally{fs.closeSync(fd);}
}
function output(file,value){
 const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function privateDirectory(file){
 const s=fs.lstatSync(file);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o077))throw Error('private_directory');
}
export function phoneFromCredentials(creds){
 const id=creds?.me?.id;
 if(typeof id!=='string'||!/^\d{6,15}(?::\d+)?@s\.whatsapp\.net$/.test(id))throw Error('account_identity_unverified');
 return '+'+id.split('@')[0].split(':')[0];
}

/** A factored SDK contract permits event/fault fixtures without a provider. */
export async function pairOnly({sdk,authDir,expectedPhone,qr,timeoutMs=180000}){
 const {state,saveCreds}=await sdk.useMultiFileAuthState(authDir);
 if(state.creds.me)throw Error('fresh_pairing_required');
 const logger={level:'silent',trace(){},debug(){},info(){},warn(){},error(){},child(){return this}};
 let socket,save=Promise.resolve(),restarts=0,settled=false,timer;
 const connected=new Promise((resolve,reject)=>{
  const fail=(error)=>{if(!settled){settled=true;reject(error)}};
  const open=()=>{
   socket=sdk.default({auth:{creds:state.creds,keys:sdk.makeCacheableSignalKeyStore(state.keys,logger)},logger,
    printQRInTerminal:false,browser:['NetClaw','Installer','155'],syncFullHistory:false,
    shouldSyncHistoryMessage:()=>false,shouldIgnoreJid:()=>true,markOnlineOnConnect:false,fireInitQueries:false,
    emitOwnEvents:false,getMessage:async()=>undefined,connectTimeoutMs:30000,defaultQueryTimeoutMs:30000});
   // No operational surface exists in this process. Even a future local caller
   // cannot send a message, presence update, receipt or group operation.
   for(const key of ['sendMessage','sendPresenceUpdate','readMessages','sendReceipt','sendReceipts','groupCreate','groupParticipantsUpdate'])
    if(typeof socket[key]==='function')socket[key]=()=>{throw Error('pairing_operation_refused')};
   const current=socket;
   socket.ev.on('creds.update',()=>{if(current===socket){save=save.then(()=>saveCreds());save.catch(fail)}});
   socket.ev.on('connection.update',update=>{
    if(current!==socket)return;
    if(update.qr){try{Promise.resolve(qr(update.qr)).catch(fail)}catch(error){fail(error)}}
    if(update.connection==='open'){
     try{if(phoneFromCredentials(state.creds)!==expectedPhone)throw Error('account_identity_mismatch');
      if(!settled){settled=true;resolve();}}catch(error){fail(error)}
    }
    if(update.connection==='close'&&!settled){
     const code=update.lastDisconnect?.error?.output?.statusCode;
     // Baileys' documented pair-success restart stays within this one fresh
     // attempt. Other closures never trigger a new pairing automatically.
     if(code===515&&restarts++===0&&state.creds.me){
      save.then(open,fail);
     }else fail(Error('pairing_connection_unsettled'));
    }
   });
  };
  timer=setTimeout(()=>fail(Error('pairing_timeout')),timeoutMs);
  try{open()}catch(error){fail(error)}
 });
 try{await connected;await save;await saveCreds();}
 finally{clearTimeout(timer);socket?.end(undefined);await save;}
 return {connected:true,phone:phoneFromCredentials(state.creds)};
}

async function main(){
 process.umask(0o077);
 const home=process.env.OPENCLAW_STATE_DIR;
 if(!home||!path.isAbsolute(home)||fs.realpathSync(home)!==home||process.argv.length!==3||!process.stdin.isTTY||!process.stdout.isTTY)throw Error('private_terminal_required');
 privateDirectory(home);
 const attempt=path.join(home,'.setup/comms/whatsapp/pairing');privateDirectory(attempt);
 if(process.argv[2]!==path.join(attempt,'request.json'))throw Error('request_scope');
 const request=read(process.argv[2]),owner=read(path.join(home,'.netclaw-setup-owner.json'));
 if(Object.keys(request).sort().join(',')!=='expectedPhone,helperSha256,owner,runId,schema'||request.schema!==1||
  request.owner!==owner.installationId||request.runId!==owner.runId||!/^\+[1-9]\d{5,14}$/.test(request.expectedPhone)||
  request.helperSha256!==hash(fs.readFileSync(new URL(import.meta.url))))throw Error('request_binding');
 if(fs.existsSync(path.join(attempt,'started.json'))||fs.existsSync(path.join(attempt,'auth')))throw Error('attempt_observation_required');
 const acquired=read(path.join(home,'.setup/comms/whatsapp/acquire-result.json'));
 if(acquired.package!=='@openclaw/whatsapp'||acquired.version!=='2026.7.1'||acquired.integrity!=='sha512-wLY/Omc5fleRpl2lKGN8sxt/8hYfHGwLRezmWsk8oCbea5pRKUPE6ZX+wJO1O52NOJkAGCuiXvS7x0qIeKxXbQ==')throw Error('dependency_identity');
 const root=acquired.installPath;
 if(typeof root!=='string'||!root.startsWith(path.join(home,'.setup/comms/whatsapp/npm')+path.sep)||fs.realpathSync(root)!==root)throw Error('dependency_scope');
 const require=createRequire(path.join(root,'package.json')),entry=require.resolve('baileys');
 if(!fs.realpathSync(entry).startsWith(path.join(home,'.setup/comms/whatsapp/npm')+path.sep))throw Error('dependency_scope');
 const sdkPackage=path.resolve(path.dirname(entry),'../package.json');
 if(read(sdkPackage).version!=='7.0.0-rc13')throw Error('sdk_identity');
 const sdk=await import(pathToFileURL(entry).href);
 const core=path.join(home,'.setup/prefix/lib/node_modules/openclaw');
 const coreRequire=createRequire(path.join(core,'package.json'));const qr=coreRequire('qrcode');
 const authDir=path.join(attempt,'auth');
 output(path.join(attempt,'started.json'),{schema:1,runId:request.runId,owner:request.owner,requestHash:hash(fs.readFileSync(process.argv[2]))});
 fs.mkdirSync(authDir,{mode:0o700});
 process.stdout.write('Link only the reviewed WhatsApp account '+request.expectedPhone+'. No conversation gateway starts here.\n');
 let qrQueue=Promise.resolve();
 const result=await pairOnly({sdk,authDir,expectedPhone:request.expectedPhone,qr:text=>{
  if(typeof text!=='string'||text.length>8192)throw Error('qr_invalid');
  qrQueue=qrQueue.then(()=>qr.toString(text,{type:'terminal',small:true})).then(rendered=>process.stdout.write(rendered+'\n'));return qrQueue;
 }});
 await qrQueue;
 const files=[];
 for(const name of fs.readdirSync(authDir).sort()){
  if(!/^[A-Za-z0-9_.@+-]+\.json$/.test(name)||name.length>255)throw Error('auth_file_invalid');
  const file=path.join(authDir,name);read(file);
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  files.push({path:name,sha256:hash(fs.readFileSync(file))});
 }
 if(!files.some(f=>f.path==='creds.json')||files.length>10000||phoneFromCredentials(read(path.join(authDir,'creds.json')))!==result.phone)throw Error('auth_unsettled');
 output(path.join(attempt,'result.json'),{schema:1,owner:request.owner,runId:request.runId,
  requestHash:hash(fs.readFileSync(process.argv[2])),connected:true,closed:true,phone:result.phone,files,observedAt:Math.floor(Date.now()/1000)});
 process.stdout.write('Account link saved privately. Messaging service remains stopped.\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(()=>{console.error('WhatsApp pairing did not settle. Preserve this attempt for reconciliation; do not link again automatically.');process.exitCode=8;});
