# Data model

Configuration: enabled, base URL, model, key reference, explicit input price, timeout, daily/case caps, trusted task identifier.
Task: trusted identifier; total lifetime spend includes all originating-task consultations. Missing binding uses shared unscoped bucket.
Reservation: UUID, UTC admission day, task, request digest, reserved cost, reconciled actual charge/status; pending/unknown reserves remain charged.
Assessment: UUID, task, purpose, timestamp, model/provider, exact dynamic questions, evidence metadata and digest, typed results, parent assessment, budget usage, audit status. Private data stays local.
Consent: exact request digest + endpoint + task + expiration + consumed state, created only by operator CLI. No credential disclosure permission.
Reconsideration: a single child linked to initial assessment, same task; claim made atomically so concurrent followups cannot both pass.
Advisor view: service identity, advisory_only, enabled/configured availability, provider/model, no API key, no invented member enrollment state.
