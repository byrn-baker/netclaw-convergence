import fs from 'node:fs';
import path from 'node:path';

// URL resource identifiers are names, not paths. Resolve links before reading.
export function resourceFile(root, name, suffix = '') {
  if (typeof name !== 'string' || !name || ['.', '..'].includes(name)
      || /[\\/\0]/.test(name)) return null;
  try {
    const base = fs.realpathSync(root);
    const file = fs.realpathSync(path.join(base, name + suffix));
    return file.startsWith(base + path.sep) && fs.statSync(file).isFile() ? file : null;
  } catch { return null; }
}
