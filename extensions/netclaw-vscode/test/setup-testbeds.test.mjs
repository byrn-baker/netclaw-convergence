import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {load} from './load.mjs';
const require=createRequire(import.meta.url);
const schema=JSON.parse(fs.readFileSync('../../config/claw-plan.schema.json'));
const catalog=JSON.parse(fs.readFileSync('../../config/components/catalog.json'));
const sources=JSON.parse(fs.readFileSync('../../config/pyats-testbed-sources.json')).sources;
const {SetupDraft}=await load('src/setup/plan.ts');
const {setTestbed}=await load('src/setup/testbeds.ts');
const bundle=await build({entryPoints:['src/views/setup-wizard.ts'],bundle:true,write:false,platform:'node',format:'cjs',external:['vscode']});
function fixture(picks,confirm='Use dynamic inventory'){
  const questions=[],warnings=[],saves=[];
  const vscode={window:{showQuickPick:async(options,config)=>{
    questions.push({options,config});const answer=picks.shift();
    return answer===undefined?undefined:Array.isArray(answer)?options.filter(x=>answer.includes(x.id)):options.find(x=>x.id===answer);
  },showWarningMessage:async(...args)=>{warnings.push(args);return confirm;}}};
  const module={exports:{}};
  new Function('require','module','exports',bundle.outputFiles[0].text)(name=>name==='vscode'?vscode:require(name),module,module.exports);
  const wizard=Object.create(module.exports.SetupWizard.prototype);
  wizard.local={get:(_key,fallback)=>fallback,update:async(key,value)=>saves.push({key,value})};
  wizard.pendingSecrets=new Map();wizard.testbedSources=sources;
  wizard.draft=new SetupDraft(schema,catalog);
  wizard.draft.replace({schema:1,claws:[{id:'one',displayName:'One',capabilities:{components:['pyats']}},{id:'two',displayName:'Two',capabilities:{components:['pyats']},testbed:{mode:'dynamic',sources:['netbox']}}],
    inventory:[{owner:'one',kind:'testbed-yaml',path:'/private/fixture.yaml',sha256:'a'.repeat(64)}]},0);
  return {wizard,questions,warnings,saves};
}
test('real wizard action selects canonical sources, confirms planned import removal, preserves neighbor and reloads',async()=>{
  const f=fixture(['dynamic',['cml','gns3']]);await f.wizard.action('testbed',{owner:'one'});
  const plan=f.wizard.draft.snapshot().answers;
  assert.deepEqual(plan.claws[0].testbed,{mode:'dynamic',sources:['cml','gns3']});
  assert.deepEqual(plan.claws[1].testbed,{mode:'dynamic',sources:['netbox']});assert.equal(plan.inventory.length,0);
  assert.equal(f.questions[1].options.length,14);assert.match(f.questions[1].options.find(s=>s.id==='gns3').detail,/management endpoint/);
  assert.equal(f.warnings.length,1);assert.equal(f.saves.length,1);
  const restored=new SetupDraft(schema,catalog);restored.replace(f.saves[0].value,0);
  assert.deepEqual(restored.snapshot().answers.claws[0].testbed,plan.claws[0].testbed);
});
test('cancel at either native picker or replacement confirmation leaves exact draft unchanged',async()=>{
  for(const [picks,confirmation] of [[[],undefined],[['dynamic'],undefined],[['dynamic',['cml']],undefined]]){
    const f=fixture(picks,confirmation===undefined?'Cancel':confirmation),before=f.wizard.draft.snapshot();
    await f.wizard.action('testbed',{owner:'one'});assert.deepEqual(f.wizard.draft.snapshot(),before);assert.equal(f.saves.length,0);
  }
});
test('static mode and semantic policy guard retain unrelated imports and reject unknown/empty choices',()=>{
  const f=fixture([]),plan=f.wizard.draft.snapshot().answers;
  assert.equal(setTestbed(plan,'one',{mode:'static',sources:[]},sources).inventory.length,1);
  for(const value of [{mode:'dynamic',sources:[]},{mode:'dynamic',sources:['unknown']},{mode:'static',sources:['cml']}])assert.throws(()=>setTestbed(plan,'one',value,sources));
  assert.throws(()=>setTestbed(plan,'unknown',{mode:'static',sources:[]},sources));
});
test('removing pyATS invalidates its policy and plan hash, while provider edits preserve it',()=>{
  const f=fixture([]),draft=f.wizard.draft,before=draft.snapshot();
  const change={path:'/claws/1/capabilities',value:{components:['subnet-calc']}};
  assert.ok(draft.preview(change).discarded.includes('/claws/1/testbed'));
  draft.update(change,before.revision,true);assert.equal(draft.snapshot().answers.claws[1].testbed,undefined);
  assert.notEqual(draft.snapshot().hash,before.hash);
});
