# Spec151 visual and presentation research

Research date: 2026-10-11. Scope: source inspection and proposed design only. No source implementation, live service access, browser interaction, packaging or distribution was performed for this research. The owner selected theme following, guided testbed forms plus advanced YAML, YAML/JSON/CSV interchange, confirmed supported MCP setup execution, and branded imagery with purposeful interactive 3D.

## Decision: build a shared workbench presentation, with explicit domain adapters

**Decision.** Keep native VS Code navigation, commands and review dialogs. Give every extension webview the same theme-aware shell and reusable semantic cards, fields, notices, toolbars and source details. Replace default recursive data rendering with named domain presentations. Retain a bounded, scrubbed source-record disclosure as secondary detail where useful.

**Rationale.** The current `src/client/domains.ts` defines 22 inspection domains. Every one passes through `openDataView` in `src/webview/bridge.ts` and the recursive nested-definition-list renderer in `resources/data.js`. CSS alone cannot fix the resulting organization: a person needs "Configured model", "Session state" and "Setup available", not a recursive tree of API property names. `panel.ts` separately generates nearly the same shell for Chat, Avatar, RAG and Canvas. Unifying shell markup avoids two inconsistent visual systems while retaining existing message validation and installation binding.

**Alternatives considered.** A CSS-only reskin leaves the main problem intact. Adopting Microsoft Adaptive Cards adds a second component/schema platform without a functional need; the owner asked for its visual qualities. Replacing every surface with React is unnecessary; the existing imperative DOM views can share small utilities, while Avatar continues using its existing React/Three.js bundle. Importing the HUD dashboard whole would import unrelated routing/state/security assumptions and exceed the extension-focused scope.

### Shared composition and tokens

- Page header: short eyebrow, one 28–34 px semibold title, one concise purpose sentence, primary action and optional secondary action group. Avoid technical identity strings as the main description.
- Connection context: a compact band with connection nickname, runtime badge and observation state. Put the full installation ID, host locality, source endpoint and timestamps in a clearly titled expandable "Connection and source" section. Important unknown/stale/failure state remains visible outside disclosure.
- Overview hero: "Your network workbench" or selected connection name with a concise description such as "Explore your devices, connect tools and work with your selected NetClaw." A separate runtime card reports exactly what `/api/runtime` returned. `readiness.ready` must never be relabeled as verified tool execution; `executionVerified: false` stays meaningful.
- Card anatomy: icon/accent or small illustration, eyebrow/category, title, one- or two-line description, status badge, a short explicit fact group, then a visible action footer. No entire clickable card containing nested competing actions; use real buttons/links.
- Surface tokens: `--nc-surface`, `--nc-surface-raised`, `--nc-border`, `--nc-text`, `--nc-muted`, `--nc-primary`, `--nc-accent-cyan`, `--nc-accent-pink`, `--nc-focus`, `--nc-danger`. Derive base values from `--vscode-*` variables, with light/dark/high-contrast accent variants. Keep the existing VS Code blue primary-button family. Pink/cyan accents support headings, thin card rules and icon backgrounds; they do not replace status semantics.
- Typography: retain the local VS Code/system font family, with deliberate title/section/body/metadata scale and a readable 1.5 line height. Use the editor monospace family only for addresses, code, IDs and YAML. Do not add remote fonts or text embedded in images.
- Spacing: consistent 4/8/12/16/24/32 px rhythm; 12–16 px card radius; 20–24 px card inset at large widths and 16 px on narrow views. Title-to-description and label-to-help spacing should be deliberate, rather than long unstructured paragraphs.
- Controls: persistent labels; optional/required indication where useful; examples below fields; 38–42 px minimum ordinary control height; 8–10 px radius; explicit invalid/disabled states; explanatory validation tied with `aria-describedby`; primary, secondary, quiet and destructive styles. Never rely on placeholder text as the label.
- Card grid: `repeat(auto-fit, minmax(min(100%, 280px), 1fr))`, with single-column fallback and `min-width: 0` on all flex/grid children. Dense rows/tables remain appropriate for logs, route entries and numeric comparisons. Long names/addresses wrap. A 360 px editor must not inherit a fixed 300 px component plus large side padding that clips it.
- State: consistent loading notice, no-result state, empty observation, unavailable, failed, stale and invalidated presentations. A blank list does not become "All good". Present explanations and a relevant next action; do not put controls behind a decorative hero or force tall imagery onto narrow views.
- Motion: short opacity/border transitions only; no perpetual card animation, spinning logo or automatic graph rotation. Disable decorative transitions under reduced motion. Theme changes alter CSS and scene materials without destroying DOM, drafts, filter values or selection.

