import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { realHud, freePort } from "../test/real-hud-fixture.mjs";
import { securityFixture } from "../test/security-fixture.mjs";

// Developer-only preview: copied HUD source, synthetic gateway, private temporary state.
const executable = process.env.VSCODE_EXECUTABLE;
if (!executable || !fs.existsSync(executable))
  throw Error("Set VSCODE_EXECUTABLE to the desired VS Code executable.");
const extension = fileURLToPath(new URL("../", import.meta.url));
const fixture = await realHud();
const debugPort = await freePort();
const securityTargets = Object.fromEntries(
  ["defenseclaw", "openshell"].map((product) => [
    product,
    securityFixture(
      fixture.root,
      product,
      fixture.home,
      fixture.installationId,
    ),
  ]),
);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "netclaw151-preview-"));
const observer = path.join(profile, "observer");
fs.mkdirSync(path.join(profile, "user/User"), { recursive: true, mode: 0o700 });
fs.mkdirSync(observer, { mode: 0o700 });
fs.writeFileSync(
  path.join(fixture.root, "testbed/testbed.yaml"),
  `# Synthetic preview inventory. No device sessions or collectors are configured.
testbed:
  name: Spec151 local studio
devices:
  lab-core:
    alias: Core router
    os: iosxe
    platform: cat8000v
    connections:
      cli: {protocol: ssh, ip: 192.0.2.10, port: 22}
  lab-edge:
    alias: Edge router
    os: iosxe
    connections:
      cli: {protocol: ssh, ip: 192.0.2.20, port: 22}
  lab-switch:
    alias: Data center switch
    os: nxos
    connections:
      cli: {protocol: ssh, ip: 192.0.2.30, port: 22}
`,
  { mode: 0o600 },
);
fs.writeFileSync(
  path.join(profile, "user/User/settings.json"),
  JSON.stringify({
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
    "extensions.autoUpdate": false,
    "workbench.startupEditor": "none",
    "window.dialogStyle": "custom",
    "window.title": "NetClaw — Spec151 local preview",
    "workbench.colorTheme": "Default Dark Modern",
    "security.workspace.trust.enabled": true,
    "security.workspace.trust.startupPrompt": "never",
    "chat.disableAIFeatures": true,
  }),
);
fs.writeFileSync(
  path.join(observer, "package.json"),
  JSON.stringify({
    name: "netclaw-local-preview",
    publisher: "fixture",
    version: "0.0.0",
    engines: { vscode: "^1.102.0" },
    main: "index.cjs",
    activationEvents: ["onStartupFinished"],
  }),
);
const ready = path.join(profile, "ready.json");
fs.writeFileSync(
  path.join(observer, "index.cjs"),
  `
const vscode=require('vscode'),fs=require('node:fs');
exports.activate=()=>{setImmediate(async()=>{try{
 const api=await vscode.extensions.getExtension('NetClaw.netclaw').activate();
 const p=await api.profiles.save({label:'Spec151 · synthetic local studio',url:${JSON.stringify(fixture.url)},installationId:${JSON.stringify(fixture.installationId)},harness:'openclaw'});
 await api.connection.connect(p);
 await vscode.commands.executeCommand('workbench.action.closeSidebar');
 await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
 await vscode.commands.executeCommand('netclaw.openOverview');
 await vscode.commands.executeCommand('notifications.clearAll');
 fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({ready:true,editor:vscode.version,extensionMode:'source development',synthetic:true}));
}catch(e){fs.writeFileSync(${JSON.stringify(path.join(profile, "error.txt"))},String(e.stack||e));}});};
`,
);
const child = spawn(
  executable,
  [
    "--user-data-dir",
    path.join(profile, "user"),
    "--extensions-dir",
    path.join(profile, "extensions"),
    "--new-window",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-extensions",
    "--disable-telemetry",
    "--remote-debugging-port=" + debugPort,
    "--extensionDevelopmentPath=" + extension,
    "--extensionDevelopmentPath=" + observer,
  ],
  {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
    stdio: "inherit",
  },
);
const metadata = {
  profile,
  fixtureRoot: fixture.root,
  runtimeHome: fixture.home,
  url: fixture.url,
  installationId: fixture.installationId,
  extension,
  editorExecutable: executable,
  editorPid: child.pid,
  hudPid: fixture.child.pid,
  readyFile: ready,
  debugPort,
  securityTargets,
  mode: "source development; no VSIX packaged or installed",
  data: "synthetic isolated fixture; no provider or network device calls",
};
fs.writeFileSync(
  path.join(profile, "preview.json"),
  JSON.stringify(metadata, null, 2),
  { mode: 0o600 },
);
fs.writeFileSync(
  "/tmp/netclaw-spec151-source-preview.json",
  JSON.stringify(metadata, null, 2),
  { mode: 0o600 },
);
console.log(JSON.stringify(metadata, null, 2));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await fixture.close();
}
child.once("error", async (error) => {
  console.error(error.message);
  await close();
  process.exitCode = 1;
});
child.once("exit", async () => {
  await close();
});
for (const sig of ["SIGINT", "SIGTERM"])
  process.once(sig, () => {
    child.kill();
    void close();
  });
