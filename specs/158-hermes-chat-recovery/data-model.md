# Data Model

Pending record adds immutable submission {prompt,nonce,anchor:{count,sha256}}. It is saved before the request POST, then requestId/state/result are observed separately. Completed records remain until a reconciled new submission replaces them. Changed runtime keys cannot access another installation's receipt.

Transcript messages add optional validated requestId, retained by chat/archive normalization. Existing schema1 messages remain valid. Recovery anchor canonicalizes only role/content, excludes presentation metadata, hashes the entire prefix and never stores another full transcript. No server field can replace immutable submission metadata.
