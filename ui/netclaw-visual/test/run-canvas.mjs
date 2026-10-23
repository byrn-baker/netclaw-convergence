// Local synthetic/mock regression suites only. Never connects to real inventory.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('.', import.meta.url));
const self = basename(fileURLToPath(import.meta.url));
const suites = readdirSync(directory).filter(name => name.endsWith('.mjs')
  && name !== self && !name.endsWith('-fixtures.mjs')).sort();
const failed = [];
for (const suite of suites) {
  console.log(`\nCanvas regression: ${suite}`);
  const result = spawnSync(process.execPath, [join(directory, suite)], {
    stdio: 'inherit', windowsHide: true, timeout: 60000,
  });
  if (result.error || result.status !== 0) {
    if (result.error) console.error(result.error.message);
    failed.push(suite);
  }
}
console.log(`\n${suites.length - failed.length}/${suites.length} Canvas suites passed.`);
if (failed.length) console.error(`Failed: ${failed.join(', ')}`);
process.exitCode = failed.length ? 1 : 0;
