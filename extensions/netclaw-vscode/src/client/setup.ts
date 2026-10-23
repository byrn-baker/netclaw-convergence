import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { shellQuote } from "./commands";
type Kind = "openclaw" | "hermes";
export type SetupOptions = {
  root: string;
  home: string;
  kind: Kind;
  installationId: string;
  host: string;
  component: string;
  action: string;
};
export type Prepared = SetupOptions & {
  id: string;
  python: string;
  script: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  baselines: Record<string, string>;
  servers: string[];
  description: string;
  impact: string;
  command: string;
  beforePid?: number;
};
const digest = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
function revision(file: string) {
  try {
    const s = fs.lstatSync(file);
    if (s.isSymbolicLink() || !s.isFile() || s.size > 4 * 1024 * 1024)
      throw Error("A setup input must be a regular file within 4 MiB.");
    return digest(fs.readFileSync(file));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw e;
  }
}
function executable(name: string) {
  for (const folder of (process.env.PATH || "").split(path.delimiter)) {
    if (!path.isAbsolute(folder)) continue;
    const file = path.join(folder, name);
    try {
      fs.accessSync(file, fs.constants.X_OK);
      return fs.realpathSync(file);
    } catch {}
  }
  throw Error(
    `Install ${name} on this extension host before using this action.`,
  );
}
function identity(o: SetupOptions) {
  if (process.platform === "win32")
    throw Error("Use a WSL or Remote Linux extension host for setup.");
  if (
    !path.isAbsolute(o.root) ||
    !path.isAbsolute(o.home) ||
    /[\r\n\0]/.test(o.root + o.home)
  )
    throw Error("Select absolute host-local paths.");
  const file = path.join(o.home, "netclaw-hud/installation.json");
  if (revision(file) === "missing")
    throw Error("Select an existing initialized runtime home.");
  const id = JSON.parse(fs.readFileSync(file, "utf8"));
  if (id.installationId !== o.installationId || (id.kind && id.kind !== o.kind))
    throw Error("Selected home belongs to a different installation.");
}
function targetVariable(key: string) {
  return (
    /^(OPENCLAW_|HERMES_|NETCLAW_|N2N_|BGP_)/.test(key) ||
    [
      "PYTHONPATH",
      "PYTHONHOME",
      "VIRTUAL_ENV",
      "PYATS_VENV",
      "GAIT_VENV",
    ].includes(key)
  );
}
export function setupEnvironment(o: SetupOptions) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (targetVariable(key)) delete env[key];
  Object.assign(env, {
    NETCLAW_RUNTIME: o.kind,
    NETCLAW_RUNTIME_ROOT: path.join(o.home, "python-runtimes"),
    NETCLAW_RUNTIME_ENV: path.join(o.home, ".env"),
    NETCLAW_ENV_FILE: path.join(o.home, ".env"),
    NETCLAW_INSTALLATION_ID: o.installationId,
    N2N_BASE_DIR: path.join(o.home, "n2n"),
    [o.kind === "hermes" ? "HERMES_HOME" : "OPENCLAW_HOME"]: o.home,
  });
  if (o.kind === "openclaw")
    Object.assign(env, {
      OPENCLAW_STATE_DIR: o.home,
      OPENCLAW_CONFIG_PATH: path.join(o.home, "openclaw.json"),
    });
  return env;
}
function run(
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  timeout = 30000,
): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(
      file,
      args,
      { env, cwd, timeout, maxBuffer: 2 * 1024 * 1024, shell: false },
      (error, stdout) =>
        error
          ? reject(
              Object.assign(
                Error(
                  error.killed
                    ? "Operation timed out; inspect private state before retrying."
                    : "The setup helper did not complete successfully. Inspect private recovery state and prerequisites.",
                ),
                { unknown: error.killed },
              ),
            )
          : resolve(stdout),
    ),
  );
}
function privateDir(dir: string) {
  if (fs.existsSync(dir)) {
    const s = fs.lstatSync(dir);
    if (!s.isDirectory() || s.isSymbolicLink())
      throw Error("Private setup evidence directory is unavailable.");
  } else fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
}
function privateWrite(file: string, value: unknown) {
  const tmp = file + "." + randomUUID() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  try {
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
export function setupHistory(home: string) {
  const dir = path.join(home, "netclaw-hud/setup");
  if (!fs.existsSync(dir)) return [];
  const s = fs.lstatSync(dir);
  if (!s.isDirectory() || s.isSymbolicLink())
    throw Error("Private setup evidence directory is unavailable.");
  return fs
    .readdirSync(dir)
    .filter((n) => /^[a-f0-9-]+\.json$/.test(n))
    .map((n) => {
      try {
        const f = path.join(dir, n);
        if (revision(f) === "missing") return null;
        const v = JSON.parse(fs.readFileSync(f, "utf8"));
        return {
          id: v.id,
          action: v.action,
          component: v.component,
          state: v.state === "running" ? "unknown" : v.state,
          updatedAt: v.updatedAt,
          message: v.message,
        };
      } catch {
        return {
          id: n.slice(0, -5),
          action: "unreadable",
          component: "unreported",
          state: "unknown",
          updatedAt: "",
          message:
            "Private operation evidence could not be read; inspect before another action.",
        };
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b!.updatedAt).localeCompare(String(a!.updatedAt)))
    .slice(0, 30);
}
export async function prepareSetup(input: SetupOptions): Promise<Prepared> {
  const o = {
    ...input,
    root: fs.realpathSync(input.root),
    home: fs.realpathSync(input.home),
  };
  identity(o);
  if (
    !["install", "register", "restart", "stage"].includes(o.action) ||
    !/^[a-z0-9-]{1,80}$/.test(o.component) ||
    o.component === "hermes-hud"
  )
    throw Error("Select a supported setup action and public component.");
  const catalog = fs.readFileSync(
    path.join(o.root, "scripts/lib/catalog.sh"),
    "utf8",
  );
  if (!catalog.includes('"' + o.component + "|"))
    throw Error(
      "Component is not present in this checkout’s installer catalog.",
    );
  const python = executable("python3"),
    env = setupEnvironment(o),
    id = randomUUID();
  let script = "",
    args: string[] = [],
    servers: string[] = [],
    description = "",
    impact = "",
    beforePid: number | undefined;
  const config = path.join(
    o.home,
    o.kind === "hermes" ? "config.yaml" : "openclaw.json",
  );
  const inputs = [
    path.join(o.home, "netclaw-hud/installation.json"),
    config,
    config + ".netclaw-managed.json",
    path.join(o.home, ".env"),
    path.join(o.root, "config/openclaw.json"),
    path.join(o.root, "scripts/lib/catalog.sh"),
  ];
  if (o.action === "install") {
    if (!["pyats", "gait"].includes(o.component))
      throw Error(
        "Direct installation is supported for staged pyATS and GAIT runtimes. Use reviewed installer guidance for other components.",
      );
    executable("uv");
    if (o.component === "pyats") executable("git");
    script = path.join(o.root, `scripts/setup-${o.component}-runtime.py`);
    args = [
      "--target",
      path.join(o.home, o.component + "-venv"),
      "--python",
      "3.12",
    ];
    const previous = path.join(o.home, o.component + "-venv.previous");
    if (fs.existsSync(previous))
      throw Error(
        "A previous runtime generation is already retained. Inspect/archive it explicitly before rebuilding.",
      );
    inputs.push(path.join(o.root, "scripts/apply-fastmcp-patches.py"));
    if (o.component === "gait")
      inputs.push(path.join(o.root, "mcp-servers/gait_mcp/gait_mcp.py"));
    description = `Install or verify the isolated ${o.component} runtime in ${o.home}/${o.component}-venv.`;
    impact =
      "Downloads pinned dependencies/source as needed; retains a displaced generation. Does not register, restart, change credentials or connect devices. Inspect retained generations for recovery.";
  } else if (o.action === "register") {
    if (o.kind !== "openclaw")
      throw Error(
        "Hermes registration requires native configuration review. Its converter may prepare only a sidecar; direct success cannot be claimed.",
      );
    script = path.join(o.root, "scripts/install-mcp-config.py");
    inputs.push(
      path.join(o.root, "scripts/verify-catalog-coverage.py"),
      path.join(o.root, "scripts/write-env.py"),
      path.join(o.home, "python-runtimes/records", o.component),
    );
    const described = JSON.parse(
      await run(
        python,
        [
          script,
          "--repo",
          o.root,
          "--runtime-root",
          path.join(o.home, "python-runtimes"),
          "--components",
          o.component,
          "--describe",
        ],
        env,
        o.root,
      ),
    );
    servers = described.servers;
    if (
      !Array.isArray(servers) ||
      !servers.length ||
      servers.includes("hermes-hud-mcp")
    )
      throw Error(
        "No supported public registrations were found for this component.",
      );
    const template = JSON.parse(
      fs.readFileSync(path.join(o.root, "config/openclaw.json"), "utf8"),
    ).mcpServers;
    if (o.component === "gait" && fs.existsSync(config)) {
      const existing = JSON.parse(fs.readFileSync(config, "utf8"));
      const configured = (existing.mcpServers || existing.mcp?.servers)?.[
        "gait-mcp"
      ]?.env?.GAIT_VENV;
      if (configured && configured !== path.join(o.home, "gait-venv"))
        throw Error(
          "The existing GAIT registration overrides its runtime home. Reconcile that operator override before scoped registration.",
        );
    }
    for (const name of servers) {
      const entry = template[name];
      if (!entry) throw Error("Canonical registration changed.");
      const cmd = entry.command;
      if (cmd && ["python", "python3"].includes(cmd)) {
        const record = path.join(
          o.home,
          "python-runtimes/records",
          o.component,
        );
        if (!fs.existsSync(record) && !["pyats", "gait"].includes(o.component))
          throw Error(
            "Install this component’s recorded Python runtime before registration.",
          );
        if (fs.existsSync(record))
          fs.accessSync(
            fs.readFileSync(record, "utf8").trim(),
            fs.constants.X_OK,
          );
        else
          fs.accessSync(
            path.join(o.home, o.component + "-venv/bin/python"),
            fs.constants.X_OK,
          );
      } else if (cmd && !cmd.includes("/")) executable(cmd);
      else if (cmd)
        fs.accessSync(
          path.isAbsolute(cmd) ? cmd : path.join(o.root, cmd),
          fs.constants.X_OK,
        );
    }
    args = [
      "--repo",
      o.root,
      "--runtime-root",
      path.join(o.home, "python-runtimes"),
      "--components",
      o.component,
      "--output",
      path.join(o.home, "netclaw-hud/setup", id + ".registrations.json"),
      "--config",
      config,
      "--expected-revision",
      revision(config),
      "--expected-managed-revision",
      revision(config + ".netclaw-managed.json"),
    ];
    description = `Register ${servers.join(", ")} in ${config}.`;
    impact =
      "Preserves unrelated registrations and operator fields; custom launch conflicts stop the operation. Keeps a private original. Runtime loading and endpoint access remain unverified.";
  } else if (o.action === "restart") {
    if (o.component !== "n2n")
      throw Error(
        "Only the owned federation service has a supported scoped restart. Stdio MCP processes are runtime-owned.",
      );
    script = path.join(o.root, "scripts/federation-control.py");
    inputs.push(
      path.join(o.root, "scripts/write-env.py"),
      path.join(o.root, "scripts/runtime-selection.py"),
      path.join(o.root, "mcp-servers/protocol-mcp/bgp/federation/runtime.py"),
      path.join(o.home, "netclaw-federation/daemon.json"),
      path.join(o.home, "netclaw-federation/owner.json"),
      path.join(o.home, "mesh.systemd.env"),
      path.join(o.home, "python-runtimes/records/n2n"),
    );
    if (
      revision(path.join(o.home, "python-runtimes/records/n2n")) === "missing"
    )
      throw Error(
        "An installed federation runtime record is required before restart.",
      );
    const state = JSON.parse(
      await run(python, [script, "status"], env, o.root),
    );
    if (
      state.installation_id !== o.installationId ||
      state.harness_type !== o.kind ||
      !Number.isInteger(state.pid)
    )
      throw Error("Owned federation status could not be verified.");
    beforePid = state.pid;
    args = ["restart"];
    description =
      "Restart the selected installation’s owned federation service.";
    impact =
      "Interrupts active federation sessions and peer work. Inspect the reported active work before continuing. The controller validates PID ownership; a failed restart may leave the service stopped.";
  } else {
    script = path.join(o.root, "scripts/install.sh");
    args = ["--add", o.component];
    description = `Stage the existing installer for ${o.component}.`;
    impact =
      "This installer also runs global prerequisite, runtime, onboarding, config, skills and readiness phases. It is broader than a one-MCP install. Staging does not execute the command.";
  }
  if (revision(script) === "missing")
    throw Error("Setup helper is unavailable in this checkout.");
  inputs.push(script);
  const baselines = Object.fromEntries(inputs.map((f) => [f, revision(f)]));
  const command = [
    ...(o.action === "stage"
      ? [
          "env",
          ...[
            ...new Set([
              ...Object.keys(process.env).filter(targetVariable),
              "OPENCLAW_CONFIG_PATH",
              "OPENCLAW_STATE_DIR",
              "OPENCLAW_HOME",
              "HERMES_HOME",
              "PYTHONPATH",
              "PYTHONHOME",
              "VIRTUAL_ENV",
              "PYATS_VENV",
              "GAIT_VENV",
            ]),
          ].flatMap((key) => ["-u", key]),
          ...Object.entries(env)
            .filter(([key]) => targetVariable(key))
            .map(([key, value]) => `${key}=${value}`),
          "bash",
        ]
      : [python]),
    script,
    ...args,
  ]
    .map(shellQuote)
    .join(" ");
  return {
    ...o,
    id,
    python,
    script,
    args,
    env,
    baselines,
    servers,
    description,
    impact,
    command,
    beforePid,
  };
}
export function verifyPrepared(p: Prepared) {
  identity(p);
  for (const [file, expected] of Object.entries(p.baselines))
    if (revision(file) !== expected)
      throw Error(
        "A reviewed setup input changed. Prepare and review the action again.",
      );
}
export async function executeSetup(
  p: Prepared,
  {
    guard,
    progress,
  }: { guard: () => Promise<void>; progress: (message: string) => void },
) {
  if (p.action === "stage")
    throw Error("A staged command is not a direct operation.");
  await guard();
  verifyPrepared(p);
  const dir = path.join(p.home, "netclaw-hud/setup");
  privateDir(dir);
  if (setupHistory(p.home).some((row) => row?.state === "unknown"))
    throw Error(
      "An earlier operation has an unknown outcome. Inspect its private evidence and runtime state before explicitly resolving it; it will not replay.",
    );
  const lock = path.join(dir, "operation.lock");
  let fd: number;
  try {
    fd = fs.openSync(lock, "wx", 0o600);
  } catch {
    throw Error(
      "A setup operation is active or interrupted. Inspect its evidence before another action.",
    );
  }
  const evidence = {
    id: p.id,
    action: p.action,
    component: p.component,
    installationId: p.installationId,
    host: p.host,
    kind: p.kind,
    state: "running",
    phase: "prepared",
    updatedAt: new Date().toISOString(),
    baselines: p.baselines,
    message: "Prepared baseline recorded; execution starting.",
  };
  const file = path.join(dir, p.id + ".json");
  const record = () => {
    evidence.updatedAt = new Date().toISOString();
    privateWrite(file, evidence);
  };
  try {
    fs.writeFileSync(fd, p.id);
    record();
    const baselineDir = path.join(dir, p.id + ".baseline");
    privateDir(baselineDir);
    let index = 0;
    for (const [source, r] of Object.entries(p.baselines)) {
      if (r === "missing") continue;
      const content = fs.readFileSync(source);
      fs.writeFileSync(path.join(baselineDir, String(index++)), content, {
        mode: 0o600,
        flag: "wx",
      });
    }
    await guard();
    verifyPrepared(p);
    evidence.phase = "executing";
    record();
    progress("Running the reviewed setup helper…");
    await run(
      p.python,
      [p.script, ...p.args],
      p.env,
      p.root,
      p.action === "install" ? 15 * 60 * 1000 : 60000,
    );
    evidence.phase = "verifying";
    record();
    progress("Verifying the requested postcondition…");
    identity(p);
    if (p.action === "install") {
      const target = path.join(p.home, p.component + "-venv");
      const marker = path.join(target, `.netclaw-${p.component}-generation`);
      if (!fs.existsSync(marker))
        throw Error("Managed generation marker is missing.");
      await run(
        path.join(target, "bin/python"),
        [
          "-c",
          p.component === "pyats"
            ? "import pyats, genie, unicon; from mcp.client.client import Client"
            : "import gait, fastmcp; from importlib.metadata import version; assert version('fastmcp') == '4.0.11' and version('mcp') == '2.3.0'",
        ],
        p.env,
        p.root,
      );
    }
    if (p.action === "register") {
      const generated = JSON.parse(
          fs.readFileSync(path.join(dir, p.id + ".registrations.json"), "utf8"),
        ).mcpServers,
        config = JSON.parse(
          fs.readFileSync(path.join(p.home, "openclaw.json"), "utf8"),
        ),
        servers = config.mcpServers || config.mcp?.servers;
      for (const name of p.servers) {
        const actual = servers?.[name];
        if (
          !actual ||
          ["command", "args", "cwd"].some(
            (k) =>
              JSON.stringify(actual[k]) !== JSON.stringify(generated[name][k]),
          )
        )
          throw Error(
            "Active registration did not match the requested launch.",
          );
      }
    }
    if (p.action === "restart") {
      const s = JSON.parse(
        await run(p.python, [p.script, "status"], p.env, p.root),
      );
      if (
        s.installation_id !== p.installationId ||
        s.harness_type !== p.kind ||
        s.pid === p.beforePid ||
        (!s.federation_ready && s.n2n_enabled !== false)
      )
        throw Error("Owned restart readiness was not verified.");
    }
    try {
      await guard();
    } catch {
      throw Object.assign(
        Error("Connection changed after execution; outcome needs inspection."),
        { unknown: true },
      );
    }
    evidence.phase = "complete";
    evidence.state = "verified";
    evidence.message =
      p.action === "install"
        ? "Runtime installed and imports verified; registration and endpoint access remain separate."
        : p.action === "register"
          ? "Active registration verified; runtime loading and endpoint access remain unverified."
          : "Owned federation restart and readiness verified.";
    record();
    return { id: p.id, state: evidence.state, message: evidence.message };
  } catch (error) {
    evidence.state = (error as { unknown?: boolean }).unknown
      ? "unknown"
      : "failed";
    evidence.message =
      "The requested outcome was not verified. Inspect the private baseline and helper recovery state before another operation. No automatic replay occurred.";
    record();
    throw Error(evidence.message);
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}
