# Mac recovery verification — 2026-10-11

Historical original-candidate evidence below is preserved. Final implementation,
replacement package and Mac qualification are recorded in [mac-final.md](mac-final.md).
Publication is held by the owner; this historical document does not authorize it.

Baseline: NetClaw 1.8.0, unchanged source f943637. macOS arm64, isolated Node
24.19.0. All tests use isolated fixture homes and allocated loopback ports.
The owner NetClaw was neither restarted nor upgraded; no device configuration or
real NetClaw provider request was made. Named assistant provider calls are reported
separately in assistants.md.

## Passed

- TypeScript check, esbuild bundle and source formatting validation.
- 16 normal tests passed; one opt-in RAG test skipped in the default suite, then
  passed separately with an isolated Python environment and cached local embeddings.
- Actual unchanged HUD process: bound identity, own session and chat/history,
  cross-session denial, 11 domain reads, masked environment replacement/presence,
  budget preservation/result verification, unknown outcome/no replay and revocation.
- Unchanged Hermes route/binding modules with controlled runtime: owned admission,
  foreign request denial, nonce lookup, status, stop and unknown/no replay. This
  is not live Hermes provider acceptance.
- Official MCP stdio: real bundled process, five-tool surface, denied apply/unknown
  arguments, inert proposals, completed synthetic delegation, deduplication and
  disable enforcement. Shell command staging test verifies literal hostile-path
  quoting and rejects a mismatched installation home.
- Actual VS Code 1.102 and 1.141: activation, profile persistence, identity mismatch,
  domain rendering in dark/light/high contrast, Chat -> unchanged HUD -> synthetic
  gateway reply, Canvas branching, local Avatar, target-switch invalidation.
- Exact VS Code MCP discovery definition launched the adapter under its Electron
  executable and observed disabled registration through the cached connection.
- VS Code 1.141 additionally rendered actual RAG search results and citations after
  indexing a fixture document with the unchanged RAG MCP/local embedding stack.
- Logo SHA-256 equals `mobile/netclaw-mobile/assets/icon/icon.png`:
  `538b75ef25dd7005b79ac5d81214f23c341c3abd6a2019bcfcfa68629e0115f0`.
- Marketplace publisher authentication reverified successfully locally. No token
  was read/exported and nothing was published.

Private editor evidence directories (under the Mac temporary directory):
`netclaw150-client-editor-Iq6ScM` (1.102 MCP/editor),
`netclaw150-client-editor-DigDub` (1.141 MCP/editor/RAG).
Chat/Avatar/RAG screenshots were visually inspected. Earlier failed fixture checks
caught and corrected client environment inventory lookup, unknown-state button
handling, and explicit RAG filename/title mapping. The RAG Python shim was corrected
to preserve the isolated interpreter environment; no base RAG rewrite was needed.

## Release gates

Packaged lifecycle and artifact digest are recorded in package.md after packaging.
Real Windows/WSL, Remote SSH/native Linux observations, real installation/provider
checks and interactive Copilot/Codex consent remain distinct from these Mac fixture
results. See windows-wsl-handoff.md. No synthetic result is production acceptance.

Portable sanitized editor, named-client and VSIX lifecycle reports are committed
beside this file. Selected actual fixture screenshots are in screenshots/.
