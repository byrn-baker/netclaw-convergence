import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {readData,readBytes,realParents,hash,canonical} from './data';
import {LocalState} from '../state/local';
import {SetupEngine} from './engine';
import {RunReference} from './runs';
const exec=promisify(execFile);
const PIN='c12293c3dac84bf20fccb7dfc455a76792d7a6d6';

function bundled(context:vscode.ExtensionContext){
  const root=path.join(context.extensionPath,'dist/preset'),stamp=readData(path.join(root,'stamp.json'));
  for(const [name,digest] of Object.entries(stamp.files)){
    if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.split('/').includes('..')||hash(readBytes(path.join(root,name)))!==digest)throw Error('Bundled deployment preset changed.');
  }return root;
}

export async function createPreset(context:vscode.ExtensionContext,local:LocalState,plan:any){
  if(!vscode.workspace.isTrusted||process.platform==='win32')throw Error('Use a trusted macOS or WSL setup window.');
  const client=await vscode.window.showQuickPick(['codex','claude','copilot'],{title:'Deployment Spec Kit client'});if(!client)return;
  const destination=await vscode.window.showInputBox({title:'New deployment workspace',prompt:'Absolute new directory outside NetClaw and every runtime home.'});if(!destination)return;
  realParents(destination);if(fs.existsSync(destination))throw Error('Choose a new directory. Existing workspaces are preserved.');
  const overlap=(a:string,b:string)=>a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep);
  if([plan.source?.path,...(plan.claws||[]).map((c:any)=>c.runtimeHome)].filter(Boolean).some(p=>overlap(destination,p)))throw Error('Choose a separate deployment directory.');
  const preset=bundled(context),tools=path.join(context.globalStorageUri.fsPath,'specify-'+randomUUID());realParents(tools);
  if((await vscode.window.showInformationMessage('Create this deployment Spec Kit workspace?',{modal:true,detail:`Client: ${client}\nWorkspace: ${destination}\nIsolated tools: ${tools}\nDownloads pinned Specify 0.7.1 (${PIN}) and its Python dependencies. No assistant or installer is executed. The preset stages native review only.`},'Create deployment workspace'))!=='Create deployment workspace')return;
  fs.mkdirSync(tools,{recursive:true,mode:0o700});fs.mkdirSync(path.join(tools,'home'),{mode:0o700});
  const env={PATH:process.env.PATH,HOME:path.join(tools,'home'),UV_CACHE_DIR:path.join(tools,'cache'),UV_PYTHON_INSTALL_DIR:path.join(tools,'python'),GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',PYTHONNOUSERSITE:'1',PIP_CONFIG_FILE:'/dev/null',SPECKIT_ALLOW_ALL_TOOLS:'0',NO_COLOR:'1',COLUMNS:'300'};
  const run=async(command:string,args:string[],cwd:string)=>{
    try{return await exec(command,args,{cwd,env,timeout:600000,maxBuffer:2*1024*1024});}
    catch{throw Error('Deployment scaffolding did not verify. The partial workspace is retained for inspection; no installer ran.');}
  };
  await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'Create deployment workflow'},async progress=>{
    progress.report({message:'Prepare isolated pinned Specify'});
    await run('uv',['venv',path.join(tools,'venv'),'--python','3.12'],tools);
    const python=path.join(tools,'venv/bin/python');
    await run('uv',['pip','install','--python',python,'specify-cli @ git+https://github.com/github/spec-kit.git@'+PIN],tools);
    const cli=['-c','import os; os.umask(0o077); from specify_cli import main; main()'];
    progress.report({message:'Render the selected client and add deployment preset'});
    await run(python,[...cli,'init',destination,'--integration',client,'--script','sh','--no-git','--ignore-agent-tools'],tools);
    await run(python,[...cli,'preset','add','--dev',preset],destination);
    const verified=await run(python,[path.join(preset,'verify.py'),destination,preset,client],destination);
    if(readJson(verified.stdout).effective!==true)throw Error('Effective deployment preset is displaced.');
    for(const [from,to] of [['templates/spec-template.md','deployment-spec.md'],['templates/tasks-template.md','deployment-tasks.md'],['example-plan.json','netclaw-plan.json']])
      fs.writeFileSync(path.join(destination,to!),readBytes(path.join(preset,from!)),{flag:'wx',mode:0o600});
    await local.update('setup-preset',{workspace:destination,client,pin:PIN,reportHash:null});
  });
  const doc=await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(destination,'deployment-spec.md')));await vscode.window.showTextDocument(doc,{preview:false});
}
function readJson(value:string){try{return JSON.parse(value);}catch{throw Error('Preset verification output is invalid.');}}

export async function writePresetReport(local:LocalState,engine:SetupEngine,reference:RunReference){
  const target=local.get<any>('setup-preset',undefined);if(!target||target.pin!==PIN)throw Error('Create a deployment workspace first.');
  const file=path.join(target.workspace,'claw-report.json');realParents(file);
  const before=fs.existsSync(file)?hash(readBytes(file)):null;
  if(before!==target.reportHash)throw Error('The deployment report changed outside this writer. Preserve it before exporting a separate report.');
  const report=await engine.read('report',undefined,reference.runId);if(report.export!=='redacted')throw Error('Only redacted reports may be written back.');
  if((await vscode.window.showInformationMessage('Write the redacted Claw Report into this deployment workspace?',{modal:true,detail:file},'Write report'))!=='Write report')return;
  realParents(file);if((fs.existsSync(file)?hash(readBytes(file)):null)!==before)throw Error('Report changed during review.');
  const data=canonical(report)+'\n',temporary=file+'.'+randomUUID()+'.tmp';
  const fd=fs.openSync(temporary,'wx',0o600);try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try{fs.renameSync(temporary,file);await local.update('setup-preset',{...target,reportHash:hash(data)});}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
