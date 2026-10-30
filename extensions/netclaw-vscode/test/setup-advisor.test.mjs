import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/setup/advisor.ts'],bundle:true,write:false,platform:'node',format:'cjs',external:['vscode']});
function fixture(cancelAt=0){
  const questions=[],documents=[],calls=[];
  const vscode={window:{showQuickPick:async(options,config)=>{questions.push(config.title);return questions.length===cancelAt?undefined:options[0];},showTextDocument:async()=>{}},
    workspace:{openTextDocument:async document=>{documents.push(document);return document;}}};
  const module={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(name=>{assert.equal(name,'vscode');return vscode;},module,module.exports);
  const report={recommendation:'focused',feasibility:'unknown',assumptions:[],reasons:[],counts:{components:1,registeredMcps:1,skills:1,documentedSchemas:0,unknownSchemaComponents:1},
    estimatedCloudClaws:null,estimatedRequiredClaws:1,shapeEstimates:{focused:{claws:1,registeredMcps:1,skills:1},risk:{claws:2,memberGroups:1}},partitions:[],limitations:[]};
  return {...module.exports,questions,documents,calls,engine:{advise:async(...args)=>{calls.push(args);return report;}}};
}
test('advisor asks five bounded native choices, renders both shapes, and never changes a plan',async()=>{
  const f=fixture();await f.showAdvisor(f.engine,'/fixture/plan.json');
  assert.equal(f.questions.length,5);assert.deepEqual(f.calls,[['/fixture/plan.json',{domains:'single',credentials:'shared',production:'testing',cost:'balanced',growth:'stable'}]]);
  assert.match(f.documents[0].content,/Focused estimate: 1 claw/);assert.match(f.documents[0].content,/Risk estimate: 2 claws/);
  assert.match(f.documents[0].content,/unknown until discovery/);
  const cancelled=fixture(3);await cancelled.showAdvisor(cancelled.engine,'/fixture/plan.json');
  assert.equal(cancelled.questions.length,3);assert.equal(cancelled.calls.length,0);assert.equal(cancelled.documents.length,0);
});
