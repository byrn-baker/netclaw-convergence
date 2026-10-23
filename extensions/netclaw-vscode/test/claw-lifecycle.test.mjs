import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serviceFixture } from "./claw-fixture.mjs";
import {
  inspectServices,
  prepareLifecycle,
  applyLifecycle,
  reconcile,
} from "../../../scripts/lib/claw-services.mjs";
import {
  json,
  atomic,
  resolveTarget,
} from "../../../scripts/lib/claw-files.mjs";
import { processIdentity } from "../../../scripts/lib/claw-process.mjs";
for (const kind of ["openclaw", "hermes"])
  test(`${kind}: actual owned full lifecycle and offline recovery isolate neighbor`, async () => {
    const f = await serviceFixture(kind),
      neighbor = await serviceFixture(kind);
    try {
      const before = await inspectServices(f.target);
      assert.equal(before.public.available, true, before.public.reason);
      assert.equal(before.public.services.length, 3);
      assert.ok(before.public.services.every((s) => s.state === "ready"));
      const t = await resolveTarget(f.target),
        pids = ["gateway", "hud", "federation"].map(
          (r) => json(path.join(t.state, "services", r + ".process.json")).pid,
        );
      const stop = await prepareLifecycle(f.target, { action: "stop" });
      await assert.rejects(
        applyLifecycle(f.target, { id: stop.id }),
        /acknowledgment/,
      );
      await applyLifecycle(f.target, { id: stop.id, acknowledged: true });
      for (const pid of pids) assert.equal(await processIdentity(pid), null);
      assert.ok(
        (await reconcile(f.target)).services.every(
          (s) => s.state === "stopped",
        ),
      );
      await assert.rejects(fetch(f.url));
      assert.equal((await fetch(neighbor.url)).status, 200);
      const start = await prepareLifecycle(f.target, { action: "start" });
      await applyLifecycle(f.target, { id: start.id, acknowledged: true });
      assert.equal((await fetch(f.url)).status, 200);
      const next = ["gateway", "hud", "federation"].map(
        (r) => json(path.join(t.state, "services", r + ".process.json")).pid,
      );
      assert.ok(next.every((p, i) => p !== pids[i]));
      const restart = await prepareLifecycle(f.target, { action: "restart" });
      const result = await applyLifecycle(f.target, {
        id: restart.id,
        acknowledged: true,
      });
      assert.equal(result.outcome, "verified");
      await assert.rejects(
        applyLifecycle(f.target, { id: restart.id, acknowledged: true }),
        /already attempted/,
      );
      assert.equal(json(result.evidence).steps.length, 6);
    } finally {
      await f.close();
      await neighbor.close();
    }
  });
test("changed scope rejects reviewed lifecycle without stopping anything", async () => {
  const f = await serviceFixture();
  try {
    const r = await prepareLifecycle(f.target, { action: "stop" });
    const p = path.join(
        f.home,
        "netclaw-hud/management/services/federation.json",
      ),
      d = json(p);
    atomic(p, { ...d, health: { ...d.health, url: d.health.url + "/status" } });
    await assert.rejects(
      applyLifecycle(f.target, { id: r.id, acknowledged: true }),
      /scope changed|definition changed/,
    );
    atomic(p, d);
    assert.equal((await fetch(f.url)).status, 200);
  } finally {
    await f.close();
  }
});

test("an interrupted owner leaves an explicit orphan that a fresh reviewed Stop can clean up", async () => {
  const f = await serviceFixture();
  try {
    const t = await resolveTarget(f.target),
      record = json(path.join(t.state, "services/hud.process.json"));
    const identity = await processIdentity(record.pid);
    assert.ok(identity.command.includes(record.nonce));
    process.kill(record.pid, "SIGKILL");
    await new Promise((r) => setTimeout(r, 150));
    const observed = await inspectServices(f.target);
    assert.equal(
      observed.public.services.find((s) => s.role === "hud").state,
      "orphaned",
    );
    assert.equal((await fetch(f.url)).status, 200);
    const stop = await prepareLifecycle(f.target, { action: "stop" });
    await applyLifecycle(f.target, { id: stop.id, acknowledged: true });
    assert.equal(await processIdentity(record.childPid), null);
    await reconcile(f.target);
    const start = await prepareLifecycle(f.target, { action: "start" });
    await applyLifecycle(f.target, { id: start.id, acknowledged: true });
    assert.equal((await fetch(f.url)).status, 200);
  } finally {
    await f.close();
  }
});
