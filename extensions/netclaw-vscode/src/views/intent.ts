import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Connection } from "../connection/connect";
import { LocalState } from "../state/local";
import { Json } from "../client/hud";
import { openDataView } from "../webview/bridge";
export async function openIntent(
  context: vscode.ExtensionContext,
  connection: Connection,
) {
  const b = connection.bound(),
    local = new LocalState(
      path.join(context.globalStorageUri.fsPath, "intent"),
    ),
    key = connection.profile!.id + "." + connection.identity!.installationId;
  const pending = local.get<{ id: string } | null>(key, null);
  if (pending) {
    const choice = await vscode.window.showQuickPick(
      ["Inspect previous request", "Start a separate request"],
      { title: "Terminal Intent" },
    );
    if (!choice) return;
    if (choice === "Inspect previous request") {
      openDataView(context, connection, {
        title: "Terminal Intent result",
        kind: "intent",
        load: () =>
          b.run(() =>
            b.client.request("GET", "/api/terminal/intent/runs/" + pending.id),
          ),
      });
      return;
    }
    const previous = await b.run(() =>
      b.client.request("GET", "/api/terminal/intent/runs/" + pending.id),
    );
    if (previous.status === "running" || previous.state === "running")
      throw Error(
        "The previous Intent request is still running. Inspect it before submitting more work.",
      );
  }
  const list = await b.run(() =>
    b.client.request("GET", "/api/terminal/devices"),
  );
  const choices = (list.devices || []).map((d: Json) => ({
    label: d.name || d.id,
    description: d.host || "",
    id: d.id,
  }));
  const selected = await vscode.window.showQuickPick<
    vscode.QuickPickItem & { id: string }
  >(choices, { title: "Explicit target endpoint", canPickMany: true });
  if (!selected?.length) return;
  const request = await vscode.window.showInputBox({
    title: "Terminal Intent request",
    prompt: "State the exact inspection or change you want NetClaw to perform.",
    validateInput: (v) =>
      v.trim() && v.length <= 4000 ? undefined : "Enter 1–4,000 characters",
  });
  if (!request) return;
  let mode = "production",
    policy: Json | undefined;
  if (connection.identity?.kind === "openclaw") {
    policy = await b.run(() =>
      b.client.request("GET", "/api/terminal/intent/change-policy"),
    );
    const allowed =
      policy!.enabled &&
      selected.every((s) =>
        policy!.devices?.some((d: Json) => d.id === s.id && d.valid),
      );
    const option = await vscode.window.showQuickPick(
      [
        "Production / existing approvals",
        ...(allowed
          ? ["Existing explicitly authorized Local/Lab endpoints"]
          : []),
      ],
      { title: "Change control" },
    );
    if (!option) return;
    if (option.startsWith("Existing")) mode = "local-lab";
  }
  if (mode === "production" && selected.length !== 1)
    throw Error(
      "Existing production Intent supports one endpoint per request. Select one endpoint; no request was submitted.",
    );
  if (
    (await vscode.window.showWarningMessage(
      "Submit this request to existing Terminal Intent?",
      {
        modal: true,
        detail: `Installation: ${connection.identity!.installationId}\nTargets: ${selected.map((s) => s.label).join(", ")}\nMode: ${mode}\nRequest: ${request}\nNetClaw owns baseline, approval, APPLY and verification. Questions authorize no writes. Hermes retains its read-only limits.`,
      },
      "Submit request",
    )) !== "Submit request"
  )
    return;
  b.current();
  await b.run(() => b.client.verifyIdentity());
  const id = randomUUID();
  await local.update(key, { id });
  await b.run(() =>
    b.client.request(
      "POST",
      "/api/terminal/intent/runs",
      {
        id,
        request,
        deviceId: selected[0]!.id,
        changeMode: mode,
        ...(mode === "local-lab"
          ? {
              targetDeviceIds: selected.map((s) => s.id),
              policyRevision: policy?.revision,
            }
          : {}),
      },
      45000,
    ),
  );
  openDataView(context, connection, {
    title: "Terminal Intent result",
    kind: "intent",
    load: () =>
      b.run(() => b.client.request("GET", "/api/terminal/intent/runs/" + id)),
  });
}
export async function peerChat(
  context: vscode.ExtensionContext,
  connection: Connection,
) {
  const b = connection.bound(),
    state = await b.run(() => b.client.request("GET", "/api/n2n"));
  const peers = Array.isArray(state.peers)
    ? state.peers
    : Object.entries(state.peers || {}).map(([id, p]) => ({
        id,
        ...(p as object),
      }));
  const peer = await vscode.window.showQuickPick<
    vscode.QuickPickItem & { id: string }
  >(
    peers.map((p: Json) => ({
      label: p.display_name || p.name || p.identity || p.id,
      id: p.identity || p.id,
    })),
    { title: "Existing NCFED peer" },
  );
  if (!peer) return;
  const text = await vscode.window.showInputBox({
    title: `Message to ${peer.label}`,
    validateInput: (v) =>
      v.trim() && v.length <= 8000 ? undefined : "Enter 1–8,000 characters",
  });
  if (!text) return;
  if (
    (await vscode.window.showWarningMessage(
      `Send to ${peer.label}?`,
      {
        modal: true,
        detail: `${connection.identity!.installationId}\n${text}\nThis communicates with the existing peer under its current NCFED permissions.`,
      },
      "Send",
    )) !== "Send"
  )
    return;
  b.current();
  await b.run(() => b.client.verifyIdentity());
  const response = await b.run(() =>
    b.client.request("POST", "/api/n2n/chat", { peer: peer.id, text }, 330000),
  );
  openDataView(context, connection, {
    title: `Peer reply · ${peer.label}`,
    kind: "peerChat",
    load: async () => response,
  });
}
