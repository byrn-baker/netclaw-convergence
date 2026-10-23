function isValidIpv4(value) {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isValidIpv6(value) {
  if (!/^[0-9a-fA-F:]+$/.test(value) || value.includes(':::')) return false;
  const halves = value.split('::');
  if (halves.length > 2) return false;
  const groups = value.split(':').filter(Boolean);
  if (!groups.length || groups.some((group) => !/^[0-9a-fA-F]{1,4}$/.test(group))) return false;
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

export function detectTerminalEnrichmentObjects(line) {
  if (typeof line !== 'string' || !line) return [];
  const detected = [];
  // A token scan keeps indexes aligned with xterm columns for ASCII IP tokens.
  for (const match of line.matchAll(/[0-9a-fA-F:.]+/g)) {
    const value = match[0];
    const start = match.index ?? 0;
    const suffix = line.slice(start + value.length);
    const prefixMatch = suffix.match(/^\/(\d{1,3})(?!\d)/);
    const version = value.includes(':') ? (isValidIpv6(value) ? 6 : 0) : (isValidIpv4(value) ? 4 : 0);
    if (!version) continue;
    const prefixLength = prefixMatch ? Number(prefixMatch[1]) : null;
    const validPrefix = prefixLength !== null && prefixLength <= (version === 4 ? 32 : 128);
    if (validPrefix) {
      detected.push({ type: 'prefix', value: `${value}/${prefixLength}`, version, start, length: value.length + prefixMatch[0].length });
    } else {
      detected.push({ type: 'ip', value, version, start, length: value.length });
    }
  }
  return detected;
}
