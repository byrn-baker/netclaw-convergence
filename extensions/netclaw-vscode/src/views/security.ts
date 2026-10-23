import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Connection } from "../connection/connect";
import { hostContext } from "../state/profiles";
import { panel } from "../webview/panel";
import { SecurityClient, SecurityTarget } from "../client/security";
function matchingRuntimeHome(connection: Connection) {
  const kind = connection.identity?.kind;
  const candidates = [
    kind === "hermes" ? process.env.HERMES_HOME : process.env.OPENCLAW_HOME,
    path.join(os.homedir(), kind === "hermes" ? ".hermes" : ".openclaw"),
  ];
  return candidates.find((candidate) => {
    if (!candidate) return false;
    try {
      const identity = JSON.parse(
        fs.readFileSync(
          path.join(candidate, "netclaw-hud/installation.json"),
          "utf8",
        ),
      );
      return identity.installationId === connection.identity?.installationId;
    } catch {
      return false;
    }
  });
}
export function openSecurity(
  context: vscode.ExtensionContext,
  connection: Connection,
  product: "defenseclaw" | "openshell",
) {
  const kind = product === "defenseclaw" ? "security" : "openshell";
  const p = panel(
    context,
    connection,
    kind,
    product === "defenseclaw" ? "DefenseClaw controls" : "OpenShell controls",
    `
  <div class="toolbar"><button id="bind">Inspect local rules & policies</button><button id="refresh" class="secondary">Refresh status & logs</button></div>
  <p class="hint">Inspect the installed security profile to see its tool permissions, network ACLs and redacted policy YAML. Changes require a separate preview and confirmation.</p>
  <p id="status" role="status" aria-live="polite">Loading security posture…</p><p id="security-target" class="provenance"></p><p id="security-note" class="hint"></p>
  <section id="security-controls"><h2>Security posture</h2><div id="posture" class="card-grid"></div></section>
  <section id="policy-section" hidden><h2>Perimeter rules</h2><p id="policy-help" class="hint"></p><label for="rule-filter">Find a rule</label><input id="rule-filter" type="search" placeholder="Search by rule, tool, scope or endpoint"><div id="rules" class="card-grid"></div><p id="rule-count" class="hint"></p><div class="toolbar"><button id="previous" class="secondary">Previous</button><button id="next" class="secondary">Next</button></div>
  <form id="tool-rule" hidden><h3>Allow or block a tool</h3><div class="form-grid"><div><label for="tool-name">Tool name or supported pattern</label><input id="tool-name" required maxlength="200"></div><div><label for="tool-connector">Connector scope</label><select id="tool-connector"><option value="">All connectors · global fallback</option></select></div><div><label for="tool-action">Rule action</label><select id="tool-action"><option value="block">Block</option><option value="allow">Allow</option><option value="remove">Remove explicit rule</option></select></div></div><button type="submit">Preview tool rule</button></form>
  <form id="enforcement" hidden><h3>Enforcement defaults</h3><p class="hint">Global defaults can be overridden by connector policy. Saving does not restart a service or prove that traffic is protected.</p><div class="form-grid"><div><label for="setting-key">Setting</label><select id="setting-key"><option value="mode">Guardrail mode</option><option value="block_at">Minimum blocking severity</option></select></div><div><label for="setting-value">New value</label><select id="setting-value"></select></div></div><button type="submit">Preview enforcement setting</button></form>
  <form id="network-rule" hidden><h3>Add a network allow rule</h3><div class="form-grid"><div><label for="network-name">Rule ID</label><input id="network-name" required maxlength="128" placeholder="approved-api"></div><div><label for="network-host">Destination host</label><input id="network-host" required maxlength="253" placeholder="api.example.com"></div><div><label for="network-port">Port</label><input id="network-port" required type="number" min="1" max="65535" value="443"></div><div><label for="network-binary">Allowed executable path</label><input id="network-binary" required placeholder="/usr/bin/curl"></div><div><label for="network-enforcement">Endpoint enforcement</label><select id="network-enforcement"><option value="enforce">Enforce</option><option value="audit">Audit only</option></select></div></div><p class="hint">Creates a REST read-only endpoint for one binary. Use Advanced network policy for supported layer7 allow/deny rules or other endpoint types.</p><button type="submit">Add to network draft</button></form>
  <section id="network-editor" hidden><h3>Advanced network policy</h3><label for="network-json">Native network_policies JSON</label><textarea id="network-json" class="editor-code" spellcheck="false" maxlength="131072"></textarea><p class="hint">Only this network section changes. Filesystem/process rules stay intact. Protected keep tokens must remain in place. Overlapping rules or provider policies can still permit a destination.</p><button id="preview-network">Preview network policy</button></section>
  <label for="security-reason">Reason for this change</label><input id="security-reason" maxlength="500" placeholder="Explain the intended protection or approved access">
  </section><section id="security-review" hidden><h2>Review security change</h2><p id="review-summary" class="notice"></p><p id="review-impact" class="hint"></p><pre id="review-difference" class="log-snapshot" tabindex="0" aria-label="Redacted policy changes"></pre><div class="toolbar"><button id="apply-security">Review & apply</button><button id="cancel-security" class="secondary">Cancel review</button></div></section>
  <section id="permissions-section" hidden><h2>Permissions & access</h2><p class="hint">Observed filesystem, process and asset permissions. These describe configuration; they do not prove enforcement.</p><pre id="permissions" class="log-snapshot" tabindex="0" aria-label="Redacted configured permissions"></pre></section>
  <section id="policy-document-section" hidden><h2>Policy YAML</h2><p id="policy-location" class="provenance"></p><p class="hint">Redacted inspection copy; sensitive values are hidden and large structures may be shortened. Use the reviewed forms for supported changes.</p><details><summary>Show redacted YAML</summary><pre id="policy-yaml" class="log-snapshot" tabindex="0" aria-label="Redacted policy YAML"></pre></details></section>
  <section><h2>Security logs & alerts</h2><label for="log-filter">Filter this snapshot</label><input id="log-filter" type="search" placeholder="Search a message, action, level or target"><p id="logs-note" class="hint">Logs load after choosing a native security target.</p><pre id="security-logs" class="log-snapshot" tabindex="0" aria-label="Redacted security log snapshot"></pre></section>`,
    ["resources/security.js"],
  );
  const key = `securityTarget.${connection.identity!.installationId}.${hostContext()}.${product}`;
  let target = context.globalState.get<SecurityTarget>(key),
    client: SecurityClient | undefined,
    prepared: any,
    busy = false;
  const make = () => {
    if (target)
      client = new SecurityClient(
        target,
        path.join(context.globalStorageUri.fsPath, "security-operations"),
      );
  };
  const load = async () => {
    prepared = undefined;
    if (target) {
      make();
      try {
        const snapshot = await p.bound.run(() => client!.inspect());
        await p.post({ type: "security", snapshot });
      } catch (error) {
        await p.post({ type: "security-unavailable" });
        throw error;
      }
    } else {
      const observed = await p.bound.run(() =>
        p.bound.client.request(
          "GET",
          product === "defenseclaw"
            ? "/api/hud/security"
            : "/api/hud/openshell",
        ),
      );
      await p.post({ type: "unbound", observed, product });
    }
  };
  const input = async (title: string, prompt: string, value?: string) => {
    const result = await vscode.window.showInputBox({ title, prompt, value });
    p.bound.current();
    return result?.trim();
  };
  p.onMessage(
    ["ready", "refresh", "bind", "preview", "apply", "cancel"],
    async (m) => {
      if (busy) return;
      busy = true;
      await p.post({ type: "busy", busy: true });
      try {
        if (m.type === "ready") await load();
        if (["refresh", "bind"].includes(m.type) && m.dirty) {
          if (
            (await vscode.window.showWarningMessage(
              "Discard the unsaved security draft?",
              { modal: true },
              "Discard draft",
            )) !== "Discard draft"
          )
            return;
          p.bound.current();
        }
        if (m.type === "refresh") await load();
        if (m.type === "bind") {
          const runtimeHome = await input(
            "Existing runtime home",
            "The folder containing netclaw-hud/installation.json for this selected connection.",
            target?.runtimeHome || matchingRuntimeHome(connection),
          );
          if (!runtimeHome) return;
          const found = (process.env.PATH || "")
            .split(path.delimiter)
            .map((dir) => path.join(dir, product))
            .find((file) => fs.existsSync(file));
          const executable = await input(
            `${product} executable on this host`,
            "Select the existing native CLI. No installation or activation runs.",
            target?.executable || found,
          );
          if (!executable) return;
          const securityHome = await input(
            product === "defenseclaw"
              ? "DefenseClaw data directory"
              : "OpenShell configuration root",
            product === "defenseclaw"
              ? "Existing directory containing config.yaml. This profile may protect multiple agents."
              : "Existing XDG configuration root containing openshell/gateways. This gateway may protect multiple agents.",
            target?.securityHome ||
              path.join(
                os.homedir(),
                product === "defenseclaw" ? ".defenseclaw" : ".config",
              ),
          );
          if (!securityHome) return;
          let gateway, workspace, sandbox;
          if (product === "openshell") {
            let gateways: string[] = [];
            try {
              gateways = fs
                .readdirSync(path.join(securityHome, "openshell/gateways"), {
                  withFileTypes: true,
                })
                .filter(
                  (d) =>
                    d.isDirectory() &&
                    /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(d.name),
                )
                .map((d) => d.name);
            } catch {
              /* Native validation explains missing gateway metadata. */
            }
            gateway = await input(
              "OpenShell gateway",
              "Use an explicit existing gateway name.",
              target?.gateway ||
                (gateways.length === 1 ? gateways[0] : undefined),
            );
            if (!gateway) return;
            workspace = await input(
              "OpenShell workspace",
              "Use the workspace that owns the sandbox.",
              target?.workspace || "default",
            );
            if (!workspace) return;
            let sandboxes: string[] = [];
            try {
              const discovery = new SecurityClient(
                {
                  product,
                  runtimeHome,
                  executable,
                  securityHome,
                  gateway,
                  workspace,
                  sandbox: "discovery",
                  installationId: connection.identity!.installationId,
                  kind: connection.identity!.kind,
                },
                context.globalStorageUri.fsPath,
              );
              sandboxes = await p.bound.run(() => discovery.sandboxes());
            } catch {
              /* An explicit name remains available if discovery is unsupported. */
            }
            p.bound.current();
            sandbox = sandboxes.length
              ? await vscode.window.showQuickPick(sandboxes, {
                  title: "OpenShell sandbox",
                  placeHolder: "Select the existing sandbox to inspect",
                })
              : await input(
                  "OpenShell sandbox",
                  "The existing sandbox whose network rules you want to manage.",
                  target?.sandbox,
                );
            p.bound.current();
            if (!sandbox) return;
          }
          const candidate: SecurityTarget = {
            product,
            runtimeHome,
            executable,
            securityHome,
            gateway,
            workspace,
            sandbox,
            installationId: connection.identity!.installationId,
            kind: connection.identity!.kind,
          };
          const next = new SecurityClient(
            candidate,
            path.join(context.globalStorageUri.fsPath, "security-operations"),
          );
          if (
            (await vscode.window.showInformationMessage(
              "Bind this shared security perimeter?",
              {
                modal: true,
                detail: `Host: ${hostContext()}\nNetClaw: ${candidate.installationId}\nSecurity: ${securityHome}\n${product === "openshell" ? `${gateway} / ${workspace} / ${sandbox}` : "DefenseClaw profile; may affect other connectors"}\nThe selected installation does not imply exclusive ownership of this security target.`,
              },
              "Bind security target",
            )) !== "Bind security target"
          )
            return;
          p.bound.current();
          await p.bound.run(() => p.bound.client.verifyIdentity());
          target = next.target;
          client = next;
          await context.globalState.update(key, target);
          await load();
        }
        if (m.type === "cancel") {
          prepared = undefined;
          await p.post({ type: "cancelled" });
        }
        if (m.type === "preview") {
          prepared = undefined;
          if (!client) throw Error("Choose a native security target first.");
          prepared = client.prepare(m.operation, m.revision, m.reason);
          await p.post({
            type: "review",
            summary: prepared.summary,
            difference: prepared.difference,
            weakening: prepared.weakening,
            impact:
              product === "openshell"
                ? "The native policy command has no atomic revision precondition. This client rechecks immediately, but an external writer can still race. A private original is retained; no automatic rollback or retry occurs."
                : prepared.nativeOperation
                  ? "The native CLI updates one connector's tool rule. This client rechecks immediately, but external writers can race. A private configuration and rule snapshot is retained; no automatic rollback or retry occurs."
                  : "The native writer checks the reviewed file revision and validates the policy. A private original is retained. Runtime loading remains a separate state.",
          });
        }
        if (m.type === "apply") {
          if (!client || !prepared)
            throw Error("Preview the security change again.");
          const current = prepared,
            button = current.weakening
              ? "Acknowledge weakening & apply"
              : "Apply security change";
          if (
            (await vscode.window.showWarningMessage(
              current.weakening
                ? "This change can weaken the security perimeter."
                : "Apply this security change?",
              {
                modal: true,
                detail: `${current.summary}\n\nHost: ${hostContext()}\nSecurity profile: ${target!.securityHome}\nInstallation: ${target!.installationId}\nReason: ${current.reason}\n\n${product === "openshell" ? "Explicit sandbox policy update; external writers can race the precheck." : "Shared profile; other connectors can be affected."}\nPrivate original retained in this editor's security-operations storage. A failed or interrupted operation will not retry automatically.`,
              },
              button,
            )) !== button
          )
            return;
          p.bound.current();
          prepared = undefined;
          const result = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Applying reviewed security policy",
              cancellable: false,
            },
            () =>
              client!.apply(current, async () => {
                p.bound.current();
                await p.bound.run(() => p.bound.client.verifyIdentity());
              }),
          );
          await load();
          await p.post({
            type: "notice",
            message: result.message + " Recovery evidence: " + result.evidence,
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
    client = undefined;
  });
  return p.view;
}
