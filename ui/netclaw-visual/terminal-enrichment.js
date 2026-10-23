import net from 'node:net';
import { promises as dns } from 'node:dns';

const DEFAULT_SUCCESS_TTL_MS = 5 * 60 * 1000;
const DEFAULT_FAILURE_TTL_MS = 60 * 1000;

function normalizedIp(value) {
  return typeof value === 'string' && net.isIP(value.trim()) ? value.trim() : null;
}

function normalizedNetwork(type, value) {
  if (type === 'ip') return normalizedIp(value);
  if (type !== 'prefix' || typeof value !== 'string') return null;
  const [address, length] = value.trim().split('/');
  const version = net.isIP(address);
  const prefix = Number(length);
  return version && Number.isInteger(prefix) && prefix >= 0 && prefix <= (version === 4 ? 32 : 128) ? `${address}/${prefix}` : null;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('DNS lookup timed out.')), timeoutMs)),
  ]);
}

// Providers deliberately return normalized data instead of terminal-specific UI
// shapes. Additional sources (IPAM, inventory, topology) can join this manager
// without the xterm renderer knowing where a field came from.
export class DnsPtrEnrichmentProvider {
  constructor({ resolver = dns, timeoutMs = 1500 } = {}) {
    this.id = 'dns-ptr';
    this.resolver = resolver;
    this.timeoutMs = timeoutMs;
  }

  supports(object) {
    return object?.type === 'ip' && Boolean(normalizedIp(object.value));
  }

  async enrich(object) {
    const address = normalizedIp(object.value);
    if (!address) return null;
    const names = await withTimeout(this.resolver.reverse(address), this.timeoutMs);
    const hostname = Array.isArray(names) ? names.find((name) => typeof name === 'string' && name.trim())?.trim() : null;
    return hostname ? { provider: this.id, hostname, fqdn: hostname } : null;
  }
}

// Local aliases are intentionally a provider too: they can enrich host IPs or
// route prefixes when DNS, NetBox, or ServiceNow do not have a matching record.
export class LocalAliasEnrichmentProvider {
  constructor({ aliases = {} } = {}) { this.id = 'local-alias'; this.aliases = aliases; }
  supports(object) { return Boolean(normalizedNetwork(object?.type, object?.value)); }
  setAliases(aliases) { this.aliases = aliases && typeof aliases === 'object' ? aliases : {}; }
  async enrich(object) {
    const value = normalizedNetwork(object.type, object.value);
    const alias = this.aliases[value];
    return typeof alias === 'string' && alias.trim() ? { provider: this.id, alias: alias.trim(), source: 'local' } : null;
  }
}

export class TerminalEnrichmentManager {
  constructor({ providers = [new DnsPtrEnrichmentProvider(), new LocalAliasEnrichmentProvider()], now = () => Date.now(), successTtlMs = DEFAULT_SUCCESS_TTL_MS, failureTtlMs = DEFAULT_FAILURE_TTL_MS } = {}) {
    this.providers = providers;
    this.now = now;
    this.successTtlMs = successTtlMs;
    this.failureTtlMs = failureTtlMs;
    this.cache = new Map();
  }

  async enrich(objects) {
    const unique = [...new Map((Array.isArray(objects) ? objects : [])
      .map((object) => ({ type: object?.type, value: normalizedNetwork(object?.type, object?.value) }))
      .filter((object) => (object.type === 'ip' || object.type === 'prefix') && object.value)
      .map((object) => [`${object.type}:${object.value}`, object])).values()];
    return Promise.all(unique.map((object) => this.enrichObject(object)));
  }

  async enrichObject(object) {
    const key = `${object.type}:${object.value}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.result;

    const providers = {};
    let resolved = false;
    await Promise.all(this.providers.filter((provider) => provider.supports(object)).map(async (provider) => {
      try {
        const data = await provider.enrich(object);
        if (data) {
          providers[provider.id] = { status: 'resolved', ...data };
          resolved = true;
        }
      } catch {
        // Resolution failure is intentionally silent to the terminal surface.
        providers[provider.id] = { status: 'unresolved' };
      }
    }));

    const result = { type: object.type, value: object.value, resolved, providers };
    this.cache.set(key, {
      result,
      expiresAt: this.now() + (resolved ? this.successTtlMs : this.failureTtlMs),
    });
    return result;
  }
}

export function normalizeTerminalEnrichmentObjects(value, maxObjects = 48) {
  const seen = new Set();
  const objects = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const type = raw?.type;
    const address = normalizedNetwork(type, raw?.value);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    objects.push({ type, value: address });
    if (objects.length >= maxObjects) break;
  }
  return objects;
}
