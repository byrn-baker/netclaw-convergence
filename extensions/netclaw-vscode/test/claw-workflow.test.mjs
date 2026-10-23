import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serviceFixture, fileFixture } from "./claw-fixture.mjs";
import {
  readManaged,
  prepareWrite,
  applyWrite,
  json,
  atomic,
  resolveTarget,
} from "../../../scripts/lib/claw-files.mjs";
import {
  prepareLifecycle,
  applyLifecycle,
  reconcile,
} from "../../../scripts/lib/claw-services.mjs";
function pid(f) {
  return json(
    path.join(f.home, "netclaw-hud/management/services/hud.process.json"),
  ).pid;
}
test("combined review requires exactly verified saved revision; Save alone never restarts", async () => {
  const f = await serviceFixture();
  try {
    const original = pid(f),
      before = await readManaged(f.target, "USER.md");
    const write = await prepareWrite(f.target, {
      name: "USER.md",
      baseline: before.revision,
      content: "saved",
    });
    const restart = await prepareLifecycle(f.target, {
      action: "restart",
      writeReviewId: write.id,
    });
    await assert.rejects(
      applyLifecycle(f.target, { id: restart.id, acknowledged: true }),
      /save|ENOENT/i,
    );
    assert.equal(pid(f), original);
    await reconcile(f.target);
    await applyWrite(f.target, { ...write, content: "saved" });
    assert.equal(pid(f), original);
    const r = await prepareLifecycle(f.target, {
      action: "restart",
      writeReviewId: write.id,
    });
    fs.writeFileSync(path.join(f.workspace, "USER.md"), "external-after-save");
    await assert.rejects(
      applyLifecycle(f.target, { id: r.id, acknowledged: true }),
      /revision changed/,
    );
    assert.equal(pid(f), original);
    await reconcile(f.target);
    const b = await readManaged(f.target, "USER.md"),
      w = await prepareWrite(f.target, {
        name: "USER.md",
        baseline: b.revision,
        content: "combined",
      }),
      review = await prepareLifecycle(f.target, {
        action: "restart",
        writeReviewId: w.id,
      });
    await applyWrite(f.target, { ...w, content: "combined" });
    await applyLifecycle(f.target, { id: review.id, acknowledged: true });
    assert.notEqual(pid(f), original);
    assert.equal((await readManaged(f.target, "USER.md")).content, "combined");
  } finally {
    await f.close();
  }
});
test("failed replacement, unknown readback and recovery are durable and never blind retries", async () => {
  const f = fileFixture("hermes"),
    before = await readManaged(f.target, "USER.md");
  const r = await prepareWrite(f.target, {
    name: "USER.md",
    baseline: before.revision,
    content: "unknown-test",
  });
  const original = fs.renameSync;
  let swapped = false;
  fs.renameSync = (a, b) => {
    original(a, b);
    if (b === path.join(f.workspace, "USER.md")) {
      swapped = true;
      fs.writeFileSync(b, Buffer.from([255]));
    }
  };
  try {
    await assert.rejects(
      applyWrite(f.target, { ...r, content: "unknown-test" }),
      /unknown/i,
    );
  } finally {
    fs.renameSync = original;
  }
  assert.equal(swapped, true);
  const t = await resolveTarget(f.target),
    journal = json(path.join(t.state, "operations", r.id + ".json"));
  assert.equal(journal.phase, "unknown");
  assert.equal(fs.readFileSync(journal.backup, "utf8"), before.content);
  await assert.rejects(
    prepareWrite(f.target, {
      name: "TOOLS.md",
      baseline: (await readManaged(f.target, "TOOLS.md")).revision,
      content: "next",
    }),
    /unresolved/,
  );
  fs.writeFileSync(path.join(f.workspace, "USER.md"), "unknown-test");
  await reconcile(f.target);
  assert.equal(
    json(path.join(t.state, "operations", r.id + ".json")).phase,
    "verified",
  );
  await assert.rejects(
    applyWrite(f.target, { ...r, content: "unknown-test" }),
    /already attempted/,
  );
});
test("read-only target rejects replacement without changing contents; no delete dispatch", async () => {
  const f = fileFixture();
  const b = await readManaged(f.target, "USER.md");
  fs.chmodSync(path.join(f.workspace, "USER.md"), 0o400);
  const current = await readManaged(f.target, "USER.md");
  const r = await prepareWrite(f.target, {
    name: "USER.md",
    baseline: current.revision,
    content: "",
  });
  await assert.rejects(
    applyWrite(f.target, { ...r, content: "" }),
    /not writable/,
  );
  assert.equal(
    fs.readFileSync(path.join(f.workspace, "USER.md"), "utf8"),
    b.content,
  );
  const { spawnSync } = await import("node:child_process");
  const out = spawnSync(
    process.execPath,
    [path.join(f.target.root, "scripts/claw-control.mjs")],
    {
      input: JSON.stringify({
        op: "delete",
        target: f.target,
        input: { name: "USER.md" },
      }),
      encoding: "utf8",
    },
  );
  assert.equal(JSON.parse(out.stdout).ok, false);
  assert.ok(fs.existsSync(path.join(f.workspace, "USER.md")));
});
