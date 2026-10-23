# Plan

Add validated HUD_HOST configuration for a concrete IP. Allow that exact UI authority and origin in the shared guard, with remote socket access enabled only in Vite. Install the guard before HTTP proxy handling and on WebSocket upgrades. Keep the API bound to loopback. Document the command and trust boundary. Test default behavior, explicit binding, hostile headers, API isolation and actual proxied HTTP/WebSocket requests.

Analysis: this is a host UI change, not device deployment. No new dependencies or credentials are needed. This separate branch builds on the existing installer work without adding changes to its PR. Wildcard binding is excluded because it cannot define an exact trusted browser authority.
