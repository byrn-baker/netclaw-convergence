import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { load } from "./load.mjs";
const { HudClient, endpoint } = await load("src/client/hud.ts");
const { AssistantService } = await load("src/assistants/service.ts");
const identity = "22222222-2222-4222-8222-222222222222";
async function fixture(t, handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    requests.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      raw,
    });
    res.setHeader("Content-Type", "application/json");
    const data = await handler(req, res, raw);
    if (!res.writableEnded) res.end(JSON.stringify(data ?? {}));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}
function standard(req, res, raw, kind = "openclaw") {
  if (req.url === "/api/runtime")
    return {
      installationId: identity,
      kind,
      readiness: { ready: true },
      capabilities: { writes: kind === "openclaw" },
    };
  if (req.url === "/api/hud/session") {
    res.setHeader(
      "Set-Cookie",
      `nc_hud_${identity.replaceAll("-", "")}=${"a".repeat(48)}; HttpOnly; SameSite=Strict`,
    );
    return { authenticated: true };
  }
  if (req.url === "/api/chat")
    return { fromGateway: true, response: "Synthetic reply" };
  if (req.url === "/api/chat/conversations")
    return { id: "owned-conversation", thread: "chat-fixture" };
  if (req.url === "/api/chat/requests")
    return { requestId: "owned-request", state: "running" };
  if (req.url === "/api/chat/requests/owned-request")
    return {
      requestId: "owned-request",
      state: "completed",
      output: "Finished",
    };
  return {};
}
test("connection URLs stay loopback with an explicit port", () => {
  assert.equal(endpoint("http://localhost:3001/"), "http://127.0.0.1:3001");
  for (const u of [
    "https://127.0.0.1:3001",
    "http://localhost.evil:3001",
    "http://127.0.0.1:3001/path",
    "http://user@127.0.0.1:3001",
    "http://127.0.0.1:0",
    "http://2130706433:3001",
    "http://127.0.0.1:3001?x",
  ])
    assert.throws(() => endpoint(u));
});
test("owned session and identity header; no Node/backend launcher required", async (t) => {
  const f = await fixture(t, standard),
    cookies = [];
  const c = new HudClient(f.url, identity, async (cookie) =>
    cookies.push(cookie),
  );
  await c.connect();
  const chat = await c.newConversation();
  let prepared = 0;
  await c.send(chat, "Question", "Selected data", async () => prepared++);
  assert.equal(prepared, 1);
  assert.equal(chat.state, "completed");
  assert.equal(chat.messages.at(-1).content, "Synthetic reply");
  const call = f.requests.find((r) => r.url === "/api/chat");
  assert.equal(call.headers["x-netclaw-installation"], identity);
  assert.match(call.headers.cookie, /nc_hud_/);
  assert.match(JSON.parse(call.raw).message, /Selected data/);
  assert.equal(cookies.length, 1);
  c.close();
});
test("changed identity prevents a write", async (t) => {
  let changed = false;
  const f = await fixture(t, (req, res, raw) =>
    req.url === "/api/runtime" && changed
      ? {
          kind: "openclaw",
          installationId: "33333333-3333-4333-8333-333333333333",
          capabilities: {},
        }
      : standard(req, res, raw),
  );
  const c = new HudClient(f.url, identity);
  await c.connect();
  const chat = await c.newConversation();
  changed = true;
  await assert.rejects(c.send(chat, "Do work"), /changed/);
  assert.equal(f.requests.filter((r) => r.url === "/api/chat").length, 0);
});
test("a dropped submitted response stays unknown and is never retried", async (t) => {
  const f = await fixture(t, (req, res, raw) => {
    if (req.url === "/api/chat") {
      req.socket.destroy();
      return;
    }
    return standard(req, res, raw);
  });
  const c = new HudClient(f.url, identity);
  await c.connect();
  const chat = await c.newConversation();
  await assert.rejects(c.send(chat, "Do once"));
  assert.equal(chat.state, "unknown");
  await assert.rejects(c.send(chat, "Do once"), /unresolved/);
  assert.equal(f.requests.filter((r) => r.url === "/api/chat").length, 1);
  c.close();
});
test("redirect is refused and target receives no cookie", async (t) => {
  let leaked = 0;
  const other = await fixture(t, () => {
    leaked++;
    return {};
  });
  const f = await fixture(t, (_req, res) => {
    res.writeHead(302, { Location: other.url + "/api/runtime" });
    res.end();
  });
  await assert.rejects(new HudClient(f.url).connect());
  assert.equal(leaked, 0);
});
test("Hermes returns owned pending work and status updates without replay", async (t) => {
  const f = await fixture(t, (...args) => standard(...args, "hermes"));
  const c = new HudClient(f.url, identity);
  await c.connect();
  const chat = await c.newConversation();
  await c.send(chat, "Calculate");
  assert.equal(chat.state, "running");
  await c.status(chat);
  assert.equal(chat.state, "completed");
  assert.equal(chat.messages.at(-1).content, "Finished");
  assert.equal(
    f.requests.filter((r) => r.url === "/api/chat/requests").length,
    1,
  );
  c.close();
});
test("oversized responses and arbitrary routes are refused", async (t) => {
  const f = await fixture(t, () => ({ data: "x".repeat(4 * 1024 * 1024) }));
  const c = new HudClient(f.url);
  await assert.rejects(c.request("GET", "/api/large"), /limit/);
  await assert.rejects(c.request("GET", "/api/../private"), /Invalid/);
  c.close();
});
test("multipart upload matches the existing file/doc_type route and reports pending", async (t) => {
  const f = await fixture(t, (req, res, raw) =>
    req.url === "/api/rag/upload"
      ? { status: "pending", filename: "guide.md" }
      : standard(req, res, raw),
  );
  const c = new HudClient(f.url, identity);
  await c.connect();
  const result = await c.upload("guide.md", Buffer.from("# Guide"), "vendor");
  assert.equal(result.status, "pending");
  const req = f.requests.find((r) => r.url === "/api/rag/upload");
  assert.match(req.headers["content-type"], /^multipart\/form-data; boundary=/);
  assert.match(req.raw, /name="file"; filename="guide.md"/);
  assert.match(req.raw, /name="doc_type"/);
  assert.doesNotMatch(req.raw, /file_path/);
});
function registration(f) {
  const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), "netclaw-assistant-contract-"),
    ),
    file = path.join(dir, "client.json"),
    value = {
      id: "fixture-client",
      client: "codex",
      url: f.url,
      installationId: identity,
      enabled: true,
      delegate: false,
    };
  fs.writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  return { file, value };
}
test("assistant rejects unknown approval/apply/raw tools and delegation opt-out", async (t) => {
  const f = await fixture(t, standard),
    r = registration(f),
    s = new AssistantService(r.file);
  t.after(() => s.close());
  for (const name of [
    "approve",
    "netclaw_approve",
    "operator_change_apply",
    "netclaw_http",
  ])
    await assert.rejects(s.call(name, {}), /no approval/);
  await assert.rejects(
    s.call("netclaw_request", {
      requestId: "fixture-request",
      prompt: "hello",
    }),
    /disabled/,
  );
  assert.equal(f.requests.filter((r) => r.url === "/api/chat").length, 0);
});
test("assistant proposal is inert and disable rejects cached client", async (t) => {
  const f = await fixture(t, standard),
    r = registration(f),
    s = new AssistantService(r.file);
  t.after(() => s.close());
  const result = await s.call("netclaw_propose_change", {
    domain: "budget",
    summary: "Propose a smaller budget",
  });
  assert.equal(result.state, "draft");
  assert.equal(f.requests.filter((r) => r.method !== "GET").length, 0);
  fs.writeFileSync(r.file, JSON.stringify({ ...r.value, enabled: false }));
  await assert.rejects(s.call("netclaw_status", {}), /disabled/);
});
test("same assistant request ID returns existing result without executing twice", async (t) => {
  const f = await fixture(t, standard),
    r = registration(f);
  fs.writeFileSync(r.file, JSON.stringify({ ...r.value, delegate: true }));
  const s = new AssistantService(r.file);
  t.after(() => s.close());
  const args = { requestId: "stable-request", prompt: "Compute" };
  const a = await s.call("netclaw_request", args),
    b = await s.call("netclaw_request", args);
  assert.equal(a.output, b.output);
  assert.equal(f.requests.filter((r) => r.url === "/api/chat").length, 1);
  await assert.rejects(
    s.call("netclaw_request", { ...args, prompt: "Different" }),
    /different content/,
  );
});
test("concurrent adapter processes cannot submit the same request ID twice", async (t) => {
  const f = await fixture(t, standard),
    r = registration(f);
  fs.writeFileSync(r.file, JSON.stringify({ ...r.value, delegate: true }));
  const a = new AssistantService(r.file),
    b = new AssistantService(r.file);
  t.after(() => {
    a.close();
    b.close();
  });
  const results = await Promise.allSettled([
    a.call("netclaw_request", {
      requestId: "concurrent-request",
      prompt: "Once",
    }),
    b.call("netclaw_request", {
      requestId: "concurrent-request",
      prompt: "Once",
    }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.requests.filter((r) => r.url === "/api/chat").length, 1);
});
