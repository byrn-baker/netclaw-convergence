import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../ui/netclaw-visual/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");

test("RAG prevents overlapping clicks, resumes explicitly and keeps disconnect final", () => {
  const dom = new JSDOM(
    `<body data-view-id="rag-view">
    <button id="refresh">Refresh</button><button id="upload">Upload</button>
    <button id="chat">Chat</button><button id="canvas">Canvas</button><button id="more">More</button>
    <div id="status"></div><form id="rag-search"><input id="query"><select id="collection"><option>documents</option></select><button id="search">Search</button></form>
    <button id="stage">Stage</button><div id="results"></div><div id="stats"></div><div id="documents"></div>
  </body>`,
    { runScripts: "outside-only" },
  );
  try {
    const { window } = dom,
      messages = [];
    let state;
    window.acquireVsCodeApi = () => ({
      getState: () => state,
      setState: (value) => {
        state = value;
      },
      postMessage: (value) => messages.push(value),
    });
    for (const name of ["messaging.js", "rag.js"])
      window.eval(
        fs.readFileSync(
          new URL("../resources/" + name, import.meta.url),
          "utf8",
        ),
      );
    const el = (id) => window.document.getElementById(id);
    const receive = (data) =>
      window.dispatchEvent(
        new window.MessageEvent("message", {
          data: { viewId: "rag-view", ...data },
        }),
      );
    assert.deepEqual(
      messages.map((m) => m.type),
      ["ready"],
    );
    assert.equal(
      el("search").disabled,
      true,
      "initial inventory must finish first",
    );
    receive({ type: "busy", busy: false });
    el("refresh").click();
    assert.equal(
      el("search").disabled,
      true,
      "refresh blocks an overlapping search",
    );
    el("search").click();
    assert.deepEqual(
      messages.map((m) => m.type),
      ["ready", "refresh"],
    );
    receive({ type: "busy", busy: false });
    assert.deepEqual(
      messages.map((m) => m.type),
      ["ready", "refresh"],
      "no automatic replay",
    );
    el("query").value = "Harmless fixture question";
    el("search").click();
    assert.equal(messages.at(-1).type, "search");
    assert.equal(messages.at(-1).query, "Harmless fixture question");
    receive({ type: "busy", busy: false });
    receive({ type: "error", message: "Backend unavailable" });
    assert.equal(
      el("search").disabled,
      false,
      "failed operation permits an explicit next action",
    );
    el("upload").click();
    assert.equal(
      el("refresh").disabled,
      true,
      "native upload review is serialized",
    );
    receive({ type: "busy", busy: false });
    assert.equal(
      el("refresh").disabled,
      false,
      "cancelled review releases controls",
    );
    receive({
      type: "error",
      message: "Connection changed",
      invalidated: true,
    });
    receive({ type: "busy", busy: false });
    assert.equal(
      el("refresh").disabled,
      true,
      "late completion must not undo invalidation",
    );
    assert.equal(el("search").disabled, true);
    assert.equal(el("stage").disabled, true);
  } finally {
    dom.window.close();
  }
});
