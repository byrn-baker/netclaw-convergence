import assert from 'node:assert/strict';
import {
  isLocalTerminalHostHeader,
  isLocalTerminalOrigin,
  isLocalTerminalRequest,
  isLoopbackHost,
} from '../terminal-local-request.js';

assert.equal(isLoopbackHost('localhost'), true);
assert.equal(isLoopbackHost('localhost.'), true);
assert.equal(isLoopbackHost('127.0.0.1'), true);
assert.equal(isLoopbackHost('127.42.5.9'), true);
assert.equal(isLoopbackHost('::1'), true);
assert.equal(isLoopbackHost('[::1]'), true);
assert.equal(isLoopbackHost('::ffff:127.0.0.1'), true);
assert.equal(isLoopbackHost('203.0.113.240'), false);

assert.equal(isLocalTerminalOrigin('http://localhost:3000'), true);
assert.equal(isLocalTerminalOrigin('http://127.0.0.1:3000'), true);
assert.equal(isLocalTerminalOrigin('http://[::1]:3000'), true);
assert.equal(isLocalTerminalOrigin('https://example.com'), false);
assert.equal(isLocalTerminalOrigin('null'), false);

assert.equal(isLocalTerminalHostHeader('localhost:3001'), true);
assert.equal(isLocalTerminalHostHeader('[::1]:3001'), true);
assert.equal(isLocalTerminalHostHeader('203.0.113.251:3001'), false);

const request = (origin, host, remoteAddress) => ({
  headers: {
    ...(origin == null ? {} : { origin }),
    ...(host == null ? {} : { host }),
  },
  socket: { remoteAddress },
});

assert.equal(
  isLocalTerminalRequest(request('http://localhost:3000', 'localhost:3001', '::1')),
  true,
);
assert.equal(
  isLocalTerminalRequest(request(undefined, 'localhost:3001', '::ffff:127.0.0.1')),
  true,
  'A loopback Vite proxy may omit Origin but must preserve a localhost Host header.',
);
assert.equal(
  isLocalTerminalRequest(request('https://example.com', 'localhost:3001', '::1')),
  false,
  'A hostile Origin must remain blocked even when it targets the loopback service.',
);
assert.equal(
  isLocalTerminalRequest(request(undefined, '203.0.113.251:3001', '::1')),
  false,
  'An origin-less request using a LAN Host header must remain blocked.',
);
assert.equal(
  isLocalTerminalRequest(request('http://localhost:3000', 'localhost:3001', '203.0.113.7')),
  false,
  'A remote transport cannot opt into terminal access by spoofing Origin.',
);

console.log('Terminal localhost request policy tests passed.');
