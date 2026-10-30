import * as vscode from 'vscode';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {SetupWizard} from '../views/setup-wizard';
import {SetupBroker} from './broker';
import {canonical,hash,realParents,readData} from './data';
import {hostContext} from '../state/profiles';
import {quote} from '../assistants/provider';
import {distributeSetupSkill} from './skills';

export class SetupAssistant implements vscode.McpServerDefinitionProvider,vscode.Disposable {
  private broker?:SetupBroker;
  private file?:string;
  private workspace?:string;
  private refs=new Map<string,{file:string;hash:string}>();
  private changed=new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions=this.changed.event;
  constructor(private context:vscode.ExtensionContext,private wizard:SetupWizard){}
  provideMcpServerDefinitions(){
    if(!this.file||!vscode.workspace.isTrusted)return [];
    return [new vscode.McpStdioServerDefinition('NetClaw setup',process.execPath,[path.join(this.context.extensionPath,'dist/assistant.mjs'),'--setup-registration',this.file],{ELECTRON_RUN_AS_NODE:'1'},this.context.extension.packageJSON.version)];
  }
  async enable(){
    if(!vscode.workspace.isTrusted||process.platform==='win32')throw Error('Open a trusted macOS or WSL setup window first.');
    const client=await vscode.window.showQuickPick(['copilot','codex','claude-code'],{title:'Assistant for new NetClaw setup'});if(!client)return;
    await this.wizard.open();
    const folder=await vscode.window.showOpenDialog({title:'Choose a deployment plan workspace outside NetClaw and runtime homes',canSelectFolders:true,canSelectFiles:false,canSelectMany:false});if(!folder?.[0])return;
    const root=folder[0].fsPath;realParents(root);const plan=this.wizard.snapshot().answers;
    const overlaps=(a:string,b:string)=>a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep);
    if([plan.source?.path,...(plan.claws||[]).map((c:any)=>c.runtimeHome)].filter(Boolean).some(p=>overlaps(root,p)))throw Error('Choose a separate deployment workspace.');
    if((await vscode.window.showInformationMessage('Enable this assistant for setup drafts?',{modal:true,detail:`Client: ${client}\nWorkspace: ${root}\nThe assistant can read the public catalog, submit non-secret drafts, request native password entry and stage a plan for review. Native human action is required to apply. This registration expires with this editor session. No existing-claw management access is granted.`},'Enable setup drafts'))!=='Enable setup drafts')return;
    await distributeSetupSkill(this.context,client,root);
    this.broker?.dispose();this.refs.clear();this.workspace=path.join(root,'.netclaw-setup');realParents(this.workspace);
    fs.mkdirSync(this.workspace,{mode:0o700,recursive:true});
    if(fs.statSync(this.workspace).mode&0o077)throw Error('The setup draft directory must be private.');
    this.broker=new SetupBroker((op,args)=>this.dispatch(op,args));
    this.file=await this.broker.start(fs.realpathSync(os.tmpdir()),hostContext());this.changed.fire();
    const starter='Use the netclaw-install skill to guide a new, separate NetClaw installation. Observe the host, explain choices, ask one question at a time, and draft a Claw Plan. Use native secret entry. Stage the finished plan for native review; do not execute installation commands.';
    if(client==='copilot'){const doc=await vscode.workspace.openTextDocument({language:'markdown',content:'NetClaw setup is available in VS Code MCP discovery. Review and start its tools.\n\nStarter prompt:\n\n'+starter});await vscode.window.showTextDocument(doc,{preview:false});return;}
    const name='netclaw-setup-'+randomBytes(4).toString('hex'),adapter=path.join(this.context.extensionPath,'dist/assistant.mjs');
    const args=`--env ELECTRON_RUN_AS_NODE=1 -- ${quote(process.execPath)} ${quote(adapter)} --setup-registration ${quote(this.file)}`;
    const command=client==='codex'?`codex mcp add ${quote(name)} ${args}`:`claude mcp add --transport stdio ${quote(name)} ${args}`;
    const doc=await vscode.workspace.openTextDocument({language:'shellscript',content:`# Review and run on this extension host. No PATH Node is required.\n# Unique registration name; existing servers are preserved.\n${command}\n\n# Starter prompt (paste into the chosen assistant):\n# ${starter}\n\n# Remove the expired registration when this editor window closes:\n${client==='codex'?'codex':'claude'} mcp remove ${quote(name)}\n`});
    await vscode.window.showTextDocument(doc,{preview:false});
  }
  private async dispatch(operation:string,args:any):Promise<any>{
    if(!vscode.workspace.isTrusted||!this.workspace)throw Error('not_authorized');
    if(operation==='netclaw_setup_observe')return this.wizard.setupObservation();
    if(operation==='netclaw_setup_catalog')return this.wizard.setupCatalog(args);
    if(operation==='netclaw_setup_status')return this.wizard.setupStatus(args.runRef);
    if(operation==='netclaw_setup_draft'){
      if(this.refs.size>=128)throw Error('draft_limit');
      await this.wizard.submitDraft(args.plan);
      const snapshot=this.wizard.snapshot(),ref='draft-'+randomBytes(16).toString('hex'),file=path.join(this.workspace,ref+'.json');
      fs.writeFileSync(file,canonical(snapshot.answers)+'\n',{mode:0o600,flag:'wx'});
      this.refs.set(ref,{file,hash:snapshot.hash});
      return {planRef:ref,hash:snapshot.hash,complete:snapshot.complete,applyReady:false,unresolvedCount:(snapshot.answers.unresolved||[]).length,assumptionCount:(snapshot.answers.assumptions||[]).length,reviewRequired:true};
    }
    const ref=this.refs.get(args.planRef);
    if(!ref||hash(canonical(readData(ref.file)))!==ref.hash||this.wizard.snapshot().hash!==ref.hash)throw Error('stale_plan');
    if(operation==='netclaw_setup_secret_entry')return this.wizard.setupSecret(args.owner,args.key);
    if(operation==='netclaw_setup_review'){
      if(args.expectedHash!==ref.hash)throw Error('stale_plan');
      await this.wizard.open();await vscode.window.showInformationMessage('An assistant staged this plan. Use “Review installation” in the setup editor to review and apply it.');
      return {state:'submitted',hash:ref.hash,reviewRequired:true};
    }
    return this.wizard.setupInspect(ref.file,operation==='netclaw_setup_validate'?'validate':'explain');
  }
  dispose(){this.broker?.dispose();this.refs.clear();this.wizard.clearSetupSecrets();this.changed.dispose();}
}
