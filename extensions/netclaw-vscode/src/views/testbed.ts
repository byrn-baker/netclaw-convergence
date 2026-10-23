import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { Connection } from "../connection/connect";
import { Json } from "../client/hud";
import { loadTestbed, requireEditableInventory } from "../client/inventory";
import { panel } from "../webview/panel";
import { writePrivateExport } from "../client/export";
export function openTestbed(
  context: vscode.ExtensionContext,
  connection: Connection,
) {
  const p = panel(
    context,
    connection,
    "testbed",
    "Testbed inventory",
    `
 <div class="toolbar"><button id="add">Add device</button><button id="import" class="secondary">Import file</button><button id="export" class="secondary">Export</button><button id="recover" class="secondary">Recovery copies</button><button id="refresh" class="secondary">Reload</button></div>
 <p id="status" role="status" aria-live="polite">Loading testbed…</p><p id="target" class="provenance"></p><p id="note" class="hint"></p>
 <div class="toolbar" role="group" aria-label="Editing mode"><button id="cards-mode" class="secondary">Device cards</button><button id="yaml-mode" class="secondary">Advanced YAML</button></div>
 <section id="cards-pane"><label for="filter">Find a device</label><input id="filter" type="search" placeholder="Search by name, platform or address"><p id="count" class="hint"></p><div id="devices" class="card-grid"></div><div class="toolbar"><button id="previous" class="secondary">Previous</button><button id="next" class="secondary">Next</button></div></section>
 <form id="device-form" hidden><h2 id="form-title">Device details</h2><div class="form-grid">${[
   ["id", "Device ID"],
   ["alias", "Display name (alias)"],
   ["os", "Operating system"],
   ["type", "Device type"],
   ["platform", "Platform"],
 ]
   .map(
     ([id, label]) =>
       `<div><label for="device-${id}">${label}</label><input id="device-${id}" name="${id}" maxlength="200" ${["id", "os"].includes(id!) ? "required" : ""}></div>`,
   )
   .join(
     "",
   )}<div><label for="connection-choice">Existing connection</label><select id="connection-choice"></select></div><div><label for="device-connection">Connection name</label><input id="device-connection" required value="cli"></div><div><label for="device-protocol">Protocol</label><input id="device-protocol" required value="ssh"></div><div><label for="device-host">Host or IP address</label><input id="device-host" required placeholder="192.0.2.10"></div><div><label for="device-port">Port (optional)</label><input id="device-port" type="number" min="1" max="65535" placeholder="Transport default"></div></div><p class="hint">Other connections, credentials and advanced fields are preserved. IDs are fixed when editing; rename through Advanced YAML.</p><div class="toolbar"><button type="submit">Preview device change</button><button id="cancel-form" type="button" class="secondary">Close form</button></div></form>
 <section id="yaml-pane" hidden><label for="yaml">Testbed YAML</label><p class="hint">Existing credential literals are protected by keep tokens. Leave tokens in place to retain values. ENV references stay unchanged. New values remain only in this draft until you save.</p><textarea id="yaml" class="editor-code" spellcheck="false" maxlength="524288"></textarea><button id="preview-yaml">Preview YAML changes</button></section>
 <section id="review" hidden><h2>Review changes</h2><div id="review-body" class="notice"></div><div class="toolbar"><button id="save">Save reviewed changes</button><button id="cancel-review" class="secondary">Cancel review</button></div></section>`,
    ["resources/testbed.js"],
  );
  let snapshot: Json,
    prepared: Json | undefined,
    busy = false;
  const client = p.bound.client;
  const load = async () => {
    prepared = undefined;
    snapshot = undefined as unknown as Json;
    await p.post({ type: "loading" });
    snapshot = await p.bound.run(() => loadTestbed(client));
    await p.post({ type: "snapshot", snapshot });
  };
  const preview = async (operation: Json, draftRevision: unknown) => {
    prepared = undefined;
    if (!Number.isSafeInteger(draftRevision) || (draftRevision as number) < 0)
      throw Error("Reload the testbed editor before reviewing changes.");
    if (operation.connection === "defaults")
      throw Error(
        "'defaults' contains shared pyATS settings. Choose an endpoint connection; edit defaults through Advanced YAML.",
      );
    const request = {
      targetId: snapshot.targetId,
      revision: snapshot.revision,
      operation,
    };
    const review = await p.bound.run(() =>
      client.request("POST", "/api/testbed/preview", request),
    );
    prepared = { ...request, digest: review.digest, review, draftRevision };
    await p.post({ type: "preview", review, draftRevision });
  };
  const discard = async (detail: string) =>
    (await vscode.window.showWarningMessage(
      "Discard unsaved testbed work?",
      { modal: true, detail },
      "Discard draft",
    )) === "Discard draft";
  p.onMessage(
    [
      "ready",
      "refresh",
      "preview",
      "save",
      "import",
      "export",
      "recover",
      "switch",
    ],
    async (m) => {
      if (busy) return;
      busy = true;
      await p.post({ type: "busy", busy: true });
      try {
        if (!["ready", "refresh"].includes(m.type))
          requireEditableInventory(snapshot);
        if (m.type === "ready") await load();
        if (
          m.type === "refresh" &&
          (!m.dirty ||
            (await discard(
              "Reload the current file and discard the local draft.",
            )))
        ) {
          p.bound.current();
          await load();
        }
        if (m.type === "switch") {
          if (!["cards", "yaml", "close", "add", "edit"].includes(m.mode))
            return;
          const choice = m.dirty
            ? await vscode.window.showWarningMessage(
                "You have an unsaved testbed draft.",
                {
                  modal: true,
                  detail:
                    "Keep it in this view while switching, discard it, or cancel.",
                },
                "Keep draft and switch",
                "Discard draft",
              )
            : "Keep draft and switch";
          p.bound.current();
          if (choice)
            await p.post({
              type: "switch",
              mode: m.mode,
              id: m.id,
              discard: choice === "Discard draft",
            });
        }
        if (m.type === "preview") {
          if (!snapshot) throw Error("Load the testbed first.");
          await preview(m.operation, m.draftRevision);
        }
        if (m.type === "save") {
          if (!prepared || prepared.draftRevision !== m.draftRevision)
            throw Error("Preview these changes again before saving.");
          const current = prepared;
          const detail = `${connection.profile?.label} · ${connection.identity?.kind}\n${connection.identity?.installationId}\n${current.review.source}\nAdded: ${current.review.added.join(", ") || "none"}\nChanged: ${current.review.changed.join(", ") || "none"}\nRemoved: ${current.review.removed.join(", ") || "none"}\nAffected collection consent: ${current.review.affected.length} device(s)\nPrivate recovery copy retained. All drafts in this view will reload after saving.`;
          if (
            (await vscode.window.showWarningMessage(
              "Save reviewed testbed changes?",
              { modal: true, detail },
              "Save changes",
            )) !== "Save changes"
          )
            return;
          p.bound.current();
          await p.bound.run(() => client.verifyIdentity());
          p.bound.current();
          prepared = undefined;
          const { review, draftRevision, ...request } = current;
          await p.bound.run(() =>
            client.request("PUT", "/api/testbed/document", {
              ...request,
              confirm: true,
            }),
          );
          await load();
          await p.post({
            type: "notice",
            message:
              "Testbed saved and verified. No device connection was started.",
          });
        }
        if (m.type === "import") {
          if (
            m.dirty &&
            !(await discard(
              "Import previews a file. Existing unsaved work will be discarded.",
            ))
          )
            return;
          p.bound.current();
          const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { "Testbed inventory": ["yaml", "yml", "json", "csv"] },
            title: "Import a testbed file",
          });
          if (!files?.[0]) return;
          p.bound.current();
          const stat = await vscode.workspace.fs.stat(files[0]);
          if (stat.size > 256 * 1024)
            throw Error("Import exceeds the 256 KiB limit.");
          const content = Buffer.from(
            await vscode.workspace.fs.readFile(files[0]),
          ).toString("utf8");
          p.bound.current();
          const ext = path.extname(files[0].path).slice(1).toLowerCase(),
            format = ext === "yml" ? "yaml" : ext;
          let mode = "merge",
            conflicts = "error";
          if (format !== "csv") {
            const choice = await vscode.window.showQuickPick(
              [
                {
                  label: "Merge devices",
                  value: "merge",
                  description: "Keep destination defaults and unseen devices",
                },
                {
                  label: "Replace entire testbed",
                  value: "replace",
                  description: "Preview every removal and top-level change",
                },
              ],
              { title: "Import behavior" },
            );
            if (!choice) return;
            mode = choice.value;
            if (mode === "merge") {
              const c = await vscode.window.showQuickPick(
                ["error", "skip", "replace"],
                { title: "When an imported device ID already exists" },
              );
              if (!c) return;
              conflicts = c;
            }
          }
          p.bound.current();
          await preview(
            { type: "import", format, mode, conflicts, content },
            m.draftRevision,
          );
          await p.post({ type: "imported" });
        }
        if (m.type === "recover") {
          if (!snapshot?.backups?.length) {
            await p.post({
              type: "notice",
              message:
                "No recovery copies yet. A private recovery copy is created when you save a testbed change.",
            });
            return;
          }
          const choice = await vscode.window.showQuickPick<{
            label: string;
            description: string;
            id: string;
          }>(
            (snapshot?.backups || []).map((b: Json) => ({
              label: b.createdAt,
              description: b.id,
              id: b.id,
            })),
            { title: "Preview a private recovery copy" },
          );
          if (!choice) return;
          p.bound.current();
          await preview({ type: "restore", id: choice.id }, m.draftRevision);
        }
        if (m.type === "export") {
          const format = await vscode.window.showQuickPick(
            ["yaml", "json", "csv"],
            { title: "Export format · CSV is basic inventory only" },
          );
          if (!format) return;
          const policy =
            format === "csv"
              ? "redacted"
              : await vscode.window.showQuickPick(
                  [
                    {
                      label: "Redacted copy",
                      value: "redacted",
                      description:
                        "Excludes credential literals; not a complete backup",
                    },
                    {
                      label: "Include credentials",
                      value: "include",
                      description: "Private full-data export",
                    },
                  ],
                  { title: "Credential handling" },
                );
          if (!policy) return;
          const credentials =
            typeof policy === "string" ? policy : policy.value;
          const destination = await vscode.window.showSaveDialog({
            title: "Export testbed",
            defaultUri: vscode.Uri.file(
              path.join(
                require("node:os").homedir(),
                `testbed${credentials === "redacted" ? "-redacted" : ""}.${format}`,
              ),
            ),
            filters: { Testbed: [format] },
          });
          if (!destination) return;
          if (destination.scheme !== "file")
            throw Error(
              "Choose a local file on this extension host for a private export.",
            );
          const resolvedDestination = fs.existsSync(destination.fsPath)
            ? fs.realpathSync(destination.fsPath)
            : path.resolve(destination.fsPath);
          const sourcePath = fs.existsSync(snapshot.source)
            ? fs.realpathSync(snapshot.source)
            : path.resolve(snapshot.source);
          if (resolvedDestination === sourcePath)
            throw Error(
              "Export to a separate file. Use the reviewed testbed save to update the active inventory.",
            );
          p.bound.current();
          if (
            (await vscode.window.showWarningMessage(
              "Export this testbed?",
              {
                modal: true,
                detail: `Source: ${snapshot.source}\nDestination: ${destination.fsPath}\n${credentials === "include" ? "Includes private credential literals." : "Credential literals excluded."}\n${format === "csv" ? "CSV omits advanced fields and neutralizes spreadsheet formulas." : "YAML preserves source; JSON preserves data without comments."}`,
              },
              "Export file",
            )) !== "Export file"
          )
            return;
          p.bound.current();
          await p.bound.run(() => client.verifyIdentity());
          const result = await p.bound.run(() =>
            client.request("POST", "/api/testbed/export", {
              targetId: snapshot.targetId,
              revision: snapshot.revision,
              format,
              credentials,
            }),
          );
          p.bound.current();
          writePrivateExport(
            destination.fsPath,
            snapshot.source,
            result.content,
          );
          await p.post({
            type: "notice",
            message: `Export saved. ${(result.limitations || []).join(" ")}`,
          });
        }
      } finally {
        busy = false;
        await p.post({ type: "busy", busy: false });
      }
    },
  );
  p.view.onDidDispose(() => {
    prepared = undefined;
    snapshot = undefined as unknown as Json;
  });
  return p.view;
}
