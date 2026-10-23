import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mcpCommand } from '../security/command.js';
const execute=promisify(execFile);
function unwrap(raw) {
  const envelope=JSON.parse(raw);
  if(envelope.isError) throw Error();
  let value=envelope.structuredContent?.result || envelope.structuredContent;
  if(!value) value=JSON.parse(envelope.content.find(c=>c.type==='text').text);
  return typeof value==='string'?JSON.parse(value):value;
}
export function palRuntime(root,home) {
  return {
    async query({question,sessionId}) {
      const directory=path.join(root,'mcp-servers','tavus-pal-mcp');
      const python=path.join(directory,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
      if(!fs.existsSync(python)) return {status:'unavailable'};
      try {
        const {stdout}=await execute('python3',[path.join(root,'scripts/mcp-call.py'),mcpCommand([python,'-u',path.join(directory,'server.py')]),'pal_query',JSON.stringify({question,session_id:sessionId})],
          {cwd:root,env:{...process.env,OPENCLAW_HOME:home,MCP_CALL_TIMEOUT:'50'},timeout:55000,maxBuffer:512*1024,windowsHide:true});
        return unwrap(stdout);
      } catch {return {status:'unavailable'};}
    },
    async audit({event,sessionId}) {
      if(!/^[a-z-]+$/.test(event) || !/^[a-z0-9-]+$/.test(sessionId)) return false;
      try {
        const {stdout}=await execute('python3',[path.join(root,'scripts/mcp-call.py'),mcpCommand(['python3','-u',path.join(root,'scripts/gait-stdio.py')]),'gait_record_turn',JSON.stringify({
          user_text:'Authenticated Pal lifecycle request',assistant_text:`Pal ${event}; session ${sessionId}. Private contents omitted.`,note:'pal-lifecycle',
        })],{cwd:root,timeout:7000,maxBuffer:128*1024,windowsHide:true});
        return unwrap(stdout).ok===true;
      }catch{return false;}
    },
  };
}
