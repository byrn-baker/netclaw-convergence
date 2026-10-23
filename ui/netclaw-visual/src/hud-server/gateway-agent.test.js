import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayAgentId } from './gateway-agent.js';
test('resolves modern and legacy agents without inventing main', () => {
  assert.equal(gatewayAgentId({agents:{entries:{'senior-engineer':{}}}}, ''), 'senior-engineer');
  assert.equal(gatewayAgentId({agents:{list:[{id:'ops',default:true},{id:'main'}]}}, ''), 'ops');
  assert.equal(gatewayAgentId({}, ''), 'main');
  const config = {agents:{entries:{ops:{},dev:{}}}};
  assert.throws(()=>gatewayAgentId(config, ''));
  assert.equal(gatewayAgentId(config, 'ops'), 'ops');
  assert.throws(()=>gatewayAgentId(config, '../ops'));
  assert.throws(()=>gatewayAgentId(config, 'main'));
});
