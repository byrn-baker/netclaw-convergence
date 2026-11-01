# Plan

Follow repository spec -> plan -> tasks -> implementation lifecycle explicitly.
T001 ingestion worker owns services/ids-ingest modules/tests/config/Dockerfile.
Use a host_events module for validation, bindings, status and case construction;
reuse Store delivery rows with host-prefixed kinds and server identity envelope.
T002 agent worker owns deploy/convergence/host-agent and its synthetic tests.
Use stdlib and a bounded atomic disk queue, HTTPS-only transport and systemd example.
T003 coordinator owns docs, spec ledger, contract-suite registration and integration.
This includes the existing alert receiver's security-category classification and
a synthetic case-processing test proving host evidence remains T0/observe-only.
T004 independent verifier reads the integrated diff and executes synthetic checks.
No worker deploys, publishes, contacts a VM/provider, or edits another worker's files.

Prototype has no MCP/model integration changes: existing case pipeline is the seam.
README/service/runbook docs applicable; no SOUL/TOOLS/HUD/tool count/catalog change
because no new installed tool or supported UI is being introduced. Full rollout,
server-side resource inventory ingestion and trusted boundary collection deferred.
