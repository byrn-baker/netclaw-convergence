# Verification — Spec151

Status: local source implementation and acceptance complete on 2026-10-11. All36 tasks complete;42/42 requirements mapped. Distribution remains held. This is Mac source qualification, not a packaged release or live security-enforcement certification.

## Boundary and reference host

Mac arm64; Node24.19.0; VS Code1.102.0; branch `151-extension-experience`, based on merged Spec150/PR293. Tests use copied source HUDs, private temporary runtime homes, synthetic credentials/data and isolated editor profiles. No owner runtime, credential, provider, network device or live security perimeter was changed.

The checkout initially lacked extension dependencies; `npm ci --ignore-scripts --no-audit --no-fund` restored its lockfile (164 packages). Source build precedes bundled transport tests. No new dependency, MCP registration or installer catalog component was added. `.env.example` documents an already-supported GAIT_VENV selection. Ignore rules retain local dependencies, builds, secrets, audit state and memory outside source changes.

## Automated acceptance

| Check | Result | Evidence |
| --- | --- | --- |
| Extension TypeScript and source bundle | PASS (`npm run check`, `npm run build`) | Build includes local art and Three.js; no VSIX |
| Extension tests |40 passed,0 failed,1 optional skip (41 total) | [test log](evidence/extension-tests.txt) |
| HUD document/configuration contracts |9 passed,0 failed | [test log](evidence/hud-experience-tests.txt) |
| Existing HUD regression suite |372 passed,0 failed | [test log](evidence/hud-regression-tests.txt) |
| Canonical registration, installer follow-ups and Hermes preservation |39 passed,0 failed | [test log](evidence/installer-tests.txt) |
| Catalog coherence |111 components,124 registered servers,52 external integrations; zero unexplained gaps | [coverage](evidence/catalog-coverage.txt) |
| Actual isolated pyATS and GAIT installation |Both verified by imports in their isolated runtime homes | [operation results](evidence/isolated-runtime-installs.json) |
| Desktop regression |PASS; Chat to synthetic gateway, Canvas save/open, Avatar, RAG panel and actual bundled assistant MCP launch/disable | [report](evidence/editor-regression.json) |
| Full experience desktop matrix |PASS;149 recorded rows,32 domain/state/view-family labels | [report](evidence/editor-experience.json) |

The skipped extension test requires explicitly configured cached RAG embeddings. The integrated RAG view and unavailable state were exercised; this run does not claim new live embedding/provider or named-assistant inference qualification. The desktop regression report's historical “unchanged HUD” wording was corrected to “source HUD”: tests copy the current worktree while checking existing behavior.

Testbed coverage includes guided CRUD, advanced YAML, comments/anchors/unknown fields, scalar secret masking, path/revision-bound keep tokens, YAML/JSON merge and replacement, multi-connection CSV, invalid/oversized/ambiguous input, revision conflicts, active-session refusal, consent/login revocation, private recovery and simulated write faults. Exports use atomic owner-only writes and reject paths/symlinks/hardlinks aliasing the active inventory. HTTP acceptance checks installation headers and existing authority.

MCP coverage includes metadata/alias coverage, confidential unknown fields, keep/replace/clear, shared-field review, unrelated env preservation and exact private readback. Setup tests use the actual canonical registration helper and owned N2N process restart with a different PID, correct identity and no peer/provider execution. Separate isolated pyATS/GAIT installs ran the actual installers. Target/config/helper changes, cancellation, malformed/interrupted evidence, helper refusal and unknown post-execution outcomes are covered. Broader installers are staged without Enter; unsupported lifecycle/Hermes registration remains explicit guidance.

Security acceptance comprises five native-process adapter tests and two DOM tests, included in the extension total, plus actual VS Code binding/review dialogs for both products. It verifies allow/settings edits, OpenShell network preservation, protected values, reported-scope mismatch, unsupported/global/oversized policies, stale review, cancellation, weakening acknowledgment, private originals, serialization, malformed evidence and unknown-outcome no-replay. These are isolated CLI contract fixtures based on pinned upstream research, **not installed vendor services or live enforcement tests**. Neither vendor CLI was available on this host. See [source research](research-security.md).