The AYN reference is already documented in `discovery.md`: bold hierarchy, dark outlined cards, pink/cyan accents, compact tracked labels and a contained globe. Apply those qualities to the active VS Code theme rather than copying the website's fixed dark background, visitor tracking or content.

## Decision: map every domain to a meaningful primary presentation

**Decision.** Add explicit adapters keyed by the existing domain ID. Use a small shared card/section model only after the domain adapter has selected and labeled meaningful fields. Never select "the first array" or automatically turn every property into a top-level card. Preserve all currently inspectable data in bounded source details, after the existing secret scrubber.

**Rationale.** Payloads are different domains, not interchangeable collections. Some adapters receive projected `/api/n2n` fields, others receive the full response, and direct log/Intent/peer-reply views bypass `inspect()`'s outer observation envelope. Treating all those objects the same currently exposes implementation structure. Named adapters can preserve truth while making the useful information legible.

| Existing domain / surface | Primary presentation | Source and state cautions |
|---|---|---|
| `overview` | Connection hero, selected runtime card, explicit readiness/capability facts, quick actions to Chat, Testbed, MCP integrations and Knowledge | `/api/runtime`; configured readiness is distinct from execution verification. Do not fabricate aggregate fleet health or device counts without a separate successful source. |
| `estate` | Risk role/mode summary, member cards grouped by role, member identity/runtime and last reported state | Projected `risk`, `members`, `identity`; absent fields are "Not reported". Federation membership is not a physical topology. |
| `peers` | Peer cards: display name/identity, federation/channel state, last seen, inventory presence, clear contextual peer-conversation action | `/api/n2n` peers and posture; cached advertisement is not verified device state. |
| `mobile` | Edge-node cards and separate recent-push activity list | Keep node observation separate from push outcome. A missing collection does not claim no mobiles exist. |
| `science` | Advisor cards: name, role, enabled/configured presence, model/provider if reported, limits and last observation when available | `advisors`; no manufactured agreement/confidence/assessment history. |
| `network` → "Testbed inventory" | Device cards, platform/type/address facts, filter/count bar, Add device / Import / Export / Advanced YAML, target/revision summary | `/api/graph` is currently a lossy inventory projection with slugified IDs, defaulted values and errors collapsed to an empty list. Editing must use the new authoritative document contract, preserve original device keys, and report load failures explicitly. |
| `topology` → "BGP sessions & topology" | Local-speaker card, session-state counts, peer cards or table, optional 3D session graph, expandable RIB routes | `/api/bgp`: `local`, `peers`, `rib`, `ribCount`, `injected`, `kernelRoutes`. It describes the local federation BGP daemon; it is not proof of physical network cabling or full device routing topology. Preserve the source's inferred/configured local values as source claims. |
| `operations` | Pending approvals and replication jobs in distinct sections; action/state/target/time, with detail drawer/disclosure | Current inspection is read-only. Do not turn an approval card into a new approval authority. |
| `gait` | Chronological audit-event cards or compact timeline with event/time/actor/target/outcome and source details | GAIT federation observations, not a promise of the full local audit history. |
| `integrations` | Searchable/filterable MCP cards: name, category, description, installed skill count, setup metadata state, Configure / Setup entry point | `/api/graph.integrations[].active` means related skills exist; do not call it "Online" or "Connected". `toolEstimate` remains an estimate. Join configuration/setup metadata by documented stable ID, not display name. |
| `skills` | Skill title/purpose, integration/category, section preview with expandable instructions | Installed catalogue, not proof the associated service runs. Avoid rendering raw markdown as trusted HTML. |
| `settings` | Provider/model summary, fallback list, runtime capabilities, configured MCP rows, native-runtime action when available | OpenClaw `/api/hud/runtime` exposes `llm`, `mcp_servers` and `controlUi`; Hermes returns a different status shape. Explicit runtime adapters keep missing model/transport information honest. |
| `configuration` | Integration configuration cards grouped by purpose with field counts and set/unset presence, linked to contextual form | `/api/hud/configuration` currently gives key/presence/notes/files only. It does not expose field type, safe current non-secret value or validation schema; metadata upgrades must precede polished forms that claim those details. |
| `tokenomics` | Recorded-usage metrics, model/provider table, coverage note with missing/partial/malformed/skipped counts | `/api/hud/tokenomics.groups`; keep input/output/cache-read/cache-write distinct. Cost is recorded cost, not an invoice; no sum silently treats unknown cost as zero. Hermes may explicitly report this view unavailable. |
| `budget` | Labeled budget limit cards and concise current configuration facts with explicit edit affordance | `/api/budget/config`; retain validated review and post-save checks. Zero is a real value. Do not invent a spending percentage from configuration alone. |
| `security` | Separate configured modes and observed controls; explicit false/unknown values; source explanation | Current `securitySettings` reports merged environment/configuration, which may differ from running daemon enforcement. Hermes has a distinct qualified-read-only status. Never synthesize a green "Secure" badge. |
| `openshell` | Probe cards for gateway/sandbox command, success/unavailable text, timestamp/cache scope, expandable bounded output | Read-only command observations; not a sandbox deployment action. |
| `knowledge` | Collection cards with known counts and kind/status, obvious Open RAG action | `/api/rag/stats`; unknown counts remain unknown. |
| `documentation` | Searchable document library by title/category with path secondary and explicit Open guide action | Fixed catalogue IDs stay the authority for reads; raw source filenames are not user-created routes. |
| `reference` | Separate CLI, API and MCP reference groups, searchable named entries with schema/signature disclosure | `/api/hud/reference`; source signatures are not runtime tool availability. |
| `logs` catalogue and actual log response | Source cards for the catalogue; severity/time/message rows for loaded bounded tails | Distinguish `sources` from `rows`; preserve source scope, truncation and failed-read notices. Logs must not be generic object cards. |
| `intent` endpoint inventory and run result | Endpoint cards for catalogue; request status, change mode, targets, progress/step result sections for a run | Two distinct payload shapes share `intent`. Use an explicit variant or separate view kind. Questions and draft previews authorize no writes. |
| Peer-chat result (`peerChat`) | Peer header, response message and timing/status metadata, bounded technical detail | It is a conversation response, not a generic object tree. Preserve the existing explicit send confirmation. |
| Chat / Avatar | Clear conversation header, quiet secondary controls, message bubbles/blocks, cohesive composer card and staged-context chips/list | Preserve ownership, active-request/busy semantics, stop request, history, model choice and draft retention. Avatar visuals stay secondary to accessible conversation controls. |
| Canvas | Investigation header and action bar, consistent lane cards, title/status hierarchy and composer fields | Imported references remain inert. Preserve exact branch-context behavior and local saved investigations. |
| RAG | Search card, selected-citation action bar, readable citation/result cards, separate collection/document status cards | Preserve busy serialization, no automatic replay, source citations and invalidation. Upload acceptance remains distinct from indexing completion. |
| Native connection/setup/review dialogs | Plain-language labels, prompts, examples and useful step titles | Native dialogs already follow VS Code theme. Improve text while retaining trust/identity checks and exact review authority. |

