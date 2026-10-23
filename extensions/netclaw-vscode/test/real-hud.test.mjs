import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { load } from "./load.mjs";
import { realHud } from "./real-hud-fixture.mjs";
const { HudClient } = await load("src/client/hud.ts");
const { inspect } = await load("src/client/domains.ts");
test(
  "replacement client works with real source HUD (existing contracts): ownership, chat, reads, writes, preservation",
  { timeout: 60000 },
  async (t) => {
    const f = await realHud();
    t.after(f.close);
    const before = fs.readFileSync(f.configPath),
      client = new HudClient(f.url, f.installationId),
      other = new HudClient(f.url, f.installationId);
    t.after(() => {
      client.close();
      other.close();
    });
    assert.equal((await client.connect()).kind, "openclaw");
    const chat = await client.newConversation();
    await client.send(chat, "Synthetic no-tool fixture question");
    assert.equal(chat.state, "completed");
    assert.equal(chat.messages.at(-1).content, "Synthetic gateway reply");
    const list = await client.request("GET", "/api/chat/conversations");
    assert.equal(list.conversations.length, 1);
    const id = list.conversations[0].id;
    const reopened = await client.openConversation(id);
    assert.equal(reopened.thread, chat.thread);
    assert.equal(reopened.messages[1].content, "Owned fixture answer");
    await other.connect();
    await other.session();
    await assert.rejects(other.openConversation(id), /404/);
    assert.equal(
      (await other.request("GET", "/api/chat/conversations")).conversations
        .length,
      0,
    );
    for (const kind of [
      "overview",
      "network",
      "integrations",
      "skills",
      "settings",
      "configuration",
      "tokenomics",
      "budget",
      "security",
      "documentation",
      "logs",
    ]) {
      const observation = await inspect(client, kind);
      assert.equal(observation.installationId, f.installationId);
      assert.doesNotMatch(
        JSON.stringify(observation),
        /fixture-only-token|fixture-not-a-real-key/,
      );
    }
    assert.deepEqual(
      fs.readFileSync(f.configPath),
      before,
      "inspection/chat preserve config",
    );
    const budget = await client.request("GET", "/api/budget/config");
    await client.verifyIdentity();
    await client.request("PUT", "/api/budget/config", {
      budget: { sessionBudgetUsd: 7 },
    });
    const changed = JSON.parse(fs.readFileSync(f.configPath));
    assert.equal(changed.agents.defaults.budget.sessionBudgetUsd, 7);
    assert.equal(changed.agents.defaults.budget.maxToolCallsPerTurn, 20);
    assert.deepEqual(changed.gateway, f.config.gateway);
    await client.request("PUT", "/api/budget/config", {
      budget: { sessionBudgetUsd: budget.budget.sessionBudgetUsd },
    });
    assert.equal(
      JSON.parse(fs.readFileSync(f.configPath)).agents.defaults.budget
        .sessionBudgetUsd,
      5,
    );
    const inventory = await client.request("GET", "/api/hud/configuration"),
      integration = inventory.integrations.find((i) =>
        i.fields.some((f) => f.key === "ANTHROPIC_API_KEY"),
      );
    assert.ok(integration);
    await client.request("PUT", "/api/env", {
      updates: { ANTHROPIC_API_KEY: "replacement-fixture" },
    });
    const masked = await client.request("GET", "/api/hud/configuration");
    assert.ok(!JSON.stringify(masked).includes("replacement-fixture"));
    assert.match(
      fs.readFileSync(path.join(f.home, ".env"), "utf8"),
      /replacement-fixture/,
    );
    const mismatch = new HudClient(
      f.url,
      "33333333-3333-4333-8333-333333333333",
    );
    await assert.rejects(mismatch.connect(), /identity changed|409/i);
    mismatch.close();
    f.setFailure(true);
    const failed = await client.newConversation();
    await assert.rejects(client.send(failed, "Synthetic failed request"));
    assert.equal(failed.state, "unknown");
    const count = f.calls.length;
    await assert.rejects(client.send(failed, "No retry"), /unresolved/);
    assert.equal(f.calls.length, count);
    await client.revoke();
    await assert.rejects(client.openConversation(id), /404/);
    console.log(
      JSON.stringify({
        evidence: "current-worktree-HUD-existing-contracts",
        source: "copied local worktree; synthetic gateway",
        root: f.root,
        gateway: "synthetic local process",
        providerCalls: 0,
        networkDeviceCalls: 0,
        chatCalls: f.calls.length,
      }),
    );
  },
);
