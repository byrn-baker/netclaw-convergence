export function terminalCredentialOverride(payload) {
  const input = payload?.credentials;
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('SSH credentials must contain a username and password.');
  }

  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  if (!username || !password) {
    throw new Error('SSH username and password are required.');
  }
  if (username.length > 256 || /[\r\n\0]/.test(username)) {
    throw new Error('SSH username contains unsupported characters or is too long.');
  }
  if (password.length > 4096 || password.includes('\0')) {
    throw new Error('SSH password contains unsupported characters or is too long.');
  }

  return { username, password };
}
