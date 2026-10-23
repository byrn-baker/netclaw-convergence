import test from 'node:test';
import assert from 'node:assert/strict';
import { controlUiLocation, controlUiHref } from './control-ui.js';

test('native UI link uses validated gateway port, base path and TLS only', () => {
  assert.equal(controlUiHref(controlUiLocation({ gateway: {} })), 'http://127.0.0.1:18789/');
  const location = controlUiLocation({ gateway: { port: 19443, tls: { enabled: true }, controlUi: { basePath: '/ops/openclaw/' }, auth: { token: 'secret' }, url: 'https://private.example/?token=secret' } });
  assert.deepEqual(location, { available: true, port: 19443, basePath: '/ops/openclaw', tls: true });
  assert.equal(controlUiHref(location), 'https://127.0.0.1:19443/ops/openclaw/');
  assert.doesNotMatch(JSON.stringify(location), /secret|private/);
});
test('native UI never guesses a destination for missing, disabled or malformed metadata', () => {
  for (const config of [null, {}, { gateway: [] }, { gateway: { controlUi: { enabled: false } } }, { gateway: { port: '18789' } }, { gateway: { port: 0 } }, { gateway: { port: 65536 } }]) {
    assert.equal(controlUiLocation(config).available, false); assert.equal(controlUiHref(controlUiLocation(config)), null);
  }
  for (const basePath of ['//evil.example', '/a/../b', '/a?token=secret', '/a#token', '/%2f%2fevil', '/a\\b', 'https://evil.example', '/./', '/a//b']) {
    assert.equal(controlUiLocation({ gateway: { controlUi: { basePath } } }).available, false, basePath);
  }
  assert.equal(controlUiHref({ available: true, port: 18789, basePath: '', tls: 'true' }), null);
  assert.equal(controlUiHref({ available: true, port: 18789, basePath: '//evil.example', tls: false }), null);
});
