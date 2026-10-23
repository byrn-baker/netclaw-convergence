import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load } from "./load.mjs";
import { securityFixture } from "./security-fixture.mjs";
const { SecurityClient, securityEnvironment, redactSecurity } = await load(
  "src/client/security.ts",
);
function fixture(t, product) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nc151-security-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtime = path.join(root, "runtime");
  fs.mkdirSync(path.join(runtime, "netclaw-hud"), { recursive: true });
  fs.writeFileSync(
    path.join(runtime, "netclaw-hud/installation.json"),
    JSON.stringify({ installationId: "fixture" }),
  );
  const f = securityFixture(root, product, runtime, "fixture");
  const client = new SecurityClient(f.target, path.join(root, "evidence"));
  return { ...f, root, client };
}
test("DefenseClaw: scoped rules/settings use native CAS, preserve unrelated values, redact output and reject stale reviews", async (t) => {
  const f = fixture(t, "defenseclaw");
  let s = await f.client.inspect();
  assert.equal(s.editable, true);
  assert.ok(!JSON.stringify(s).includes("fixture-hidden-token"));
  assert.deepEqual(s.connectors, ["openclaw"]);
  assert.throws(
    () =>
      f.client.prepare(
        { type: "rule", name: "x", action: "allow", connector: "foreign" },
        s.revision,
        "test reason",
      ),
    /configured connector/,
  );
  const p = f.client.prepare(
    { type: "rule", name: "read_file", action: "allow", connector: "openclaw" },
    s.revision,
    "Reviewed read access",
  );
  assert.equal(p.weakening, true);
  assert.match(p.difference, /Before: Absent/);
  assert.match(p.difference, /read_file/);
  const result = await f.client.apply(p, async () => {});
  assert.equal(result.state, "verified");
  const c = JSON.parse(fs.readFileSync(f.config));
  assert.equal(c.unrelated, "preserved");
  assert.equal(c.private.token, "fixture-hidden-token");
  assert.ok(c.asset_policy.tool.allowed.some((r) => r.name === "read_file"));
  assert.equal(fs.statSync(result.original).mode & 0o777, 0o600);
  s = await f.client.inspect();
  const setting = f.client.prepare(
    { type: "setting", key: "mode", value: "observe" },
    s.revision,
    "Temporary observation review",
  );
  assert.equal(setting.weakening, true);
  await f.client.apply(setting, async () => {});
  assert.equal(JSON.parse(fs.readFileSync(f.config)).guardrail.mode, "observe");
  s = await f.client.inspect();
  const stale = f.client.prepare(
    { type: "setting", key: "mode", value: "action" },
    s.revision,
    "Restore enforcement",
  );
  fs.appendFileSync(f.config, "\n");
  await assert.rejects(
    f.client.apply(stale, async () => {}),
    /changed/,
  );
  assert.equal(JSON.parse(fs.readFileSync(f.config)).guardrail.mode, "observe");
});
test("OpenShell: explicit scope, protected network values, preserved non-network policy and global-policy refusal", async (t) => {
  const f = fixture(t, "openshell");
  const s = await f.client.inspect();
  assert.equal(s.editable, true);
  assert.ok(!JSON.stringify(s).includes("fixture-hidden-token"));
  const n = structuredClone(s.network);
  n.extra = {
    endpoints: [
      {
        host: "approved.example",
        port: 443,
        protocol: "rest",
        access: "read-only",
        enforcement: "enforce",
      },
    ],
    binaries: [{ path: "/usr/bin/curl" }],
  };
  const p = f.client.prepare(
    { type: "network", content: JSON.stringify(n) },
    s.revision,
    "Approved endpoint access",
  );
  assert.match(p.difference, /approved.example/);
  assert.ok(!p.difference.includes("fixture-hidden-token"));
  await f.client.apply(p, async () => {});
  const state = JSON.parse(fs.readFileSync(f.state));
  assert.equal(
    state.policy.network_policies.existing.credentials.token,
    "fixture-hidden-token",
  );
  assert.deepEqual(state.policy.filesystem_policy.read_only, ["/usr"]);
  assert.equal(state.policy.process.run_as_user, "sandbox");
  assert.ok(state.policy.network_policies.extra);
  const next = await f.client.inspect();
  const moved = structuredClone(next.network);
  moved.extra.credentials = moved.existing.credentials;
  assert.throws(
    () =>
      f.client.prepare(
        { type: "network", content: JSON.stringify(moved) },
        next.revision,
        "Token transplant refusal",
      ),
    /protected policy/,
  );
  state.source = "global";
  fs.writeFileSync(f.state, JSON.stringify(state));
  const locked = await f.client.inspect();
  assert.equal(locked.editable, false);
  assert.ok(locked.network);
  assert.throws(
    () =>
      f.client.prepare(
        { type: "network", content: "{}" },
        locked.revision,
        "Must be refused",
      ),
    /Reload/,
  );
});
test("Security failures and lost identity stay unknown, refuse replay, and never expose native stderr", async (t) => {
  const f = fixture(t, "defenseclaw");
  const s = await f.client.inspect();
  const p = f.client.prepare(
    { type: "setting", key: "mode", value: "observe" },
    s.revision,
    "Reviewed testing",
  );
  fs.writeFileSync(path.join(f.dir, "refuse-write"), "1");
  await assert.rejects(
    f.client.apply(p, async () => {}),
    (e) =>
      /unknown outcome/.test(e.message) &&
      !e.message.includes("private-fixture-error"),
  );
  fs.unlinkSync(path.join(f.dir, "refuse-write"));
  const next = await f.client.inspect();
  await assert.rejects(
    f.client.apply(
      f.client.prepare(
        { type: "setting", key: "mode", value: "observe" },
        next.revision,
        "Explicit new review",
      ),
      async () => {},
    ),
    /unknown outcome/,
  );
  const g = fixture(t, "openshell"),
    gs = await g.client.inspect();
  const gp = g.client.prepare(
    { type: "network", content: JSON.stringify({}) },
    gs.revision,
    "Policy change review",
  );
  let count = 0;
  await assert.rejects(
    g.client.apply(gp, async () => {
      if (++count === 3) throw Error("identity changed");
    }),
    /unknown outcome/,
  );
  assert.deepEqual(
    JSON.parse(fs.readFileSync(g.state)).policy.network_policies,
    {},
  );
});
test("Security binding preserves real HOME and removes inherited gateway bypasses; unsupported writer is read-only", async (t) => {
  const f = fixture(t, "defenseclaw");
  const prior = process.env.OPENSHELL_GATEWAY_INSECURE;
  process.env.OPENSHELL_GATEWAY_INSECURE = "true";
  t.after(() => {
    if (prior === undefined) delete process.env.OPENSHELL_GATEWAY_INSECURE;
    else process.env.OPENSHELL_GATEWAY_INSECURE = prior;
  });
  const env = securityEnvironment(f.target);
  assert.equal(env.HOME, process.env.HOME);
  assert.equal(env.OPENSHELL_GATEWAY_INSECURE, undefined);
  assert.ok(
    !redactSecurity(
      "authorization: Bearer hidden\nhttps://a:b@example.com?q=secret",
    ).includes("hidden"),
  );
  await assert.rejects(
    Promise.resolve().then(
      () =>
        new SecurityClient(
          { ...f.target, installationId: "foreign" },
          path.join(f.root, "evidence"),
        ),
    ),
    /match/,
  );
  const content = fs
    .readFileSync(f.target.executable, "utf8")
    .replace("out('--expect-sha256 --json')", "out('--json')");
  fs.writeFileSync(f.target.executable, content);
  const s = await f.client.inspect();
  assert.equal(s.editable, false);
  assert.ok(s.rules.denied.length);
  assert.throws(
    () =>
      f.client.prepare(
        { type: "setting", key: "mode", value: "observe" },
        s.revision,
        "Unsupported writer",
      ),
    /Reload/,
  );
});

