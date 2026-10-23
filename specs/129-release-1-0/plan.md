# Implementation Plan: NetClaw 1.0.0

**Branch**: `129-release-1-0` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

## Summary

Write contribution and release documents, add a PR template, restore README inventory prose, verify locally, merge a release-preparation PR, then tag the verified main commit and publish the official release.

## Technical Context

Markdown, existing Python standard-library verification scripts, GitHub CLI and Git. No runtime or dependency changes. Existing release source archives are provided by GitHub; no compiled binaries promised.

## Constitution Check

Numbered spec and plan precede implementation. User explicitly requests public release. GAIT records work; credentials/topology remain local. Feature coherence is not applicable to a new integration because none is added. Documentation inventory checks remain strict. Announcement/blog draft is prepared locally for the user to publish.

## Structure

- `CONTRIBUTING.md`, `.github/pull_request_template.md`
- `README.md`, `CHANGELOG.md`
- `docs/RELEASING.md`, `docs/releases/1.0.0.md`, `docs/releases/1.0.0-announcement.md`
- This spec's tasks and verification record

## Validation and release

Run spec artifacts, all declaration reconciliation surfaces and the reconcile contracts. Run HUD tests/build to validate the flagship release surface on this host. Check changed Markdown links and diff whitespace. Submit a PR, require green applicable CI, merge, verify main CI and tag equality, then publish with curated notes and confirm non-draft/non-prerelease/latest metadata.

## Rollback

Before publication, correct the branch through ordinary commits. If a published release is defective, document it and issue a patch release; do not move an existing release tag. No deployment rollback is involved.

## Versioning clarification

Add a standard-library Python preparation helper with dry-run default and explicit `--apply`, root VERSION, versioned note scaffold and changelog entry. Validate spec artifacts and existing notes before changing files; refuse overwrites and invalid versions. A `--check` mode verifies release metadata and rejects unfinished templates. Add focused temporary-repository tests for version arithmetic, refusals and no-write behavior. Feature→minor, maintenance→patch. No automatic network publication or component-version rewrites.
