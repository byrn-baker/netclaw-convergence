import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
export async function freePort() {
  const s = net.createServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
export async function realHud({ ragPython, ragCache } = {}) {
  const source = fileURLToPath(
    new URL("../../../ui/netclaw-visual/", import.meta.url),
  );
  const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "netclaw150-unchanged-hud-"),
    ),
    ui = path.join(root, "ui/netclaw-visual"),
    home = path.join(root, "runtime"),
    bin = path.join(root, "bin");
  for (const d of [
    ui,
    bin,
    path.join(root, "testbed"),
    path.join(root, "workspace/skills"),
    path.join(home, "agents/main/sessions"),
    path.join(home, "netclaw-hud"),
  ])
    fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(root, "testbed/testbed.yaml"), "devices: {}\n");
  for (const name of fs
    .readdirSync(source)
    .filter(
      (n) =>
        n.endsWith(".js") || ["genie_parse.py", "package.json"].includes(n),
    ))
    fs.copyFileSync(path.join(source, name), path.join(ui, name));
  for (const name of ["src", "node_modules"])
    fs.symlinkSync(path.join(source, name), path.join(ui, name), "dir");
  fs.cpSync(
    path.join(source, "../../docs/reference"),
    path.join(root, "docs/reference"),
    { recursive: true },
  );
  fs.copyFileSync(
    path.join(source, "../../README.md"),
    path.join(root, "README.md"),
  );
  const installationId = "22222222-2222-4222-8222-222222222222";
  fs.writeFileSync(
    path.join(home, "netclaw-hud/installation.json"),
    JSON.stringify({ schemaVersion: 1, installationId }),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(home, ".env"),
    "ANTHROPIC_API_KEY=fixture-not-a-real-key\n",
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(bin, "openclaw"),
    `#!${process.execPath}
const method=process.argv[4];
if(method==='models.list')console.log(JSON.stringify({models:[{provider:'fixture',id:'large',available:true,thinkingDefault:'low',thinkingLevels:[{id:'low'},{id:'high'}]}]}));
else if(method==='sessions.patch')console.log(JSON.stringify({ok:true,entry:{thinkingLevel:JSON.parse(process.argv[process.argv.indexOf('--params')+1]).thinkingLevel}}));
else if(method==='sessions.list')console.log(JSON.stringify({sessions:[]}));
else if(method==='chat.history')console.log(JSON.stringify({messages:[{role:'user',content:'Owned fixture question'},{role:'assistant',content:'Owned fixture answer'}],sessionInfo:{}}));
else process.exit(1);
`,
    { mode: 0o700 },
  );
  fs.writeFileSync(path.join(bin, "openshell"), "#!/bin/sh\nexit 1\n", {
    mode: 0o700,
  });
  if (ragPython) {
    fs.writeFileSync(
      path.join(bin, "python3"),
      "#!/bin/sh\nexec '" + ragPython.replaceAll("'", "'\\''") + '\' "$@"\n',
      { mode: 0o700 },
    );
    for (const name of ["scripts", "mcp-servers", "config"])
      fs.symlinkSync(
        path.join(source, "../..", name),
        path.join(root, name),
        "dir",
      );
  }
  const calls = [];
  let fail = false;
  const gateway = http.createServer(async (req, res) => {
    let raw = "";
    for await (const p of req) raw += p;
    calls.push({
      url: req.url,
      headers: req.headers,
      body: raw ? JSON.parse(raw) : null,
    });
    res.writeHead(fail ? 503 : 200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        fail
          ? { error: "Fixture failure" }
          : { choices: [{ message: { content: "Synthetic gateway reply" } }] },
      ),
    );
  });
  gateway.listen(0, "127.0.0.1");
  await once(gateway, "listening");
  const config = {
    agents: {
      defaults: {
        model: "fixture/fast",
        models: { "fixture/fast": {}, "fixture/large": {} },
        budget: { sessionBudgetUsd: 5, maxToolCallsPerTurn: 20 },
      },
    },
    gateway: {
      mode: "local",
      port: gateway.address().port,
      auth: { mode: "token", token: "fixture-only-token" },
      http: { endpoints: { chatCompletions: { enabled: true } } },
    },
  };
  const configPath = path.join(home, "openclaw.json");
  fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  const port = await freePort(),
    uiPort = await freePort(),
    bgpPort = await freePort();
  const env = {
    PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: root,
    USERPROFILE: root,
    XDG_CONFIG_HOME: path.join(root, "xdg"),
    NETCLAW_RUNTIME: "openclaw",
    OPENCLAW_HOME: home,
    OPENCLAW_STATE_DIR: home,
    OPENCLAW_CONFIG_PATH: configPath,
    HUD_HOST: "127.0.0.1",
    HUD_PORT: String(port),
    HUD_UI_PORT: String(uiPort),
    HUD_CHAT_TIMEOUT_MS: "1000",
    NETCLAW_TESTBED_FILE: path.join(root, "testbed/testbed.yaml"),
    NETCLAW_TERMINAL_KNOWN_HOSTS_FILE: path.join(root, "known-hosts.json"),
    NETCLAW_BGP_API: `http://127.0.0.1:${bgpPort}`,
  };
  if (ragPython)
    Object.assign(env, {
      HF_HOME: ragCache,
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      RAG_DATA_DIR: path.join(home, "rag"),
    });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ui,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (b) => (output += String(b)));
  child.stderr.on("data", (b) => (output += String(b)));
  const close = async () => {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await new Promise((r) => {
      gateway.closeAllConnections();
      gateway.close(r);
    });
    fs.writeFileSync(path.join(root, "server-output.log"), output);
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("HUD start timeout: " + output.slice(-1000))),
        20000,
      );
      const poll = setInterval(() => {
        if (output.includes("listening")) {
          clearTimeout(timer);
          clearInterval(poll);
          resolve();
        } else if (child.exitCode !== null) {
          clearTimeout(timer);
          clearInterval(poll);
          reject(Error("HUD stopped: " + output.slice(-2000)));
        }
      }, 100);
      timer.unref();
    });
  } catch (e) {
    await close();
    throw e;
  }
  return {
    root,
    home,
    url: `http://127.0.0.1:${port}`,
    installationId,
    calls,
    configPath,
    config,
    close,
    setFailure: (v) => {
      fail = v;
    },
    child,
  };
}
