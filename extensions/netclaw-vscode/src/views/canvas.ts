import * as vscode from "vscode";
import path from "node:path";
import { Connection } from "../connection/connect";
import { Conversation, terminalStates, Json } from "../client/hud";
import { LocalState } from "../state/local";
import { panel } from "../webview/panel";
import { selectedContext } from "./chat";
export function validateCanvas(value: Json) {
  if (
    value?.v !== 1 ||
    !Array.isArray(value.nodes) ||
    value.nodes.length > 500 ||
    JSON.stringify(value).length > 4 * 1024 * 1024
  )
    throw Error("Use a Canvas v1 document with at most 500 lanes and 4 MiB.");
  const ids = new Set();
  for (const n of value.nodes) {
    if (
      typeof n.id !== "string" ||
      !/^[\w-]{1,100}$/.test(n.id) ||
      ["__proto__", "constructor", "prototype"].includes(n.id) ||
      ids.has(n.id)
    )
      throw Error("Invalid or duplicate Canvas lane.");
    ids.add(n.id);
  }
  return value;
}
export function openCanvas(
  context: vscode.ExtensionContext,
  connection: Connection,
) {
  const key = `canvas.${connection.profile?.id}.${connection.identity?.installationId}`,
    local = new LocalState(
      path.join(context.globalStorageUri.fsPath, "canvases"),
    );
  let saved = local.get<{
      document: Json;
      bindings: Record<string, Conversation>;
    }>(key, {
      document: {
        v: 1,
        nodes: [
          { id: "root", kind: "chat", title: "Investigation", messages: [] },
        ],
      },
      bindings: {},
    }),
    busy = false;
  const p = panel(
    context,
    connection,
    "canvas",
    "Canvas investigations",
    `<p>Branch a conversation using its selected ancestor context.</p><div class="toolbar"><button id="save">Save investigation</button><button id="open">Open saved</button><button id="import">Import HUD Canvas v1</button><button id="export">Export reviewed copy</button><button id="refresh">Check requests</button></div><p id="status" role="status" aria-live="polite">Loading…</p><div id="lanes" class="canvas-lanes"></div>`,
    ["dist/canvas.js"],
  );
  const persist = async () => {
    p.bound.current();
    await local.update(key, saved);
  };
  const load = async () => {
    const requests: Record<string, Json> = {};
    for (const [id, c] of Object.entries(saved.bindings)) {
      if (c.nonce && p.bound.client.runtime?.kind === "hermes" && !busy)
        await p.bound.run(() => p.bound.client.status(c));
      requests[id] = {
        state: c.state === "completed" ? "succeeded" : c.state,
        operationId: c.nonce || c.thread,
        prompt: [...c.messages].reverse().find((m) => m.role === "user")
          ?.content,
        result: {
          output:
            c.messages.at(-1)?.role === "assistant"
              ? c.messages.at(-1)?.content
              : undefined,
        },
      };
    }
    await p.post({
      type: "contexts",
      contexts: [...connection.contexts.values()].map(
        ({ content, ...rest }) => rest,
      ),
    });
    await p.post({ type: "requests", requests });
  };
  p.onMessage(
    ["ready", "state", "save", "open", "import", "export", "refresh", "send"],
    async (m) => {
      if (m.document) saved.document = validateCanvas(m.document);
      if (m.type === "state") return;
      if (busy) return;
      busy = true;
      await p.post({ type: "busy", busy: true });
      try {
        if (m.type === "open") saved = local.get(key, saved);
        if (m.type === "save") await persist();
        if (m.type === "import") {
          const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { "HUD Canvas": ["json"] },
          });
          if (!files?.[0]) return;
          if ((await vscode.workspace.fs.stat(files[0])).size > 4 * 1024 * 1024)
            throw Error("Canvas file exceeds 4 MiB.");
          const document = validateCanvas(
            JSON.parse(
              Buffer.from(
                await vscode.workspace.fs.readFile(files[0]),
              ).toString("utf8"),
            ),
          );
          p.bound.current();
          saved = { document, bindings: {} };
          await persist();
        }
        if (m.type === "export") {
          const preview = await vscode.workspace.openTextDocument({
            content: JSON.stringify(saved.document, null, 2),
            language: "json",
          });
          await vscode.window.showTextDocument(preview, { preview: true });
          const target = await vscode.window.showSaveDialog({
            filters: { "Canvas JSON": ["json"] },
            saveLabel: "Save reviewed Canvas",
          });
          if (target)
            await vscode.workspace.fs.writeFile(
              target,
              Buffer.from(preview.getText()),
            );
        }
        if (m.type === "send") {
          const node = saved.document.nodes.find(
            (n: Json) => n.id === m.nodeId,
          );
          if (
            !node ||
            ![undefined, "chat"].includes(node.kind) ||
            typeof m.text !== "string"
          )
            throw Error(
              "Select a chat lane. Imported reference nodes cannot execute.",
            );
          let c = saved.bindings[node.id];
          if (c && !terminalStates.has(c.state || "completed"))
            throw Error(
              "This lane has unresolved work. Check requests before sending.",
            );
          if (!c) {
            c = await p.bound.run(() => p.bound.client.newConversation());
            c.messages = [...(node.seedContext || []), ...(node.messages || [])]
              .filter(
                (m: Json) =>
                  ["user", "assistant"].includes(m.role) &&
                  typeof m.content === "string",
              )
              .map((m: Json) => ({ role: m.role, content: m.content }))
              .slice(-38);
            saved.bindings[node.id] = c;
          }
          const content = selectedContext(connection, m.contextIds || []);
          try {
            await p.bound.run(() =>
              p.bound.client.send(c!, m.text, content, persist),
            );
          } finally {
            await persist();
          }
          await p.post({
            type: "admitted",
            nodeId: node.id,
            prompt: m.text,
            operationId: c.nonce,
          });
        }
        if (["ready", "open", "import"].includes(m.type))
          await p.post({ type: "document", document: saved.document });
        if (m.type === "save")
          await p.post({
            type: "notice",
            message:
              "Investigation saved locally for this installation. Imported data carries no execution authority.",
          });
      } finally {
        busy = false;
        try {
          await load();
        } finally {
          await p.post({ type: "busy", busy: false });
        }
      }
    },
  );
  return p.view;
}
