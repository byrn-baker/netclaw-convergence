import * as vscode from 'vscode';
import {SetupEngine} from './engine';

const size=(bytes:unknown)=>typeof bytes==='number'?`${(bytes/1024**3).toFixed(1)} GiB`:'unknown';
export async function selectLocalModel(engine:SetupEngine,provider:'ollama'|'lm-studio',endpoint:string,home:string):Promise<string|undefined>{
  const report=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Read installed local models'},()=>engine.discover(provider,endpoint,home));
  const hardware=report.hardware||{};
  const choices:(vscode.QuickPickItem&{model:string})[]=(report.models||[]).map((model:any)=>({label:model.id,description:`Installed ${size(model.installedBytes)} · ${model.quantization||'quantization unknown'}`,
    detail:`Context ${model.contextLength||'unknown'} · tool use ${model.toolUse===true?'declared':'unverified'} · inference unverified`,model:model.id}));
  choices.push({label:'Enter a model identifier',description:report.state==='authentication_required'?'Server authentication required; listing unavailable':'Use an existing model not listed here',detail:'No model will be loaded or downloaded.',model:''});
  choices.push({label:'Model download guidance',description:'Download size is unavailable',detail:'Review size and hardware needs in the model manager, approve there, then refresh.',model:'__guidance'});
  const selected=await vscode.window.showQuickPick(choices,{title:'Local models',placeHolder:`Memory ${size(hardware.memoryBytes)} · disk free ${size(hardware.diskFreeBytes)}. File size is not RAM required.`});
  if(selected?.model==='__guidance'){
    await vscode.window.showInformationMessage(report.download.guidance,{modal:true,detail:hardware.note});return undefined;
  }
  return selected?.model;
}
