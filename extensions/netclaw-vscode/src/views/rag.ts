import * as vscode from "vscode";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Connection } from "../connection/connect";
import { Json } from "../client/hud";
import { panel } from "../webview/panel";
export function openRag(
  context: vscode.ExtensionContext,
  connection: Connection,
) {
  const p = panel(
    context,
    connection,
    "rag",
    "RAG knowledge base",
    `<div class="toolbar"><button id="refresh">Refresh collections</button><button id="upload">Upload a selected document</button><button id="chat">Open Chat</button><button id="canvas">Open Canvas</button></div><p id="status" role="status" aria-live="polite">Loading…</p><form id="rag-search"><label for="collection">Collection</label><select id="collection"><option>documents</option></select><label for="query">Search query</label><input id="query" type="search" maxlength="4000" required><button type="submit">Search knowledge</button></form><p class="hint">Existing NetClaw retrieval. Citations are reference material; snapshots may be stale.</p><div id="results"></div><button id="stage" disabled>Add selected results to context</button><h2>Indexing status</h2><div id="operations">Refresh the document inventory to inspect indexing outcomes. Upload acceptance is not indexing success.</div><h2>Documents, snapshots & replicas</h2><p id="stats"></p><div id="documents"></div><button id="more" hidden>More</button>`,
    ["resources/rag.js"],
  );
  let search: Json = { results: [] },
    busy = false;
  const load = async () => {
    const listing = await p.bound.run(() =>
      p.bound.client.request("GET", "/api/rag/documents", undefined, 90000),
    );
    const stats = await p.bound.run(() =>
      p.bound.client.request("GET", "/api/rag/stats", undefined, 90000),
    );
    const documents = [
      ...(listing.documents || []),
      ...(listing.snapshots || []),
      ...(listing.replicas || []),
    ];
    await p.post({
      type: "listing",
      documents,
      stats,
      total: documents.length,
    });
  };
  p.onMessage(
    ["ready", "refresh", "search", "stage", "upload", "chat", "canvas"],
    async (m) => {
      if (busy) {
        await p.post({ type: "busy", busy: true });
        if (m.type !== "ready")
          await p.post({
            type: "notice",
            message:
              "A knowledge operation is already in progress. Wait for it to finish before trying again.",
          });
        return;
      }
      busy = true;
      try {
        await p.post({ type: "busy", busy: true });
        if (["ready", "refresh"].includes(m.type)) await load();
        if (m.type === "chat" || m.type === "canvas")
          await vscode.commands.executeCommand(
            m.type === "chat" ? "netclaw.openChat" : "netclaw.openCanvas",
          );
        if (m.type === "search") {
          if (
            typeof m.query !== "string" ||
            !m.query.trim() ||
            m.query.length > 4000 ||
            typeof m.collection !== "string" ||
            !/^[-\w.]{1,128}$/.test(m.collection)
          )
            throw Error("Invalid search query or collection.");
          search = await p.bound.run(() =>
            p.bound.client.request(
              "POST",
              "/api/rag/search",
              { query: m.query, collection: m.collection, k: 10 },
              150000,
            ),
          );
          await p.post({ type: "results", ...search });
        }
        if (m.type === "stage") {
          if (
            !Array.isArray(m.indices) ||
            !m.indices.length ||
            m.indices.length > 20 ||
            m.indices.some(
              (i: unknown) =>
                !Number.isInteger(i) || !search.results[i as number],
            )
          )
            throw Error("Select current search results.");
          const content = m.indices
            .map((i: number) => {
              const r = search.results[i];
              return [r.title, r.citation, r.staleness_notice, r.chunk_text]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n");
          const doc = await vscode.workspace.openTextDocument({
            content,
            language: "plaintext",
          });
          await vscode.window.showTextDocument(doc, {
            preview: true,
            preserveFocus: true,
            viewColumn: vscode.ViewColumn.Beside,
          });
          if (
            (await vscode.window.showInformationMessage(
              "Stage these cited passages for an explicit Chat or Canvas send?",
              { modal: true },
              "Stage context",
            )) !== "Stage context"
          )
            return;
          p.bound.current();
          const id = randomUUID();
          connection.contexts.set(id, {
            id,
            name: "Reviewed RAG citations",
            content,
            size: Buffer.byteLength(content),
          });
          await p.post({
            type: "notice",
            message:
              "Citations staged locally. Select them in Chat or Canvas before sending.",
          });
        }
        if (m.type === "upload") {
          const selected = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: "Review document",
            filters: {
              Documents: [
                "pdf",
                "md",
                "markdown",
                "html",
                "htm",
                "txt",
                "docx",
                "xlsx",
                "pptx",
                "vsdx",
                "doc",
                "xls",
                "ppt",
                "vsd",
              ],
            },
          });
          if (!selected?.[0]) return;
          const file = selected[0],
            stat = await vscode.workspace.fs.stat(file);
          if (!stat.size || stat.size > 10 * 1024 * 1024)
            throw Error("Select a nonempty document up to 10 MiB.");
          const bytes = await vscode.workspace.fs.readFile(file),
            name = path.posix.basename(file.path),
            digest = createHash("sha256").update(bytes).digest("hex");
          const docType = await vscode.window.showQuickPick(
            ["other", "vendor", "standard", "customer", "install-guide"],
            { title: "Document category" },
          );
          if (!docType) return;
          if (
            (await vscode.window.showInformationMessage(
              `Upload and index ${name}?`,
              {
                modal: true,
                detail: `Destination: ${connection.profile?.label}\n${connection.identity?.installationId}\n${bytes.length} bytes\nSHA-256: ${digest}\nThe file will be retained and indexed by existing NetClaw RAG. An existing document with the same filename/title may be replaced; review the inventory first.`,
              },
              "Upload",
            )) !== "Upload"
          )
            return;
          p.bound.current();
          const result = await p.bound.run(() =>
            p.bound.client.upload(name, bytes, docType),
          );
          await p.post({
            type: "notice",
            message: `Upload ${result.status || "accepted"}. Refresh documents to confirm indexing; no automatic retry.`,
          });
        }
      } finally {
        busy = false;
        await p.post({ type: "busy", busy: false });
      }
    },
  );
  return p.view;
}
