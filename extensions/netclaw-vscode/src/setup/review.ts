import * as vscode from 'vscode';
import {canonical,hash} from './data';
export async function reviewPlan(plan:any,binding:any,explanation:any):Promise<boolean>{
  if(binding.operation==='verify-live')return reviewLive(plan,binding);
  if(hash(canonical(plan))!==binding.planHash||explanation.hash!==binding.planHash||hash(canonical(explanation.effects))!==binding.effectsHash)
    throw Error('Plan or disclosed effects changed. Validate and review again.');
  const document=await vscode.workspace.openTextDocument({language:'json',content:JSON.stringify({plan,effects:explanation.effects,
    downloads:explanation.downloadSizes,liveTiers:explanation.liveTiers,planHash:binding.planHash},null,2)});
  await vscode.window.showTextDocument(document,{preview:true,preserveFocus:false});
  const claws=plan.claws.map((claw:any)=>`${claw.displayName} · ${claw.harness} · ${claw.role}\nHome: ${claw.runtimeHome}\nProvider/model: ${claw.provider.id} / ${claw.provider.model}\nTestbed: ${claw.testbed?.mode||'static'} · ${(claw.testbed?.sources||[]).join(', ')||'reviewed file'} (configuration only)\nPorts: ${Object.values(claw.endpoints).join(', ')}\nService: ${claw.service.name} (${claw.service.mode})`).join('\n\n');
  const comms=explanation.effects.filter((effect:any)=>effect.phase==='comms'||effect.startupEffects?.length)
    .map((effect:any)=>`${effect.owner} · ${effect.channel||effect.component}: ${(effect.startupEffects||[]).join(', ')||'configuration only'}`).join('\n');
  const accepted=await vscode.window.showWarningMessage('Create these separate NetClaw installations?',{modal:true,
    detail:`${claws}${comms?'\n\nComms activation:\n'+comms+'\nReview sender/room access, callback endpoints and dependency sources in the opened plan. Empty allowlists grant no access.':''}\n\nSource: ${plan.source.path}\nCommit: ${plan.source.commit}${plan.source.dirty?' · reviewed local changes':''}\nPosture: ${plan.posture.mode}\n${explanation.effects.length} disclosed phases, including downloads, private dependency builds, credentials and owned services. Agents can execute powerful tools. Live provider/channel/device tests require additional consent. Existing installations are preserved.\n\nPlan SHA-256: ${binding.planHash}`},'Apply reviewed plan');
  return accepted==='Apply reviewed plan';
}
export async function reviewLive(plan:any,binding:any):Promise<boolean>{
  if(binding.operation!=='verify-live'||binding.planHash!==hash(canonical(plan))||![4,5,6].includes(binding.tier)||!plan.claws.some((c:any)=>c.id===binding.owner))throw Error('Live verification binding changed.');
  const detail=JSON.stringify(binding.details,null,2);
  if(detail.length>16000)throw Error('Verification review exceeds its limit.');
  return (await vscode.window.showWarningMessage('Run this optional verification?',{modal:true,detail:detail+(binding.previousOutcome==='unknown'?'\nAn earlier attempt has an unknown outcome. This creates a new attempt.':'')},'Run this check'))==='Run this check';
}
export async function channelDestination(binding:any):Promise<string|undefined>{
  const patterns:Record<string,RegExp>={slack:/^[CDG][A-Z0-9]{8,31}$/,telegram:/^-?[1-9][0-9]{0,19}$/,discord:/^[1-9][0-9]{15,20}$/,webex:/^[A-Za-z0-9_-]{16,256}={0,2}$/,sms:/^\+[1-9][0-9]{5,14}$/};
  const pattern=patterns[binding.channel];
  if(!pattern)throw Error('Unsupported channel destination.');
  return vscode.window.showInputBox({title:`${binding.channel} test destination · ${binding.destinationRef}`,
    prompt:'Enter the exact destination ID. You will review the complete message and destination before anything is sent. This ID stays out of the saved plan and report.',
    validateInput:value=>pattern.test(value)?undefined:'Enter a concrete destination ID; names, URLs and multiple destinations are not accepted.'});
}
