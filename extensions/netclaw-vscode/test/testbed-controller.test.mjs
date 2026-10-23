import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  entryPoints: ["src/views/testbed.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  plugins: [
    {
      name: "panel-fixture",
      setup(build) {
        build.onResolve({ filter: /webview\/panel$/ }, () => ({
          path: "panel",
          namespace: "fixture",
        }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "export const panel = () => __fixturePanel;",
        }));
      },
    },
  ],
});

test("host refuses stale/missing review revisions and reserved defaults edits before any write", async () => {
  let handler;
  const posts = [],
    calls = [],
    confirmations = [];
  const snapshot = {
    source: "fixture.yaml",
    targetId: "target",
    revision: "file-revision",
    devices: [],
  };
  const review = {
    source: "fixture.yaml",
    added: [],
    changed: ["r1"],
    removed: [],
    affected: [],
    digest: "reviewed-digest",
  };
  const client = {
    verifyIdentity: async () => {},
    request: async (method, route, body) => {
      calls.push({ method, route, body });
      return route === "/api/testbed/preview" ? review : snapshot;
    },
  };
  const fixturePanel = {
    bound: { client, current: () => {}, run: (fn) => fn() },
    post: async (m) => posts.push(m),
    onMessage: (_types, fn) => {
      handler = fn;
    },
    view: { onDidDispose: () => {} },
  };
  const vscode = {
    window: {
      showWarningMessage: async (message) => {
        confirmations.push(message);
        return "Save changes";
      },
    },
  };
  const module = { exports: {} };
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  new Function(
    "require",
    "module",
    "exports",
    "__fixturePanel",
    bundle.outputFiles[0].text,
  )(
    (name) => (name === "vscode" ? vscode : require(name)),
    module,
    module.exports,
    fixturePanel,
  );
  module.exports.openTestbed(
    {},
    {
      profile: { label: "fixture" },
      identity: { kind: "openclaw", installationId: "fixture" },
    },
  );
  await handler({ type: "ready" });
  const operation = {
    type: "update",
    id: "r1",
    connection: "ssh",
    endpoint: { host: "192.0.2.11" },
  };
  await handler({ type: "preview", operation, draftRevision: 4 });
  assert.equal(posts.find((p) => p.type === "preview").draftRevision, 4);
  for (const draftRevision of [undefined, 3, 5, "4"])
    await assert.rejects(
      handler({ type: "save", draftRevision }),
      /Preview these changes again/,
    );
  assert.equal(confirmations.length, 0);
  assert.ok(!calls.some((c) => c.method === "PUT"));
  await handler({ type: "save", draftRevision: 4 });
  const write = calls.find((c) => c.method === "PUT");
  assert.equal(write.body.digest, "reviewed-digest");
  assert.deepEqual(write.body.operation, operation);
  assert.ok(
    !("draftRevision" in write.body),
    "the HUD API contract stays unchanged",
  );
  const before = calls.length;
  await assert.rejects(
    handler({
      type: "preview",
      operation: { ...operation, connection: "defaults" },
      draftRevision: 6,
    }),
    /shared pyATS settings/,
  );
  assert.equal(calls.length, before);
});
