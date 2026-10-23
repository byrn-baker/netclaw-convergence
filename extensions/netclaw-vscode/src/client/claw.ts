import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
export type ClawTarget = {
  schemaVersion: 1;
  kind: "openclaw" | "hermes";
  installationId: string;
  home: string;
  configPath: string;
  agentId: string;
  expectedWorkspace?: string;
  root: string;
  node: string;
  cli?: string;
  launch: {
    cwd: string;
    home: string;
    openclawHome?: string;
    profile?: string;
  };
};
const allowed = new Set([
  "inspect",
  "read",
  "prepare-write",
  "apply-write",
  "prepare-lifecycle",
  "apply-lifecycle",
  "reconcile",
]);
export const sha = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
function localFile(p: string, directory = false) {
  if (typeof p !== "string" || !path.isAbsolute(p))
    throw Error("Management paths must be absolute on this extension host.");
  let current = path.parse(p).root;
  for (const part of path
    .resolve(p)
    .slice(current.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    const s = fs.lstatSync(current);
    if (
      s.isSymbolicLink() ||
      (s.mode & 0o022 && !(s.isDirectory() && s.mode & 0o1000 && s.uid === 0))
    )
      throw Error("Management paths contain links or unsafe permissions.");
  }
  const s = fs.lstatSync(p);
  if (
    s.uid !== process.getuid?.() ||
    (directory ? !s.isDirectory() : !s.isFile() || s.nlink !== 1)
  )
    throw Error("Management files must belong to this extension-host user.");
}
function nativeHash(p: string) {
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
    throw Error("Native entrypoint permissions are unsafe.");
  const fd = fs.openSync(p, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW),
    hash = createHash("sha256"),
    buffer = Buffer.alloc(1048576);
  try {
    let n;
    while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)))
      hash.update(buffer.subarray(0, n));
    return hash.digest("hex");
  } finally {
    fs.closeSync(fd);
  }
}
export function validateTarget(t: ClawTarget) {
  if (t.schemaVersion !== 1 || !["openclaw", "hermes"].includes(t.kind))
    throw Error("Unsupported management discovery.");
  for (const p of [t.home, t.root, t.launch?.cwd, t.launch?.home])
    localFile(p, true);
  localFile(t.configPath);
  const native = [
    nativeHash(t.node),
    ...(t.kind === "openclaw" ? [nativeHash(t.cli!)] : []),
  ];
  const id = path.join(t.home, "netclaw-hud/installation.json");
  localFile(id);
  if (
    JSON.parse(fs.readFileSync(id, "utf8")).installationId !== t.installationId
  )
    throw Error("Local installation identity does not match this connection.");
  const files = [
    "claw-control.mjs",
    "lib/claw-files.mjs",
    "lib/claw-services.mjs",
    "lib/claw-process.mjs",
  ].map((p) => path.join(t.root, "scripts", p));
  for (const p of files) localFile(p);
  return sha(
    [...files.map((p) => sha(fs.readFileSync(p))), ...native].join("|"),
  );
}
export async function claw(
  t: ClawTarget,
  codeHash: string,
  op: string,
  input: Record<string, unknown> = {},
): Promise<any> {
  if (!allowed.has(op)) throw Error("Unsupported management operation.");
  if (validateTarget(t) !== codeHash)
    throw Error(
      "Management helper changed. Rebind and review the local source before continuing.",
    );
  return new Promise((resolve, reject) => {
    const child = spawn(
      t.node,
      [path.join(t.root, "scripts/claw-control.mjs")],
      {
        cwd: t.root,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      },
    );
    let out = "",
      size = 0,
      done = false;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      fail(
        Error(
          "Management outcome unknown after timeout. Reconcile before retrying; no action was replayed.",
        ),
      );
    }, 120000);
    function fail(e: Error) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(e);
    }
    child.stdout.on("data", (b) => {
      size += b.length;
      if (size > 8 * 1048576) {
        child.kill();
        fail(Error("Management response exceeded its limit."));
      } else out += b;
    });
    child.stderr.resume();
    child.once("error", () =>
      fail(Error("Could not execute the reviewed management helper.")),
    );
    child.once("exit", () => {
      if (done) return;
      clearTimeout(timer);
      try {
        const r = JSON.parse(out);
        if (!r.ok) throw Error(String(r.error || "Management action failed."));
        done = true;
        resolve(r.result);
      } catch (e) {
        fail(e instanceof Error ? e : Error("Invalid management response."));
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ op, target: t, input }));
  });
}
