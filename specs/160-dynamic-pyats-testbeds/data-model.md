# Data model

## Testbed policy

Optional `claw.testbed = {mode: "static"|"dynamic", sources: [sourceId...]}`.
Absent = static. Static sources empty; dynamic has >=1 unique catalog source.
Top-level inventory files are static-only; dynamic policy rejects conflicting import.
Selected sources are a disclosure/allowlist, not an installation of every provider or
permission to fetch inventory. Existing component settings hold private credentials.

## Source descriptor

Stable id, label, route, upstream native source (if any), existing component/tool
capability hints, required facts, default record mappings and qualification notes.
Version-dependent tool names are hints requiring tools/list, not unconditional claims.

## Composition envelope

Schema version 1, name, list of sources, credential environment names. Each source
has kind, owner, scope identity, capturedAt UTC, complete=true, records, mapping/OS
map as needed, and optional independently observed endpoint enrichment. Max age
is explicitly bounded (default one day); stale records require a newly reviewed
age limit, never silently accepted. Source mappings are explicit allowlisted output
fields; credential-looking input keys are stripped and forbidden as mapping paths.
Only normalized name, management address, SSH port, OS and provenance are retained.
No inline device credentials or source tokens enter the candidate.

## Candidate and active identity

Normalized canonical records, digest, source summaries/counts, no omissions, exact
credential environment references. Name is immutable for the process. States:
composed → built → schema/credential-valid → explicitly active. Errors leave the
previous active identity intact. Deleting active or replacing an existing candidate
is refused. Restart empties the registry; dynamic mode has no static fallback.

## Evidence

Separate runtime-tool discovery, source configuration, source acquisition freshness/
completeness, candidate validation, active identity, reachability, login and execution.
Tests may cover fixtures and native tools without establishing any live device state.
