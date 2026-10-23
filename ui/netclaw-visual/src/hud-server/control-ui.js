// Allowlisted navigation metadata only. Never project auth, gateway URLs or tokens.
export function controlUiLocation(config) {
  const gateway = config?.gateway;
  if (!gateway || typeof gateway !== 'object' || Array.isArray(gateway)) return { available: false, reason: 'Gateway configuration unavailable.' };
  if (gateway.controlUi?.enabled === false) return { available: false, reason: 'OpenClaw Control UI is disabled in gateway configuration.' };
  const port = gateway.port ?? 18789;
  const value = gateway.controlUi?.basePath ?? '';
  if (!Number.isInteger(port) || port < 1 || port > 65535 || typeof value !== 'string' || value.length > 200) return { available: false, reason: 'Gateway UI location is invalid.' };
  // Strict path segments: no authority, query, fragment, escape, dot traversal or backslash.
  const basePath = value === '' || value === '/' ? '' : '/' + value.replace(/^\//, '').replace(/\/$/, '');
  if (basePath && !/^\/(?:[A-Za-z0-9_-]+)(?:\/[A-Za-z0-9_-]+)*$/.test(basePath)) return { available: false, reason: 'Gateway UI path is unsupported; open it through OpenClaw.' };
  return { available: true, port, basePath, tls: gateway.tls?.enabled === true };
}
export function controlUiHref(location) {
  if (location?.available !== true || typeof location.tls !== 'boolean') return null;
  const safe = controlUiLocation({ gateway: { port: location.port, controlUi: { basePath: location.basePath }, tls: { enabled: location.tls } } });
  if (!safe.available || safe.port !== location.port || safe.basePath !== location.basePath) return null;
  return `${safe.tls ? 'https' : 'http'}://127.0.0.1:${safe.port}${safe.basePath}/`;
}