Suggested connection copy:

- Label title: "Name this connection".
- Prompt: "Choose a friendly name so you can recognize this NetClaw later. This is not a hostname or URL."
- Placeholder: "My Mac lab or WSL NetClaw".
- URL title: "NetClaw HUD API address".
- Prompt: "Enter the address of the running HUD API on this extension host. The usual local address is http://127.0.0.1:3001. For WSL or another host, first open that environment in VS Code."

Implementation should also avoid a saved-but-unreachable profile being labeled "Connected" merely because its ID matches a retained selection; use verified connection state.

## Decision: bounded purposeful Three.js topology, backed by the same readable data

**Decision.** Reuse the extension's existing pinned `three@0.185.1`. Build a separate topology webview bundle loaded only for topology. Its initial view is static; the operator can select nodes, orbit, zoom and reset with pointer or explicit controls. Display the complete accessible peer/device list and details independently of WebGL.

**Rationale.** Three.js is already bundled into Avatar via `webview/PalAvatar.jsx` and `build.mjs`. `ui/netclaw-visual/src/dashboard/Scene.jsx` demonstrates local render-on-change, bounded entities, resource cleanup and fallback patterns, but its always-central relationship lines and fixed dark text colors cannot be transplanted wholesale to arbitrary inventory or light themes.

**Alternatives considered.** A site-like spinning globe everywhere is decoration that costs readability and cannot truthfully locate devices without geographic data. A CSS/SVG-only view would be lighter but misses the owner's accepted purposeful 3D direction. Showing configured devices as a fully connected mesh invents relationships and is rejected.

