# Research

Root cause: recover reconstructs user content from mutable draft, then clears it. Adjacent cause: inFlight is never cleared, so observation setPending triggers persistence of old draft. Native Bridge.history exposes role/content only; content-search deduplication would conflate repeated identical questions.

Decision: save submittedPrompt/nonce/recoveryAnchor(count,SHA256 of complete role/content prefix) beforePOST. Preserve them across status response merges. Keep completed receipt; new submit allowed only after UI reconciliation. Persist requestId on both transcript messages. Merge matching IDs; otherwise append only against exact anchored baseline or adopt exact original-position pair with matching prefix; ambiguous history returns guidance without modification. No original metadata means no fabricated question.

Decision: clear inFlight in send finally; observation persists actual current draft. Reset runtime progress on conversation switches. Actual React/JSDOM existing harness can reproduce and verify UI. Read-only Spec Kit Phase0 research completed, no unresolved questions.
