# Feature Specification: NetClaw 1.0.0 release and contributions

**Feature Branch**: `129-release-1-0`
**Created**: 2026-09-28
**Status**: Accepted scope — user requested contribution policy and official release
**Input**: Publish an announceable NetClaw 1.0.0 with the new HUD and a contribution guide stressing numbered specs and Spec Kit PRs.

## User Scenarios & Testing

### User Story 1 — Contribute through a numbered spec (Priority: P1)
A contributor can find the guide from GitHub and the README, use the checked-in Spec Kit workflow, and submit a PR linking its numbered spec, plan, research, tasks and verification.

**Independent Test**: Follow all local links, inspect commands against repository scripts, and confirm the PR template asks for these artifacts.

**Acceptance Scenarios**:
1. Given a new contribution, the guide requires a unique sequential spec number and matching branch before implementation.
2. Given a small fix or documentation PR, it still links a numbered spec; work within an existing spec may update that spec with explicit scope and evidence.
3. Given incomplete live verification, the PR records the gap without representing it as a pass.

### User Story 2 — Install an identifiable release (Priority: P1)
An operator can download the official v1.0.0 source release, find installation and HUD upgrade instructions, and read accurate highlights and limitations.

**Independent Test**: GitHub reports a published non-prerelease v1.0.0 targeting the verified main commit; its tag resolves to that same commit.

## Requirements

- FR-001: Add root CONTRIBUTING.md and a GitHub PR template requiring numbered Spec Kit artifacts and validation evidence for all PRs.
- FR-002: Explain numbering collisions, maintainer scope review, offline checks, integration coherence, credential safety, and licensing.
- FR-003: Restore the truthful README HUD inventory statement required by the existing reconciliation gate; do not weaken the gate.
- FR-004: Add versioned release notes, a changelog, a repeatable maintainer release process, and an announcement draft.
- FR-005: Merge release preparation through a PR after checks pass; publish an annotated v1.0.0 tag and official GitHub release at the verified main revision.
- FR-006: Distinguish source-release availability from mobile store distribution, provider availability and live/host acceptance. Do not assert audit completion.
- FR-007: Keep component versions independent; the HUD is already 1.0.0. No device configuration, deployment, paid inference or external announcement is in scope.
- FR-008: Preserve spec128 for the user's separately reserved scope; use129 for this release.

- FR-009: User clarification: establish `1.x.y` versioning for future completed specs. Add root VERSION and a preparation helper: minor for features, patch for fixes/docs/maintenance; map each release to numbered specs and leave component versions independent. Validate release metadata before tagging.

- FR-010: Provide a reusable content-agent handoff for blog/LinkedIn/X, with exact inventory, tagged source links, channel briefs, attribution, publication checks and explicit claim boundaries. Prepare content; do not publish social messages.

## Success Criteria

Contribution requirements are discoverable, local specification/reconciliation checks pass, release CI is green, and the public release URL resolves to the intended immutable tag. GAIT and daily memory record the actual outcome.
