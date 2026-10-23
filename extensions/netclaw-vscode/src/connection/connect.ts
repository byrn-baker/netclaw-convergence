import * as vscode from "vscode";
import { createHash } from "node:crypto";
import { HudClient, Runtime, Json } from "../client/hud";
import { ConnectionProfile, hostContext } from "../state/profiles";
export type Identity = Runtime & { harness: { type: "openclaw" | "hermes" } };
export class Connection implements vscode.Disposable {
  client?: HudClient;
  profile?: ConnectionProfile;
  identity?: Identity;
  private serial = 0;
  readonly changed = new vscode.EventEmitter<void>();
  readonly contexts = new Map<
    string,
    { id: string; name: string; content: string; size: number }
  >();
  constructor(private readonly secrets: vscode.SecretStorage) {}
  get generation() {
    return this.serial;
  }
  get ready() {
    return Boolean(this.client && this.identity && vscode.workspace.isTrusted);
  }
  async connect(profile: ConnectionProfile): Promise<Identity> {
    if (!vscode.workspace.isTrusted)
      throw Error("Trust this workspace before connecting.");
    if (profile.context !== hostContext())
      throw Error("This profile belongs to another extension host.");
    if (process.platform === "win32")
      throw Error(
        "Open the intended WSL distribution or a Remote SSH workspace first.",
      );
    this.disconnect();
    const generation = this.serial;
    const key =
      "session." +
      createHash("sha256")
        .update(
          `${profile.context}|${profile.url}|${profile.installationId || ""}`,
        )
        .digest("hex");
    const client = new HudClient(
      profile.url,
      profile.installationId,
      async (cookie) => {
        if (cookie) await this.secrets.store(key, cookie);
        else await this.secrets.delete(key);
      },
    );
    const cookie = await this.secrets.get(key);
    if (cookie) client.restoreCookie(cookie);
    try {
      const runtime = await client.connect();
      if (profile.harness && runtime.kind !== profile.harness)
        throw Error(
          "The saved installation returned a different harness. Review a new connection.",
        );
      if (this.serial !== generation || !vscode.workspace.isTrusted)
        throw Error("Connection cancelled.");
      this.client = client;
      this.profile = profile;
      this.identity = { ...runtime, harness: { type: runtime.kind } };
      this.changed.fire();
      return this.identity;
    } catch (error) {
      client.close();
      throw error;
    }
  }
  bound() {
    const generation = this.serial,
      client = this.client;
    if (!client || !this.ready)
      throw Error("Connect to a trusted existing NetClaw first.");
    const current = () => {
      if (!this.ready || this.serial !== generation || this.client !== client)
        throw Error(
          "Connection changed. Review this action again for the selected installation.",
        );
    };
    return {
      client,
      current,
      run: async <T>(work: () => Promise<T>) => {
        current();
        const result = await work();
        current();
        return result;
      },
    };
  }
  async request<T = Json>(
    method: string,
    route: string,
    body?: unknown,
    timeout?: number,
  ): Promise<T> {
    const b = this.bound();
    return b.run(() => b.client.request<T>(method, route, body, timeout));
  }
  disconnect() {
    this.serial++;
    this.client?.close();
    this.client = undefined;
    this.profile = undefined;
    this.identity = undefined;
    this.contexts.clear();
    this.changed.fire();
  }
  dispose() {
    this.disconnect();
    this.changed.dispose();
  }
}
