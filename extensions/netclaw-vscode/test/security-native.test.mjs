import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { load } from "./load.mjs";
import { securityFixture } from "./security-fixture.mjs";
const { SecurityClient } = await load("src/client/security.ts");
const { nativeToolRules, parseOpenShellPolicy } = await load(
  "src/client/security-formats.ts",
);
function fixture(t, product) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "netclaw-native-contract-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "runtime");
  fs.mkdirSync(path.join(home, "netclaw-hud"), { recursive: true });
  fs.writeFileSync(
    path.join(home, "netclaw-hud/installation.json"),
    JSON.stringify({ installationId: "fixture" }),
  );
  return { ...securityFixture(root, product, home, "fixture"), root };
}
test("Installed CLI formats: empty YAML maps, rejected aliases/duplicates and actual allow/block statuses", () => {
  const header = "Version: 1\nActive: 0\nStatus: Loaded\n---\n";
  assert.deepEqual(
    parseOpenShellPolicy(header + "version: 1\n", "one").policy
      .network_policies,
    {},
  );
  for (const yaml of [
    "network_policies: []",
    "network_policies: {}\nnetwork_policies: {}",
    "a: &a [1]\nnetwork_policies: {x: *a}",
  ])
    assert.throws(() => parseOpenShellPolicy(header + yaml, "one"));
  assert.throws(() =>
    parseOpenShellPolicy("Version: unknown\n---\nversion: 1", "one"),
  );
  const row = {
    name: "tool",
    scope: "global",
    status: "block",
    reason: "reviewed",
  };
  const rules = nativeToolRules(
    ["openclaw", "hermes"].map((connector) => ({
      connector,
      tools: [{ ...row, connector }],
    })),
  );
  assert.equal(rules.denied.length, 1);
  assert.equal(rules.denied[0].connector, "");
  assert.throws(() =>
    nativeToolRules([{ tools: [{ ...row, status: "unknown" }] }]),
  );
});
test("DefenseClaw 0.8.4 native tools: connector edits preserve global/source rows and refuse stale reviews/settings", async (t) => {
  const f = fixture(t, "defenseclaw"),
    calls = [];
  fs.writeFileSync(
    path.join(f.target.securityHome, "audit.db"),
    "fixture database",
  );
  const config = {
    data_dir: f.target.securityHome,
    audit_db: path.join(f.target.securityHome, "audit.db"),
    guardrail: { mode: "action" },
    asset_policy: { mode: "observe" },
    api_key: "hidden-native-key",
  };
  fs.writeFileSync(f.config, JSON.stringify(config));
  let rows = [
    {
      name: "global_tool",
      scope: "global",
      connector: "openclaw",
      status: "block",
      reason: "global",
    },
    {
      name: "source/tool",
      scope: "source",
      connector: null,
      status: "allow",
      reason: "audit only",
    },
  ];
  const runner = async (_file, args) => {
    calls.push(args);
    if (args[0] === "--version") return "defenseclaw, version 0.8.4";
    if (args[0] === "status")
      return JSON.stringify({
        data_dir: f.target.securityHome,
        connectors: [{ name: "openclaw" }],
      });
    if (args[0] === "config" && args[1] === "show")
      return JSON.stringify(config);
    if (args[0] !== "tool") throw Error("unsupported");
    if (args.includes("--help")) return "--connector --reason";
    if (args[1] === "list")
      return JSON.stringify([{ connector: "openclaw", tools: rows }]);
    assert.equal(args[args.indexOf("--connector") + 1], "openclaw");
    rows = rows.filter((r) => r.scope !== "connector" || r.name !== args[2]);
    if (args[1] !== "unblock")
      rows.push({
        name: args[2],
        connector: "openclaw",
        scope: "connector",
        status: args[1],
        reason: args.at(-1),
      });
    return "Saved";
  };
  const client = new SecurityClient(
    f.target,
    path.join(f.root, "evidence"),
    runner,
  );
  let snapshot = await client.inspect(false);
  assert.equal(snapshot.nativeTools, true);
  assert.equal(snapshot.editableSettings, false);
  assert.ok(snapshot.policyYaml);
  assert.ok(!JSON.stringify(snapshot).includes("hidden-native-key"));
  assert.throws(
    () =>
      client.prepare(
        { type: "rule", action: "block", name: "tool", connector: "" },
        snapshot.revision,
        "Reason",
      ),
    /connector/,
  );
  assert.throws(
    () =>
      client.prepare(
        { type: "setting", key: "mode", value: "observe" },
        snapshot.revision,
        "Reason",
      ),
    /view-only/,
  );
  for (const action of ["block", "allow", "remove"]) {
    snapshot = await client.inspect(false);
    const p = client.prepare(
      { type: "rule", action, name: "tool", connector: "openclaw" },
      snapshot.revision,
      "Reviewed change",
    );
    assert.equal((await client.apply(p, async () => {})).state, "verified");
    assert.equal(rows.filter((r) => r.scope !== "connector").length, 2);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.config)), config);
  }
  snapshot = await client.inspect(false);
  const stale = client.prepare(
    { type: "rule", action: "block", name: "tool", connector: "openclaw" },
    snapshot.revision,
    "Reviewed change",
  );
  rows.push({
    name: "external",
    scope: "connector",
    connector: "openclaw",
    status: "block",
    reason: "external writer",
  });
  await assert.rejects(
    client.apply(stale, async () => {}),
    /changed/,
  );
  assert.ok(!calls.some((args) => args[0] === "config" && args[1] === "set"));
});
test("OpenShell 0.0.32: no workspace flag, YAML readback, preserved permissions and fail-closed global scope", async (t) => {
  const f = fixture(t, "openshell");
  let policy = {
      version: 1,
      filesystem_policy: { read_only: ["/usr"] },
      process: { run_as_user: "sandbox" },
    },
    version = 1,
    global = "absent";
  const runner = async (_file, args) => {
    assert.ok(!args.includes("--workspace"));
    if (args[0] === "--help") return "--gateway";
    assert.deepEqual(args.slice(0, 2), ["--gateway", "fixture-gateway"]);
    const cmd = args.slice(2);
    if (cmd[0] === "--version") return "openshell 0.0.32";
    if (cmd[0] === "status") return "Gateway ready";
    if (cmd[0] !== "policy") throw Error("unsupported");
    if (cmd.includes("--help")) return "--full --global";
    if (cmd.includes("--global")) {
      if (global === "present") return "Global policy";
      throw Object.assign(Error("withheld"), {
        missingGlobalPolicy: global === "absent",
      });
    }
    if (cmd[1] === "get")
      return `Version: ${version}\nActive: ${version === 1 ? 0 : version}\nStatus: Loaded\n---\n${JSON.stringify(policy)}`;
    assert.equal(cmd[1], "set");
    policy = JSON.parse(fs.readFileSync(cmd[cmd.indexOf("--policy") + 1]));
    version++;
    return "Loaded";
  };
  const client = new SecurityClient(
    f.target,
    path.join(f.root, "evidence"),
    runner,
  );
  const first = await client.inspect(false);
  assert.equal(first.editable, true);
  assert.deepEqual(first.network, {});
  const network = {
    read: {
      endpoints: [{ host: "example.com", port: 443 }],
      binaries: [{ path: "/usr/bin/curl" }],
    },
  };
  const review = client.prepare(
    { type: "network", content: JSON.stringify(network) },
    first.revision,
    "Reviewed endpoint",
  );
  assert.equal((await client.apply(review, async () => {})).state, "verified");
  assert.deepEqual(policy.filesystem_policy, { read_only: ["/usr"] });
  assert.deepEqual(policy.process, { run_as_user: "sandbox" });
  for (global of ["present", "unreachable"]) {
    const s = await client.inspect(false);
    assert.equal(s.editable, false);
    assert.ok(s.policyYaml);
    assert.deepEqual(s.network, network);
  }
});
