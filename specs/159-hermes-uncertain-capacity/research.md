# Research — spec159

Phase0 used the Spec Kit plan's read-only research agent plus direct source review.

- `ledger.py`: ACTIVE includes unknown; acknowledgment has no effect on either
  capacity SQL query. The per-conversation and installation checks are separate.
- `bridge.py`: only a known run_id permits GET /v1/runs/{id}. Lost POST responses
  without IDs cannot be inferred safely from transcript/history. A lost response
  must never trigger another POST. Federation uses the same ledger class with a
  separate namespace/database and additional execution scopes.
- `runtime/routes.js`: conversation creation already authenticates exact owned
  acknowledgments and rechecks ownership after private bridge I/O.
- `runtime-client.js` and StandardChat: new-conversation acknowledgment is already
  explicit, but its existing wording supplies no distinct capacity decision.

Decision: additive `releaseUncertainCapacity` boolean on existing conversation
open, requiring the exact acknowledgment. Separate durable `capacity_releases`
row with original request and new conversation/time. Only unknown/no-run-ID rows
without execution scopes may be released; same-conversation exclusion is
unchanged. Repeated release is idempotent. Known live runs always count.

Reject automatic release on acknowledgment, elapsed deadline or restart: none
proves nonexecution. Reject marking cancelled/failed, deleting rows or resending.
Reject unqualified native search by session/text. UI confirmation explicitly
asks for evidence review and accepts possible overlap with still-running work.

Further research: qualified companion middleware exposes GET only by native ID;
upstream internal idempotency lookup needs scope/fingerprint coupling and has no
qualified read-only route. Native API retains its own concurrency gate. Owned
history now returns unresolved request identity so pre-existing exhausted
installations can recover even without tab receipts; no prompt reconstruction.
