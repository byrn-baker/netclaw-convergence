# Research and existing-state assessment

- Fresh upstream fetch resolves `main` to `40425bb` (spec130 standard Chat switch).
  The new function-first HUD (spec127) is already in this ancestry. The contribution
  starts at `2d328b0`, one commit ahead, zero behind. No HUD replacement is needed.
- Existing upstream Canvas is retained; proposed terminal/features are additive.
  The feature inventory and exclusions are in
  [the scope document](../../docs/NETCLAW-CANVAS-PR.md).
- The large original `App.jsx` eagerly loaded xterm and optional windows. Extraction
  and dynamic imports reduce initial static JavaScript from 872,406 to 339,917 bytes
  with the same lockfile. This is deferred loading, not elimination of features or
  proof of CPU/memory improvement. [Measurements](../../OPTIMIZATION.md).
- Profiles must read current YAML/environment rather than caching credential state.
  Extracted backend factories accept the existing readers and preserve that behavior.
- Browser-local images and in-memory observations are not shared enterprise storage.
  Provider evidence is not proof of address ownership. Existing documentation records
  bounds and retention instead of presenting prototype integrations as complete.
- Windows reproduces 15 upstream test failures (POSIX permissions/symlinks and URL
  path handling); no security checks were weakened to make those pass.
- The contract manifest covers shell/Python suites; the dedicated HUD workflow
  supplies Node dependencies. Register this family with a documented matrix exclusion
  and execute it in HUD CI, not twice in unrelated MCP jobs.

## Alternatives and open decisions

1. A separate desktop application was excluded by the contributor's explicit scope.
2. Replacing the new HUD would destroy unrelated upstream improvements; retain it.
3. Removing validation/tests to cut LOC would reduce safety, not optimize behavior.
4. Direct SSH and provider REST adapters in the web API require maintainer review
   against constitution Principles V/VI (MCP-native, vendor separation). Existing
   implementation is submitted for review, not declared an approved exception.
5. API-recorded Local/Lab audit without mandatory GAIT availability needs explicit
   review against Principles III/IV. Production gates are not waived.
