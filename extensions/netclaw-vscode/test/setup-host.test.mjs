import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './load.mjs';
const {decodeWsl,parseWslList,classifyHost,windowsGate}=await load('src/setup/host.ts');
test('WSL UTF8, UTF16, localized states and named distributions retain version evidence',()=>{
  const text='  NAME                   STATE           VERSION\r\n* Ubuntu-24.04           Stopped         2\r\n  Ubuntu-26.04           En cours        2\r\n  Legacy                 Running         1\r\n';
  const be=Buffer.from('\ufeff'+text,'utf16le').swap16();
  for(const bytes of [Buffer.from(text),Buffer.from('\ufeff'+text,'utf16le'),Buffer.from(text,'utf16le'),be]){
    const rows=parseWslList(decodeWsl(bytes));assert.equal(rows.length,3);
    assert.deepEqual(rows.map(r=>r.version),[2,2,1]);assert.equal(rows[1].name,'Ubuntu-26.04');
  }
  assert.throws(()=>decodeWsl(Buffer.from([0xff,0x00,0x81])));
  assert.throws(()=>parseWslList('unexpected localized error'));
  for(const rows of ['* Ubuntu     Running     3','* Ubuntu     Running     2\n  ubuntu     Stopped     2','* Ubuntu     Running     2\n* Other      Running     2'])
    assert.throws(()=>parseWslList('NAME       STATE       VERSION\n'+rows));
});
test('only local Mac and supported verified WSL Ubuntu classify executable',()=>{
  assert.equal(classifyHost({platform:'darwin',remote:undefined}).kind,'macos');
  assert.equal(classifyHost({platform:'win32'}).kind,'windows-gate');
  assert.equal(classifyHost({platform:'darwin',remote:'ssh-remote'}).kind,'unsupported');
  assert.equal(classifyHost({platform:'linux',remote:'wsl',kernel:'6.6-microsoft-standard-WSL2',osRelease:'ID=ubuntu\nVERSION_ID="26.04"'}).kind,'wsl2');
  assert.equal(classifyHost({platform:'linux',remote:'wsl',kernel:'microsoft-standard-WSL2',osRelease:'ID=ubuntu\nVERSION_ID="22.04"'}).kind,'unsupported');
  assert.equal(classifyHost({platform:'linux',remote:'wsl',kernel:'linux',osRelease:'ID=ubuntu\nVERSION_ID="26.04"'}).kind,'unsupported');
});
test('native Windows gate issues only two read-only probes and never starts a distro',async()=>{
  const calls=[];
  const result=await windowsGate(async(command,args)=>{calls.push([command,args]);return {code:0,stdout:Buffer.from(args[0]==='--list'?'  NAME       STATE       VERSION\n* Ubuntu     Stopped     2\n':'WSL available')};});
  assert.equal(result.state,'available');assert.equal(result.distributions.length,1);
  assert.deepEqual(calls,[['wsl.exe',['--status']],['wsl.exe',['--list','--verbose']]]);
  const failed=await windowsGate(async()=>({code:1,stdout:Buffer.from('private-error-canary')}));
  assert.equal(failed.state,'unknown');assert.ok(!JSON.stringify(failed).includes('canary'));
  const thrown=await windowsGate(async()=>{throw Error('private-error-canary');});
  assert.equal(thrown.state,'unknown');assert.ok(!JSON.stringify(thrown).includes('canary'));
});
