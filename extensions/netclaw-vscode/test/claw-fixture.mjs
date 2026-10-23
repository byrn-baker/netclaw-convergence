import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
export const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
export function fileFixture(kind = "openclaw") {
  const base = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "nc152-")),
    ),
    home = path.join(base, "runtime"),
    workspace =
      kind === "hermes" ? home : path.join(base, "custom-agent-workspace");
  for (const dir of [
    home,
    workspace,
    path.join(home, "netclaw-hud"),
    path.join(base, "bin"),
  ])
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const id = randomUUID(),
    configPath = path.join(
      home,
      kind === "hermes" ? "config.yaml" : "openclaw.json",
    );
  fs.writeFileSync(
    path.join(home, "netclaw-hud/installation.json"),
    JSON.stringify({ schemaVersion: 1, installationId: id }),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    configPath,
    kind === "hermes"
      ? "model: fixture\n"
      : JSON.stringify({
          agents: { defaults: { workspace } },
          gateway: { port: 19452 },
        }),
    { mode: 0o600 },
  );
  const cli = path.join(base, "bin/openclaw");
  fs.writeFileSync(
    cli,
    `#!${process.execPath}\nconst fs=require('fs');if(process.argv.slice(2).join(' ')==='agents list --json'){const c=JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH));console.log(JSON.stringify([{id:'main',workspace:c.agents.defaults.workspace,isDefault:true}]))}else process.exit(2);\n`,
    { mode: 0o700 },
  );
  const target = {
    schemaVersion: 1,
    kind,
    installationId: id,
    home,
    configPath,
    agentId: "main",
    root: sourceRoot,
    node: process.execPath,
    cli,
    launch: { cwd: base, home: base, openclawHome: home },
  };
  for (const name of [
    "SOUL.md",
    "AGENTS.md",
    "IDENTITY.md",
    "USER.md",
    "TOOLS.md",
    "HEARTBEAT.md",
  ])
    fs.writeFileSync(
      path.join(workspace, name),
      `# ${name}\nSynthetic ${kind} fixture.\n`,
      { mode: 0o600 },
    );
  return { base, home, workspace, target };
}

