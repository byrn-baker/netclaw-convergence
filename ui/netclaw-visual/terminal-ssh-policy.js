export const LEGACY_GROUP14_SHA1 = 'diffie-hellman-group14-sha1';

export function isKeyExchangeMismatch(error) {
  return /no matching key exchange algorithm/i.test(String(error?.message || ''));
}

export function sshAlgorithmsForRequest({ legacySshCompatibility = false } = {}) {
  if (legacySshCompatibility !== true) return undefined;
  return {
    kex: {
      append: [LEGACY_GROUP14_SHA1],
    },
  };
}

export function applySshAlgorithmPolicy(clientConfig, options = {}) {
  const algorithms = sshAlgorithmsForRequest(options);
  if (algorithms) clientConfig.algorithms = algorithms;
  return clientConfig;
}

export function keyExchangeFailureDetails(error, { legacySshCompatibility = false } = {}) {
  if (!isKeyExchangeMismatch(error)) return null;
  if (legacySshCompatibility === true) {
    return {
      code: 'KEX_MISMATCH',
      legacyRetryAvailable: false,
      message: 'Legacy SSH compatibility (DH group14/SHA-1) is already enabled, but no approved key exchange overlaps. Modernize the device SSH configuration; weaker group1/SHA-1 is not supported.',
    };
  }
  return {
    code: 'KEX_MISMATCH',
    legacyRetryAvailable: true,
    message: 'No modern SSH key exchange overlaps. For a trusted legacy device, retry with Legacy KEX (DH group14/SHA-1).',
  };
}
