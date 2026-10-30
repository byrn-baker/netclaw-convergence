# Reviewed recovery contract

Existing private MCP `hermes_hud_conversation_open` gains optional boolean
`releaseUncertainCapacity=false`; no tool inventory change. When true it requires
`acknowledgedUncertainRequestId`, corresponding unknown/no-ID admission and HUD
namespace. Foreign installation rejected by existing scoped() boundary.

POST /api/chat/conversations accepts the same optional boolean, validates JSON
boolean and owner of acknowledged ID before bridge I/O, then rechecks ownership.
Existing default request continues to acknowledge without releasing. Errors
return conflict and never silently downgrade intent. An old bridge rejecting the
new argument fails safely; no capacity change is claimed.

The client performs runtime verification and presents separate explicit release
confirmation before POST. Cancel makes no POST. Original receipt is retained;
new conversation becomes current only after successful response. No /v1/runs
submission is part of recovery. Known active native runs must use status/stop.

Browser projection eligibility is a display hint; bridge/ledger enforce actual
current state atomically. Audit is committed before native session setup; if setup
or its response fails, retry is safe and the original release remains recorded.

Owned conversation history includes its exact unresolved request ID/state when
present. The browser preserves matching original submission metadata or stores
only identity for a lost receipt; Check status discovers actual eligibility.
A missing original prompt cannot produce an attributed recovered reply.
