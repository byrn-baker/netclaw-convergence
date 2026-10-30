import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual as equal } from "node:util";
import { parseDocument, stringify, isMap, isScalar } from "yaml";
import {
  regularTarget,
  writePrivateAtomic,
} from "./src/security/private-files.js";
const LIMIT = 256 * 1024,
  MASK_LIMIT = 512 * 1024;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status, controlled: true });
};
const map = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const columns = [
  "id",
  "alias",
  "type",
  "os",
  "platform",
  "connection",
  "protocol",
  "host",
  "port",
];
const metadata = ["alias", "type", "os", "platform"];
const secretKey = (key) =>
  /credential|password|passwd|passphrase|secret|token|private.?key|api.?key|authorization/i.test(
    key,
  );
const ref = (value) =>
  typeof value === "string" && /^%ENV\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value);
function bounded(text, limit = LIMIT) {
  if (typeof text !== "string" || Buffer.byteLength(text) > limit)
    fail(`Document exceeds the ${limit / 1024} KiB limit.`);
}
function validate(value, depth = 0, seen = new Set(), budget = { nodes: 0 }) {
  if (depth > 32 || ++budget.nodes > 40000)
    fail("Document structure exceeds the safe depth or expansion limit.");
  if (value && typeof value === "object") {
    if (seen.has(value)) fail("Recursive YAML aliases are not supported.");
    seen.add(value);
    for (const [key, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key))
        fail("Unsafe mapping key.");
      validate(v, depth + 1, seen, budget);
    }
    seen.delete(value);
  } else if (
    value !== null &&
    !["string", "number", "boolean"].includes(typeof value)
  )
    fail("Only JSON-compatible testbed data is supported.");
  if (typeof value === "number" && !Number.isFinite(value))
    fail("Non-finite values are not supported.");
}
function parse(text, limit = LIMIT) {
  bounded(text, limit);
  let doc, data;
  try {
    doc = parseDocument(text, { merge: true, uniqueKeys: true, strict: true });
    if (doc.errors.length || doc.warnings.length)
      fail(
        "Invalid or unsupported YAML. Check duplicate keys, tags and indentation.",
      );
    data = doc.toJS({ maxAliasCount: 40 });
  } catch (e) {
    if (e.controlled) throw e;
    fail(
      "Invalid YAML or excessive aliases. No source text is included in this error.",
    );
  }
  if (data === null) data = { devices: {} };
  const deviceNode = doc.getIn(["devices"], true);
  if (
    isMap(deviceNode) &&
    deviceNode.items.some(
      (pair) => !isScalar(pair.key) || typeof pair.key.value !== "string",
    )
  )
    fail("Device IDs must be YAML string keys.");
  validate(data);
  if (!map(data) || !map(data.devices))
    fail("A testbed must contain a devices mapping.");
  for (const [id, device] of Object.entries(data.devices)) {
    if (!id.trim() || id.length > 200 || !map(device))
      fail("Each device must have a non-empty ID and mapping.");
    if (device.connections !== undefined && !map(device.connections))
      fail("Device connections must be a mapping.");
  }
  return { doc, data };
}
function safeString(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
function project(data) {
  return Object.entries(data.devices).map(([id, d]) => ({
    id,
    ...Object.fromEntries(metadata.map((k) => [k, safeString(d[k])])),
    connections: Object.entries(d.connections || {})
      .filter(([name, c]) => name !== "defaults" && map(c))
      .map(([name, c]) => ({
        name,
        protocol: safeString(c.protocol),
        host: /^[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/i.test(
          safeString(c.ip ?? c.host),
        )
          ? "[Credential-bearing address hidden]"
          : safeString(c.ip ?? c.host),
        port: typeof c.port === "number" ? c.port : null,
      })),
  }));
}
function secrets(value, revision) {
  const tokens = new Map(),
    paths = [];
  function walk(v, p = [], sensitive = false) {
    if (v && typeof v === "object")
      return Array.isArray(v)
        ? v.map((x, i) => walk(x, [...p, i], sensitive))
        : Object.fromEntries(
            Object.entries(v).map(([k, x]) => [
              k,
              walk(x, [...p, k], sensitive || secretKey(k)),
            ]),
          );
    if (
      (typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean") &&
      !ref(v) &&
      (sensitive || /^[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/i.test(v))
    ) {
      const key = JSON.stringify(p),
        token = "__NETCLAW_KEEP_" + hash(revision + "\0" + key).slice(0, 32);
      tokens.set(key, { token, value: v });
      paths.push(key);
      return token;
    }
    return v;
  }
  return { value: walk(value), tokens, paths };
}
function unmask(value, tokens) {
  function walk(v, p = []) {
    if (v && typeof v === "object")
      return Array.isArray(v)
        ? v.map((x, i) => walk(x, [...p, i]))
        : Object.fromEntries(
            Object.entries(v).map(([k, x]) => [k, walk(x, [...p, k])]),
          );
    if (typeof v === "string" && v.includes("__NETCLAW_KEEP_")) {
      const entry = tokens.get(JSON.stringify(p));
      if (!entry || v !== entry.token)
        fail(
          "Keep token is invalid, moved or stale. Reload the original draft.",
        );
      return entry.value;
    }
    return v;
  }
  return walk(value);
}
function patch(doc, before, after, p = []) {
  if (equal(before, after)) return;
  if (map(before) && map(after)) {
    for (const key of Object.keys(before))
      if (!Object.hasOwn(after, key)) doc.deleteIn([...p, key]);
    for (const [key, v] of Object.entries(after)) {
      if (Object.hasOwn(before, key)) patch(doc, before[key], v, [...p, key]);
      else doc.setIn([...p, key], v);
    }
    return;
  }
  doc.setIn(p, after);
}
function serializePatch(source, before, after) {
  const { doc } = parse(source);
  try {
    patch(doc, before, after);
    let next = doc.toString({ lineWidth: 0 });
    if (source.includes("\r\n")) next = next.replace(/\n/g, "\r\n");
    if (!equal(parse(next).data, after))
      fail(
        "Shared YAML references would change other data. Use an explicit document replacement.",
      );
    return next;
  } catch (e) {
    if (e.controlled) throw e;
    fail(
      "This aliased structure cannot be safely patched. Use an explicit document replacement.",
    );
  }
}
function readCsv(text) {
  bounded(text);
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) fail(`Malformed CSV at row ${rows.length + 1}.`);
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((x) => x !== "")) rows.push(row);
        row = [];
      }
    } else {
      if (closed)
        fail(`Unexpected text after a CSV quote at row ${rows.length + 1}.`);
      field += c;
    }
  }
  if (quoted) fail("Unclosed CSV quote.");
  if (field || row.length || closed) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift();
  if (
    !headers?.includes("id") ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !columns.includes(h))
  )
    fail("CSV requires id and unique documented column names.");
  const pairs = new Set();
  return rows.map((cells, i) => {
    if (cells.length !== headers.length)
      fail(`CSV row ${i + 2} has the wrong number of columns.`);
    const v = Object.fromEntries(headers.map((h, j) => [h, cells[j]]));
    if (!v.id.trim()) fail(`CSV row ${i + 2}: id is required.`);
    const key = JSON.stringify([v.id, v.connection || ""]);
    if (pairs.has(key))
      fail(`Duplicate device/connection in CSV row ${i + 2}.`);
    pairs.add(key);
    return { ...v, row: i + 2 };
  });
}
function guided(data, op) {
  const id = op.id;
  if (
    typeof id !== "string" ||
    !id.trim() ||
    id.length > 200 ||
    ["__proto__", "constructor", "prototype"].includes(id)
  )
    fail("Enter a valid device ID.");
  const exists = Object.hasOwn(data.devices, id);
  if (op.type === "create" && exists) fail("Device ID already exists.", 409);
  if (op.type !== "create" && !exists) fail("Device no longer exists.", 404);
  if (op.type === "remove") {
    delete data.devices[id];
    if (map(data.topology)) delete data.topology[id];
    return;
  }
  let device = exists ? structuredClone(data.devices[id]) : {};
  data.devices[id] = device;
  if (!map(op.fields || {})) fail("Device fields must be a mapping.");
  for (const [k, v] of Object.entries(op.fields || {})) {
    if (!metadata.includes(k) || typeof v !== "string" || v.length > 500)
      fail("Unsupported device field.");
    if (v === "") delete device[k];
    else device[k] = v;
  }
  if (op.endpoint !== undefined) {
    if (op.connection === "defaults")
      fail(
        "'defaults' contains shared pyATS settings, not an endpoint. Edit it through Advanced YAML.",
      );
    if (
      typeof op.connection !== "string" ||
      !op.connection.trim() ||
      op.connection.length > 100 ||
      ["__proto__", "constructor", "prototype"].includes(op.connection) ||
      !map(op.endpoint)
    )
      fail("Choose a named connection.");
    device.connections = structuredClone(device.connections || {});
    const prior = device.connections[op.connection] || {};
    if (!map(prior)) fail("Connection must be an explicit mapping.");
    const c = { ...prior };
    for (const [k, v] of Object.entries(op.endpoint)) {
      if (!["protocol", "host", "port"].includes(k))
        fail("Unsupported connection field.");
      if (k === "port") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 65535)
          fail("Port must be an integer from 1 to 65535.");
        c.port = n;
      } else {
        if (
          typeof v !== "string" ||
          !v.trim() ||
          v.length > 500 ||
          /[\r\n\0]/.test(v)
        )
          fail(
            "Connection host and protocol must be non-empty single-line values.",
          );
        if (k === "host") {
          const field =
            Object.hasOwn(c, "host") && !Object.hasOwn(c, "ip") ? "host" : "ip";
          c[field] = v;
          if (Object.hasOwn(c, "host") && Object.hasOwn(c, "ip")) c.host = v;
        } else c.protocol = v;
      }
    }
    if (!safeString(c.ip ?? c.host) || !safeString(c.protocol))
      fail("Connection host and protocol are required.");
    device.connections[op.connection] = c;
  }
  if (!exists && (!device.os || !Object.keys(device.connections || {}).length))
    fail("New devices require an operating system and connection.");
}
// Setup uses the same import rules before a HUD exists. This pure function
// performs no file writes, connections or device operations.
export function normalizeSetupTestbed(content,format) {
  bounded(content);
  if(format==='yaml'){parse(content);return content;}
  if(format==='json'){
    const data=parse(content).data;
    try { JSON.parse(content); } catch { fail('Invalid JSON testbed.'); }
    return stringify(data);
  }
  if(format!=='csv')fail('Choose YAML, JSON or CSV.');
  const data={devices:{}},shared=new Map();
  for(const row of readCsv(content)){
    const fields=Object.fromEntries(metadata.filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
    if(shared.has(row.id)&&!equal(shared.get(row.id),fields))fail('Conflicting CSV device metadata.');
    shared.set(row.id,fields);
    const endpoint=Object.fromEntries(['protocol','host','port'].filter(k=>Object.hasOwn(row,k)&&(k!=='port'||row[k]!=='')).map(k=>[k,row[k]]));
    guided(data,{type:Object.hasOwn(data.devices,row.id)?'update':'create',id:row.id,fields,
      ...(Object.keys(endpoint).length?{connection:row.connection,endpoint}:{})});
  }
  validate(data);return stringify(data);
}
export function createTestbedDocument({
  file,
  installationId,
  runtime,
  isActive = () => false,
  revoke = () => {},
  forget = () => {},
  write = writePrivateAtomic,
  onChanged = () => {},
}) {
  file = path.resolve(file);
  const targetId = hash(file),
    backupDir = file + ".backups";
  let committing = false;
  function read() {
    regularTarget(file);
    if (!fs.existsSync(file)) return "devices: {}\n";
    if (fs.statSync(file).size > LIMIT)
      fail("Testbed exceeds the 256 KiB editor limit.");
    return fs.readFileSync(file, "utf8");
  }
  function baseline(req) {
    const source = read(),
      revision = hash(source);
    if (req?.targetId !== targetId)
      fail("Testbed target changed. Reload this view.", 409);
    if (req?.revision !== revision)
      fail("Testbed changed. Reload and review again.", 409);
    return { source, revision, ...parse(source) };
  }
  function backups() {
    if (!fs.existsSync(backupDir)) return [];
    const stat = fs.lstatSync(backupDir);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      fail("Private backup directory is unavailable.");
    return fs
      .readdirSync(backupDir)
      .filter((id) => /^\d+-[a-f0-9-]+\.yaml$/.test(id))
      .sort()
      .reverse()
      .slice(0, 50)
      .map((id) => ({
        id,
        createdAt: new Date(Number(id.split("-")[0])).toISOString(),
      }));
  }
  function snapshot() {
    const source = read(),
      revision = hash(source),
      { data } = parse(source),
      masked = secrets(data, revision);
    let content;
    // Prefer the source CST so comments survive normal editor round trips. Shared
    // aliases can require a flattened masked projection; never send their literals.
    try {
      content = serializePatch(source, data, masked.value);
    } catch {
      content = stringify(masked.value);
    }
    bounded(content, MASK_LIMIT);
    return {
      schemaVersion: 1,
      installationId,
      runtime,
      targetId,
      source: file,
      revision,
      writable: true,
      devices: project(data),
      content,
      backups: backups(),
      limits: { sourceBytes: LIMIT, maskedBytes: MASK_LIMIT },
      note: "This is the HUD static testbed, separate from an in-memory dynamic pyATS MCP testbed. MCP activation does not change this file, collector grants or Terminal Intent access. A static MCP may use another PYATS_TESTBED_PATH; other installations may share this file. Validation here is structural; no device connection or pyATS loader runs.",
    };
  }
  function prepare(req) {
    const b = baseline(req),
      op = req.operation;
    if (
      !map(op) ||
      !["create", "update", "remove", "document", "import", "restore"].includes(
        op.type,
      )
    )
      fail("Unknown testbed operation.");
    const allowed = {
      create: ["type", "id", "fields", "connection", "endpoint"],
      update: ["type", "id", "fields", "connection", "endpoint"],
      remove: ["type", "id"],
      document: ["type", "content"],
      restore: ["type", "id"],
      import: ["type", "format", "content", "mode", "conflicts"],
    }[op.type];
    if (Object.keys(op).some((key) => !allowed.includes(key)))
      fail("Unknown testbed operation field.");
    const masked = secrets(b.data, b.revision);
    let after = structuredClone(b.data),
      next;
    if (["create", "update", "remove"].includes(op.type)) {
      guided(after, op);
      next = serializePatch(b.source, b.data, after);
    } else if (op.type === "restore") {
      if (typeof op.id !== "string" || !backups().some((x) => x.id === op.id))
        fail("Recovery copy is unavailable.", 404);
      const backup = path.join(backupDir, op.id);
      regularTarget(backup);
      if (fs.statSync(backup).size > LIMIT)
        fail("Recovery copy exceeds the size limit.");
      next = fs.readFileSync(backup, "utf8");
      after = parse(next).data;
    } else if (op.type === "import" && op.format === "csv") {
      const rows = readCsv(op.content),
        shared = new Map();
      for (const r of rows) {
        const fields = Object.fromEntries(
          metadata.filter((k) => Object.hasOwn(r, k)).map((k) => [k, r[k]]),
        );
        if (shared.has(r.id) && !equal(shared.get(r.id), fields))
          fail(`Conflicting device metadata in CSV row ${r.row}.`);
        shared.set(r.id, fields);
        const endpoint = Object.fromEntries(
          ["protocol", "host", "port"]
            .filter((k) => Object.hasOwn(r, k) && (k !== "port" || r[k] !== ""))
            .map((k) => [k, r[k]]),
        );
        guided(after, {
          type: Object.hasOwn(after.devices, r.id) ? "update" : "create",
          id: r.id,
          fields,
          ...(Object.keys(endpoint).length
            ? { connection: r.connection, endpoint }
            : {}),
        });
      }
      next = serializePatch(b.source, b.data, after);
    } else {
      let content = op.content;
      if (op.type === "import" && !["yaml", "json"].includes(op.format))
        fail("Choose YAML, JSON or CSV.");
      if (op.format === "json") {
        bounded(content);
        try {
          content = stringify(JSON.parse(content));
        } catch {
          fail("Invalid JSON testbed.");
        }
      }
      const parsed = parse(content, MASK_LIMIT),
        candidate = unmask(parsed.data, masked.tokens);
      validate(candidate);
      if (op.type === "import" && op.mode === "merge") {
        if (!["error", "skip", "replace"].includes(op.conflicts))
          fail("Choose a duplicate-device policy.");
        for (const [k, v] of Object.entries(candidate))
          if (k !== "devices" && !equal(b.data[k], v))
            fail(
              "Merge accepts devices only. Choose replacement to change testbed defaults or topology.",
            );
        for (const [id, d] of Object.entries(candidate.devices)) {
          if (Object.hasOwn(after.devices, id)) {
            if (op.conflicts === "error")
              fail(
                "Duplicate device IDs require an explicit skip or replace choice.",
                409,
              );
            if (op.conflicts === "skip") continue;
          }
          after.devices[id] = d;
        }
        next = serializePatch(b.source, b.data, after);
      } else {
        if (op.type === "import" && op.mode !== "replace")
          fail("Choose merge or replace.");
        after = candidate;
        patch(parsed.doc, parsed.data, after);
        next = parsed.doc.toString({ lineWidth: 0 });
        if (!equal(parse(next).data, after))
          fail(
            "YAML aliases would change unreviewed data. Expand the aliases before saving.",
          );
      }
    }
    bounded(next);
    parse(next);
    const beforeIds = Object.keys(b.data.devices),
      afterIds = Object.keys(after.devices),
      added = afterIds.filter((id) => !Object.hasOwn(b.data.devices, id)),
      removed = beforeIds.filter((id) => !Object.hasOwn(after.devices, id)),
      changed = beforeIds.filter(
        (id) =>
          Object.hasOwn(after.devices, id) &&
          !equal(b.data.devices[id], after.devices[id]),
      );
    const rest = (d) =>
        Object.fromEntries(
          Object.entries(d).filter(
            ([k]) => !["devices", "topology"].includes(k),
          ),
        ),
      sharedChanged = !equal(rest(b.data), rest(after)),
      topologyChanged = !equal(b.data.topology, after.topology),
      affected = [
        ...new Set(
          sharedChanged || topologyChanged
            ? [...beforeIds, ...afterIds]
            : [...added, ...removed, ...changed],
        ),
      ];
    const secretChanges = [];
    const beforeSecrets = secrets(b.data, b.revision),
      afterSecrets = secrets(after, b.revision);
    for (const p of new Set([...beforeSecrets.paths, ...afterSecrets.paths]))
      if (
        beforeSecrets.tokens.get(p)?.value !== afterSecrets.tokens.get(p)?.value
      )
        secretChanges.push({
          path: JSON.parse(p).join("."),
          intent: afterSecrets.tokens.has(p) ? "replace" : "remove",
        });
    const preview = {
      targetId,
      source: file,
      revision: b.revision,
      digest: hash(next),
      added,
      removed,
      changed,
      sharedChanged,
      topologyChanged,
      affected,
      secretChanges,
      notice:
        "Saving retains a private recovery copy and revokes affected collection consent. It does not connect to devices.",
    };
    return { ...b, next, preview };
  }
  function commit(req) {
    if (committing) fail("Another testbed save is in progress.", 409);
    if (req?.confirm !== true) fail("Explicit save confirmation is required.");
    committing = true;
    let revoked = false,
      backup;
    try {
      const p = prepare(req);
      if (req.digest !== p.preview.digest)
        fail("The reviewed candidate changed. Preview again.", 409);
      if (p.preview.affected.some(isActive))
        fail(
          "Disconnect affected devices in every terminal before saving.",
          409,
        );
      if (p.next === p.source)
        return { ok: true, revision: p.revision, unchanged: true };
      // Synchronous preparation/revocation/write forms one process-local critical section.
      for (const id of p.preview.affected) {
        revoke(id);
        revoked = true;
        forget(id);
      }
      if (read() !== p.source)
        fail("Testbed changed. Reload and review again.", 409);
      backups();
      fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
      fs.chmodSync(backupDir, 0o700);
      backup = `${Date.now()}-${randomUUID()}.yaml`;
      fs.writeFileSync(path.join(backupDir, backup), p.source, {
        flag: "wx",
        mode: 0o600,
      });
      write(file, p.next);
      if (read() !== p.next)
        fail("Save outcome is uncertain. Reload before another change.", 500);
      onChanged();
      return {
        ok: true,
        revision: hash(p.next),
        recoveryId: backup,
        revoked: p.preview.affected,
      };
    } catch (e) {
      if (e.controlled && !revoked) throw e;
      fail(
        `Unable to complete the testbed save.${revoked ? " Affected collection consent may have been revoked; reauthorize only after inspection." : ""}${backup ? " A private recovery copy is available." : ""} Reload to inspect the current file; do not repeat an uncertain save.`,
        e.status || 500,
      );
    } finally {
      committing = false;
    }
  }
  function exportFile(req) {
    const b = baseline(req);
    if (
      !["yaml", "json", "csv"].includes(req.format) ||
      !["include", "redacted"].includes(req.credentials)
    )
      fail("Choose an export format and credential policy.");
    let content,
      limitations = [];
    const masked = secrets(b.data, b.revision).value;
    function redacted(v) {
      if (v && typeof v === "object")
        return Array.isArray(v)
          ? v.map(redacted)
          : Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, redacted(x)]),
            );
      return typeof v === "string" && v.startsWith("__NETCLAW_KEEP_")
        ? "[REDACTED]"
        : v;
    }
    const data = req.credentials === "include" ? b.data : redacted(masked);
    if (req.format === "yaml")
      content = req.credentials === "include" ? b.source : stringify(data);
    if (req.format === "json") {
      content = JSON.stringify(data, null, 2) + "\n";
      limitations.push("JSON preserves data, not YAML comments or anchors.");
    }
    if (req.format === "csv") {
      const rows = [columns];
      for (const d of project(b.data)) {
        if (!d.connections.length) {
          limitations.push(
            `Device ${d.id} has no flattenable connection and was omitted.`,
          );
          continue;
        }
        for (const c of d.connections)
          rows.push([
            d.id,
            d.alias,
            d.type,
            d.os,
            d.platform,
            c.name,
            c.protocol,
            c.host,
            c.port ?? "",
          ]);
      }
      const quote = (v) => {
        let s = String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      };
      content = rows.map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";
      limitations.push(
        "CSV includes basic inventory only; credentials, interfaces, defaults and custom fields are omitted. Spreadsheet formula-leading values are prefixed with an apostrophe; use YAML/JSON for full fidelity.",
      );
    }
    if (req.credentials === "redacted" && req.format !== "csv")
      limitations.push(
        "Redacted copy: credential literals are replaced; this is not a complete recovery backup.",
      );
    return {
      content,
      extension: req.format === "yaml" ? "yaml" : req.format,
      limitations,
    };
  }
  return {
    snapshot,
    preview: (req) => prepare(req).preview,
    commit,
    export: exportFile,
  };
}
export function mountTestbedDocument(app, options) {
  const service = createTestbedDocument(options);
  const handler = (fn) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.headers["x-netclaw-installation"] !== options.installationId)
      return res
        .status(409)
        .json({ error: "Selected installation identity is required." });
    try {
      res.json(fn(req.body));
    } catch (e) {
      res.status(e.status || 500).json({
        error: e.controlled
          ? e.message
          : "Testbed document is unavailable. Check local file permissions and structure.",
      });
    }
  };
  app.get(
    "/api/testbed/document",
    handler(() => service.snapshot()),
  );
  app.post(
    "/api/testbed/preview",
    handler((r) => service.preview(r)),
  );
  app.put(
    "/api/testbed/document",
    handler((r) => service.commit(r)),
  );
  app.post(
    "/api/testbed/export",
    handler((r) => service.export(r)),
  );
  return service;
}
