import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { HudClient, Conversation, scrub, Json } from "../client/hud";
import { inspect, Domain } from "../client/domains";
import { LocalState } from "../state/local";
export type Registration = {
  id: string;
  url: string;
  installationId: string;
  client: string;
  enabled: boolean;
  delegate: boolean;
};
export function readRegistration(file: string): Registration {
  const st = fs.lstatSync(file);
  if (
    !st.isFile() ||
    st.isSymbolicLink() ||
    st.size > 8192 ||
    (process.platform !== "win32" && st.mode & 0o077)
  )
    throw Error("Assistant registration must be a private local file.");
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  if (r.enabled !== true)
    throw Error(
      "Assistant registration is disabled. Enable it in the NetClaw extension.",
    );
  if (
    !/^[a-zA-Z0-9-]{1,120}$/.test(r.id) ||
    !/^[-a-fA-F0-9]{8,100}$/.test(r.installationId) ||
    !["copilot", "claude-code", "codex"].includes(r.client) ||
    typeof r.delegate !== "boolean"
  )
    throw Error("Assistant registration is invalid.");
  return r;
}
export const assistantDomains = [
  "overview",
  "integrations",
  "skills",
  "estate",
  "peers",
  "security",
  "tokenomics",
  "knowledge",
] as const;
function summarize(value: any): any {
  if (Array.isArray(value))
    return {
      count: value.length,
      items: value.slice(0, 100).map(summarize),
      truncated: value.length > 100,
    };
  if (!value || typeof value !== "object") return value;
  const allow = [
    "id",
    "name",
    "label",
    "kind",
    "type",
    "state",
    "status",
    "role",
    "available",
    "registered",
    "installed",
    "ready",
    "model",
    "provider",
    "count",
    "total",
    "costUsd",
    "input",
    "output",
    "calls",
    "generatedAt",
    "reason",
    "installationId",
    "readiness",
    "capabilities",
    "runtime",
    "harness",
    "identity",
    "members",
    "peers",
    "risk",
    "integrations",
    "skills",
    "groups",
    "document_count",
    "snapshot_count",
    "total_chunks",
    "defenseMode",
    "guardMode",
    "riskMode",
    "labMode",
    "mode",
    "writes",
  ];
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => allow.includes(k))
      .map(([k, v]) => [k, summarize(v)]),
  );
}
export class AssistantService {
  readonly client: HudClient;
  private store: LocalState;
  private registration: Registration;
  private directory: string;
  constructor(readonly file: string) {
    this.registration = readRegistration(file);
    const dir = path.join(path.dirname(file), this.registration.id);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.directory = dir;
    const directoryStat = fs.lstatSync(dir);
    if (
      !directoryStat.isDirectory() ||
      directoryStat.isSymbolicLink() ||
      directoryStat.mode & 0o077
    )
      throw Error("Private assistant storage unavailable.");
    const cookieFile = path.join(dir, "session.env");
    this.client = new HudClient(
      this.registration.url,
      this.registration.installationId,
      async (cookie) => {
        const temp = path.join(dir, randomUUID() + ".env");
        fs.writeFileSync(temp, `NETCLAW_HUD_COOKIE=${cookie}\n`, {
          flag: "wx",
          mode: 0o600,
        });
        fs.renameSync(temp, cookieFile);
      },
    );
    if (fs.existsSync(cookieFile)) {
      const st = fs.lstatSync(cookieFile);
      if (
        st.isSymbolicLink() ||
        !st.isFile() ||
        st.size > 1024 ||
        st.mode & 0o077
      )
        throw Error("Private assistant session unavailable.");
      const raw = fs.readFileSync(cookieFile, "utf8");
      this.client.restoreCookie(raw.replace(/^NETCLAW_HUD_COOKIE=/, "").trim());
    }
    this.store = new LocalState(dir);
  }
  private authorized() {
    const r = readRegistration(this.file);
    if (
      r.id !== this.registration.id ||
      r.url !== this.registration.url ||
      r.installationId !== this.registration.installationId
    )
      throw Error(
        "Assistant registration changed; restart it after human review.",
      );
    return r;
  }
  async call(name: string, args: Json): Promise<Json> {
    const r = this.authorized();
    if (!this.client.runtime) await this.client.connect();
    else await this.client.verifyIdentity();
    let result: Json;
    if (name === "netclaw_status")
      result = {
        installationId: r.installationId,
        runtime: this.client.runtime?.kind,
        readiness: this.client.runtime?.readiness,
        delegationEnabled: r.delegate,
        authority:
          "Requests use existing NetClaw tools and approval rules. This adapter is not a sandbox or a separate backend permission grant.",
        billing: "NetClaw usage excludes this assistant’s own model costs.",
      };
    else if (name === "netclaw_inspect") {
      if (!assistantDomains.includes(args.kind))
        throw Error("Inspection domain unavailable.");
      const observation = await inspect(this.client, args.kind as Domain);
      result = { ...observation, data: summarize(observation.data) };
    } else if (name === "netclaw_propose_change") {
      if (
        typeof args.summary !== "string" ||
        args.summary.length > 4000 ||
        typeof args.domain !== "string"
      )
        throw Error("Invalid proposal.");
      const proposalId = randomUUID();
      result = {
        proposalId,
        installationId: r.installationId,
        domain: args.domain,
        summary: args.summary,
        state: "draft",
        createdAt: new Date().toISOString(),
        review:
          "A human must review this inert draft in the extension. It grants no approval and applies nothing.",
      };
      const drafts = this.store.get<Json[]>("proposals", []);
      await this.store.update("proposals", [...drafts.slice(-99), result]);
    } else if (name === "netclaw_request") {
      if (!r.delegate)
        throw Error(
          "Delegation is disabled for this registration. Enable it explicitly in the extension.",
        );
      if (
        typeof args.prompt !== "string" ||
        !args.prompt.trim() ||
        args.prompt.length > 16384 ||
        typeof args.requestId !== "string" ||
        !/^[-a-zA-Z0-9_]{8,100}$/.test(args.requestId)
      )
        throw Error("Provide a bounded prompt and a stable requestId.");
      const key = "request." + args.requestId,
        existing = this.store.get<Json | null>(key, null),
        digest = createHash("sha256").update(args.prompt).digest("hex");
      if (existing) {
        if (existing.digest !== digest)
          throw Error("Request ID already belongs to different content.");
        result = await this.requestStatus(existing, key);
      } else {
        // Reserve before any async preparation. A second client process using
        // the same registration/ID must not submit the work a second time.
        const reservation = path.join(
          this.directory,
          createHash("sha256").update(key).digest("hex") + ".reserved",
        );
        try {
          fs.closeSync(fs.openSync(reservation, "wx", 0o600));
        } catch {
          throw Error(
            "This request ID is already reserved. Check its status; do not replay it.",
          );
        }
        const c = await this.client.newConversation();
        const record: Json = {
          requestId: args.requestId,
          digest,
          conversation: c,
          state: "prepared",
          createdAt: new Date().toISOString(),
        };
        await this.store.update(key, record);
        try {
          await this.client.send(c, args.prompt, "", async () => {
            record.state = "submitting";
            await this.store.update(key, record);
          });
        } catch {
          record.state = c.state;
          await this.store.update(key, record);
          throw Error(
            "NetClaw request outcome is unresolved or refused. Use netclaw_request_status with the same ID; do not submit a replacement request.",
          );
        }
        record.state = c.state;
        await this.store.update(key, record);
        result = this.project(record);
      }
    } else if (name === "netclaw_request_status") {
      if (
        typeof args.requestId !== "string" ||
        !/^[-a-zA-Z0-9_]{8,100}$/.test(args.requestId)
      )
        throw Error("Invalid request ID.");
      const key = "request." + args.requestId,
        record = this.store.get<Json | null>(key, null);
      if (!record) throw Error("Request is not owned by this registration.");
      result = await this.requestStatus(record, key);
    } else
      throw Error(
        "This adapter exposes no approval, apply, shell or arbitrary backend tool.",
      );
    this.authorized();
    return scrub(result);
  }
  private project(record: Json): Json {
    const c = record.conversation as Conversation;
    return {
      requestId: record.requestId,
      installationId: this.registration.installationId,
      state: c.state || record.state,
      backendRequestId: c.requestId,
      output:
        c.messages.at(-1)?.role === "assistant"
          ? c.messages.at(-1)?.content
          : undefined,
      notice:
        "Status is existing backend evidence where available. Uncertain work is never automatically replayed.",
    };
  }
  private async requestStatus(record: Json, key: string): Promise<Json> {
    const c = record.conversation as Conversation;
    if (this.client.runtime?.kind === "hermes") await this.client.status(c);
    else if (c.state === "submitting") c.state = "unknown";
    await this.store.update(key, record);
    return this.project(record);
  }
  close() {
    this.client.close();
  }
}
