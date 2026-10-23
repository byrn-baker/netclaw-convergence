import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export const LIMIT = 1048576;
export const FILES = [
  [
    "SOUL.md",
    "Personality, expertise and operating principles",
    "Session context",
  ],
  [
    "AGENTS.md",
    "Operating instructions, memory and change management",
    "Session context",
  ],
  ["IDENTITY.md", "Name, identity and presentation", "Session context"],
  [
    "USER.md",
    "Your preferences, timezone and network context",
    "Session context",
  ],
  ["TOOLS.md", "Local infrastructure and tool notes", "Session context"],
  ["HEARTBEAT.md", "Periodic health-check instructions", "Heartbeat cycles"],
].map(([name, purpose, loadedWhen]) => ({ name, purpose, loadedWhen }));
export const hash = (x) => createHash("sha256").update(x).digest("hex");
export const digest = (x) => hash(JSON.stringify(x));
export function fileHash(p, code = false) {
  code ? safeExecutable(p) : safePath(p);
  const fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW),
    h = createHash("sha256"),
    buffer = Buffer.alloc(1048576);
  try {
    let n;
    while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)))
      h.update(buffer.subarray(0, n));
    return h.digest("hex");
  } finally {
    fs.closeSync(fd);
  }
}

// Installed executable/code paths may be owned by root or the operator and live
// in group-managed package directories. Writable runtime data uses safePath's
// stricter rules. Native entrypoint hashes are part of the editor's binding.
export function safeExecutable(p) {
  if (typeof p !== "string" || !path.isAbsolute(p) || fs.realpathSync(p) !== p)
    throw Error("Use a canonical native executable path.");
  let current = path.parse(p).root;
  for (const part of p.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const st = fs.lstatSync(current);
    if (
      st.isSymbolicLink() ||
      ![0, process.getuid?.()].includes(st.uid) ||
      (st.mode & 0o002 &&
        !(st.isDirectory() && st.mode & 0o1000 && st.uid === 0))
    )
      throw Error(
        "Native executable path has an untrusted owner or permissions.",
      );
  }
  const st = fs.statSync(p);
  if (!st.isFile() || st.nlink !== 1 || st.mode & 0o022)
    throw Error(
      "Native entrypoint must be a regular file without group/world writes.",
    );
}

