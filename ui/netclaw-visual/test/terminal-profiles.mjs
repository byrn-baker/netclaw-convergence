import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTerminalProfiles, validateTerminalProfileInput } from '../terminal-profiles.js';
import { createTerminalHostStore, terminalHostFingerprint } from '../terminal-host-store.js';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-profile-unit-'));
const file = path.join(temp, 'testbed.yaml');
const readText = filename => fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
let env = { SYNTHETIC_USER: 'first-user' };
const inventory = { testbed: { credentials: { default: { username: '%ENV{SYNTHETIC_USER}', password: 'fake-global-password' } } },
  devices: { DEMO: { credentials: { default: { password: 'fake-device-password' } },
    connections: { ssh: { ip: '192.0.2.10', protocol: 'ssh', credentials: { default: { password: 'fake-connection-password' } } } } } } };
const profiles = createTerminalProfiles({ parseTestbed: () => inventory, parseEnvFile: () => env,
  getTestbedFile: () => file, readText,
  pickDeviceConnection: device => device.connections?.ssh ? { name: 'ssh', connection: device.connections.ssh } : null });
try {
  let profile = profiles.getTerminalProfile('DEMO');
  assert.equal(profile.username, 'first-user');
  assert.equal(profile.password, 'fake-connection-password');
  env = { SYNTHETIC_USER: 'updated-user' };
  assert.equal(profiles.getTerminalProfile('DEMO').username, 'updated-user', 'env is not cached on startup');
  inventory.devices.DEMO.connections.ssh.ip = '192.0.2.11';
  assert.equal(profiles.listTerminalProfiles()[0].host, '192.0.2.11', 'inventory is read afresh');
  assert.ok(!('password' in profiles.listTerminalProfiles()[0]), 'public profiles contain no credentials');
  profile = profiles.getTerminalProfile('DEMO', { credentialOverride: { username: 'prompt-user', password: 'fake-prompt-password' } });
  assert.equal(profile.username, 'prompt-user');
  assert.equal(profile.password, 'fake-prompt-password');
  assert.equal(profile.agent, '');
  assert.equal(profile.privateKey, '');
  assert.throws(() => profiles.getTerminalProfile('missing'), /not present/);
  assert.throws(() => validateTerminalProfileInput({ id: 'demo', host: 'https://example.org' }), /Host/);
  assert.throws(() => validateTerminalProfileInput({ id: '../bad', host: '192.0.2.1' }), /Device ID/);
  assert.throws(() => validateTerminalProfileInput({ id: 'demo', host: '192.0.2.1', port: 65536 }), /port/);
  const hosts = createTerminalHostStore({ file: path.join(temp, 'hosts.json'), readText });
  hosts.trustTerminalHost({ host: '192.0.2.10', port: 22 }, 'SHA256:synthetic-one', 'ssh-rsa');
  hosts.trustTerminalHost({ host: '192.0.2.10', port: 2222 }, 'SHA256:synthetic-two', 'ssh-rsa');
  assert.equal(hosts.readTerminalKnownHosts()['192.0.2.10:22'].fingerprint, 'SHA256:synthetic-one');
  assert.equal(hosts.forgetTerminalHost('192.0.2.10', 22), true);
  assert.equal(hosts.forgetTerminalHost('192.0.2.10', 22), false);
  assert.equal(hosts.readTerminalKnownHosts()['192.0.2.10:2222'].fingerprint, 'SHA256:synthetic-two');
  assert.match(terminalHostFingerprint(Buffer.from('synthetic')), /^SHA256:[A-Za-z0-9+/]+$/);
  console.log('Extracted terminal services: live readers, credential precedence, validation and endpoint-scoped host trust passed. Synthetic data only.');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
