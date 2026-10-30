import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileFixture,sourceRoot} from './claw-fixture.mjs';
import {hash,readManaged,prepareWrite,applyWrite,inspectFiles,resolveTarget,reconcileFiles} from '../../../scripts/lib/claw-files.mjs';
function setup(){
  const f=fileFixture('hermes'),manifest=path.join(f.home,'.setup/identity.json');
  fs.mkdirSync(path.dirname(manifest),{mode:0o700});
  fs.writeFileSync(path.join(f.home,'.netclaw-setup-owner.json'),JSON.stringify({schema:1,runId:'run-fixture',installationId:'member',planHash:'a'.repeat(64)}),{mode:0o600});
  fs.writeFileSync(manifest,JSON.stringify({schema:1,files:{'USER.md':hash(fs.readFileSync(path.join(f.home,'USER.md')))}}),{mode:0o600});
  return {...f,manifest};
}
test('reviewed setup-owned Hermes save refreshes only its persona manifest and remains readable by the protected loader',async()=>{
  const f=setup();
  try{
    const original=fs.readFileSync(f.manifest),soul=fs.readFileSync(path.join(f.home,'SOUL.md'));
    assert.match((await inspectFiles(f.target)).loading,/Saving these files also reviews their identity manifest/);
    const before=await readManaged(f.target,'USER.md'),content='# Reviewed fixture preferences\n';
    const r=await prepareWrite(f.target,{name:'USER.md',baseline:before.revision,content});
    const result=await applyWrite(f.target,{...r,content});assert.equal(result.outcome,'verified');
    assert.equal(JSON.parse(fs.readFileSync(f.manifest)).files['USER.md'],hash(content));
    assert.deepEqual(fs.readFileSync(path.join(f.home,'SOUL.md')),soul);
    assert.deepEqual(fs.readFileSync(path.join(path.dirname(result.backup),r.id+'.identity.json')),original);
    const check=execFileSync('python3',['-c','import sys;sys.path.insert(0,sys.argv[1]);from setup_identity import load_identity;text,hashes=load_identity(sys.argv[2]);assert "Reviewed fixture preferences" in text;assert len(hashes)==2',path.join(sourceRoot,'mcp-servers/hermes-hud-mcp'),f.home]);
    assert.equal(check.length,0);
  }finally{fs.rmSync(f.base,{recursive:true,force:true});}
});
test('changed identity review is refused and an interrupted two-file save never reconciles as verified',async()=>{
  const f=setup();
  try{
    const before=await readManaged(f.target,'USER.md'),content='# New fixture\n';
    const r=await prepareWrite(f.target,{name:'USER.md',baseline:before.revision,content});
    const original=fs.readFileSync(f.manifest),changed=JSON.parse(original);changed.files['SOUL.md']=hash(fs.readFileSync(path.join(f.home,'SOUL.md')));
    fs.writeFileSync(f.manifest,JSON.stringify(changed));
    await assert.rejects(applyWrite(f.target,{...r,content}),/identity changed after review/);
    assert.equal((await readManaged(f.target,'USER.md')).revision,before.revision);
    fs.writeFileSync(f.manifest,original);
    await assert.rejects(prepareWrite(f.target,{name:'USER.md',baseline:before.revision,content:'x'.repeat(65537)}),/64 KiB/);
    const result=await applyWrite(f.target,{...r,content}),journal=JSON.parse(fs.readFileSync(result.evidence));
    // Simulate durable file replacement without its manifest replacement.
    fs.writeFileSync(f.manifest,original);journal.phase='prepared';fs.writeFileSync(result.evidence,JSON.stringify(journal));
    await reconcileFiles(await resolveTarget(f.target));
    assert.equal(JSON.parse(fs.readFileSync(result.evidence)).phase,'unknown');
    assert.deepEqual(fs.readFileSync(f.manifest),original);
  }finally{fs.rmSync(f.base,{recursive:true,force:true});}
});
