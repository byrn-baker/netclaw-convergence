import * as vscode from 'vscode';
export async function secretInput(owner:string,key:string):Promise<string|undefined>{
  return vscode.window.showInputBox({title:'Credential for '+owner,prompt:key+' · Stored only in this installation’s private environment file.',
    password:true,ignoreFocusOut:true,validateInput:value=>value&&Buffer.byteLength(value)<=16384&&!/[\r\n\0]/.test(value)?undefined:'Enter a nonempty, single-line credential.'});
}
