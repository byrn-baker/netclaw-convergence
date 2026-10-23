# Verification
- Full UI suite: 301 passed before the final duplicate-reference regression.
- Final catalog tests: 4 passed, including profile redaction, primary-profile precedence, unknown/stale selection rejection and agent defaults.
- Real API fixture confirms selected model is forwarded via x-openclaw-model, switching back to default sends the primary reference, and rejected selections never reach the gateway.
- Production build passed with the existing bundle-size warning.
- Real Chromium on the Ethernet URL rendered the live catalog. With a synthetic intercepted chat response, verified selected payload, disabled selector while pending, displayed reply, default reset and no page errors.
- This host currently has one distinct configured backend model. No additional models or provider credentials were added. No paid model call or device operation was performed for this feature.
- GUI API restarted to load changes; global model configuration unchanged.

Placement correction: moved Model into the composer's bottom-right toolbar beside a circular send button, inside the same rounded surface as the text area. Removed the separate top model row. Chromium checks at 1280px and 390px confirm the selector is below the textarea, left of Send, and within the viewport. Existing browser interaction checks and production build pass. Desktop screenshot inspected.
