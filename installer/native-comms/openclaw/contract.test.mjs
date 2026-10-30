import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedDelta,selectedPlugin} from './contract.mjs';

test('native result retains other channels, provider, MCP and exact account scope',()=>{
  const before={models:{private:'preserve'},mcp:{servers:{owned:{}}},channels:{slack:{enabled:true}}};
  const chosen={enabled:true,dmPolicy:'allowlist',allowFrom:['user-1'],groupPolicy:'disabled'};
  const after={...structuredClone(before),channels:{...before.channels,discord:chosen}};
  assert.deepEqual(selectedDelta(before,after,'discord'),chosen);
  for(const mutate of [v=>v.models.private='changed',v=>v.channels.slack.enabled=false,
    v=>v.mcp.servers.foreign={},v=>v.plugins={allow:['*']}]){
    const changed=structuredClone(after);mutate(changed);
    assert.throws(()=>selectedDelta(before,changed,'discord'),/unrelated_config_change/);
  }
});

test('native open-access or unsafe options cannot be promoted',()=>{
  for(const cfg of [{dmPolicy:'open'},{allowFrom:['*']},{groupPolicy:'open'},
    {guilds:{'*':{}}},{configWrites:true},{autoJoin:'always'},{dangerouslyAllowNameMatching:true}]){
    assert.throws(()=>selectedDelta({}, {channels:{matrix:cfg}},'matrix'));
  }
  assert.throws(()=>selectedDelta({}, {},'matrix'));
});

test('loader result requires exactly the selected setup entry and no runtime activation',()=>{
  const row={pluginId:'slack',plugin:{id:'slack'}};
  assert.deepEqual(selectedPlugin({channelSetups:[row],channels:[]},'slack','slack'),row.plugin);
  for(const registry of [{channelSetups:[]},{channelSetups:[row,row]},
    {channelSetups:[row,{pluginId:'discord',plugin:{id:'discord'}}]},
    {channelSetups:[row],channels:[row]}])assert.throws(()=>selectedPlugin(registry,'slack','slack'));
});
