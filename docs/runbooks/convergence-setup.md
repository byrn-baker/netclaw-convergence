# Set up Convergence on your own network

Convergence ships a **`convergence-setup`** skill with NetClaw. It guides an LLM
through inspecting the machine, choosing Docker/K3s or existing-stack reuse,
configuring telemetry and the HUD, and verifying the requested integrations.
It ships through the normal skill deployment for OpenClaw and Hermes; no Codex
plugin or access to the original author's network is required.

From a fresh checkout, ask your coding agent:

> Read `workspace/skills/convergence-setup/SKILL.md` and set up Convergence for my
> home network. Discover what is already running, preserve it, and ask me for
> network choices or credentials you cannot discover.

Once installed, ask NetClaw to **use convergence-setup**. The agent needs tools
that can read the checkout and execute setup on the selected host. Human-only
provider login, missing sudo/SSH rights, or unsupported switch mirroring remain
explicit prerequisites; a skill cannot supply those permissions or credentials.

## Fresh Docker core

The first automated preparation path is a host with Python 3 and Docker Compose
v2. Linux is the host-service and passive IDS reference deployment. The helper
itself uses Python's standard library and can be run before NetClaw is installed.
Use the existing installer for runtime/OS dependencies; see
[setup instructions](../setup-instructions.md).

From the checkout root:

```bash
python3 workspace/skills/convergence-setup/scripts/setup.py preflight

python3 workspace/skills/convergence-setup/scripts/setup.py prepare \
  --output deploy/convergence/generated/home-setup \
  --site home --project netclaw-convergence-home
```

Select free ports based on preflight. Options are `--api-port`,
`--prometheus-port`, `--alertmanager-port`, `--blackbox-port`, and `--receiver-port`.
Supply `--edge-url` only for your own verified management endpoint. To run from
another directory or an installed skill, pass `--repo /path/to/netclaw` before
the subcommand.

The output directory is private and gitignored at this recommended location.
It contains:

| File | Purpose |
|---|---|
| `compose.env` | Unique database/JWT credentials, site-scoped API token, receiver token and core ports |
| `compose.override.json` | Site-specific mounts, separate API image tag and network, layered over the base Compose file |
| `prometheus.yml`, `alertmanager.yml` | Core scrape/callback configuration, with no inherited home-device inventory |
| `receiver-token` | Credential mounted into unprivileged Alertmanager; parent directory is owner-only |
| `receiver.env` | Matching receiver configuration, with model hooks and notifications initially disabled |
| `hud.env` | Selected assignments to merge into the active runtime, preserving other settings |
| `investigation-policy.yaml` | Observe-only policy |
| `deployment.json` | Site/port choices and exact argument arrays to validate/start this deployment |

Preparation writes files only. Execute `commands.validate` from `deployment.json`,
review the configuration, then execute `commands.start_core` to start the five
core services. For the example paths above, the equivalent commands are:

```bash
docker compose -p netclaw-convergence-home \
  --env-file deploy/convergence/generated/home-setup/compose.env \
  -f deploy/convergence/docker-compose.yml \
  -f deploy/convergence/generated/home-setup/compose.override.json config --quiet

docker compose -p netclaw-convergence-home \
  --env-file deploy/convergence/generated/home-setup/compose.env \
  -f deploy/convergence/docker-compose.yml \
  -f deploy/convergence/generated/home-setup/compose.override.json \
  up -d --build postgres prometheus alertmanager blackbox convergence-api

python3 workspace/skills/convergence-setup/scripts/setup.py check \
  --bundle deploy/convergence/generated/home-setup
```

The checker performs GET requests only. It checks the database-backed API, site
access, both core scrape targets, API probe success and Alertmanager. A failed check returns nonzero and identifies
the failing layer without printing credentials. Wait for the first metric scrape
before checking a newly started stack.

Core ports initially bind to loopback. Configure LAN/proxy access for the intended
users after checking port ownership and access controls. The receiver's generated
bind address allows Docker host callbacks; restrict receiver access to selected
collectors and retain its write token. The helper does not change firewalls.

Re-running `prepare` with the same choices preserves files and credentials. It
refuses changed options for the same bundle and refuses unrelated existing
directories. Use targeted, backed-up edits for an existing installation. Never
rotate a database password by pointing a new bundle at an existing volume.

## Finish the selected capabilities

The core foundation does **not** yet establish home-network monitoring. Continue
with the skill's [host setup](../../workspace/skills/convergence-setup/references/docker.md)
and [acceptance checks](../../workspace/skills/convergence-setup/references/acceptance.md):

- Render the receiver service for the actual account/checkout/virtualenv and its
  generated env file. Merge HUD assignments into the selected runtime, build/start
  the HUD, and verify access from the intended subnet.
- Add verified router, switch and wireless telemetry. The generated configuration
  contains no default WAN/device probes or alert rules. Add selected probes,
  per-site rules and adapters, then verify fresh samples before reporting health.
- Test the chosen model/authentication, scoped Guardian case tools and a marked
  canary. Enable bounded investigations only after their separate verification.
- Add requested [IDS capture](convergence-ids.md),
  [Victoria integration](convergence-ids-victoria.md),
  [IP context](convergence-ip-context.md) or [JEV reviews](convergence-jev.md).
  Each has its own credentials, resource and evidence requirements.

The bundle's Prometheus config remains authoritative. When using telemetry
renderers or full-stack overlays, merge their jobs, rule mounts and remote-write
into the active bundle configuration and retain the complete Compose command.
The skill explains these paths; installing Victoria containers alone does not
wire data into them.

## K3s and existing installations

The skill also guides [K3s/reuse](../../workspace/skills/convergence-setup/references/k3s.md)
using the repository's Kustomize packaging. The fresh-config helper is a Docker
core generator, not a K3s installer. Validate context, persistent storage, image
distribution and host-receiver reachability before applying a K3s deployment.

On an existing host, discover and preserve its current env files, overlays,
projects, tokens, databases and runtime. Do not run the fresh generator against
live configuration. The legacy `smoke-docker.sh` starts/rebuilds services and is
not a read-only diagnostic; use the new checker for generated deployments.

## Validation scope

The Docker core path was exercised on Linux from a clean tracked-source checkout
with no operator `.env` files, a different site name, alternate ports, a checkout
path containing spaces, and its own network and volumes. Verification covered
database initialization, both core scrape targets, API probe success,
authenticated case create/read/update, rejection of unauthenticated and cross-site
access, duplicate-case handling, and clearance preserving an active investigation.
Missing device telemetry correctly remained unknown. Automated tests also cover
credential preservation, incomplete bundles, private configuration and skill
deployment.

This validation covers the fresh Docker foundation. K3s, actual device adapters,
HUD/model authentication and packet-capture coverage require the separate checks
above on each installation's hardware and network.
