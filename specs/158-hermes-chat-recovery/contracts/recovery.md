# Recovery Contract

sendChat accepts optional local recovery anchor (not sent over HTTP), saves original prompt+nonce beforePOST and returns it as submission alongside observed completion. observeRequest remains GET-only and verifies installation/request identity. Completion receipt is retained.

mergeRecoveredTurn requires a recorded prompt/requestId/anchor. Existing matching tagged pair is idempotent. Untagged history is adopted only with matching complete prefix and exact pair at expected position. Otherwise no transcript/draft mutation and explicit owned-history guidance. Repeated identical text at another position never serves as identity.

Only exact draft equality with original prompt permits clearing; edited/empty draft is retained. Pending observation cannot persist old inFlight draft. Unreconciled state blocks new same-thread submissions.
