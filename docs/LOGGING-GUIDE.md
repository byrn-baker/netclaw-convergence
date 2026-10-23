# Logging and troubleshooting

The HUD **Logs** view reads fixed service sources without accepting shell commands
or arbitrary file paths. Select a service, severity and literal substring; refresh
once or opt into a five-second refresh. The file reader takes at most 256 KiB and
returns the last 250 matching lines. Journal readers take at most 250 entries.
Filters cover that tail only, not full history. Missing files, unsupported journals
and permission failures appear as unavailable. Severity is parsed or inferred.
Known credential patterns are redacted on the server; review operational details
before copying logs elsewhere. Logs remain local; no remote collector is started.

## Service commands

These are read-only commands for your terminal. The HUD offers a copy button;
it does not execute arbitrary commands. Linux journal commands require systemd
user services. macOS installations generally use the file sources instead.

```sh
# Gateway (file-based installs)
tail -n 200 ~/.openclaw/logs/gateway.log
tail -n 200 ~/.openclaw/logs/gateway.err.log
# BGP / NCFED federation daemon
tail -n 200 /tmp/bgp-daemon-v2.log
# ngrok mesh transport
tail -n 200 /tmp/ngrok-mesh.log
# OpenShell build log (not runtime confinement proof)
tail -n 200 /tmp/sandbox-build.log
# DefenseClaw launcher output, when this launch path is used
tail -n 200 ~/.defenseclaw/gateway.log
# Linux services: bounded snapshots
journalctl --user -u openclaw-gateway.service -n 200 --no-pager
journalctl --user -u netclaw-mesh.service -n 200 --no-pager
journalctl --user -u defenseclaw-sidecar.service -n 200 --no-pager
# Follow until Ctrl+C
journalctl --user -u netclaw-mesh.service -f
# Time and severity filters
journalctl --user -u openclaw-gateway.service --since '30 min ago' -p warning --no-pager
# Edge enrollment events (the CLI preflight recommends this)
journalctl --user -u netclaw-mesh.service --since '2 min ago' --no-pager | rg -i edge
# File text filters (literal substring)
rg -i -F 'heartbeat' /tmp/bgp-daemon-v2.log
```

Configured service names/paths may vary. Use `python3 scripts/in2n-services.py status`
to inspect generated member services before selecting their actual unit name;
then use `journalctl --user -u <actual-unit> -n 200 --no-pager`. The HUD intentionally
does not accept arbitrary unit names. Installer output names its log directory;
read the reported component log there rather than assuming it is a runtime log.

## Logging commands and scripts

The generated [CLI reference](reference/CLI-REFERENCE.md) indexes every supported
repository script entry point found by source inspection, including flags and
argument declarations. Search Documentation → CLI reference for:

- `scripts/netclaw`: `peering status|bgp|n2n|ngrok`, `risk health|edge-check`, and
  `chats [id-prefix]` / `chats --watch [seconds]`. Chat transcripts are conversations,
  not service logs; they can contain private content.
- `scripts/edge-heartbeat.py`: bounded gateway-journal heartbeat investigation.
- `scripts/measure-turn-latency.py`: gateway-log turn latency measurements;
  `MEASURE_LOG_SOURCE=file` selects its documented file mode.
- `scripts/in2n-services.py`: service status and generated service configuration.
- `scripts/peering-setup.sh` and `scripts/peering-launch.py`: daemon lifecycle and
  log location. Start/stop actions are mutations, not log reads.
- `scripts/cloudflared-transport.sh`: transport status and journal commands.
- `scripts/install.sh`: per-component installer logs (distinct from runtime logs).
- `scripts/netclaw-secure-start.sh`: sandbox build and DefenseClaw launch logs.

## Device syslog and other collectors

Select the system that actually owns the data: syslog-mcp receiver, Grafana/Loki,
Elasticsearch, Splunk, Datadog, or cloud logging. Establish the collector and time
window before interpreting an empty query. A newly launched stdio syslog receiver
has its own in-memory store; do not start another receiver and present an empty
store as the running collector's history. The Logs view offers an explicit Canvas
investigation handoff for the existing configured tools. It does not silently bind
UDP 514, start collection, or combine unrelated collectors.

Follow the [syslog receiver skill](../workspace/skills/syslog-receiver/SKILL.md),
[Elasticsearch guide](../workspace/skills/elasticsearch-logs/SKILL.md), and relevant
collector procedures. Preserve event timestamp, collector, host/device identity,
severity and query scope in findings. Missing logs are not proof of a healthy device.

## Sean's community guide

[Sean Mahoney's NetClaw guide](https://www.seanmahoney.ai/guides/netclaw-overview/)
provides a community architecture overview. Its published counts reflect July 2026;
the repository and generated reference describe this checkout.

Security mode interpretation: [Security modes, DefenseClaw and OpenShell](SECURITY-MODES.md).
