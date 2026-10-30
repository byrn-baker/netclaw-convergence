# Verification: home onboarding

Run: 2026-10-30-home-onboarding. Start UTC 18:59:24; deadline UTC 19:44:24.
Shared budget:45 minutes; maximum three acceptance cycles per task.
Baseline:a3c68981; branch1012-convergence-home-onboarding in isolated worktree.
No user changes at baseline. Coordinator owns specs, acceptance and publication.
T001 complete. T002 attempt1: design/implementation begins after recorded scope.
T003 attempt1: API/HUD coverage and docs delegated to home_coverage.
T002 owned by home_flow_design (setup/helper/assets/unit tests). Coordinator owns
T004 integration harness/CI, skill and T005 proposal amendment. T004 attempt1 begins
with disposable loopback-only HTTP traffic; BPF restricts capture to its fixture
port. No unrelated host/LAN packet capture is used. T005 attempt1 records user
maintainer approval and accepted hardware-free requirements in proposal161. No live network changes authorized by this coding task.
Private evidence stays outside Git; actual Mac/Windows and physical capture remain gaps.

T002/T004 first full-stack attempt: FAIL. The collector image copied a dynamically
linked Alpine/musl GoFlow2 binary into Debian/glibc; runtime execution failed despite
a successful image build. No flows reached the archive. The disposable project was
removed. T002 attempt2 corrects the runtime dependency and adds actual collector
readiness; T004 attempt2 reruns demo and strictly filtered localhost capture.
Additional review corrections: reject remote Docker contexts for capture/demo,
keep transient startup retries bounded, and preserve immediate authentication errors.
T003 initial API/HUD coverage tests pass (12 API flow/reliability, five renderer).
T005 proposal amendment independently reviewed PASS and committed as36780ec2.

T004 attempt2: both actual demo and filtered-loopback host pipelines PASS, including
real MCP invocation, production HUD proxy/JSDOM renderer, scoped evidence and full
project stop/start persistence. Resource snapshots recorded privately. No unrelated
host traffic was captured. T006 review found P1 project-name collision can mix demo
and host resources; T002 attempt3 adds persisted ownership and pre-mutation checks.
T004 final acceptance must rerun after ownership correction.

T007 attempt1: full HUD suite failed twice at the unchanged avatar fixture's first
25ms readiness assertion; the same test passed in isolation. No Convergence path
appears in that failure. Investigate the baseline before labeling it inherited;
replace timing assumptions only if supported, preserving every behavior assertion.

T007 attempt2: independently reproduced full-suite failure on clean baseline
`a3c68981` (391/392); isolated old test passed. Replaced only fixture's fixed sleeps
with bounded waits for observable React transitions; all assertions preserved.
Targeted test and full HUD suite now PASS (392/392). No avatar runtime change.

Upstream scope PR309 was discovered already merged at `4d791a36`. Integrated that
upstream documentation and the independently reviewed follow-up requirement amendment
into this fork branch; no upstream runtime port is claimed. T005 complete.

Chromium production-renderer smoke with the actual retained loopback summary: PASS,
coverage label and records visible, no page JavaScript errors. This is an isolated
renderer check, not a full gateway/session/model investigation. Local browser launch
required previously isolated shared libraries; no host packages were installed.

T002/T006 final review: PASS. Persisted ownership guards cover running/stopped
containers, retained volumes/networks, exact resource names and independently
running exporters on the same global port. Cross-bundle adoption/injection and
project-prefix false positives are corrected. 64 setup helper tests pass; independent
verifier reran 35 flow-specific cases. Existing core/K3s helpers remain covered.
Catalog skill descriptors regenerated with official Node/Python tools; metadata,
generation parity, runner contracts, all six reconciliation surfaces, release1.16.0
metadata, spec artifacts (166/four unchanged exceptions) and whitespace pass.
API flow/reliability12, HUD explorer5, full HUD392 and production build pass.

The public qualification guide reports actual initial fixture resource snapshots
with exclusions. Final owned-bundle acceptance and hosted results are pending;
this publication is a review draft until those gates pass. No release tag, live
service deployment or physical capture is performed.
