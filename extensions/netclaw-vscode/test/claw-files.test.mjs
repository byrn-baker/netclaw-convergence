import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileFixture } from "./claw-fixture.mjs";
import {
  inspectFiles,
  readManaged,
  prepareWrite,
  applyWrite,
  resolveTarget,
  FILES,
} from "../../../scripts/lib/claw-files.mjs";
for (const kind of ["openclaw", "hermes"])
  test(`${kind}: exact six-file reads and verified updates preserve neighbors and private recovery`, async () => {
    const f = fileFixture(kind);
    const target = await resolveTarget(f.target);
    assert.equal(target.workspace, f.workspace);
    const catalog = await inspectFiles(f.target);
    assert.equal(catalog.files.length, 6);
    if (kind === "hermes") assert.match(catalog.loading, /not load/i);
    for (const file of FILES) {
      const before = await readManaged(f.target, file.name);
      const neighbors = Object.fromEntries(
        FILES.filter((x) => x.name !== file.name).map((x) => [
          x.name,
          fs.readFileSync(path.join(f.workspace, x.name)),
        ]),
      );
      const content = "\uFEFF# Montréal 🦞\r\nexact bytes\r\n";
      const review = await prepareWrite(f.target, {
        name: file.name,
        baseline: before.revision,
        content,
      });
      const result = await applyWrite(f.target, { ...review, content });
      assert.equal(result.outcome, "verified");
      assert.equal((await readManaged(f.target, file.name)).content, content);
      assert.equal(fs.readFileSync(result.backup, "utf8"), before.content);
      assert.equal(fs.statSync(result.backup).mode & 0o777, 0o600);
      for (const [name, bytes] of Object.entries(neighbors))
        assert.deepEqual(fs.readFileSync(path.join(f.workspace, name)), bytes);
      const journal = fs.readFileSync(result.evidence, "utf8");
      assert.ok(
        !journal.includes("Montréal") && !journal.includes(before.content),
      );
    }
  });
test("stale reviews, identity changes and unsafe destinations never replace files", async () => {
  const f = fileFixture();
  const before = await readManaged(f.target, "USER.md");
  const r = await prepareWrite(f.target, {
    name: "USER.md",
    baseline: before.revision,
    content: "draft",
  });
  fs.writeFileSync(path.join(f.workspace, "USER.md"), "external");
  await assert.rejects(
    applyWrite(f.target, { ...r, content: "draft" }),
    /changed|conflict/i,
  );
  assert.equal(
    fs.readFileSync(path.join(f.workspace, "USER.md"), "utf8"),
    "external",
  );
  await assert.rejects(
    readManaged(f.target, "../USER.md"),
    /managed|filename/i,
  );
  fs.renameSync(
    path.join(f.workspace, "TOOLS.md"),
    path.join(f.workspace, "original"),
  );
  fs.symlinkSync(
    path.join(f.workspace, "original"),
    path.join(f.workspace, "TOOLS.md"),
  );
  await assert.rejects(readManaged(f.target, "TOOLS.md"), /regular|link/i);
  fs.linkSync(path.join(f.workspace, "SOUL.md"), path.join(f.base, "linked"));
  await assert.rejects(readManaged(f.target, "SOUL.md"), /link/i);
  await assert.rejects(
    readManaged({ ...f.target, installationId: "wrong" }, "USER.md"),
    /identity/i,
  );
});
test("missing upload is exclusive; UTF-8 and size are strict; empty overwrite keeps file", async () => {
  const f = fileFixture();
  fs.renameSync(
    path.join(f.workspace, "USER.md"),
    path.join(f.workspace, "user-original"),
  );
  const r = await prepareWrite(f.target, {
    name: "USER.md",
    baseline: "missing",
    content: "upload",
  });
  fs.writeFileSync(path.join(f.workspace, "USER.md"), "concurrent");
  await assert.rejects(
    applyWrite(f.target, { ...r, content: "upload" }),
    /changed|conflict/i,
  );
  const r2 = await prepareWrite(f.target, {
    name: "USER.md",
    baseline: (await readManaged(f.target, "USER.md")).revision,
    content: "",
  });
  await applyWrite(f.target, { ...r2, content: "" });
  assert.equal(fs.statSync(path.join(f.workspace, "USER.md")).size, 0);
  fs.writeFileSync(path.join(f.workspace, "AGENTS.md"), Buffer.from([0xff]));
  await assert.rejects(readManaged(f.target, "AGENTS.md"), /UTF-8/i);
  await assert.rejects(
    prepareWrite(f.target, {
      name: "USER.md",
      baseline: (await readManaged(f.target, "USER.md")).revision,
      content: "x".repeat(1048577),
    }),
    /1 MiB|limit/i,
  );
});

test("missing targets are created exclusively and native discovery must agree with the connected HUD", async () => {
  const f = fileFixture();
  fs.renameSync(
    path.join(f.workspace, "USER.md"),
    path.join(f.workspace, "original-user.md"),
  );
  const review = await prepareWrite(f.target, {
    name: "USER.md",
    baseline: "missing",
    content: "new persona",
  });
  const r = await applyWrite(f.target, { ...review, content: "new persona" });
  assert.equal(r.outcome, "verified");
  assert.equal(r.backup, null);
  assert.equal((await readManaged(f.target, "USER.md")).content, "new persona");
  await assert.rejects(
    resolveTarget({ ...f.target, expectedWorkspace: f.home }),
    /differs from the connected HUD/,
  );
});
test(
  "installed native OpenClaw resolves a synthetic custom agent workspace",
  { skip: !process.env.NETCLAW_TEST_OPENCLAW_CLI },
  async () => {
    const f = fileFixture(),
      { spawnSync } = await import("node:child_process");
    const target = {
      ...f.target,
      cli: fs.realpathSync(process.env.NETCLAW_TEST_OPENCLAW_CLI),
      expectedWorkspace: f.workspace,
    };
    const r = spawnSync(
      process.execPath,
      [path.join(f.target.root, "scripts/claw-control.mjs")],
      {
        input: JSON.stringify({
          op: "read",
          target,
          input: { name: "USER.md" },
        }),
        encoding: "utf8",
        env: {
          PATH: path.dirname(process.execPath) + ":/usr/bin:/bin",
          HOME: f.base,
        },
        timeout: 30000,
      },
    );
    const response = JSON.parse(r.stdout);
    assert.equal(response.ok, true, response.error);
    assert.equal(response.result.workspace, f.workspace);
    assert.match(response.result.content, /Synthetic/);
  },
);
