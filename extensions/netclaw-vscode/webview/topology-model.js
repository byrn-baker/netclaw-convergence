export function topologyModel(observation) {
  const d = observation?.data ?? observation ?? {},
    local = d.local && typeof d.local === "object" ? d.local : null,
    peers = Array.isArray(d.peers) ? d.peers : [];
  const nodes = [],
    edges = [];
  if (d.available === false)
    return {
      available: false,
      sourceKind: "bgp-sessions",
      nodes,
      edges,
      total: 0,
      source: observation?.source || "/api/bgp",
    };
  if (local)
    nodes.push({
      id: "local:" + String(local.routerId ?? local.router_id ?? "speaker"),
      label: String(local.routerId ?? local.router_id ?? "Local speaker"),
      role: "Local speaker",
      state: "Source-reported configuration",
      asn: local.as ?? local.asn,
    });
  const total = peers.length + (local ? 1 : 0);
  for (const [i, p] of peers.entries()) {
    if (nodes.length >= 200) break;
    const id = String(p.peer ?? p.peerIp ?? p.routerId ?? p.id ?? "peer-" + i);
    if (nodes.some((n) => n.id === id)) continue;
    nodes.push({
      id,
      label: id,
      role: "Peer session",
      state: String(p.state ?? p.sessionState ?? p.status ?? "Not reported"),
      asn: p.as ?? p.asn ?? p.remote_as,
    });
    if (local)
      edges.push({ from: nodes[0].id, to: id, type: "reported BGP session" });
  }
  return {
    available: true,
    sourceKind: "bgp-sessions",
    nodes,
    edges,
    total,
    source: observation?.source || "/api/bgp",
    observedAt: observation?.observedAt || d.generatedAt,
  };
}
