/** Owner-bound QR onboarding only. Never loads a channel or starts a listener. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire,registerHooks} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {APPROVED_PACKAGES} from './contract.mjs';
const hash=data=>createHash('sha256').update(data).digest('hex');
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_.@-]{1,160}$/.test(value)&&!value.includes('..');
function accountId(value){const id=value.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'');
 if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)||['constructor','prototype','__proto__'].includes(id))throw Error('account_identifier_invalid');return id;}
function read(file){
 if(fs.realpathSync(file)!==file)throw Error('alias');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const s=fs.fstatSync(fd);if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)||s.size>4*1024*1024)throw Error('private_input');
  return JSON.parse(fs.readFileSync(fd,'utf8'));}finally{fs.closeSync(fd)}
}
function output(file,value){const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}

export async function loadZaloSdk(root,home){
 const require=createRequire(path.join(root,'package.json'));
 const entry=require.resolve('zca-js'),owned=path.join(home,'.setup/comms/zalouser/npm')+path.sep;
 if(!fs.realpathSync(entry).startsWith(owned))throw Error('sdk_identity');
 let sdkRoot=path.dirname(entry),pkg;
 for(let i=0;i<6&&sdkRoot.startsWith(owned);i++,sdkRoot=path.dirname(sdkRoot)){
  const file=path.join(sdkRoot,'package.json');
  if(fs.existsSync(file)){const candidate=read(file);if(candidate.name==='zca-js'){pkg=candidate;break}}
 }
 if(pkg?.version!=='2.1.2')throw Error('sdk_identity');
 const project=path.resolve(root,'../../..'),lock=read(path.join(project,'package-lock.json'));
 if(lock.packages?.[path.relative(project,sdkRoot).split(path.sep).join('/')]?.integrity!=='sha512-82+zCqoIXnXEF6C9YuN3Kf7WKlyyujY/6Ejl2n8PkwazYkBK0k7kiPd8S7nHvC5Wl7vjwGRhDYeAM8zTHyoRxQ==')throw Error('sdk_integrity');
 return import(pathToFileURL(entry));
}

export async function pairZaloPersonal({sdk,expectedOwner,qr,timeoutMs=180000}){
 let api,abort,timer,failed=false,qrWork=Promise.resolve();
 const wait=new Promise((_,reject)=>{timer=setTimeout(()=>{abort?.();reject(Error('pairing_timeout'))},timeoutMs)});
 try{
  const zalo=new sdk.Zalo({logging:false,selfListen:false,checkUpdate:false});
  api=await Promise.race([zalo.loginQR(undefined,event=>{
   abort=()=>event.actions?.abort?.();
   if(event.type===0){qrWork=qrWork.then(()=>qr(event.data.code));qrWork.catch(()=>abort?.())}
   if(event.type===1||event.type===3){failed=true;abort()} // Never silently refresh or retry QR.
  }),wait]);
  await qrWork;
  if(failed||String(api.getOwnId())!==expectedOwner)throw Error('account_identity_mismatch');
  const ctx=api.getContext(),cookie=api.getCookie().toJSON()?.cookies;
  if(!ctx.imei||!ctx.userAgent||!Array.isArray(cookie)||!cookie.length)throw Error('credentials_incomplete');
  return {ownerId:expectedOwner,accountId:'default',credential:{imei:ctx.imei,userAgent:ctx.userAgent,cookie,
   ...(ctx.language?{language:ctx.language}:{}),createdAt:new Date().toISOString()}};
 }finally{clearTimeout(timer);abort?.();api?.listener?.stop?.()}
}

export async function pairClawBot({api,expectedOwner,qr,fetcher,timeoutMs=180000}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 const bounded=(url,options={})=>fetcher(url,{...options,signal:controller.signal});
 try{
  const start=await api.requestLogin({fetch:bounded});
  if(!start.loginUrl||!start.zbsk)throw Error('pairing_not_started');
  await qr(start.loginUrl);
  const result=await api.waitForLogin({zbsk:start.zbsk,fetch:bounded,abortSignal:controller.signal,timeoutMs});
  if(!result.connected||result.ownerId!==expectedOwner||!identifier(result.botId)||typeof result.botToken!=='string'||!result.botToken)throw Error('account_identity_mismatch');
  return {ownerId:expectedOwner,accountId:accountId('clawbot-'+result.botId),
   credential:{botId:result.botId,botToken:result.botToken,ownerId:result.ownerId,...(result.oaId?{oaId:result.oaId}:{}),savedAt:new Date().toISOString()}};
 }finally{clearTimeout(timer);controller.abort()}
}

export async function pairWeChat({api,expectedOwner,qr,timeoutMs=180000}){
 const start=await api.startWeixinLoginWithQr({apiBaseUrl:'https://ilinkai.weixin.qq.com',force:false});
 if(!start.qrcodeUrl||!start.sessionKey)throw Error('pairing_not_started');
 await qr(start.qrcodeUrl);
 const result=await api.waitForWeixinLogin({apiBaseUrl:'https://ilinkai.weixin.qq.com',sessionKey:start.sessionKey,timeoutMs,verbose:false});
 if(!result.connected||result.alreadyConnected||result.userId!==expectedOwner||!identifier(result.accountId)||!result.botToken)throw Error('account_identity_mismatch');
 const base=new URL(result.baseUrl||'https://ilinkai.weixin.qq.com');
 if(base.protocol!=='https:'||!base.hostname.endsWith('.weixin.qq.com')||base.username||base.password||base.port)throw Error('provider_endpoint_mismatch');
 return {ownerId:expectedOwner,accountId:accountId(result.accountId),
  credential:{token:result.botToken,userId:result.userId,baseUrl:base.origin,savedAt:new Date().toISOString()}};
}

async function main(){
 process.umask(0o077);
 const home=process.env.OPENCLAW_STATE_DIR;
 if(!home||!path.isAbsolute(home)||fs.realpathSync(home)!==home||process.argv.length!==3||!process.stdin.isTTY||!process.stdout.isTTY)throw Error('private_terminal_required');
 const request=read(process.argv[2]),owner=read(path.join(home,'.netclaw-setup-owner.json'));
 if(Object.keys(request).sort().join(',')!=='channel,expectedOwner,helperSha256,owner,runId,schema'||request.schema!==1||
  !['wechat','zalouser','zaloclawbot'].includes(request.channel)||!identifier(request.expectedOwner)||
  request.owner!==owner.installationId||request.runId!==owner.runId||request.helperSha256!==hash(fs.readFileSync(new URL(import.meta.url))))throw Error('request_binding');
 const stage=path.join(home,'.setup/comms',request.channel,'pairing');
 if(process.argv[2]!==path.join(stage,'request.json')||fs.existsSync(path.join(stage,'started.json')))throw Error('attempt_observation_required');
 const native=request.channel==='wechat'?'openclaw-weixin':request.channel==='zaloclawbot'?'openclaw-zaloclawbot':'credentials/zalouser';
 if(fs.existsSync(path.join(home,native)))throw Error('existing_account_refused');
 const acquired=read(path.join(home,'.setup/comms',request.channel,'acquire-result.json')),pin=APPROVED_PACKAGES[request.channel];
 if(acquired.package!==pin.package||acquired.version!==pin.version||acquired.integrity!==pin.integrity||
  !acquired.installPath.startsWith(path.join(home,'.setup/comms',request.channel,'npm')+path.sep)||fs.realpathSync(acquired.installPath)!==acquired.installPath)throw Error('dependency_binding');
 const root=acquired.installPath,core=path.join(home,'.setup/prefix/lib/node_modules/openclaw');
 const coreRequire=createRequire(path.join(core,'package.json')),qrCode=coreRequire('qrcode');
 // Exact host SDK aliases for the external package that has no declared peer.
 const hostExports=JSON.parse(fs.readFileSync(path.join(core,'package.json'))).exports;
 registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('openclaw/plugin-sdk/')){
   const target=hostExports[specifier.replace('openclaw/','./')]?.default;
   if(typeof target!=='string'||!target.startsWith('./dist/plugin-sdk/'))throw Error('host_sdk_missing');
   return {url:pathToFileURL(path.join(core,target)).href,shortCircuit:true};
  }
  return next(specifier,context);
 }});
 const qr=async text=>{if(typeof text!=='string'||text.length>8192)throw Error('qr_invalid');process.stdout.write(await qrCode.toString(text,{type:'terminal',small:true})+'\n')};
 output(path.join(stage,'started.json'),{schema:1,owner:request.owner,runId:request.runId,requestHash:hash(fs.readFileSync(process.argv[2]))});
 process.stdout.write('Link only the reviewed '+request.channel+' owner '+request.expectedOwner+'. No conversation gateway starts here.\n');
 // A blocked prompt or an unresponsive SDK cannot keep this attempt alive.
 const deadline=setTimeout(()=>process.exit(8),185000);let result;
 try{
  if(request.channel==='zalouser'){
   const sdk=await loadZaloSdk(root,home);
   result=await pairZaloPersonal({sdk,expectedOwner:request.expectedOwner,qr});
  }else{
   const logger=await import(pathToFileURL(path.join(root,'dist/src/util/logger.js')));
   logger.setLogLevel('FATAL'); // Native diagnostics must not persist QR/session data.
   const api=await import(pathToFileURL(path.join(root,'dist/src/auth/login-qr.js')));
   const originalFetch=globalThis.fetch;
   const onlyLogin=async(url,options={})=>{
    const u=new URL(url);const wechat=request.channel==='wechat';
    if(u.protocol!=='https:'||u.username||u.password||u.port||
      (wechat?!(u.hostname==='ilinkai.weixin.qq.com'||u.hostname.endsWith('.weixin.qq.com')):u.hostname!=='bot.zaloplatforms.com')||
      !(wechat?['/ilink/bot/get_bot_qrcode','/ilink/bot/get_qrcode_status']:['/agent/request-login','/agent/get-login-status']).includes(u.pathname))throw Error('pairing_endpoint_refused');
    return originalFetch(url,{...options,redirect:'error',signal:options.signal??AbortSignal.timeout(35000)});
   };
   if(request.channel==='wechat'){
    globalThis.fetch=onlyLogin;
    try{result=await pairWeChat({api,expectedOwner:request.expectedOwner,qr})}finally{globalThis.fetch=originalFetch}
   }else result=await pairClawBot({api,expectedOwner:request.expectedOwner,qr,fetcher:onlyLogin});
  }
  if(!identifier(result.accountId))throw Error('account_identifier_invalid');
  output(path.join(stage,'result.json'),{schema:1,owner:request.owner,runId:request.runId,channel:request.channel,
   requestHash:hash(fs.readFileSync(process.argv[2])),connected:true,closed:true,...result});
 }finally{clearTimeout(deadline)}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))main().catch(()=>{console.error('Personal channel pairing did not settle; inspect the owned attempt before retrying.');process.exitCode=8});
