import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { load } from "./load.mjs";
const {
  HudClient,
  loadTestbed,
  loadMcpConfiguration,
  requireEditableInventory,
} = await load("test/inventory-client.ts");
const identity = "22222222-2222-4222-8222-222222222222";
async function fixture(t, handler) {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push({
      method: req.method,
      route: req.url,
      installation: req.headers["x-netclaw-installation"],
    });
    const response = handler(req, calls) || [404, { error: "Not found" }];
    res.writeHead(response[0], { "Content-Type": "application/json" });
    res.end(JSON.stringify(response[1]));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const client = new HudClient(
    `http://127.0.0.1:${server.address().port}`,
    identity,
  );
  t.after(() => client.close());
  return { client, calls };
}
const runtime = {
  kind: "openclaw",
  installationId: identity,
  capabilities: {},
};
const oldDevice = {
  id: "fixture",
  alias: "Core",
  os: "iosxe",
  platform: "iol",
  type: "router",
  connection: "ssh",
  protocol: "ssh",
  host: "192.0.2.9",
  port: 2222,
  credentials: { password: "must-not-render" },
  extra: "must-not-render",
};

test("older HUD returns useful read-only testbed details without raw YAML or writes", async (t) => {
  const { client, calls } = await fixture(t, (req) =>
    req.url === "/api/runtime"
      ? [200, runtime]
      : req.url === "/api/terminal/devices"
        ? [200, { devices: [oldDevice] }]
        : undefined,
  );
  const snapshot = await loadTestbed(client);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.devices[0].connections[0].port, 2222);
  assert.equal(snapshot.devices[0].connections[0].host, "192.0.2.9");
  assert.equal(snapshot.devices[0].alias, "Core");
  assert.ok(!JSON.stringify(snapshot).includes("must-not-render"));
  assert.ok(!("content" in snapshot));
  assert.ok(!("revision" in snapshot));
  assert.throws(() => requireEditableInventory(snapshot), /read-only/);
  assert.ok(
    calls.every(
      (c) =>
        c.method === "GET" &&
        !c.route.includes("raw") &&
        c.installation === identity,
    ),
  );
});

test("older MCP view projects presence metadata only and never invokes its environment writer", async (t) => {
  const { client, calls } = await fixture(t, (req) =>
    req.url === "/api/runtime"
      ? [200, runtime]
      : req.url === "/api/hud/configuration"
        ? [
            200,
            {
              environmentFile: "fixture.env",
              integrations: [
                {
                  id: "netbox",
                  notes: "Help",
                  fields: [
                    {
                      key: "NETBOX_TOKEN",
                      isSet: true,
                      value: "must-not-render",
                    },
                  ],
                },
              ],
              secret: "must-not-render",
            },
          ]
        : undefined,
  );
  const snapshot = await loadMcpConfiguration(client);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.integrations[0].fields[0].isSet, true);
  assert.ok(!JSON.stringify(snapshot).includes("must-not-render"));
  assert.ok(calls.every((c) => c.method === "GET"));
  assert.throws(() => requireEditableInventory(snapshot), /read-only/);
});

test("modern HUD keeps full editors and does not request compatibility endpoints", async (t) => {
  const { client, calls } = await fixture(t, (req) => [
    200,
    req.url.includes("testbed")
      ? { source: "testbed.yaml", revision: "revision", devices: [] }
      : { source: ".env", revision: "revision", integrations: [] },
  ]);
  requireEditableInventory(await loadTestbed(client));
  requireEditableInventory(await loadMcpConfiguration(client));
  assert.deepEqual(
    calls.map((c) => c.route),
    ["/api/testbed/document", "/api/mcp/configuration"],
  );
});

test("an already-running HUD cannot project pyATS defaults as an editable connection", async (t) => {
  const devices = [
    {
      id: "r1",
      connections: [
        { name: "defaults", host: "", protocol: "" },
        { name: "ssh", host: "192.0.2.101", protocol: "ssh", port: 22 },
        {
          name: "console",
          host: "console.example",
          protocol: "telnet",
          port: 2300,
        },
      ],
    },
  ];
  const { client } = await fixture(t, () => [
    200,
    { source: "testbed.yaml", revision: "old-HUD", devices },
  ]);
  const snapshot = await loadTestbed(client);
  assert.deepEqual(
    snapshot.devices[0].connections,
    devices[0].connections.slice(1),
  );
  assert.equal(snapshot.readOnly, undefined);
});

for (const status of [401, 403, 409, 500, 503])
  test(`HTTP ${status} never downgrades to a compatibility view`, async (t) => {
    const { client, calls } = await fixture(t, () => [
      status,
      { error: "Real failure" },
    ]);
    await assert.rejects(loadTestbed(client), /Real failure/);
    await assert.rejects(loadMcpConfiguration(client), /Real failure/);
    assert.equal(calls.length, 2);
  });

test("identity change during a legacy read refuses inventory from a different installation", async (t) => {
  let reads = 0;
  const { client } = await fixture(t, (req) =>
    req.url === "/api/runtime"
      ? [
          200,
          {
            ...runtime,
            installationId:
              ++reads > 1 ? "33333333-3333-4333-8333-333333333333" : identity,
          },
        ]
      : req.url === "/api/terminal/devices"
        ? [200, { devices: [oldDevice] }]
        : undefined,
  );
  await assert.rejects(loadTestbed(client), /installation or harness changed/);
});

test("malformed inventory is an error, while an explicit empty list remains empty", async (t) => {
  let valid = false;
  const { client } = await fixture(t, (req) =>
    req.url === "/api/runtime"
      ? [200, runtime]
      : req.url === "/api/terminal/devices"
        ? [200, valid ? { devices: [] } : {}]
        : undefined,
  );
  await assert.rejects(loadTestbed(client), /invalid inventory/);
  valid = true;
  assert.deepEqual((await loadTestbed(client)).devices, []);
});