Graph input must carry `sourceKind`, source/time, stable original entity IDs, nodes and explicit typed edges. The graph adapter makes the distinction:

- BGP-session mode: local speaker to each reported peer session, with session state displayed as reported. Label every view "BGP sessions · not physical cabling". An unavailable `/api/bgp` yields an unavailable state, not an empty healthy topology.
- Testbed mode, if exposed: draw only links that the validated testbed document explicitly declares (for example, shared explicit interface link names), label them "Configured testbed links", and never infer links from IP similarity, order or proximity. Devices without explicit links remain unconnected inventory nodes. Source-declared links are configuration, not observed health.
- No visualization action starts a collector, connects a device or reads a second live source implicitly.

Use event-driven rendering on selection, resize, control change and theme change; clamp device pixel ratio to 2; bound the scene to 200 visible nodes with an explicit limit notice while keeping the full list searchable/paginated. Stop rendering when hidden. On dispose or lost context, remove listeners, disconnect observers, cancel frames, dispose controls/geometries/materials/textures/renderer and release the canvas. A context-loss message must leave the list and actions fully working. Theme changes update material and label colors from computed CSS tokens without resetting selected entity or view controls. Use no glow/postprocessing requirement, remote model files or shader effects necessary to understand status.

For keyboard and assistive technology, the semantic list/card selection is the primary selector. Provide ordinary Zoom in / Zoom out / Reset view buttons and meaningful text state; avoid making a WebGL canvas the only route to details. Tooltip-only device labels are insufficient. Reduced motion requires no auto-orbit, easing or camera flights; static rendering still works.

## Decision: a small bundled generated asset family

**Decision.** Create custom branded imagery for the Overview feature area and a restrained empty-state illustration family. Keep existing approved lobster/activity icons and Avatar models. Generate abstract network-engineering art with cyan/pink highlights and ample negative space; no product text, device names, IPs, config excerpts, invented metrics or realistic topology.

**Rationale.** A deliberate hero illustration can carry the AYN visual character without turning every page into a marketing landing page. All operational labels remain HTML, selectable and accessible. Local assets avoid remote calls at runtime.

**Alternatives considered.** Reusing only the existing lobster icon is insufficient for the accepted custom-imagery direction. A large unique image on every page would dilute information density and add avoidable payload. Generated screenshot-like controls are inaccessible and risk misleading status.

Suggested asset brief: "A polished abstract network constellation around a sculpted geometric lobster-inspired core; cyan and magenta edge lighting, sparse luminous connections, subtle technical depth, generous empty space, no words, numbers, labels, UI controls or real topology." Make it decorative (`alt=""`) when adjacent text fully carries meaning. Use transparency or a contained art panel that looks intentional in both light and dark themes; explicitly check both rather than assuming dark art blends in. Hide purely decorative art in high contrast if it competes with content. A compact asset manifest should record generation prompt, tool/model information actually returned, intended use, dimensions and local filenames. Do not promise a specific image-generation model version unsupported by the available tool.

## Decision: verify semantics and visual quality independently

**Decision.** Add pure adapter tests, DOM interaction tests and isolated actual-editor visual review. Keep existing Spec150 tests and run targeted regressions for changed shared shell/message behavior. No VSIX is needed for local source-development testing.

**Rationale.** The extension already has meaningful native-editor coverage in `test/editor.cjs` and `scripts/editor.mjs`, including theme changes, CSP-aware actual webviews and screenshots, plus JSDOM tests such as `rag-view.test.mjs`. These can be extended without changing the owner's live HUD or installing to Marketplace. A screenshot alone does not prove state protection or truthful domain summaries; pure tests alone do not prove usable typography and responsive layouts.

Required checks:

