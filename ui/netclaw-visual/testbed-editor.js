import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parseDocument, isMap } from 'yaml';
import yaml from 'js-yaml';

export const testbedRevision = source => createHash('sha256').update(source).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// Prepare without side effects; revoke the selected device's grant before commit.
export function prepareTestbedEdit({ file, id, revision, device, connectionName, remove = false }) {
  const source = fs.readFileSync(file, 'utf8');
  if (!revision || revision !== testbedRevision(source)) fail('Testbed changed. Reload devices and try again.', 409);
  let before;
  try { before = yaml.load(source); }
  catch { fail('Testbed YAML is invalid. Repair it before editing devices.'); }
  if (!Object.hasOwn(before?.devices || {}, id)) fail('Device no longer exists. Reload devices.', 404);
  const expected = structuredClone(before);
  const doc = parseDocument(source, { merge: true });
  if (doc.errors.length) fail('Testbed YAML could not be edited safely. Use the YAML editor.');
  const devices = doc.get('devices', true);
  if (!isMap(devices)) fail('Devices must be an explicit YAML mapping to use this editor.');
  if (remove) {
    devices.delete(id);
    delete expected.devices[id];
  } else {
    // structuredClone preserves alias relationships. Detach this device in the
    // expected value so a shared anchor cannot make collateral edits look valid.
    expected.devices[id] = structuredClone(before.devices[id]);
    const target = devices.get(id, true);
    const connections = isMap(target) && target.get('connections', true);
    const connection = isMap(connections) && connections.get(connectionName, true);
    if (!isMap(target) || !isMap(connection)) fail('Aliased or inherited profiles require the YAML editor; no changes made.');
    const prior = expected.devices[id].connections[connectionName];
    if (String(prior.protocol || connectionName).toLowerCase() !== 'ssh') fail('Only SSH profiles can be edited here.');
    for (const field of ['alias', 'type', 'os', 'platform']) {
      target.set(field, device[field]);
      expected.devices[id][field] = device[field];
    }
    // Keep connection name, credentials, SSH options and other transports intact.
    const endpoint = device.connections.ssh;
    const hostField = Object.hasOwn(prior, 'ip') ? 'ip' : Object.hasOwn(prior, 'host') ? 'host' : 'ip';
    connection.set(hostField, endpoint.ip);
    prior[hostField] = endpoint.ip;
    // Avoid retaining a contradictory fallback hostname.
    if (Object.hasOwn(prior, 'ip') && Object.hasOwn(prior, 'host')) {
      connection.set('host', endpoint.ip);
      prior.host = endpoint.ip;
    }
    connection.set('port', endpoint.port);
    prior.port = endpoint.port;
  }
  let next;
  try {
    next = doc.toString({ lineWidth: 0 });
    if (source.includes('\r\n')) next = next.replace(/\n/g, '\r\n');
    if (!isDeepStrictEqual(yaml.load(next), expected)) fail('Shared YAML references would affect other data. Use the YAML editor.');
  } catch { fail('Cannot safely change this profile because of shared YAML references or unsupported YAML. No changes made.'); }
  return () => {
    if (fs.readFileSync(file, 'utf8') !== source) fail('Testbed changed. Reload devices and try again.', 409);
    const backupDir = `${file}.backups`;
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backup = path.join(backupDir, `${Date.now()}-${randomUUID()}.yaml`);
    fs.writeFileSync(backup, source, { flag: 'wx', mode: 0o600 });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, file);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  };
}