## Visual and interaction review

The native experience run used actual webviews with360/700/1200 CSS-pixel widths, VS Code light/dark/high-contrast themes,200% zoom, keyboard focus/Tab and representative keyboard form submissions, plus reduced-motion emulation. It covered all21 generic navigation domains, testbed cards/YAML, MCP fields, populated topology, both bound security pages and Chat/Canvas/RAG/Avatar. Width checks found no document overflow; forms/drafts survived theme and mode changes. This is recorded interaction coverage, not a full assistive-technology certification.

- 500-entry integration search rendered in **2.9ms after the80ms debounce** on this host, below the250ms target.
- Repeated BGP graph refresh retained one canvas and current selection; node labels, zoom/reset and WebGL-context-loss text fallback passed. Edges use reported sessions only; physical links are not inferred.
- Native testbed create and scoped MCP credential replacement produced verified isolated saves. Cancellation preserved data; connection invalidation cleared sensitive drafts.
- Native security binding named each shared scope. Cancellation preserved exact fixture files; a second review required the weakening acknowledgment and verified the intended changes. Redacted before/after content was visible before apply.
- 42 captured screenshots accompany the matrix. Overview, graph, responsive special views, security forms and reviews were visually inspected. Examples: [Overview](evidence/domain-overview.png), [testbed](evidence/testbed-cards.png), [MCP](evidence/mcp-fields-light.png), [BGP](evidence/topology-3d.png), [DefenseClaw review](evidence/defenseclaw-review.png), [OpenShell form](evidence/openshell-forms.png).

All discovered design and implementation findings were resolved and rechecked; see [analysis](analysis.md). Initial acceptance failures due to fixture canonical paths/JSON string encoding, missing mocked message-state APIs and an asynchronous native-dialog button transition were corrected in fixtures. No approval or identity protections were removed to pass tests.

## Local preview handoff

The latest source extension is open in a disposable VS Code window titled **NetClaw — Spec151 local preview**, using a synthetic local studio. Both security pages have isolated CLI fixture bindings, so their controls can be explored without configuring a real perimeter. Overview opens by default; its actions lead to Testbed and MCP integrations. The separate Spec150 installed-VSIX preview was not repackaged.

Host-local metadata: `/tmp/netclaw-spec151-source-preview.json`. It records the editor/profile, temporary HUD, synthetic runtime and security fixtures. Ready state was observed and the rendered Overview inspected. `scripts/preview.mjs` recreates the source preview; see [quickstart](quickstart.md). Closing the window shuts down its fixture processes. These fixtures are demonstrations, not real devices/providers.

## Explicit limits and held actions

Linux, WSL, remote-host, native Windows and packaged-artifact acceptance were not run for Spec151. Older HUDs need its bounded document/configuration routes for the new editors; unsupported paths show guidance rather than using legacy raw writers. Existing Spec150 qualification remains separate.

DefenseClaw requires the supported JSON reader/revision-aware writer and matching reported profile. OpenShell needs base/effective policy reads and a sandbox-owned policy; gateway-global policies remain read-only. OpenShell exposes no atomic revision precondition, so an external writer can race the immediate precheck despite this client's serialization. Runtime status, saved/loaded policy and tested traffic enforcement remain distinct. No lifecycle/quarantine or whole-perimeter disable was added.

No packaging, push, PR creation, live deployment, Marketplace/release or blog publication occurred. The existing Spec150 VSIX remains unchanged, SHA256 `b13bdfe68c4086bd22edb7521d87443837127f1c70addae08e302b352725c6b8`. The milestone post is a local draft only. GAIT and daily notes record development and the final handoff; no production CR was required because acceptance never targeted production.

## Subsequent merge authorization

The no-push/no-PR statements above describe the completed local implementation checkpoint. The owner subsequently authorized committing, pushing, creating a PR and merging it into main. See [merge readiness](merge-readiness.md) for that phase; no package, release or runtime deployment is included.
