import { parseEnvData } from "../../ui/netclaw-visual/src/security/private-files.js";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setupServices } from './claw-setup-services.mjs';
import {
  resolveTarget,
  scopedEnv,
  safePath,
  bytes,
  hash,
  digest,
  atomic,
  reviewed,
  locked,
  json,
  assertSettled,
  reconcileFiles,
  fileHash,
  safeExecutable,
  readManaged,
} from "./claw-files.mjs";
import {
  definition,
  definitionHash,
  ownedState,
  startOwned,
  stopOwned,
  processIdentity,
  sameProcessStart,
  healthy,
  delay,
  endpointOwned,
  freeEndpoint,
  reconcileOwned,
} from "./claw-process.mjs";
const exec = promisify(execFile);
async function command(bin, args, options = {}) {
  try {
    return (
      await exec(bin, args, {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
        ...options,
      })
    ).stdout;
  } catch {
    throw Error(
      "Native service-manager command failed. Inspect the selected service locally.",
    );
  }
}
const same = (a, b) =>
  typeof a === "string" && path.resolve(a) === path.resolve(b);
function owns(t, env) {
  return t.kind === "hermes"
    ? same(env.HERMES_HOME, t.home)
    : same(env.OPENCLAW_STATE_DIR, t.home) &&
        same(env.OPENCLAW_CONFIG_PATH, t.configPath);
}
function recognize(t, argv, role) {
  if (
    !Array.isArray(argv) ||
    argv.some((a) => typeof a !== "string" || a.includes("\n"))
  )
    return false;
  if (role === "federation")
    return (
      argv.some((a) =>
        same(a, path.join(t.root, "scripts/federation-control.py")),
      ) && argv.includes("run")
    );
  if (t.kind === "openclaw")
    return (
      argv.includes("gateway") &&
      argv.some((a) => /openclaw(?:\.mjs|\/.*\.(?:m?js|cjs))?$/.test(a)) &&
      !argv.some((a) => ["install", "restart", "stop", "--force"].includes(a))
    );
  return (
    argv.includes("hermes_cli") &&
    argv.includes("gateway") &&
    argv.includes("run")
  );
}
function inputHashes(paths, code = false) {
  return paths.filter(Boolean).map((p) => {
    const resolved = code ? fs.realpathSync(p) : p;
    code ? safeExecutable(resolved) : safePath(p);
    return [p, resolved, fileHash(resolved, code)];
  });
}
async function launchd(t) {
  const dir = path.join(t.launch.home, "Library/LaunchAgents");
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const name of fs
    .readdirSync(dir)
    .filter((n) =>
      /^(ai\.openclaw\.|ai\.hermes\.|netclaw[.-].*mesh).*\.plist$/.test(n),
    )) {
    const file = path.join(dir, name);
    safePath(file);
    let d;
    try {
      d = JSON.parse(
        await command("/usr/bin/plutil", ["-convert", "json", "-o", "-", file]),
      );
    } catch {
      throw Error("Cannot parse a candidate runtime service definition.");
    }
    const env = d.EnvironmentVariables || {};
    if (!owns(t, env)) {
      // An explicit foreign home is a neighboring installation. Missing scope is ambiguous.
      const specified =
        t.kind === "hermes" ? env.HERMES_HOME : env.OPENCLAW_STATE_DIR;
      if (specified) continue;
      if (name.includes(t.kind))
        throw Error(
          "A native gateway has no explicit installation scope. Full lifecycle is unavailable.",
        );
      continue;
    }
    const role = name.includes("mesh") ? "federation" : "gateway";
    if (
      !/^[A-Za-z0-9._-]+$/.test(d.Label) ||
      !recognize(t, d.ProgramArguments, role) ||
      d.Program
    )
      throw Error("Native service uses an unsupported or ambiguous launcher.");
    if (d.WorkingDirectory) safePath(d.WorkingDirectory, { directory: true });
    const inputs = [
      ...inputHashes([file]),
      ...inputHashes(
        d.ProgramArguments.filter(
          (a) =>
            path.isAbsolute(a) && fs.existsSync(a) && fs.statSync(a).isFile(),
        ),
        true,
      ),
    ];
    const domain = "gui/" + process.getuid();
    let loaded = "";
    try {
      loaded = await command("/bin/launchctl", [
        "print",
        domain + "/" + d.Label,
      ]);
    } catch {}
    if (loaded) {
      if (
        !loaded.includes("path = " + file) ||
        !loaded.includes("program = " + d.ProgramArguments[0])
      )
        throw Error(
          "Loaded native service differs from the reviewed definition.",
        );
      const args = loaded
        .match(/\n\s*arguments = \{\n([\s\S]*?)\n\s*\}/)?.[1]
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!args || JSON.stringify(args) !== JSON.stringify(d.ProgramArguments))
        throw Error("Loaded native service arguments differ from disk.");
      for (const k of [
        "OPENCLAW_STATE_DIR",
        "OPENCLAW_CONFIG_PATH",
        "HERMES_HOME",
      ])
        if (env[k] && !loaded.includes(k + " => " + env[k]))
          throw Error("Loaded native service environment differs from disk.");
    }
    result.push({
      role,
      controller: "launchd",
      label: d.Label,
      domain,
      file,
      inputs,
      installationId: t.installationId,
      home: t.home,
      kind: t.kind,
      health:
        role === "gateway" ? await gatewayHealth(t) : federationHealth(t, env),
    });
  }
  return result;
}
// Accept only the literal, single-line subset whose systemd interpretation we
// can reproduce. Dotenv parsing differs for comments, escapes and multiline data.
function systemdEnvironment(text) {
  const env = Object.create(null);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^[#;]/.test(line)) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) throw Error("Native environment file uses unsupported syntax.");
    const value = m[2].trim();
    // EnvironmentFile preserves interior whitespace and quotes when the value
    // starts unquoted (systemd.exec). These are literal bytes, not shell words.
    // Keep escapes and multiline values outside this qualified subset.
    if (/^(?:[^"'\\\s][^\\]*)?$/.test(value)) env[m[1]] = value;
    else if (/^"[^"\\]*"$/.test(value) || /^'[^'\\]*'$/.test(value))
      env[m[1]] = value.slice(1, -1);
    else throw Error("Native environment file uses unsupported syntax.");
  }
  return env;
}
// The injectable read-only command transport is used by host-independent
// contract tests. Production always uses the fixed systemctl executable.
export async function discoverSystemdServices(t, run = command) {
  let listing;
  try {
    listing = await run("/usr/bin/systemctl", [
      "--user",
      "list-unit-files",
      "--type=service",
      "--no-legend",
      "--no-pager",
    ]);
  } catch {
    throw Error(
      "The user service manager is unavailable; full lifecycle cannot be established.",
    );
  }
  const out = [];
  for (const unit of listing
    .split("\n")
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((n) =>
      new RegExp(
        `^(${t.kind}-gateway|netclaw-mesh)(?:[-.][\\w.-]+)?\\.service$`,
      ).test(n),
    )) {
    const raw = await run("/usr/bin/systemctl", [
      "--user",
      "show",
      unit,
      "--no-pager",
      "--property=Id,FragmentPath,DropInPaths,Environment,EnvironmentFiles,ExecStart,WorkingDirectory,NeedDaemonReload,LoadState",
    ]);
    const v = Object.fromEntries(
      raw
        .trim()
        .split("\n")
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i), l.slice(i + 1)];
        }),
    );
    const env = Object.fromEntries(
      (v.Environment || "")
        .matchAll(/(?:^|\s)([A-Z_][A-Z0-9_]*)=([^\s"]+)/g)
        .map((m) => [m[1], m[2]]),
    );
    const envFiles = [];
    if (v.EnvironmentFiles) {
      const entries = [
        ...v.EnvironmentFiles.matchAll(
          /(\/[^\s]+) \(ignore_errors=(yes|no)\)/g,
        ),
      ];
      if (
        !entries.length ||
        entries.map((m) => m[0]).join(" ") !== v.EnvironmentFiles.trim()
      )
        throw Error("Native environment file list uses unsupported syntax.");
      for (const m of entries) {
        const file = m[1];
        // Resolve explicit neighboring installations before applying selected-
        // home eligibility. Their private files are never changed or projected.
        if (
          ![".env", "mesh.systemd.env", "gateway.systemd.env"].includes(
            path.basename(file),
          )
        )
          throw Error("Native unit uses an unqualified environment file.");
        if (fs.existsSync(file)) {
          safePath(file, { privateMode: true });
          Object.assign(
            env,
            systemdEnvironment(bytes(file).b.toString("utf8")),
          );
          envFiles.push(file);
        } else if (m[2] !== "yes")
          throw Error("Required native environment file is missing.");
      }
    }
    if (!owns(t, env)) {
      const specified =
        t.kind === "hermes" ? env.HERMES_HOME : env.OPENCLAW_STATE_DIR;
      if (
        same(specified, t.home) ||
        (t.kind === "openclaw" && same(env.OPENCLAW_CONFIG_PATH, t.configPath))
      )
        throw Error("Native unit has conflicting installation scope.");
      if (specified && path.isAbsolute(specified)) continue;
      if (unit.startsWith(t.kind))
        throw Error(
          "Native unit lacks an explicit verifiable installation scope.",
        );
      continue;
    }
    if (envFiles.some((file) => path.dirname(file) !== t.home))
      throw Error(
        "Selected native unit uses an environment file outside its home.",
      );
    if (v.NeedDaemonReload !== "no" || v.LoadState !== "loaded")
      throw Error(
        "Native unit uses unqualified environment files or needs a manager reload.",
      );
    const args = v.ExecStart?.match(/argv\[\]=([^;]+);/)?.[1]
      .trim()
      .split(/\s+/);
    const role = unit.startsWith("netclaw-mesh") ? "federation" : "gateway";
    if (!recognize(t, args, role) || /["'\\]/.test(args.join(" ")))
      throw Error("Native unit has an unsupported launcher.");
    const inputs = inputHashes([
      v.FragmentPath,
      ...envFiles,
      ...(v.DropInPaths || "").split(/\s+/).filter(Boolean),
    ]).concat(
      inputHashes(
        args.filter(
          (a) =>
            path.isAbsolute(a) && fs.existsSync(a) && fs.statSync(a).isFile(),
        ),
        true,
      ),
    );
    out.push({
      role,
      controller: "systemd",
      unit,
      inputs,
      installationId: t.installationId,
      home: t.home,
      kind: t.kind,
      health:
        role === "gateway" ? await gatewayHealth(t) : federationHealth(t, env),
    });
  }
  return out;
}
async function gatewayHealth(t) {
  if (t.kind !== "openclaw") return undefined;
  try {
    const j = JSON.parse(
      await command(t.cli, ["gateway", "status", "--json", "--no-probe"], {
        env: scopedEnv(t),
        cwd: t.launch.cwd,
      }),
    );
    const port = j.gateway?.port;
    if (!Number.isInteger(port)) return;
    return { url: `http://127.0.0.1:${port}/health` };
  } catch {
    return;
  }
}
async function nativeState(d) {
  if (d.controller === "launchd") {
    let s;
    try {
      s = await command("/bin/launchctl", ["print", d.domain + "/" + d.label]);
    } catch {
      return { state: "stopped" };
    }
    const pid = Number(s.match(/\n\s*pid = (\d+)/)?.[1]);
    if (!pid) return { state: "stopped", loaded: true };
    const p = await processIdentity(pid);
    if (!p) return { state: "stopping", pid };
    if (p.uid !== process.getuid())
      throw Error("Native service PID ownership is unverified.");
    return {
      state:
        d.health && (await endpointOwned(d, pid)) && (await healthy(d))
          ? "ready"
          : "running-unready",
      pid,
    };
  }
  const s = await command("/usr/bin/systemctl", [
    "--user",
    "show",
    d.unit,
    "--no-pager",
    "--property=ActiveState,MainPID",
  ]);
  const active = /ActiveState=active\b/.test(s),
    pid = Number(s.match(/MainPID=(\d+)/)?.[1]);
  if (!active && !pid) return { state: "stopped" };
  return {
    state:
      active && d.health && (await endpointOwned(d, pid)) && (await healthy(d))
        ? "ready"
        : "running-unready",
    pid,
  };
}
async function observe(t, d) {
  return d.controller === "owned"
    ? ownedState(t, d)
    : d.controller === "federation"
      ? federationState(t, d)
      : nativeState(d);
}
export async function inspectServices(raw) {
  const t = await resolveTarget(raw);
  let services = [],
    reason;
  try {
    for (const role of ["gateway", "hud", "federation"]) {
      const d = definition(t, role);
      if (d) services.push({ ...d, definition: definitionHash(t, role) });
    }
    const native = [...await setupServices(t,command),...(
      process.platform === "darwin"
        ? await launchd(t)
        : process.platform === "linux"
          ? await discoverSystemdServices(t)
          : [])];
    for (const d of native) {
      if (services.some((s) => s.role === d.role))
        throw Error(
          "Multiple owners claim " +
            d.role +
            ". Full lifecycle is unavailable.",
        );
      services.push(d);
    }
    if (
      services.some(
        (s) => s.controller !== "owned" && s.role === "gateway" && !s.health,
      )
    )
      throw Error(
        "The native messaging gateway has no qualified readiness controller. Full lifecycle is unavailable.",
      );
    if (!services.some((s) => s.role === "hud"))
      throw Error(
        "HUD has no durable owner. Start this source checkout with scripts/hud-launch.mjs managed, then reconnect.",
      );
    if (t.kind === "openclaw" && !services.some((s) => s.role === "gateway"))
      throw Error(
        "No verified gateway owner. Full lifecycle is unavailable for this installation.",
      );
    if (
      [
        "n2n",
        "netclaw-federation",
        "mesh.systemd.env",
        "python-runtimes/records/n2n",
      ].some((p) => fs.existsSync(path.join(t.home, p))) &&
      !services.some((s) => s.role === "federation")
    )
      services.push(await standaloneFederation(t));
    if (
      t.kind === "hermes" &&
      !services.some((s) => s.role === "gateway") &&
      fs.existsSync(path.join(t.home, "gateway.pid"))
    )
      throw Error(
        "A separate Hermes messaging gateway is present without a qualified owner.",
      );
  } catch (e) {
    reason = e.message;
  }
  const status = [];
  for (const d of services) {
    try {
      status.push({
        role: d.role,
        controller: d.controller,
        ...(await observe(t, d)),
      });
    } catch (e) {
      reason = reason || e.message;
      status.push({ role: d.role, controller: d.controller, state: "unknown" });
    }
  }
  const scope = digest(
    services.map((d) => ({
      role: d.role,
      controller: d.controller,
      definition: d.definition,
      inputs:
        d.controller === "owned"
          ? (d.sourceInputs || []).map(([p]) => [p, fileHash(p, true)])
          : d.inputs,
      unit: d.unit,
      label: d.label,
      domain: d.domain,
    })),
  );
  return {
    t,
    services,
    public: {
      available: !reason,
      reason,
      scope,
      services: status.map(({ record, ...s }) => s),
      absent: ["gateway", "hud", "federation"].filter(
        (r) => !services.some((s) => s.role === r),
      ),
      activity:
        "Active work is unknown. Stop or restart can interrupt conversations, requests and federation work.",
    },
  };
}
export async function prepareLifecycle(raw, input) {
  if (!["start", "stop", "restart"].includes(input.action))
    throw Error("Unsupported lifecycle action.");
  const s = await inspectServices(raw);
  assertSettled(s.t);
  if (!s.public.available) throw Error(s.public.reason);
  if (input.writeReviewId) reviewed(s.t, { id: input.writeReviewId }, "write");
  const r = {
    id: crypto.randomUUID(),
    ...(input.writeReviewId ? { writeReviewId: input.writeReviewId } : {}),
    type: "lifecycle",
    action: input.action,
    fingerprint: s.t.fingerprint,
    scope: s.public.scope,
    installationId: s.t.installationId,
    created: Date.now(),
    services: s.public.services.map((x) => ({
      role: x.role,
      controller: x.controller,
    })),
  };
  atomic(path.join(s.t.state, "reviews", r.id + ".json"), r);
  return { ...r, activity: s.public.activity };
}
async function nativeAction(d, action) {
  const before = await nativeState(d);
  const previous = before.pid ? await processIdentity(before.pid) : null;
  if (d.controller === "launchd") {
    const s = await nativeState(d);
    if (action === "stop") {
      if (s.state !== "stopped" || s.loaded)
        await command("/bin/launchctl", ["bootout", d.domain + "/" + d.label]);
    } else if (s.state === "stopped") {
      await command(
        "/bin/launchctl",
        s.loaded
          ? ["kickstart", d.domain + "/" + d.label]
          : ["bootstrap", d.domain, d.file],
      );
    }
  } else await command("/usr/bin/systemctl", ["--user", action, d.unit]);
  for (let i = 0; i < 150; i++) {
    let s;
    try {
      s = await nativeState(d);
    } catch (error) {
      if (action !== "start") throw error;
      await delay(150);
      continue;
    }
    if (action === "stop" && s.state === "stopped") {
      const live = previous ? await processIdentity(previous.pid) : null;
      if (!sameProcessStart(live, previous)) return s;
    }
    if (action === "start" && s.state === "ready") return s;
    await delay(150);
  }
  throw Error(
    "Native service outcome unknown; inspect and reconcile before retrying.",
  );
}
export async function applyLifecycle(raw, input) {
  let s = await inspectServices(raw);
  return locked(s.t, async () => {
    assertSettled(s.t);
    const r = reviewed(s.t, input, "lifecycle");
    if (input.acknowledged !== true)
      throw Error("Interruption acknowledgment is required.");
    if (!s.public.available || s.public.scope !== r.scope)
      throw Error("Service scope changed after review.");
    const evidence = path.join(s.t.state, "operations", r.id + ".json");
    if (fs.existsSync(evidence))
      throw Error("This operation was already attempted. Reconcile first.");
    const journal = {
      id: r.id,
      type: "lifecycle",
      action: r.action,
      installationId: s.t.installationId,
      scope: r.scope,
      phase: "requested",
      steps: [],
      started: Date.now(),
    };
    atomic(evidence, journal);
    try {
      if (r.writeReviewId) {
        const w = json(
          path.join(s.t.state, "operations", r.writeReviewId + ".json"),
        );
        if (
          w.phase !== "verified" ||
          (await readManaged(raw, w.name)).revision !== w.revision
        )
          throw Error(
            "Reviewed save is not verified or its saved revision changed. Restart refused.",
          );
      }
      for (const phase of r.action === "restart"
        ? ["stop", "start"]
        : [r.action]) {
        const order =
          phase === "stop"
            ? ["federation", "hud", "gateway"]
            : ["gateway", "hud", "federation"];
        for (const role of order) {
          s = await inspectServices(raw);
          if (
            !s.public.available ||
            s.public.scope !== r.scope ||
            s.t.fingerprint !== r.fingerprint
          )
            throw Error(
              "Installation or service scope changed during the operation.",
            );
          const d = s.services.find((x) => x.role === role);
          if (!d) continue;
          journal.phase = phase + ":" + role;
          atomic(evidence, journal);
          const result =
            d.controller === "owned"
              ? await (phase === "start" ? startOwned : stopOwned)(s.t, d)
              : d.controller === "federation"
                ? await federationAction(s.t, d, phase)
                : await nativeAction(d, phase);
          journal.steps.push({
            role,
            action: phase,
            state: result.state,
            at: Date.now(),
          });
          atomic(evidence, journal);
        }
      }
      journal.phase = "verified";
      journal.finished = Date.now();
      atomic(evidence, journal);
      return {
        outcome: "verified",
        action: r.action,
        evidence,
        services: (await inspectServices(raw)).public.services,
      };
    } catch (e) {
      journal.phase = journal.phase === "requested" ? "failed" : "unknown";
      journal.finished = Date.now();
      atomic(evidence, journal);
      throw Error(
        "Lifecycle incomplete: " +
          e.message +
          " Saved files remain saved. Inspect/reconcile before another action.",
      );
    }
  });
}
export async function reconcile(raw) {
  const s = await inspectServices(raw);
  reconcileFiles(s.t);
  for (const d of s.services)
    if (d.controller === "owned") await reconcileOwned(s.t, d);
  if (
    s.public.available &&
    s.public.services.every((x) => ["stopped", "ready"].includes(x.state))
  ) {
    for (const n of fs
      .readdirSync(path.join(s.t.state, "operations"))
      .filter((n) => /^[a-f0-9-]+\.json$/.test(n))) {
      const p = path.join(s.t.state, "operations", n),
        j = json(p);
      if (
        j.type === "lifecycle" &&
        !["verified", "failed", "reconciled-partial"].includes(j.phase)
      ) {
        const final = j.action === "stop" ? "stopped" : "ready";
        atomic(p, {
          ...j,
          phase:
            j.action !== "restart" &&
            s.public.services.every((x) => x.state === final)
              ? "verified"
              : "reconciled-partial",
          reconciled: Date.now(),
          observed: s.public.services,
        });
      }
    }
  }
  const operations = fs
    .readdirSync(path.join(s.t.state, "operations"))
    .filter((n) => /^[a-f0-9-]+\.json$/.test(n))
    .map((n) => json(path.join(s.t.state, "operations", n)))
    .sort((a, b) => b.started - a.started)
    .slice(0, 20);
  return { ...s.public, operations };
}

function federationHealth(t, env) {
  if (
    env.NETCLAW_RUNTIME !== t.kind ||
    env.NETCLAW_INSTALLATION_ID !== t.installationId ||
    !same(env.N2N_BASE_DIR, path.join(t.home, "n2n"))
  )
    throw Error(
      "Federation environment does not establish exact installation ownership.",
    );
  let url =
    env.NETCLAW_BGP_API || `http://127.0.0.1:${env.BGP_API_PORT || 8179}`;
  const u = new URL(url);
  if (
    u.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/"
  )
    throw Error("Federation endpoint is not installation-local.");
  return {
    url: u.origin + "/status",
    installationId: t.installationId,
    kind: t.kind,
    identityKey: "installation_id",
    kindKey: "harness_type",
    readyKey: "federation_ready",
    disabledKey: "n2n_enabled",
  };
}
async function standaloneFederation(t) {
  const record = path.join(t.home, "python-runtimes/records/n2n");
  safePath(record);
  const python = fs.realpathSync(bytes(record).b.toString("utf8").trim());
  safeExecutable(python);
  const env = {
    ...scopedEnv(t),
    NETCLAW_RUNTIME: t.kind,
    NETCLAW_INSTALLATION_ID: t.installationId,
    N2N_BASE_DIR: path.join(t.home, "n2n"),
  };
  const files = [
    path.join(t.home, ".env"),
    path.join(t.home, "mesh.systemd.env"),
  ].filter((p) => fs.existsSync(p));
  for (const p of files) {
    safePath(p, { privateMode: true });
    const values = parseEnvData(bytes(p).b.toString("utf8"));
    for (const [key, value] of Object.entries(values))
      if (/^(NETCLAW_|N2N_|BGP_)/.test(key)) env[key] = value;
  }
  const helper = path.join(t.root, "scripts/federation-control.py"),
    daemon = path.join(t.root, "mcp-servers/protocol-mcp/bgp-daemon-v2.py");
  return {
    role: "federation",
    controller: "federation",
    installationId: t.installationId,
    home: t.home,
    kind: t.kind,
    python,
    helper,
    daemon,
    env,
    health: federationHealth(t, env),
    inputs: [
      ...inputHashes([record, ...files]),
      ...inputHashes([python, helper, daemon], true),
    ],
  };
}
async function federationState(t, d) {
  const file = path.join(t.home, "netclaw-federation/daemon.json");
  if (!fs.existsSync(file)) return { state: "stopped" };
  const r = json(file);
  if (r.installationId !== t.installationId)
    throw Error("Federation ownership changed.");
  const p = await processIdentity(r.pid);
  if (!p) return { state: "stopped" };
  if (
    p.uid !== process.getuid() ||
    p.birth !== r.started.replace(/\s+/g, " ") ||
    !p.command.includes(d.daemon)
  )
    throw Error("Federation PID identity is unverified.");
  if (process.platform === "linux") {
    const cg = fs.readFileSync(`/proc/${r.pid}/cgroup`, "utf8");
    if (/\.service(?:\/|$)/m.test(cg))
      throw Error(
        "Federation is supervised by an unqualified service. Use its verified manager.",
      );
  }
  return {
    state:
      (await endpointOwned(d, r.pid)) && (await healthy(d))
        ? "ready"
        : "running-unready",
    pid: r.pid,
  };
}
async function federationAction(t, d, action) {
  const state = await federationState(t, d);
  if (
    (action === "start" && state.state === "ready") ||
    (action === "stop" && state.state === "stopped")
  )
    return state;
  if (action === "start") {
    if (state.state !== "stopped")
      throw Error("Federation is running but not ready.");
    await freeEndpoint(d);
  }
  await command(d.python, [d.helper, action], {
    cwd: t.root,
    env: d.env,
    timeout: 45000,
  });
  const result = await federationState(t, d);
  if (result.state !== (action === "start" ? "ready" : "stopped"))
    throw Error("Federation outcome unknown. Reconcile before another action.");
  return result;
}
