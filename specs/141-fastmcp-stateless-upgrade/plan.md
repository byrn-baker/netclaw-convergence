# Implementation Plan

## Research and baseline
Capture source-derived inventory including ignored clones and tracked installation paths. Compare SDK-v1, FastMCP2/3 and FastMCP4 migration guides. Resolve exact stable package metadata. Capture tool contracts before migration where dependencies permit.

## Architecture
Use standalone FastMCP4 for owned servers, with exact framework/SDK pins. Retain individual component virtualenv isolation and legacy shared constraints for non-migrated upstream components. Add component bounds for every upgraded installer path, including dedicated-runtime bootstrap paths. Keep stdio launch behavior; modern protocol negotiation belongs to FastMCP. HTTP tests use loopback fixtures only.

Inspect custom lifecycle and application state separately. Do not globally enable caching, automatic retries, new task handles, code execution or schema transformations. Those would change operational behavior beyond a framework upgrade. Prefer public APIs over removed private managers.

## Verification
Run dependency resolutions, tool discovery and contract comparison against real FastMCP4. Test modern sessionless HTTP and legacy stdio. Run existing tests per affected domain plus installer/runtime/checker regressions. Record missing dependencies/credentials as gaps, never as successful vendor validation.

## Rollback
Branch remains unpublished. Production environments remain untouched. At deployment, rebuild a separate component runtime and retain the previous interpreter record until validation passes; rollback restores the prior source revision and interpreter record. Never downgrade a shared environment in place.
