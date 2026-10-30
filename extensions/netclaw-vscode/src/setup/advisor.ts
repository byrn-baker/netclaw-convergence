import * as vscode from 'vscode';
import {SetupEngine} from './engine';
export async function showAdvisor(engine:SetupEngine,planFile:string){
  const answers:Record<string,string>={};
  const questions:[string,string,[string,string][]][]=[
    ['domains','Will the claw serve one tool/vendor domain or several?',[['single','One domain'],['several','Several domains'],['unknown','Not sure yet']]],
    ['credentials','Do these capabilities need separate credential trust domains?',[['shared','One reviewed trust domain'],['separate','Separate trust domains'],['unknown','Not sure yet']]],
    ['production','What enforcement will this installation need?',[['testing','Testing / lab'],['required','Verified production controls'],['unknown','Not sure yet']]],
    ['cost','How important is reducing model/tool context cost?',[['balanced','Balance simplicity and cost'],['sensitive','Prioritize smaller tool context'],['unknown','Not sure yet']]],
    ['growth','How do you expect the tool set to grow?',[['stable','Mostly stable'],['expanding','Several new domains expected'],['unknown','Not sure yet']]],
  ];
  for(const [key,title,options] of questions){
    const answer=await vscode.window.showQuickPick(options.map(([id,label])=>({id,label})),{title:'Shape Advisor · '+title,ignoreFocusOut:true});
    if(!answer)return;answers[key]=answer.id;
  }
  const report=await engine.advise(planFile,answers);
  const doc=await vscode.workspace.openTextDocument({language:'markdown',content:[
    '# Shape Advisor',`Suggested shape: **${report.recommendation}**. Feasibility: **${report.feasibility}**.`,
    'This advice does not change your plan.',...report.assumptions,
    `Reasons: ${report.reasons.join(', ')}.`,
    `Counts: ${report.counts.components} components, ${report.counts.registeredMcps} registered MCPs, ${report.counts.skills} skills, ${report.counts.documentedSchemas} documented tool schemas; ${report.counts.unknownSchemaComponents} component schema counts unknown.`,
    `Cloud-claw capacity estimate: ${report.estimatedCloudClaws??'unknown'}; proposed claws: ${report.estimatedRequiredClaws}. Local model memory is not estimated.`,
    `Focused estimate: ${report.shapeEstimates.focused.claws} claw, ${report.shapeEstimates.focused.registeredMcps} MCPs and ${report.shapeEstimates.focused.skills} skills. Risk estimate: ${report.shapeEstimates.risk.claws} claws including Border; ${report.shapeEstimates.risk.memberGroups} proposed member groups. Per-turn tool-context tokens remain unknown until discovery.`,
    ...report.partitions.map((p:any)=>`- ${p.profile}: ${p.components.join(', ')} (${p.harnesses.join(' / ')}; credential domain ${p.trustDomain})`),
    ...(report.unpartitionedDomains||[]).map((p:any)=>`- Unpartitioned in credential domain ${p.trustDomain}: ${p.components.join(', ')}. A separate member still needs review.`),
    ...report.limitations].join('\n\n')});
  await vscode.window.showTextDocument(doc,{preview:true});
}
