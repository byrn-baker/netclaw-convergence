# Managed MCP and installer contract

`netclaw_testbed_compose(envelope)` accepts the composition envelope documented in
[data-model.md](../data-model.md), checks the selected installation policy, normalizes
records, then calls pinned upstream `pyats_testbed_build(source="inline", activate=False)`
with fixed mappings and environment-only credentials. Returns a bounded sanitized
preview with candidate name/digest/count/provenance; does not connect to devices.

`pyats_testbed_validate(name, check_reachability=False)` uses actual upstream pyATS
schema loading. Only a completed schema-valid result with no unset credential env
qualifies for activation. A Task receipt does not qualify. Explicit reachability
remains a distinct optional operation and is never called by installation/CLI defaults.

`pyats_testbed_activate(name)` requires an immutable validated candidate and no
in-flight device operation. `static` is valid only in static policy with a configured
file. `pyats_testbed_delete` refuses the active candidate. Managed raw build accepts
only a reviewed composition envelope through the managed adapter; unsafe native
fetch, static merge, arbitrary mappings and copied static credentials are refused with
instructions to compose existing source MCP output. Source discovery explains this
boundary. Existing static pyATS device tools retain their schemas/behavior.

`pyats-testbed-session.py --input candidate.json [--activate]` loads a bounded local
review envelope, starts one owned MCP process using the selected runtime, composes
and validates. Without --activate it returns preview/validation only; with it, activates
and lists inventory in the same process. It never logs in, probes, shows or configures.
Process exit discards active state. Native MCP clients can continue within their
existing process after review. No replay daemon or silent refetch.

Installer policy is additive and per-claw. Dynamic setup records selected source ids,
does not import inventory or generate an empty YAML, and unsets static path in the
runtime child. Cancel and failed validation write no changes. All existing setup
review/hash/resume/secret gates remain in force. Static editor and collector grants
are explicitly separate from the dynamic MCP inventory.
