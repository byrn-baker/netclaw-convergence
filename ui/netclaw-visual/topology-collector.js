import { applySshAlgorithmPolicy } from './terminal-ssh-policy.js';
import { cleanIosOutput, isIosCommandError } from './topology-routes.js';
import { commandsForTopologyScopes } from './topology-scope.js';

export const TOPOLOGY_COMMANDS = Object.freeze(['terminal length 0', 'show ip route', 'show ip route vrf *']);

// Dedicated SSH session: never inject background commands into the user's PTY.
// Callers cannot supply commands, hosts, or credentials via the collection API.
export function collectIosTopology({ Client, profile, fingerprint, fingerprintOf, legacy = false, signal, scopes = ['routes'] }) {
  const scopedCommands = commandsForTopologyScopes(scopes);
  return new Promise((resolve, reject) => {
    const client = new Client();
    let stream;
    let done = false;
    let buffer = '';
    let index = -1;
    let prompt = null;
    let commandTimer;
    let hostRejected = false;
    let totalBytes = 0;
    const detectPlatform = String(profile.os).toLowerCase() === 'unknown';
    const commands = detectPlatform ? ['show version', ...scopedCommands.filter(command => command !== 'show version')] : scopedCommands;
    const results = {};
    const collectedAt = {};
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(commandTimer);
      signal?.removeEventListener('abort', abort);
      try { stream?.close(); client.destroy(); } catch {}
      if (error) reject(error); else resolve({ global: results['show ip route'], vrfs: results['show ip route vrf *'], outputs: results, collectedAt });
    };
    const abort = () => finish(Object.assign(new Error('Collection stopped.'), { code: 'ABORTED' }));
    const timeout = () => {
      clearTimeout(commandTimer);
      commandTimer = setTimeout(() => finish(new Error('SSH collection timed out.')), 20000);
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    client.on('error', error => {
      const blocked = hostRejected || error.level === 'client-authentication' || /authentication/i.test(error.message);
      finish(Object.assign(new Error(hostRejected ? 'SSH host key is untrusted or changed. Verify it in the terminal, then authorize again.'
        : blocked ? 'SSH authentication failed. Check saved testbed credentials, then authorize again.'
          : /no matching key exchange/i.test(error.message) ? 'No compatible SSH key exchange. Authorize legacy KEX only for a trusted legacy device.'
            : 'SSH collection failed. Check device reachability and SSH service.'), { code: blocked ? 'BLOCKED' : 'SSH_ERROR' }));
    });
    client.on('close', () => { if (!done) finish(new Error('SSH session closed before collection completed.')); });
    client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, answer) => answer(prompts.map(() => profile.password || '')));
    client.on('ready', () => {
      client.shell({ term: 'vt100', cols: 240, rows: 24 }, (error, channel) => {
        if (error) { finish(new Error('Unable to open a collection shell.')); return; }
        if (done) { channel.close(); return; }
        stream = channel;
        timeout();
        stream.on('error', () => finish(new Error('Collection shell failed.')));
        stream.on('data', chunk => {
          if (done) return;
          buffer += chunk.toString('utf8');
          totalBytes += chunk.length;
          if (totalBytes > 16 * 1024 * 1024) { finish(new Error('Collection cycle exceeded 16 MiB.')); return; }
          if (buffer.length > 8 * 1024 * 1024) { finish(new Error('Collection output exceeded 8 MiB.')); return; }
          const clean = cleanIosOutput(buffer);
          // Initial platform detection may be paginated before we know whether
          // this is IOS. A space advances output; it is not a new CLI command.
          if (commands[index] === 'show version' && /--More--\s*$/.test(clean)) {
            buffer = buffer.replace(/--More--\s*$/, ''); stream.write(' '); return;
          }
          const match = clean.match(/(?:^|\n)([A-Za-z0-9_.:/-]+[>#])\s*$/);
          if (!match || (prompt && match[1] !== prompt)) return;
          prompt ||= match[1];
          if (index >= 0) {
            const command = commands[index];
            results[command] = clean;
            collectedAt[command] = Date.now();
            if (detectPlatform && command === 'show version' && !/Cisco IOS(?: XE)? Software|Cisco Internetwork Operating System Software/i.test(clean)) {
              finish(Object.assign(new Error('Platform detection did not identify Cisco IOS/IOS-XE. No routing commands were sent.'), { code: 'BLOCKED' })); return;
            }
            if (command === 'terminal length 0' && isIosCommandError(clean)) {
              finish(Object.assign(new Error('Read-only command denied or unsupported; check the device account privileges.'), { code: 'BLOCKED' }));
              return;
            }
          }
          index += 1;
          buffer = '';
          if (index === commands.length) { finish(); return; }
          timeout();
          stream.write(`${commands[index]}\n`);
        });
      });
    });
    const config = { host: profile.host, port: profile.port, username: profile.username,
      readyTimeout: 15000, keepaliveInterval: 10000, keepaliveCountMax: 2,
      tryKeyboard: Boolean(profile.password), hostVerifier: key => {
        const accepted = Boolean(fingerprint) && fingerprintOf(key) === fingerprint;
        hostRejected = !accepted;
        return accepted;
      } };
    for (const key of ['password', 'privateKey', 'passphrase', 'agent']) if (profile[key]) config[key] = profile[key];
    applySshAlgorithmPolicy(config, { legacySshCompatibility: legacy });
    timeout();
    try { client.connect(config); } catch { finish(new Error('Unable to start SSH collection.')); }
  });
}
