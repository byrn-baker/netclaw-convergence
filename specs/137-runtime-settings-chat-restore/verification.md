# Verification
- npm test: 311 passed, zero failed.
- Production build passed; existing chunk-size warning remains.
- Real API fixture additionally verifies that graph Settings reads runtime primary model and excludes auth token/profile values from compatibility config.
- Chromium: completed conversation, unsent draft and model selection survive reload; follow-up retains thread ID and history. Interrupted snapshot restores warning/draft through repeated reloads with zero automatic submissions. New chat replaces saved thread and clears the transcript. No browser errors.
- Live LAN Settings now shows source /home/ubuntu/.openclaw/openclaw.json, agent senior-engineer, model openai/gpt-6-astra, no configured fallbacks, actual workspace and loopback gateway port 18789. Raw runtime configuration is not returned.
- API deployment waited until existing GUI/gateway connections ended. No original request was replayed, and no device/model calls were made for verification.
- Storage is per-origin, per-tab sessionStorage. It does not recover conversations lost before this change, guarantee retention after closing the browser, or retrieve an in-flight response after refresh.
