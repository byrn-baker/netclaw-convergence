import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { load } from "./load.mjs";
const { writePrivateExport } = await load("src/client/export.ts");
test("private export verifies content, replaces atomically, refuses inventory aliases and invalid destinations", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nc151-export-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, "testbed.yaml"),
    dest = path.join(dir, "export.yaml");
  fs.writeFileSync(source, "devices: {}\n");
  fs.writeFileSync(dest, "old");
  writePrivateExport(dest, source, "private fixture export");
  assert.equal(fs.readFileSync(dest, "utf8"), "private fixture export");
  assert.equal(fs.statSync(dest).mode & 0o777, 0o600);
  assert.throws(
    () => writePrivateExport(source, source, "bad"),
    /separate file/,
  );
  const hard = path.join(dir, "hard.yaml"),
    link = path.join(dir, "link.yaml");
  fs.linkSync(source, hard);
  fs.symlinkSync(source, link);
  assert.throws(() => writePrivateExport(hard, source, "bad"), /separate file/);
  assert.throws(() => writePrivateExport(link, source, "bad"), /regular file/);
  assert.throws(() => writePrivateExport(dir, source, "bad"), /regular file/);
  assert.equal(fs.readFileSync(source, "utf8"), "devices: {}\n");
  assert.equal(
    fs.readdirSync(dir).some((n) => n.endsWith(".tmp")),
    false,
  );
});
