import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(
  new URL("../../../ui/netclaw-visual/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
async function harness(t, kind, html) {
  const dom = new JSDOM(`<body data-view-id="v">${html}</body>`, {
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const w = dom.window,
    messages = [];
  w.acquireVsCodeApi = () => ({
    getState: () => undefined,
    setState: () => {},
    postMessage: (m) => messages.push(m),
  });
  w.eval(fs.readFileSync("resources/messaging.js", "utf8"));
  if (kind === "canvas") {
    const result = await build({
      entryPoints: ["webview/canvas.js"],
      bundle: true,
      write: false,
      format: "iife",
    });
    w.eval(result.outputFiles[0].text);
  } else w.eval(fs.readFileSync(`resources/${kind}.js`, "utf8"));
  return {
    w,
    messages,
    $: (id) => w.document.getElementById(id),
    receive: (m) =>
      w.dispatchEvent(
        new w.MessageEvent("message", { data: { viewId: "v", ...m } }),
      ),
  };
}
test("Chat serializes toolbar and Send, recovers cancellation/errors, and ignores late state after disconnect", async (t) => {
  const h = await harness(
    t,
    "chat",
    ["refresh", "new", "settings", "cancel", "history", "send"]
      .map((id) => `<button id="${id}"></button>`)
      .join("") +
      '<form id="composer"><textarea id="prompt"></textarea><input id="retain" type="checkbox"></form><p id="status"></p><div id="transcript"></div><div id="contexts"></div>',
  );
  const { $, receive, w } = h;
  const ready = {
    type: "state",
    state: "completed",
    contexts: [],
    saved: {},
    messages: [],
    busy: false,
  };
  assert.equal($("send").disabled, true);
  receive(ready);
  for (const id of ["refresh", "new", "history", "settings"]) {
    $(id).click();
    assert.equal(h.messages.at(-1).type, id);
    assert.equal($("send").disabled, true);
    const count = h.messages.length;
    $("new").click();
    assert.equal(h.messages.length, count);
    receive(ready);
  }
  $("prompt").value = "Explicit fixture request";
  $("composer").dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.equal(h.messages.at(-1).type, "send");
  receive({ type: "error", message: "Before admission failure" });
  assert.equal($("send").disabled, false);
  receive({ ...ready, state: "unknown", saved: { pendingNonce: "pending" } });
  assert.equal($("send").disabled, true);
  assert.equal($("refresh").disabled, false);
  receive({ ...ready, state: "running", canStop: true });
  $("cancel").click();
  assert.equal(h.messages.at(-1).type, "cancel");
  receive({ type: "error", message: "Connection changed", invalidated: true });
  receive(ready);
  assert.equal($("send").disabled, true);
  assert.equal($("new").disabled, true);
});
test("Canvas serializes actions, releases Send on an unchanged failed request snapshot, and fences unresolved/disconnected lanes", async (t) => {
  const h = await harness(
    t,
    "canvas",
    ["save", "open", "import", "export", "refresh"]
      .map((id) => `<button id="${id}"></button>`)
      .join("") + '<p id="status"></p><div id="lanes"></div>',
  );
  const { $, receive } = h;
  const document = {
    v: 1,
    nodes: [{ id: "root", kind: "chat", messages: [] }],
  };
  receive({ type: "document", document });
  receive({ type: "requests", requests: {} });
  receive({ type: "busy", busy: false });
  const send = () => h.w.document.querySelector('[data-send-node="root"]');
  $("draft-root").value = "Fixture request";
  send().click();
  assert.equal(h.messages.at(-1).type, "send");
  const before = h.messages.length;
  $("save").click();
  assert.equal(h.messages.length, before);
  receive({ type: "requests", requests: {} });
  receive({ type: "busy", busy: false });
  receive({
    type: "error",
    message: "Connection unavailable before admission",
  });
  assert.equal(send().disabled, false);
  for (const id of ["save", "open", "import", "export", "refresh"]) {
    $(id).click();
    assert.equal(h.messages.at(-1).type, id);
    receive({ type: "busy", busy: false });
    assert.equal($(id).disabled, false);
  }
  receive({ type: "requests", requests: { root: { state: "unknown" } } });
  assert.equal(send().disabled, true);
  receive({ type: "requests", requests: { root: { state: "interrupted" } } });
  assert.equal(send().disabled, false);
  receive({ type: "error", message: "Disconnected", invalidated: true });
  receive({ type: "document", document });
  receive({ type: "busy", busy: false });
  assert.equal(send().disabled, true);
  assert.equal($("save").disabled, true);
});
