import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { LocalState } from "./local";
import { endpoint } from "../client/hud";
export type ConnectionProfile = {
  id: string;
  label: string;
  url: string;
  context: string;
  installationId?: string;
  harness?: "openclaw" | "hermes";
  assistantEnabled?: boolean;
  delegationEnabled?: boolean;
};
export function hostContext() {
  return `${vscode.env.remoteName || "local"}:${process.platform}:${process.env.WSL_DISTRO_NAME || ""}`;
}
export class Profiles {
  constructor(private local: LocalState) {}
  list(): ConnectionProfile[] {
    return this.local
      .get<ConnectionProfile[]>("profiles", [])
      .filter((p) => p.context === hostContext());
  }
  async save(
    p: Omit<ConnectionProfile, "id" | "context"> &
      Partial<Pick<ConnectionProfile, "id" | "context">>,
  ): Promise<ConnectionProfile> {
    if (!p.label.trim() || p.label.length > 100)
      throw Error("Use a connection label of 1–100 characters.");
    const result = {
      ...p,
      id: p.id || randomUUID(),
      context: p.context || hostContext(),
      url: endpoint(p.url),
    };
    const all = this.local.get<ConnectionProfile[]>("profiles", []);
    await this.local.update("profiles", [
      ...all.filter((x) => x.id !== result.id),
      result,
    ]);
    return result;
  }
  async remove(id: string) {
    await this.local.update(
      "profiles",
      this.local
        .get<ConnectionProfile[]>("profiles", [])
        .filter((p) => p.id !== id),
    );
  }
}
