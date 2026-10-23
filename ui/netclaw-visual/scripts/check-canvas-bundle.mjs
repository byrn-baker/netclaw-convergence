// Run after npm run build. Count the complete static dependency closure, not
// just the entry file; dynamic features are deliberately excluded from initial.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('.vite/manifest.json', dist)));
const seen = new Set();
const css = new Set();
function visit(key) {
  if (seen.has(key)) return;
  const chunk = manifest[key];
  assert.ok(chunk, `Missing chunk: ${key}`);
  seen.add(key);
  for (const name of chunk.css || []) css.add(name);
  for (const child of chunk.imports || []) visit(child);
}
visit('canvas.html');
function measure(files) {
  return files.reduce((total, file) => {
    const content = fs.readFileSync(new URL(file, dist));
    return { bytes: total.bytes + content.length, gzip: total.gzip + gzipSync(content).length };
  }, { bytes: 0, gzip: 0 });
}
for (const feature of ['TerminalLane', 'ConfigReviewLane', 'ResultLane']) {
  const key = `src/canvas-chat/${feature}.jsx`;
  assert.ok(manifest[key]?.isDynamicEntry, `${feature} must remain on demand`);
  assert.ok(!seen.has(key), `${feature} leaked into initial Canvas imports`);
}
const initial = measure([...seen].map(key => manifest[key].file));
assert.ok(initial.bytes < 400_000, `Initial Canvas JS exceeded 400 KB: ${initial.bytes}`);
console.log(JSON.stringify({ initialJavaScript: initial, initialCss: measure([...css]),
  initialChunks: [...seen], budgetBytes: 400_000 }, null, 2));
