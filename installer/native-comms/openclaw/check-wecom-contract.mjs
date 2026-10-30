import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {pathToFileURL} from 'node:url';
const home=process.argv[2];net.Socket.prototype.connect=()=>{throw Error('network forbidden')};net.Server.prototype.listen=()=>{throw Error('listener forbidden')};globalThis.fetch=()=>{throw Error('fetch forbidden')};
const acquired=JSON.parse(fs.readFileSync(path.join(home,'.setup/comms/wecom/acquire-result.json')));const root=acquired.installPath;
const {default:plugin}=await import(pathToFileURL(path.join(root,'dist/index.js')));
if(plugin.id!=='wecom-openclaw-plugin')throw Error('plugin');
const {resolveWeComAccountMulti}=await import(pathToFileURL(path.join(root,'dist/src/accounts.js')));
const {setWeComRuntime}=await import(pathToFileURL(path.join(root,'dist/src/runtime.js')));
const {checkDmPolicy}=await import(pathToFileURL(path.join(root,'dist/src/dm-policy.js')));
const config=JSON.parse(fs.readFileSync(process.argv[3]));
const account=resolveWeComAccountMulti({cfg:config,accountId:'default'});
if(!account.enabled||account.botId!=='fixture-id'||account.secret!=='fixture-private-credential'||account.config.dynamicAgents.enabled!==false)throw Error('account');
setWeComRuntime({channel:{pairing:{readAllowFromStore:async()=>[]}}});
for(const senderId of ['123456','foreign']){
 const result=await checkDmPolicy({senderId,isGroup:false,account,runtime:{log(){}},frame:{},wsClient:{}});
 if(result.allowed!==(senderId==='123456'))throw Error('access');
}
console.log('WeCom exact packaged account and ordinary sender guard passed; network disabled');
