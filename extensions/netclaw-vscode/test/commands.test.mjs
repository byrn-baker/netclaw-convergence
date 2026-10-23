import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { load } from "./load.mjs";
const { serviceCommand } = await load("src/client/commands.ts");
test("reviewed service command binds existing home and quotes hostile path text literally", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "netclaw-command-")),
    home = path.join(root, "runtime ' $(touch escaped)"),
    scripts = path.join(root, "scripts");
  fs.mkdirSync(path.join(home, "netclaw-hud"), { recursive: true });
  fs.mkdirSync(scripts);
  fs.writeFileSync(
    path.join(home, "netclaw-hud/installation.json"),
    JSON.stringify({ installationId: "bound" }),
  );
  fs.writeFileSync(
    path.join(scripts, "hud-launch.mjs"),
    "console.log(JSON.stringify(process.argv.slice(2)))",
  );
  const c = serviceCommand(root, home, "openclaw", "bound", "HUD status"),
    result = JSON.parse(
      execFileSync("/bin/sh", ["-c", c], { cwd: root, encoding: "utf8" }),
    );
  assert.deepEqual(result, ["status", "--runtime", "openclaw", "--home", home]);
  assert.equal(fs.existsSync(path.join(root, "escaped")), false);
  assert.throws(
    () => serviceCommand(root, home, "openclaw", "foreign", "HUD status"),
    /different/,
  );
  assert.throws(() =>
    serviceCommand(root, home, "openclaw", "bound", "Erase everything"),
  );
});
