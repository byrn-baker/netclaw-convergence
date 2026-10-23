import * as vscode from "vscode";
import { Connection } from "../connection/connect";
import { serviceActions, serviceCommand } from "../client/commands";
export async function prepareService(connection: Connection) {
  const b = connection.bound();
  const root = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select existing NetClaw checkout",
  });
  if (!root?.[0]) return;
  const home = await vscode.window.showInputBox({
    title: "Existing runtime home",
    prompt:
      "Absolute home of the connected installation. Its saved identity will be checked.",
  });
  if (!home) return;
  const action = await vscode.window.showQuickPick([...serviceActions], {
    title: "Prepare an existing NetClaw service command",
  });
  if (!action) return;
  b.current();
  await b.run(() => b.client.verifyIdentity());
  const command = serviceCommand(
    root[0].fsPath,
    home,
    connection.identity!.kind,
    connection.identity!.installationId,
    action,
  );
  const doc = await vscode.workspace.openTextDocument({
    language: "shellscript",
    content: `# ${action}\n# Installation: ${connection.identity!.installationId}\n# ${home}\n# Requires the existing supported Node/Python environment on this host.\n# This command uses existing NetClaw lifecycle and PID ownership checks.\n# Start/stop/restart can interrupt work; inspect status and follow your change policy.\n# The extension has not executed it. Foreground HUD stops with Ctrl+C.\n${command}\n`,
  });
  await vscode.window.showTextDocument(doc, { preview: false });
  if (
    (await vscode.window.showInformationMessage(
      "Place this reviewed command in a new terminal?",
      {
        modal: true,
        detail:
          "It will be staged without pressing Enter. You execute it and inspect the actual result.",
      },
      "Stage command",
    )) !== "Stage command"
  )
    return;
  b.current();
  const terminal = vscode.window.createTerminal({
    name: "NetClaw · " + action,
  });
  terminal.show();
  terminal.sendText(command, false);
}
