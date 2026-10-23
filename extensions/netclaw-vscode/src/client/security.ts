import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { stringify as yamlStringify } from "yaml";
import { nativeToolRules, parseOpenShellPolicy } from "./security-formats";
export type SecurityTarget = {
  product: "defenseclaw" | "openshell";
  runtimeHome: string;
  installationId: string;
  kind: "openclaw" | "hermes";
  executable: string;
  securityHome: string;
  gateway?: string;
  workspace?: string;
  sandbox?: string;
};
type Data = Record<string, any>;
type Runner = (
  file: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => Promise<string>;
const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
const object = (v: any): v is Data =>
  !!v && typeof v === "object" && !Array.isArray(v);
function canonical(v: any): string {
  return JSON.stringify(v, (_, x) =>
    object(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
}
function regular(file: string, limit = 2 * 1024 * 1024) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit)
    throw Error("Security input is not a bounded regular file.");
  return fs.readFileSync(file);
}
const run: Runner = (file, args, env) =>
  new Promise((resolve, reject) =>
    execFile(
      file,
      args,
      {
        env,
        shell: false,
        timeout: args.includes("set") ? 75000 : 10000,
        maxBuffer: 1024 * 1024,
      },
      (e, stdout, stderr) =>
        e
          ? reject(
              Object.assign(
                Error(
                  "The native security command failed or timed out. Inspect the target with its native tools; private output is withheld.",
                ),
                {
                  missingGlobalPolicy:
                    /status: NotFound[\s\S]*no global policy revision found/.test(
                      stderr,
                    ),
                },
              ),
            )
          : resolve(stdout),
    ),
  );
export function redactSecurity(text: string) {
  return text
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,
      "[Private key redacted]",
    )
    .split("\n")
    .map((line) =>
      /(?:api[_-]?key|token|password|passwd|secret|authorization|cookie)\s*["']?\s*[:=]|\bBearer\s+\S+/i.test(
        line,
      )
        ? "[Sensitive line redacted]"
        : line.replace(/https?:\/\/[^\s]+/g, (url) =>
            url
              .replace(/\/\/[^/@\s]+:[^/@\s]+@/, "//[redacted]@")
              .replace(/\?[^\s]*/, "?[query redacted]"),
          ),
    )
    .join("\n")
    .slice(0, 64000);
}
function safe(value: any, key = "", depth = 0): any {
  if (depth > 12) return "[Depth limited]";
  if (
    /api[_-]?key|password|passwd|secret|token|credential|authorization|cookie|private.?key/i.test(
      key,
    )
  )
    return "[Configured value hidden]";
  if (Array.isArray(value))
    return value.slice(0, 200).map((v) => safe(v, "", depth + 1));
  if (object(value))
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 80)
        .map(([k, v]) => [k, safe(v, k, depth + 1)]),
    );
  return typeof value === "string"
    ? redactSecurity(value).slice(0, 2000)
    : value;
}
function boundedObject(value: any, depth = 0) {
  if (depth > 20) throw Error("Policy nesting exceeds the supported limit.");
  if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("Unsafe policy key.");
      boundedObject(v, depth + 1);
    }
}
function policyDifference(before: any, after: any) {
  const rows: string[] = [];
  let count = 0;
  const display = (value: any, key: string) =>
    value === undefined
      ? "Absent"
      : JSON.stringify(safe(value, key)).slice(0, 400);
  const visit = (a: any, b: any, keys: string[] = []) => {
    if (canonical(a) === canonical(b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++)
        visit(a[i], b[i], [...keys, String(i)]);
      return;
    }
    if (object(a) && object(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
        visit(a[key], b[key], [...keys, key]);
      return;
    }
    count++;
    if (rows.length < 100) {
      const key = keys.join(".") || "policy";
      rows.push(
        `${key}\n  Before: ${display(a, key)}\n  After:  ${display(b, key)}`,
      );
    }
  };
  visit(before, after);
  return `${count} changed field${count === 1 ? "" : "s"}${count > 100 ? " (first 100 shown)" : ""}\n\n${rows.join("\n\n")}`;
}
const simpleName = (v: unknown) =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(v);
export function securityEnvironment(t: SecurityTarget) {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (/^(DEFENSECLAW_|OPENSHELL_)/.test(key)) delete env[key];
  for (const key of [
    "PYTHONPATH",
    "PYTHONHOME",
    "VIRTUAL_ENV",
    "NODE_OPTIONS",
    "NODE_PATH",
  ])
    delete env[key];
  env.NO_COLOR = "1";
  if (t.product === "defenseclaw")
    Object.assign(env, {
      DEFENSECLAW_HOME: t.securityHome,
      DEFENSECLAW_CONFIG: path.join(t.securityHome, "config.yaml"),
      DEFENSECLAW_NO_UPDATE_CHECK: "1",
    });
  else env.XDG_CONFIG_HOME = t.securityHome;
  return env;
}
function targetFiles(t: SecurityTarget) {
  const files = [path.join(t.runtimeHome, "netclaw-hud/installation.json")];
  if (t.product === "defenseclaw")
    files.push(path.join(t.securityHome, "config.yaml"));
  else {
    const dir = path.join(t.securityHome, "openshell/gateways", t.gateway!);
    const walk = (folder: string, depth = 0) => {
      if (depth > 3) throw Error("Gateway metadata nesting is unsupported.");
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isSymbolicLink())
          throw Error("Gateway metadata symlinks require native review.");
        if (entry.isDirectory()) walk(file, depth + 1);
        else if (entry.isFile()) files.push(file);
        if (files.length > 100)
          throw Error("Gateway metadata exceeds the supported bound.");
      }
    };
    walk(dir);
  }
  return files;
}
export function validateSecurityTarget(input: SecurityTarget): SecurityTarget {
  if (process.platform === "win32")
    throw Error(
      "Use a Mac, WSL or Linux extension host for these native controls.",
    );
  if (
    !["defenseclaw", "openshell"].includes(input.product) ||
    !["openclaw", "hermes"].includes(input.kind)
  )
    throw Error("Unknown security target.");
  for (const field of [input.runtimeHome, input.executable, input.securityHome])
    if (
      typeof field !== "string" ||
      !path.isAbsolute(field) ||
      /[\r\n\0]/.test(field)
    )
      throw Error("Select absolute paths on this extension host.");
  const t = {
    ...input,
    runtimeHome: fs.realpathSync(input.runtimeHome),
    executable: fs.realpathSync(input.executable),
    securityHome: fs.realpathSync(input.securityHome),
  };
  fs.accessSync(t.executable, fs.constants.X_OK);
  regular(t.executable, 256 * 1024 * 1024);
  if (!fs.statSync(t.securityHome).isDirectory())
    throw Error("Select an existing security directory.");
  const id = JSON.parse(
    regular(
      path.join(t.runtimeHome, "netclaw-hud/installation.json"),
    ).toString(),
  );
  if (id.installationId !== t.installationId || (id.kind && id.kind !== t.kind))
    throw Error("Runtime home does not match the selected installation.");
  if (
    t.product === "openshell" &&
    ![t.gateway, t.workspace, t.sandbox].every(simpleName)
  )
    throw Error("Use explicit gateway, workspace and sandbox names.");
  targetFiles(t).forEach((f) => regular(f));
  return t;
}
function targetRevision(t: SecurityTarget, scopeOnly = false) {
  return hash(
    canonical({
      target: t,
      executable: hash(regular(t.executable, 256 * 1024 * 1024)),
      files: Object.fromEntries(
        targetFiles(t)
          .filter(
            (f) =>
              !scopeOnly ||
              t.product !== "defenseclaw" ||
              f !== path.join(t.securityHome, "config.yaml"),
          )
          .map((f) => [f, hash(regular(f))]),
      ),
    }),
  );
}
function privateDir(dir: string) {
  if (fs.existsSync(dir)) {
    const s = fs.lstatSync(dir);
    if (!s.isDirectory() || s.isSymbolicLink())
      throw Error("Private security evidence directory is unavailable.");
  } else fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
}
function write(file: string, value: any) {
  const tmp = file + "." + randomUUID() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(tmp, file);
}
function maskNetwork(network: Data, revision: string) {
  const tokens = new Map<string, { path: string; value: any }>();
  const visit = (v: any, keys: string[] = [], sensitive = false): any => {
    if (Array.isArray(v))
      return v.map((x, i) => visit(x, [...keys, String(i)], sensitive));
    if (object(v))
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [
          k,
          visit(
            x,
            [...keys, k],
            sensitive ||
              /api[_-]?key|password|passwd|secret|token|credential|authorization|cookie|private.?key/i.test(
                k,
              ),
          ),
        ]),
      );
    if (
      v !== null &&
      (sensitive ||
        (typeof v === "string" &&
          /https?:\/\/(?:[^/\s]+:[^/\s]+@|[^\s]*\?)/.test(v)))
    ) {
      const key = JSON.stringify(keys),
        token = "__NETCLAW_SECURITY_KEEP_" + hash(revision + key).slice(0, 28);
      tokens.set(token, { path: key, value: v });
      return token;
    }
    return v;
  };
  return { value: visit(network), tokens };
}
function unmaskNetwork(
  value: any,
  tokens: Map<string, { path: string; value: any }>,
  keys: string[] = [],
): any {
  if (Array.isArray(value))
    return value.map((x, i) => unmaskNetwork(x, tokens, [...keys, String(i)]));
  if (object(value))
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        unmaskNetwork(v, tokens, [...keys, k]),
      ]),
    );
  if (typeof value === "string" && value.includes("__NETCLAW_SECURITY_KEEP_")) {
    const keep = tokens.get(value);
    if (!keep || keep.path !== JSON.stringify(keys))
      throw Error(
        "A protected policy value moved or changed. Reload the policy.",
      );
    return keep.value;
  }
  return value;
}
export class SecurityClient {
  readonly target: SecurityTarget;
  private capture: Data | undefined;
  private workspaceSupported = true;
  private yamlPolicy = false;
  constructor(
    target: SecurityTarget,
    private evidenceRoot: string,
    private runner: Runner = run,
  ) {
    this.target = validateSecurityTarget(target);
  }
  private args(args: string[]) {
    const t = this.target;
    return t.product === "openshell"
      ? [
          "--gateway",
          t.gateway!,
          ...(this.workspaceSupported ? ["--workspace", t.workspace!] : []),
          ...args,
        ]
      : args;
  }
  private command(args: string[]) {
    return this.runner(
      this.target.executable,
      this.args(args),
      securityEnvironment(this.target),
    );
  }
  private async json(args: string[]) {
    const raw = await this.command(args);
    if (Buffer.byteLength(raw) > 512 * 1024)
      throw Error("Security response exceeds the supported size.");
    const value = JSON.parse(raw);
    boundedObject(value);
    return value;
  }
  private config(key: string) {
    return this.json(["config", "get", key, "--format", "json"]);
  }
  async sandboxes() {
    validateSecurityTarget(this.target);
    if (this.target.product !== "openshell") return [];
    const help = await this.runner(
      this.target.executable,
      ["--help"],
      securityEnvironment(this.target),
    );
    this.workspaceSupported = help.includes("--workspace");
    if (!this.workspaceSupported && this.target.workspace !== "default")
      return [];
    const raw = await this.command(["sandbox", "list", "--names"]);
    const names = raw.trim().split(/\r?\n/).filter(Boolean);
    if (names.length > 200 || !names.every(simpleName)) return [];
    return names;
  }
  private async legacyPolicy() {
    const result = parseOpenShellPolicy(
      await this.command(["policy", "get", this.target.sandbox!, "--full"]),
      this.target.sandbox!,
    );
    boundedObject(result.policy);
    let policy_source = "unknown";
    try {
      await this.command(["policy", "get", "--global", "--full"]);
      policy_source = "global";
    } catch (error) {
      if ((error as { missingGlobalPolicy?: boolean }).missingGlobalPolicy)
        policy_source = "sandbox";
    }
    return { ...result, policy_source };
  }
  private async basePolicy() {
    return this.yamlPolicy
      ? this.legacyPolicy()
      : this.json([
          "policy",
          "get",
          this.target.sandbox!,
          "--base",
          "--output",
          "json",
        ]);
  }
  private async effectivePolicy() {
    return this.yamlPolicy
      ? this.legacyPolicy()
      : this.json([
          "policy",
          "get",
          this.target.sandbox!,
          "--full",
          "--output",
          "json",
        ]);
  }
  async inspect(includeLogs = true) {
    this.capture = undefined;
    validateSecurityTarget(this.target);
    const stamp = targetRevision(this.target),
      t = this.target;
    if (t.product === "openshell") {
      const help = await this.runner(
        t.executable,
        ["--help"],
        securityEnvironment(t),
      );
      this.workspaceSupported = help.includes("--workspace");
      if (!this.workspaceSupported && t.workspace !== "default")
        throw Error(
          "This OpenShell version has no workspace selection. Choose its default workspace.",
        );
    }
    const version = redactSecurity(await this.command(["--version"]))
      .trim()
      .slice(0, 200);
    const attempt = async (fn: () => Promise<any>) => {
      try {
        return { available: true, data: await fn() };
      } catch {
        return {
          available: false,
          message:
            "Unavailable or unsupported by this target. No healthy state is implied.",
        };
      }
    };
    let rules: any,
      settings: any,
      base: any,
      effective: any,
      configuration: any,
      nativeTools = false,
      editable = false,
      reason = "";
    let status = await attempt(() =>
      this.json(
        t.product === "defenseclaw"
          ? ["status", "--json"]
          : ["gateway", "status", "--output", "json"],
      ),
    );
    if (!status.available && t.product === "openshell")
      status = await attempt(async () => ({
        summary: await this.command(["status"]),
      }));
    if (t.product === "defenseclaw") {
      const policy = await attempt(async () => {
        const rules = await this.config("asset_policy.tool");
        if (
          !object(rules) ||
          ![rules.allowed, rules.denied].every(
            (rows) =>
              Array.isArray(rows) &&
              rows.every(
                (r) =>
                  object(r) &&
                  typeof r.name === "string" &&
                  (r.connector === undefined ||
                    typeof r.connector === "string"),
              ),
          )
        )
          throw Error("Unsupported rules schema");
        const mode = await this.config("guardrail.mode");
        const threshold = await attempt(() =>
          this.config("guardrail.block_at"),
        );
        const help = await attempt(() =>
          this.command(["config", "set", "--help"]),
        );
        return {
          rules,
          writable: help.available && help.data.includes("--expect-sha256"),
          settings: {
            mode,
            block_at: threshold.available ? threshold.data : null,
          },
        };
      });
      if (policy.available) {
        rules = policy.data.rules;
        settings = policy.data.settings;
        editable = policy.data.writable;
      } else {
        const legacy = await attempt(() =>
          this.json(["tool", "list", "--json"]),
        );
        const config = await attempt(() =>
          this.json(["config", "show", "--format", "json"]),
        );
        if (config.available) {
          configuration = config.data;
          settings = {
            mode: configuration.guardrail?.mode,
            enabled: configuration.guardrail?.enabled,
            hook_fail_mode: configuration.guardrail?.hook_fail_mode,
          };
        }
        const normalized = await attempt(async () =>
          nativeToolRules(legacy.data),
        );
        if (legacy.available && normalized.available) {
          rules = normalized.data;
          const support = await attempt(async () => {
            for (const action of ["block", "allow", "unblock"])
              if (
                !(await this.command(["tool", action, "--help"])).includes(
                  "--connector",
                )
              )
                return false;
            return true;
          });
          // Legacy tool rules live in the audit database, not config.yaml.
          const database = configuration?.audit_db;
          nativeTools =
            support.data === true &&
            typeof database === "string" &&
            path.resolve(database) === path.join(t.securityHome, "audit.db") &&
            configuration?.data_dir === t.securityHome;
          if (nativeTools) {
            const databaseStat = fs.lstatSync(database);
            nativeTools =
              databaseStat.isFile() && !databaseStat.isSymbolicLink();
          }
          editable = nativeTools;
        }
      }
      if (!editable)
        reason =
          "The selected DefenseClaw did not provide a supported scoped writer and verified profile. Available configuration and rules remain view-only.";
      if (
        editable &&
        (!status.available ||
          typeof status.data?.data_dir !== "string" ||
          path.resolve(status.data.data_dir) !== t.securityHome)
      ) {
        editable = false;
        reason =
          "DefenseClaw did not report the bound data directory. Inspect the selected profile with its native tools before editing.";
      }
      if (!configuration) {
        const shown = await attempt(() =>
          this.json(["config", "show", "--format", "json"]),
        );
        if (shown.available) configuration = shown.data;
      }
    } else {
      const policy = await attempt(async () => {
        const help = await this.command(["policy", "get", "--help"]);
        this.yamlPolicy = !help.includes("--output") && help.includes("--full");
        if (this.yamlPolicy) {
          effective = await this.legacyPolicy();
          if (effective.policy_source !== "sandbox")
            throw Error("Global policy exists or could not be checked.");
          // OpenShell 0.0.32 records the initial revision as Loaded before it
          // records an active revision. The first explicit update must still
          // pass --wait and exact active-version readback below.
          const initial =
            effective.version === 1 && effective.active_version === 0;
          if (
            !effective.loaded ||
            (!initial && effective.active_version !== effective.version)
          )
            throw Error("Sandbox policy is not loaded.");
          return { effective, base: effective };
        }
        effective = await this.effectivePolicy();
        if (!help.includes("--base")) throw Error("Base policy unavailable");
        const base = await this.basePolicy();
        if (
          effective.sandbox !== t.sandbox ||
          base.sandbox !== t.sandbox ||
          !object(base.policy) ||
          !object(base.policy.network_policies)
        )
          throw Error("Unknown policy schema");
        if (effective.policy_source !== "sandbox")
          throw Error("Global or unknown effective source");
        return { effective, base };
      });
      if (policy.available) {
        base = policy.data.base;
        effective = policy.data.effective;
        editable = true;
      } else
        reason =
          "Editing requires a loaded sandbox policy and verified sandbox ownership. Global policy, unknown scope and unsupported formats remain read-only; available policy details are shown below.";
      configuration = base?.policy || effective?.policy;
    }
    const logs = includeLogs
      ? await attempt(async () =>
          t.product === "defenseclaw"
            ? await this.json(["alerts", "--limit", "100", "--json"])
            : await this.command(["logs", t.sandbox!, "-n", "200"]),
        )
      : { available: false, message: "Logs were not refreshed." };
    if (targetRevision(t) !== stamp)
      throw Error(
        "Security configuration changed while reading. Reload the view.",
      );
    const revision = hash(
      canonical({ stamp, rules, settings, base, effective }),
    );
    const displayedNetwork =
      base?.policy?.network_policies || effective?.policy?.network_policies;
    const masked = object(displayedNetwork)
      ? maskNetwork(displayedNetwork, revision)
      : undefined;
    const networkTooLarge =
      masked &&
      Buffer.byteLength(JSON.stringify(masked.value, null, 2)) > 128 * 1024;
    if (networkTooLarge) {
      editable = false;
      reason =
        "This network policy exceeds the 128 KiB editor limit. Use native OpenShell tools; status and logs remain available.";
    }
    const connectors = Array.isArray(status.data?.connectors)
      ? status.data.connectors.map((row: Data) => row.name).filter(simpleName)
      : [];
    this.capture = {
      stamp,
      scopeStamp: targetRevision(t, true),
      revision,
      editable,
      nativeTools,
      connectors,
      rules,
      settings,
      base,
      effective,
      masked,
    };
    return {
      product: t.product,
      target: t,
      version,
      revision,
      editable,
      nativeTools,
      editableSettings: editable && !nativeTools,
      policyFormat: this.yamlPolicy ? "native-yaml" : "json",
      reason,
      status: safe(status),
      rules: safe(rules),
      connectors,
      settings: safe(settings),
      network: networkTooLarge ? undefined : masked?.value,
      policySource: effective?.policy_source,
      policyVersion: effective?.version,
      activePolicyVersion: effective?.active_version,
      policyYaml: configuration
        ? yamlStringify(safe(configuration)).slice(0, 128 * 1024)
        : undefined,
      policyLocation:
        t.product === "defenseclaw"
          ? path.join(t.securityHome, "config.yaml")
          : `${t.gateway} / ${t.sandbox} · native policy revision ${effective?.version ?? "unknown"}`,
      permissions: safe(
        t.product === "defenseclaw"
          ? configuration?.asset_policy
          : configuration
            ? {
                filesystem: configuration.filesystem_policy,
                process: configuration.process,
                landlock: configuration.landlock,
              }
            : undefined,
      ),
      logs: {
        available: logs.available,
        message: logs.message,
        content: logs.available
          ? redactSecurity(
              typeof logs.data === "string"
                ? logs.data
                : JSON.stringify(safe(logs.data), null, 2),
            )
          : "",
      },
      note:
        "Shared host security scope. Saved configuration, loaded policy and actual enforcement are distinct. No live traffic test is performed." +
        (nativeTools
          ? " Tool changes use the installed native CLI for one selected connector. Global fallback and enforcement settings are view-only on this version; external writers can race the immediate revision check."
          : ""),
    };
  }
  prepare(operation: Data, revision: string, reason: string) {
    const before = this.capture;
    if (!before || !before.editable || before.revision !== revision)
      throw Error("Reload the security policy before reviewing a change.");
    if (
      typeof reason !== "string" ||
      reason.trim().length < 4 ||
      reason.length > 500 ||
      /[\r\n\0]/.test(reason)
    )
      throw Error("Give a short, single-line reason for this security change.");
    if (!object(operation)) throw Error("Invalid security change.");
    let key = "",
      value: any,
      summary = "",
      weakening = true;
    if (this.target.product === "defenseclaw" && before.rules) {
      if (operation.type === "rule") {
        if (
          Object.keys(operation).some(
            (k) => !["type", "action", "name", "connector"].includes(k),
          ) ||
          !["allow", "block", "remove"].includes(operation.action)
        )
          throw Error("Unsupported rule action.");
        const name = operation.name,
          connector = operation.connector || "";
        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.length > 200 ||
          /[\r\n\0]/.test(name) ||
          name.startsWith("-") ||
          typeof connector !== "string" ||
          connector.length > 100 ||
          /[\r\n\0]/.test(connector)
        )
          throw Error("Invalid tool or connector name.");
        if (connector && !before.connectors.includes(connector))
          throw Error(
            "Choose a configured connector from the observed roster.",
          );
        if (before.nativeTools && !connector)
          throw Error(
            "Choose a connector. This native CLI clears connector overrides on global changes, so global fallback rules are view-only here.",
          );
        value = structuredClone(before.rules);
        for (const list of ["allowed", "denied"])
          value[list] = value[list].filter(
            (r: Data) => r.name !== name || (r.connector || "") !== connector,
          );
        if (operation.action !== "remove")
          value[operation.action === "allow" ? "allowed" : "denied"].push({
            name,
            connector,
            reason: reason.trim(),
            ...(before.nativeTools
              ? { scope: "connector", status: operation.action }
              : {}),
          });
        key = "asset_policy.tool";
        weakening = operation.action !== "block";
        summary = `${operation.action} tool ${name} · ${connector ? "connector " + connector : "all connectors (global fallback)"}`;
      } else if (operation.type === "setting") {
        if (before.nativeTools)
          throw Error(
            "Enforcement settings are view-only on this native CLI version.",
          );
        if (
          Object.keys(operation).some(
            (k) => !["type", "key", "value"].includes(k),
          )
        )
          throw Error("Unknown security setting field.");
        const choices: Data = {
          mode: ["action", "observe"],
          block_at: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        };
        if (!choices[operation.key]?.includes(operation.value))
          throw Error("Unsupported enforcement setting.");
        key = "guardrail." + operation.key;
        value = operation.value;
        summary = `${key}: ${before.settings[operation.key] ?? "inherited"} → ${value} · global defaults; connector overrides can remain`;
        weakening = !(operation.key === "mode" && value === "action");
      } else throw Error("Unsupported DefenseClaw operation.");
    } else if (this.target.product === "openshell" && before.base) {
      if (
        operation.type !== "network" ||
        Object.keys(operation).some((k) => !["type", "content"].includes(k)) ||
        typeof operation.content !== "string" ||
        Buffer.byteLength(operation.content) > 128 * 1024
      )
        throw Error("Submit network-policy JSON within 128 KiB.");
      try {
        value = JSON.parse(operation.content);
      } catch {
        throw Error("Network policy must be valid JSON.");
      }
      if (!object(value))
        throw Error("Network policies must be a named rule object.");
      boundedObject(value);
      value = unmaskNetwork(value, before.masked.tokens);
      summary = `Replace the network rules for ${this.target.gateway}/${this.target.workspace}/${this.target.sandbox}; preserve all non-network policy fields. Rules can overlap; a removed allow does not prove a universal block.`;
    } else throw Error("This security target is read-only or unavailable.");
    return {
      id: randomUUID(),
      before,
      key,
      value,
      reason: reason.trim(),
      summary,
      difference: policyDifference(
        this.target.product === "openshell"
          ? before.base.policy.network_policies
          : key === "asset_policy.tool"
            ? before.rules
            : before.settings[operation.key],
        value,
      ),
      weakening,
      target: this.target,
      nativeOperation: before.nativeTools ? { ...operation } : undefined,
    };
  }
  async apply(review: Data, guard: () => Promise<void>) {
    await guard();
    if (canonical(review.target) !== canonical(this.target))
      throw Error("Security target changed.");
    const dir = path.join(
      this.evidenceRoot,
      hash(
        canonical({
          ...this.target,
          runtimeHome: undefined,
          installationId: undefined,
          kind: undefined,
          executable: undefined,
        }),
      ).slice(0, 24),
    );
    privateDir(this.evidenceRoot);
    privateDir(dir);
    for (const name of fs
      .readdirSync(dir)
      .filter((n) => /^[a-f0-9-]+\.json$/.test(n))) {
      let r;
      try {
        r = JSON.parse(regular(path.join(dir, name)).toString());
      } catch {
        throw Error(
          "Unreadable security evidence requires inspection before another change.",
        );
      }
      if (["running", "unknown"].includes(r.state))
        throw Error(
          "An earlier security change has an unknown outcome. Inspect its private evidence; it will not replay.",
        );
    }
    const lock = path.join(dir, "operation.lock");
    let fd: number;
    try {
      fd = fs.openSync(lock, "wx", 0o600);
    } catch {
      throw Error(
        "Another security change is active or interrupted for this shared target.",
      );
    }
    const record: Data = {
      id: review.id,
      product: this.target.product,
      state: "prepared",
      summary: review.summary,
      reason: redactSecurity(review.reason),
      createdAt: new Date().toISOString(),
      installationId: this.target.installationId,
    };
    const evidence = path.join(dir, review.id + ".json");
    let launched = false;
    try {
      await this.inspect(false);
      if (this.capture?.revision !== review.before.revision)
        throw Error(
          "The reviewed policy or target changed. Reload and review again.",
        );
      const original = path.join(dir, review.id + ".original");
      if (this.target.product === "defenseclaw" && review.before.nativeTools)
        fs.writeFileSync(
          original,
          JSON.stringify(
            {
              configuration: regular(
                path.join(this.target.securityHome, "config.yaml"),
              ).toString(),
              toolRules: review.before.rules,
              recovery:
                "Restore the selected connector rule using the native CLI after reviewing current policy. This is not a database restore.",
            },
            null,
            2,
          ),
          { flag: "wx", mode: 0o600 },
        );
      else if (this.target.product === "defenseclaw")
        fs.writeFileSync(
          original,
          regular(path.join(this.target.securityHome, "config.yaml")),
          { flag: "wx", mode: 0o600 },
        );
      else
        fs.writeFileSync(
          original,
          JSON.stringify(review.before.base.policy, null, 2) + "\n",
          { flag: "wx", mode: 0o600 },
        );
      record.original = original;
      record.state = "running";
      write(evidence, record);
      await guard();
      if (targetRevision(this.target) !== review.before.stamp)
        throw Error("Security target changed immediately before execution.");
      let candidate = "";
      if (this.target.product === "defenseclaw" && review.before.nativeTools) {
        const op = review.nativeOperation;
        const fresh = nativeToolRules(
          await this.json(["tool", "list", "--json"]),
        );
        if (canonical(fresh) !== canonical(review.before.rules))
          throw Error("Native tool rules changed during review.");
        const args = [
          "tool",
          op.action === "remove" ? "unblock" : op.action,
          op.name,
          "--connector",
          op.connector,
        ];
        if (op.action !== "remove") args.push("--reason", review.reason);
        launched = true;
        await this.command(args);
        const after = nativeToolRules(
          await this.json(["tool", "list", "--json"]),
        );
        const ordered = (v: Data) =>
          Object.fromEntries(
            ["allowed", "denied"].map((k) => [
              k,
              [...v[k]].sort((a, b) =>
                canonical(a).localeCompare(canonical(b)),
              ),
            ]),
          );
        if (canonical(ordered(after)) !== canonical(ordered(review.value)))
          throw Error(
            "Native tool-rule readback did not match the reviewed change.",
          );
      } else if (this.target.product === "defenseclaw") {
        const revision = hash(
          regular(path.join(this.target.securityHome, "config.yaml")),
        );
        launched = true;
        await this.command([
          "config",
          "set",
          review.key,
          JSON.stringify(review.value),
          "--json",
          "--expect-sha256",
          revision,
        ]);
        const after = await this.config(review.key);
        if (canonical(after) !== canonical(review.value))
          throw Error("Changed field was not verified.");
      } else {
        const fresh = await this.basePolicy();
        if (canonical(fresh) !== canonical(review.before.base))
          throw Error("Sandbox policy changed during review.");
        candidate = path.join(dir, review.id + ".candidate");
        const policy = {
          ...review.before.base.policy,
          network_policies: review.value,
        };
        fs.writeFileSync(candidate, JSON.stringify(policy, null, 2) + "\n", {
          flag: "wx",
          mode: 0o600,
        });
        launched = true;
        await this.command([
          "policy",
          "set",
          this.target.sandbox!,
          "--policy",
          candidate,
          "--wait",
        ]);
        const after = await this.basePolicy();
        if (canonical(after.policy) !== canonical(policy))
          throw Error("Applied policy was not verified.");
        const effective = await this.effectivePolicy();
        if (
          effective.policy_source !== "sandbox" ||
          effective.version !== after.version ||
          effective.active_version !== effective.version
        )
          throw Error(
            "The selected sandbox's effective policy could not be verified.",
          );
      }
      await guard();
      validateSecurityTarget(this.target);
      if (targetRevision(this.target, true) !== review.before.scopeStamp)
        throw Error("Security target changed after execution.");
      record.state = "verified";
      record.message =
        this.target.product === "defenseclaw"
          ? "Saved rules/settings verified. Loaded runtime policy and traffic enforcement remain unverified."
          : "Sandbox policy readback verified after waiting. Actual traffic enforcement has not been tested.";
      write(evidence, record);
      return {
        state: record.state as string,
        message: record.message as string,
        original: record.original as string,
        evidence,
      };
    } catch (error) {
      record.state = launched ? "unknown" : "failed";
      record.message = launched
        ? "The security change may have applied. Inspect the private original and native target before resolving this unknown outcome; no retry occurred."
        : error instanceof Error
          ? error.message
          : "Security change refused.";
      write(evidence, record);
      throw Error(record.message + " Evidence: " + evidence);
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
}
