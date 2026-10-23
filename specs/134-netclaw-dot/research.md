# Research and decisions — checked 2026-09-29

These official pages were fetched, not merely inferred from search snippets. Recheck at implementation because rollout and schemas can change.

| Source | Finding and implication |
|---|---|
| [Introducing dots](https://openai.com/index/introducing-dots/) | Dots offer cloud computers, plugins and optional computer connections. Rollout/account access is gated. Specialist Dots are enterprise pilots. This supports an integration hypothesis, not a NetClaw conversion API. |
| [Build plugins](https://learn.chatgpt.com/docs/build-plugins) | Package workflows and connected capabilities; obtain current authoring/registration details before creating manifests. |
| [Plugin management](https://learn.chatgpt.com/docs/enterprise/plugin-management) | Imported MCP declarations cause desktop-only classification even for remote URLs; existing registered apps have a separate reference mechanism. Do not assume uploaded MCP config works everywhere. |
| [MCP](https://learn.chatgpt.com/docs/extend/mcp) | Local Codex hosts support stdio and HTTP; hosted plugin capabilities may differ. Local MCP support is not proof of Dot support. |
| [Remote connections](https://learn.chatgpt.com/docs/remote-connections) | Remote work uses the connected host's environment and permissions. Establish the actual supported host path rather than assuming a Linux daemon is a Dot computer. |

Decision D1: preserve existing executor and ship a bounded read facade; rewriting orchestration adds risk without proving Dot compatibility.
D2: synthetic-first; local hosting alone does not prevent hosted inference from seeing returned data.
D3: no public HUD or native gateway exposure; generic chat/tool proxies could reach write tools and violate scope.
D4: no claim of Sonnet inside Dots; Sonnet builds the integration.

Open questions: owner account access; Dot-to-local tool behavior; delegated task versus direct Dot tool; desktop-offline behavior; registered app requirements; exact authentication mapping; non-sensitive output classification. Capture actual UI/version/tool results in verification. No unsupported API/manifest names should be guessed.
