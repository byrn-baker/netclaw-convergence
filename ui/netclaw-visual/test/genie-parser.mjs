import assert from 'node:assert/strict';
import { validateGenieInput, genieRuntime, runGenie, registerGenieRoutes } from '../genie-parser.js';
import { capturedGenieOutput, genieArtifact } from '../src/canvas-chat/genie-output.js';

const input = { os: 'iosxe', command: 'show ip interface brief', output: 'Interface IP-Address OK? Method Status Protocol\nGigabitEthernet1 192.0.2.1 YES manual up up' };
assert.deepEqual(validateGenieInput(input), input);
for (const command of ['show ip route | include 10', 'show version\nreload', 'configure terminal', '', 'show x > file']) {
  assert.throws(() => validateGenieInput({ ...input, command }));
}
assert.throws(() => validateGenieInput({ ...input, os: 'unknown' }));
assert.throws(() => validateGenieInput({ ...input, output: 'x'.repeat(500_001) }));
assert.throws(() => validateGenieInput({ ...input, output: ' ' }));
assert.equal(genieRuntime({ PYATS_PYTHON: '/existing/pyats/bin/python' }, 'linux').executable, '/existing/pyats/bin/python');
assert.equal(genieRuntime({ PYATS_PYTHON: '"C:\\pyats env\\python.exe"' }, 'win32').executable, 'C:\\pyats env\\python.exe');
assert.deepEqual(genieRuntime({ PYATS_PYTHON: '/existing/pyats/bin/python', PYATS_WSL_DISTRO: 'My-PyATS' }, 'win32').args.slice(0, 4), ['-d', 'My-PyATS', '--exec', '/existing/pyats/bin/python']);

const raw = `R1#show version\nold response\nR1#show ip interface brief\n${input.output}\nR1#`;
const captured = capturedGenieOutput(raw);
assert.equal(captured.command, input.command);
assert.equal(captured.output, input.output);
assert.equal(capturedGenieOutput(input.output).command, '');
assert.equal(capturedGenieOutput('R1#sh ip route\nsome output\nR1#').command, 'show ip route');
assert.equal(capturedGenieOutput('R1#show version\nold\nR1#show ip route\nR1#').output, '');

const data = { interface: { GigabitEthernet1: { ip_address: '192.0.2.1', status: 'up', protocol: 'up' } } };
const artifact = genieArtifact({ data, parser: 'Genie / pyATS', version: 'test', command: input.command, os: input.os }, 'DEMO-R1');
assert.deepEqual(JSON.parse(artifact.content), data);
assert.equal(artifact.validation.status, 'valid');
assert.equal(artifact.parser, 'Genie / pyATS');
assert.throws(() => genieArtifact({ data: 'text' }));

// Mock only the process boundary; verify no input becomes an executable argument.
const execute = (_file, args, options, done) => {
  assert.equal(args.includes(input.output), false);
  assert.equal(options.windowsHide, true);
  assert.ok(options.timeout <= 30_000);
  return { stdin: { on() {}, end(body) {
    assert.deepEqual(JSON.parse(body), input);
    done(null, JSON.stringify({ data, version: 'test' }));
  } } };
};
assert.deepEqual((await runGenie(input, { execute })).data, data);
for (const [stdout, code] of [['not json', 'parse_failed'], ['{"data":null}', 'parse_failed'], ['{"error":"runtime_missing"}', 'runtime_missing']]) {
  assert.equal((await runGenie(input, { execute: (_f, _a, _o, done) => {
    done(null, stdout); return {};
  } })).error, code);
}

let handler;
let calls = 0;
let answer = { data, parser: 'Genie / pyATS', version: 'test' };
registerGenieRoutes({ post(url, fn) { assert.equal(url, '/api/terminal/parse/genie'); handler = fn; } }, {
  parse: async () => { calls++; return answer; },
});
async function invoke(body = input, origin = 'http://localhost:3000', address = '127.0.0.1') {
  const result = { statusCode: 200, headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ body, headers: { origin, host: 'localhost:3001' }, socket: { remoteAddress: address } }, result);
  return result;
}
assert.equal((await invoke()).body.command, input.command);
assert.equal((await invoke()).headers['Cache-Control'], 'no-store');
assert.equal((await invoke(input, 'https://evil.example')).statusCode, 403);
assert.equal((await invoke(input, 'http://localhost', '192.0.2.9')).statusCode, 403);
assert.equal((await invoke({ ...input, output: '' })).statusCode, 400);
assert.equal(calls, 2);
answer = { error: 'unsupported_parser' };
assert.equal((await invoke()).statusCode, 422);
answer = { error: 'runtime_missing' };
assert.equal((await invoke()).statusCode, 503);
console.log('Genie adapter, validation, source extraction, artifact and endpoint checks passed (mock parser).');
