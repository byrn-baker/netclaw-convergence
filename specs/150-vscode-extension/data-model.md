# Client state

ConnectionProfile: id, label, loopback API URL, execution-host context, pinned
installationId and harness. A profile never starts or switches a runtime.

Session: endpoint+installation identity, private session cookie, generation.
Reject mismatched identity; do not copy browser cookies. Separate assistant sessions.

Conversation: backend conversation ID/thread, runtime kind, selected model/effort,
request reference, pending/unknown status. Keep backend states, no invented receipt.

Context: explicitly selected text/name; bounded, local until a reviewed send.
Canvas: local nodes/links/context plus backend conversation references per branch.

Proposal: assistant-produced draft fields and intended target; no approval token,
backend authority, implicit apply or executable command.

Observation: source endpoint, observedAt, runtime and returned payload; unavailable,
empty and failed are distinct. UI filters apply only to the loaded observation.
