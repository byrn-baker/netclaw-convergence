# FRR IPv6 Lab Testbed

This three-router fixture tests OSPFv3 and MP-BGP IPv6 unicast. Run it only on a disposable Linux/WSL lab host: GRE scripts require root and change host/container interfaces, addresses and routes. They are not an installer or production-network procedure. Preserve a baseline and obtain the required change authorization before using them on managed infrastructure. The scripts reserve `gre-netclaw`, `fd00::4/128` on loopback and the listed lab prefixes; do not use a host where those names or addresses belong to another service.

| Segment | Prefix | Endpoints |
|---------|--------|-----------|
| Edge1–Core | fd00:12::/127 | ::0, ::1 |
| Core–Edge2 | fd00:23::/127 | ::0, ::1 |
| Host–Edge1 GRE | fd00:ee::/127 | host ::1, Edge1 ::0 |
| Loopbacks | fd00::1–4/128 | Edge1, Core, Edge2, host |
| Advertised stub | fd00:dead:beef::/48 | Edge2 |

The compose file expects three pre-created IPv6-only Docker networks. Use its documented `docker network create` commands for `frr-testbed_edge1-core`, `frr-testbed_core-edge2` and `frr-testbed_peering`, then run:

```bash
docker compose up -d
sudo bash scripts/setup-gre.sh
bash scripts/verify.sh
```

Inspect actual convergence instead of assuming a fixed startup delay. Manual read-only checks:

```bash
docker exec netclaw-core vtysh -c "show ipv6 ospf6 neighbor"
docker exec netclaw-core vtysh -c "show bgp ipv6 unicast summary"
docker exec netclaw-edge1 vtysh -c "show bgp ipv6 unicast"
ping -6 -c 1 fd00:ee::0
```

The host must support IPv6 GRE and access the Docker bridges; Docker Desktop networking may require a separate disposable Linux VM. Images use floating tags, so record the resolved image digest when gathering reproducible acceptance evidence. Lab default accounts and elevated container capabilities are unsuitable for shared or externally reachable deployments.

Teardown removes the reserved host addresses/tunnel and routes bound to `gre-netclaw`, then stops containers. Inspect the baseline first; do not run teardown if another service has adopted these reserved resources.

```bash
sudo bash scripts/teardown-gre.sh
docker compose down
```

Setup no longer modifies every host bridge to work around mDNS. It leaves unrelated bridges untouched; investigate any mDNS issue separately within its owning service.
