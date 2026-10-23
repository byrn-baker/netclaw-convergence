import assert from 'node:assert/strict';
import express from 'express';
import { ObservabilityService, validateConfig, validateEndpoint, matchAddress, healthPayload, requestJson, registerObservabilityRoutes } from '../observability.js';

const secret = 'SYNTHETIC-SECRET-NOT-A-REAL-CREDENTIAL';
const base = { authorized: true, secret, intervalSeconds: 300 };
const configs = {
  infoblox: { ...base, endpoint: 'https://ipam.example/wapi/v2.13/', username: 'demo', scope: 'demo-view', context: 'DEMO / CORP' },
  kubernetes: { ...base, endpoint: 'https://cluster.example', scope: 'demo' },
  thousandeyes: { ...base, endpoint: 'https://api.thousandeyes.com/v7', scope: '123,456', accountId: '789' },
  otel: { ...base, endpoint: 'http://localhost:4318/v1/metrics' },
};
for (const [id, config] of Object.entries(configs)) assert.ok(validateConfig(id, config));
for (const url of ['http://192.0.2.1', 'https://user:pass@host', 'file:///etc/passwd', 'https://host?secret=x', 'https://host/#x']) assert.throws(() => validateEndpoint(url, 'kubernetes'));
assert.throws(() => validateConfig('vmware', base));
assert.throws(() => validateConfig('kubernetes', { ...configs.kubernetes, authorized: false }));
assert.throws(() => validateConfig('kubernetes', { ...configs.kubernetes, scope: '../secrets' }));
assert.throws(() => validateConfig('thousandeyes', { ...configs.thousandeyes, scope: '1,2,3,4,5,6' }));
assert.throws(() => validateConfig('thousandeyes', { ...configs.thousandeyes, useExisting: true, endpoint: 'https://evil.example/v7' }, { TE_TOKEN: secret }));
assert.equal(validateConfig('infoblox', { ...configs.infoblox, useExisting: true }, { INFOBLOX_URL: 'https://grid.example/wapi/v2.12/', INFOBLOX_USERNAME: 'read', INFOBLOX_PASSWORD: secret }).endpoint, 'https://grid.example/wapi/v2.12');
assert.throws(() => validateConfig('otel', { ...configs.otel, endpoint: 'http://localhost:4317' }));
assert.throws(() => validateConfig('otel', { ...configs.otel, intervalSeconds: 15 }));
assert.equal(matchAddress('198.51.100.1', '198.51.100.0/24'), 'IPAM network containing selected address / subnet');
assert.equal(matchAddress('198.51.100.0/24', '198.51.100.2'), 'Address or subnet inside selected network');
assert.equal(matchAddress('2001:db8::/32', '2001:db8::1'), 'Address or subnet inside selected network');
assert.equal(matchAddress('2001:db8::1', '2001:0db8:0:0:0:0:0:1'), 'Exact address / prefix');
assert.equal(matchAddress('198.51.100.0/24', '203.0.113.1'), null);
assert.equal(matchAddress('198.51.100.0/24/0', '198.51.100.1'), null);

const calls = [];
let clock = 1000000;
let failure = false;
const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
const fetchImpl = async (url, options) => {
  calls.push({ url, options }); assert.equal(options.redirect, 'error');
  if (failure) return new Response('secret vendor diagnostic must not leak', { status: 403 });
  if (url.includes('/wapi/')) return json({ result: [{ network: '198.51.100.0/24', network_view: 'demo-view', comment: 'DEMO allocation' }], next_page_id: 'next' });
  if (url.includes('/pods?')) return json({ items: [{ metadata: { name: 'DEMO-POD', namespace: 'demo' }, spec: { nodeName: 'DEMO-NODE', hostNetwork: true }, status: { podIPs: [{ ip: '198.51.100.20' }], phase: 'Running' } }] });
  if (url.includes('/test-results/')) return json({ test: { testName: 'DEMO-TEST' }, results: [{ serverIp: '198.51.100.20', avgLatency: 8, loss: 0, jitter: 1, agent: { agentName: 'DEMO-AGENT' }, date: '2026-01-01T00:00:00Z' }] });
  if (url.endsWith('/v1/metrics')) return json({});
  throw new Error('Unexpected request');
};
const service = new ObservabilityService({ fetchImpl, now: () => clock, schedule: false });
assert.ok(service.status().providers.every(p => ['disabled', 'planned'].includes(p.status)));
assert.equal(calls.length, 0);
async function settled(id) {
  for (let i = 0; i < 30 && service.states.get(id)?.controller; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.states.get(id)?.controller, null);
}
for (const id of ['infoblox', 'kubernetes', 'thousandeyes']) { service.enable(id, configs[id]); await settled(id); }
assert.equal(service.states.get('infoblox').status, 'ready');
assert.equal(service.states.get('infoblox').partial, true);
assert.match(service.lookup('198.51.100.20').matches.find(r => r.provider === 'kubernetes').kind, /shared/);
assert.equal(service.lookup('198.51.100.20').matches.filter(r => r.provider === 'thousandeyes').length, 2);
assert.equal(service.lookup('198.51.100.20').matches.find(r => r.provider === 'thousandeyes').fields['Packet loss (%)'], 0);
assert.ok(calls.find(c => c.url.includes('network_view=demo-view')));
assert.ok(calls.find(c => c.url.includes('?aid=789')));
const beforeLookup = calls.length;
for (let i = 0; i < 100; i++) service.lookup('198.51.100.20');
assert.equal(calls.length, beforeLookup, 'Hover must never call providers');
assert.ok(!JSON.stringify(service.status()).includes(secret));
assert.ok(!JSON.stringify(service.lookup('198.51.100.20')).includes(secret));
clock += 800000;
assert.ok(service.lookup('198.51.100.20').matches.every(r => r.stale));
const payload = JSON.stringify(healthPayload(service.states, clock));
for (const privateData of [secret, '198.51.100', 'demo-view', 'DEMO-POD', 'DEMO-AGENT', 'cluster.example']) assert.ok(!payload.includes(privateData));
assert.ok(payload.includes('timeUnixNano'));
service.enable('otel', configs.otel); await settled('otel');
assert.equal(service.states.get('otel').status, 'ready');
assert.equal(calls.at(-1).options.method, 'POST');
failure = true;
await service.poll('kubernetes');
assert.equal(service.states.get('kubernetes').status, 'paused');
assert.ok(!service.states.get('kubernetes').error.includes('secret vendor'));
service.disable('kubernetes');
assert.ok(!service.lookup('198.51.100.20').matches.some(r => r.provider === 'kubernetes'));
service.close(); assert.equal(service.states.size, 0);

