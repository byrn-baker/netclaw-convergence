# NetClaw Twilio environment launcher

This launcher reuses `@twilio-alpha/mcp@0.7.0` and its shipped OpenAPI documents.
It reads `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID` and `TWILIO_API_SECRET` from the
selected claw’s private environment. No credentials are passed in process arguments.
It keeps the existing `twilio_api_v2010` service and Call/Message tag filters.

The installer runs `npm ci --ignore-scripts` from the committed lockfile before
registration. Startup never runs `npx`, fetches packages, imports the package’s
auto-running CLI, authenticates, sends a message or makes a call. Missing/changed
dependencies and invalid credential shape fail with a fixed non-secret diagnostic.

Managed IDE installations register `scripts/setup-comms-launch.py twilio-mcp` in
both runtimes. It checks this source copy's owning home and reads only that home's
private `.env`; the native registration contains file references, not credentials.
Unrelated MCP registrations are preserved. The wrapper is separate from native
SMS and does not start the voice webhook process.

Native SMS is a separate runtime adapter and uses its own Twilio account auth token.
The NetClaw voice MCP/webhook is another process with separate routing and signature
requirements. See [Comms setup](../../docs/COMMS-SETUP.md).
