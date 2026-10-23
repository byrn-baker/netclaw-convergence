# Coordinated release proposal

Propose NetClaw 1.4.0, a minor release covering specs 135–140 together, for maintainer review. The user requested these related UI changes in one branch and PR. This is a version proposal, not authorization to tag or publish a release. Maintainers should confirm the batch and final version against main before merging.

The changes share the same chat component, private-session bindings and runtime configuration adapter. Shipping them together preserves the tested interface: LAN access, agent selection, model/effort controls, context/quota indicators, Settings, refresh persistence and saved-chat continuation.

Release artifacts are VERSION, CHANGELOG.md and docs/releases/1.4.0.md. Component package versions remain independent. No installer, MCP registration, skill or device behavior is changed; their declarations remain unaffected.
