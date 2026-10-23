import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { once } from "node:events";
import { Bindings } from "../../../ui/netclaw-visual/src/hud-server/bindings.js";
import { mountHermesChat } from "../../../ui/netclaw-visual/src/hud-server/runtime/routes.js";
import { load } from "./load.mjs";
const require = createRequire(
    new URL("../../../ui/netclaw-visual/package.json", import.meta.url),
  ),
  express = require("express");
const { HudClient } = await load("src/client/hud.ts");
test("unchanged Hermes ownership, admission, status, stop and nonce recovery", async (t) => {
  const id = "44444444-4444-4444-8444-444444444444",
    bindings = new Bindings(
      fs.mkdtempSync(path.join(os.tmpdir(), "netclaw150-hermes-")),
      Date.now,
      { kind: "hermes", installationId: id },
    );
  const app = express();
  app.use(express.json());
  let submits = 0,
    state = "running",
    unavailable = false;
  const runtime = {
    call: async (name, args) => {
      if (name === "submit") {
        submits++;
        if (unavailable) throw Error("Controlled lost admission response");
        return { requestId: args.requestId, state };
      }
      if (name === "stop") state = "cancelled";
      if (name === "history")
        return {
          messages: [{ role: "assistant", content: "Owned Hermes answer" }],
        };
      return {
        requestId: args.requestId,
        state,
        output: state === "completed" ? "Owned Hermes answer" : "",
      };
    },
  };
  app.get("/api/runtime", (_req, res) =>
    res.json({
      kind: "hermes",
      installationId: id,
      readiness: { ready: true },
      capabilities: { writes: false },
    }),
  );
  app.post("/api/hud/session", (_req, res) =>
    res
      .set(
        "Set-Cookie",
        `${bindings.cookieName}=${bindings.create()}; HttpOnly`,
      )
      .json({ authenticated: true }),
  );
  app.use((req, _res, next) => {
    req.headers.cookie = (req.headers.cookie || "").replace(
      bindings.cookieName + "=",
      "nc_hud=",
    );
    next();
  });
  mountHermesChat(app, { runtime, bindings });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  const c = new HudClient("http://127.0.0.1:" + server.address().port, id);
  t.after(() => c.close());
  await c.connect();
  const chat = await c.newConversation();
  await c.send(chat, "Controlled request");
  assert.equal(chat.state, "running");
  assert.equal(submits, 1);
  const foreign = new HudClient(c.base, id);
  t.after(() => foreign.close());
  await foreign.connect();
  await foreign.session();
  await assert.rejects(
    foreign.request("GET", "/api/chat/requests/" + chat.requestId),
    (e) => e.status === 404,
  );
  const requestId = chat.requestId;
  chat.requestId = undefined;
  state = "completed";
  await c.status(chat);
  assert.equal(chat.requestId, requestId);
  assert.equal(chat.messages.at(-1).content, "Owned Hermes answer");
  assert.equal(submits, 1);
  await c.send(chat, "Second controlled request");
  state = "running";
  await c.stop(chat);
  await c.status(chat);
  assert.equal(chat.state, "cancelled");
  unavailable = true;
  await c.send(chat, "Controlled uncertain request");
  assert.equal(chat.state, "unknown");
  await assert.rejects(c.send(chat, "Never replay"), /unresolved/);
  assert.equal(submits, 3);
});
