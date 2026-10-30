/** Built as a stable entry in the exact upstream graph, never a hashed import. */
import fs from 'node:fs';
import path from 'node:path';
import {loadOpenClawPlugins} from './plugins/loader.js';
import {resolveChannelSetupWizardAdapterForPlugin} from './commands/channel-setup/registry.js';
import {createClackPrompter} from './wizard/clack-prompter.js';
import {selectedDelta,selectedPlugin} from './netclaw-comms-contract.mjs';

const CHANNELS=new Set(['clickclack','discord','feishu','googlechat','imessage','irc','line','matrix','mattermost',
  'msteams','nextcloud-talk','nostr','qqbot','raft','signal','slack','sms','synology-chat','telegram','tlon',
  'twitch','whatsapp','zalo','zalouser']);

async function main(){
  process.umask(0o077);
  const home=process.env.OPENCLAW_STATE_DIR;
  if(!home||!path.isAbsolute(home)||fs.realpathSync(home)!==home||process.argv.length!==3)throw Error('scope');
  const requestPath=path.join(home,'native-request.json');
  if(process.argv[2]!==requestPath)throw Error('scope');
  const fd=fs.openSync(requestPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  let request:any;
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size>4*1024*1024||(stat.mode&0o077)!==0||stat.uid!==process.getuid!())throw Error('private_input');
    request=JSON.parse(fs.readFileSync(fd,'utf8'));
  }finally{fs.closeSync(fd);}
  if(Object.keys(request).sort().join(',')!=='channel,config,mode,pluginId,schema'||request.schema!==1||
    !CHANNELS.has(request.channel)||request.pluginId!==request.channel||!['inspect','configure'].includes(request.mode))throw Error('contract');
  const runtime={log:(...args:any[])=>console.error(...args),error:(...args:any[])=>console.error(...args),exit:()=>{throw Error('cancelled');}};
  const registry=loadOpenClawPlugins({config:request.config,activationSourceConfig:request.config,
    workspaceDir:path.join(home,'workspace'),onlyPluginIds:[request.pluginId],activate:false,cache:false,
    includeSetupOnlyChannelPlugins:true,forceSetupOnlyChannelPlugins:true,
    requireSetupEntryForSetupOnlyChannelPlugins:true,throwOnLoadError:true,
    logger:{info:()=>{},warn:()=>{},error:()=>{},debug:()=>{}}});
  const plugin=selectedPlugin(registry,request.channel,request.pluginId);
  const adapter=resolveChannelSetupWizardAdapterForPlugin(plugin);
  if(!adapter||adapter.channel!==request.channel)throw Error('adapter_missing');
  let result:any={schema:1,channel:request.channel,adapter:true,configured:false};
  if(request.mode==='configure'){
    if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('private_terminal_required');
    const base=createClackPrompter();
    // Mask every text answer: upstream versions do not consistently mark
    // app passwords and auxiliary credentials as sensitive.
    const prompter={...base,text:(params:any)=>base.text({...params,sensitive:true,initialValue:undefined})};
    const configured=await adapter.configure({cfg:structuredClone(request.config),runtime,prompter,
      accountOverrides:{[request.channel]:'default'},shouldPromptAccountIds:false,forceAllowFrom:true});
    if(configured.accountId&&configured.accountId!=='default')throw Error('account_scope');
    const selected=selectedDelta(request.config,configured.cfg,request.channel);
    // Deferred hooks (pairing/crypto/provisioning) are separate adapter effects.
    result={...result,configured:true,selected,afterWriteRequired:!!adapter.afterConfigWritten};
  }
  const output=fs.openSync(path.join(home,'native-result.json'),fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try{fs.writeFileSync(output,JSON.stringify(result));fs.fsyncSync(output);}finally{fs.closeSync(output);}
}
main().catch(()=>{console.error('Selected Comms setup did not settle; inspect the private attempt before retrying.');process.exitCode=8;});
