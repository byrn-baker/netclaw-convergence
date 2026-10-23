# Security modes, DefenseClaw and OpenShell

The Overview summary and Security destination distinguish four facts. A setting
is not an enforcement measurement, and an unavailable/stale probe is not healthy.

| Setting or observation | Meaning | Source |
|---|---|---|
| NETCLAW_LAB_MODE | Relaxes supported ITSM checks for lab workflows; default false | HUD environment/.env; each tool owns enforcement |
| N2N_RISK_MODE | Federation testing or production preflight; default testing | Daemon environment; compare the reported posture |
| DefenseClaw | Security mode, guardrail mode and model-guard availability | Dedicated config files and federation probe |
| Member confinement | Host-level systemd restrictions on iN2N member services | Federation sandbox probe |
| OpenShell | Separate container gateway/sandbox status | Fixed read-only OpenShell CLI probes |

## LAB versus production

`NETCLAW_LAB_MODE=true` is not the same switch as `N2N_RISK_MODE=testing`.
The former changes supported change-gate behavior; the latter disables production
federation preflight enforcement. Existing tool-specific requirements still apply.
Production should be assessed from current controls, not a green configuration flag.
The HUD labels production enforcement only when a fresh posture explicitly reports
production/enforced and all three required controls have boolean available=true.
Unknown, missing or stale controls stay visible. A LAB bypass remains prominent
alongside any production report.

The Security settings panel is read-only. To change modes, use the existing operator
configuration workflow, review the impact, apply the intended settings and verify the
running daemon's posture afterward. This HUD work does not enable LAB mode, change
production policy, restart services or install security components.

## DefenseClaw

- Security mode belongs in `~/.openclaw/config/openclaw.json`, under `security.mode`
  (`hobby` or `defenseclaw`). Do not write this field into the gateway's root
  `~/.openclaw/openclaw.json`; that has a different schema.
- Guardrail settings are in `~/.defenseclaw/config.yaml`. Observe mode is not
  equivalent to action/blocking enforcement.
- `DEFENSECLAW_GUARD_PORT` defaults to 4000. A configured port does not prove service
  reachability. The existing model-guard probe checks its own requirements.
- The model route and per-agent overrides matter; model-name display is not proof
  that every call was guarded.

```sh
# Read security alerts using the existing CLI
defenseclaw alerts
# Inspect logs through the launch path used on this host
tail -n 200 ~/.defenseclaw/gateway.log
journalctl --user -u defenseclaw-sidecar.service -n 200 --no-pager
```

Setup and policy details: [DefenseClaw guide](DEFENSECLAW.md),
[upgrade guide](UPGRADE-TO-DEFENSECLAW.md). The CLI reference also indexes
`scripts/defenseclaw-enable.sh` and `scripts/netclaw-secure-start.sh`; their start,
stop and installer actions mutate the deployment and are not status commands.

## Member confinement versus OpenShell

The current iN2N sandbox control uses systemd host-level member confinement
(`scripts/in2n-services.py`), preserving the member's configured tools and network
access within its restrictions. It replaced an earlier container-only approach for
this particular control. **An available iN2N sandbox probe does not mean OpenShell
is running.** Conversely, a ready OpenShell container is not evidence that a given
member is confined by its systemd unit.

```sh
python3 scripts/in2n-services.py status
openshell gateway status
openshell sandbox list
./scripts/netclaw-secure-start.sh status
tail -n 200 /tmp/sandbox-build.log
```

The HUD OpenShell panel runs only the first two `openshell` status/list commands,
with fixed arguments, time/output bounds and a 30-second cache. Other commands
are shown as operator references. Sandbox build output is separate from runtime
service logs. The launcher generates `/tmp/netclaw-sandbox-policy.yaml`; inspect
its filesystem/network policy before enabling a sandbox. The HUD never serves
raw policy/config files or the staged credentials.

## Logs, audit and missing controls

Use the Security panel's service-specific log buttons, or the [Logging guide](LOGGING-GUIDE.md).
In production, missing containment blocks delegation. An audit gap warns unless
`N2N_STRICT_ALL` requires every control. The Security panel names missing controls
and retains probe age, instead of deriving a health score.

See also [Risk guide](N2N-RISK.md) and [Function-first HUD guide](HUD-FUNCTION-FIRST.md).
