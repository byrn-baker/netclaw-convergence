import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import {readBytes,readData,hash,realParents} from './data';

export async function distributeSetupSkill(context:vscode.ExtensionContext,selectedClient?:string,project?:string){
  if(!vscode.workspace.isTrusted)throw Error('Trust this workspace first.');
  const client=selectedClient||await vscode.window.showQuickPick(['codex','claude-code','copilot'],{title:'Install the shared setup skill in a project'});if(!client)return;
  const folder=project?[vscode.Uri.file(project)]:await vscode.window.showOpenDialog({title:'Choose the deployment project',canSelectFolders:true,canSelectFiles:false,canSelectMany:false});if(!folder?.[0])return;
  const source=path.join(context.extensionPath,'dist/skills/netclaw-install/SKILL.md'),data=readBytes(source,65536),stamp=readData(path.join(context.extensionPath,'dist/skills/stamp.json'));
  if(hash(data)!==stamp.sha256)throw Error('Bundled skill stamp changed.');
  const destination=path.join(folder[0].fsPath,client==='codex'?'.agents':client==='claude-code'?'.claude':'.github','skills/netclaw-install/SKILL.md');realParents(destination);
  if(fs.existsSync(destination)){
    if(hash(readBytes(destination,65536))===stamp.sha256){await vscode.window.showInformationMessage('This project already has the matching setup skill.');return;}
    throw Error('A different netclaw-install skill exists here. Preserve or move it deliberately before installing this version.');
  }
  if((await vscode.window.showInformationMessage('Add the NetClaw setup skill to this project?',{modal:true,detail:`Client: ${client}\nDestination: ${destination}\nSource SHA-256: ${stamp.sha256}\nThis creates project instructions only. No installation runs.`},'Add skill'))!=='Add skill')return;
  realParents(destination);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});fs.writeFileSync(destination,data,{flag:'wx',mode:0o600});
}
