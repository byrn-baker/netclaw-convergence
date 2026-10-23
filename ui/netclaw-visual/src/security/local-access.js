import { isIP } from 'node:net';

// Remote access is an explicit trusted-interface opt-in, not authentication.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function hudPorts(env = process.env) {
  const parse = (name, fallback) => {
    const text = env[name] ?? String(fallback);
    if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 65535) {
      throw new Error(`${name} must be a TCP port between 1 and 65535`);
    }
    return Number(text);
  };
  const api = parse('HUD_PORT', 3001);
  const ui = parse('HUD_UI_PORT', 3000);
  if (api === ui) throw new Error('HUD_PORT and HUD_UI_PORT must differ');
  return { api, ui };
}

export function hudHost(env = process.env) {
  const host = env.HUD_HOST ?? '127.0.0.1';
  if (!isIP(host) || ['0.0.0.0', '::'].includes(host)) {
    throw new Error('HUD_HOST must be a concrete interface IP (not a wildcard or hostname)');
  }
  return host;
}

export function createLocalAccess(ports = hudPorts(), {
  host = hudHost(), allowRemote = false,
} = {}) {
  const authorities = new Set([ports.api, ports.ui].flatMap(port =>
    ['127.0.0.1', 'localhost', '[::1]'].map(host => `${host}:${port}`)));
  const authority = `${isIP(host) === 6 ? '[' + host + ']' : host}:${ports.ui}`;
  authorities.add(authority);
  return req => {
    if (!LOOPBACK.has(req.socket?.remoteAddress) &&
        !(allowRemote && !LOOPBACK.has(host) && req.headers.host === authority)) return false;
    // Ignore proxy-supplied headers: an arbitrary Host must not bypass the
    // loopback boundary through DNS rebinding or a public development proxy.
    if (!authorities.has(req.headers.host)) return false;
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    const origin = req.headers.origin;
    if (origin !== undefined) {
      // Exact origin, not a suffix/substring or a permissively parsed URL.
      if (!['http://', 'https://'].some(scheme =>
        typeof origin === 'string' && origin.startsWith(scheme) &&
        authorities.has(origin.slice(scheme.length)))) return false;
    }
    return true;
  };
}

export function localAccessMiddleware(allowed) {
  return (req, res, next) => {
    if (allowed(req)) return next();
    res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'HUD access requires a configured interface and trusted origin.' }));
  };
}

// Vite proxies WebSocket upgrades outside its HTTP middleware stack.
export function guardHudServer(server, allowed) {
  server.middlewares.use(localAccessMiddleware(allowed));
  server.httpServer?.prependListener('upgrade', (req, socket) => {
    if (!allowed(req)) socket.destroy();
  });
}
