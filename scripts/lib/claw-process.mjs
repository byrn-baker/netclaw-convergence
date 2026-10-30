import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  atomic,
  json,
  privateDir,
  safePath,
  hash,
  bytes,
  digest,
  fileHash,
  safeExecutable,
} from "./claw-files.mjs";
const exec = promisify(execFile),
  self = fileURLToPath(import.meta.url);
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
// Linux wall-clock start times reported by ps can move when WSL adjusts its
// boot-time clock. Bind new records to kernel boot ID + monotonic start ticks.
function linuxStart(pid) {
  const text = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
  const fields = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
  if (!text.startsWith(`${pid} (`) || !/^[0-9]+$/.test(fields[19] || '')) throw Error('Unknown process identity.');
  if (['Z', 'X'].includes(fields[0])) return null;
  const boot = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
  if (!/^[a-f0-9-]{36}$/.test(boot)) throw Error('Unknown boot identity.');
  return `linux:${boot}:${fields[19]}`;
}
export function sameProcessStart(observed, expected) {
  return !!observed && (expected.startId !== undefined
    ? observed.startId === expected.startId
    : observed.birth === expected.birth);
}
export async function processIdentity(pid) {
  if (!Number.isInteger(pid) || pid < 2) return null;
  try {
    const startId = process.platform === 'linux' ? linuxStart(pid) : undefined;
    if (startId === null) return null;
    const { stdout } = await exec(
      "/bin/ps",
      ["-p", String(pid), "-o", "uid=,lstart=,command="],
      { timeout: 3000, env: { ...process.env, LC_ALL: "C" } },
    );
    if (startId !== undefined && linuxStart(pid) !== startId) return null;
    const s = stdout.trim();
    if (!s) return null;
    const m = s.match(/^(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/);
    return m
      ? {
          pid,
          uid: Number(m[1]),
          birth: m[2].replace(/\s+/g, " "),
          command: m[3],
          ...(startId === undefined ? {} : { startId }),
        }
      : null;
  } catch {
    return null;
  }
}
export function registry(t) {
  return privateDir(path.join(t.state, "services"));
}
export function serviceFile(t, role) {
  if (!["gateway", "hud", "federation"].includes(role))
    throw Error("Unknown service role.");
  return path.join(registry(t), role + ".json");
}
export function registerOwned(t, role, command, args, env, cwd, health) {
  safeExecutable(command);
  safePath(cwd, { directory: true });
  const d = {
    schemaVersion: 1,
    controller: "owned",
    role,
    installationId: t.installationId,
    home: t.home,
    kind: t.kind,
    command,
    args,
    cwd,
    env,
    health,
    sourceHash: fileHash(command, true),
    sourceInputs: args
      .filter(
        (a) =>
          path.isAbsolute(a) && fs.existsSync(a) && fs.statSync(a).isFile(),
      )
      .map((p) => [p, fileHash(p, true)]),
  };
  // Definitions are private launch inputs. Never return their environment through the editor.
  atomic(serviceFile(t, role), d);
  return d;
}
export function definition(t, role) {
  const file = serviceFile(t, role);
  if (!fs.existsSync(file)) return null;
  const d = json(file);
  if (
    d.installationId !== t.installationId ||
    d.home !== t.home ||
    d.kind !== t.kind ||
    d.role !== role
  )
    throw Error("Service definition identity changed.");
  return d;
}
export function definitionHash(t, role) {
  return hash(bytes(serviceFile(t, role), 2 * 1048576).b);
}
export async function ownedState(t, d) {
  const p = path.join(registry(t), d.role + ".process.json");
  if (!fs.existsSync(p)) return { state: "stopped" };
  const r = json(p);
  if (
    r.installationId !== t.installationId ||
    r.definition !== definitionHash(t, d.role)
  )
    throw Error(
      "Owned service definition changed; reconcile its original owner.",
    );
  const identity = await processIdentity(r.pid);
  if (!identity) {
    const child = await processIdentity(r.childPid);
    if (sameProcessStart(child, { birth: r.childBirth, startId: r.childStartId })) {
      if (child.uid !== process.getuid() || child.command !== r.childCommand)
        throw Error("Orphan process identity is unverified.");
      return { state: "orphaned", record: r };
    }
    return { state: "stopped", record: r };
  }
  if (
    identity.uid !== process.getuid?.() ||
    !sameProcessStart(identity, r) ||
    !identity.command.includes(r.nonce) ||
    !identity.command.includes(self)
  )
    throw Error("PID ownership does not match the service record.");
  return {
    state:
      (await endpointOwned(d, r.childPid)) && (await healthy(d))
        ? "ready"
        : "running-unready",
    record: r,
  };
}
export async function healthy(d) {
  if (!d.health) return false;
  try {
    if(d.health.type==='setup-member')return memberHealth(d).ready===true;
    const u = new URL(d.health.url);
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
      u.protocol !== "http:"
    )
      return false;
    const r = await fetch(u, {
      signal: AbortSignal.timeout(1000),
      redirect: "error",
    });
    if (!r.ok) return false;
    const j = await r.json();
    if(d.health.httpUrls!==undefined){
      if(!Array.isArray(d.health.httpUrls)||d.health.httpUrls.length>2)return false;
      for(const value of d.health.httpUrls){
        const secondary=new URL(value);
        if(secondary.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(secondary.hostname)||secondary.username||secondary.password||secondary.search||secondary.hash)return false;
        const response=await fetch(secondary,{signal:AbortSignal.timeout(1000),redirect:'error'});
        // A source fixture may omit index.html. A Vite 404 still establishes
        // its owned listener; connection refusal never means HUD ready.
        await response.body?.cancel();
        if(response.status!==200&&response.status!==404)return false;
      }
    }
    return (
      (!d.health.installationId ||
        j[d.health.identityKey || "installationId"] ===
          d.health.installationId) &&
      (!d.health.kind || j[d.health.kindKey || "kind"] === d.health.kind) &&
      (!d.health.readyKey ||
        j[d.health.readyKey] === true ||
        (d.health.disabledKey && j[d.health.disabledKey] === false))
    );
  } catch {
    return false;
  }
}
function memberHealth(d){
  const file=path.join(d.home,'netclaw-federation/setup-member-health.json');
  if(d.health.file!==file)throw Error('Member health path changed.');
  safePath(file,{privateMode:true});
  const value=json(file),now=Math.floor(Date.now()/1000);
  if(value.schema!==1||value.installationId!==d.installationId||value.kind!==d.kind||!Number.isSafeInteger(value.pid)||value.pid<2||!Number.isSafeInteger(value.at)||value.at>now+2||now-value.at>15)throw Error('Member health is stale or belongs to another installation.');
  return value;
}
export async function startOwned(t, d) {
  let state = await ownedState(t, d);
  if (state.state === "ready") return state;
  if (state.state !== "stopped")
    throw Error(
      `${d.role} is running but not ready. Inspect it before starting again.`,
    );
  if (
    fileHash(d.command, true) !== d.sourceHash ||
    (d.sourceInputs || []).some(([p, h]) => fileHash(p, true) !== h)
  )
    throw Error(
      "Service executable changed; launch and review its current definition.",
    );
  await reconcileOwned(t, d);
  await freeEndpoint(d);
  const nonce = randomUUID(),
    file = serviceFile(t, d.role);
  const child = spawn(process.execPath, [self, "run", file, nonce], {
    cwd: d.cwd,
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  for (let i = 0; i < 200; i++) {
    await delay(150);
    state = await ownedState(t, d);
    if (state.state === "ready") return state;
    const fail = path.join(registry(t), d.role + ".failure.json");
    if (fs.existsSync(fail) && json(fail).nonce === nonce)
      throw Error(
        `${d.role} could not start. Inspect its private service log.`,
      );
  }
  throw Error(
    `${d.role} start outcome is unknown. Reconcile; do not retry automatically.`,
  );
}
export async function stopOwned(t, d) {
  const s = await ownedState(t, d);
  if (s.state === "stopped") return s;
  const orphan = s.state === "orphaned",
    pid = orphan ? s.record.childPid : s.record.pid,
    expected = orphan ? { birth: s.record.childBirth, startId: s.record.childStartId } : s.record;
  const again = await processIdentity(pid);
  if (
    !again ||
    again.uid !== process.getuid() ||
    !sameProcessStart(again, expected) ||
    (orphan
      ? again.command !== s.record.childCommand
      : !again.command.includes(s.record.nonce))
  )
    throw Error("Process ownership changed before stop.");
  process.kill(pid, "SIGTERM");
  for (let i = 0; i < 150; i++) {
    await delay(100);
    if (!(await processIdentity(pid))) {
      if (await healthy(d))
        throw Error(
          "The owner exited but its endpoint still responds. Stop outcome unknown.",
        );
      await reconcileOwned(t, d);
      return { state: "stopped" };
    }
  }
  throw Error(
    `${d.role} did not finish graceful shutdown. Outcome unknown; no force kill was sent.`,
  );
}
export async function reconcileOwned(t, d) {
  const state = await ownedState(t, d),
    lock = path.join(registry(t), d.role + ".owner.lock");
  if (state.state !== "stopped" || !fs.existsSync(lock)) return;
  const saved = json(lock),
    record = state.record;
  if (
    !record ||
    saved.installationId !== t.installationId ||
    saved.pid !== record.pid ||
    saved.nonce !== record.nonce ||
    !sameProcessStart(saved, record)
  )
    throw Error(
      "Stale service lock cannot be attributed to this installation.",
    );
  if (await processIdentity(saved.pid))
    throw Error("Service lock still has a live owner.");
  fs.unlinkSync(lock);
}
async function run(file, nonce) {
  const d = json(file),
    state = path.dirname(file);
  const id = json(path.join(d.home, "netclaw-hud/installation.json"));
  if (id.installationId !== d.installationId)
    throw Error("Installation changed.");
  const lock = path.join(state, d.role + ".owner.lock");
  let fd;
  try {
    fd = fs.openSync(lock, "wx", 0o600);
  } catch {
    throw Error("Service owner lock exists.");
  }
  const selfIdentity = await processIdentity(process.pid),
    log = fs.openSync(path.join(state, d.role + ".log"), "a", 0o600);
  fs.writeFileSync(
    fd,
    JSON.stringify({
      pid: process.pid,
      birth: selfIdentity.birth,
      ...(selfIdentity.startId ? { startId: selfIdentity.startId } : {}),
      nonce,
      installationId: d.installationId,
    }),
  );
  fs.fsyncSync(fd);
  const child = spawn(d.command, d.args, {
    cwd: d.cwd,
    env: d.env,
    stdio: ["ignore", log, log],
    detached: false,
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    child.kill("SIGTERM");
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  const finish = (code) => {
    if (code)
      atomic(path.join(state, d.role + ".failure.json"), {
        nonce,
        code,
        at: Date.now(),
      });
    fs.closeSync(fd);
    fs.unlinkSync(lock);
    fs.closeSync(log);
    process.exitCode = code || 0;
  };
  child.on("error", () => finish(1));
  child.on("exit", (code) => finish(code));
  const childIdentity = await processIdentity(child.pid);
  atomic(path.join(state, d.role + ".process.json"), {
    pid: process.pid,
    birth: selfIdentity.birth,
    ...(selfIdentity.startId ? { startId: selfIdentity.startId } : {}),
    nonce,
    installationId: d.installationId,
    definition: hash(bytes(file).b),
    childPid: child.pid,
    childBirth: childIdentity?.birth,
    ...(childIdentity?.startId ? { childStartId: childIdentity.startId } : {}),
    childCommand: childIdentity?.command,
    started: Date.now(),
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  try {
    if (process.argv[2] !== "run" || !process.argv[3] || !process.argv[4])
      throw Error("Internal owned service runner.");
    await run(process.argv[3], process.argv[4]);
  } catch {
    process.exitCode = 1;
  }
}

export async function endpointOwned(d, owner) {
  if (!d.health || !owner) return false;
  if(d.health.type==='setup-member'){
    try{return memberHealth(d).pid===owner;}catch{return false;}
  }
  if(d.health.httpUrls!==undefined){
    if(!Array.isArray(d.health.httpUrls)||d.health.httpUrls.length>2)return false;
    for(const url of d.health.httpUrls)if(!await endpointOwned({...d,health:{url}},owner))return false;
  }
  const port = new URL(d.health.url).port;
  let pids = [];
  try {
    if (process.platform === "darwin") {
      const { stdout } = await exec(
        "/usr/sbin/lsof",
        ["-nP", "-a", "-iTCP:" + port, "-sTCP:LISTEN", "-Fp"],
        { timeout: 3000, maxBuffer: 65536 },
      );
      pids = [...stdout.matchAll(/^p(\d+)$/gm)].map((m) => Number(m[1]));
    } else {
      const { stdout } = await exec("ss", ["-H", "-ltnp", "sport = :" + port], {
        timeout: 3000,
        maxBuffer: 65536,
      });
      pids = [...stdout.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
    }
  } catch {
    return false;
  }
  if (!pids.length) return false;
  for (let pid of pids) {
    let matched = false;
    for (let n = 0; n < 16 && pid > 1; n++) {
      if (pid === owner) {
        matched = true;
        break;
      }
      const identity = await processIdentity(pid);
      if (!identity || identity.uid !== process.getuid()) break;
      try {
        pid = Number(
          (
            await exec("/bin/ps", ["-p", String(pid), "-o", "ppid="], {
              timeout: 3000,
            })
          ).stdout.trim(),
        );
      } catch {
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}
export async function freeEndpoint(d) {
  if (!d.health)
    throw Error("Managed service has no qualified readiness endpoint.");
  const u = new URL(d.health.url);
  if (
    u.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
  )
    throw Error("Expected a loopback readiness endpoint.");
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", () =>
      reject(
        Error(
          "The selected service port is already owned by another listener. Nothing was started or stopped.",
        ),
      ),
    );
    s.listen(
      {
        host:
          u.hostname === "localhost"
            ? "127.0.0.1"
            : u.hostname.replace(/[\[\]]/g, ""),
        port: Number(u.port),
        exclusive: true,
      },
      () => s.close(resolve),
    );
  });
}
