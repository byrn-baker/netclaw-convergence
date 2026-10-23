import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { serviceFixture } from "./claw-fixture.mjs";
import { resolveTarget } from "../../../scripts/lib/claw-files.mjs";
import { definition, stopOwned } from "../../../scripts/lib/claw-process.mjs";
import {
  prepareLifecycle,
  applyLifecycle,
  inspectServices,
} from "../../../scripts/lib/claw-services.mjs";
const exec = promisify(execFile);
test(
  "macOS exact isolated launchd gateway: full stop suppresses KeepAlive and Start restores it",
  { skip: process.platform !== "darwin" },
  async () => {
    const f = await serviceFixture(),
      t = await resolveTarget(f.target);
    await stopOwned(t, definition(t, "gateway"));
    fs.renameSync(
      path.join(t.state, "services/gateway.json"),
      path.join(t.state, "services/gateway.original"),
    );
    const label = "ai.openclaw.fixture-" + randomUUID(),
      dir = path.join(f.base, "Library/LaunchAgents");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, label + ".plist"),
      script = path.join(f.base, "openclaw.mjs");
    fs.copyFileSync(path.join(f.base, "service.mjs"), script);
    let cli = fs.readFileSync(f.target.cli, "utf8");
    cli = cli.replace(
      "else process.exit(2);",
      `else if(process.argv.slice(2).join(' ')==='gateway status --json --no-probe')console.log(JSON.stringify({gateway:{port:${f.ports.gateway}}}));else process.exit(2);`,
    );
    fs.writeFileSync(f.target.cli, cli, { mode: 0o700 });
    const env = {
      OPENCLAW_STATE_DIR: f.home,
      OPENCLAW_CONFIG_PATH: f.target.configPath,
      FIXTURE_ID: t.installationId,
      FIXTURE_KIND: "openclaw",
      FIXTURE_ROLE: "gateway",
      FIXTURE_PORT: String(f.ports.gateway),
      HOME: f.base,
    };
    const xml = (s) =>
      String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    fs.writeFileSync(
      file,
      `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${[process.execPath, script, "gateway"].map((a) => "<string>" + xml(a) + "</string>").join("")}</array><key>WorkingDirectory</key><string>${xml(f.base)}</string><key>EnvironmentVariables</key><dict>${Object.entries(
        env,
      )
        .map(([k, v]) => "<key>" + k + "</key><string>" + xml(v) + "</string>")
        .join(
          "",
        )}</dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>`,
      { mode: 0o600 },
    );
    const domain = "gui/" + process.getuid();
    try {
      await exec("/bin/launchctl", ["bootstrap", domain, file]);
      await new Promise((r) => setTimeout(r, 700));
      const s = await inspectServices(f.target);
      assert.equal(s.public.available, true, s.public.reason);
      assert.equal(
        s.public.services.find((s) => s.role === "gateway").controller,
        "launchd",
      );
      const stop = await prepareLifecycle(f.target, { action: "stop" });
      await applyLifecycle(f.target, { id: stop.id, acknowledged: true });
      await new Promise((r) => setTimeout(r, 700));
      await assert.rejects(fetch(`http://127.0.0.1:${f.ports.gateway}`));
      const start = await prepareLifecycle(f.target, { action: "start" });
      await applyLifecycle(f.target, { id: start.id, acknowledged: true });
      assert.equal((await fetch(f.url)).status, 200);
      assert.equal(
        (await fetch(`http://127.0.0.1:${f.ports.gateway}`)).status,
        200,
      );
    } finally {
      try {
        await exec("/bin/launchctl", ["bootout", domain + "/" + label]);
      } catch {}
      await f.close();
    }
  },
);