// Revocation during an outstanding request cannot resurrect the data or credential.
let resolveFetch;
const pending = new ObservabilityService({ schedule: false, fetchImpl: () => new Promise(resolve => { resolveFetch = resolve; }) });
pending.enable('kubernetes', configs.kubernetes); const previous = pending.states.get('kubernetes');
pending.disable('kubernetes');
assert.equal(previous.controller.signal.aborted, true);
resolveFetch(json({ items: [] })); await new Promise(resolve => setImmediate(resolve));
assert.equal(pending.states.size, 0);

const rejected = new ObservabilityService({ schedule: false, fetchImpl: async () => json({ partialSuccess: { rejectedDataPoints: '1' } }) });
rejected.enable('otel', configs.otel); await new Promise(resolve => setImmediate(resolve));
assert.equal(rejected.states.get('otel').status, 'error'); rejected.close();
await assert.rejects(requestJson('https://example', { fetchImpl: async () => new Response('x'.repeat(2000001)) }), /2 MB/);
await assert.rejects(requestJson('https://example', { fetchImpl: async () => new Response('not json') }), /valid JSON/);

// Check the real route middleware contract without opening a listening port.
const handlers = new Map(); let guard;
const routes = registerObservabilityRoutes({ use: (_path, fn) => { guard = fn; }, get: (path, fn) => handlers.set(`GET ${path}`, fn), post: (path, fn) => handlers.set(`POST ${path}`, fn) }, { fetchImpl, schedule: false });
const response = () => ({ code: 200, set() { return this; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
for (const [origin, address, expected] of [['https://evil.example', '127.0.0.1', 403], ['http://localhost:3000', '192.0.2.1', 403], ['http://localhost:3000', '127.0.0.1', 200]]) {
  const res = response(); let next = false;
  guard({ method: 'POST', headers: { origin }, socket: { remoteAddress: address }, is: () => true }, res, () => { next = true; });
  assert.equal(res.code, expected); assert.equal(next, expected === 200);
}
const res = response(); handlers.get('POST /api/observability/lookup')({ body: { value: 'bad' } }, res); assert.equal(res.code, 400);
routes.close();

// Exercise Express routing over loopback with mocked outbound transport.
const app = express(); app.use(express.json());
const apiService = registerObservabilityRoutes(app, { fetchImpl, schedule: false });
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
const endpoint = `http://127.0.0.1:${server.address().port}/api/observability`;
try {
  let r = await fetch(`${endpoint}/status`);
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await r.json()).providers.find(p => p.id === 'vmware').status, 'planned');
  r = await fetch(`${endpoint}/status`, { headers: { Origin: 'https://untrusted.example' } }); assert.equal(r.status, 403);
  r = await fetch(`${endpoint}/kubernetes`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }); assert.equal(r.status, 415);
  failure = false;
  r = await fetch(`${endpoint}/kubernetes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configs.kubernetes) }); assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(await r.json()).includes(secret));
  r = await fetch(`${endpoint}/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: '198.51.100.20' }) }); assert.equal(r.status, 200);
  assert.equal((await r.json()).matches[0].provider, 'kubernetes');
  r = await fetch(`${endpoint}/kubernetes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) }); assert.equal(r.status, 200);
  assert.equal(apiService.states.size, 0);
} finally { apiService.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
console.log('Observability validation, provider fixtures, caching, revocation, privacy, OTLP and route guards passed. No live providers were contacted.');
