import { execFile } from 'node:child_process';
import { redactLogs } from './logs.js';
const boolean = v => v === undefined || v === '' ? null : /^(true|1|yes)$/i.test(v) ? true : /^(false|0|no)$/i.test(v) ? false : null;
export function securitySettings(env, defenseConfig, guardConfig) {
  const mode=String(env.N2N_RISK_MODE || 'testing').trim().toLowerCase();
  const securityMode=defenseConfig?.security?.mode, guardMode=guardConfig?.guardrail?.mode;
  return { labMode:env.NETCLAW_LAB_MODE===undefined?false:boolean(env.NETCLAW_LAB_MODE),labExplicit:env.NETCLAW_LAB_MODE!==undefined,
    riskMode:['testing','production'].includes(mode)?mode:'unknown',riskExplicit:env.N2N_RISK_MODE!==undefined,
    strictAll:env.N2N_STRICT_ALL===undefined?false:boolean(env.N2N_STRICT_ALL),
    defenseMode:['hobby','defenseclaw'].includes(securityMode)?securityMode:'unknown',
    guardMode:['action','observe','block','monitor'].includes(guardMode)?guardMode:'unknown',
    guardPort:/^\d{1,5}$/.test(String(env.DEFENSECLAW_GUARD_PORT||4000))?Number(env.DEFENSECLAW_GUARD_PORT||4000):null,
    source:'HUD process environment merged over local .env; DefenseClaw configuration files. Running daemon may differ.' };
}
export function openshellStatus(run=execFile) {
  return Promise.all([['gateway','status'],['sandbox','list']].map(args=>new Promise(resolve=>{
    run('openshell',args,{timeout:4000,maxBuffer:128*1024},(error,stdout)=>resolve({command:'openshell '+args.join(' '),available:!error,output:error?'Command unavailable, failed or timed out':redactLogs(String(stdout)).slice(0,16000)}));
  })));
}
