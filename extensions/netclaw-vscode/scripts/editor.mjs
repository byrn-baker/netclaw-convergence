import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { runTests } from "@vscode/test-electron";
import { realHud, freePort } from "../test/real-hud-fixture.mjs";
import { securityFixture } from "../test/security-fixture.mjs";
const extension = fileURLToPath(new URL("../", import.meta.url));
const liveUrl = process.env.NETCLAW_TEST_LIVE_HUD_URL;
const nativeFixture =
  process.env.NETCLAW_TEST_NATIVE_REVIEW === "1" && !liveUrl;
const suite =
  process.env.NETCLAW_TEST_SUITE === "inputs"
    ? "editor-inputs.cjs"
    : process.env.NETCLAW_TEST_SUITE === "compatibility"
      ? "editor-compatibility.cjs"
      : process.env.NETCLAW_TEST_SUITE === "experience"
        ? "editor-experience.cjs"
        : "editor.cjs";
if (liveUrl && !process.env.NETCLAW_TEST_LIVE_ID)
  throw Error("A live HUD check requires its observed installation identity.");
const fixture = liveUrl
    ? {
        url: liveUrl,
        installationId: process.env.NETCLAW_TEST_LIVE_ID,
        root: "externally managed HUD; test runner does not restart it",
        calls: [],
        close: async () => {},
      }
    : await realHud({
        ragPython: process.env.NETCLAW_TEST_RAG_PYTHON,
        ragCache: process.env.NETCLAW_TEST_RAG_CACHE,
      }),
  profile = fs.mkdtempSync(path.join(os.tmpdir(), "netclaw150-client-editor-")),
  port = await freePort();
