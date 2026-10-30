import * as vscode from 'vscode';
import {NativeTerminalHook} from './native-terminal';

export const openNativeTerminal:NativeTerminalHook=(binding,input,cancel,resize)=>new Promise((resolve,reject)=>{
  const output=new vscode.EventEmitter<string>();let settled=false,disposed=false;
  const timer=setTimeout(()=>{terminal.dispose();reject(Error('Native terminal did not open.'));},30000);
  const terminal=vscode.window.createTerminal({name:`NetClaw setup · ${binding.owner}`,isTransient:true,pty:{
    onDidWrite:output.event,
    open(){settled=true;clearTimeout(timer);output.fire('Complete the native setup prompts here. Closing this terminal stops setup pending reconciliation.\r\n');
      resolve({write:text=>{if(!disposed)output.fire(text);},dispose:()=>{disposed=true;terminal.dispose();output.dispose();}});},
    close(){clearTimeout(timer);if(!disposed){disposed=true;cancel();}output.dispose();if(!settled)reject(Error('Native terminal cancelled.'));},
    handleInput:input,
    setDimensions:(dimensions:vscode.TerminalDimensions)=>resize(dimensions.columns,dimensions.rows)
  }});
  terminal.show(false);
});
