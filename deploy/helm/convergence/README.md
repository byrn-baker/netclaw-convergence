# Convergence data plane

This chart depends on the reusable `victoria-stack` chart and adds PostgreSQL 16,
the Convergence API, Loki compatibility, and probe services. It reuses an external
Grafana and accepts credentials only through an independently managed Secret.

```sh
helm dependency build deploy/helm/victoria-stack
helm dependency build deploy/helm/convergence
helm upgrade --install convergence deploy/helm/convergence \
  -n netclaw-convergence --create-namespace \
  -f deploy/helm/profiles/convergence-home.yaml --wait --timeout 10m
helm test convergence -n netclaw-convergence --logs
```

Prepare `existingSecret` and load/publish the immutable `api.image` first. The home
profile runs alongside Docker with read-only metric federation and quiet alerts;
it does not migrate case/log history, redirect devices, or switch the HUD. Initial
cases and logs in the new stores are clearly labelled verification canaries.

The API waits for PostgreSQL before initializing its schema; readiness requires
the case table. Current AMD64 image scheduling is pinned in the home profile.
For another purpose that needs only Victoria, install `victoria-stack` directly.

[Credentials, image bootstrap, shared Grafana and cutover planning](https://github.com/byrn-baker/netclaw-convergence/tree/main/deploy/helm).
