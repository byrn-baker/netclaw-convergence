# Research

Decision: retain original normalized seed atomically in Bindings.task and reuse on each open. Ledger.open already checks nonempty seed digest and returns existing conversation; Bridge.submit passes stored history only on first admission. Failed Node setup creates no bridge admission, so the retry is still the first real run. No bridge change required.

Rejected: task.newlyCreated (browser creation is not native initialization); overwrite seed from retries (changes ancestry); separate ready flag (unnecessary cross-store state).

Private retention must enforce UTF-8 byte bounds and reject writes above the reader's8MiB bound before replacing valid state. Existing bindings lacking seed retain omission; never invent original history. Read-only Spec Kit research confirmed these local contracts. No unresolved questions.
