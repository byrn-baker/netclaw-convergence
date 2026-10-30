# Verification: portable onboarding

See [the user-facing qualification record](../../docs/convergence/verification.md)
for executed platforms, actual installation/recovery/browser results and explicit
limits. This fork change prepares a tested installation path; it is not a complete
clean upstream implementation port or a released cross-platform guarantee.

## Automated checks

- Setup/Helm tests: 39 passed, including 18 Docker helper tests, 10 K3s bundle tests
  and 11 chart tests. Initial regressions failed before implementation; fixes were
  verified by rerunning the affected checks.
- Catalog metadata: PASS, 122 components and 251 skills. Updated the setup skill's
  canonical hash and regenerated catalog; parity PASS.
- Declaration reconciliation: PASS for catalog, dependencies, docs, meraki-ids,
  packages and portability.
- Markdown relative-link check: PASS for the new entry points/guides/skill references.
- Fork-wide spec artifact check: FAIL on the same 46 historical findings recorded
  at the preceding upstream sync. Spec 1009 adds no finding; no exception was added.
- Clean upstream proposal artifact check: PASS, 144 specs/four legacy exceptions;
  all six declaration surfaces PASS. Proposal is documentation-only.

## Live isolated acceptance

Fresh Docker and disposable K3s installs passed core authentication, site isolation,
API probe, Grafana datasource/dashboard and synthetic case tests. K3s also passed
OTLP log verification and Helm metric/log/OTLP canaries. Repeat Helm upgrades used
both Helm 4.3.1 and 3.19.0. PostgreSQL/Grafana restarts preserved the canary. A logical
dump restored into a separate database. Uninstall preserved eight PVCs and the
external Secret; reinstall read the original canary. Docker stop/start passed after
fixing a readiness race with a startup wait and bounded read-only check retries.

A second core-only Compose project passed from a clean detached checkout with
spaces in its path, alongside the first project, using independent site/network/volumes.

Chromium logged in to the Docker dashboard, rendered live series and reported no
page errors. The sanitized screenshot is checked into docs. Browser dependencies
were isolated; no system packages or live services were changed.

## Release gates and workflow

The four-digit fork spec number exposes an existing Spec Kit plan-script limitation;
the checked-in artifacts were completed manually in lifecycle order. The clean
upstream draft uses spec 161. Maintainer scope agreement, focused implementation
ports and their own acceptance remain open. No root source release/version claim
is made for this draft engineering branch; chart/skill versions identify their
changes independently. macOS, WSL2 and ARM64 runtime qualification remain explicit
follow-up work, as do real telemetry/IDS/model integrations and full disaster recovery.

The API author confirmed ownership of its unreleased predecessor. Added its
previously declared MIT license and provenance notice; surrounding licensing is
unchanged. The upstream port must still review third-party chart/dashboard notices.

## Continuing CI coverage

`.github/workflows/convergence-onboarding.yml` repeats the Docker trial with a checkout path containing spaces and conflicting exported settings, and separately creates a disposable K3s cluster for fresh install, canaries and upgrade persistence. It uses synthetic credentials and no live cluster secrets. Hosted workflow status is separate from the local execution evidence above.

## Hosted fresh-machine findings

The first hosted K3s job failed before installation because an empty Helm home had
no Victoria chart repository registered. Added `helm repo add victoria-metrics`
to the canonical guide and workflow; replaying dependency builds with an empty
Helm repository configuration passed. This was a real onboarding defect, not a
waived test.

Hosted catalog checks also exposed three pre-existing fork skills without YAML
front matter and stale fork skill descriptions. Added descriptor-only headers
without changing their procedures, then regenerated metadata from skill sources.
The Node skill-descriptor generator, Python catalog parity/metadata/coverage and
focused catalog/testbed tests pass. Historical spec findings remain unwaived.

Review links: [fork implementation #2](https://github.com/byrn-baker/netclaw-convergence/pull/2)
and [upstream scope proposal #309](https://github.com/automateyournetwork/netclaw/pull/309).
Neither PR is a live deployment or a full upstream implementation release.

The isolated hosted chart tests also caught subprocesses using system `python3` instead of the test virtualenv, losing PyYAML. Updated those existing test helper calls to `sys.executable`; end-user setup remains stdlib-only.