export function safePath(
  p,
  { directory = false, missing = false, privateMode = false } = {},
) {
  if (typeof p !== "string" || !path.isAbsolute(p) || p.includes("\0"))
    throw Error("Expected an absolute local path.");
  const normalized = path.resolve(p);
  let current = path.parse(normalized).root;
  for (const part of normalized
    .slice(current.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (e) {
      if (e.code === "ENOENT" && missing && current === normalized) return null;
      throw e;
    }
    if (stat.isSymbolicLink())
      throw Error("Symbolic links are not allowed in managed paths.");
    if (current !== normalized && !stat.isDirectory())
      throw Error("Unsafe path ancestor.");
    // System-owned ancestors are valid; no group/world writable paths except sticky OS temp.
    if (
      stat.mode & 0o022 &&
      !(stat.isDirectory() && stat.mode & 0o1000 && stat.uid === 0)
    )
      throw Error("Managed path is writable by another user.");
  }
  const s = fs.lstatSync(normalized);
  if (directory ? !s.isDirectory() : !s.isFile())
    throw Error("Expected a regular managed file/directory.");
  if (!directory && s.nlink !== 1)
    throw Error("Hard links are not allowed for managed files.");
  if (s.uid !== process.getuid?.())
    throw Error("Managed path must belong to the current user.");
  if (privateMode && s.mode & 0o077)
    throw Error("Private management state has unsafe permissions.");
  return s;
}
export function bytes(p, max = LIMIT) {
  safePath(p);
  const fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const s = fs.fstatSync(fd);
    if (!s.isFile() || s.nlink !== 1 || s.size > max)
      throw Error("File exceeds the 1 MiB limit or is not a regular file.");
    const buffer = Buffer.alloc(max + 1);
    let length = 0,
      count;
    while (
      length < buffer.length &&
      (count = fs.readSync(fd, buffer, length, buffer.length - length, null))
    )
      length += count;
    if (length > max) throw Error("File exceeds the 1 MiB limit.");
    const after = fs.fstatSync(fd);
    if (
      after.size !== length ||
      after.mtimeMs !== s.mtimeMs ||
      after.ctimeMs !== s.ctimeMs ||
      after.nlink !== 1
    )
      throw Error("File changed while reading.");
    return { b: buffer.subarray(0, length), s };
  } finally {
    fs.closeSync(fd);
  }
}
export function utf8(b) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(b);
  } catch {
    throw Error("File must contain valid UTF-8.");
  }
}
export function privateDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { mode: 0o700 });
  safePath(p, { directory: true, privateMode: true });
  return p;
}
export function atomic(p, data) {
  safePath(path.dirname(p), { directory: true, privateMode: true });
  safePath(p, { missing: true, privateMode: true });
  const tmp = path.join(path.dirname(p), "." + randomUUID());
  const fd = fs.openSync(tmp, "wx", 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, p);
    syncDirectory(path.dirname(p));
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
function syncDirectory(directory) {
  const fd = fs.openSync(
    directory,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
export function json(p) {
  safePath(p, { privateMode: true });
  return JSON.parse(utf8(bytes(p, 2 * LIMIT).b));
}
export function scopedEnv(t) {
  let env = { ...process.env };
  let recorded = false;
  const stored = path.join(t.home, "netclaw-hud/management/services/hud.json");
  if (fs.existsSync(stored)) {
    const d = json(stored);
    if (
      d.installationId !== t.installationId ||
      d.home !== t.home ||
      d.kind !== t.kind
    )
      throw Error("HUD launch environment identity changed.");
    env = { ...d.env };
    recorded = true;
  }
  for (const k of Object.keys(env))
    if (
      recorded
        ? t.kind === "openclaw"
          ? k.startsWith("HERMES_")
          : k.startsWith("OPENCLAW_")
        : /^(OPENCLAW_|HERMES_|HUD_|NETCLAW_|N2N_|IN2N_)/.test(k)
    )
      delete env[k];
  Object.assign(env, {
    HOME: t.launch.home,
    NETCLAW_RUNTIME: t.kind,
    HUD_HOME: t.home,
    NETCLAW_HUD_INSTALLATION_ID: t.installationId,
  });
  if (t.kind === "openclaw")
    Object.assign(env, {
      OPENCLAW_HOME: t.launch.openclawHome || t.launch.home,
      OPENCLAW_STATE_DIR: t.home,
      OPENCLAW_CONFIG_PATH: t.configPath,
      ...(t.launch.profile ? { OPENCLAW_PROFILE: t.launch.profile } : {}),
    });
  else env.HERMES_HOME = t.home;
  return env;
}
export async function resolveTarget(raw) {
  const t = structuredClone(raw);
  if (
    t.schemaVersion !== 1 ||
    !["openclaw", "hermes"].includes(t.kind) ||
    typeof t.installationId !== "string"
  )
    throw Error("Invalid management identity.");
  for (const p of [t.home, t.root, t.launch?.cwd, t.launch?.home])
    safePath(p, { directory: true });
  safePath(t.configPath);
  const identity = json(path.join(t.home, "netclaw-hud/installation.json"));
  if (identity.installationId !== t.installationId)
    throw Error("Installation identity changed. Reconnect and bind again.");
  const config = bytes(t.configPath);
  let workspace = t.home;
  const code = [];
  for (const name of [
    "claw-control.mjs",
    "lib/claw-files.mjs",
    "lib/claw-process.mjs",
    "lib/claw-services.mjs",
  ]) {
    const p = path.join(t.root, "scripts", name);
    if (fs.existsSync(p)) code.push([name, hash(bytes(p, 4 * LIMIT).b)]);
  }
  if (t.kind === "openclaw") {
    safeExecutable(t.cli);
    let stdout;
    try {
      ({ stdout } = await exec(t.cli, ["agents", "list", "--json"], {
        cwd: t.launch.cwd,
        env: scopedEnv(t),
        timeout: 15000,
        maxBuffer: 2 * LIMIT,
      }));
    } catch {
      throw Error(
        "Native workspace discovery failed. Verify the selected configuration and executable.",
      );
    }
    let agents;
    try {
      agents = JSON.parse(stdout);
    } catch {
      throw Error("Native OpenClaw workspace discovery did not return JSON.");
    }
    if (!Array.isArray(agents))
      throw Error("Native OpenClaw agent catalog is unavailable.");
    const a = agents.filter((x) => x.id === t.agentId);
    if (a.length !== 1 || typeof a[0].workspace !== "string")
      throw Error("Selected OpenClaw agent is missing or ambiguous.");
    workspace = a[0].workspace;
    if (t.expectedWorkspace && path.resolve(workspace) !== t.expectedWorkspace)
      throw Error(
        "Native workspace differs from the connected HUD. Rebind using its actual launch environment.",
      );
  }
  safePath(workspace, { directory: true });
  t.workspace = path.resolve(workspace);
  const rootStat = fs.statSync(t.workspace),
    homeStat = fs.statSync(t.home);
  t.fingerprint = digest({
    identity: t.installationId,
    kind: t.kind,
    home: t.home,
    homeInode: [homeStat.dev, homeStat.ino],
    workspace: t.workspace,
    workspaceInode: [rootStat.dev, rootStat.ino],
    config: hash(config.b),
    environment: fs.existsSync(path.join(t.home, ".env"))
      ? fileHash(path.join(t.home, ".env"))
      : null,
    launchEnvironment: fs.existsSync(
      path.join(t.home, "netclaw-hud/management/services/hud.json"),
    )
      ? fileHash(path.join(t.home, "netclaw-hud/management/services/hud.json"))
      : null,
    agent: t.agentId,
    launch: t.launch,
    code,
    cli: t.kind === "openclaw" ? fileHash(t.cli, true) : null,
  });
  t.state = privateDir(
    path.join(privateDir(path.join(t.home, "netclaw-hud")), "management"),
  );
  for (const name of ["reviews", "operations", "backups"])
    privateDir(path.join(t.state, name));
  return t;
}
function filename(name) {
  if (!FILES.some((x) => x.name === name))
    throw Error("Unsupported managed filename.");
  return name;
}
function current(t, name) {
  const p = path.join(t.workspace, filename(name));
  const s = safePath(p, { missing: true });
  if (!s)
    return { name, exists: false, revision: "missing", content: "", bytes: 0 };
  const { b, s: opened } = bytes(p);
  if (s.ino !== opened.ino || s.dev !== opened.dev)
    throw Error("File changed while reading.");
  return {
    name,
    exists: true,
    revision: digest({
      sha: hash(b),
      dev: opened.dev,
      ino: opened.ino,
      mode: opened.mode,
    }),
    content: utf8(b),
    bytes: b.length,
    sha256: hash(b),
    mode: opened.mode & 0o777,
  };
}
export async function readManaged(raw, name) {
  const t = await resolveTarget(raw);
  return {
    ...current(t, name),
    workspace: t.workspace,
    fingerprint: t.fingerprint,
  };
}
export async function inspectFiles(raw) {
  const t = await resolveTarget(raw);
  return {
    workspace: t.workspace,
    fingerprint: t.fingerprint,
    kind: t.kind,
    installationId: t.installationId,
    loading:
      t.kind === "hermes"
        ? "Stored in the native Hermes home. The protected HUD engine does not load these persona files; restart does not change that protection."
        : "OpenClaw loads workspace instructions according to session type. Existing conversations may retain earlier context; HEARTBEAT.md applies to heartbeat cycles.",
    files: FILES.map((f) => {
      try {
        const c = current(t, f.name);
        return { ...f, exists: c.exists, bytes: c.bytes, revision: c.revision };
      } catch (e) {
        return { ...f, error: e.message };
      }
    }),
  };
}
function contentBytes(content) {
  if (typeof content !== "string") throw Error("Content must be UTF-8 text.");
  const b = Buffer.from(content, "utf8");
  if (b.length > LIMIT) throw Error("Content exceeds the 1 MiB limit.");
  if (utf8(b) !== content)
    throw Error("Content must contain valid UTF-8 characters.");
  return b;
}
export async function prepareWrite(raw, input) {
  const t = await resolveTarget(raw);
  assertSettled(t);
  const c = current(t, input.name),
    b = contentBytes(input.content);
  if (c.revision !== input.baseline)
    throw Error("File changed. Reload and review the conflict.");
  const review = {
    id: randomUUID(),
    type: "write",
    name: input.name,
    baseline: c.revision,
    draft: hash(b),
    fingerprint: t.fingerprint,
    created: Date.now(),
    installationId: t.installationId,
    workspace: t.workspace,
  };
  atomic(path.join(t.state, "reviews", review.id + ".json"), review);
  return review;
}
export function reviewed(t, input, type) {
  if (!/^[a-f0-9-]{36}$/.test(input.id || "")) throw Error("Invalid review.");
  const r = json(path.join(t.state, "reviews", input.id + ".json"));
  if (
    r.type !== type ||
    r.fingerprint !== t.fingerprint ||
    Date.now() - r.created > 600000
  )
    throw Error("Review expired or target changed. Review again.");
  return r;
}
export async function locked(t, fn) {
  const p = path.join(t.state, "mutation.lock");
  let fd;
  try {
    fd = fs.openSync(p, "wx", 0o600);
  } catch {
    throw Error(
      "Another operation or an interrupted operation holds the lock. Reconcile before retrying.",
    );
  }
  try {
    fs.writeFileSync(
      fd,
      JSON.stringify({ pid: process.pid, started: Date.now() }),
    );
    return await fn();
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(p);
  }
}
export async function applyWrite(raw, input) {
  const t = await resolveTarget(raw);
  return locked(t, async () => {
    assertSettled(t);
    const r = reviewed(t, input, "write"),
      b = contentBytes(input.content);
    if (hash(b) !== r.draft) throw Error("Draft changed after review.");
    const evidence = path.join(t.state, "operations", r.id + ".json");
    if (fs.existsSync(evidence))
      throw Error("This review was already attempted. Reconcile its outcome.");
    const before = current(t, r.name);
    if (before.exists && !(before.mode & 0o200))
      throw Error("Managed file is not writable by its owner.");
    if (!(fs.statSync(t.workspace).mode & 0o200))
      throw Error("Workspace directory is not writable.");
    if (before.revision !== r.baseline)
      throw Error("File changed. Reload and review the conflict.");
    const p = path.join(t.workspace, r.name),
      backup = before.exists
        ? path.join(t.state, "backups", r.id + ".md")
        : null;
    const journal = {
      id: r.id,
      type: "write",
      name: r.name,
      installationId: t.installationId,
      baseline: r.baseline,
      draft: r.draft,
      phase: "prepared",
      started: Date.now(),
      backup,
    };
    atomic(evidence, journal);
    let replaced = false,
      tmp;
    try {
      if (backup) {
        const fd = fs.openSync(backup, "wx", 0o600);
        try {
          fs.writeFileSync(fd, Buffer.from(before.content));
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        syncDirectory(path.dirname(backup));
      }
      if (
        (await resolveTarget(raw)).fingerprint !== r.fingerprint ||
        current(t, r.name).revision !== r.baseline
      )
        throw Error("Target or file changed before replacement.");
      if (before.exists) {
        tmp = path.join(t.workspace, ".netclaw-" + randomUUID() + ".tmp");
        const fd = fs.openSync(tmp, "wx", 0o600);
        try {
          fs.writeFileSync(fd, b);
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        if (current(t, r.name).revision !== r.baseline)
          throw Error("File changed before replacement.");
        fs.renameSync(tmp, p);
        tmp = null;
        replaced = true;
      } else {
        const fd = fs.openSync(p, "wx", 0o600);
        replaced = true;
        try {
          fs.writeFileSync(fd, b);
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }
      syncDirectory(t.workspace);
      const after = current(t, r.name);
      if (after.sha256 !== r.draft)
        throw Error("Readback verification failed.");
      atomic(evidence, {
        ...journal,
        phase: "verified",
        finished: Date.now(),
        revision: after.revision,
      });
      return {
        outcome: "verified",
        backup,
        evidence,
        revision: after.revision,
        name: r.name,
      };
    } catch (e) {
      atomic(evidence, {
        ...journal,
        phase: replaced ? "unknown" : "failed",
        finished: Date.now(),
      });
      if (replaced)
        throw Error(
          "Save outcome unknown. Do not restart; reconcile and inspect the private recovery copy.",
        );
      throw e;
    } finally {
      if (tmp && fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });
}

export function assertSettled(t) {
  for (const name of fs
    .readdirSync(path.join(t.state, "operations"))
    .filter((n) => /^[a-f0-9-]+\.json$/.test(n))) {
    const j = json(path.join(t.state, "operations", name));
    if (
      !["verified", "failed", "not-applied", "reconciled-partial"].includes(
        j.phase,
      )
    )
      throw Error(
        "A previous operation has an unresolved outcome. Reconcile before preparing another mutation.",
      );
  }
}
export function reconcileFiles(t) {
  const lock = path.join(t.state, "mutation.lock");
  if (fs.existsSync(lock)) {
    const l = json(lock);
    try {
      process.kill(l.pid, 0);
      throw Error("A management operation is still active.");
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
    fs.unlinkSync(lock);
  }
  for (const name of fs
    .readdirSync(path.join(t.state, "operations"))
    .filter((n) => /^[a-f0-9-]+\.json$/.test(n))) {
    const p = path.join(t.state, "operations", name),
      j = json(p);
    if (
      j.type !== "write" ||
      ["verified", "failed", "not-applied"].includes(j.phase)
    )
      continue;
    const c = current(t, j.name);
    const phase =
      c.sha256 === j.draft
        ? "verified"
        : c.revision === j.baseline
          ? "not-applied"
          : "unknown";
    atomic(p, { ...j, phase, reconciled: Date.now(), observed: c.revision });
  }
}
