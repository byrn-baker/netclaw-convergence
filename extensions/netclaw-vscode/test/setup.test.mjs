import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load } from "./load.mjs";
const { prepareSetup, verifyPrepared, executeSetup, setupHistory } = await load(
  "src/client/setup.ts",
);
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nc151-setup-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.mkdirSync(path.join(home, "netclaw-hud"), { mode: 0o700 });
  fs.writeFileSync(
    path.join(home, "netclaw-hud/installation.json"),
    JSON.stringify({ installationId: "fixture" }),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(home, "openclaw.json"),
    JSON.stringify({ custom: "keep" }),
  );
  return {
    root: path.resolve("../.."),
    home,
    kind: "openclaw",
    installationId: "fixture",
    host: "fixture",
    component: "chrome-devtools",
    action: "register",
  };
}
test("preparation binds identity, canonical helper and reviewed config revisions without mutation", async (t) => {
  const opts = fixture(t),
    p = await prepareSetup(opts);
  assert.ok(p.servers.length);
  assert.equal(fs.existsSync(path.join(opts.home, "netclaw-hud/setup")), false);
  verifyPrepared(p);
  fs.writeFileSync(path.join(opts.home, "openclaw.json"), "{}");
  assert.throws(() => verifyPrepared(p), /changed/);
  await assert.rejects(
    prepareSetup({ ...opts, installationId: "foreign" }),
    /different/,
  );
  await assert.rejects(
    prepareSetup({ ...opts, action: "arbitrary-shell" }),
    /supported/,
  );
});
test("actual canonical registration is verified; cancellation before execution writes nothing; evidence has no secrets", async (t) => {
  const opts = fixture(t),
    p = await prepareSetup(opts);
  assert.deepEqual(setupHistory(opts.home), []);
  const result = await executeSetup(p, {
    guard: async () => {},
    progress: () => {},
  });
  assert.equal(result.state, "verified");
  const c = JSON.parse(
    fs.readFileSync(path.join(opts.home, "openclaw.json"), "utf8"),
  );
  assert.equal(c.custom, "keep");
  assert.ok(c.mcp.servers[p.servers[0]]);
  const evidence = setupHistory(opts.home);
  assert.equal(evidence[0].state, "verified");
  assert.ok(!JSON.stringify(evidence).includes("process.env"));
  await assert.rejects(
    executeSetup(p, {
      guard: async () => {
        throw Error("connection changed");
      },
      progress: () => {},
    }),
    /changed/,
  );
});

test("actual owned federation fixture restarts with new PID, fixed identity and no peers", async (t) => {
  const { execFileSync } = await import("node:child_process");
  const { freePort } = await import("./real-hud-fixture.mjs");
  const opts = fixture(t);
  opts.installationId = "44444444-4444-4444-8444-444444444444";
  fs.writeFileSync(
    path.join(opts.home, "netclaw-hud/installation.json"),
    JSON.stringify({ schemaVersion: 1, installationId: opts.installationId }),
    { mode: 0o600 },
  );
  opts.component = "n2n";
  opts.action = "restart";
  const port = await freePort();
  const python = execFileSync("which", ["python3"], {
    encoding: "utf8",
  }).trim();
  fs.mkdirSync(path.join(opts.home, "python-runtimes/records"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(opts.home, "python-runtimes/records/n2n"), python);
  fs.writeFileSync(
    path.join(fs.realpathSync(opts.home), ".env"),
    `BGP_API_PORT=${port}\nBGP_LISTEN_PORT=0\nNETCLAW_DRY_RUN=true\nN2N_ENABLED=false\nNETCLAW_BGP_PEERS=[]\n`,
    { mode: 0o600 },
  );
  const { setupEnvironment } = await load("src/client/setup.ts");
  const env = setupEnvironment(opts),
    script = path.join(opts.root, "scripts/federation-control.py");
  const command = (action) =>
    JSON.parse(
      execFileSync(python, [script, action], {
        env,
        encoding: "utf8",
        timeout: 45000,
      }) || "{}",
    );
  try {
    const before = command("start");
    assert.equal(before.n2n_enabled, false);
    const p = await prepareSetup(opts);
    const result = await executeSetup(p, {
      guard: async () => {},
      progress: () => {},
    });
    assert.equal(result.state, "verified");
    const after = command("status");
    assert.notEqual(after.pid, before.pid);
    assert.equal(after.installation_id, opts.installationId);
    assert.equal(after.n2n_enabled, false);
  } finally {
    command("stop");
  }
});

test("failed guard and interrupted evidence never replay setup", async (t) => {
  const opts = fixture(t),
    p = await prepareSetup(opts);
  await assert.rejects(
    executeSetup(p, {
      guard: async () => {
        throw Error("identity changed");
      },
      progress: () => {},
    }),
    /identity changed/,
  );
  assert.deepEqual(setupHistory(opts.home), []);
  const dir = path.join(opts.home, "netclaw-hud/setup");
  fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, "11111111-1111-4111-8111-111111111111.json"),
    JSON.stringify({
      id: "unknown",
      state: "running",
      updatedAt: new Date().toISOString(),
    }),
  );
  assert.equal(setupHistory(opts.home)[0].state, "unknown");
  await assert.rejects(
    executeSetup(p, { guard: async () => {}, progress: () => {} }),
    /unknown outcome/,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(opts.home, "openclaw.json"), "utf8"))
      .custom,
    "keep",
  );
});

