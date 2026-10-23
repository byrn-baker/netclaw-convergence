import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBudgetPolicy } from './budget-policy.js';

test('zero limits and false confirmation override retain their meaning', () => {
  const p = resolveBudgetPolicy({ agents:{ defaults:{ budget:{
    sessionBudgetUsd:0, maxToolCallsPerTurn:0, overrideIncrementUsd:0, allowOverride:'false',
  } } } }, {});
  assert.equal(p.sessionBudgetUsd, 0);
  assert.equal(p.maxToolCallsPerTurn, 0);
  assert.equal(p.overrideIncrementUsd, 0);
  assert.equal(p.allowOverride, false);
});

test('invalid overrides retain the last valid layer', () => {
  const config = { agents:{ defaults:{ budget:{ sessionBudgetUsd:2, session_budget_usd:'NaN', maxToolCallsPerTurn:1.5 } } } };
  for (const value of ['NaN', 'Infinity', '-1', 'bad', '']) {
    const p = resolveBudgetPolicy(config, { NETCLAW_SESSION_BUDGET_USD:value });
    assert.equal(p.sessionBudgetUsd, 2);
    assert.equal(p.maxToolCallsPerTurn, 20);
  }
  assert.equal(resolveBudgetPolicy(config, { NETCLAW_SESSION_BUDGET_USD:'0' }).sessionBudgetUsd, 0);
});
