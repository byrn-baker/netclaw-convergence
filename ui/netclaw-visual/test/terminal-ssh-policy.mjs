import assert from 'node:assert/strict';
import {
  LEGACY_GROUP14_SHA1,
  applySshAlgorithmPolicy,
  isKeyExchangeMismatch,
  keyExchangeFailureDetails,
  sshAlgorithmsForRequest,
} from '../terminal-ssh-policy.js';

assert.equal(sshAlgorithmsForRequest(), undefined);
assert.equal(sshAlgorithmsForRequest({ legacySshCompatibility: 'true' }), undefined);

const legacyAlgorithms = sshAlgorithmsForRequest({ legacySshCompatibility: true });
assert.deepEqual(legacyAlgorithms, {
  kex: {
    append: [LEGACY_GROUP14_SHA1],
  },
});
assert.equal(JSON.stringify(legacyAlgorithms).includes('diffie-hellman-group1-sha1'), false);
assert.equal(JSON.stringify(legacyAlgorithms).includes('diffie-hellman-group-exchange-sha1'), false);

const modernConfig = { host: '192.0.2.1' };
assert.equal(applySshAlgorithmPolicy(modernConfig), modernConfig);
assert.equal(Object.hasOwn(modernConfig, 'algorithms'), false);

const legacyConfig = { host: '192.0.2.2' };
assert.equal(
  applySshAlgorithmPolicy(legacyConfig, { legacySshCompatibility: true }),
  legacyConfig,
);
assert.deepEqual(legacyConfig.algorithms, legacyAlgorithms);

const mismatch = new Error('Handshake failed: no matching key exchange algorithm');
assert.equal(isKeyExchangeMismatch(mismatch), true);
assert.deepEqual(keyExchangeFailureDetails(mismatch), {
  code: 'KEX_MISMATCH',
  legacyRetryAvailable: true,
  message: 'No modern SSH key exchange overlaps. For a trusted legacy device, retry with Legacy KEX (DH group14/SHA-1).',
});
assert.match(
  keyExchangeFailureDetails(mismatch, { legacySshCompatibility: true }).message,
  /already enabled[\s\S]*group1\/SHA-1 is not supported/,
);
assert.equal(keyExchangeFailureDetails(new Error('Authentication failed')), null);

console.log('Terminal SSH algorithm policy tests passed.');
