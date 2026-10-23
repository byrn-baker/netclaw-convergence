# Implementation Plan: Workspace Files and Claw Controls

**Branch**: `152-workspace-claw-controls` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

## Summary

Implement all five stories and show the built source in a disposable native VS Code profile with isolated OpenClaw and Hermes installations. Add native host management that survives loss of the HUD, six-file editing with explicit reviewed writes, and full owned-service lifecycle. Owner authorized local completion and preview; push, production changes and publication remain held.

## Technical Context

**Language/Version**: TypeScript 5.9; existing Node 24.19+ ESM helpers; VS Code >=1.102; browser JavaScript.
**Primary Dependencies**: Existing VS Code APIs, Node standard library, yaml/esbuild and existing HUD runtime/CLI helpers. No new framework or broad shell endpoint.
**Storage**: Existing private installation identity; per-installation management bindings/evidence/backups with 0700 directories/0600 files. Editor stores only non-content binding metadata locally. Drafts use VS Code’s native document model. No text enters webview state; VS Code may maintain its own host-local editor backups according to the operator’s settings. The isolated preview disables Hot Exit.
**Testing**: Node tests, process fixtures, existing real-HUD fixtures, native VS Code observer + Playwright CDP; existing extension/HUD regressions.
**Target Platform**: macOS and Linux extension hosts, including WSL/Remote SSH. This host supplies Mac acceptance; other hosts retain explicit qualification limits.
**Project Type**: Existing extension and narrowly scoped existing-runtime management helpers; one read-only HUD discovery projection.
**Performance Goals**: Spec SC-008; 1MiB content cap and bounded envelopes/timeouts. No polling that blocks editing.
**Constraints**: Six-name allowlist; no delete operation; no public lifecycle route, arbitrary command, assistant tool grant, implicit configuration change or live deployment.
**Scale/Scope**: Five stories, two runtime kinds, owned engine/HUD/federation service set. Other claws and shared security services excluded.

## Constitution Check

Pre-research and post-design gates PASS for owner-authorized local work:

- I–IV/VIII: all acceptance uses isolated installations, not production device work. Mutations have observation, review, private originals, verification and metadata-only durable evidence; session GAIT is maintained. Existing production approval policy remains required for affected production services.
- V–VII/IX–X: this is operator management of existing runtime facilities, not a new agent tool integration. Like Spec151 native security controls, it introduces no MCP server, vendor device logic or assistant authority. A read-only HUD projection identifies its own installation; native management executes only reviewed fixed operations.
- XI–XIII/XV: update documentation and runtime references; no new MCP catalog entry/registration. Use existing isolated runtime executables and preserve credential files. Older installations lacking ownership/discovery stay explicit unsupported for unsafe actions.
- XIV/XVII: no external communication or publication. Local milestone draft only.
- XVI: approved specification → research/plan/contracts → tasks → analysis/remediation → implementation → verification and isolated preview.

## Project Structure

```text
specs/152-workspace-claw-controls/
  plan.md research*.md data-model.md contracts/management.md quickstart.md
  tasks.md analysis.md verification.md milestone-draft.md
scripts/
  claw-control.mjs
  lib/claw-{files,services,process}.mjs
  hud-launch.mjs
extensions/netclaw-vscode/
  src/client/claw.ts src/views/workspace.ts src/state/management.ts
  src/extension.ts resources/workspace.js resources/workbench.css
  test/claw-*.test.mjs test/claw-fixture.mjs test/editor-workspace.cjs
  scripts/workspace-preview.mjs
ui/netclaw-visual/server.js
```

## Design and sequencing

1. Add a session-authenticated read-only management descriptor to the existing HUD: installation/runtime/home/config/agent, selected launch-context paths and checkout. It reveals no env values or content. Native binding verifies the same identity and owner-local paths. Legacy fallback requires explicit local path selection and verification, never guessing a workspace.
2. A fixed-operation host helper, invoked through an explicitly reviewed source/Node binding, owns file validation, revision checks, recovery and lifecycle journals. Its management state is outside the HUD process. Binding generation and Workspace Trust fence every editor operation; saved bindings may be selected while the HUD is stopped.
3. Resolve OpenClaw workspace through its native configured-agent inspection, with bound runtime/config/launch context; do not reproduce a partial JSON5/include resolver. Hermes persona storage is its profile home. Report that protected Hermes companions disable ordinary persona-file consumption. Keep their isolation unchanged.
4. Implement exactly six file operations: catalog/read plus prepare/update/create-via-upload. Strict UTF-8, full bounded source, no-follow regular files, owned canonical directories, hardlink refusal, inode/revision checks, private backup, exclusive missing-file creation, atomic existing-file replacement and readback. Serialize this manager; recheck immediately before replacement. Ordinary external writers do not honor the lock: disclose coordination requirement and preserve/flag observed races rather than claiming universal filesystem CAS.
5. Implement owned-service observation/control. Managed HUD launch gains durable process/child ownership and graceful Stop with Start independent of the HUD. OpenClaw gateway and optional native Hermes messaging gateway use exact validated launchd/systemd definitions when present, or an explicitly owned supported foreground runner. Federation uses its exact validated supervisor unit when supervised, otherwise its installation-owned helper. Unknown wrappers, unrelated listeners, missing prerequisites or unowned processes block the full action; no partial scope masquerades as full success.
6. Lifecycle review hashes target, helper/executable/config/service definitions and current owned service scope. Apply revalidates, journals before effects, stops in reverse dependency order and starts in dependency order, checks readiness and records per-phase outcomes. Unknown operations are observed/reconciled before another mutation; no blind retries or force-kill escalation. Keep already-running/stopped actions idempotent. Surviving editor state must offer reconnect/status/Start.
7. Add a top Connections section with each filename and Start/Stop/Restart plus a complete workspace/control page. Use inert source text, in-memory editing, explicit line-ending handling, native upload selection, diff review, private recovery, separate Save and Save and Restart actions. Combined review binds exact draft and service scope; failed/unverified saves block restart.
8. Verify core contracts/faults first, then actual editor typing, native dialogs, layouts, themes and full stop/start recovery in isolated restartable process fixtures. Leave the final native preview open with both synthetic connections and clear fixture attribution. Production/provider execution remains unclaimed.

## Complexity Tracking

A native host helper is necessary because full Stop intentionally removes the HTTP service. The read-only HUD descriptor avoids unsafe home/path inference. Persistent ownership records are necessary to refuse unrelated processes and survive editor reload. Existing service managers remain authoritative; no alternate security service or agent tool is introduced.

## Implementation refinement — native Markdown documents

Use a narrow `netclaw-workspace` FileSystemProvider for the six allowlisted documents, alongside the workspace/control webview. Native VS Code owns typing, Undo, BOM/newline serialization and dirty-close prompts. The provider does not implement delete/rename and routes every write through the same native review and verified helper transaction. This improves FR-012/029 and avoids per-keystroke bridge messages. Upload remains an exact-byte native dialog transaction. Native editor backups are local VS Code data, not webview state or audit evidence. External Markdown preview is never opened automatically.
