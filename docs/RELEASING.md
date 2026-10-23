# Releasing NetClaw

`VERSION` is the authoritative **repository source-release version**. Git tags use a `v` prefix (`v1.0.0`), and each published version has `docs/releases/X.Y.Z.md` plus a `CHANGELOG.md` entry. The HUD package and mobile/app-store versions are component versions with independent lifecycles; do not rewrite them automatically for every repository release.

## The 1.x.y policy

| Completed spec | Bump | Example |
| --- | --- | --- |
| New backward-compatible feature, integration, skill or substantial capability | Minor (`x`), reset patch | `1.0.3` → `1.1.0` |
| Backward-compatible bug fix, security fix, documentation, tests or maintenance | Patch (`y`) | `1.1.0` → `1.1.1` |
| Breaking public interface, configuration or upgrade contract | Stop for an explicit compatibility/version decision | Provide a compatible transition within 1.x, or plan 2.0.0 |

Each completed spec advances the release version once; creating a draft spec or committing individual tasks does not. Default to one spec per release. A release may batch coordinated specs when maintainers explicitly choose to, list them all, and select the highest applicable bump. Do not increment `VERSION` for every commit or CI run. Follow-up fixes to an already released spec get a new patch version and new verification evidence.

Spec IDs identify design work, not releases: spec 130 could ship as 1.1.0; the next fix spec could ship as 1.1.1. Multiple feature branches must not reserve the same release number. Finalize the bump against current `main` near merge; regenerate/reconcile a stale proposal before merging.

## 1. Prepare the spec's release PR

Use the [contribution workflow](../CONTRIBUTING.md). Complete the spec, tests and verification before release. From the repository root, preview the bump (replace `130` with the actual completed spec):

```bash
python3 scripts/prepare-release.py --bump minor --spec 130
# Use --bump patch for fixes, documentation and maintenance.
```

After checking the proposal, write the files:

```bash
python3 scripts/prepare-release.py --bump minor --spec 130 --apply
```

The helper validates the existing version/notes/changelog and the specified spec's artifacts, then updates `VERSION`, prepends the changelog entry and creates release-note scaffolding. Preview is the default; it makes no changes. It refuses ambiguous/missing spec IDs and existing target notes. It does not commit, push, tag, publish, contact providers or change component versions.

Replace every `RELEASE_TODO` in the notes with shipped changes, upgrade/compatibility instructions, actual validation and known limits. Use absolute GitHub links pinned to the proposed tag in the notes that will become the GitHub release body. Ensure changelog date is the actual release date. Include these files in the spec PR (or a clearly linked release follow-up). The initial 1.0.0 baseline was prepared under spec 129.

## 2. Verify and merge

```bash
python3 scripts/prepare-release.py --check
python3 scripts/test-prepare-release.py
python3 scripts/verify-spec-artifacts.py
python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability
```

Run the relevant contract suites and component checks listed in CONTRIBUTING.md. Review limitations in the release notes and inspect the final diff for secrets/private artifacts. Merge through a PR after applicable CI passes. Do not bypass a failing check with an administrator merge.

The Release metadata workflow checks the helper and current release files on relevant PRs and `main`; it also checks that pushed version tags match `VERSION`. It does not prove a feature spec is complete, check every live integration, enforce bump size, or publish releases. Maintainers review those decisions.

## 3. Tag exactly the verified main commit

Start from a clean checkout of merged `main`, update it by fast-forward, and inspect **all workflows for that exact commit**, not just the most recent run of an unrelated branch:

```bash
git switch main
git pull --ff-only
git status --short
python3 scripts/prepare-release.py --check
release_version=$(cat VERSION)
release_commit=$(git rev-parse HEAD)
gh run list --commit "$release_commit"
gh release list
git ls-remote --tags origin "refs/tags/v$release_version"
```

Stop if the tree is dirty, required workflows are pending/failing, the version is already released or the tag exists unexpectedly. Once checks pass, create an annotated tag at the exact commit:

```bash
git tag -a "v$release_version" "$release_commit" -m "NetClaw $release_version"
git push origin "v$release_version"
```

Wait for the tag's Release metadata check to pass. Do not move, overwrite or force-push an existing release tag.

## 4. Publish and verify

```bash
gh release create "v$release_version" --verify-tag --title "NetClaw $release_version" --notes-file "docs/releases/$release_version.md" --latest
gh release view "v$release_version" --json url,tagName,isDraft,isPrerelease,targetCommitish,publishedAt
git ls-remote origin "refs/tags/v$release_version" "refs/tags/v$release_version^{}"
```

Confirm the peeled annotated tag equals `release_commit`, the release is published with `isDraft=false` and `isPrerelease=false`, and the intended version is GitHub's latest release. Source archives are automatic. Upload binary assets only when their build, checksums and provenance were explicitly verified; source release publication alone does not distribute mobile apps.

Record the release URL, exact commit, CI and remaining limitations in daily memory and GAIT. Prepare an announcement for the operator; social, Slack or blog publication requires its own authorization. Never claim publication based only on a local tag or a draft release.

If a defect is found after publication, issue a spec-linked patch release. Preserve the original tag and describe the correction in the changelog. This keeps existing installations and evidence reproducible.
