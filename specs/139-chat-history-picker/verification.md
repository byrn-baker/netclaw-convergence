# Verification
- 322 unit/API tests passed; build passed with the existing chunk-size warning.
- API fixture exercises list, open, unauthenticated rejection and a follow-up using the exact original gateway session key.
- Ownership tests cover foreign cookies, wrong agents, revoked sessions, revocation during an async read and legacy resume aliases.
- Transcript projection excludes system messages, tool output, reasoning and runtime metadata.
- Browser test passed on desktop and mobile: load a previous conversation, send an intercepted follow-up with its original thread and visible context, restore effort, preserve an independent unsent draft, preserve history through New chat and refresh, and send nothing automatically.
- Installed gateway accepted the 1,000-entry / 2 MiB bounded history read and returned 11 visible messages with no further page. Only counts/schema were printed. No inference or device operations were used for verification.
- Backend replaced after the existing request completed. Live history list returned 200 for a fresh browser session; unowned history returned 404. Browser switching checks passed again.
