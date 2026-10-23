import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../resources/messaging.js", import.meta.url),
  "utf8",
);
const copy = (value) => JSON.parse(JSON.stringify(value));

test("revealing a recreated webview continues its accepted message sequence", () => {
  let saved;
  const delivered = [];
  const api = {
    getState: () => saved,
    setState: (value) => (saved = copy(value)),
    postMessage: (value) => {
      assert.equal(saved.sequence, Number(value.requestId));
      delivered.push(copy(value));
    },
  };
  const mount = () => {
    const window = {};
    vm.runInNewContext(source, { window });
    return window.netclawPost(api, "same-panel");
  };
  const original = mount();
  original("ready");
  original("refresh");
  // The hidden document and all its script variables are destroyed.
  const revealed = mount();
  revealed("ready");
  revealed("send", { payload: { text: "explicit new request" } });
  assert.deepEqual(
    delivered.map((m) => m.requestId),
    ["1", "2", "3", "4"],
  );
  assert.equal(delivered[3].payload.text, "explicit new request");
  assert.deepEqual(saved, { viewId: "same-panel", sequence: 4 });
});

test("a different panel does not inherit another panel's message state", () => {
  const window = {};
  vm.runInNewContext(source, { window });
  let delivered;
  const post = window.netclawPost(
    {
      getState: () => ({ viewId: "old-panel", sequence: 120 }),
      setState: () => {},
      postMessage: (value) => (delivered = copy(value)),
    },
    "new-panel",
  );
  post("ready", { viewId: "old-panel", requestId: "120" });
  assert.deepEqual(delivered, {
    viewId: "new-panel",
    requestId: "1",
    type: "ready",
  });
});