export async function serviceFixture(
  kind = "openclaw",
  { realHud = false } = {},
) {
  const { resolveTarget } = await import("../../../scripts/lib/claw-files.mjs");
  const { registerOwned, startOwned, stopOwned, definition } = await import(
    "../../../scripts/lib/claw-process.mjs"
  );
  const { freePort } = await import("./real-hud-fixture.mjs");
  const f = fileFixture(kind),
    t = await resolveTarget(f.target),
    ports = {
      gateway: await freePort(),
      hud: await freePort(),
      federation: await freePort(),
    };
  const server = path.join(f.base, "service.mjs");
  fs.writeFileSync(
    server,
    `import http from 'node:http';import fs from 'node:fs';const id=process.env.FIXTURE_ID,kind=process.env.FIXTURE_KIND,role=process.env.FIXTURE_ROLE;const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({kind,installationId:id,role,ready:true,capabilities:{},readiness:{ready:true,executionVerified:false}}));});server.listen(Number(process.env.FIXTURE_PORT),'127.0.0.1');process.on('SIGTERM',()=>{server.closeAllConnections();server.close(()=>process.exit(0));});`,
    { mode: 0o600 },
  );
  let hudRoot;
  for (const role of ["gateway", "hud", "federation"]) {
    let args = [server],
      cwd = f.base,
      env = {
        PATH: path.dirname(process.execPath) + ":/usr/bin:/bin",
        HOME: f.base,
        FIXTURE_ID: t.installationId,
        FIXTURE_KIND: kind,
        FIXTURE_ROLE: role,
        FIXTURE_PORT: String(ports[role]),
      };
    if (role === "hud" && realHud) {
      // Real source HUD; external runtime/provider requests remain isolated synthetic services.
      hudRoot = path.join(f.base, "checkout");
      const ui = path.join(hudRoot, "ui/netclaw-visual"),
        source = path.join(sourceRoot, "ui/netclaw-visual");
      fs.mkdirSync(ui, { recursive: true, mode: 0o700 });
      for (const name of fs
        .readdirSync(source)
        .filter(
          (n) =>
            n.endsWith(".js") || ["package.json", "genie_parse.py"].includes(n),
        ))
        fs.copyFileSync(path.join(source, name), path.join(ui, name));
      fs.symlinkSync(
        path.join(source, "node_modules"),
        path.join(ui, "node_modules"),
        "dir",
      );
      fs.cpSync(path.join(source, "src"), path.join(ui, "src"), {
        recursive: true,
      });
      fs.mkdirSync(path.join(hudRoot, "scripts"), {
        recursive: true,
        mode: 0o700,
      });
      fs.copyFileSync(
        path.join(sourceRoot, "scripts/runtime-selection.mjs"),
        path.join(hudRoot, "scripts/runtime-selection.mjs"),
      );
      fs.mkdirSync(path.join(hudRoot, "testbed"), {
        recursive: true,
        mode: 0o700,
      });
      fs.writeFileSync(
        path.join(hudRoot, "testbed/testbed.yaml"),
        "devices: {}\n",
      );
      fs.mkdirSync(path.join(hudRoot, "workspace/skills"), {
        recursive: true,
        mode: 0o700,
      });
      fs.mkdirSync(path.join(hudRoot, "docs/reference"), {
        recursive: true,
        mode: 0o700,
      });
      fs.writeFileSync(
        path.join(hudRoot, "README.md"),
        "Synthetic isolated Spec152 preview.",
      );
      // Discovery must point at the reviewed source implementation, not incomplete copied helpers.
      const management = path.join(ui, "src/hud-server/management.js");
      fs.writeFileSync(
        management,
        fs
          .readFileSync(management, "utf8")
          .replace(
            /root:\s*fs\.realpathSync\(root\)/,
            "root:" + JSON.stringify(sourceRoot.replace(/\/$/, "")),
          ),
      );
      args = [path.join(ui, "server.js")];
      cwd = ui;
      env = {
        ...env,
        PATH: path.join(f.base, "bin") + ":" + env.PATH,
        NETCLAW_RUNTIME: kind,
        HUD_HOME: f.home,
        HUD_PORT: String(ports.hud),
        HUD_UI_PORT: String(await freePort()),
        NETCLAW_BGP_API: `http://127.0.0.1:${ports.federation}`,
        NETCLAW_TESTBED_FILE: path.join(hudRoot, "testbed/testbed.yaml"),
        NETCLAW_HERMES_HUD_PORT: String(ports.gateway),
        ...(kind === "hermes"
          ? { HERMES_HOME: f.home }
          : {
              OPENCLAW_HOME: f.home,
              OPENCLAW_STATE_DIR: f.home,
              OPENCLAW_CONFIG_PATH: f.target.configPath,
            }),
      };
      if (kind === "hermes")
        fs.writeFileSync(
          path.join(f.home, "netclaw-hud/companion-auth.json"),
          JSON.stringify({ key: "f".repeat(64), port: ports.gateway }),
          { mode: 0o600 },
        );
    }
    const d = registerOwned(
      t,
      role,
      fs.realpathSync(process.execPath),
      args,
      env,
      cwd,
      {
        url: `http://127.0.0.1:${ports[role]}${role === "hud" ? "/api/runtime" : ""}`,
        installationId: t.installationId,
        kind,
      },
    );
    try {
      await startOwned(t, d);
    } catch (e) {
      for (const r of ["federation", "hud", "gateway"]) {
        const previous = definition(t, r);
        if (previous) await stopOwned(t, previous);
      }
      throw e;
    }
  }
  return {
    ...f,
    ports,
    url: `http://127.0.0.1:${ports.hud}`,
    hudRoot,
    close: async () => {
      for (const role of ["federation", "hud", "gateway"]) {
        const d = definition(t, role);
        if (d) await stopOwned(t, d);
      }
    },
  };
}
