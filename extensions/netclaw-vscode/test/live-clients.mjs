/** Opt-in provider-backed named-client check. Uses an isolated unchanged HUD and synthetic gateway. */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { realHud } from "./real-hud-fixture.mjs";
if (process.env.NETCLAW_TEST_LIVE_CLIENTS !== "1")
  throw Error(
    "Explicit opt-in required for authenticated assistant/provider calls.",
  );
const client = process.env.NETCLAW_TEST_CLIENT;
if (!["codex", "claude-code"].includes(client))
  throw Error("Select codex or claude-code.");
const f = await realHud(),
  file = path.join(f.root, "registration.json");
fs.writeFileSync(
  file,
  JSON.stringify({
    id: "named-client",
    client,
    installationId: f.installationId,
    url: f.url,
    enabled: true,
    delegate: true,
  }),
  { mode: 0o600 },
);
const launch = {
    command: process.execPath,
    args: [path.resolve("dist/assistant.mjs"), "--registration", file],
  },
  tools = [
    "netclaw_status",
    "netclaw_inspect",
    "netclaw_propose_change",
    "netclaw_request",
    "netclaw_request_status",
  ];
const prompt =
  'Authorized synthetic NetClaw acceptance check. Use only the netclaw_acceptance MCP tools, no other tools. Call netclaw_status, then netclaw_inspect kind overview, then netclaw_propose_change domain budget summary "Consider a smaller budget; do not apply anything". Then call netclaw_request requestId "named-client-once" prompt "Reply with a short greeting only; do not call tools or change anything". Call netclaw_request_status with that same ID. Report actual results briefly. The target is an isolated fixture, not the owner installation. Do not simulate calls.';
let args;
if (client === "claude-code") {
  const config = path.join(f.root, "mcp.json");
  fs.writeFileSync(
    config,
    JSON.stringify({ mcpServers: { netclaw_acceptance: launch } }),
    { mode: 0o600 },
  );
  args = [
    "-p",
    "--restricted",
    "--tools",
    "",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--mcp-config",
    config,
    "--setting-sources",
    "",
    "--no-session-persistence",
    "--max-budget-usd",
    "0.50",
    "--output-format",
    "stream-json",
    "--verbose",
    "--allowedTools",
    tools.map((t) => "mcp__netclaw_acceptance__" + t).join(","),
  ];
} else {
  args = [
    "exec",
    "--ignore-user-config",
    "--ignore-rules",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--json",
    "-c",
    'web_search="disabled"',
  ];
  for (const feature of [
    "shell_tool",
    "apps",
    "plugins",
    "hooks",
    "multi_agent",
    "multi_agent_v2",
    "browser_use",
    "computer_use",
    "image_generation",
    "memories",
    "workspace_dependencies",
  ])
    args.push("--disable", feature);
  args.push(
    "-c",
    "features.skip_host_skill_discovery=true",
    "-c",
    `mcp_servers.netclaw_acceptance.command=${JSON.stringify(launch.command)}`,
    "-c",
    `mcp_servers.netclaw_acceptance.args=${JSON.stringify(launch.args)}`,
    "-c",
    "mcp_servers.netclaw_acceptance.required=true",
    "-",
  );
}
try {
  const execution = await new Promise((resolve) => {
    const child = spawn(client === "codex" ? "codex" : "claude", args, {
      cwd: f.root,
      env: { ...process.env, DISABLE_TELEMETRY: "1" },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    let output = "",
      diagnostics = "",
      timedOut = false;
    const stop = () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, 150000);
    child.stdout.on("data", (b) => {
      output += b;
      if (output.length > 4 * 1024 * 1024) stop();
    });
    child.stderr.on("data", (b) => {
      diagnostics += b;
      if (diagnostics.length > 1024 * 1024) stop();
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ exit: null, output: "", timedOut });
    });
    child.on("close", (exit) => {
      clearTimeout(timer);
      resolve({ exit, output, timedOut });
    });
    child.stdin.end(prompt);
  });
  const events = execution.output.split("\n").flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return [];
    }
  });
  const calls = events.flatMap((e) =>
    e.item?.type === "mcp_tool_call"
      ? [
          {
            name: e.item.tool,
            status: e.item.status,
            error: Boolean(e.item.error),
          },
        ]
      : e.type === "assistant"
        ? (e.message?.content || [])
            .filter((b) => b.type === "tool_use")
            .map((b) => ({ name: b.name, status: "called" }))
        : [],
  );
  const names = [
    ...new Set(
      calls.map((c) =>
        c.name
          .replace(/^mcp__netclaw_acceptance__/, "")
          .replace(/^mcp__netclaw_acceptance\./, ""),
      ),
    ),
  ];
  const states = fs
    .readdirSync(path.join(f.root, "named-client"))
    .filter((n) => n.endsWith(".json"))
    .map((n) =>
      JSON.parse(fs.readFileSync(path.join(f.root, "named-client", n), "utf8")),
    );
  const result = {
    client,
    exit: execution.exit,
    timedOut: execution.timedOut,
    tools: names,
    allExpected: tools.every((t) => names.includes(t)),
    outcomes: events.flatMap((e) =>
      e.item?.type === "mcp_tool_call" && e.item.status !== "in_progress"
        ? [
            {
              tool: e.item.tool,
              status: e.item.status,
              error: e.item.error,
              result: e.item.result,
            },
          ]
        : [],
    ),
    inertDrafts: states.find((s) => s.key === "proposals")?.value.length || 0,
    syntheticGatewayCalls: f.calls.length,
    requestState: states.find((s) => s.key === "request.named-client-once")
      ?.value.conversation.state,
    usage:
      events.findLast((e) => e.type === "turn.completed")?.usage ||
      events.findLast((e) => e.type === "result")?.usage,
    costUsd: events.findLast((e) => e.type === "result")?.total_cost_usd,
    scope:
      "Actual named assistant and provider, unchanged HUD, synthetic NetClaw gateway. No real NetClaw provider or device execution.",
    root: f.root,
  };
  fs.writeFileSync(
    path.join(f.root, "named-client-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
  if (
    result.exit !== 0 ||
    !result.allExpected ||
    result.inertDrafts !== 1 ||
    result.syntheticGatewayCalls !== 1 ||
    result.requestState !== "completed"
  )
    process.exitCode = 1;
} finally {
  fs.writeFileSync(file, JSON.stringify({ enabled: false }), { mode: 0o600 });
  await f.close();
}
