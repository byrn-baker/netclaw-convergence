import * as vscode from "vscode";
import { randomUUID, randomBytes } from "node:crypto";
import { Connection } from "../connection/connect";
import { escape, pageHeader } from "./shell";
export { escape } from "./shell";
export function panel(
  context: vscode.ExtensionContext,
  connection: Connection,
  kind: string,
  title: string,
  body: string,
  scripts: string[],
) {
  const bound = connection.bound(),
    viewId = randomUUID();
  let disposed = false,
    sequence = 0;
  const view = vscode.window.createWebviewPanel(
    "netclaw." + kind,
    title,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: [
        "testbed",
        "mcp",
        "security",
        "openshell",
      ].includes(kind),
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "resources"),
        vscode.Uri.joinPath(context.extensionUri, "dist"),
      ],
    },
  );
  const uri = (p: string) =>
    view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, p));
  const nonce = randomBytes(24).toString("base64");
  view.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${view.webview.cspSource} blob:; connect-src ${view.webview.cspSource}; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${uri("resources/workbench.css")}"></head><body data-kind="${escape(kind)}" data-view-id="${viewId}">${pageHeader(kind, title, connection.profile?.label || "", connection.identity!.kind)}<main>${body.replaceAll("{{AVATAR_ASSETS}}", String(uri("resources/pal")))}</main>${["resources/messaging.js", ...scripts].map((s) => `<script nonce="${nonce}" src="${uri(s)}"></script>`).join("")}</body></html>`;
  const post = async (data: object) => {
    if (disposed) return;
    await view.webview.postMessage({ viewId, ...data });
  };
  const changed = connection.changed.event(() => {
    try {
      bound.current();
    } catch {
      void post({
        type: "error",
        message:
          "Connection changed. Reopen this view for the selected installation.",
        invalidated: true,
      });
    }
  });
  view.onDidDispose(() => {
    disposed = true;
    changed.dispose();
  });
  return {
    view,
    bound,
    post,
    onMessage: (
      types: string[],
      handler: (m: Record<string, any>) => Promise<void>,
    ) =>
      view.webview.onDidReceiveMessage(async (raw: unknown) => {
        if (!raw || typeof raw !== "object") return;
        const m = raw as Record<string, any>;
        if (
          JSON.stringify(m).length >
            (kind === "canvas"
              ? 5 * 1024 * 1024
              : kind === "testbed"
                ? 1024 * 1024
                : 300000) ||
          m.viewId !== viewId ||
          typeof m.requestId !== "string" ||
          !/^\d{1,12}$/.test(m.requestId) ||
          Number(m.requestId) <= sequence ||
          !types.includes(m.type)
        )
          return;
        sequence = Number(m.requestId);
        try {
          bound.current();
          await handler(m);
        } catch (error) {
          await post({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "NetClaw request failed.",
          });
        }
      }),
  };
}
