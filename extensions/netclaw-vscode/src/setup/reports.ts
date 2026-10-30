import * as vscode from 'vscode';
import {SetupEngine} from './engine';
import {RunReference} from './runs';
import {commsReportSummary} from './comms';

export async function showReport(engine:SetupEngine,reference:RunReference){
  const report=await engine.read('report',undefined,reference.runId);
  const doc=await vscode.workspace.openTextDocument({language:'json',content:JSON.stringify(report,null,2)});
  await vscode.window.showTextDocument(doc,{preview:true});
  const summary=commsReportSummary(report);if(summary)await vscode.window.showInformationMessage(summary);
  return report;
}

export async function exportReport(engine:SetupEngine,reference:RunReference,detailed=false){
  const destination=await vscode.window.showSaveDialog({title:detailed?'Export detailed local Claw Report':'Export redacted Claw Report',filters:{'Claw Report':['json']}});
  if(!destination)return;
  await engine.execute(reference.planFile,{event:()=>{},secret:async()=>undefined,review:async binding=>{
    if(binding.operation!=='export'||binding.runId!==reference.runId||binding.destination!==destination.fsPath||binding.detailed!==true||binding.planHash!==reference.planHash)throw Error('Export review changed.');
    return await vscode.window.showWarningMessage('Include private installation identifiers in this local report?',{modal:true,
      detail:`This export includes installation IDs, runtime/source paths and local endpoints. Secrets, enrollment tokens and raw logs are excluded. Nothing is sent.\n\nDestination: ${destination.fsPath}`},'Export detailed local report')==='Export detailed local report';
  }},reference.runId,{operation:'export',destination:destination.fsPath,detailed});
  await vscode.window.showInformationMessage('Claw Report saved locally.');
}
