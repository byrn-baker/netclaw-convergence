# Closest reporting device

The terminal context pane now includes a destination-oriented closest-device
summary, derived from the authorized collector's current snapshots. Hovering
does not open new SSH sessions or issue additional device commands.

Selection is independent for each VRF:

1. For a host IP (including a `/32` hover), prefer a fresh local-address route.
2. Otherwise prefer reporters with a directly connected route covering the
   destination. For a network hover, the route must cover the entire prefix;
   an interface IP somewhere inside an aggregate is not sufficient.
3. If neither is known, infer a closest *known* downstream reporter only when
   all known reporters' next-hop relationships converge on it. Next hops must
   match a fresh local `/32` on the other device in the same VRF. This is a
   routing inference, not a verified physical link or an assertion of ownership.
4. Otherwise show **Undetermined**. A lone learned/default route, ARP record,
   MAC association or neighbor advertisement is not sufficient.

All equal direct/local candidates remain visible. Unknown or conflicting ECMP
branches, duplicate next-hop owners and cycles prevent downstream inference.
Metrics and administrative distances are not compared between routers to
estimate proximity. Stale, failed or withdrawn evidence is excluded. Each
summary shows its evidence, VRF and observation time; inferred paths use the
oldest supporting observation.

An exact fresh interface IP is also shown when the query has no VRF, explicitly
marked **VRF UNVERIFIED**: the current IOS interface sources do not report VRF.
It is not silently merged with scoped routing evidence. IPv6 proximity is not
implemented. Separate sites with the same VRF name still require careful
interpretation, as with the existing collector's routing correlations.

The result is the closest **known** reporting device among authorized snapshots,
not proof that every device or hop has been discovered or is reachable now.
Other records retain their original reporting-device provenance; qualifying
records use the closest-device label, with an inference/candidate qualifier.

## Active terminal perspective

The pane omits the active router's learned/static route reports and associated
generic identity cards from destination reports. Its local and connected routes
remain visible as **Current router — IP is local** or **Current router — directly
connected network**. Other routers' learned routes retain their protocol labels
(for example, **Learned via OSPF**). ARP and neighbor observations from the active
router retain provenance as **Observed on current router**, not IP ownership.

This is a presentation filter keyed by immutable testbed device ID; the complete
backend evidence remains available for correlation. VRF and stale-evidence
qualifiers remain visible. A next-hop IP is evaluated as that host, not as the
OSPF destination on the same terminal line. A connected subnet does not mean
the router owns every address in it. Refresh Canvas to load these label changes.

Restart the NetClaw API once to load this logic, then refresh Canvas. The pane
recomputes from collector snapshots on its existing refresh cycle. Collection
authorization, polling rate and credentials are unchanged.

Run `npm run test:topology-closest` for selection/label regressions, plus
`test:topology`, `test:topology-facts`, and `test:topology-api` for integration
coverage. `/test/terminal-design.html` shows an explicitly synthetic connected
network example; no devices or providers are contacted by that preview.
