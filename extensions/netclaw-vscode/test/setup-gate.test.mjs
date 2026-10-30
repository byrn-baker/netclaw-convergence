import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const bundle=await build({entryPoints:['src/setup/gate.ts'],bundle:true,write:false,platform:'node',format:'cjs',external:['vscode']});
const header='  NAME       STATE       VERSION\n';
function fixture({extension=true,list=header+'* Ubuntu     Stopped     2\n',error=false,action,pick=false,review=false}={}){
  const probes=[],warnings=[],commands=[],external=[],choices=[],reviews=[];
  const vscode={extensions:{getExtension:id=>{assert.equal(id,'ms-vscode-remote.remote-wsl');return extension?{id}:undefined;}},
    window:{showWarningMessage:async(...args)=>{warnings.push(args);return action;},showQuickPick:async(options)=>{choices.push(options);return pick?options[0]:undefined;},
      showInputBox:async()=>'/home/fixture/project',showInformationMessage:async(...args)=>{reviews.push(args);return review?'Open in WSL':undefined;}},
    env:{openExternal:async uri=>external.push(uri)},Uri:{parse:value=>value,file:value=>value},
    commands:{executeCommand:async(...args)=>commands.push(args)}};
  const childProcess={execFile:(command,args,options,callback)=>{
    probes.push([command,args]);assert.equal(options.timeout,10000);assert.equal(options.maxBuffer,128*1024);
    callback(error?Error('private-canary'):null,Buffer.from(args[0]==='--list'?list:'WSL available'));
  },spawn:()=>assert.fail('A blocked or cancelled gate must never start a distribution or write a handoff.')};
  const module={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(name=>name==='vscode'?vscode:name==='node:child_process'?childProcess:require(name),module,module.exports);
  return {...module.exports,probes,warnings,commands,external,choices,reviews};
}
test('missing WSL extension has guidance and performs zero host probes or handoff effects',async()=>{
  const f=fixture({extension:false});await f.openWindowsGate({},'/fixture/extension');
  assert.equal(f.probes.length,0);assert.equal(f.commands.length,0);assert.equal(f.external.length,0);assert.equal(f.choices.length,0);
  assert.match(f.warnings[0][0],/Microsoft WSL extension is required/);
  assert.deepEqual(f.warnings[0].slice(1),['Microsoft WSL guide','VS Code WSL guide','NetClaw WSL guide','Retry']);
});
test('Windows blocked matrix issues only fixed read-only probes and offers a concrete remedy',async()=>{
  for(const options of [{list:header},{list:header+'* Legacy     Stopped     1\n'},{error:true},{list:'unknown output'},{list:header+'* Ubuntu     Running     3\n'},
    {list:header+'* Ubuntu     Running     2\n  ubuntu     Stopped     2\n'}]){
    const f=fixture(options);await f.openWindowsGate();
    assert.deepEqual(f.probes,[['wsl.exe',['--status']],['wsl.exe',['--list','--verbose']]]);
    assert.equal(f.choices.length,0);assert.equal(f.warnings.length,1);assert.equal(f.commands.length,0);assert.equal(f.external.length,0);
    assert.doesNotMatch(JSON.stringify(f.warnings),/private-canary/);
  }
});
test('guides open only on their native selection; bundled instructions work without a browser',async()=>{
  for(const [action,url] of [['Microsoft WSL guide','https://learn.microsoft.com/windows/wsl/install'],['VS Code WSL guide','https://code.visualstudio.com/docs/remote/wsl']]){
    const f=fixture({extension:false,action});await f.openWindowsGate({},'/fixture/extension');
    assert.deepEqual(f.external,[url]);assert.equal(f.commands.length,0);
  }
  const local=fixture({extension:false,action:'NetClaw WSL guide'});await local.openWindowsGate({},'/fixture/extension');
  assert.deepEqual(local.commands,[['markdown.showPreview','/fixture/extension/dist/setup/WINDOWS-WSL-PREREQUISITES.md']]);assert.equal(local.external.length,0);
});
test('WSL2 candidate selection and cancellation before explicit review have no handoff effects',async()=>{
  for(const pick of [false,true]){
    const f=fixture({list:header+'* Ubuntu     Stopped     2\n  Legacy     Running     1\n',pick});await f.openWindowsGate();
    assert.equal(f.choices.length,1);assert.equal(f.choices[0].length,1);assert.equal(f.choices[0][0].distribution,'Ubuntu');
    assert.equal(f.reviews.length,pick?1:0);assert.equal(f.commands.length,0);assert.equal(f.external.length,0);
  }
});
