import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../ui/netclaw-visual/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
test("workspace panel renders inert source metadata, serializes controls and never re-enables an invalidated target", () => {
  const dom = new JSDOM(
      '<body data-view-id="fixture"><button data-action="start">Start</button><button data-action="refresh">Refresh</button><div id="workspace-path"></div><div id="loading"></div><div id="service-summary"></div><div id="capability"></div><div id="services"></div><div id="file-list"></div><div id="message"></div></body>',
      { runScripts: "outside-only" },
    ),
    w = dom.window,
    posts = [],
    states = [];
  w.acquireVsCodeApi = () => ({
    getState: () => undefined,
    setState: (s) => states.push(s),
    postMessage: (m) => posts.push(m),
  });
  for (const script of ["messaging.js", "workspace.js"])
    w.eval(
      fs.readFileSync(
        new URL("../resources/" + script, import.meta.url),
        "utf8",
      ),
    );
  const send = (m) =>
    w.dispatchEvent(
      new w.MessageEvent("message", { data: { viewId: "fixture", ...m } }),
    );
  send({
    type: "state",
    data: {
      workspace: "/isolated",
      kind: "openclaw",
      loading: "Session context",
      lifecycle: {
        available: true,
        services: [{ role: "hud", state: "ready" }],
        absent: [],
        activity: "Unknown",
      },
      files: [
        {
          name: "SOUL.md",
          purpose: '<img src="https://invalid/secret">',
          exists: true,
          bytes: 42,
          loadedWhen: "Session",
        },
      ],
    },
  });
  assert.equal(w.document.querySelectorAll("img").length, 0);
  assert.match(w.document.querySelector(".workspace-file").textContent, /<img/);
  w.document.querySelector('[data-action="open"]').click();
  assert.equal(posts.at(-1).name, "SOUL.md");
  assert.equal(posts.at(-1).type, "open");
  send({ type: "busy", busy: true });
  const n = posts.length;
  w.document.querySelector('[data-action="start"]').click();
  assert.equal(posts.length, n);
  send({ type: "error", message: "Selection changed", invalidated: true });
  send({ type: "busy", busy: false });
  assert.ok(
    [...w.document.querySelectorAll("button")].every((b) => b.disabled),
  );
  assert.ok(
    states.every((s) => Object.keys(s).sort().join(",") === "sequence,viewId"),
  );
  assert.ok(!JSON.stringify(states).includes("SOUL"));
  dom.window.close();
});
