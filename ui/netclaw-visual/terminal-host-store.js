// Local SSH host trust storage, separate from connection lifecycle and policy.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ssh2 from 'ssh2';
const { utils: sshUtils } = ssh2;

export function createTerminalHostStore({ file, readText }) {
  function writeKnownHosts(knownHosts) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(knownHosts, null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  function readTerminalKnownHosts() {
    try {
      const parsed = JSON.parse(readText(file));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {

    return {};
    }
  }

  function trustTerminalHost(profile, fingerprint, keyType) {
    const knownHosts = readTerminalKnownHosts();
    knownHosts[`${profile.host}:${profile.port}`] = {
      fingerprint,
      keyType,
      trustedAt: new Date().toISOString(),
    };
    writeKnownHosts(knownHosts);
  }

  function forgetTerminalHost(host, port) {
    const knownHosts = readTerminalKnownHosts();
    const key = `${host}:${port}`;
    if (!Object.prototype.hasOwnProperty.call(knownHosts, key)) return false;
    delete knownHosts[key];
    writeKnownHosts(knownHosts);
    return true;
  }

  return { readTerminalKnownHosts, trustTerminalHost, forgetTerminalHost };
}
function terminalHostFingerprint(key) {
  return `SHA256:${crypto
    .createHash('sha256')
    .update(key)
    .digest('base64')
    .replace(/=+$/, '')}`;
}

function terminalHostKeyType(key) {
  try {
    const parsed = sshUtils.parseKey(key);
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
    return candidate?.type || 'unknown';
  } catch {
    return 'unknown';
  }
}


export { terminalHostFingerprint, terminalHostKeyType };
