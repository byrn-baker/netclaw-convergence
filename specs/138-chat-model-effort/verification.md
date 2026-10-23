# Verification

- Unit/API suite: 316 tests passed.
- Production build passed (existing bundle-size warning).
- Browser: seven runtime choices; keyboard-accessible effort slider constrained per model; model/effort payload; reload persistence; effort reset after model switch; desktop 1280px and mobile 390px checks passed. Browser chat requests were intercepted; no inference was sent.
- Installed gateway: a dedicated verification session accepted GPT-6-Luna with low effort, then GPT-6-Astra with effort cleared, including the configured authentication-profile reference. No prompts or device operations ran.
- API fixture: session settings use the server-owned session key; unsupported effort and failed session mutation never reach the inference endpoint; resetting effort sends null.
- Runtime catalog supplies no account pricing, so the slider describes reasoning effort, not an invented model-cost ranking. Native Codex cache narrows gateway effort levels where its published metadata differs.
- Backend restarted after the existing request connection closed. Live catalog and browser checks passed against the updated backend; chat inference remained intercepted.
