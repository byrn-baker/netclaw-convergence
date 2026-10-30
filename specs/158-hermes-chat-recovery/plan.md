# Implementation Plan: Preserve Submitted Questions and Drafts During Recovery

**Branch**:`158-hermes-chat-recovery` | **Date**:2026-10-29 | **Spec**:[spec.md](spec.md)

## Summary

Retain immutable submitted prompt, nonce and a full-prefix recovery anchor before POST. Keep completed receipt until the next permitted submission. Merge by requestId; for untagged native history adopt only the exact pair at the anchored position. Preserve edited/cleared drafts, clear only unchanged originals, and separate send persistence from observation.

## Technical Context

**Language/Version**: JavaScript ESM/React18; Node24.19 tests.

**Primary Dependencies**: Existing React, Web Crypto SHA-256, esbuild/JSDOM test harness.

**Storage**: Existing installation-scoped sessionStorage pending record and sanitized chat/archive.

**Testing**: Actual bundled StandardChat with controlled fetch, plus pure storage/recovery/runtime tests.

**Target Platform**: Existing secure-context HUD browsers; isolated Mac fixtures.

**Project Type**: Chat recovery correctness fix.

**Performance Goals**: One local transcript digest at submission/recovery, no extra POST.

**Constraints**: No draft-based attribution, no text-only deduplication, no network/provider operations in tests.

**Scale/Scope**: StandardChat, runtime-client, chat-storage and new small recovery helper.

## Constitution Check

Pre/post design PASS. Existing read-only observation, private scoped storage and no new tools/permissions (I–XIII); no external communication(XIV), legacy incomplete evidence fails honestly(XV), SDD ordered(XVI), local milestone recorded(XVII). No runtime deployment.

## Project Structure

- src/shared/runtime-client.js: immutable submission envelope, completed receipt, observed request identity validation.
- src/dashboard/chat-recovery.js: full canonical prefix SHA256/count anchor, requestId merge, exact-position history adoption and draft policy.
- src/dashboard/StandardChat.jsx: use original submission; clear inFlight after send; preserve draft through observing; block unreconciled new send.
- src/dashboard/chat-storage.js: retain validated optional requestId on turns.
- src/dashboard/hermes-ui.test.js, chat-recovery.test.js, chat-storage.test.js, src/shared/runtime-client.test.js: actual UI and contract regressions.
- docs/HERMES-HUD.md: recovery/legacy-history guidance.

## Phases

Failing UI regression → immutable receipt/helper → UI/storage integration → refresh/history/idempotence tests → evidence/local commit.

## Complexity Tracking

No violations. Complete-prefix hash avoids retaining a second full transcript. Native history has no trustworthy run/request correlation; exact-position structural match is allowed, ambiguous/truncated/changed history refuses merge without losing transcript or draft.
