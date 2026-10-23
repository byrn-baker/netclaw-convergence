import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalTerminalRequest } from '../../terminal-local-request.js';

test('terminal guard accepts configured UI proxy but rejects direct/hostile clients', () => {
  const old = process.env.HUD_HOST;
  process.env.HUD_HOST = '192.0.2.10';
  try {
    const req = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { host: '192.0.2.10:3000', origin: 'http://192.0.2.10:3000' },
    };
    assert.equal(isLocalTerminalRequest(req), true);
    assert.equal(isLocalTerminalRequest({ ...req, socket: { remoteAddress: '192.0.2.20' } }), false);
    assert.equal(isLocalTerminalRequest({ ...req, headers: { ...req.headers, origin: 'http://evil.example' } }), false);
    assert.equal(isLocalTerminalRequest({ ...req, headers: { ...req.headers, host: 'evil.example' } }), false);
  } finally {
    if (old === undefined) delete process.env.HUD_HOST;
    else process.env.HUD_HOST = old;
  }
});
