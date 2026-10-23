# Experience contract

All pages use one semantic shell: eyebrow, title, purpose, selected connection badge, toolbar, live status and sections. Reusable card, fact, field, notice, pill, empty state and disclosure primitives use VS Code tokens. Primary actions stay blue. Forms have persistent labels/help. At 360/700/1200px and 200% zoom, actions wrap and text remains readable. High contrast uses borders/text; decorative imagery hides if needed. Reduced motion disables decoration; no automatic graph motion.

Primary domain layouts follow the exhaustive table in research-visual.md. Unknown shapes show a readable unavailable/unsupported notice with bounded source details, not fabricated summary metrics. Empty source, load failure and empty filter results are distinct. Search/pagination support500 records and preserve focus. Errors never inject markup. New card actions pass allowlisted IDs through the existing viewId/requestId and connection-generation guards.

BGP graphics use only reported local→peer session edges, labeled “BGP sessions · not physical cabling.” Full semantic peer cards work without WebGL. Selection, zoom/reset, theme resize/hide/dispose and context loss are tested. No collectors or additional network sources start by viewing graphics. Existing Chat, Canvas, Avatar and RAG ownership/messaging behavior remains unchanged.

Connection nickname copy explains “friendly name” with “My Mac lab” and “WSL NetClaw” examples. API entry explains localhost on the selected extension host. A saved profile is not labeled connected until verified.
