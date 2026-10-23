import assert from 'node:assert/strict';
import { terminalCredentialOverride } from '../terminal-credentials.js';

assert.equal(terminalCredentialOverride({}), null);
assert.deepEqual(
  terminalCredentialOverride({
    credentials: {
      username: '  local-operator  ',
      password: 'correct horse battery staple',
    },
  }),
  {
    username: 'local-operator',
    password: 'correct horse battery staple',
  },
);

assert.throws(
  () => terminalCredentialOverride({ credentials: { username: '', password: 'secret' } }),
  /username and password are required/i,
);
assert.throws(
  () => terminalCredentialOverride({ credentials: { username: 'operator', password: '' } }),
  /username and password are required/i,
);
assert.throws(
  () => terminalCredentialOverride({ credentials: { username: 'bad\nname', password: 'secret' } }),
  /username contains unsupported/i,
);
assert.throws(
  () => terminalCredentialOverride({ credentials: { username: 'operator', password: `bad\0secret` } }),
  /password contains unsupported/i,
);

console.log('Terminal credential override tests passed.');
