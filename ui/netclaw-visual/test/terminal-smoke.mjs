import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import ssh2 from 'ssh2';
import WebSocket from 'ws';

const { Server: SSHServer } = ssh2;
const visualRoot = path.resolve(import.meta.dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-terminal-'));
let apiProcess;
let sshServer;
let socket;
let hostileSocket;
let originlessSocket;
const sshClients = new Set();
const sshStreams = new Set();

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitFor(check, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  const closing = new Promise((resolve) => {
    if (!server?.listening) return resolve();
    server.close(() => resolve());
  });
  server.unref();
  return Promise.race([
    closing,
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}

try {
  const sshPort = await freePort();
  const apiPort = await freePort();
  const keyPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  sshServer = new SSHServer({ hostKeys: [keyPair.privateKey] }, (client) => {
    sshClients.add(client);
    client.on('close', () => sshClients.delete(client));
    client
      .on('authentication', (context) => {
        if (
          context.method === 'password'
          && context.username === 'tester'
          && context.password === 'smoke-pass'
        ) {
          context.accept();
        } else {
          context.reject();
        }
      })
      .on('ready', () => {
        client.on('session', (accept) => {
          const session = accept();
          session.on('pty', (acceptPty) => acceptPty?.());
          session.on('shell', (acceptShell) => {
            const stream = acceptShell();
            sshStreams.add(stream);
            stream.on('close', () => sshStreams.delete(stream));
            stream.write('\r\nMOCK-DEVICE ready\r\nMOCK# ');
            stream.on('data', (chunk) => {
              const input = chunk.toString('utf8');
              if (input.includes('show version')) {
                stream.write('\r\nVERSION OK\r\nMOCK# ');
              }
            });
          });
        });
      });
  });
  await listen(sshServer, sshPort);

  const testbedFile = path.join(tempRoot, 'testbed.yaml');
  const knownHostsFile = path.join(tempRoot, 'known-hosts.json');
  fs.writeFileSync(testbedFile, [
    'testbed:',
    '  credentials:',
    '    default:',
    '      username: tester',
    '      password: deliberately-wrong-default',
    'devices:',
    '  MOCK:',
    '    alias: Mock Device',
    '    os: iosxe',
    '    platform: virtual',
    '    connections:',
    '      ssh:',
    '        protocol: ssh',
    '        ip: 127.0.0.1',
    `        port: ${sshPort}`,
    '',
    '# This unrelated top-level structure must stay in place.',
    'metadata:',
    '  owner: terminal-smoke',
    '',
  ].join('\n'));

  let serverOutput = '';
  apiProcess = spawn(process.execPath, ['server.js'], {
    cwd: visualRoot,
    env: {
      ...process.env,
      HUD_PORT: String(apiPort),
      NETCLAW_TESTBED_FILE: testbedFile,
      NETCLAW_TERMINAL_KNOWN_HOSTS_FILE: knownHostsFile,
      NETCLAW_TOPOLOGY_FILE: path.join(tempRoot, 'topology-authorization.json'),
      OPENCLAW_HOME: path.join(tempRoot, 'openclaw'),
      OPENAI_API_KEY: '',
      NETCLAW_TERRA_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  apiProcess.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  apiProcess.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`);
      return response.ok;
    } catch {
      if (apiProcess.exitCode != null) {
        throw new Error(`NetClaw API exited early:\n${serverOutput}`);
      }
      return false;
    }
  });

  const profilesResponse = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/devices`);
  assert.equal(profilesResponse.status, 200);
  const profiles = await profilesResponse.json();
  assert.equal(profiles.devices.length, 1);
  assert.equal(profiles.devices[0].id, 'MOCK');
  assert.equal(profiles.devices[0].supported, true);
  assert.equal(JSON.stringify(profiles).includes('smoke-pass'), false);

  const terraStatus = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/terra/status`, {
    headers: { Origin: 'http://localhost:3000' },
  });
  assert.equal(terraStatus.status, 200);
  assert.deepEqual(await terraStatus.json(), { configured: false, model: 'chat-latest' });

  const unconfiguredTerra = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/terra`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain show version.' }] }),
  });
  assert.equal(unconfiguredTerra.status, 503);
  assert.match((await unconfiguredTerra.json()).error, /Set up Instant Assist/);

  const remoteTerra = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/terra`, {
    method: 'POST',
    headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain show version.' }] }),
  });
  assert.equal(remoteTerra.status, 403);

  const saveTerraKey = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/terra/config`, {
    method: 'PUT',
    headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: 'sk-test-terra-key' }),
  });
  assert.equal(saveTerraKey.status, 204);
  const terraKeyFile = path.join(tempRoot, 'openclaw', '.env');
  assert.equal(fs.readFileSync(terraKeyFile, 'utf8').includes('NETCLAW_TERRA_API_KEY=sk-test-terra-key'), true);
  assert.equal((await fetch(`http://127.0.0.1:${apiPort}/api/terminal/terra/status`, {
    headers: { Origin: 'http://localhost:3000' },
  }).then((response) => response.json())).configured, true);

  const sourceBeforeAppend = fs.readFileSync(testbedFile, 'utf8');
  const addProfileResponse = await fetch(
    `http://127.0.0.1:${apiPort}/api/terminal/devices`,
    {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'EDGE-02',
        alias: 'Edge Router 02',
        host: '192.0.2.22',
        port: 2222,
        type: 'router',
        os: 'iosxe',
        platform: 'c8000v',
      }),
    },
  );
  assert.equal(addProfileResponse.status, 201);
  const addedProfile = await addProfileResponse.json();
  assert.equal(addedProfile.device.id, 'EDGE-02');
  assert.equal(addedProfile.device.host, '192.0.2.22');
  assert.equal(JSON.stringify(addedProfile).includes('smoke-pass'), false);

  const sourceAfterAppend = fs.readFileSync(testbedFile, 'utf8');
  assert.ok(sourceAfterAppend.includes([
    'testbed:',
    '  credentials:',
    '    default:',
    '      username: tester',
    '      password: deliberately-wrong-default',
  ].join('\n')));
  assert.ok(sourceAfterAppend.includes([
    '# This unrelated top-level structure must stay in place.',
    'metadata:',
    '  owner: terminal-smoke',
  ].join('\n')));
  assert.ok(sourceAfterAppend.indexOf('  EDGE-02:') < sourceAfterAppend.indexOf('metadata:'));
  const preservedPrefix = sourceBeforeAppend.slice(
    0,
    sourceBeforeAppend.indexOf('# This unrelated top-level structure'),
  ).trimEnd();
  assert.equal(sourceAfterAppend.startsWith(preservedPrefix), true);

  const profilesAfterAppend = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/devices`)
    .then((response) => response.json());
  assert.deepEqual(profilesAfterAppend.devices.map((device) => device.id), ['MOCK', 'EDGE-02']);

  const deviceApi = `http://127.0.0.1:${apiPort}/api/terminal/devices/EDGE-02`;
  const editBody = { ...addedProfile.device, host: '192.0.2.23', alias: 'Edited Edge', type: 'router' };
  const mutate = (method, body, origin = 'http://localhost:3000') => fetch(deviceApi, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await mutate('PUT', editBody, 'https://example.com')).status, 403);
  assert.equal((await mutate('PUT', { ...editBody, revision: 'stale' })).status, 409);
  assert.equal((await mutate('PUT', { ...editBody, id: 'RENAMED' })).status, 400);
  assert.equal((await mutate('PUT', { ...editBody, port: -1 })).status, 400);
  const updatedResponse = await mutate('PUT', editBody);
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json();
  assert.equal(updated.device.host, '192.0.2.23');
  assert.equal(updated.device.alias, 'Edited Edge');
  assert.equal(updated.device.type, 'router');
  assert.equal(JSON.stringify(updated).includes('deliberately-wrong-default'), false);
  assert.equal((await mutate('DELETE', { revision: updated.device.revision })).status, 400);
  assert.equal((await mutate('DELETE', { revision: updated.device.revision, confirmDevice: 'EDGE-02' }, 'https://example.com')).status, 403);
  const removedResponse = await mutate('DELETE', { revision: updated.device.revision, confirmDevice: 'EDGE-02' });
  assert.equal(removedResponse.status, 200);
  assert.deepEqual((await removedResponse.json()).devices.map(d => d.id), ['MOCK']);
  assert.equal(fs.readdirSync(`${testbedFile}.backups`).length, 2);
  assert.equal((await mutate('DELETE', { revision: updated.device.revision, confirmDevice: 'EDGE-02' })).status, 404);

  const duplicateSource = fs.readFileSync(testbedFile, 'utf8');
  const duplicateResponse = await fetch(
    `http://127.0.0.1:${apiPort}/api/terminal/devices`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'MOCK', host: '192.0.2.99', port: 22 }),
    },
  );
  assert.equal(duplicateResponse.status, 409);
  assert.equal(fs.readFileSync(testbedFile, 'utf8'), duplicateSource);

  const invalidPortResponse = await fetch(
    `http://127.0.0.1:${apiPort}/api/terminal/devices`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'INVALID-PORT', host: '192.0.2.99', port: '22oops' }),
    },
  );
  assert.equal(invalidPortResponse.status, 400);
  assert.equal(fs.readFileSync(testbedFile, 'utf8'), duplicateSource);

  const crossOriginProfiles = await fetch(
    `http://127.0.0.1:${apiPort}/api/terminal/devices`,
    { headers: { Origin: 'https://example.com' } },
  );
  assert.equal(crossOriginProfiles.status, 403);

  const crossOriginAdd = await fetch(
    `http://127.0.0.1:${apiPort}/api/terminal/devices`,
    {
      method: 'POST',
      headers: {
        Origin: 'https://example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: 'BLOCKED', host: '192.0.2.100' }),
    },
  );
  assert.equal(crossOriginAdd.status, 403);

  hostileSocket = new WebSocket(`ws://127.0.0.1:${apiPort}/ws`, {
    origin: 'https://example.com',
  });
  await new Promise((resolve, reject) => {
    hostileSocket.once('open', () => reject(new Error('Hostile WebSocket must be rejected before opening')));
    hostileSocket.once('error', error => {
      try { assert.match(error.message, /403/); resolve(); } catch (failure) { reject(failure); }
    });
  });
  hostileSocket.terminate();
  hostileSocket = null;

  const originlessInbox = [];
  originlessSocket = new WebSocket(`ws://127.0.0.1:${apiPort}/ws`);
  originlessSocket.on('message', (raw) => {
    originlessInbox.push(JSON.parse(raw.toString('utf8')));
  });
  await new Promise((resolve, reject) => {
    originlessSocket.once('open', resolve);
    originlessSocket.once('error', reject);
  });
  originlessSocket.send(JSON.stringify({
    type: 'terminal:connect',
    payload: { device: 'MISSING', cols: 80, rows: 24 },
  }));
  const originlessStatus = await waitFor(() => originlessInbox.find((message) => (
    message.type === 'terminal:status'
    && message.payload.status === 'error'
  )));
  assert.doesNotMatch(originlessStatus.payload.message, /localhost browser/i);
  assert.match(originlessStatus.payload.message, /not present in testbed/i);
  originlessSocket.terminate();
  originlessSocket = null;

  const inbox = [];
  let terminalOutput = '';
  socket = new WebSocket(`ws://127.0.0.1:${apiPort}/ws`, {
    origin: 'http://localhost:3000',
  });
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString('utf8'));
    inbox.push(message);
    if (message.type === 'terminal:data') {
      terminalOutput += Buffer.from(message.payload.data, 'base64').toString('utf8');
    }
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  socket.send(JSON.stringify({
    type: 'terminal:connect',
    payload: {
      device: 'MOCK',
      cols: 100,
      rows: 32,
      credentials: {
        username: 'tester',
        password: 'smoke-pass',
      },
    },
  }));
  const hostKeyMessage = await waitFor(() => inbox.find((message) => (
    message.type === 'terminal:status'
    && message.payload.status === 'host-key'
  )));
  assert.match(hostKeyMessage.payload.fingerprint, /^SHA256:/);

  socket.send(JSON.stringify({
    type: 'terminal:hostkey-response',
    payload: { accept: true },
  }));
  await waitFor(() => inbox.find((message) => (
    message.type === 'terminal:status'
    && message.payload.status === 'connected'
  )));
  await waitFor(() => terminalOutput.includes('MOCK-DEVICE ready'));

  for (const method of ['PUT', 'DELETE']) {
    const blockedEdit = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/devices/MOCK`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'MOCK', confirmDevice: 'MOCK' }),
    });
    assert.equal(blockedEdit.status, 409, 'active PTY must be disconnected before inventory mutation');
    assert.match((await blockedEdit.json()).error, /Disconnect/);
  }

  socket.send(JSON.stringify({
    type: 'terminal:resize',
    payload: { cols: 120, rows: 40 },
  }));
  socket.send(JSON.stringify({
    type: 'terminal:input',
    payload: { data: 'show version\r' },
  }));
  await waitFor(() => terminalOutput.includes('VERSION OK'));
  assert.equal(fs.existsSync(knownHostsFile), true);
  assert.equal(JSON.stringify(inbox).includes('smoke-pass'), false);

  const resetHostKey = await fetch(`http://127.0.0.1:${apiPort}/api/terminal/devices/MOCK/host-key`, {
    method: 'DELETE',
    headers: { Origin: 'http://localhost:3000' },
  });
  assert.equal(resetHostKey.status, 200);
  assert.equal((await resetHostKey.json()).removed, true);
  assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(knownHostsFile, 'utf8'))).includes('127.0.0.1'), false);

  socket.send(JSON.stringify({ type: 'terminal:disconnect', payload: {} }));
  await waitFor(() => inbox.find((message) => (
    message.type === 'terminal:status'
    && message.payload.status === 'disconnected'
  )));

  console.log('Terminal smoke test passed: add/edit/remove profiles, stale-write and active-session guards, backups, host-key trust, PTY, resize, input, and output.');
} finally {
  try { hostileSocket?.terminate(); } catch {}
  try { originlessSocket?.terminate(); } catch {}
  try { socket?.terminate(); } catch {}
  if (apiProcess && apiProcess.exitCode == null) {
    apiProcess.kill();
    await Promise.race([
      new Promise((resolve) => apiProcess.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    if (apiProcess.exitCode == null) apiProcess.kill('SIGKILL');
  }
  apiProcess?.stdout?.destroy();
  apiProcess?.stderr?.destroy();
  apiProcess?.unref();
  for (const stream of sshStreams) {
    try { stream.close(); } catch {}
  }
  for (const client of sshClients) {
    try { client.end(); } catch {}
    try { client._sock?.destroy(); } catch {}
  }
  await closeServer(sshServer);
  const resolvedTemp = path.resolve(tempRoot);
  if (resolvedTemp.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }
}

// Windows can retain an ssh2 native socket handle briefly after the mock server
// closes. All assertions and cleanup have completed at this point.
process.exit(0);
