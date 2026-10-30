/** Qualification only: import exact source schemas, never an adapter or gateway. */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const [source,input]=process.argv.slice(2);
if(!path.isAbsolute(source)||execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!=='0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c')throw Error('pin');
net.Socket.prototype.connect=function(){throw Error('network refused during schema inspection')};
net.Server.prototype.listen=function(){throw Error('listener refused during schema inspection')};
globalThis.fetch=async()=>{throw Error('fetch refused during schema inspection')};
const require=createRequire(path.join(source,'package.json'));
const {createJiti}=require('jiti');
const aliases={'openclaw/plugin-sdk':path.join(source,'src/plugin-sdk')};
for(const directory of fs.readdirSync(path.join(source,'packages'))){
 const file=path.join(source,'packages',directory,'package.json');if(!fs.existsSync(file))continue;
 const pkg=JSON.parse(fs.readFileSync(file,'utf8'));if(pkg.name&&fs.existsSync(path.join(source,'packages',directory,'src')))
  aliases[pkg.name]=path.join(source,'packages',directory,'src');
}
const jiti=createJiti(path.join(source,'package.json'),{fsCache:false,moduleCache:false,alias:aliases});
const schemas={clickclack:['extensions/clickclack/src/config-schema.ts','clickClackConfigSchema'],
 feishu:['extensions/feishu/src/config-schema.ts','FeishuConfigSchema'],
 googlechat:['src/config/zod-schema.providers-googlechat.ts','GoogleChatConfigSchema'],
 irc:['extensions/irc/src/config-schema.ts','IrcConfigSchema'],line:['extensions/line/src/config-schema.ts','LineConfigSchema'],
 imessage:['src/config/zod-schema.providers-core.ts','IMessageConfigSchema'],
 matrix:['extensions/matrix/src/config-schema.ts','MatrixConfigSchema'],mattermost:['extensions/mattermost/src/config-schema-core.ts','MattermostConfigSchema'],
 msteams:['src/config/zod-schema.providers-core.ts','MSTeamsConfigSchema'],
 'nextcloud-talk':['extensions/nextcloud-talk/src/config-schema.ts','NextcloudTalkConfigSchema'],nostr:['extensions/nostr/src/config-schema.ts','NostrConfigSchema'],
 qqbot:['extensions/qqbot/src/config-schema.ts','QQBotConfigSchema'],sms:['extensions/sms/src/config-schema.ts','SmsConfigSchema'],
 raft:['extensions/raft/src/config-schema.ts','RaftConfigSchema'],signal:['src/config/zod-schema.providers-core.ts','SignalConfigSchema'],
 'synology-chat':['extensions/synology-chat/src/config-schema.ts','SynologyChatChannelConfigSchema'],
 tlon:['extensions/tlon/src/config-schema.ts','TlonConfigSchema'],twitch:['extensions/twitch/src/config-schema.ts','TwitchConfigSchema'],
 zalo:['extensions/zalo/src/config-schema.ts','ZaloConfigSchema']};
const values=JSON.parse(fs.readFileSync(input,'utf8')),verified=[];
for(const [channel,value] of Object.entries(values)){
 const [file,name]=schemas[channel]??[];if(!file)throw Error('unqualified_schema');
 const module=await jiti.import(path.join(source,file));const exported=module[name];
 const schema=exported?.runtime??exported;
 if(!schema?.safeParse)throw Error('schema unavailable '+channel+' '+name);
 const result=schema.safeParse(value);if(!result.success)throw Error(channel+' '+JSON.stringify((result.error?.issues??result.issues).map(i=>({path:i.path,code:i.code,message:i.message}))));
 verified.push(channel);
}
process.stdout.write(JSON.stringify({verified})+'\n');