test("staged command pins selected paths despite inherited targets; malformed evidence blocks replay", async (t) => {
  const opts = fixture(t);
  const prior = process.env.NETCLAW_RUNTIME_ENV;
  process.env.NETCLAW_RUNTIME_ENV = "/foreign/runtime/.env";
  t.after(() => {
    if (prior === undefined) delete process.env.NETCLAW_RUNTIME_ENV;
    else process.env.NETCLAW_RUNTIME_ENV = prior;
  });
  const p = await prepareSetup({ ...opts, action: "stage" });
  assert.equal(
    p.env.NETCLAW_RUNTIME_ENV,
    path.join(fs.realpathSync(opts.home), ".env"),
  );
  assert.ok(
    p.command.includes(
      "NETCLAW_RUNTIME_ENV=" + path.join(fs.realpathSync(opts.home), ".env"),
    ),
  );
  assert.ok(p.command.includes("'-u' 'NETCLAW_RUNTIME_ENV'"));
  assert.ok(!p.command.includes("/foreign/runtime"));
  const dir = path.join(opts.home, "netclaw-hud/setup");
  fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, "11111111-1111-4111-8111-111111111111.json"),
    "{broken",
  );
  assert.equal(setupHistory(opts.home)[0].state, "unknown");
  await assert.rejects(
    executeSetup(await prepareSetup(opts), {
      guard: async () => {},
      progress: () => {},
    }),
    /unknown outcome/,
  );
});

test("helper refusal preserves custom registration and records failure; lost confirmation after execution stays unknown", async (t) => {
  const opts = fixture(t);
  const initial = await prepareSetup(opts);
  const original = JSON.stringify({
    custom: "keep",
    mcp: {
      servers: {
        [initial.servers[0]]: { command: "operator-owned-command", args: [] },
      },
    },
  });
  fs.writeFileSync(path.join(opts.home, "openclaw.json"), original);
  const conflict = await prepareSetup(opts);
  await assert.rejects(
    executeSetup(conflict, { guard: async () => {}, progress: () => {} }),
    /not verified/,
  );
  assert.equal(
    fs.readFileSync(path.join(opts.home, "openclaw.json"), "utf8"),
    original,
  );
  assert.equal(setupHistory(opts.home)[0].state, "failed");
  const second = fixture(t),
    p = await prepareSetup(second);
  let checks = 0;
  await assert.rejects(
    executeSetup(p, {
      guard: async () => {
        if (++checks === 3) throw Error("changed");
      },
      progress: () => {},
    }),
    /not verified/,
  );
  assert.equal(setupHistory(second.home)[0].state, "unknown");
  assert.ok(
    JSON.parse(fs.readFileSync(path.join(second.home, "openclaw.json"), "utf8"))
      .mcp.servers[p.servers[0]],
  );
  await assert.rejects(
    executeSetup(await prepareSetup(second), {
      guard: async () => {},
      progress: () => {},
    }),
    /unknown outcome/,
  );
});
