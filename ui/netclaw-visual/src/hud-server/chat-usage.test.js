import test from 'node:test';
import assert from 'node:assert/strict';
import { projectContext, projectQuota, createUsageReader } from './chat-usage.js';
const row = { key: 'owned', totalTokens: 250, totalTokensFresh: true, contextTokens: 1000,
  model: 'model', modelProvider: 'provider', updatedAt: 100 };
test('context uses exact owned session and fresh runtime counts only', () => {
  const data = { sessions: [row, { ...row, key: 'someone-else', totalTokens: 900 }] };
  assert.equal(projectContext(data, 'owned', 'provider/model').percentUsed, 25);
  assert.equal(projectContext(data, 'missing', 'provider/model').available, false);
  assert.equal(projectContext(data, 'owned', 'other/model').available, false);
  assert.equal(projectContext({sessions:[{...row,totalTokensFresh:false}]}, 'owned', 'provider/model').used, null);
  assert.equal(projectContext({sessions:[{...row,contextTokens:0}]}, 'owned', 'provider/model').available, false);
});
test('quota exposes only requested provider windows, never account identity', () => {
  const data = { usage: {updatedAt:123, providers:[{provider:'provider', accountEmail:'private@example.com', billing:[{secret:'hidden'}],
    windows:[{label:'Weekly',usedPercent:39,resetAt:1234},{label:'Invalid',usedPercent:NaN}]}]} };
  const result=projectQuota(data,'provider');
  assert.equal(result.windows.length,1);
  assert.equal(result.windows[0].remainingPercent,61);
  assert.doesNotMatch(JSON.stringify(result),/private|billing|hidden|accountEmail/);
  assert.equal(projectQuota(data,'missing').available,false);
  assert.equal(projectQuota({},'provider').available,false);
});
test('reader coalesces concurrent reads, caches separately and marks failed refresh stale', async () => {
  let now=1000,calls=0,fail=false;
  const read=createUsageReader(async args=>{
    calls++;
    if(fail)throw Error('secret failure');
    return args[0]==='sessions'?{sessions:[row]}:{usage:{providers:[{provider:'provider',windows:[{label:'week',usedPercent:10}]}]}};
  },()=>now);
  const input={agentId:'a',key:'owned',selectedModel:'provider/model'};
  const values=await Promise.all([read(input),read(input)]);
  assert.equal(calls,2);
  assert.equal(values[0].context.used,250);
  await read(input);assert.equal(calls,2);
  now+=16000;await read(input);assert.equal(calls,3);
  fail=true;now+=300001;
  const stale=await read(input);
  assert.equal(stale.quota.stale,true);assert.equal(stale.context.stale,true);
  assert.doesNotMatch(JSON.stringify(stale),/secret failure/);
});
