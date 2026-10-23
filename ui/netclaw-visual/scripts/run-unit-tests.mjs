// Explicit discovery avoids shell-dependent glob expansion (notably Windows).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return discover(file);
    return entry.isFile() && entry.name.endsWith('.test.js') ? [file] : [];
  });
}
const files = discover(fileURLToPath(new URL('../src/', import.meta.url))).sort();
if (!files.length) throw new Error('No unit tests discovered; refusing an empty success.');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', windowsHide: true });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
