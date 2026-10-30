# Prompt for the live NetClaw build-host agent

Paste the following into the live host agent. The report supports compatibility research and test-resource designation; it does not authorize live tests or replace fresh-install acceptance.

```text
We are qualifying NetClaw Spec 153: fresh Mac installation, WSL coverage, then publication and a demo recording.

Prepare a SANITIZED, READ-ONLY compatibility report. Do not install, upgrade, restart, reconfigure, enroll or remove anything. Do not run provider turns, send channel messages or contact network devices. Creating the report files locally is allowed.

Report only:
1. OS/version, architecture; Node, npm, Python, uv, Git and VS Code versions where available.
2. Each detected claw, separately aliased claw-A/claw-B: NetClaw source version/commit, OpenClaw/Hermes version/commit, standalone/Border/member role, installation/service type. Omit home paths, usernames, hostnames and Git remote URLs.
3. Provider names, model IDs and API modes. Credential status ONLY as configured/absent/unknown. Local versus hosted; omit private endpoint URLs.
4. Channel type, exact plugin/package version and configured/absent/unknown. Omit tokens, accounts, destinations, conversations and receipts.
5. Component/package versions and OpenShell, DefenseClaw, n2n/iN2N and certificate support. Separate installed, configured and previously verified. Executable presence does not prove enforcement.
6. Known setup issues: sanitized error codes, affected versions, safe reproduction descriptions and existing test summaries. No raw logs or config dumps.
7. ONLY already designated disposable test resources, using aliases: provider test account, test channel, lab device. Otherwise say “none designated.” This report does not authorize their use.

Create spec153-live-host-report.md and spec153-live-host-report.json, plus a short list of unknowns and version incompatibilities. Build them from the field allowlist above. Use null/unknown when a fact cannot safely be established.

Never copy .env files, full configs, testbeds, databases, session history, private keys, certificates, Keychain contents or credentials. Do not print raw command output that could contain secrets. Review BOTH files for private data before handing them to me. Do not upload or send them anywhere. Tell me their local paths so I can give the sanitized report to the build agent.
```
