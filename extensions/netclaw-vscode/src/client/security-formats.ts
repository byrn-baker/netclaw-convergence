import { parseDocument } from "yaml";
type Data = Record<string, any>;
export function parseOpenShellPolicy(raw: string, sandbox: string) {
  if (Buffer.byteLength(raw) > 512 * 1024)
    throw Error("Policy response exceeds the supported size.");
  const clean = raw
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replaceAll("\r\n", "\n");
  const split = clean.indexOf("\n---\n");
  if (split < 0)
    throw Error("The native command did not return a complete policy.");
  const head = clean.slice(0, split);
  const number = (name: string) => {
    const value = head.match(new RegExp("^" + name + ":\\s+(\\d+)\\s*$", "m"));
    if (!value || !Number.isSafeInteger(Number(value[1])))
      throw Error("Unknown native policy revision.");
    return Number(value[1]);
  };
  const doc = parseDocument(clean.slice(split + 5), { uniqueKeys: true });
  if (doc.errors.length) throw Error("Native policy YAML could not be parsed.");
  const policy = doc.toJS({ maxAliasCount: 0 });
  if (
    !policy ||
    Array.isArray(policy) ||
    typeof policy !== "object" ||
    (policy.network_policies !== undefined &&
      (!policy.network_policies ||
        Array.isArray(policy.network_policies) ||
        typeof policy.network_policies !== "object"))
  )
    throw Error("Unknown native policy schema.");
  // The native protobuf YAML serializer omits empty maps.
  policy.network_policies ??= {};
  return {
    sandbox,
    version: number("Version"),
    active_version: number("Active"),
    loaded: /^Status:\s+Loaded\s*$/m.test(head),
    policy,
  };
}

/** Legacy CLI groups effective rows by connector; global fallback rows repeat. */
export function nativeToolRules(groups: unknown) {
  if (!Array.isArray(groups)) throw Error("Unknown native tool-list schema.");
  const rows = new Map<string, Data>();
  for (const group of groups) {
    if (!group || !Array.isArray(group.tools))
      throw Error("Unknown native tool-list group.");
    for (const row of group.tools) {
      if (
        !row ||
        typeof row.name !== "string" ||
        !["allow", "block", "none"].includes(row.status) ||
        !["global", "connector", "source"].includes(row.scope)
      )
        throw Error("Unknown native tool rule.");
      if (row.status === "none") continue;
      const r = {
        name: row.name,
        connector: row.scope === "connector" ? row.connector : "",
        scope: row.scope,
        reason: typeof row.reason === "string" ? row.reason : "",
        status: row.status,
      };
      if (typeof r.connector !== "string")
        throw Error("Missing native connector scope.");
      rows.set(JSON.stringify([r.scope, r.connector, r.name]), r);
    }
  }
  const result = [...rows.values()].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );
  return {
    allowed: result.filter((r) => r.status === "allow"),
    denied: result.filter((r) => r.status === "block"),
  };
}
