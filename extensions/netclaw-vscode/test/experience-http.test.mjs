import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { realHud } from "./real-hud-fixture.mjs";
import { load } from "./load.mjs";
const { HudClient } = await load("src/client/hud.ts");
test("actual HUD strict document/config routes bind installation, preserve secrets and round-trip review/restore", async (t) => {
  const fixture = await realHud();
  t.after(() => fixture.close());
  const client = new HudClient(fixture.url, fixture.installationId);
  t.after(() => client.close());
  await client.connect();
  const file = path.join(fixture.root, "testbed/testbed.yaml");
  fs.writeFileSync(
    file,
    "devices:\n  fixture-router:\n    os: iosxe\n    credentials:\n      default: {username: fixture, password: hidden-151}\n    connections:\n      cli: {protocol: ssh, ip: 192.0.2.1}\n",
  );
  const s = await client.request("GET", "/api/testbed/document");
  assert.equal(s.devices[0].id, "fixture-router");
  assert.ok(!JSON.stringify(s).includes("hidden-151"));
  const unbound = await fetch(fixture.url + "/api/testbed/document");
  assert.equal(unbound.status, 409);
  const request = {
    targetId: s.targetId,
    revision: s.revision,
    operation: {
      type: "update",
      id: "fixture-router",
      fields: { alias: "Core fixture" },
      connection: "cli",
      endpoint: { host: "192.0.2.8" },
    },
  };
  const preview = await client.request("POST", "/api/testbed/preview", request);
  assert.deepEqual(preview.changed, ["fixture-router"]);
  await client.request("PUT", "/api/testbed/document", {
    ...request,
    digest: preview.digest,
    confirm: true,
  });
  assert.ok(fs.readFileSync(file, "utf8").includes("hidden-151"));
  await assert.rejects(
    client.request("PUT", "/api/testbed/document", {
      ...request,
      digest: preview.digest,
      confirm: true,
    }),
    /changed/,
  );
  const env = await client.request("GET", "/api/mcp/configuration");
  assert.ok(!JSON.stringify(env).includes("fixture-not-a-real-key"));
  const saved = await client.request("PUT", "/api/mcp/configuration", {
    integrationId: "netbox",
    revision: env.revision,
    confirm: true,
    changes: {
      NETBOX_URL: { intent: "replace", value: "https://netbox.example" },
      NETBOX_TOKEN: { intent: "replace", value: "secret-fixture-151" },
    },
  });
  assert.equal(saved.saved, true);
  assert.ok(!JSON.stringify(saved).includes("secret-fixture-151"));
  assert.equal(saved.endpointVerified, "unverified");
  assert.ok(
    fs
      .readFileSync(path.join(fixture.home, ".env"), "utf8")
      .includes("ANTHROPIC_API_KEY=fixture-not-a-real-key"),
  );
});
