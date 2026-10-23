import test from "node:test";
import assert from "node:assert/strict";
import { realHud } from "./real-hud-fixture.mjs";
import { load } from "./load.mjs";
const { HudClient } = await load("src/client/hud.ts");
test(
  "actual unchanged RAG upload and cited retrieval with local cached embeddings",
  { skip: !process.env.NETCLAW_TEST_RAG_PYTHON, timeout: 240000 },
  async (t) => {
    const f = await realHud({
      ragPython: process.env.NETCLAW_TEST_RAG_PYTHON,
      ragCache: process.env.NETCLAW_TEST_RAG_CACHE,
    });
    t.after(f.close);
    const c = new HudClient(f.url, f.installationId);
    t.after(() => c.close());
    await c.connect();
    const before = await c.request("GET", "/api/rag/stats", undefined, 90000);
    assert.equal(before.document_count, 0);
    const result = await c.upload(
      "extension-proof.md",
      Buffer.from(
        "# Extension recovery\n\nThe lab maintenance window is violet Thursday. Capture a baseline before any change.\n",
      ),
      "customer",
    );
    assert.equal(result.status, "pending");
    let doc;
    const until = Date.now() + 150000;
    while (Date.now() < until) {
      const listing = await c.request(
        "GET",
        "/api/rag/documents",
        undefined,
        90000,
      );
      doc = listing.documents.find((d) => d.title === "extension-proof.md");
      if (doc && ["ready", "failed"].includes(doc.ingest_status)) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.equal(doc?.ingest_status, "ready", JSON.stringify(doc));
    const found = await c.request(
      "POST",
      "/api/rag/search",
      {
        query: "When is the maintenance window?",
        collection: "documents",
        k: 3,
      },
      150000,
    );
    assert.ok(found.results.length);
    assert.match(found.results[0].chunk_text, /violet Thursday/);
    assert.ok(found.results[0].citation);
    assert.equal(f.calls.length, 0);
    console.log(
      JSON.stringify({
        evidence:
          "real unchanged HUD + actual RAG MCP + cached local embeddings",
        root: f.root,
        documents: 1,
        citations: found.results.length,
        providerCalls: 0,
      }),
    );
  },
);
