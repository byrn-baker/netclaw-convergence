# K3s and reuse of an existing monitoring stack

Read `deploy/convergence/k8s/README.md`, `SMOKE.md`, and the selected component
README before rendering. For existing monitoring, also read `OVERLAY-PILOT.md`
as an architectural example, not an instruction to scale down another namespace.

Discover the chosen kubeconfig/context, API reachability, node architectures,
storage classes, ingress/load balancer and current monitoring services. Use the
user's explicit context/namespace on commands. A context name in a local file
does not establish cluster reachability or permission to change its resources.

Choose either a fresh isolated Convergence namespace or reuse of compatible
existing Prometheus/Alertmanager/Victoria/Grafana services. Verify APIs, retention,
site labels and authentication for reused services. Keep one authoritative case
database and receiver route; avoid duplicate alert delivery during migration.

For a new deployment:

1. Generate unique database/JWT/API/receiver credentials in private files or the
   existing secret manager. Inspect `secret.example.yaml` and the manifests for
   all required references. Retain credentials when re-running against PVCs.
2. Create a local overlay for site, addresses, namespace, storage, image reference,
   configuration mounts and chosen optional components. Resolve all example
   targets and labels. Render with `kubectl kustomize` and inspect the output
   privately; Secret values must not appear in chat or logs.
3. Build and distribute the API image using the target cluster's registry or its
   supported node import workflow. A local Docker image is not automatically
   available on every K3s node. Verify image architecture and pull availability.
4. Configure Alertmanager and the case API to reach the actual host receiver.
   `host.docker.internal` is a Docker host mapping, not a portable Kubernetes
   endpoint. Verify DNS/routing/TLS from a pod in the target namespace.
5. Apply the selected manifest set, inspect rollout/PVC state and authenticate a
   site-scoped API request. Connect the host HUD to a durable reachable endpoint;
   a terminal port-forward is temporary access only.
6. Add only requested adapters and verify real samples. Kustomize config maps
   embed files; adding a component does not automatically merge all scrape jobs
   into a preexisting Prometheus configuration. Inspect the active mounted config.

Default architecture keeps the agent, scoped Guardian and alert receiver on the
NetClaw host. Optional IDS packet capture needs a verified SPAN/ERSPAN/TAP or
host-level capture path; scheduling an ordinary pod on a VLAN does not give it
visibility into that VLAN's other traffic. Read the IDS branch before deciding
which components can move into the cluster.

The bundled fresh-config helper creates **Docker core** configuration only.
Do not pass its Compose manifest to Kubernetes or describe it as a tested K3s
installer. Verify K3s with its own rendered manifests and acceptance checks.
