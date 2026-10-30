import * as vscode from 'vscode';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {windowsGate} from './host';
import {createHandoff,handoffCommand,remoteFolder} from './handoff';
import {canonical} from './data';

export async function openWindowsGate(answers:Record<string,unknown>={},extensionPath?:string){
  const stop=async(reason:string)=>{
    const action=await vscode.window.showWarningMessage(reason,'Microsoft WSL guide','VS Code WSL guide',...(extensionPath?['NetClaw WSL guide']:[]),'Retry');
    if(action==='Microsoft WSL guide')await vscode.env.openExternal(vscode.Uri.parse('https://learn.microsoft.com/windows/wsl/install'));
    if(action==='VS Code WSL guide')await vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/docs/remote/wsl'));
    if(action==='NetClaw WSL guide'&&extensionPath)await vscode.commands.executeCommand('markdown.showPreview',vscode.Uri.file(path.join(extensionPath,'dist/setup/WINDOWS-WSL-PREREQUISITES.md')));
    if(action==='Retry')await openWindowsGate(answers,extensionPath);
  };
  if(!vscode.extensions.getExtension('ms-vscode-remote.remote-wsl')){
    await stop('The Microsoft WSL extension is required in this VS Code window. Install or enable it before reopening setup. No Windows or WSL changes were made.');return;
  }
  const gate=await windowsGate();
  if(gate.state!=='available'){
    await stop(gate.state==='missing'?'No installed WSL distribution was found. Prepare WSL2 Ubuntu 24.04 or 26.04 before continuing.':gate.reason);return;
  }
  const distributions=gate.distributions.filter(d=>d.version===2);
  if(!distributions.length){await stop('Only WSL1 distributions were detected. NetClaw setup requires WSL2 Ubuntu 24.04 or 26.04.');return;}
  const picked=await vscode.window.showQuickPick(distributions.map(d=>({
    label:d.name,description:'WSL2 · '+d.state,distribution:d.name})),
    {title:'Choose a WSL2 distribution for NetClaw',placeHolder:'Ubuntu 24.04/26.04 identity will be verified after opening.'});
  if(!picked)return;
  const folder=await vscode.window.showInputBox({title:'Existing folder inside WSL',prompt:'Absolute Linux folder to open. This does not select a runtime home.',
    validateInput:v=>v.startsWith('/')&&!v.split('/').includes('..')?undefined:'Enter an absolute Linux folder.'});
  if(!folder)return;
  const record=createHandoff(picked.distribution,answers);
  const accepted=await vscode.window.showInformationMessage('Open NetClaw setup in '+picked.distribution+'?',
    {modal:true,detail:'This separate handoff starts the chosen distribution, writes a private non-secret resume record with Python 3, and opens the selected folder. VS Code may install its WSL Server. No claw is installed. The read-only gate has made none of these changes.'},'Open in WSL');
  if(accepted!=='Open in WSL')return;
  await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Saving WSL setup handoff'},()=>new Promise<void>((resolve,reject)=>{
    const child=spawn('wsl.exe',handoffCommand(record),{stdio:['pipe','ignore','ignore'],windowsHide:true});
    const timer=setTimeout(()=>{child.kill();reject(Error('Handoff outcome is unknown. Reopen setup and inspect the selected distribution before retrying.'));},30000);
    child.once('error',()=>{clearTimeout(timer);reject(Error('WSL handoff could not start.'));});
    child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Private handoff could not be saved. Check Python 3 and the selected WSL home permissions.'));});
    child.stdin.end(canonical(record));
  }));
  await vscode.commands.executeCommand('vscode.openFolder',vscode.Uri.from(remoteFolder(picked.distribution,folder)),{forceNewWindow:true});
}
