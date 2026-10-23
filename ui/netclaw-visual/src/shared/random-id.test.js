import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { randomId } from './random-id.js';

test('uses native UUID when available', () => {
  assert.equal(randomId({ randomUUID: () => 'native-uuid' }), 'native-uuid');
});
test('HTTP context without randomUUID produces random UUIDv4 identifiers', () => {
  const httpCrypto = { getRandomValues: bytes => webcrypto.getRandomValues(bytes) };
  const ids = Array.from({ length: 100 }, () => randomId(httpCrypto));
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(new Set(ids).size, ids.length);
});
