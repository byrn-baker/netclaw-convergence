import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { createIntentExecutionService, parseExecutionReport, buildExecutionMessages, registerIntentExecutionRoutes } from '../terminal-intent-execution.js';

const gateway = () => ({ port: 18789, token: 'test-only-token', chatCompletionsEnabled: true });
const devices = () => [{ id: 'SAV', alias: 'Example Edge', os: 'iosxe', password: 'never-forward-me' }, { id: 'CHA', alias: 'Example Core' }];
const input = () => ({ id: crypto.randomUUID(), request: 'Create a VPN tunnel between Example Edge and Example Core.', deviceId: 'SAV', history: [], transcript: 'SAV#' });
const complete = { status: 'completed', requestKind: 'change', outcome: 'changed', summary: 'Synthetic tunnel established.', actions: [
  { device: 'SAV', kind: 'configuration', summary: 'Applied endpoint configuration with approved change.' },
  { device: 'CHA', kind: 'configuration', summary: 'Applied peer configuration with approved change.' },
], verification: [{ device: 'SAV', summary: 'Synthetic tunnel reports up.' }, { device: 'CHA', summary: 'Synthetic peer reports up.' }] };
const response = report => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(report) } }] }) });
async function settled(service, id) {
  for (let i = 0; i < 100; i++) {
    const job = service.get(id);
    if (job.status !== 'running') return job;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('Mock execution did not settle');
}
const messages = buildExecutionMessages(input(), devices());
assert.match(messages[0].content, /Continue after read-only prechecks/);
assert.match(messages[0].content, /not a bypass of required ServiceNow approvals/);
assert.match(messages.at(-1).content, /Example Edge and Example Core/);
assert.ok(!JSON.stringify(messages).includes('never-forward-me'));
assert.equal(parseExecutionReport('not JSON').status, 'uncertain');
assert.equal(parseExecutionReport(JSON.stringify({ ...complete, actions: [], verification: [] })).status, 'in_progress');
assert.equal(parseExecutionReport(JSON.stringify({ ...complete, verification: [complete.verification[0]] })).status, 'in_progress', 'each reported changed device needs its own post-check');
assert.equal(parseExecutionReport(JSON.stringify({ ...complete, outcome: 'already_satisfied', actions: [] })).status, 'completed');

let calls = [];
const service = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: devices, fetchImpl: async (url, options) => {
  calls.push(JSON.parse(options.body));
  assert.equal(options.headers['x-openclaw-agent-id'], 'main');
  assert.equal(url, 'http://127.0.0.1:18789/v1/chat/completions');
  return response(calls.length === 1 ? { status: 'in_progress', requestKind: 'change', outcome: 'pending', summary: 'Read-only prechecks collected. Configuration remains.', actions: [{ device: 'SAV', kind: 'read-only', summary: 'Read interface state.' }] } : complete);
} });
const request = input();
service.start(request);
service.start(request);
assert.throws(() => service.start({ ...request, request: 'Different goal' }), /different request/);
assert.throws(() => service.start(input()), /still running/);
const done = await settled(service, request.id);
assert.equal(calls.length, 2, 'prechecks automatically continue; duplicate submission does not execute twice');
assert.equal(done.status, 'completed');
assert.equal(done.steps.length, 2);
assert.equal(calls[0].user, calls[1].user, 'continuation keeps the same gateway agent session');
assert.match(calls[0].user, /^netclaw-terminal-intent:/);
assert.match(calls[1].messages.at(-1).content, /Continue the SAME/);
assert.ok(!JSON.stringify(done).includes('test-only-token'));
assert.ok(!JSON.stringify(done).includes('requestHash'));
service.start(request);
assert.equal(calls.length, 2, 'completed request IDs never re-execute');

for (const status of ['needs_input', 'blocked']) {
  let count = 0;
  const blocked = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: devices, fetchImpl: async () => {
    count++; return response({ status, summary: status === 'blocked' ? 'Required change approval unavailable.' : 'Need a VPN policy decision.', question: 'Which approved policy applies?' });
  } });
  const req = input(); blocked.start(req);
  assert.equal((await settled(blocked, req.id)).status, status);
  assert.equal(count, 1, 'never automatically bypass questions or approvals');
  const followup = { ...input(), request: 'Use the existing approved policy.', continueFrom: req.id };
  const followupJob = blocked.start(followup);
  assert.equal(followupJob.sessionId, blocked.get(req.id).sessionId, 'operator answer resumes the same gateway session');
  await settled(blocked, followup.id);
  assert.throws(() => blocked.start({ ...input(), continueFrom: crypto.randomUUID() }), /prior execution/);
}
const noGateway = createIntentExecutionService({ getGatewayConfig: () => ({ chatCompletionsEnabled: false }), listDevices: devices });
assert.throws(() => noGateway.start(input()), /No work was submitted/);
let failureCalls = 0;
const failure = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: devices, fetchImpl: async () => { failureCalls++; throw new Error('timeout'); } });
const failedRequest = input(); failure.start(failedRequest);
assert.equal((await settled(failure, failedRequest.id)).status, 'uncertain');
assert.equal(failureCalls, 1, 'ambiguous transport failures are never retried');
const bounded = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: devices, maxSegments: 2, fetchImpl: async () => response({ ...complete, actions: [], verification: [] }) });
const boundedRequest = input(); bounded.start(boundedRequest);
assert.equal((await settled(bounded, boundedRequest.id)).status, 'incomplete');

const app = express(); app.use(express.json());
let httpCalls = 0;
registerIntentExecutionRoutes(app, { getGatewayConfig: gateway, listDevices: devices, fetchImpl: async () => { httpCalls++; return response(complete); } });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}/api/terminal/intent/runs`;
  const post = (body, origin = 'http://localhost:3000', type = 'application/json') => fetch(base, { method: 'POST', headers: { Origin: origin, 'Content-Type': type }, body: JSON.stringify(body) });
  assert.equal((await post(input(), 'https://attacker.example')).status, 403);
  assert.equal((await post(input(), 'http://localhost:3000', 'text/plain')).status, 415);
  assert.equal((await post({})).status, 400);
  assert.equal(httpCalls, 0);
  const req = input(); const started = await post(req); assert.equal(started.status, 202);
  const result = await (await fetch(`${base}/${req.id}`)).json();
  assert.equal(result.status, 'completed');
  assert.equal(httpCalls, 1);
  assert.equal((await fetch(`${base}/${crypto.randomUUID()}`)).status, 404);
} finally { await new Promise(resolve => server.close(resolve)); }
console.log('Intent execution: precheck continuation, scoped tool-agent contract, idempotency, blockers, unknown outcomes, completion evidence, limits and localhost API guards passed. No live gateway/devices contacted.');
