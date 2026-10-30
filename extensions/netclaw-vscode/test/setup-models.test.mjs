import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/setup/discovery.ts'],bundle:true,write:false,platform:'node',format:'cjs',external:['vscode']});
function fixture(selection){
  const calls=[],picks=[],messages=[];
  const vscode={ProgressLocation:{Notification:1},window:{withProgress:async(_,run)=>run(),showQuickPick:async(options,config)=>{
    picks.push({options,config});return selection===undefined?undefined:options.find(row=>row.model===selection);
  },showInformationMessage:async(...args)=>messages.push(args)}};
  const module={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(name=>{assert.equal(name,'vscode');return vscode;},module,module.exports);
  const report={state:'observed',models:[{id:'fixture:7b',installedBytes:4*1024**3,downloadBytes:null,quantization:'Q4',contextLength:8192,toolUse:true}],
    hardware:{memoryBytes:16*1024**3,diskFreeBytes:80*1024**3,note:'Weights, context and concurrent members consume memory.'},
    download:{state:'deferred',automaticDownload:false,guidance:'Download size unavailable. Review in the model manager before downloading.'}};
  const engine={discover:async(...args)=>{calls.push(args);return report;}};
  return {...module.exports,engine,calls,picks,messages};
}
test('installed model selection and cancellation perform one read-only discovery with size/hardware distinctions',async()=>{
  for(const selection of ['fixture:7b','',undefined]){
    const f=fixture(selection);assert.equal(await f.selectLocalModel(f.engine,'ollama','http://127.0.0.1:11434','/fixture/new'),selection);
    assert.deepEqual(f.calls,[['ollama','http://127.0.0.1:11434','/fixture/new']]);assert.equal(f.messages.length,0);
    assert.match(f.picks[0].config.placeHolder,/Memory 16.0 GiB.*disk free 80.0 GiB.*File size is not RAM required/);
    assert.match(f.picks[0].options[0].description,/Installed 4.0 GiB/);assert.match(f.picks[0].options[0].detail,/inference unverified/);
  }
});
test('unknown model transfer size defers download to an explicit model-manager review',async()=>{
  const f=fixture('__guidance');assert.equal(await f.selectLocalModel(f.engine,'lm-studio','http://127.0.0.1:1234/v1','/fixture/new'),undefined);
  assert.equal(f.calls.length,1);assert.equal(f.messages.length,1);assert.match(f.messages[0][0],/Download size unavailable.*before downloading/);
  assert.equal(f.messages[0][1].modal,true);
});
