import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMcpConfiguration } from "../mcp-configuration.js";
import { ENV_MAP } from "../env-map.js";
import { parseEnvData } from "../src/security/private-files.js";
test("every known MCP has a scoped descriptor; aliases and unknown secrets are honest", () => {
  const s = createMcpConfiguration({
    getFile: () => "/missing/fixture.env",
    getValues: () => ({ CVPTOKEN: "sentinel-secret" }),
    mapping: ENV_MAP,
    installationId: "x",
  }).snapshot();
  assert.equal(s.integrations.length, Object.keys(ENV_MAP).length);
  assert.ok(!JSON.stringify(s).includes("sentinel-secret"));
  assert.equal(
    s.integrations
      .find((d) => d.id === "arista")
      .fields.find((f) => f.key === "CVPTOKEN").kind,
    "secret",
  );
  assert.deepEqual(s.integrations.find((d) => d.id === "catc").components, [
    "catalyst-center",
  ]);
  assert.ok(
    !s.integrations
      .find((d) => d.id === "catc")
      .fields.some((f) => f.key === "CCC_PWD"),
  );
  assert.ok(
    s.integrations
      .find((d) => d.id === "pyats")
      .fields.find((f) => f.key === "NETCLAW_PASSWORD")
      .sharedWith.includes("asa"),
  );
});
test("scoped save preserves unrelated values, verifies replacement, rejects stale and cross-card changes", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nc151-env-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, ".env");
  fs.writeFileSync(file, "NETBOX_TOKEN=old-sentinel\nOTHER=keep\n");
  const svc = createMcpConfiguration({
    getFile: () => file,
    getValues: () => parseEnvData(fs.readFileSync(file, "utf8")),
    mapping: ENV_MAP,
    installationId: "x",
  });
  const s = svc.snapshot();
  const req = {
    integrationId: "netbox",
    revision: s.revision,
    confirm: true,
    changes: {
      NETBOX_TOKEN: { intent: "replace", value: "new-sentinel" },
      NETBOX_URL: { intent: "replace", value: "https://netbox.example" },
    },
  };
  const out = svc.save(req);
  assert.equal(out.saved, true);
  assert.equal(out.runtimeLoaded, "unverified");
  assert.ok(!JSON.stringify(out).includes("new-sentinel"));
  assert.equal(parseEnvData(fs.readFileSync(file, "utf8")).OTHER, "keep");
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.throws(() => svc.save(req), /changed/);
  assert.throws(
    () =>
      svc.save({
        ...req,
        revision: out.revision,
        changes: { OTHER: { intent: "clear" } },
      }),
    /belong/,
  );
  const done = svc.save({
    ...req,
    revision: out.revision,
    changes: { NETBOX_TOKEN: { intent: "clear" } },
  });
  assert.equal(done.fields.find((f) => f.key === "NETBOX_TOKEN").isSet, false);
});
