import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
export function nativeExecutable(name, env = process.env) {
  for (const dir of (env.PATH || "").split(path.delimiter)) {
    if (!path.isAbsolute(dir)) continue;
    const p = path.join(dir, name);
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return fs.realpathSync(p);
    } catch {}
  }
  throw Error(`The ${name} executable is unavailable on this HUD host.`);
}
export async function managementDiscovery(
  installation,
  root,
  agentId,
  env = process.env,
) {
  let cli, expectedWorkspace;
  if (installation.kind === "openclaw") {
    cli = nativeExecutable("openclaw", env);
    const { stdout } = await promisify(execFile)(
      cli,
      ["agents", "list", "--json"],
      { env, cwd: process.cwd(), timeout: 15000, maxBuffer: 2 * 1048576 },
    );
    const agents = JSON.parse(stdout);
    if (!Array.isArray(agents))
      throw Error("Native agent catalog is unavailable.");
    agentId =
      agentId ||
      agents.find((a) => a.isDefault)?.id ||
      (agents.length === 1 ? agents[0].id : undefined);
    const matches = agents.filter((a) => a.id === agentId);
    if (matches.length !== 1 || typeof matches[0].workspace !== "string")
      throw Error("Selected native agent is ambiguous.");
    expectedWorkspace = fs.realpathSync(matches[0].workspace);
  }
  return {
    schemaVersion: 1,
    kind: installation.kind,
    installationId: installation.installationId,
    home: installation.home,
    configPath: installation.configPath,
    agentId: installation.kind === "openclaw" ? agentId : "main",
    root: fs.realpathSync(root),
    node: fs.realpathSync(process.execPath),
    cli,
    expectedWorkspace,
    launch: {
      cwd: fs.realpathSync(process.cwd()),
      home: fs.realpathSync(env.HOME),
      ...(installation.kind === "openclaw"
        ? { openclawHome: env.OPENCLAW_HOME, profile: env.OPENCLAW_PROFILE }
        : {}),
    },
  };
}
