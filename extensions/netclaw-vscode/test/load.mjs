import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const output = fs.mkdtempSync(
  path.join(os.tmpdir(), "netclaw-extension-unit-"),
);
export async function load(entry) {
  const file = path.join(output, path.basename(entry) + ".mjs");
  await build({
    entryPoints: [entry],
    outfile: file,
    bundle: true,
    platform: "node",
    format: "esm",
    banner: {
      js: "import { createRequire as __testCreateRequire } from 'node:module'; const require = __testCreateRequire(import.meta.url);",
    },
    target: "node22",
    logLevel: "silent",
  });
  return import(pathToFileURL(file).href);
}
