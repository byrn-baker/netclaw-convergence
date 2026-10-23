#!/usr/bin/env node
import {
  inspectFiles,
  readManaged,
  prepareWrite,
  applyWrite,
} from "./lib/claw-files.mjs";
import {
  inspectServices,
  prepareLifecycle,
  applyLifecycle,
  reconcile,
} from "./lib/claw-services.mjs";
const operations = {
  inspect: async (t) => ({
    ...(await inspectFiles(t)),
    lifecycle: (await inspectServices(t)).public,
  }),
  read: (t, i) => readManaged(t, i.name),
  "prepare-write": prepareWrite,
  "apply-write": applyWrite,
  "prepare-lifecycle": prepareLifecycle,
  "apply-lifecycle": applyLifecycle,
  reconcile,
};
let data = "";
try {
  for await (const b of process.stdin) {
    data += b;
    if (Buffer.byteLength(data) > 7 * 1048576)
      throw Error("Management request exceeds limit.");
  }
  const r = JSON.parse(data);
  if (!Object.hasOwn(operations, r.op))
    throw Error("Unsupported management operation.");
  const result = await operations[r.op](r.target, r.input || {});
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (e) {
  process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
}
