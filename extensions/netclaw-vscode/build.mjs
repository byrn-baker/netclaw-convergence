import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
const dependencies = new Map();
async function bundle(options) {
  const result = await build({ ...options, metafile: true });
  for (const file of Object.keys(result.metafile.inputs)) {
    const marker = file.lastIndexOf("node_modules/");
    if (marker < 0) continue;
    const parts = file.slice(marker + "node_modules/".length).split("/");
    const count = parts[0].startsWith("@") ? 2 : 1;
    const root =
      file.slice(0, marker) + "node_modules/" + parts.slice(0, count).join("/");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    const notices = fs
      .readdirSync(root)
      .filter(
        (name) =>
          /^(licen[cs]e|copying|notice)(\.|$)/i.test(name) &&
          fs.statSync(path.join(root, name)).isFile(),
      );
    if (!notices.length)
      throw Error(`Missing third-party license text for ${pkg.name}`);
    dependencies.set(
      `${pkg.name}@${pkg.version}`,
      notices
        .sort()
        .map((name) => fs.readFileSync(path.join(root, name), "utf8"))
        .join("\n\n"),
    );
  }
}
await bundle({
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["vscode"],
  legalComments: "linked",
});
await bundle({
  entryPoints: ["src/assistants/server.ts"],
  outfile: "dist/assistant.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "linked",
});
await bundle({
  entryPoints: ["webview/avatar.jsx"],
  outfile: "dist/avatar.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "linked",
  define: { "process.env.NODE_ENV": '"production"' },
});
await bundle({
  entryPoints: ["webview/canvas.js"],
  outfile: "dist/canvas.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  legalComments: "linked",
});
await bundle({
  entryPoints: ["webview/topology.js"],
  outfile: "dist/topology.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "linked",
});

fs.writeFileSync(
  "dist/THIRD-PARTY-NOTICES.txt",
  "Bundled third-party software notices\n\n" +
    [...dependencies.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([name, license]) => `${name}\n${"=".repeat(name.length)}\n${license}`,
      )
      .join("\n\n"),
);