if (nativeFixture && suite === "editor-experience.cjs") {
  fs.writeFileSync(
    path.join(fixture.root, "security-targets.json"),
    JSON.stringify(
      Object.fromEntries(
        ["defenseclaw", "openshell"].map((product) => [
          product,
          securityFixture(
            fixture.root,
            product,
            fixture.home,
            fixture.installationId,
          ),
        ]),
      ),
    ),
  );
}
fs.mkdirSync(path.join(profile, "user/User"), { recursive: true });
fs.writeFileSync(
  path.join(profile, "user/User/settings.json"),
  JSON.stringify({
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.autoUpdate": false,
    "workbench.startupEditor": "none",
    "window.dialogStyle": "custom",
    "security.workspace.trust.enabled": true,
    "security.workspace.trust.startupPrompt": "never",
  }),
);
try {
  let developmentPath = extension;
  const candidate = process.env.NETCLAW_TEST_VSIX;
  if (candidate) {
    const exe = process.env.VSCODE_EXECUTABLE;
    if (!exe) throw Error("Exact installed tests require VSCODE_EXECUTABLE.");
    const cli =
      process.platform === "darwin"
        ? path.resolve(exe, "../../Resources/app/bin/code")
        : process.env.VSCODE_CLI;
    if (!cli) throw Error("Set VSCODE_CLI for this platform.");
    execFileSync(
      cli,
      [
        "--user-data-dir",
        path.join(profile, "user"),
        "--extensions-dir",
        path.join(profile, "extensions"),
        "--install-extension",
        path.resolve(candidate),
        "--force",
      ],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
        timeout: 60000,
        stdio: "pipe",
      },
    );
    developmentPath = path.join(profile, "driver");
    fs.mkdirSync(developmentPath);
    fs.writeFileSync(
      path.join(developmentPath, "package.json"),
      JSON.stringify({
        name: "netclaw-installed-editor-driver",
        publisher: "fixture",
        version: "0.0.0",
        engines: { vscode: "^1.102.0" },
        main: "index.cjs",
      }),
    );
    fs.writeFileSync(
      path.join(developmentPath, "index.cjs"),
      "exports.activate=()=>{};",
    );
  }
  if (process.env.NETCLAW_TEST_RAG_PYTHON && !liveUrl) {
    const { load } = await import("../test/load.mjs");
    const { HudClient } = await load("src/client/hud.ts");
    const c = new HudClient(fixture.url, fixture.installationId);
    await c.connect();
    await c.upload(
      "extension-proof.md",
      Buffer.from("# Fixture\nThe maintenance window is violet Thursday.\n"),
      "customer",
    );
    const until = Date.now() + 150000;
    let ready = false;
    while (Date.now() < until) {
      const data = await c.request(
        "GET",
        "/api/rag/documents",
        undefined,
        90000,
      );
      if (
        data.documents.some(
          (d) =>
            d.title === "extension-proof.md" && d.ingest_status === "ready",
        )
      ) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    c.close();
    if (!ready) throw Error("RAG fixture indexing unavailable");
  }
  const options = {
    version: process.env.VSCODE_VERSION || "1.102.0",
    ...(process.env.VSCODE_EXECUTABLE
      ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE }
      : {}),
    extensionDevelopmentPath: developmentPath,
    extensionTestsPath: path.join(extension, "test", suite),
    reuseMachineInstall: false,
    extensionTestsEnv: {
      NETCLAW_TEST_RAG_READY:
        process.env.NETCLAW_TEST_RAG_PYTHON && !liveUrl ? "1" : "0",
      NETCLAW_TEST_LIVE_PROVIDER: liveUrl ? "1" : "0",
      NETCLAW_TEST_INSTALLED_ROOT: candidate
        ? path.join(profile, "extensions")
        : "",
      NETCLAW_TEST_VSIX: candidate ? path.resolve(candidate) : "",
      NETCLAW_TEST_URL: fixture.url,
      NETCLAW_TEST_ID: fixture.installationId,
      NETCLAW_TEST_REPORT: path.join(profile, "report.json"),
      NETCLAW_TEST_FIXTURE_ROOT: liveUrl ? "" : fixture.root,
      NETCLAW_TEST_CDP_PORT: String(port),
      NETCLAW_TEST_PLAYWRIGHT: process.env.NETCLAW_TEST_PLAYWRIGHT || "",
    },
    launchArgs: [
      "--user-data-dir",
      path.join(profile, "user"),
      "--extensions-dir",
      path.join(profile, "extensions"),
      "--skip-welcome",
      "--skip-release-notes",
      ...(candidate ? [] : ["--disable-extensions"]),
      "--disable-telemetry",
      `--remote-debugging-port=${port}`,
    ],
  };
  if (liveUrl || nativeFixture) {
    if (liveUrl && (!candidate || !process.env.VSCODE_EXECUTABLE))
      throw Error(
        "Native live checks require an installed VSIX and explicit editor executable.",
      );
    // VS Code intentionally refuses native review dialogs under extensionTestsPath.
    // Launch a normal isolated development window with a separate observer instead.
    if (nativeFixture) {
      developmentPath = path.join(profile, "observer");
      fs.mkdirSync(developmentPath);
      fs.writeFileSync(
        path.join(developmentPath, "package.json"),
        JSON.stringify({
          name: "netclaw-local-observer",
          publisher: "fixture",
          version: "0.0.0",
          engines: { vscode: "^1.102.0" },
          main: "index.cjs",
        }),
      );
    }
    const manifestPath = path.join(developmentPath, "package.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.activationEvents = ["onStartupFinished"];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const errorPath = path.join(profile, "driver-error.txt");
    fs.writeFileSync(
      path.join(developmentPath, "index.cjs"),
      `
const fs=require('node:fs'), vscode=require('vscode');
exports.activate=()=>{setImmediate(async()=>{
 try { await require(${JSON.stringify(path.join(extension, "test", suite))}).run(); }
 catch(error) { fs.writeFileSync(${JSON.stringify(errorPath)},String(error.stack || error)); }
 finally { await vscode.commands.executeCommand('workbench.action.quit'); }
});};`,
    );
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.env.VSCODE_EXECUTABLE,
        [
          ...options.launchArgs,
          "--extensionDevelopmentPath=" + developmentPath,
          ...(nativeFixture && !candidate
            ? ["--extensionDevelopmentPath=" + extension]
            : []),
        ],
        {
          env: {
            ...process.env,
            ...options.extensionTestsEnv,
            ELECTRON_RUN_AS_NODE: undefined,
          },
          stdio: "inherit",
        },
      );
      const timer = setTimeout(() => {
        child.kill();
        reject(
          Error("Isolated live editor timed out; no automatic provider retry."),
        );
      }, 480000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        code === 0 && !signal
          ? resolve()
          : reject(Error("Live editor exited " + code + "/" + signal));
      });
    });
    if (fs.existsSync(errorPath))
      throw Error(fs.readFileSync(errorPath, "utf8"));
  } else await runTests(options);
  console.log(
    JSON.stringify(
      {
        profile,
        hudFixture: fixture.root,
        report: JSON.parse(
          fs.readFileSync(path.join(profile, "report.json"), "utf8"),
        ),
        providerMode: liveUrl
          ? "actual configured runtime"
          : "synthetic local gateway",
        ...(liveUrl
          ? {}
          : { providerCalls: 0, syntheticGatewayCalls: fixture.calls.length }),
        ...(candidate
          ? {
              artifactSha256: createHash("sha256")
                .update(fs.readFileSync(candidate))
                .digest("hex"),
            }
          : {}),
      },
      null,
      2,
    ),
  );
} finally {
  await fixture.close();
}
