## Function-first HUD with preserved Canvas

The HUD previously opened on the 3D scene and scattered operational controls across
utilities. It now opens on source-attributed panels with Basic/Advanced presentation,
while retaining the complete branching Canvas and keeping its iframe mounted across
navigation. The existing IndexedDB schema/session gate and classic entry remain.

Adds exact-task Jev assessment details, original/reconsideration comparison and
cookie-owned read access; RAG uploads/retrieval/citations; masked configuration;
Claw MCP/model drill-downs and content-free authenticated member reports; Tokenomics;
fixed-source service logs; a local Documentation reader with CLI/MCP references and
HUD OpenAPI route inventory; and early LAB/production visibility with separate
DefenseClaw, OpenShell, host-confinement and audit panels. README leads with the new
HUD and includes Sean Mahoney's community guide panel/link.

`scripts/upgrade-hud.sh --check` validates an existing checkout;
`--apply` regenerates references and builds the four entry points. Optional
`--install-deps` uses the lockfile. It does not pull Git, restart services, alter
security/configuration or migrate browser storage. The general upgrade utility
remains separate planned work.

## Validation

- HUD: 278/280 tests pass locally; two existing HTTP/WebSocket integration tests
  cannot bind a loopback socket under this sandbox (`listen EPERM`). CI must run them.
- Federation inventory/member/risk/posture: 42 tests pass.
- Scoped upgrade helper: two tests pass; actual check and apply/build pass.
- Four-entry production build, spec-artifact/catalogue coverage, syntax/whitespace,
  local guide links and OpenAPI route/parameter coherence pass.
- Production DOM checks cover Canvas retention, RAG multipart/pending/search,
  citations, MCP/model selection, Tokenomics, Logs handoff and Security navigation.
  Portable preview DOM harness passes with clearly synthetic operational records.
- Earlier Jev core/env/read/border/installer/adoption verification: 81 tests pass.

## Remaining acceptance and limits

Live browser/responsive/WebGL, installed gateway/Jev envelopes, real RAG ingestion,
updated member reconnect, usage/log/security probes and native Linux/WSL/mobile
acceptance are still pending. CLI wrappers without proven Jev tool-result binding
remain unbound. Recorded usage has bounded-file/missing-field coverage and is not a
billing invoice. Static CLI/MCP references do not replace installed help/tools-list;
legacy OpenAPI payload schemas are not fully typed. Existing Three.js chunk-size
warning remains. No deployment, live configuration change, paid call or restart was
performed. See verification.md for evidence and continuation.md for the release state.
