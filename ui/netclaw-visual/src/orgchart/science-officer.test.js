import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scienceOfficer, renderScienceOfficer } from './science-officer.js';

const now = Date.parse('2026-09-27T12:00:00Z');
const snapshot = {
  enabled: true, ready: true, updated_at: '2026-09-27T12:00:00Z', model: 'jev',
  budgets: { daily_limit_usd: 5, case_limit_usd: 0.25, daily_used_usd: 0.01, case_used_usd: 0.002 },
};

test('disabled advisor is absent; missing and stale snapshots cannot imply readiness', () => {
  assert.equal(scienceOfficer(null), null);
  assert.equal(scienceOfficer({ ...snapshot, enabled: false }, true, now), null);
  assert.equal(scienceOfficer(null, true, now).status, 'not assessed');
  assert.equal(scienceOfficer(snapshot, false, now + 301000).status, 'stale snapshot');
  assert.equal(scienceOfficer({ ...snapshot, updated_at: 'bad' }, false, now).status, 'stale snapshot');
  assert.equal(scienceOfficer({ ...snapshot, ready: false }, false, now).status, 'unavailable');
  assert.equal(scienceOfficer({ ...snapshot, task_id: 'unscoped' }, false, now).case_scope, 'shared unbound case');
  const bound = scienceOfficer({ ...snapshot, task_id: 'customer-private-case' }, false, now);
  assert.equal(bound.case_scope, 'operator-bound case');
  assert.ok(!JSON.stringify(bound).includes('customer-private-case'));
});

test('advisor status allowlist excludes secrets, endpoint, evidence and detailed answers', () => {
  const advisor = scienceOfficer({ ...snapshot, api_key: 'secret', endpoint: 'https://private.example',
    state: 'private state', latest_assessment: { assessment_id: 'a1', status: 'ok', purpose: 'answer_review',
      answers: { privateQuestion: 0.8 }, state: 'private data' } }, false, now);
  const text = JSON.stringify(advisor);
  for (const forbidden of ['secret', 'private', 'endpoint', 'answers']) assert.ok(!text.includes(forbidden));
  assert.equal(advisor.node_type, 'advisor');
  assert.equal(advisor.routable, false);
  assert.equal(advisor.status, 'configured');
  assert.equal(advisor.read_only, true);
  assert.equal(advisor.budgets.case_limit_usd, 0.25);
});

test('card escapes provider text and distinguishes authority, freshness and bounded case spending', () => {
  const advisor = scienceOfficer({ ...snapshot, model: '<img src=x onerror=alert(1)>',
    budgets: { daily_used_usd: NaN, case_limit_usd: -1 } }, false, now);
  const html = renderScienceOfficer([advisor]);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Border retains decision authority'));
  assert.ok(html.includes('unknown / unknown'));
  assert.ok(html.includes('not proof'));
  assert.equal(renderScienceOfficer([]), '');
});
