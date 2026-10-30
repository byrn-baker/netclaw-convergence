# Data model

Add `capacity_releases(request PRIMARY KEY, conversation NOT NULL, created REAL)`.
It records a reviewed admission-accounting decision, not a runtime outcome.
Request FK cascades only under existing settled-record retention. Unknown
requests and their evidence remain retained indefinitely, including releases.

`Ledger.open(..., release_capacity=False)` validates exact boolean and matching
acknowledgment. Within one immediate transaction: verify original request is
unknown/no native ID/no execution scope/different conversation; insert release
once and create/return new conversation. Repeat retains first release evidence.
Admission excludes a request only while it is unknown/no ID and has a release.
Per-conversation guard and nonce fingerprint check run unchanged.

Bridge projection adds `capacityReleaseEligible` (HUD-only unknown/no ID) and
`capacityReleased`; both are observational. Releasing is not cancellation and
never changes request.state, body, nonce, evidence or result.
