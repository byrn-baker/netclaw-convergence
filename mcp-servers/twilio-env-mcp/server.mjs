#!/usr/bin/env node
/** No credential argv, broad CLI parsing, downloads or provider calls at startup. */
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

async function main(){
  if(process.argv.length!==2)throw Error('arguments_refused');
  const accountSid=process.env.TWILIO_ACCOUNT_SID;
  const apiKey=process.env.TWILIO_API_KEY_SID;
  const apiSecret=process.env.TWILIO_API_SECRET;
  if(!/^AC[a-fA-F0-9]{32}$/.test(accountSid||'')||!/^SK[a-fA-F0-9]{32}$/.test(apiKey||'')||
      !apiSecret||apiSecret.length>4096||/[\r\n\0]/.test(apiSecret))throw Error('credentials_required');
  if(require('@twilio-alpha/mcp/package.json').version!=='0.7.0')throw Error('dependency_changed');
  // The package root is an auto-running CLI that parses credentials from argv.
  // Import only its pinned server class and keep the existing tool filters.
  const Server=require('@twilio-alpha/mcp/build/server.js').default;
  const {StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
  const server=new Server({server:{name:'twilio-server',version:'0.0.1'},
    filters:{services:['twilio_api_v2010'],tags:['Api20100401Call','Api20100401Message']},
    accountSid,credentials:{apiKey,apiSecret}});
  await server.start(new StdioServerTransport());
}
main().catch(()=>{console.error('Twilio MCP setup is incomplete; check its private credentials and pinned dependencies.');process.exitCode=8;});