1. Explicit adapter fixture per existing domain and direct-response variant, including OpenClaw/Hermes differences, partial fields, `false`, `0`, empty strings, unknown objects, and malicious markup text. Confirm meaningful labels and preserved source notices; generic recursive source details stay collapsed.
2. Every domain gets an unavailable/failed fixture as applicable. Collections get both successful-empty and no-filter-match fixtures. Assert these are distinct visible messages, not identical zero-count badges.
3. Representative 500-entry MCP/device/skill inventories retain search and 50-entry pagination. Measure settled-input-to-render time against the spec's 250 ms requirement; record host, dimensions and result. Preserve keyboard focus when pagination replaces its controls. Apply explicit render limits to expanded details as well as primary cards.
4. Shared shell tests preserve CSP nonce/local-resource restrictions, escaped text, allowed message types, monotonic view message sequence, trust gate, installation-generation binding, invalidation and dropped late responses. New action IDs map to a host allowlist; no arbitrary command name or route comes from an observation record.
5. Real source-development VS Code review in dark, light and high-contrast themes; open views switch theme without reconstructing the content. Keep a nonempty Chat/testbed/MCP draft, filter and selection during the switch. Check reduced motion, keyboard-only operation and 200% zoom at 360/700/1200 CSS-pixel widths. Record per-view visual pass/failure, with screenshots of every main view family and all state treatments.
6. Graph adapter tests reject invented edges and preserve exact IDs/source type. Graphics tests cover WebGL unavailable, context lost, hide/reveal, selection, controls, theme update and disposal. The list remains usable when the renderer fails or is disabled; resource allocation should not climb across repeated mount/dispose.
7. Meaningful current regressions: Chat busy/unknown/stop/history and draft retention; RAG busy/overlap/cancel/invalidated state; Canvas imports/branch context; Avatar fallback; assistant access and inert proposals; explicit Intent/peer review; Settings identity/review/post-save behavior. Avoid unrelated live-provider/device retesting for styling alone.
8. Inspect generated/bundled image appearance in both themes, metadata/provenance, dimensions/size and no private content. Confirm no essential text is rasterized and no artwork generates remote requests.

The current actual-editor runner can start a development extension with an isolated temporary HUD fixture. Keep `NETCLAW_TEST_VSIX` and live-provider paths unset for this spec's local-only acceptance. Native modal review paths may need the normal isolated-development-window observer pattern already documented in Spec150; do not weaken approvals merely to automate the test host.

## Scoped implementation file map

These are proposed ownership boundaries, not edits made by this research.

| Files | Intended change |
|---|---|
| `extensions/netclaw-vscode/src/webview/panel.ts`, `bridge.ts`, proposed `shell.ts` | Shared semantic shell, local asset URIs, explicit page kind/variant, safe allowlisted contextual actions; preserve all current binding/message checks. |
| `extensions/netclaw-vscode/resources/workbench.css` | Shared theme-aware design tokens, cards, forms, typography, responsive layout, focus/high contrast/reduced motion. |
| `extensions/netclaw-vscode/resources/data.js`, proposed shared UI/domain presentation resources | Replace recursive primary rendering with explicit per-domain adapters/components; reusable bounded source disclosure, search and pagination. |
| `extensions/netclaw-vscode/src/client/domains.ts` | Domain descriptions/semantic variants and clearer Testbed/BGP labels; no misleading availability or health normalization. |
| `extensions/netclaw-vscode/src/extension.ts`, `package.json` | Connection copy, navigation labels, contextually routed setup/testbed commands and approved next-action links; keep command compatibility. |
| `extensions/netclaw-vscode/src/views/chat.ts`, `rag.ts`, `canvas.ts`, `intent.ts`, `settings.ts`, `services.ts` | Shared page composition and readable copy; do not replace ownership, review or operation state machinery. Testbed/MCP functional work has separate research/contracts. |
| `extensions/netclaw-vscode/resources/chat.js`, `rag.js`, `webview/canvas.js`, `webview/avatar.jsx`, `webview/PalAvatar.jsx` | Visual class/composition updates where needed and targeted state-preservation/resource checks; preserve existing interaction semantics. |
| Proposed `extensions/netclaw-vscode/webview/topology.js` and graph adapter module; `build.mjs` | Separate local Three.js entry, bounded truthful source graph, accessible controls, lifecycle cleanup and automatic theme updates. |
| Proposed `extensions/netclaw-vscode/resources/brand/*` and asset manifest | Bundled generated hero/empty-state art and actual provenance. |
| `extensions/netclaw-vscode/test/*.test.mjs`, `test/editor.cjs`, isolated test support | Domain/DOM/graph tests and visual matrix using source-development host; no package action. |
| `specs/151-extension-experience/*` | Design decisions, state coverage matrix, image provenance, local validation evidence and truthful platform qualifications. |

Read-only reference sources for this research: `ui/netclaw-visual/server.js`, `src/hud-server/{configuration,runtime-settings,security-posture,tokenomics,documentation,logs}.js`, `src/dashboard/{Dashboard,ReferenceViews,Scene}.jsx` and `src/dashboard/model.js`. No HUD redesign or backend changes are needed solely for the shared visual system. Any authoritative testbed/configuration metadata change belongs to the separate bounded functional contracts.
