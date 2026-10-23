# Planning research

## R1 — Verification foundation

Decision: reuse scripts/run-contract-tests.py and tests/contract-suites.json, with per-suite environments and explicit capability gaps. Rationale: existing spec 123 already separates missing dependencies from failed contracts and strips declared live credentials. Alternatives: a global pip install would collide across FastMCP/cryptography versions; a single pytest invocation would lose suite-specific isolation. Source: local runner, manifest and workflow inspected 2026-09-26. Audit the runner itself before treating results as trustworthy.

## R2 — Platform support

Decision: macOS, Linux, WSL2 full host paths; native Windows limited to already-supported components. Rationale: user confirmed pyATS is not native Windows compatible. Alternatives: native Windows full-host support is outside user intent and would require a separate compatibility project. Native systemd confinement still requires its own platform evidence.

## R3 — Scope and evidence

Decision: enumerate every tracked file and aggregate by subsystem, recording review method, findings and gaps. Rationale: 495 tracked MCP files, 301 mobile files, 104 UI files and 322 workspace files make sampled assertions inadequate. Alternatives: counts-only reconciliation misses behavioral defects; blanket rewrites erase proven operational constraints.

## R4 — GAIT bootstrap

Decision: use the existing stdio server in a dedicated venv and correct documented tool schemas under implementation. Rationale: initial invocation failed because gait was unavailable; isolated installation restored it. Alternatives: claiming handwritten Markdown is a successful GAIT call is inaccurate. Actual server uses name, user_text, assistant_text and object artifacts; examples currently differ. Branch creates but does not check out, so both calls are needed.

## R5 — Migration ownership

Decision: feature-specific breaking fixes ship their own preview/backup/recovery-capable migration scripts in 124; phase 3a composes the formal lifecycle workflow. Rationale: existing users need the fix and migration together. Alternatives: delaying all migrations to phase 3 leaves a broken intermediate release.

## R6 — Dependency advisories

Decision: use locally resolved lock/package versions and official advisory sources when a concrete dependency is assessed; do not transmit private source/configuration. Rationale: constraints alone do not identify installed exposure. Full lockfile/advisory work is an audit task, not a completed planning finding. No live external product or version assumption was needed to define this plan.
