import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./load.mjs";
const { topologyModel } = await load("webview/topology-model.js");
test("BGP graph carries reported sessions only, exact IDs, explicit source and a bounded scene", () => {
  const g = topologyModel({
    source: "/api/bgp",
    observedAt: "now",
    data: {
      local: { router_id: "192.0.2.1", asn: 64500 },
      peers: [
        { peer: "192.0.2.2", state: "Established" },
        { peer: "192.0.2.3", state: "Idle" },
      ],
    },
  });
  assert.equal(g.sourceKind, "bgp-sessions");
  assert.equal(g.nodes[1].id, "192.0.2.2");
  assert.equal(g.edges.length, 2);
  assert.equal(g.nodes[2].state, "Idle");
  const none = topologyModel({ data: { available: false, peers: [] } });
  assert.equal(none.available, false);
  assert.equal(none.nodes.length, 0);
  const large = topologyModel({
    data: {
      local: { router_id: "local" },
      peers: Array.from({ length: 500 }, (_, i) => ({ peer: "peer" + i })),
    },
  });
  assert.equal(large.nodes.length, 200);
  assert.equal(large.total, 501);
  assert.equal(large.edges.length, 199);
  assert.equal(
    topologyModel({ data: { peers: [{ peer: "alone" }] } }).edges.length,
    0,
  );
});
