import net from 'node:net';
import { isLocalTerminalRequest, isLoopbackHost } from './terminal-local-request.js';

export const PROVIDERS = [
  { id: 'infoblox', name: 'Infoblox NIOS', available: true, description: 'IPv4 network allocations from one WAPI network view. Inventory is not proof of live device ownership.' },
  { id: 'thousandeyes', name: 'ThousandEyes', available: true, description: 'Latest network-test results for up to five existing tests. No tests are created or run.' },
  { id: 'kubernetes', name: 'Kubernetes', available: true, description: 'Pod IPs and placement from one namespace. Shared host-network IPs are labeled.' },
  { id: 'otel', name: 'OpenTelemetry export', available: true, description: 'OTLP/HTTP JSON health metrics only. No IPs, topology, transcripts, or credentials are exported.' },
  { id: 'vmware', name: 'VMware vCenter', available: false, description: 'Planned: guest identity and virtualization context. Not connected by this adapter yet.' },
  { id: 'extrahop', name: 'ExtraHop', available: false, description: 'Planned: observed device and flow context. Not connected by this adapter yet.' },
];
const LIMIT = 200;
const MAX_BYTES = 2_000_000;
const clean = value => String(value ?? '').slice(0, 300);
const envValue = value => String(value || '').trim().replace(/^(['"])(.*)\1$/, '$2');
class SafeError extends Error {}
function requireValue(condition, message) { if (!condition) throw new SafeError(message); }

export function validateEndpoint(value, id) {
  let url;
  try { url = new URL(value); } catch { throw new SafeError('Enter a complete HTTPS endpoint URL.'); }
  requireValue(!url.username && !url.password && !url.search && !url.hash, 'Endpoint must not contain credentials, query parameters, or fragments.');
  requireValue(url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname)), 'HTTPS is required except for a loopback development endpoint.');
  requireValue(value.length <= 1000, 'Endpoint URL is too long.');
  if (id === 'infoblox') requireValue(/\/wapi\/v\d+(?:\.\d+)*\/?$/.test(url.pathname), 'Use the NIOS WAPI base URL, for example https://grid/wapi/v2.13/.');
  if (id === 'otel') requireValue(url.pathname.endsWith('/v1/metrics'), 'Use the full OTLP/HTTP metrics endpoint ending in /v1/metrics (not the gRPC port).');
  if (id === 'kubernetes') requireValue(url.pathname === '/', 'Use the Kubernetes API origin without a path.');
  return url.href.replace(/\/$/, '');
}

export function validateConfig(id, body, env = {}) {
  requireValue(PROVIDERS.some(p => p.id === id && p.available), 'This provider adapter is not implemented yet.');
  requireValue(body?.authorized === true, 'Explicit authorization is required.');
  const source = body.useExisting === true;
  requireValue(!source || ['infoblox', 'thousandeyes'].includes(id), 'Existing environment settings are only supported for Infoblox and ThousandEyes.');
  const endpoint = source && id === 'infoblox' ? envValue(env.INFOBLOX_URL) : String(body.endpoint || '').trim();
  requireValue(['scope', 'context', 'username', 'accountId'].every(key => String(body[key] || '').length <= 300), 'A scope, context or username field exceeds the 300-character limit.');
  const config = {
    endpoint: validateEndpoint(endpoint || (id === 'thousandeyes' ? 'https://api.thousandeyes.com/v7' : ''), id),
    intervalSeconds: Number(body.intervalSeconds ?? 300),
    scope: clean(body.scope).trim(), context: clean(body.context).trim(),
    username: source ? envValue(env.INFOBLOX_USERNAME) : clean(body.username),
    secret: source ? envValue(id === 'infoblox' ? env.INFOBLOX_PASSWORD : env.TE_TOKEN) : String(body.secret || ''),
    useExisting: source,
  };
  requireValue(Number.isInteger(config.intervalSeconds) && config.intervalSeconds >= 60 && config.intervalSeconds <= 3600, 'Polling interval must be 60–3600 seconds.');
  requireValue(config.secret.length <= 8192 && !/[\r\n]/.test(config.secret), 'Credential is invalid or too long.');
  if (id !== 'otel') requireValue(Boolean(config.secret), 'Supply a read-only credential or configure the existing environment credential.');
  if (id === 'infoblox') requireValue(config.username && !config.username.includes(':') && config.scope, 'Provide a username and an explicit NIOS network view.');
  if (id === 'kubernetes') requireValue(/^[a-z0-9](?:[-a-z0-9]{0,61}[a-z0-9])?$/.test(config.scope), 'Specify one Kubernetes namespace.');
  if (id === 'thousandeyes') {
    requireValue(/^\d+(?:\s*,\s*\d+){0,4}$/.test(config.scope), 'Enter one to five existing numeric test IDs, separated by commas.');
    config.scope = [...new Set(config.scope.split(/\s*,\s*/))].join(',');
    config.accountId = clean(body.accountId).trim();
    requireValue(!config.accountId || /^\d+$/.test(config.accountId), 'Account group ID must be numeric.');
    // Never send the shared TE_TOKEN to a caller-supplied host.
    if (source) requireValue(config.endpoint === 'https://api.thousandeyes.com/v7', 'Existing TE_TOKEN can only be used with the official ThousandEyes API.');
  }
  return config;
}

export async function requestJson(url, { headers, signal, body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, { method: body ? 'POST' : 'GET', redirect: 'error', signal,
    headers: { Accept: 'application/json', ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new SafeError(response.status === 401 || response.status === 403 ? 'Authentication or read permission denied. Collection paused; update credentials and authorize again.'
      : `Provider returned HTTP ${response.status}. Check the endpoint, scope, permissions, or rate limit.`);
  }
  let bytes = 0; const chunks = [];
  if (response.body) {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      requireValue(bytes <= MAX_BYTES, 'Response exceeded the 2 MB safety limit. Narrow the provider scope.');
      chunks.push(chunk);
    }
  }
  try { return bytes ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
  catch { throw new SafeError('Provider did not return valid JSON. Check the API endpoint.'); }
}

function network(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('/'); const address = parts[0]; const family = net.isIP(address);
  const length = parts.length === 1 ? (family === 4 ? 32 : 128) : Number(parts[1]);
  if (!family || parts.length > 2 || (parts.length === 2 && !/^\d+$/.test(parts[1])) || !Number.isInteger(length) || length < 0 || length > (family === 4 ? 32 : 128)) return null;
  return { address, family, length };
}
function contains(a, b) {
  if (a.family !== b.family || a.length > b.length) return false;
  const block = new net.BlockList(); const type = a.family === 4 ? 'ipv4' : 'ipv6';
  block.addSubnet(a.address, a.length, type);
  return block.check(b.address, type);
}
export function matchAddress(query, record) {
  const a = network(query), b = network(record);
  if (!a || !b) return null;
  if (a.length === b.length && contains(a, b)) return 'Exact address / prefix';
  if (contains(a, b)) return 'Address or subnet inside selected network';
  if (contains(b, a)) return 'IPAM network containing selected address / subnet';
  return null;
}

// All adapters return a small evidence envelope; raw vendor payloads never reach the GUI.
export async function collectProvider(id, config, get) {
  const bearer = { Authorization: `Bearer ${config.secret}` };
  if (id === 'infoblox') {
    const params = new URLSearchParams({ network_view: config.scope, _return_fields: 'network,network_view,comment', _max_results: String(LIMIT), _paging: '1', _return_as_object: '1' });
    const data = await get(`${config.endpoint}/network?${params}`, { Authorization: `Basic ${Buffer.from(`${config.username}:${config.secret}`).toString('base64')}` });
    requireValue(Array.isArray(data.result), 'Unexpected NIOS WAPI response shape.');
    return { partial: Boolean(data.next_page_id) || data.result.length > LIMIT, records: data.result.slice(0, LIMIT).filter(r => network(r.network)).map(r => ({
      address: r.network, title: clean(r.comment || r.network), kind: 'IPAM allocation — not a live device',
      fields: { 'Network view': clean(r.network_view), 'Network': r.network },
    })) };
  }
  if (id === 'kubernetes') {
    const data = await get(`${config.endpoint}/api/v1/namespaces/${encodeURIComponent(config.scope)}/pods?limit=${LIMIT}`, bearer);
    requireValue(Array.isArray(data.items), 'Unexpected Kubernetes pod-list response shape.');
    return { partial: Boolean(data.metadata?.continue) || data.items.length > LIMIT, records: data.items.slice(0, LIMIT).flatMap(pod =>
      (Array.isArray(pod.status?.podIPs) ? pod.status.podIPs.slice(0, 8) : [{ ip: pod.status?.podIP }]).filter(ip => net.isIP(ip.ip || '')).map(ip => ({
        address: ip.ip, title: clean(pod.metadata?.name), kind: pod.spec?.hostNetwork ? 'Pod using a shared host-network IP' : 'Pod IP reported by Kubernetes',
        fields: { Namespace: clean(pod.metadata?.namespace), Node: clean(pod.spec?.nodeName), Phase: clean(pod.status?.phase) },
      }))) };
  }
  if (id === 'thousandeyes') {
    const records = []; let partial = false;
    for (const testId of config.scope.split(',')) {
      const data = await get(`${config.endpoint}/test-results/${testId}/network${config.accountId ? `?aid=${config.accountId}` : ''}`, bearer);
      requireValue(Array.isArray(data.results), 'Unexpected ThousandEyes network-results response shape.');
      partial ||= Boolean(data._links?.next) || data.results.length > LIMIT;
      for (const r of data.results.slice(0, LIMIT)) {
        if (!net.isIP(r.serverIp || '')) continue;
        const fields = { 'Test ID': testId, 'Reporting agent': clean(r.agent?.agentName || r.agent?.agentId), 'Measurement time': clean(r.date || (r.roundId ? new Date(r.roundId * 1000).toISOString() : 'Not provided')) };
        for (const [key, label] of [['avgLatency', 'Average RTT (ms)'], ['loss', 'Packet loss (%)'], ['jitter', 'Jitter (ms)']]) {
          if (Number.isFinite(r[key])) fields[label] = r[key];
        }
        records.push({ address: r.serverIp, title: clean(data.test?.testName || `Test ${testId}`), kind: 'Measured test target — not device ownership', fields });
      }
    }
    return { records, partial };
  }
  throw new SafeError('Provider does not support context collection.');
}

export function healthPayload(states, now = Date.now()) {
  const metrics = ['healthy', 'cached_records'].map(name => ({ name: `netclaw.integration.${name}`, unit: '1',
    gauge: { dataPoints: [...states.entries()].filter(([id]) => id !== 'otel').map(([id, state]) => ({
      timeUnixNano: String(BigInt(now) * 1_000_000n),
      asDouble: name === 'healthy' ? Number(['ready', 'collecting'].includes(state.status) && state.updatedAt !== null && !state.error && now - state.updatedAt < state.config.intervalSeconds * 2500) : state.records.length,
      attributes: [{ key: 'provider', value: { stringValue: id } }],
    })) } }));
  // A heartbeat exists even if no inventory adapters are enabled.
  metrics.push({ name: 'netclaw.observability.heartbeat', unit: '1', gauge: { dataPoints: [{ timeUnixNano: String(BigInt(now) * 1_000_000n), asDouble: 1 }] } });
  return { resourceMetrics: [{ resource: { attributes: [{ key: 'service.name', value: { stringValue: 'netclaw' } }] },
    scopeMetrics: [{ scope: { name: 'netclaw.observability', version: '1' }, metrics }] }] };
}

export class ObservabilityService {
  constructor({ fetchImpl = fetch, getEnv = () => process.env, now = () => Date.now(), schedule = true } = {}) {
    this.fetchImpl = fetchImpl; this.getEnv = getEnv; this.now = now; this.schedule = schedule; this.states = new Map();
  }
  status() {
    return { sessionOnly: true, providers: PROVIDERS.map(provider => {
      const state = this.states.get(provider.id);
      if (!state) return { ...provider, status: provider.available ? 'disabled' : 'planned', count: 0 };
      const { secret, username, ...publicConfig } = state.config;
      return { ...provider, config: publicConfig, status: state.status, error: state.error, updatedAt: state.updatedAt,
        nextAt: state.nextAt, count: state.records.length, partial: state.partial,
        stale: Boolean(state.updatedAt && this.now() - state.updatedAt >= state.config.intervalSeconds * 2500) };
    }) };
  }
  enable(id, body) {
    const config = validateConfig(id, body, this.getEnv());
    this.disable(id);
    this.states.set(id, { config, status: 'configured', records: [], partial: false, updatedAt: null, failures: 0 });
    // Enabling is explicit authorization for the first request and continuing polling.
    void this.poll(id);
    return this.status();
  }
  disable(id) {
    const old = this.states.get(id);
    clearTimeout(old?.timer); old?.controller?.abort();
    this.states.delete(id); // Drops cached records and credentials, including in-flight results.
  }
  close() { for (const id of this.states.keys()) this.disable(id); }
  async poll(id) {
    const state = this.states.get(id);
    if (!state || state.controller) return;
    clearTimeout(state.timer);
    state.controller = new AbortController(); state.status = 'collecting'; state.nextAt = null;
    const signal = AbortSignal.any([state.controller.signal, AbortSignal.timeout(30_000)]);
    const get = (url, headers) => requestJson(url, { headers, signal, fetchImpl: this.fetchImpl });
    try {
      let result;
      if (id === 'otel') {
        const data = await requestJson(state.config.endpoint, { signal, fetchImpl: this.fetchImpl,
          headers: state.config.secret ? { Authorization: `Bearer ${state.config.secret}` } : {}, body: healthPayload(this.states, this.now()) });
        requireValue(!Number(data.partialSuccess?.rejectedDataPoints) && !data.partialSuccess?.errorMessage, 'OTel collector reported partial acceptance. Check collector logs and pipeline configuration.');
        result = { records: [], partial: false };
      } else result = await collectProvider(id, state.config, get);
      if (this.states.get(id) !== state) return;
      Object.assign(state, result, { status: 'ready', error: null, updatedAt: this.now(), failures: 0 });
    } catch (error) {
      if (this.states.get(id) !== state) return;
      state.error = error instanceof SafeError ? error.message : 'Connection failed or timed out. Check reachability and trusted TLS certificates; credentials are not included in this error.';
      state.status = state.error.startsWith('Authentication') ? 'paused' : 'error'; state.failures++;
    } finally {
      state.controller = null;
      if (this.states.get(id) === state && this.schedule && state.status !== 'paused') {
        const delay = Math.min(3_600_000, state.config.intervalSeconds * 1000 * 2 ** Math.min(state.failures, 5));
        state.nextAt = this.now() + delay;
        state.timer = setTimeout(() => this.poll(id), delay + Math.floor(Math.random() * 1000)); state.timer.unref?.();
      }
    }
  }
  lookup(value) {
    requireValue(Boolean(network(value)), 'Supply a valid IP address or prefix.');
    const matches = []; let total = 0;
    for (const [id, state] of this.states) for (const record of state.records) {
      const match = matchAddress(value, record.address);
      if (!match) continue;
      total++;
      if (matches.length < 40) matches.push({ ...record, provider: id, match, context: state.config.context || 'No site / VRF mapping supplied',
        scope: state.config.scope, collectedAt: state.updatedAt, stale: state.status !== 'ready' || this.now() - state.updatedAt >= state.config.intervalSeconds * 2500 });
    }
    return { matches, total, truncated: total > matches.length,
      sources: this.status().providers.filter(p => p.available && p.id !== 'otel').map(({ id, name, status, count, partial, stale, updatedAt }) => ({ id, name, status, count, partial, stale, updatedAt })) };
  }
}

export function registerObservabilityRoutes(app, options = {}) {
  const service = new ObservabilityService(options);
  app.use('/api/observability', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!isLocalTerminalRequest(req)) return res.status(403).json({ error: 'Observability settings and context are restricted to a localhost browser.' });
    if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({ error: 'JSON is required.' });
    next();
  });
  app.get('/api/observability/status', (req, res) => res.json(service.status()));
  app.post('/api/observability/lookup', (req, res) => {
    try { res.json(service.lookup(req.body?.value)); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/observability/:id', (req, res) => {
    try {
      if (req.body?.enabled === false) { service.disable(req.params.id); return res.json(service.status()); }
      res.json(service.enable(req.params.id, req.body));
    } catch (e) { res.status(400).json({ error: e instanceof SafeError ? e.message : 'Invalid integration settings.' }); }
  });
  return service;
}
