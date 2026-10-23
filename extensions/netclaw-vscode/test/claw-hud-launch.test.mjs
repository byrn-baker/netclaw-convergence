import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { fileFixture, sourceRoot } from "./claw-fixture.mjs";
import { freePort } from "./real-hud-fixture.mjs";
const exec = promisify(execFile);
for (const kind of ["openclaw", "hermes"])
  test(`${kind}: actual managed HUD launcher owns and stops API, Vite and companion`, async () => {
    const f = fileFixture(kind),
      root = path.join(f.base, "launcher-source"),
      ui = path.join(root, "ui/netclaw-visual"),
      source = path.join(sourceRoot, "ui/netclaw-visual");
    fs.mkdirSync(ui, { recursive: true, mode: 0o700 });
    for (const n of fs
      .readdirSync(source)
      .filter(
        (n) =>
          n.endsWith(".js") || ["package.json", "genie_parse.py"].includes(n),
      ))
      fs.copyFileSync(path.join(source, n), path.join(ui, n));
    fs.cpSync(path.join(source, "src"), path.join(ui, "src"), {
      recursive: true,
    });
    fs.symlinkSync(
      path.join(source, "node_modules"),
      path.join(ui, "node_modules"),
      "dir",
    );
    fs.mkdirSync(path.join(root, "scripts/lib"), {
      recursive: true,
      mode: 0o700,
    });
    for (const n of [
      "hud-launch.mjs",
      "hud-node-version.mjs",
      "runtime-selection.mjs",
      "claw-control.mjs",
      "lib/claw-files.mjs",
      "lib/claw-process.mjs",
      "lib/claw-services.mjs",
    ])
      fs.copyFileSync(
        path.join(sourceRoot, "scripts", n),
        path.join(root, "scripts", n),
      );
    fs.mkdirSync(path.join(root, "testbed"), { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(root, "testbed/testbed.yaml"), "devices: {}\n");
    fs.mkdirSync(path.join(root, "config"), { recursive: true, mode: 0o700 });
    fs.copyFileSync(
      path.join(sourceRoot, "config/installer-runtime.json"),
      path.join(root, "config/installer-runtime.json"),
    );
    const api = await freePort(),
      vite = await freePort(),
      companion = await freePort();
    const env = {
      PATH:
        path.join(f.base, "bin") +
        ":" +
        path.dirname(process.execPath) +
        ":/usr/bin:/bin",
      HOME: f.base,
      HUD_PORT: String(api),
      HUD_UI_PORT: String(vite),
      NETCLAW_RUNTIME: kind,
      HUD_HOME: f.home,
      NETCLAW_TESTBED_FILE: path.join(root, "testbed/testbed.yaml"),
    };
    if (kind === "hermes") {
      const auth = { key: "a".repeat(64), port: companion };
      fs.writeFileSync(
        path.join(f.home, "netclaw-hud/companion-auth.json"),
        JSON.stringify(auth),
        { mode: 0o600 },
      );
      const dir = path.join(root, "mcp-servers/hermes-hud-mcp");
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        path.join(dir, "hermes_api.py"),
        `from http.server import BaseHTTPRequestHandler,HTTPServer\nimport json,sys\nclass H(BaseHTTPRequestHandler):\n def do_GET(self):\n  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'ready':True,'installationId':sys.argv[sys.argv.index('--installation')+1]}).encode())\nHTTPServer(('127.0.0.1',int(sys.argv[sys.argv.index('--port')+1])),H).serve_forever()\n`,
      );
      Object.assign(env, {
        HERMES_HOME: f.home,
        NETCLAW_HERMES_PYTHON: "/usr/bin/python3",
        NETCLAW_HERMES_SOURCE: dir,
        NETCLAW_HERMES_HUD_PORT: String(companion),
      });
    } else {
      // Real OpenClaw expands a tilde workspace against its user home, not state.
      const config = JSON.parse(fs.readFileSync(f.target.configPath, "utf8"));
      config.agents.defaults.workspace = "~/custom-agent-workspace";
      fs.writeFileSync(f.target.configPath, JSON.stringify(config));
      fs.writeFileSync(
        f.target.cli,
        `#!${process.execPath}\nconst fs=require('fs'),path=require('path');const c=JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH));console.log(JSON.stringify([{id:'main',isDefault:true,workspace:path.join(process.env.OPENCLAW_HOME||process.env.HOME,c.agents.defaults.workspace.slice(2))}]));\n`,
      );
      f.target.launch.openclawHome = f.base;
      Object.assign(env, {
        OPENCLAW_HOME: f.base,
        OPENCLAW_STATE_DIR: f.home,
        OPENCLAW_CONFIG_PATH: f.target.configPath,
      });
    }
    const { resolveTarget } = await import(
        pathToFileURL(path.join(root, "scripts/lib/claw-files.mjs"))
      ),
      { definition, stopOwned } = await import(
        pathToFileURL(path.join(root, "scripts/lib/claw-process.mjs"))
      );
    const target = {
      ...f.target,
      root,
      launch: { ...f.target.launch, cwd: root },
    };
    try {
      await exec(
        process.execPath,
        [
          path.join(root, "scripts/hud-launch.mjs"),
          "managed",
          "--runtime",
          kind,
          "--home",
          f.home,
        ],
        { env, cwd: root, timeout: 45000 },
      );
      const t = await resolveTarget(target);
      assert.equal(
        (await fetch(`http://127.0.0.1:${api}/api/runtime`)).status,
        200,
      );
      if (kind === "openclaw") {
        const owned = definition(t, "hud");
        assert.equal(owned.env.OPENCLAW_HOME, f.base);
        assert.equal(owned.env.OPENCLAW_STATE_DIR, f.home);
        assert.equal(t.workspace, f.workspace);
      }
      const response = await fetch(`http://127.0.0.1:${vite}`);
      assert.ok(response.status === 200 || response.status === 404);
      await stopOwned(t, definition(t, "hud"));
      await assert.rejects(fetch(`http://127.0.0.1:${api}/api/runtime`));
      await assert.rejects(fetch(`http://127.0.0.1:${vite}`));
      if (kind === "hermes")
        await assert.rejects(
          fetch(`http://127.0.0.1:${companion}/health/detailed`),
        );
    } finally {
      const t = await resolveTarget(target),
        d = definition(t, "hud");
      if (d) await stopOwned(t, d);
    }
  });
