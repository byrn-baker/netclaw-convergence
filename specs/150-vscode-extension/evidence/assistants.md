# Assistant recovery evidence — macOS, 2026-10-11

The earlier expanded-backend branch's assistant evidence does not qualify this
replacement client. No owner NetClaw, credential migration or persistent owner
MCP registration was used by these tests.

- Official SDK 2.3.1 stdio: actual bundled adapter against unchanged HUD; five-tool
  allowlist, owned request, stable-ID duplicate prevention, inert draft, malformed
  arguments/unknown apply-tool refusal, cached registration disable: passed.
- Actual VS Code 1.102: extension discovery definition launched the bundled adapter
  using its real Electron executable; installation status matched and disabling
  its local test registration refused a subsequent cached-client call: passed.
  This verifies native definition/transport, not Copilot model inference.
- Claude Code (existing authenticated client/provider): all five tools were actually
  invoked; one inert draft and one completed request through the unchanged HUD to
  a synthetic local gateway. Cost reported by client: USD 0.0279762. Passed.
  Private report: `netclaw150-unchanged-hud-8k5i69/named-client-result.json` under
  the Mac session's temporary directory.
- Codex (existing authenticated client/provider): status, inspection and inert
  draft succeeded. Delegation was refused by the client's approval policy:
  `MCP tool call requires approval, but approval policy is never`.
  No gateway request ran; status correctly reported no owned submitted request.
  Repeated diagnostic run confirmed the same reason. The test is not full
  delegation acceptance. No approval settings were weakened to force a pass.
  Private report: `netclaw150-unchanged-hud-ItKPPS/named-client-result.json`.
- Copilot: signed-in VS Code 1.108 development window opened with this extension
  and a synthetic workspace. Native automation returned inconsistent accessibility
  state/input behavior before registration. Closed the temporary window and stopped
  the fixture; the owner window remained. **No new Copilot inference acceptance**.

Final WSL validation must use interactive Copilot and Codex consent and verify
inspection, inert proposals, delegation/status, disabled access and unchanged
unrelated registrations. The extension must never approve its own backend changes.
Claude Code's successful Mac result is actual external-client/provider evidence;
its NetClaw gateway was synthetic. No result here proves real network-tool execution.

Reproduce bounded fixture checks from the extension directory:

```sh
NETCLAW_TEST_LIVE_CLIENTS=1 NETCLAW_TEST_CLIENT=claude-code node test/live-clients.mjs
NETCLAW_TEST_LIVE_CLIENTS=1 NETCLAW_TEST_CLIENT=codex node test/live-clients.mjs
```

The second command intentionally fails the full acceptance assertion if interactive
consent is unavailable. Use the interactive WSL workflow instead of changing the
owner's policy. CLI registration and per-tool consent are separate concerns; see
[official Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
