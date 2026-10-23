import { load } from "../test/load.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { serviceFixture } from "../test/claw-fixture.mjs";
import { freePort } from "../test/real-hud-fixture.mjs";
const extension = fileURLToPath(new URL("../", import.meta.url)),
  profile = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "netclaw152-editor-")),
  ),
  observer = path.join(profile, "observer");
const executable = process.env.VSCODE_EXECUTABLE;
const candidate = process.env.NETCLAW_TEST_VSIX
  ? path.resolve(process.env.NETCLAW_TEST_VSIX)
  : undefined;
if (!executable || !fs.existsSync(executable))
  throw Error("Set VSCODE_EXECUTABLE to an installed native VS Code.");
if (
  process.env.NETCLAW_WORKSPACE_TEST === "1" &&
  !process.env.NETCLAW_TEST_PLAYWRIGHT
)
  throw Error(
    "Set NETCLAW_TEST_PLAYWRIGHT to an existing playwright-core package for native acceptance.",
  );
const fixtures = [];
let child;
try {
  for (const kind of ["openclaw", "hermes"])
    fixtures.push(await serviceFixture(kind, { realHud: true }));
  for (const dir of ["user/User", "extensions", "observer", "screenshots"])
    fs.mkdirSync(path.join(profile, dir), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(profile, "user/User/settings.json"),
    JSON.stringify({
      "telemetry.telemetryLevel": "off",
      "update.mode": "none",
      "extensions.autoUpdate": false,
      "workbench.startupEditor": "none",
      "window.dialogStyle": "custom",
      "window.title": "NetClaw · Spec152 · ISOLATED PREVIEW",
      "workbench.colorTheme": "Default Dark Modern",
      "security.workspace.trust.enabled": true,
      "security.workspace.trust.startupPrompt": "never",
      "chat.disableAIFeatures": true,
      "files.autoSave": "off",
      "files.hotExit": "off",
      "editor.minimap.enabled": false,
    }),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(observer, "package.json"),
    JSON.stringify({
      name: "netclaw-workspace-preview",
      publisher: "fixture",
      version: "0.0.0",
      engines: { vscode: "^1.102.0" },
      main: "index.cjs",
      activationEvents: ["onStartupFinished"],
    }),
  );
  if (candidate) {
    const cli =
      process.platform === "darwin"
        ? path.resolve(executable, "../../Resources/app/bin/code")
        : process.env.VSCODE_CLI;
    if (!cli) throw Error("Set VSCODE_CLI for installed-artifact acceptance.");
    execFileSync(
      cli,
      [
        "--user-data-dir",
        path.join(profile, "user"),
        "--extensions-dir",
        path.join(profile, "extensions"),
        "--install-extension",
        candidate,
      ],
      {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
        timeout: 60000,
        stdio: "pipe",
      },
    );
  }
  const { validateTarget } = await load(
    path.join(extension, "src/client/claw.ts"),
  );
  const targets = fixtures.map((f) => ({
    target: f.target,
    codeHash: validateTarget(f.target),
    url: f.url,
    base: f.base,
    workspace: f.workspace,
  }));
  const codeHash = targets.map((t) => t.codeHash);
  const ready = path.join(profile, "ready.json"),
    error = path.join(profile, "error.txt"),
    report = path.join(profile, "report.json");
  fs.writeFileSync(
    path.join(observer, "index.cjs"),
    `
 const vscode=require('vscode'),fs=require('node:fs');
 exports.activate=()=>{setImmediate(async()=>{try{
 const api=await vscode.extensions.getExtension('NetClaw.netclaw').activate();
 const targets=${JSON.stringify(targets)},bindings=[];
 if(fs.existsSync(${JSON.stringify(path.join(profile, "resume.json"))})){await require(${JSON.stringify(path.join(extension, "test/editor-workspace.cjs"))}).resume({api,targets,profile:${JSON.stringify(profile)},report:${JSON.stringify(report)}});return;}
 for(const f of targets){const p=await api.profiles.save({label:'Isolated '+f.target.kind+' · synthetic',url:f.url,installationId:f.target.installationId,harness:f.target.kind});const binding={profile:p,target:f.target,codeHash:f.codeHash,context:p.context};await api.management.saveBinding(binding);bindings.push(binding);}
 await api.management.select(bindings[0].profile);await api.connection.connect(bindings[0].profile);
 await vscode.commands.executeCommand('workbench.view.extension.netclaw');
 await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
 await vscode.commands.executeCommand('netclaw.workspaceControls');
 fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({ready:true,editor:vscode.version,sourceDevelopment:${!candidate},synthetic:true,extensionPath:vscode.extensions.getExtension('NetClaw.netclaw').extensionPath,extensionVersion:vscode.extensions.getExtension('NetClaw.netclaw').packageJSON.version}));
 ${process.env.NETCLAW_WORKSPACE_TEST === "1" ? `await require(${JSON.stringify(path.join(extension, "test/editor-workspace.cjs"))}).run({api,bindings,targets,profile:${JSON.stringify(profile)},report:${JSON.stringify(report)}});` : ""}
 }catch(e){fs.writeFileSync(${JSON.stringify(error)},String(e.stack||e));}});};
 `,
  );
  const port = await freePort();
  child = spawn(
    executable,
    [
      "--user-data-dir",
      path.join(profile, "user"),
      "--extensions-dir",
      path.join(profile, "extensions"),
      "--new-window",
      "--skip-welcome",
      "--skip-release-notes",
      ...(candidate ? [] : ["--disable-extensions"]),
      "--disable-telemetry",
      "--remote-debugging-port=" + port,
      ...(candidate ? [] : ["--extensionDevelopmentPath=" + extension]),
      "--extensionDevelopmentPath=" + observer,
    ],
    {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined,
        NETCLAW_TEST_CDP_PORT: String(port),
        NETCLAW_TEST_PLAYWRIGHT: process.env.NETCLAW_TEST_PLAYWRIGHT,
      },
      stdio: ["ignore", "ignore", "ignore"],
    },
  );
  const metadata = {
    profile,
    targets,
    extension,
    editorExecutable: executable,
    editorPid: child.pid,
    readyFile: ready,
    errorFile: error,
    reportFile: report,
    debugPort: port,
    codeHash,
    extensionHash: createHash("sha256")
      .update(fs.readFileSync(path.join(extension, "dist/extension.cjs")))
      .digest("hex"),
    candidate,
    candidateSha256: candidate
      ? createHash("sha256").update(fs.readFileSync(candidate)).digest("hex")
      : undefined,
    mode: candidate
      ? "Isolated installed VSIX; synthetic engines/federation, source HUDs; no provider/device calls"
      : "Isolated source development; synthetic engines/federation, source HUDs; no provider/device calls",
  };
  for (const p of [
    path.join(profile, "preview.json"),
    "/tmp/netclaw-spec152-source-preview.json",
  ])
    fs.writeFileSync(p, JSON.stringify(metadata, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify({
      profile,
      readyFile: ready,
      reportFile: report,
      debugPort: port,
      editorPid: child.pid,
    }),
  );
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    for (const f of fixtures) await f.close();
  };
  child.once("exit", () => void close());
  child.once("error", () => void close());
  for (const sig of ["SIGINT", "SIGTERM"])
    process.once(sig, () => {
      child.kill("SIGTERM");
      void close();
    });
} catch (e) {
  for (const f of fixtures) await f.close();
  throw e;
}
