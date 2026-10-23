import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../ui/netclaw-visual/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
function harness(t, product = "defenseclaw") {
  const markup = fs
    .readFileSync("src/views/security.ts", "utf8")
    .match(/`\n([\s\S]*?)`,\n\s*\["resources\/security\.js"\]/)[1];
  const dom = new JSDOM(`<body data-view-id="fixture">${markup}</body>`, {
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const w = dom.window,
    messages = [];
  w.acquireVsCodeApi = () => ({
    getState: () => undefined,
    postMessage: (m) => messages.push(m),
    setState: (state) => {
      assert.deepEqual(Object.keys(state).sort(), ["sequence", "viewId"]);
    },
  });
  w.eval(fs.readFileSync("resources/messaging.js", "utf8"));
  w.eval(fs.readFileSync("resources/security.js", "utf8"));
  const receive = (m) =>
    w.dispatchEvent(
      new w.MessageEvent("message", { data: { viewId: "fixture", ...m } }),
    );
  const snapshot = {
    product,
    target: { product, securityHome: "/fixture" },
    editable: true,
    version: "fixture",
    revision: "revision",
    status: { available: true, data: { running: false } },
    settings: { mode: "action", block_at: "HIGH" },
    connectors: ["openclaw"],
    rules:
      product === "defenseclaw"
        ? {
            allowed: [],
            denied: Array.from({ length: 120 }, (_, i) => ({
              name: "tool_" + i,
              connector: "openclaw",
            })),
          }
        : undefined,
    network:
      product === "openshell"
        ? { existing: { endpoints: [{ host: "approved.example", port: 443 }] } }
        : undefined,
    logs: { available: true, content: "ALLOW read\nBLOCK write" },
  };
  receive({ type: "security", snapshot });
  receive({ type: "busy", busy: false });
  return {
    w,
    receive,
    snapshot,
    messages,
    $: (id) => w.document.getElementById(id),
  };
}
test("Security read-only rules remain searchable and paginated; draft and stale-message fences hold", (t) => {
  const h = harness(t),
    { $, receive, snapshot, w } = h;
  receive({ type: "security-unavailable" });
  assert.equal($("tool-name").disabled, true);
  assert.equal($("rule-filter").disabled, false);
  snapshot.editable = true;
  receive({
    type: "security",
    snapshot: {
      ...snapshot,
      editable: false,
      reason: "Native writer unsupported",
    },
  });
  assert.equal($("tool-name").disabled, true);
  assert.equal($("rule-filter").disabled, false);
  assert.equal($("rules").children.length, 50);
  $("next").click();
  assert.match($("rule-count").textContent, /page 2/);
  $("rule-filter").value = "tool_119";
  $("rule-filter").dispatchEvent(new w.Event("input"));
  assert.equal($("rules").children.length, 1);
  assert.match($("rules").textContent, /tool_119/);
  assert.equal($("rules").querySelector("button"), null);
  receive({ type: "security", snapshot });
  $("tool-name").value = "reviewed_read";
  $("security-reason").value = "Reviewed access";
  $("tool-rule").dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.equal(h.messages.at(-1).operation.name, "reviewed_read");
  receive({
    type: "review",
    summary: "Review",
    weakening: true,
    impact: "Shared",
  });
  receive({ type: "busy", busy: false });
  assert.equal($("security-review").hidden, false);
  $("tool-name").dispatchEvent(new w.Event("input"));
  assert.equal($("security-review").hidden, true);
  receive({
    viewId: "foreign",
    type: "security",
    snapshot: { ...snapshot, editable: false },
  });
  assert.equal($("tool-name").disabled, false);
  receive({ type: "error", message: "Disconnected", invalidated: true });
  receive({ type: "busy", busy: false });
  assert.equal($("apply-security").disabled, true);
  assert.equal($("tool-name").value, "");
  assert.equal($("rules").textContent, "");
  assert.equal($("security-logs").textContent, "");
});
test("OpenShell edits stay in memory, cancel preserves drafts and invalidation removes policy and logs", (t) => {
  const h = harness(t, "openshell"),
    { $, w, receive } = h;
  const draft = JSON.stringify({
    reviewed: { endpoints: [{ host: "draft.example", port: 443 }] },
  });
  $("network-json").value = draft;
  $("network-json").dispatchEvent(new w.Event("input"));
  $("security-reason").value = "Reviewed fixture policy";
  $("preview-network").click();
  assert.equal(h.messages.at(-1).operation.content, draft);
  receive({
    type: "review",
    summary: "Replace",
    weakening: true,
    impact: "Shared",
  });
  receive({ type: "busy", busy: false });
  $("cancel-security").click();
  receive({ type: "cancelled" });
  receive({ type: "busy", busy: false });
  assert.equal($("network-json").value, draft);
  assert.equal($("security-review").hidden, true);
  $("log-filter").value = "block";
  $("log-filter").dispatchEvent(new w.Event("input"));
  assert.equal($("security-logs").textContent, "BLOCK write");
  receive({ type: "error", message: "Connection changed", invalidated: true });
  assert.equal($("network-json").value, "");
  assert.equal($("security-reason").value, "");
  assert.equal($("security-logs").textContent, "");
});

test("security previews reveal enabled Apply and editing another rule cancels the old visible review", (t) => {
  const { $, receive, w } = harness(t);
  receive({ type: "busy", busy: true });
  receive({ type: "review", summary: "Review rule", impact: "Shared" });
  receive({ type: "busy", busy: false });
  assert.equal(w.document.activeElement.id, "apply-security");
  $("rules").querySelector("button").click();
  assert.equal($("security-review").hidden, true);
  assert.equal(w.document.activeElement.id, "tool-name");
});

test("Native permissions and YAML render as text; connector-only writers never enable global/settings edits", (t) => {
  const { $, receive, snapshot } = harness(t);
  receive({
    type: "security",
    snapshot: {
      ...snapshot,
      nativeTools: true,
      editableSettings: false,
      rules: { allowed: [], denied: [{ name: "global", scope: "global" }] },
      permissions: { filesystem: ["/sandbox"] },
      policyYaml: "name: <script>untrusted</script>\n",
      policyLocation: "/profile/config.yaml",
    },
  });
  assert.equal($("permissions-section").hidden, false);
  assert.match($("permissions").textContent, /sandbox/);
  assert.equal($("policy-yaml").querySelector("script"), null);
  assert.match($("policy-yaml").textContent, /<script>/);
  assert.equal($("setting-key").disabled, true);
  assert.equal($("tool-name").disabled, false);
  assert.equal($("tool-connector").value, "openclaw");
  assert.equal($("tool-connector").options[0].disabled, true);
  assert.equal($("rules").querySelector("button"), null);
  receive({ type: "error", invalidated: true, message: "Disconnected" });
  assert.equal($("permissions").textContent, "");
  assert.equal($("policy-yaml").textContent, "");
});
