import * as vscode from "vscode";
import { Connection } from "../connection/connect";
import { hostContext } from "../state/profiles";
import {
  prepareSetup,
  executeSetup,
  setupHistory,
  verifyPrepared,
} from "../client/setup";
import { Json } from "../client/hud";
export async function openSetup(
  context: vscode.ExtensionContext,
  connection: Connection,
  integrationId: string,
) {
  const b = connection.bound(),
    inventory = await b.run(() =>
      b.client.request("GET", "/api/mcp/configuration"),
    );
  const descriptor = inventory.integrations.find(
    (d: Json) => d.id === integrationId,
  );
  if (!descriptor)
    throw Error("Setup metadata is unavailable for this integration.");
  if (!descriptor.components?.length) {
    await vscode.window.showInformationMessage(
      descriptor.notes + " This entry has no installable component.",
    );
    return;
  }
  const component =
    descriptor.components.length === 1
      ? descriptor.components[0]
      : await vscode.window.showQuickPick(descriptor.components as string[], {
          title: "Select the component or service to set up",
        });
  if (!component) return;
  const choices = [
    ...(["pyats", "gait"].includes(component)
      ? [
          {
            label: "Install isolated runtime",
            action: "install",
            description:
              "Stage and verify this runtime; preserve a displaced generation",
          },
        ]
      : []),
    {
      label: "Register canonical MCP",
      action: "register",
      description:
        connection.identity?.kind === "hermes"
          ? "Native Hermes review required; sidecar creation alone is not registration"
          : "Preserve unrelated entries; verify the selected registration",
    },
    ...(component === "n2n"
      ? [
          {
            label: "Restart federation service",
            action: "restart",
            description: "Interrupts this installation’s active peer work",
          },
        ]
      : []),
    {
      label: "Prepare installer command",
      action: "stage",
      description:
        "Broader installer effects are shown; stage without pressing Enter",
    },
    {
      label: "Read lifecycle guidance",
      action: "guidance",
      description: "Why some MCPs have no direct install or restart action",
    },
  ];
  const choice = await vscode.window.showQuickPick(choices, {
    title: descriptor.name + " · setup actions",
  });
  if (!choice) return;
  if (
    choice.action === "guidance" ||
    (choice.action === "register" && connection.identity?.kind === "hermes")
  ) {
    await vscode.window.showInformationMessage(
      "Stdio MCPs are owned by the selected agent runtime. There is no qualified generic per-MCP restart. Hermes registration requires reviewing its native config; the existing converter can produce a sidecar without changing active registrations. Saved .env values do not prove loaded runtime settings.",
      { modal: true, detail: descriptor.notes },
    );
    return;
  }
  b.current();
  const identity = connection.identity!,
    key = "setupBinding." + identity.installationId + "." + hostContext(),
    prior = context.globalState.get<{ root: string; home: string }>(key);
  const root = await vscode.window.showInputBox({
    title: "NetClaw source checkout on this extension host",
    prompt:
      "Existing checkout containing the reviewed scripts/ helpers. This does not install or deploy the checkout.",
    value: prior?.root,
  });
  if (!root) return;
  const home = await vscode.window.showInputBox({
    title: "Existing " + identity.kind + " runtime home",
    prompt:
      "The folder containing netclaw-hud/installation.json for this selected connection.",
    value: prior?.home,
  });
  if (!home) return;
  b.current();
  const prepared = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Preparing scoped " + component + " setup",
    },
    () =>
      prepareSetup({
        root,
        home,
        kind: identity.kind,
        installationId: identity.installationId,
        host: hostContext(),
        component,
        action: choice.action,
      }),
  );
  b.current();
  await context.globalState.update(key, {
    root: prepared.root,
    home: prepared.home,
  });
  const history = setupHistory(prepared.home);
  let activity = "";
  if (choice.action === "restart") {
    const n2n = await b.run(() => b.client.request("GET", "/api/n2n"));
    activity = `\nReported active work: ${(n2n.replicationJobs || []).filter((j: Json) => !["done", "complete", "failed", "cancelled"].includes(j.status)).length} replication entries; ${(n2n.peers || []).length} peers. Unknown work may exist.`;
  }
  const body = `# ${choice.label}\n\nHost: ${prepared.host}\nRuntime: ${prepared.kind}\nInstallation: ${prepared.installationId}\nHome: ${prepared.home}\nCheckout: ${prepared.root}\n\n${prepared.description}\n\n${prepared.impact}${activity}\n\nReviewed command (no credential values):\n\n${prepared.command}\n\nRecent local outcomes:\n${history.length ? history.map((r) => `${r!.component} · ${r!.action} · ${r!.state}`).join("\n") : "None recorded."}\n\nA prepared command has not run. Closing this document does not cancel a launched operation.`;
  const document = await vscode.workspace.openTextDocument({
    content: body,
    language: "markdown",
  });
  await vscode.window.showTextDocument(document, { preview: true });
  b.current();
  const button =
    choice.action === "stage"
      ? "Stage without executing"
      : "Execute reviewed action";
  if (
    (await vscode.window.showWarningMessage(
      choice.label + "?",
      {
        modal: true,
        detail: `${prepared.description}\n\n${prepared.host}\n${prepared.kind} · ${prepared.installationId}\n${prepared.impact}${activity}`,
      },
      button,
    )) !== button
  )
    return;
  b.current();
  await b.run(() => b.client.verifyIdentity());
  verifyPrepared(prepared);
  if (choice.action === "stage") {
    const terminal = vscode.window.createTerminal({
      name: "NetClaw reviewed setup",
      cwd: prepared.root,
      env: Object.fromEntries(
        [
          ...new Set([
            ...Object.keys(process.env),
            ...Object.keys(prepared.env),
          ]),
        ].map((key) => [key, prepared.env[key] ?? null]),
      ),
    });
    terminal.show();
    terminal.sendText(prepared.command, false);
    return;
  }
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "NetClaw · " + choice.label,
      cancellable: false,
    },
    (progress) =>
      executeSetup(prepared, {
        guard: async () => {
          b.current();
          await b.run(() => b.client.verifyIdentity());
        },
        progress: (message) => progress.report({ message }),
      }),
  );
  b.current();
  await vscode.window.showInformationMessage(result.message);
}
