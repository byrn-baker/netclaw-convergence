# From an Equinix question to an approved network operation

Draft for editorial handoff. The integration has offline validation; scenarios below
are proposed workflows, not accounts of operations performed on a customer network.

Equinix's September 24 announcement adds Network Edge visibility to the Fabric MCP
server. That gives NetClaw another useful source of evidence: the provider side of
a path that may also cross a cloud, a virtual router and an enterprise network.
[Announcement](https://community.equinix.com/network-edge-11/what-s-new-fabric-mcp-server-adds-network-edge-search-and-visibility-tools-1222).

Consider a request: “Our cloud path is congested. Find the constraint, propose a
change, and carry it out once approved.” A device showing a healthy interface cannot
answer the whole question. NetClaw can ask the Equinix specialist about the provider
resources, a cloud specialist about the far side, and a device specialist about the
local handoff. Each keeps its credentials and supplies scoped evidence to the Border.
The investigation joins resource identifiers and timestamps, not merely familiar names.

That is the practical power of composability: one investigation can move across
administrative layers while retaining the difference between intent, observation,
prediction and approval. NetBox describes intended service relationships. Device and
provider tools observe their own layers. Batfish or Topolograph can inform a change
review where their models cover the relevant network. Measurements test a reachable
path. None of these sources automatically proves the others correct.

## Three workflows worth demonstrating

**Trace an edge ACL association.** Find Network Edge devices associated with a
particular ACL template, locate their metros, then examine the corresponding Fabric
and cloud paths. The answer should distinguish an allowed rule from proven reachability.
Device CLI checks remain with the platform that owns that device.

**Review and execute a bandwidth change.** Read the connection and dependencies,
collect relevant performance evidence, and propose a target bandwidth with costs,
impact and verification. Prepare the exact MCP call and bind its digest to a human-
approved ServiceNow change. Execute only in Implement, then re-read provider state
and measure the path again. The interesting result is a defensible change record,
not just a successful API response.

**Investigate apparent redundancy.** Compare provider connections and routers with
cloud and local routing evidence. Two named connections do not prove independent
failure domains. Report what is known, what needs confirmation and what simulation
predicts. Turn that evidence into a sourced diagram or review document using NetClaw's
existing visualization and document skills.

## Operations with an approval boundary

This integration goes beyond reads. Equinix documents creation, modification and
operational actions in its Fabric MCP. NetClaw exposes reviewed operations behind
an additional local gate. An observed baseline and exact call digest bind execution
to the approved CR; an unapproved record, a blocking incident or unavailable GAIT
stops the write. Enabling write mode or granting broad OAuth consent does not approve
a change. [Fabric tool catalog](https://docs.equinix.com/equinix-api/mcp-servers/fabric-mcp-server/).

There are real limits. The official MCP exposes no delete tools, and the announced
Network Edge tools provide visibility rather than virtual-device CRUD. A plan must
not promise rollback that the tools cannot perform. Provisioning also needs read-back
verification, and an ambiguous timeout must not trigger another billed create.
[Network Edge catalog](https://docs.equinix.com/equinix-api/mcp-servers/ne-mcp-tools/).

The outcome to demonstrate is a coherent chain: scoped evidence, a reviewed proposal,
externally approved execution, fresh verification and an audit trail. The MCP supplies
the provider interface. NetClaw's skills and specialist members supply the operational
workflow around it.
