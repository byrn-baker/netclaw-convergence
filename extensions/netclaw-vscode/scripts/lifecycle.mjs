import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { runTests } from "@vscode/test-electron";
import { fileURLToPath } from "node:url";
import { realHud } from "../test/real-hud-fixture.mjs";
const extension = fileURLToPath(new URL("../", import.meta.url)),
  exe = process.env.VSCODE_EXECUTABLE;
if (!exe)
  throw Error("Set VSCODE_EXECUTABLE to the qualified desktop executable.");
const cli =
  process.platform === "darwin"
    ? path.resolve(exe, "../../Resources/app/bin/code")
    : process.env.VSCODE_CLI;
if (!cli) throw Error("Set VSCODE_CLI for this platform.");
const f = await realHud(),
  root = fs.mkdtempSync(path.join(os.tmpdir(), "netclaw150-vsix-lifecycle-")),
  user = path.join(root, "user"),
  installed = path.join(root, "extensions"),
  driver = path.join(root, "driver"),
  candidate = process.env.NETCLAW_TEST_VSIX
    ? path.resolve(process.env.NETCLAW_TEST_VSIX)
    : path.join(extension, "netclaw-0.1.0.vsix"),
  older = path.join(root, "netclaw-0.0.0.vsix");
fs.mkdirSync(driver);
fs.writeFileSync(
  path.join(driver, "package.json"),
  JSON.stringify({
    name: "netclaw-lifecycle-driver",
    publisher: "fixture",
    version: "0.0.0",
    engines: { vscode: "^1.102.0" },
    main: "index.cjs",
  }),
);
fs.writeFileSync(path.join(driver, "index.cjs"), "exports.activate=()=>{};");
fs.mkdirSync(path.join(user, "User"), { recursive: true });
fs.writeFileSync(
  path.join(user, "User/settings.json"),
  JSON.stringify({
    "update.mode": "none",
    "extensions.autoUpdate": false,
    "telemetry.telemetryLevel": "off",
    "workbench.startupEditor": "none",
  }),
);
// Synthetic older package solely to exercise the genuine installed-extension upgrade path.
execFileSync("python3", [
  "-c",
  `import zipfile,json,sys\nwith zipfile.ZipFile(sys.argv[1]) as z,zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as out:\n for n in z.namelist():\n  b=z.read(n)\n  if n=='extension/package.json':\n   d=json.loads(b);d['version']='0.0.0';b=json.dumps(d).encode()\n  elif n=='extension.vsixmanifest':b=b.replace(b'Version="0.1.0"',b'Version="0.0.0"')\n  out.writestr(n,b)`,
  candidate,
  older,
]);
const configBefore = fs.readFileSync(f.configPath),
  envBefore = fs.readFileSync(path.join(f.home, ".env")),
  results = [];
const command = (args) =>
  execFileSync(
    cli,
    ["--user-data-dir", user, "--extensions-dir", installed, ...args],
    {
      encoding: "utf8",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
      timeout: 60000,
    },
  );
const run = async (stage) => {
  const report = path.join(root, stage + ".json");
  await runTests({
    vscodeExecutablePath: exe,
    extensionDevelopmentPath: driver,
    extensionTestsPath: path.join(extension, "test/lifecycle.cjs"),
    reuseMachineInstall: false,
    extensionTestsEnv: {
      NETCLAW_LIFECYCLE_STAGE: stage,
      NETCLAW_TEST_URL: f.url,
      NETCLAW_TEST_ID: f.installationId,
      NETCLAW_TEST_REPORT: report,
    },
    launchArgs: [
      "--user-data-dir",
      user,
      "--extensions-dir",
      installed,
      "--skip-welcome",
      "--skip-release-notes",
      ...(stage === "disabled"
        ? ["--disable-extension", "NetClaw.netclaw"]
        : []),
    ],
  });
  results.push(JSON.parse(fs.readFileSync(report, "utf8")));
};
try {
  command(["--install-extension", older, "--force"]);
  await run("initial");
  command(["--install-extension", candidate, "--force"]);
  await run("upgraded");
  await run("disabled");
  await run("reenabled");
  command(["--uninstall-extension", "NetClaw.netclaw"]);
  if (
    command(["--list-extensions"])
      .toLowerCase()
      .split("\n")
      .includes("netclaw.netclaw")
  )
    throw Error("Uninstall did not remove extension");
  if (
    results[0].profileId !== results[1].profileId ||
    results[0].profileId !== results[3].profileId
  )
    throw Error("Profile changed across lifecycle");
  if (
    !fs.readFileSync(f.configPath).equals(configBefore) ||
    !fs.readFileSync(path.join(f.home, ".env")).equals(envBefore)
  )
    throw Error("Backend configuration changed");
  if (!(await fetch(f.url + "/api/runtime")).ok)
    throw Error("Backend stopped during lifecycle");
  const report = {
    root,
    results,
    uninstalled: true,
    backendPreserved: true,
    providerCalls: 0,
    syntheticGatewayCalls: f.calls.length,
    sha256: createHash("sha256")
      .update(fs.readFileSync(candidate))
      .digest("hex"),
    scope:
      "Actual installed VSIX; synthetic older package upgrade; isolated unchanged HUD; no owner-service modifications.",
  };
  fs.writeFileSync(
    path.join(root, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await f.close();
}
