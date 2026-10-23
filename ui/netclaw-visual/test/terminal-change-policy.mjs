import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { createLocalChangePolicy } from '../terminal-change-policy.js';
import { createIntentExecutionService, parseExecutionReport, buildExecutionMessages, registerIntentExecutionRoutes } from '../terminal-intent-execution.js';

const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'netclaw-lab-policy-test-'));
let devices = [{ id: 'LAB-A', name: 'Example A', host: '192.0.2.1', port: 22, protocol: 'ssh', supported: true }, { id: 'LAB-B', name: 'Example B', host: '192.0.2.2', port: 22, protocol: 'ssh', supported: true }, { id: 'PROD', name: 'Production', host: '192.0.2.3', port: 22, protocol: 'ssh', supported: true }];
const policy = createLocalChangePolicy({ directory: dir, listDevices: () => devices });
const gateway = () => ({ port: 18789, token: 'synthetic-only', chatCompletionsEnabled: true });
const wrapped = report => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(report) } }] }) });
const prepared = { status: 'prepared', requestKind: 'change', outcome: 'pending', summary: 'Synthetic baseline and plan ready.', actions: [], baseline: ['LAB-A', 'LAB-B'].map(device => ({ device, summary: 'Synthetic precheck saved' })), rollback: ['LAB-A', 'LAB-B'].map(device => ({ device, summary: 'Synthetic inverse plan saved' })) };
const completed = { status: 'completed', requestKind: 'change', outcome: 'changed', summary: 'Synthetic changes verified.', actions: ['LAB-A', 'LAB-B'].map(device => ({ device, kind: 'configuration', summary: 'Synthetic change' })), verification: ['LAB-A', 'LAB-B'].map(device => ({ device, summary: 'Synthetic check passed' })) };
const request = () => ({ id: crypto.randomUUID(), request: 'Configure the requested lab tunnel on LAB-A and LAB-B.', changeMode: 'local-lab', targetDeviceIds: ['LAB-A', 'LAB-B'], policyRevision: policy.state().revision });
async function settled(service, id) { for (let i = 0; i < 100; i++) { if (service.get(id).status !== 'running') return service.get(id); await new Promise(r => setImmediate(r)); } throw new Error('Mock did not settle'); }
function artifacts(change) { for (const d of change.devices) { fs.writeFileSync(d.baselinePath, 'SYNTHETIC BASELINE ONLY'); fs.writeFileSync(d.rollbackPath, 'SYNTHETIC ROLLBACK ONLY'); } }
try {
  assert.equal(policy.state().enabled, false);
  assert.equal(policy.resolve({}).mode, 'production');
  assert.match(buildExecutionMessages({ request: 'test' }, [])[0].content, /PRODUCTION CHANGE CONTROL/);
  assert.throws(() => policy.resolve(request()), /not explicitly authorized/);
  assert.throws(() => policy.save({ enabled: true, deviceIds: ['LAB-A'], revision: 'initial' }), /Explicitly confirm/);
  const saved = policy.save({ enabled: true, confirmLab: true, deviceIds: ['LAB-A', 'LAB-B'], revision: 'initial' });
  assert.equal(saved.devices.length, 2);
  assert.throws(() => policy.resolve({ ...request(), targetDeviceIds: ['PROD'] }), /not explicitly authorized/);
  assert.throws(() => policy.resolve({ ...request(), policyRevision: 'old' }), /settings changed/);
  devices = devices.map(d => d.id === 'LAB-A' ? { ...d, host: '192.0.2.99' } : d);
  assert.equal(policy.state().devices[0].valid, false);
  assert.throws(() => policy.resolve(request()), /endpoint changed/);
  devices[0].host = '192.0.2.1';

  const blockedReport = { status: 'blocked', requestKind: 'change', summary: 'Approval/parameters missing.', outcome: 'pending' };
  assert.equal(parseExecutionReport(`I need a decision.\n\n\`\`\`json\n${JSON.stringify(blockedReport)}\n\`\`\``).status, 'blocked');
  assert.equal(parseExecutionReport(`Text\r\n\`\`\`json\r\n${JSON.stringify(blockedReport)}\r\n\`\`\`\r\n`).status, 'blocked');
  assert.equal(parseExecutionReport('text\n```json\n{}\n```\n```json\n{}\n```').status, 'uncertain');
  assert.equal(parseExecutionReport('null').status, 'uncertain');
  assert.equal(parseExecutionReport(JSON.stringify({ ...completed, verification: [] })).status, 'in_progress');

  let calls = 0, service;
  service = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: () => devices, changePolicy: policy, fetchImpl: async (url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.match(body.messages[0].content, /Do not require ServiceNow for this record/);
    if (calls === 1) {
      const record = policy.get(req.id);
      assert.equal(record.phase, 'prepare'); artifacts(record);
      return wrapped(prepared);
    }
    assert.match(body.messages.at(-1).content, /APPLY PHASE/);
    assert.equal(policy.get(req.id).phase, 'apply');
    return wrapped(completed);
  } });
  const req = request(); service.start(req);
  const done = await settled(service, req.id);
  assert.equal(calls, 2); assert.equal(done.status, 'completed');
  assert.equal(done.changeControl.phase, 'apply');
  assert.equal(policy.get(req.id).artifacts.length, 4);
  assert.equal(policy.get(req.id).status, 'completed');
  assert.match(fs.readFileSync(path.join(dir, 'records', req.id, 'events.jsonl'), 'utf8'), /baseline-and-rollback-recorded/);
  service.start(req); assert.equal(calls, 2, 'in-process idempotency');
  const afterRestart = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: () => devices, changePolicy: policy, fetchImpl: async () => { throw new Error('Must not dispatch'); } });
  assert.throws(() => afterRestart.start(req), /already exists on disk/, 'durable IDs cannot replay after API restart');

  let missingCalls = 0;
  const missing = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: () => devices, changePolicy: policy, fetchImpl: async () => { missingCalls++; return wrapped(prepared); } });
  const missingReq = request(); missing.start(missingReq);
  const missingDone = await settled(missing, missingReq.id);
  assert.equal(missingDone.status, 'blocked'); assert.equal(missingCalls, 1);
  assert.match(missingDone.report.summary, /baseline artifact/);

  const violation = createIntentExecutionService({ getGatewayConfig: gateway, listDevices: () => devices, changePolicy: policy, fetchImpl: async () => wrapped(completed) });
  const violationReq = request(); violation.start(violationReq);
  assert.equal((await settled(violation, violationReq.id)).status, 'uncertain', 'reported writes during preparation never count as success');
  const reportDir = path.join(dir, 'records', req.id);
  policy.record(done.changeControl, { summary: 'password: TEST-SECRET', actions: [], verification: [] }, 'blocked');
  assert.ok(!fs.readFileSync(path.join(reportDir, 'record.json'), 'utf8').includes('TEST-SECRET'));

  const app = express(); app.use(express.json());
  registerIntentExecutionRoutes(app, { getGatewayConfig: gateway, listDevices: () => devices, changePolicy: policy, fetchImpl: async () => wrapped(blockedReport) });
  const http = app.listen(0, '127.0.0.1'); await new Promise(r => http.once('listening', r));
  try {
    const base = `http://127.0.0.1:${http.address().port}/api/terminal/intent`;
    const post = (origin, type, body) => fetch(`${base}/change-policy`, { method: 'POST', headers: { Origin: origin, 'Content-Type': type }, body: JSON.stringify(body) });
    assert.equal((await post('https://attacker.example', 'application/json', {})).status, 403);
    assert.equal((await post('http://localhost:3000', 'text/plain', {})).status, 415);
    assert.equal((await fetch(`${base}/changes/${req.id}`)).status, 200);
    assert.equal((await fetch(`${base}/changes/${crypto.randomUUID()}`)).status, 404);
    assert.equal((await post('http://localhost:3000', 'application/json', { enabled: false, deviceIds: [], revision: saved.revision })).status, 200);
    assert.equal(policy.state().enabled, false);
    assert.throws(() => policy.resolve(request()), /not explicitly authorized/);
    assert.equal(policy.resolve({}).mode, 'production');
  } finally { await new Promise(r => http.close(r)); }
  fs.writeFileSync(path.join(dir, 'policy.json'), 'broken');
  assert.throws(() => policy.state(), /disabled until it is repaired/);
  console.log('Local/Lab policy tests passed: default production, explicit endpoint-bound grants, artifacts before apply, durable audit/idempotency, report parsing, scope violations, HTTP guards and corrupt-storage failure. No live Gateway/devices.');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
