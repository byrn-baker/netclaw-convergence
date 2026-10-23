import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { realHud } from "./real-hud-fixture.mjs";
const require = createRequire(
  new URL("../../../ui/netclaw-visual/package.json", import.meta.url),
);
const { Client } = await import(
  pathToFileURL(require.resolve("@modelcontextprotocol/client"))
);
const { StdioClientTransport } = await import(
  pathToFileURL(require.resolve("@modelcontextprotocol/client/stdio"))
);
test("bundled official MCP transport against source HUD; no approval/apply surface", async (t) => {
  const f = await realHud();
  t.after(f.close);
  const registration = path.join(f.root, "mcp.json"),
    value = {
      id: "stdio-acceptance",
      client: "codex",
      installationId: f.installationId,
      url: f.url,
      enabled: true,
      delegate: true,
    };
  fs.writeFileSync(registration, JSON.stringify(value), { mode: 0o600 });
  const client = new Client({
      name: "netclaw-extension-acceptance",
      version: "1.0.0",
    }),
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        path.resolve("dist/assistant.mjs"),
        "--registration",
        registration,
      ],
      stderr: "pipe",
    });
  t.after(() => client.close());
  await client.connect(transport);
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "netclaw_inspect",
    "netclaw_propose_change",
    "netclaw_request",
    "netclaw_request_status",
    "netclaw_status",
  ]);
  const call = (name, args = {}) =>
    client.callTool({ name, arguments: args }, { timeout: 30000 });
  assert.equal(
    (await call("netclaw_status")).structuredContent.installationId,
    f.installationId,
  );
  assert.equal(
    (
      await call("netclaw_propose_change", {
        domain: "budget",
        summary: "Consider a lower budget",
      })
    ).structuredContent.state,
    "draft",
  );
  assert.equal(f.calls.length, 0);
  assert.equal(
    (
      await call("netclaw_request", {
        requestId: "stdio-once",
        prompt: "Say fixture hello",
      })
    ).structuredContent.state,
    "completed",
  );
  await call("netclaw_request", {
    requestId: "stdio-once",
    prompt: "Say fixture hello",
  });
  assert.equal(f.calls.length, 1);
  await assert.rejects(call("netclaw_apply"), /not found/);
  assert.equal(
    (await call("netclaw_inspect", { kind: "overview", url: "/api/env" }))
      .isError,
    true,
  );
  fs.writeFileSync(registration, JSON.stringify({ ...value, enabled: false }));
  assert.equal((await call("netclaw_status")).isError, true);
});
