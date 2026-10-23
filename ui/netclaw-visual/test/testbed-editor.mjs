import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { prepareTestbedEdit, testbedRevision } from '../testbed-editor.js';
import { TopologyLogin } from '../topology-login.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-inventory-test-'));
const file = path.join(root, 'testbed.yaml');
const source = `# Operator comments must survive.
testbed:
  credentials: &creds
    default: { username: test, password: fixture-only }
devices:
  'R1':
    alias: 'Original name' # preserve this note
    os: ios
    credentials: *creds
    custom: { rack: 3, site: Atlanta }
    connections:
      cli:
        protocol: ssh
        host: 192.0.2.1
        port: 22
        ssh_options: { private_key: fixture-key }
      console: { protocol: telnet, ip: 192.0.2.10, port: 2001 }
  R2: { os: iosxe, connections: { ssh: { protocol: ssh, ip: 192.0.2.2 } } }
topology:
  note: untouched
`;
const device = { alias: 'Atlanta', type: 'router', os: 'ios', platform: 'iosv', connections: { ssh: { ip: '198.51.100.1', port: 2222 } } };
const args = () => ({ file, id: 'R1', revision: testbedRevision(fs.readFileSync(file, 'utf8')), device, connectionName: 'cli' });
try {
  fs.writeFileSync(file, source);
  const before = yaml.load(source);
  prepareTestbedEdit(args())();
  const editedSource = fs.readFileSync(file, 'utf8');
  const after = yaml.load(editedSource);
  assert.equal(after.devices.R1.alias, 'Atlanta');
  assert.equal(after.devices.R1.connections.cli.host, '198.51.100.1');
  assert.equal(after.devices.R1.connections.cli.port, 2222);
  for (const key of ['credentials', 'custom']) assert.deepEqual(after.devices.R1[key], before.devices.R1[key]);
  assert.deepEqual(after.devices.R1.connections.console, before.devices.R1.connections.console);
  assert.deepEqual(after.devices.R1.connections.cli.ssh_options, before.devices.R1.connections.cli.ssh_options);
  assert.deepEqual(after.devices.R2, before.devices.R2);
  assert.deepEqual(after.topology, before.topology);
  assert.match(editedSource, /# Operator comments must survive/);
  assert.match(editedSource, /# preserve this note/);
  const backups = fs.readdirSync(`${file}.backups`);
  assert.equal(fs.readFileSync(path.join(`${file}.backups`, backups[0]), 'utf8'), source);
  assert.throws(() => prepareTestbedEdit({ ...args(), revision: 'stale' }), /Reload/);
  const pending = prepareTestbedEdit(args());
  fs.appendFileSync(file, '# concurrent change\n');
  assert.throws(pending, /Reload/);
  prepareTestbedEdit({ ...args(), remove: true })();
  const removed = yaml.load(fs.readFileSync(file, 'utf8'));
  assert.equal(Object.hasOwn(removed.devices, 'R1'), false);
  assert.deepEqual(removed.devices.R2, before.devices.R2);
  assert.throws(() => prepareTestbedEdit(args()), /no longer exists/);

  // Editing an anchored object must never silently alter another device.
  fs.writeFileSync(file, 'devices:\n  R1: &shared\n    connections:\n      cli: { protocol: ssh, ip: 192.0.2.1 }\n  R2: *shared\n');
  assert.throws(() => prepareTestbedEdit(args()), /shared YAML/);
  assert.throws(() => prepareTestbedEdit({ ...args(), remove: true }), /shared YAML/);
  fs.writeFileSync(file, source.replace(/\n/g, '\r\n'));
  prepareTestbedEdit(args())();
  assert.equal(/(?<!\r)\n/.test(fs.readFileSync(file, 'utf8')), false);
  fs.writeFileSync(file, 'devices: { R1: { connections: { cli: { protocol: ssh, ip: 192.0.2.1 } } } }\n');
  prepareTestbedEdit({ ...args(), remove: true })();
  assert.deepEqual(yaml.load(fs.readFileSync(file, 'utf8')).devices, {});
  const login = new TopologyLogin({});
  let cancelled = false;
  login.pending.set('R1', () => { cancelled = true; });
  login.credentials.set('R1', { credentials: { password: 'fixture-only' } });
  login.credentials.set('R2', {});
  login.challenges.set('one', { id: 'R1' });
  login.challenges.set('two', { id: 'R2' });
  login.forget('R1');
  assert.equal(cancelled, true);
  assert.equal(login.credentials.has('R1'), false);
  assert.equal(login.credentials.has('R2'), true);
  assert.equal(login.challenges.has('one'), false);
  assert.equal(login.challenges.has('two'), true);
  console.log('Testbed editor: preservation, backup, stale writes, aliases, CRLF and removal passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
