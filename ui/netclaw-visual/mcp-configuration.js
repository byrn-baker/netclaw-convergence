import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { COMPONENT_ALIASES, COMPONENT_SETTINGS } from "./env-map.js";
import {
  regularTarget,
  updateEnvironment,
  writePrivateAtomic,
} from "./src/security/private-files.js";
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status, controlled: true });
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
export const componentAliases = COMPONENT_ALIASES;
const required = {
  pyats: ["PYATS_TESTBED_PATH"],
  netbox: ["NETBOX_URL", "NETBOX_TOKEN"],
  servicenow: ["SERVICENOW_INSTANCE_URL"],
  catc: [
    "CATALYST_CENTER_HOST",
    "CATALYST_CENTER_USERNAME",
    "CATALYST_CENTER_PASSWORD",
  ],
};
const optional = new Set([
  "RAG_DATA_DIR",
  "RAG_EMBEDDING_MODEL",
  "RAG_RERANKER_MODEL",
  "RAG_RERANK_ENABLED",
  "RAG_RELEVANCE_FLOOR",
  "RAG_MAX_DOC_MB",
  "RAG_MAX_DOC_PAGES",
  "RAG_CRAWL_MAX_PAGES",
  "RAG_SNAPSHOT_WARN_DAYS",
  "RAG_MAX_ROUNDS",
]);
const publicText = new Set([
  "NETCLAW_USERNAME",
  "ISE_USERNAME",
  "USERNAME",
  "NETCLAW_ROUTER_ID",
  "NETCLAW_LOCAL_IPV6",
  "NETCLAW_BGP_PEERS",
  "CVP",
  "NSO_ADDRESS",
  "NSO_SCHEME",
  "VMANAGE_IP",
  "F5_IP_ADDRESS",
  "CATALYST_CENTER_HOST",
  "CATALYST_CENTER_USERNAME",
  "GNS3_HOST",
  "GNS3_USERNAME",
  "ITENTIAL_MCP_PLATFORM_HOST",
]);
const bools = new Set([
  "NETCLAW_LAB_MODE",
  "N2N_STRICT_ALL",
  "RAG_RERANK_ENABLED",
  "JEV_ENABLED",
  "GITLAB_READ_ONLY_MODE",
  "ENABLE_CACHING",
  "READ_ONLY_MODE",
  "READ_ONLY",
  "VERIFY_SSL",
  "ANTA_VERIFY_TLS",
  "ES_SSL_SKIP_VERIFY",
  "CATALYST_CENTER_VERIFY_SSL",
  "FORTINET_VERIFY_SSL",
  "FORTINET_ALLOW_WRITES",
  "NETCLAW_MESH_OPEN",
]);
const enums = { N2N_RISK_MODE: ["testing", "production"] };
function field(key, id, mapping, values) {
  let kind = "secret";
  if (
    publicText.has(key) ||
    key.endsWith("_USERNAME") ||
    key.endsWith("_MODEL")
  )
    kind = "text";
  if (
    /(?:_URL|_BASE_URL|_INSTANCE_URL)$/.test(key) ||
    ["ISE_BASE"].includes(key)
  )
    kind = "url";
  if (
    /(?:_PATH|_FILE|_DIR|_SCRIPT|_VENV)$/.test(key) ||
    key === "K8S_KUBECONFIG"
  )
    kind = "path";
  if (
    /(?:_PORT|_TIMEOUT|_TIMEOUT_SECONDS|_TTL_SECONDS|_MAX_ROUNDS|_MAX_ROWS|_MAX_BLOCKS|_MAX_SLIDES|_MAX_DOC_MB|_MAX_DOC_PAGES|_CRAWL_MAX_PAGES|_SNAPSHOT_WARN_DAYS|_LOCAL_AS|_TOKEN_TTL)$/.test(
      key,
    )
  )
    kind = "number";
  if (bools.has(key)) kind = "boolean";
  if (Object.hasOwn(enums, key)) kind = "enum";
  let requirement = (required[id] || []).includes(key)
    ? "required"
    : optional.has(key)
      ? "optional"
      : id === "servicenow" && /USERNAME|PASSWORD/.test(key)
        ? "conditional"
        : "unknown";
  const canonical = (componentAliases[id] || [id])
    .flatMap(component => COMPONENT_SETTINGS[component] || [])
    .find(setting => setting.key === key);
  if (canonical) {
    kind = canonical.classification === "secret" ? "secret" : ({integer: "number", boolean: "boolean", url: "url", path: "path"}[canonical.valueType] || "text");
    requirement = canonical.required === "always" ? "required" : canonical.required;
  }
  if(id==='pyats'&&key==='PYATS_TESTBED_PATH')requirement=values.NETCLAW_TESTBED_MODE==='dynamic'?'optional':'required';
  return {
    key,
    label: key
      .toLowerCase()
      .split("_")
      .map((s) => s[0]?.toUpperCase() + s.slice(1))
      .join(" "),
    kind,
    requirement,
    isSet: Boolean(values[key]),
    choices: enums[key] || undefined,
    sharedWith: Object.entries(mapping)
      .filter(([other, m]) => other !== id && m.env.includes(key))
      .map(([other]) => other),
    help: canonical?.help || (
      kind === "secret"
        ? "Confidential value. Existing contents are never sent to this view."
        : kind === "path"
          ? "Path on the selected NetClaw host. Saving does not create or load this file."
          : kind === "url"
            ? "HTTP or HTTPS endpoint for this integration. Saving does not test connectivity."
            : requirement === "unknown"
              ? "Requirement depends on the integration’s selected mode. Review its setup guidance."
              : "Review this value for the selected integration."),
    example:
      kind === "url"
        ? "https://controller.example"
        : kind === "path"
          ? "/path/on/netclaw/host"
          : undefined,
  };
}
export function createMcpConfiguration({
  getFile,
  getValues,
  mapping,
  installationId,
  runtime,
  onChanged = () => {},
}) {
  function baseline() {
    const file = getFile();
    regularTarget(file);
    if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024)
      fail("Environment file exceeds the configuration editor limit.");
    const original = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const values = getValues();
    return {
      file,
      original,
      values,
      revision: hash(file + "\0" + original + "\0" + JSON.stringify(values)),
    };
  }
  function descriptor(id, item, values) {
    return {
      id,
      name: id.replaceAll("-", " "),
      notes: item.notes,
      files: item.files,
      components: Object.hasOwn(componentAliases, id)
        ? componentAliases[id]
        : [id],
      fields: item.env.map((k) => field(k, id, mapping, values)),
      runtimeLoaded: "unverified",
      endpointVerified: "unverified",
      setupNote:
        "Save updates configuration only. Installation, registration and service actions require a separate review. Unsupported lifecycle actions show guidance.",
    };
  }
  function snapshot() {
    const b = baseline();
    return {
      schemaVersion: 1,
      installationId,
      runtime,
      source: b.file,
      revision: b.revision,
      integrations: Object.entries(mapping).map(([id, item]) =>
        descriptor(id, item, b.values),
      ),
    };
  }
  function save(req) {
    const b = baseline();
    if (req?.revision !== b.revision)
      fail("Configuration changed. Reload and review again.", 409);
    if (req.confirm !== true)
      fail("Explicit configuration review is required.");
    const item = mapping[req.integrationId];
    if (!item || !Object.hasOwn(mapping, req.integrationId))
      fail("Unknown integration.", 404);
    if (
      !req.changes ||
      typeof req.changes !== "object" ||
      Array.isArray(req.changes)
    )
      fail("Expected scoped field changes.");
    const updates = {};
    for (const [key, change] of Object.entries(req.changes)) {
      if (!item.env.includes(key))
        fail("Field does not belong to this integration.");
      if (!change || !["keep", "replace", "clear"].includes(change.intent))
        fail("Choose keep, replace or clear.");
      if (change.intent === "keep") continue;
      const value = change.intent === "clear" ? "" : change.value;
      if (
        typeof value !== "string" ||
        value.length > 8192 ||
        /[\r\n\0]/.test(value)
      )
        fail("Use a single-line field value within 8192 characters.");
      if (change.intent === "replace" && !value)
        fail("Use Clear explicitly to remove a value.");
      const f = field(key, req.integrationId, mapping, b.values);
      if (value) {
        if (f.kind === "boolean" && !["true", "false"].includes(value))
          fail("Boolean fields accept true or false.");
        if (
          f.kind === "number" &&
          (!Number.isFinite(Number(value)) || Number(value) < 0)
        )
          fail("Numeric fields require a non-negative number.");
        if (f.kind === "enum" && !f.choices.includes(value))
          fail("Choose a documented field value.");
        if (f.kind === "url") {
          let url;
          try {
            url = new URL(value);
          } catch {
            fail("Enter a complete HTTP or HTTPS URL.");
          }
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password
          )
            fail("Use an HTTP or HTTPS endpoint without embedded credentials.");
        }
      }
      updates[key] = value;
    }
    if (!Object.keys(updates).length)
      return {
        ...snapshot(),
        saved: false,
        fields: descriptor(req.integrationId, item, b.values).fields,
        runtimeLoaded: "unverified",
        endpointVerified: "unverified",
      };
    const dir = b.file + ".backups";
    try {
      if (fs.existsSync(dir)) {
        const s = fs.lstatSync(dir);
        if (!s.isDirectory() || s.isSymbolicLink())
          fail("Private configuration backup directory is unavailable.");
      }
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.chmodSync(dir, 0o700);
      const backup = path.join(dir, Date.now() + "-" + randomUUID() + ".env");
      writePrivateAtomic(backup, b.original);
      if (baseline().revision !== b.revision)
        fail("Configuration changed. Reload and review again.", 409);
      updateEnvironment(b.file, updates);
      const after = baseline();
      if (
        Object.entries(updates).some(
          ([key, value]) => (after.values[key] || "") !== value,
        )
      )
        fail(
          "Saved values could not be verified. A private recovery copy is available; inspect before repeating.",
          500,
        );
      onChanged(Object.keys(updates));
      return {
        saved: true,
        revision: after.revision,
        source: b.file,
        changedKeys: Object.keys(updates),
        fields: descriptor(req.integrationId, item, after.values).fields,
        runtimeLoaded: "unverified",
        endpointVerified: "unverified",
      };
    } catch (e) {
      if (e.controlled) throw e;
      fail(
        "Configuration save failed. Inspect the selected file and private recovery copies before repeating.",
        500,
      );
    }
  }
  return { snapshot, save };
}
export function mountMcpConfiguration(app, options) {
  const service = createMcpConfiguration(options);
  const handler = (fn) => (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.headers["x-netclaw-installation"] !== options.installationId)
      return res
        .status(409)
        .json({ error: "Selected installation identity is required." });
    try {
      res.json(fn(req.body));
    } catch (e) {
      res
        .status(e.status || 500)
        .json({
          error: e.controlled
            ? e.message
            : "Configuration metadata is unavailable. Check local file permissions.",
        });
    }
  };
  app.get(
    "/api/mcp/configuration",
    handler(() => service.snapshot()),
  );
  app.put(
    "/api/mcp/configuration",
    handler((r) => service.save(r)),
  );
  return service;
}
