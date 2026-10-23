import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { activityText, transcriptActivity, createTranscriptActivityReader } from '../terminal-intent-live.js';
import { createIntentExecutionService } from '../terminal-intent-execution.js';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-intent-live-test-'));
const startedAt = new Date(Date.now() - 1000).toISOString();
const sessionKey = `agent:main:netclaw-terminal-intent:${crypto.randomUUID()}`;
const sessionId = crypto.randomUUID();
const file = path.join(directory, `${sessionId}.jsonl`);
const manifest = path.join(directory, 'sessions.json');
const record = (role, content, extra = {}) => ({ type: 'message', id: crypto.randomUUID(), timestamp: new Date().toISOString(), message: { role, content, ...extra } });
const call = () => record('assistant', [{ type: 'thinking', thinking: 'Never expose private reasoning.' }, { type: 'toolCall', id: 'call-1', name: 'pyats_run_command', arguments: { device: 'DEMO-R1', command: 'show ip interface brief', password: 'DO-NOT-EXPOSE', environment: 'HIDDEN-ENV' } }]);
const result = () => record('toolResult', [{ type: 'text', text: 'GigabitEthernet0/1 192.0.2.1 up up' }], { toolName: 'pyats_run_command', toolCallId: 'call-1' });
const append = entry => fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
try {
  fs.writeFileSync(manifest, JSON.stringify({ [sessionKey]: { sessionId }, unrelated: { sessionId: crypto.randomUUID() } }));
  fs.writeFileSync(file, '');
  append(call()); // Previous continuation's bytes must never reappear.
  const reader = createTranscriptActivityReader({ directory, sessionKey, startedAt });
  assert.deepEqual(reader.poll().events, []);
  append(call());
  const first = reader.poll();
  assert.equal(first.status, 'connected'); assert.equal(first.events.length, 1);
  assert.match(first.events[0].detail, /show ip interface brief/);
  assert.doesNotMatch(JSON.stringify(first), /DO-NOT-EXPOSE|HIDDEN-ENV|private reasoning/);
  assert.equal(reader.poll().events.length, 0, 'no duplicate events');
  const partial = JSON.stringify(result());
  fs.appendFileSync(file, partial.slice(0, 40));
  assert.equal(reader.poll().events.length, 0);
  fs.appendFileSync(file, `${partial.slice(40)}\n`);
  assert.equal(reader.poll().events[0].kind, 'tool-result');
  append(record('user', 'PRIVATE USER PROMPT'));
  append(record('assistant', [{ type: 'thinking', thinking: 'PRIVATE REASONING' }, { type: 'text', text: 'Not a tool event' }]));
  assert.equal(reader.poll().events.length, 0);
  const error = record('toolResult', [{ type: 'text', text: 'Connection refused' }], { isError: true });
  assert.equal(transcriptActivity(error)[0].kind, 'tool-error');
  const privateOutput = record('toolResult', [{ type: 'text', text: '{"password":\n"hidden-value"}' }]);
  assert.doesNotMatch(JSON.stringify(transcriptActivity(privateOutput)), /hidden-value/);
  for (const secret of ['username admin password 0 cisco', 'Authorization: Bearer abc', '-----BEGIN RSA PRIVATE KEY-----\nabc', 'crypto isakmp key hello', 'secret: hidden']) {
    assert.match(activityText(secret), /withheld/);
  }
  assert.match(activityText('a'.repeat(6000)), /truncated/);
  // Exact key miss does not select unrelated activity.
  assert.equal(createTranscriptActivityReader({ directory, sessionKey: 'absent', startedAt }).poll().status, 'waiting');
  fs.writeFileSync(manifest, JSON.stringify({ [sessionKey]: { sessionId, sessionFile: '../outside.jsonl' } }));
  assert.equal(reader.poll().status, 'unavailable');
  fs.writeFileSync(manifest, JSON.stringify({ [sessionKey]: { sessionId } }));
  // Truncation/rotation only admits new timestamped records.
  fs.writeFileSync(file, JSON.stringify({ ...call(), timestamp: '2000-01-01T00:00:00Z' }) + '\n');
  assert.equal(reader.poll().events.length, 0);
  append(result()); assert.equal(reader.poll().events.length, 1);
  fs.appendFileSync(file, 'x'.repeat(800000) + '\n');
  for (let i = 0; i < 5; i++) assert.equal(reader.poll().events.length, 0);
  append(result()); assert.equal(reader.poll().events.length, 1, 'recovers after oversized line');

  let finish, eventDelivered = false;
  const service = createIntentExecutionService({
    getGatewayConfig: () => ({ port: 1, token: 'not-exposed', chatCompletionsEnabled: true }), listDevices: () => [], activityIntervalMs: 5,
    createActivityReader: ({ sessionKey: key }) => {
      assert.match(key, /^agent:main:netclaw-terminal-intent:/);
      return { poll: () => ({ status: 'connected', events: eventDelivered ? [] : (eventDelivered = true, transcriptActivity(call())) }) };
    },
    fetchImpl: async (url, options) => {
      assert.match(options.headers['x-openclaw-session-key'], /^agent:main:netclaw-terminal-intent:/);
      return new Promise(resolve => { finish = () => resolve({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ status: 'completed', requestKind: 'read-only', outcome: 'answered', summary: 'Synthetic read finished.' }) } }] }) }); });
    },
  });
  const id = crypto.randomUUID(); service.start({ id, request: 'Check interface state' });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(service.get(id).status, 'running');
  assert.ok(service.get(id).activity.some(e => e.kind === 'tool-start'), 'tool events visible while Gateway HTTP response is still pending');
  finish(); await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(service.get(id).status, 'completed');
  assert.ok(service.get(id).activity.some(e => e.kind === 'report'));
  const unavailable = createIntentExecutionService({ getGatewayConfig: () => ({ port: 1, chatCompletionsEnabled: true }), listDevices: () => [],
    createActivityReader: () => { throw new Error('no files'); }, fetchImpl: async () => { throw new Error('uncertain transport'); } });
  const failed = crypto.randomUUID(); unavailable.start({ id: failed, request: 'Check state' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(unavailable.get(failed).status, 'uncertain');
  assert.equal(unavailable.get(failed).activityStatus, 'unavailable');
  console.log('Intent live activity tests passed: isolation, partial writes, bounds, secret filtering, real-time updates, graceful fallback. No network/device calls.');
} finally {
  fs.rmSync(directory, { recursive: true, force: true }); // Only this test's mkdtemp fixture.
}
