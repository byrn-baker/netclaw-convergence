import fs from 'node:fs';
import path from 'node:path';
import { writePrivateAtomic } from '../security/private-files.js';
import { readBounded } from './bindings.js';
import { PalError } from './pal-provider.js';

// A lock file has no automatic expiry: a crash cannot silently free budget.
export class PalStore {
  constructor(directory) { this.directory = directory; this.file = path.join(directory,'ledger.json'); }
  ensure() {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.mode & 0o077) throw new PalError('Private Pal storage required.', 503);
  }
  read() {
    this.ensure();
    if (!fs.existsSync(this.file)) return { version: 1, consumed: 0, sessions: {}, confirmation: null };
    try {
      const state = JSON.parse(readBounded(this.file));
      if (state.version !== 1 || !Number.isSafeInteger(state.consumed) || state.consumed < 0 || !state.sessions || typeof state.sessions !== 'object') throw Error();
      return state;
    } catch { throw new PalError('Pal ledger unavailable. Do not reset it to regain allowance.', 503); }
  }
  update(fn) {
    this.ensure(); const lock = path.join(this.directory,'ledger.lock'); let fd;
    try { fd = fs.openSync(lock,'wx',0o600); } catch { throw new PalError('Pal ledger is locked; reconcile any interrupted operation before retrying.'); }
    try {
      const state = this.read(); const result = fn(state);
      if (result?.then) throw Error('Ledger transactions must be synchronous');
      writePrivateAtomic(this.file, JSON.stringify(state));
      return result;
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
}
