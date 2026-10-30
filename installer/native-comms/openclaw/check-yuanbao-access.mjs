/** Regression evidence for the pinned external package; never connects. */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
const [root,core]=process.argv.slice(2);
if(!path.isAbsolute(root)||!path.isAbsolute(core))throw Error('absolute fixture roots required');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
if(pkg.name!=='openclaw-plugin-yuanbao'||pkg.version!=='2.15.0')throw Error('package changed');
const hashes={
 'dist/src/business/pipeline/middlewares/guard-command.js':'aff013ee1d96b5a977bb1cf4d0a4e57501987d8d77585fc03c73f3b6e0ae5466',
 'dist/src/business/pipeline/middlewares/guard-send-access.js':'7011e91872ca28e7a7ee42f7c59e1e31ce48877e70726107e7e025e477e5a05e',
 'dist/src/business/pipeline/create.js':'078eed9db548c38378e651c012b479c543e13538e51da4c15546d7b2d8bb5556',
 'dist/src/access/ws/gateway.js':'9901a746f25991ebdc8d9307eb4881f1c5399789b363279d0807e037c905e74e'};
for(const [file,hash] of Object.entries(hashes))if(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==hash)throw Error('source changed');
registerHooks({resolve(specifier,context,next){
 if(specifier==='openclaw/plugin-sdk/command-auth')return {url:pathToFileURL(path.join(core,'dist/plugin-sdk/command-auth.js')).href,shortCircuit:true};
 return next(specifier,context);
}});
net.Socket.prototype.connect=()=>{throw Error('network forbidden')};
net.Server.prototype.listen=()=>{throw Error('listener forbidden')};
globalThis.fetch=()=>{throw Error('fetch forbidden')};
const directory=path.join(root,'dist/src/business/pipeline/middlewares');
const {guardCommand}=await import(pathToFileURL(path.join(directory,'guard-command.js')));
const {guardSendAccess}=await import(pathToFileURL(path.join(directory,'guard-send-access.js')));
const results=[];
for(const policy of ['disabled','allowlist']){
 let passed=false;
 const ctx={isGroup:false,rawBody:'ordinary fixture message',fromAccount:'unlisted-sender',
  account:{botId:'fixture-bot',accountId:'fixture-account',config:{dm:{policy,allowFrom:['different-sender']}}},
  config:{commands:{useAccessGroups:true}},log:{info(){},error(){}},
  core:{channel:{commands:{shouldHandleTextCommands(){return true}},text:{hasControlCommand(){return false}}}}};
 await guardCommand.handler(ctx,()=>guardSendAccess.handler(ctx,async()=>{passed=true}));
 if(!passed)throw Error('baseline access behavior changed; review restriction');
 results.push({policy,unlistedOrdinarySenderPassed:passed});
}
process.stdout.write(JSON.stringify({package:pkg.name,version:pkg.version,results,providerConnections:0})+'\n');
