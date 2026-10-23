import fs from "node:fs";
import path from "node:path";
export const shellQuote = (value: string) =>
  `'${value.replaceAll("'", "'\\''")}'`;
export const serviceActions = [
  "HUD status",
  "Start HUD in foreground",
  "Federation status",
  "Start federation",
  "Stop federation",
  "Restart federation",
] as const;
export function serviceCommand(
  root: string,
  home: string,
  kind: "openclaw" | "hermes",
  id: string,
  action: string,
): string {
  if (
    !path.isAbsolute(root) ||
    !path.isAbsolute(home) ||
    /[\r\n\0]/.test(root + home)
  )
    throw Error("Select absolute host-local paths.");
  const file = path.join(home, "netclaw-hud/installation.json"),
    stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192)
    throw Error("Existing installation identity unavailable.");
  if (JSON.parse(fs.readFileSync(file, "utf8")).installationId !== id)
    throw Error("Selected home belongs to a different installation.");
  const hud = action.startsWith("HUD") || action === "Start HUD in foreground";
  const script = path.join(
    root,
    "scripts",
    hud ? "hud-launch.mjs" : "federation-control.py",
  );
  if (!fs.statSync(script).isFile() || !serviceActions.includes(action as any))
    throw Error("Select an existing NetClaw checkout and supported action.");
  const env = [
    "env",
    "-u",
    "OPENCLAW_CONFIG_PATH",
    "-u",
    "OPENCLAW_STATE_DIR",
    "-u",
    "OPENCLAW_HOME",
    "-u",
    "HERMES_HOME",
    `NETCLAW_RUNTIME=${kind}`,
    `${kind === "hermes" ? "HERMES_HOME" : "OPENCLAW_HOME"}=${home}`,
    ...(kind === "openclaw"
      ? [
          `OPENCLAW_STATE_DIR=${home}`,
          `OPENCLAW_CONFIG_PATH=${path.join(home, "openclaw.json")}`,
        ]
      : []),
  ];
  const verb = action.toLowerCase().includes("status")
    ? "status"
    : action.split(" ")[0]!.toLowerCase();
  return [
    ...env,
    hud ? "node" : "python3",
    script,
    verb,
    ...(hud ? ["--runtime", kind, "--home", home] : []),
  ]
    .map(shellQuote)
    .join(" ");
}
