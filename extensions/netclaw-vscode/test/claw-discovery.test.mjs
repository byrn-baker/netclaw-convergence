import test from "node:test";
import assert from "node:assert/strict";
import { serviceFixture, sourceRoot } from "./claw-fixture.mjs";
import { load } from "./load.mjs";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileFixture } from "./claw-fixture.mjs";
import { freePort } from "./real-hud-fixture.mjs";
import { resolveTarget } from "../../../scripts/lib/claw-files.mjs";

test("OpenClaw HUD and helper preserve native tilde workspace resolution with a separate state directory", async () => {
  const f = fileFixture();
  const config = JSON.parse(fs.readFileSync(f.target.configPath, "utf8"));
  config.agents.defaults.workspace = "~/custom-agent-workspace";
  fs.writeFileSync(f.target.configPath, JSON.stringify(config));
  fs.writeFileSync(
    f.target.cli,
    `#!${process.execPath}\nconst fs=require('fs'),path=require('path');const c=JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH));const w=c.agents.defaults.workspace;console.log(JSON.stringify([{id:'main',isDefault:true,workspace:w.startsWith('~/')?path.join(process.env.OPENCLAW_HOME||process.env.HOME,w.slice(2)):w}]));\n`,
  );
  const port = await freePort(),
    uiPort = await freePort();
  const env = {
    PATH:
      path.dirname(f.target.cli) +
      path.delimiter +
      path.dirname(process.execPath) +
      path.delimiter +
      "/usr/bin:/bin",
    HOME: f.base,
    NETCLAW_RUNTIME: "openclaw",
    OPENCLAW_HOME: f.base,
    OPENCLAW_STATE_DIR: f.home,
    OPENCLAW_CONFIG_PATH: f.target.configPath,
    HUD_PORT: String(port),
    HUD_UI_PORT: String(uiPort),
  };
  const child = spawn(
    process.execPath,
    [path.join(sourceRoot, "ui/netclaw-visual/server.js")],
    { env, cwd: f.base, stdio: "ignore" },
  );
  let client;
  try {
    const url = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url + "/api/runtime")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(ready, true, "isolated HUD starts");
    const { HudClient } = await load(
      new URL("../src/client/hud.ts", import.meta.url).pathname,
    );
    client = new HudClient(url, f.target.installationId);
    await client.connect();
    await client.session();
    const target = await client.request("GET", "/api/hud/management");
    assert.equal(target.expectedWorkspace, f.workspace);
    assert.equal(target.launch.openclawHome, f.base);
    assert.equal((await resolveTarget(target)).workspace, f.workspace);
    delete target.launch.openclawHome;
    assert.equal((await resolveTarget(target)).workspace, f.workspace);
  } finally {
    client?.close();
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
    }
  }
});
for (const kind of ["openclaw", "hermes"])
  test(`${kind}: real HUD discovery requires owned session and reveals no content or credentials`, async () => {
    const f = await serviceFixture(kind, { realHud: true });
    try {
      assert.equal((await fetch(f.url + "/api/hud/management")).status, 401);
      const { HudClient } = await load(
        new URL("../src/client/hud.ts", import.meta.url).pathname,
      );
      const client = new HudClient(f.url, f.target.installationId);
      await client.connect();
      await client.session();
      const d = await client.request("GET", "/api/hud/management");
      assert.equal(d.home, f.home);
      assert.equal(d.kind, kind);
      assert.equal(d.installationId, f.target.installationId);
      assert.equal(d.root, sourceRoot.replace(/\/$/, ""));
      assert.ok(
        !/token|password|fixture-not|Synthetic/.test(JSON.stringify(d)),
      );
      assert.equal(
        (
          await fetch(f.url + "/api/hud/management", {
            headers: { "x-netclaw-installation": "wrong" },
          })
        ).status,
        409,
      );
      client.close();
    } finally {
      await f.close();
    }
  });
