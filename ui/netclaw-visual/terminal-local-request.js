import { createLocalAccess } from './src/security/local-access.js';

function normalizeHost(value) {
  let host = String(value || '').trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.endsWith('.')) host = host.slice(0, -1);
  const zoneIndex = host.indexOf('%');
  if (zoneIndex >= 0) host = host.slice(0, zoneIndex);
  if (host.startsWith('::ffff:')) host = host.slice(7);
  return host;
}

export function isLoopbackHost(value) {
  const host = normalizeHost(value);
  if (host === 'localhost' || host === '::1') return true;
  const octets = host.split('.');
  return octets.length === 4
    && octets[0] === '127'
    && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

export function isLocalTerminalOrigin(origin) {
  try {
    return isLoopbackHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function isLocalTerminalHostHeader(hostHeader) {
  try {
    return isLoopbackHost(new URL(`http://${hostHeader}`).hostname);
  } catch {
    return false;
  }
}

export function isLocalTerminalRequest(request) {
  // The UI proxy stays local and preserves the configured LAN Host/Origin.
  // Use the same strict policy as the API when interface access is opted in.
  if (process.env.HUD_HOST) return createLocalAccess()(request);
  const remoteAddress = request?.socket?.remoteAddress;
  if (!isLoopbackHost(remoteAddress)) return false;

  const origin = String(request?.headers?.origin || '').trim();
  if (origin) return isLocalTerminalOrigin(origin);

  // Browsers normally send Origin on a WebSocket handshake, but a local dev
  // proxy may omit it. Fail closed unless both the transport and Host header
  // independently identify the loopback-only NetClaw service.
  return isLocalTerminalHostHeader(request?.headers?.host);
}
