/** Exact packaged login modules with fake HTTP responses and no real sockets. */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createRequire,registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {pairWeChat,pairClawBot,loadZaloSdk} from './personal-pair.mjs';
const [home]=process.argv.slice(2);
if(!path.isAbsolute(home)||process.env.OPENCLAW_STATE_DIR!==home)throw Error('isolated home required');
net.Socket.prototype.connect=()=>{throw Error('network forbidden')};
net.Server.prototype.listen=()=>{throw Error('listener forbidden')};
const core=path.join(home,'.setup/prefix/lib/node_modules/openclaw'),coreRequire=createRequire(path.join(core,'package.json'));
const hostExports=JSON.parse(fs.readFileSync(path.join(core,'package.json'))).exports;
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('openclaw/plugin-sdk/')){
  const target=hostExports[specifier.replace('openclaw/','./')]?.default;
  if(typeof target!=='string'||!target.startsWith('./dist/plugin-sdk/'))throw Error('host_sdk_missing');
  return {url:pathToFileURL(path.join(core,target)).href,shortCircuit:true};
 }
 return next(specifier,context);
}});
const results=[];
for(const channel of ['wechat','zaloclawbot']){
 const acquired=JSON.parse(fs.readFileSync(path.join(home,'.setup/comms',channel,'acquire-result.json'))),root=acquired.installPath;
 const logger=await import(pathToFileURL(path.join(root,'dist/src/util/logger.js')));logger.setLogLevel('FATAL');
 const api=await import(pathToFileURL(path.join(root,'dist/src/auth/login-qr.js')));let fetches=0,qrs=0;
 const fetcher=async(input,options)=>{
  const url=new URL(input);fetches++;
  if(channel==='wechat'){
   if(url.pathname==='/ilink/bot/get_bot_qrcode')return new Response(JSON.stringify({qrcode:'fake-session',qrcode_img_content:'https://example.invalid/fake-qr'}));
   if(url.pathname==='/ilink/bot/get_qrcode_status')return new Response(JSON.stringify({status:'confirmed',ilink_bot_id:'fixture@im.bot',ilink_user_id:'123456',bot_token:'fixture-token',baseurl:'https://ilinkai.weixin.qq.com'}));
  }else{
   if(url.pathname==='/agent/request-login')return new Response(JSON.stringify({loginUrl:'https://example.invalid/fake-qr',zbsk:'fake-session'}));
   if(url.pathname==='/agent/get-login-status')return new Response(JSON.stringify({isLogin:true,botToken:'fixture-token',botId:'789',ownerId:'123456'}));
  }
  throw Error('unexpected native endpoint');
 };
 globalThis.fetch=fetcher;
 const options={api,expectedOwner:'123456',qr:async()=>{qrs++},fetcher,timeoutMs:1000};
 const result=await (channel==='wechat'?pairWeChat(options):pairClawBot(options));
 if(result.ownerId!=='123456'||fetches!==2||qrs!==1)throw Error('native login contract');
 results.push({channel,sourceVersion:acquired.version,syntheticLogin:true,providerConnections:0});
}
globalThis.fetch=()=>{throw Error('fetch forbidden')};
const acquired=JSON.parse(fs.readFileSync(path.join(home,'.setup/comms/zalouser/acquire-result.json')));
const sdk=await loadZaloSdk(acquired.installPath,home);
const instance=new sdk.Zalo({logging:false,selfListen:false,checkUpdate:false});
if(typeof instance.loginQR!=='function')throw Error('native SDK missing');
results.push({channel:'zalouser',sourceVersion:acquired.version,passiveSdkConstruction:true,providerConnections:0});
process.stdout.write(JSON.stringify({results})+'\n');
