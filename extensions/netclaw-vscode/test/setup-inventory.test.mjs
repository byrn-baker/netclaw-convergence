import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSetupTestbed} from '../../../ui/netclaw-visual/testbed-document.js';
import yaml from 'yaml';
test('setup reuses actual HUD YAML/JSON/CSV validation without device connections',()=>{
  const fixture={devices:{'fixture-router':{os:'iosxe',type:'router',connections:{cli:{protocol:'ssh',ip:'192.0.2.10',port:22}}}}};
  for(const format of ['yaml','json']){
    const input=format==='json'?JSON.stringify(fixture):yaml.stringify(fixture);
    assert.deepEqual(yaml.parse(normalizeSetupTestbed(input,format)),fixture);
  }
  const csv='id,os,type,connection,protocol,host,port\nfixture-router,iosxe,router,cli,ssh,192.0.2.10,22\n';
  assert.equal(yaml.parse(normalizeSetupTestbed(csv,'csv')).devices['fixture-router'].connections.cli.ip,'192.0.2.10');
  assert.throws(()=>normalizeSetupTestbed('devices: {}\ndevices: {}','yaml'));
  assert.throws(()=>normalizeSetupTestbed('x'.repeat(256*1024+1),'yaml'));
});
