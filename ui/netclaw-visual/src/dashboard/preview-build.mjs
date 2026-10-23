// Portable, synthetic review artifact. No server, credentials or live data.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = await build({ entryPoints: [path.join(root, 'src/dashboard/main.jsx')], bundle: true, minify: true, write: false, outfile: 'preview.js', format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text;
const css = result.outputFiles.find(f => f.path.endsWith('.css')).text;
const output = process.argv[2] || '/tmp/netclaw-hud127-preview.html';
const reviewDocs = Object.fromEntries(['README.md','docs/HUD-FUNCTION-FIRST.md','docs/LOGGING-GUIDE.md','docs/SECURITY-MODES.md','docs/reference/CLI-REFERENCE.md'].map(name => [name,fs.readFileSync(path.resolve(root,'../..',name),'utf8')]));
fs.writeFileSync(output, `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NetClaw HUD 127 · Synthetic preview</title><style>${css}</style></head><body><div id="root"></div><script>globalThis.NETCLAW_PREVIEW=true;globalThis.NETCLAW_PREVIEW_DOCUMENTS=${JSON.stringify(reviewDocs).replaceAll('<', '\\u003c')};</script><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`);
console.log(output);
