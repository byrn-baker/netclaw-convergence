import * as vscode from "vscode";
import fs from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { Management } from "../state/management";
import { Connection } from "../connection/connect";
import { escape } from "../webview/shell";
import { sha } from "../client/claw";
export const workspaceFiles = [
  "SOUL.md",
  "AGENTS.md",
  "IDENTITY.md",
  "USER.md",
  "TOOLS.md",
  "HEARTBEAT.md",
];
const scheme = "netclaw-workspace";
export class WorkspaceFiles
  implements vscode.FileSystemProvider, vscode.Disposable
{
  private events = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this.events.event;
  private documents = new Map<
    string,
    {
      bound: ReturnType<Management["bound"]>;
      name: string;
      read: any;
      mtime: number;
    }
  >();
  private texts = new Map<string, string>();
  private restart = new Set<string>();
  constructor(
    private context: vscode.ExtensionContext,
    private management: Management,
    private connection: Connection,
  ) {
    context.subscriptions.push(
      vscode.workspace.registerFileSystemProvider(scheme, this, {
        isCaseSensitive: true,
      }),
      vscode.workspace.registerTextDocumentContentProvider("netclaw-review", {
        provideTextDocumentContent: (u) => this.texts.get(u.toString()) || "",
      }),
    );
  }
  watch() {
    return new vscode.Disposable(() => {});
  }
  readDirectory(): [string, vscode.FileType][] {
    return [];
  }
  createDirectory() {
    throw vscode.FileSystemError.NoPermissions(
      "Only the six existing workspace names can be created by upload/save.",
    );
  }
  delete() {
    throw vscode.FileSystemError.NoPermissions(
      "Deleting workspace files is not supported.",
    );
  }
  rename() {
    throw vscode.FileSystemError.NoPermissions(
      "Renaming workspace files is not supported.",
    );
  }
  private doc(uri: vscode.Uri) {
    const d = this.documents.get(uri.toString());
    if (!d)
      throw vscode.FileSystemError.Unavailable(
        "Reopen this workspace file from the NetClaw panel.",
      );
    d.bound.current();
    return d;
  }
  stat(uri: vscode.Uri): vscode.FileStat {
    const d = this.doc(uri);
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: d.mtime,
      size: d.read?.bytes || 0,
    };
  }
  async readFile(uri: vscode.Uri) {
    const d = this.doc(uri);
    d.read = await d.bound.run("read", { name: d.name });
    return Buffer.from(d.read.content);
  }
  async open(name: string) {
    if (!workspaceFiles.includes(name))
      throw Error("Unknown workspace filename.");
    const bound = this.management.bound();
    const uri = vscode.Uri.from({
      scheme,
      authority: bound.binding.profile.id,
      path: `/${name}`,
      query: String(this.management.generation),
    });
    if (!this.documents.has(uri.toString()))
      this.documents.set(uri.toString(), {
        bound,
        name,
        read: await bound.run("read", { name }),
        mtime: Date.now(),
      });
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
    return doc;
  }
  async review(
    bound: ReturnType<Management["bound"]>,
    name: string,
    before: string,
    content: string,
    withRestart: boolean,
    baseline: string,
  ) {
    const write = await bound.run("prepare-write", { name, content, baseline });
    const lifecycle = withRestart
      ? await bound.run("prepare-lifecycle", {
          action: "restart",
          writeReviewId: write.id,
        })
      : undefined;
    const id = randomUUID(),
      old = vscode.Uri.parse(`netclaw-review:/${id}/before/${name}`),
      draft = vscode.Uri.parse(`netclaw-review:/${id}/after/${name}`);
    this.texts.set(old.toString(), before);
    this.texts.set(draft.toString(), content);
    await vscode.commands.executeCommand(
      "vscode.diff",
      old,
      draft,
      `${name} · review ${bound.binding.profile.label}`,
      { preview: true },
    );
    const label = withRestart ? "Save and Restart" : "Save file";
    const choice = await vscode.window.showWarningMessage(
      `${label}: ${name}?`,
      {
        modal: true,
        detail: `${bound.binding.profile.label} · ${bound.binding.target.kind}\n${write.workspace}/${name}\nInstallation: ${write.installationId}\n${content.length === 0 ? "EMPTY REPLACEMENT — all contents will be cleared; the file remains present.\n" : ""}${Buffer.byteLength(content)} bytes · SHA-256 ${sha(content)}\n\n${baseline === "missing" ? "Creates the missing file exclusively." : "Replaces this file after checking its reviewed revision. A private original is retained."}\nCoordinate external writers while saving.\n${lifecycle ? `\nRestart scope: ${lifecycle.services.map((s: any) => s.role + " (" + s.controller + ")").join(", ")}.\n${lifecycle.activity}\nSaving must verify before restart can begin.` : "Save alone does not restart any service."}`,
      },
      label,
    );
    this.texts.delete(old.toString());
    this.texts.delete(draft.toString());
    bound.current();
    if (choice !== label)
      throw vscode.FileSystemError.NoPermissions(
        "Review cancelled; the draft remains unsaved.",
      );
    return { write, lifecycle };
  }
  async writeFile(uri: vscode.Uri, bytes: Uint8Array) {
    const d = this.doc(uri),
      content = decode(bytes),
      withRestart = this.restart.has(uri.toString());
    const { write, lifecycle } = await this.review(
      d.bound,
      d.name,
      d.read.content,
      content,
      withRestart,
      d.read.revision,
    );
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Saving ${d.name}`,
      },
      () => d.bound.run("apply-write", { ...write, content }),
    );
    if (result.outcome !== "verified")
      throw Error("Save is not verified. Restart was not requested.");
    d.read = {
      ...d.read,
      content,
      revision: result.revision,
      bytes: bytes.length,
    };
    d.mtime = Date.now();
    this.events.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    if (lifecycle) {
      try {
        const saved = await d.bound.run("read", { name: d.name });
        if (saved.revision !== result.revision)
          throw Error("Saved revision changed before restart. Review again.");
        await this.applyLifecycle(d.bound, lifecycle);
        void vscode.window.showInformationMessage(
          `${d.name} saved and verified. Claw restarted.`,
        );
      } catch (e) {
        void vscode.window.showErrorMessage(
          `${d.name} saved and verified. Restart incomplete: ${e instanceof Error ? e.message : "Reconcile the service state."}`,
        );
      }
    } else
      void vscode.window
        .showInformationMessage(`${d.name} saved and verified.`, "Restart claw")
        .then(async (answer) => {
          if (answer === "Restart claw")
            try {
              await this.lifecycle("restart", d.bound);
            } catch (e) {
              void vscode.window.showErrorMessage(String(e));
            }
        });
    this.management.changed.fire();
  }
  async saveAndRestart() {
    const active = vscode.window.activeTextEditor?.document;
    const candidates = vscode.workspace.textDocuments.filter(
      (d) => d.uri.scheme === scheme && d.isDirty,
    );
    const doc =
      active?.uri.scheme === scheme && active.isDirty
        ? active
        : candidates.length === 1
          ? candidates[0]
          : undefined;
    if (!doc)
      throw Error(
        "Edit one workspace file first, then use Save and Restart. Saved files can use Restart claw.",
      );
    this.doc(doc.uri);
    this.restart.add(doc.uri.toString());
    try {
      await doc.save();
    } finally {
      this.restart.delete(doc.uri.toString());
    }
  }
  async upload(name?: string) {
    if (!name)
      name = await vscode.window.showQuickPick(workspaceFiles, {
        title: "Choose the workspace file to upload / overwrite",
      });
    if (!name || !workspaceFiles.includes(name)) return;
    const bound = this.management.bound();
    const selected = await vscode.window.showOpenDialog({
      title: `Upload / overwrite ${name}`,
      canSelectMany: false,
      filters: { Markdown: ["md"] },
    });
    if (!selected?.[0]) return;
    bound.current();
    if (selected[0].scheme !== "file")
      throw Error("Select a file on this extension host.");
    const stat = fs.statSync(selected[0].fsPath);
    if (!stat.isFile() || stat.size > 1048576)
      throw Error("Select a regular UTF-8 file up to 1 MiB.");
    const fd = fs.openSync(
      selected[0].fsPath,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    );
    let content: string;
    try {
      if (!fs.fstatSync(fd).isFile())
        throw Error("Select a regular UTF-8 file.");
      const buffer = Buffer.alloc(1048577);
      let length = 0,
        count;
      while (
        length < buffer.length &&
        (count = fs.readSync(fd, buffer, length, buffer.length - length, null))
      )
        length += count;
      content = decode(buffer.subarray(0, length));
    } finally {
      fs.closeSync(fd);
    }
    const dirty = vscode.workspace.textDocuments.find(
      (d) =>
        d.uri.scheme === scheme &&
        d.uri.authority === bound.binding.profile.id &&
        d.uri.path === `/${name}` &&
        d.isDirty,
    );
    if (dirty)
      throw Error(
        "Save or revert this file’s unsaved editor draft before uploading.",
      );
    const before = await bound.run("read", { name });
    const { write } = await this.review(
      bound,
      name,
      before.content,
      content,
      false,
      before.revision,
    );
    const result = await bound.run("apply-write", { ...write, content });
    if (result.outcome !== "verified")
      throw Error("Upload outcome unknown. Reconcile before restarting.");
    for (const [u, d] of this.documents)
      if (
        d.name === name &&
        d.bound.binding.profile.id === bound.binding.profile.id
      ) {
        try {
          d.bound.current();
        } catch {
          continue;
        }
        d.mtime = Date.now();
        this.events.fire([
          { type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse(u) },
        ]);
      }
    void vscode.window.showInformationMessage(`${name} uploaded and verified.`);
    this.management.changed.fire();
  }
  async applyLifecycle(bound: ReturnType<Management["bound"]>, review: any) {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `${review.action === "stop" ? "Stopping" : review.action === "start" ? "Starting" : "Restarting"} ${bound.binding.profile.label} · observing owned services`,
      },
      () => bound.run("apply-lifecycle", { id: review.id, acknowledged: true }),
    );
    if (result.outcome !== "verified")
      throw Error("Lifecycle outcome unknown.");
    if (review.action === "stop") {
      if (this.connection.profile?.id === bound.binding.profile.id)
        this.connection.disconnect();
    } else {
      try {
        await this.connection.connect(bound.binding.profile);
      } catch {
        void vscode.window.showWarningMessage(
          "Services were controlled, but the HUD connection is not ready. Reconcile and reconnect to the same installation.",
        );
      }
    }
    this.management.changed.fire();
    return result;
  }
  async lifecycle(action: string, bound = this.management.bound()) {
    const review = await bound.run("prepare-lifecycle", { action });
    const choice = await vscode.window.showWarningMessage(
      `${action[0]!.toUpperCase() + action.slice(1)} ${bound.binding.profile.label}?`,
      {
        modal: true,
        detail: `Installation: ${bound.binding.target.installationId}\n${bound.binding.target.home}\nScope: ${review.services.map((s: any) => s.role + " (" + s.controller + ")").join(", ")}\n\n${review.activity}\nUnsaved editor drafts are not saved by this action.`,
      },
      "Confirm " + action,
    );
    bound.current();
    if (choice !== "Confirm " + action) return;
    await this.applyLifecycle(bound, review);
  }
  dispose() {
    this.events.dispose();
    this.texts.clear();
    this.documents.clear();
  }
}
function decode(b: Uint8Array) {
  if (b.length > 1048576) throw Error("Content exceeds the 1 MiB limit.");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(b);
  } catch {
    throw Error("Select valid UTF-8 text.");
  }
}
export function openWorkspace(
  context: vscode.ExtensionContext,
  management: Management,
  files: WorkspaceFiles,
) {
  const bound = management.bound(),
    viewId = randomUUID(),
    nonce = randomBytes(24).toString("base64");
  let sequence = 0,
    busy = false,
    disposed = false;
  const view = vscode.window.createWebviewPanel(
    "netclaw.workspace",
    "Workspace & Claw",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "resources"),
      ],
    },
  );
  const uri = (p: string) =>
    view.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "resources", p),
    );
  view.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${uri("workbench.css")}"><link rel="stylesheet" href="${uri("workspace.css")}"></head><body data-view-id="${viewId}"><main class="workspace-page"><p class="eyebrow">SELECTED INSTALLATION · ${escape(bound.binding.target.kind)}</p><h1>${escape(bound.binding.profile.label)}</h1><p class="muted">Workspace files & claw controls</p><section class="claw-control"><div><h2>Engine & services</h2><p id="service-summary" role="status">Checking ownership and status…</p></div><div class="actions"><button data-action="start">Start</button><button data-action="stop" class="secondary">Stop</button><button data-action="restart" class="secondary">Restart</button><button data-action="refresh" class="secondary">Refresh / reconcile</button><button data-action="history" class="secondary">Recovery & history</button></div><div id="services"></div><p id="capability" class="muted"></p></section><section><div class="workspace-heading"><div><h2>Workspace Markdown</h2><p>Open a file to read or edit it in VS Code. Save with ⌘S / Ctrl+S.</p></div><div class="actions"><button data-action="upload" class="secondary">Upload / overwrite</button><button data-action="save-restart">Save & Restart</button></div></div><p id="loading" class="muted"></p><div id="file-list" class="workspace-files"></div></section><details><summary>Selected installation</summary><p class="target-path">${escape(bound.binding.target.home)}</p><p class="target-path">${escape(bound.binding.target.installationId)}</p><p id="workspace-path" class="target-path"></p></details><p id="message" role="status" aria-live="polite"></p></main><script nonce="${nonce}" src="${uri("messaging.js")}"></script><script nonce="${nonce}" src="${uri("workspace.js")}"></script></body></html>`;
  const post = (m: object) =>
    !disposed && view.webview.postMessage({ viewId, ...m });
  const refresh = async () => {
    const data = await bound.run("inspect");
    post({ type: "state", data });
  };
  const changed = management.changed.event(() => {
    void refresh().catch((e) =>
      post({ type: "error", message: e.message, invalidated: true }),
    );
  });
  view.onDidDispose(() => {
    disposed = true;
    changed.dispose();
  });
  view.webview.onDidReceiveMessage(async (m) => {
    if (
      !m ||
      JSON.stringify(m).length > 5000 ||
      m.viewId !== viewId ||
      !/^\d{1,12}$/.test(m.requestId) ||
      Number(m.requestId) <= sequence ||
      ![
        "ready",
        "open",
        "upload",
        "save-restart",
        "start",
        "stop",
        "restart",
        "refresh",
        "history",
      ].includes(m.type) ||
      busy
    )
      return;
    sequence = Number(m.requestId);
    busy = true;
    post({ type: "busy", busy: true });
    try {
      bound.current();
      if (m.type === "open") await files.open(m.name);
      else if (m.type === "upload") await files.upload(m.name);
      else if (m.type === "save-restart") await files.saveAndRestart();
      else if (["start", "stop", "restart"].includes(m.type))
        await files.lifecycle(m.type, bound);
      else if (m.type === "history") {
        const evidence = await bound.run("reconcile");
        const doc = await vscode.workspace.openTextDocument({
          content: JSON.stringify(
            {
              installationId: bound.binding.target.installationId,
              home: bound.binding.target.home,
              recovery:
                "Use Upload / overwrite to restore a private backup after reviewing its diff. Nothing is automatically replayed.",
              ...evidence,
            },
            null,
            2,
          ),
          language: "json",
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      } else if (m.type === "refresh") {
        const r = await bound.run("reconcile");
        post({
          type: "notice",
          message: r.operations?.[0]
            ? `Last operation: ${r.operations[0].phase}. No operation was retried.`
            : "State observed. No operation was retried.",
        });
      }
      await refresh();
    } catch (e) {
      post({
        type: "error",
        message: e instanceof Error ? e.message : "Workspace action failed.",
      });
    } finally {
      busy = false;
      post({ type: "busy", busy: false });
    }
  });
  return view;
}
