import * as vscode from "vscode";
import { Connection } from "../connection/connect";
import { Json } from "../client/hud";
export async function configureSettings(connection: Connection) {
  const choice = await vscode.window.showQuickPick(
    [
      "Replace an environment setting",
      "Configure token budget",
      "Choose model for a new Chat",
    ],
    { title: "Existing NetClaw settings" },
  );
  if (choice === "Replace an environment setting")
    return environment(connection);
  if (choice === "Choose model for a new Chat") {
    await vscode.commands.executeCommand("netclaw.openChat");
    void vscode.window.showInformationMessage(
      "Use “New with model settings” in Chat to choose from this runtime’s supported models.",
    );
  }
  if (choice !== "Configure token budget") return;
  const b = connection.bound(),
    before = await b.run(() => b.client.request("GET", "/api/budget/config"));
  const field = await vscode.window.showQuickPick(
    [
      "sessionBudgetUsd",
      "maxToolCallsPerTurn",
      "contextWarningTokens",
      "overrideIncrementUsd",
    ],
    { title: "Budget field" },
  );
  if (!field) return;
  const input = await vscode.window.showInputBox({
    title: field,
    value: String(before.budget?.[field] ?? ""),
    validateInput: (v) =>
      v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0
        ? undefined
        : "Enter a nonnegative number",
  });
  if (input === undefined) return;
  if (
    (await vscode.window.showInformationMessage(
      `Set ${field} to ${input}?`,
      {
        modal: true,
        detail: `Installation: ${connection.identity?.installationId}\nExisting: ${before.budget?.[field] ?? "unset"}\nExisting NetClaw validation and enforcement apply.`,
      },
      "Apply",
    )) !== "Apply"
  )
    return;
  b.current();
  const current = await b.run(() =>
    b.client.request("GET", "/api/budget/config"),
  );
  if (JSON.stringify(current) !== JSON.stringify(before))
    throw Error("Budget changed during review. Reopen the form.");
  await b.run(() => b.client.verifyIdentity());
  await b.run(() =>
    b.client.request("PUT", "/api/budget/config", {
      budget: { [field]: Number(input) },
    }),
  );
  const after = await b.run(() =>
    b.client.request("GET", "/api/budget/config"),
  );
  if (after.budget?.[field] !== Number(input))
    throw Error(
      "Budget response did not verify the requested value. Inspect Settings.",
    );
  void vscode.window.showInformationMessage("Budget setting verified.");
}
export async function environment(
  connection: Connection,
  integrationId?: string,
) {
  const b = connection.bound(),
    inventory = await b.run(() =>
      b.client.request("GET", "/api/hud/configuration"),
    );
  const integration = integrationId
    ? {
        integration: inventory.integrations?.find(
          (i: Json) => i.id === integrationId,
        ),
      }
    : await vscode.window.showQuickPick<
        vscode.QuickPickItem & { integration: Json }
      >(
        (inventory.integrations || []).map((i: Json) => ({
          label: i.id,
          description: i.notes,
          integration: i,
        })),
        { title: "Environment integration" },
      );
  if (!integration) return;
  const value = (integration as { integration: Json }).integration;
  if (!value)
    throw Error(
      "The selected integration is no longer in the HUD environment inventory.",
    );
  if (!value.fields?.length) {
    void vscode.window.showInformationMessage(
      "This integration has no environment fields reported by the HUD.",
    );
    return;
  }
  const field = await vscode.window.showQuickPick<vscode.QuickPickItem>(
    (value.fields || []).map((f: Json) => ({
      label: f.key,
      description: f.isSet ? "Currently set" : "Unset",
    })),
    { title: "Setting to replace" },
  );
  if (!field) return;
  const key = (field as { label: string }).label;
  const shared = (inventory.integrations || [])
    .filter(
      (i: Json) =>
        i.id !== value.id && i.fields?.some((f: Json) => f.key === key),
    )
    .map((i: Json) => i.id);
  const replacement = await vscode.window.showInputBox({
    title: `New ${key}`,
    password: true,
    prompt:
      "The existing value is never read. Empty input clears this setting.",
  });
  if (replacement === undefined) return;
  if (
    (await vscode.window.showWarningMessage(
      `${replacement ? "Replace" : "Clear"} ${key}?`,
      {
        modal: true,
        detail: `Installation: ${connection.identity?.installationId}\nSource: ${inventory.environmentFile}\nIntegration: ${value.id}\n${shared.length ? "Also used by: " + shared.join(", ") + "\n" : ""}Only this field is sent to the existing environment writer. Some changes take effect after a separately requested restart. This API has no atomic revision precondition.`,
      },
      "Apply",
    )) !== "Apply"
  )
    return;
  b.current();
  await b.run(() => b.client.verifyIdentity());
  await b.run(() =>
    b.client.request("PUT", "/api/env", { updates: { [key]: replacement } }),
  );
  const after = await b.run(() =>
    b.client.request("GET", "/api/hud/configuration"),
  );
  const observed = after.integrations
    ?.flatMap((i: Json) => i.fields || [])
    .find((f: Json) => f.key === key);
  if (!observed || observed.isSet !== Boolean(replacement))
    throw Error(
      "Setting presence did not verify. Review existing NetClaw configuration.",
    );
  void vscode.window.showInformationMessage(
    `${key}: existing NetClaw accepted the update; ${observed.isSet ? "set" : "unset"} verified. Secret values remain hidden.`,
  );
}