test("Security scope mismatch and oversized policies stay read-only; shared-target operations serialize", async (t) => {
  const f = fixture(t, "defenseclaw");
  const originalCli = fs.readFileSync(f.target.executable, "utf8");
  fs.writeFileSync(
    f.target.executable,
    originalCli.replace("data_dir:home", "data_dir:'/foreign'"),
  );
  const mismatched = await f.client.inspect();
  assert.equal(mismatched.editable, false);
  assert.match(mismatched.reason, /bound data directory/);
  fs.writeFileSync(f.target.executable, originalCli);
  const s = await f.client.inspect();
  const p = f.client.prepare(
    { type: "setting", key: "mode", value: "observe" },
    s.revision,
    "Concurrency fixture",
  );
  let release, entered;
  const waiting = new Promise((r) => {
    entered = r;
  });
  const gate = new Promise((r) => {
    release = r;
  });
  let guards = 0;
  const first = f.client.apply(p, async () => {
    if (++guards === 2) {
      entered();
      await gate;
    }
  });
  await waiting;
  try {
    await assert.rejects(
      f.client.apply(p, async () => {}),
      /active or interrupted|unknown outcome/,
    );
  } finally {
    release();
  }
  const result = await first;
  assert.equal(result.state, "verified");
  fs.writeFileSync(result.evidence, "{broken");
  const next = await f.client.inspect();
  await assert.rejects(
    f.client.apply(
      f.client.prepare(
        { type: "setting", key: "mode", value: "action" },
        next.revision,
        "Restore after inspection",
      ),
      async () => {},
    ),
    /Unreadable security evidence/,
  );
  const g = fixture(t, "openshell");
  const state = JSON.parse(fs.readFileSync(g.state));
  state.policy.network_policies.large = { description: "x".repeat(140 * 1024) };
  fs.writeFileSync(g.state, JSON.stringify(state));
  const large = await g.client.inspect();
  assert.equal(large.editable, false);
  assert.equal(large.network, undefined);
  assert.match(large.reason, /128 KiB/);
  const env = securityEnvironment(f.target);
  assert.equal(env.DEFENSECLAW_NO_UPDATE_CHECK, "1");
  for (const key of [
    "PYTHONPATH",
    "PYTHONHOME",
    "VIRTUAL_ENV",
    "NODE_OPTIONS",
    "NODE_PATH",
  ])
    assert.equal(env[key], undefined);
});
