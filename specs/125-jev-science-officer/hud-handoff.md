# Handoff: Science Officer data in the next HUD

User steering during spec125: keep current HUD work to basic wiring. The function-first three.js redesign follows, preserving Adam Mason's context/chat canvas. Do not spend additional spec125 time polishing the old HUD.

## Already available

- `/api/n2n` carries an `advisors` collection separate from enrolled execution members. `science-officer.js` allowlists snapshot fields: identity/authority, model, availability/freshness, budget totals/scope and latest assessment reference. No provider key, raw evidence or question text reaches this feed.
- `jev_assessment(assessment_id)` retrieves exact dynamic questions, typed answers, evidence metadata/digest, model, cost and parent assessment from the active trusted task. This is MCP, not a browser endpoint.
- Border writes its interpretation and actual influence into the conversation and GAIT, referencing the assessment. Provider judgments and Border interpretation remain distinct.

## Adam's reusable view

Owner: `ui/netclaw-visual/src/canvas-chat/App.jsx`; current chat transport uses `/api/chat`, with node/message history, branches and context/summary/source/action views. Preserve session boundaries and the existing `session-gate.js` protections.

Next HUD should attach an assessment reference to the originating task/message, then offer a Science Officer data view within Adam's existing context/source/summary affordances. Show question wording, labels/rubric, probabilities, model and evidence age; show Border's reported influence separately. Allow comparison of the original and its one reconsideration. Never render a rubric score as a network-health percentage or agreement as verified correctness.

Detailed assessment access needs authenticated, task-scoped server mediation before adding a browser endpoint. Do not expose the ledger globally or infer a message/task relationship from timestamps. The current global latest-status feed intentionally lacks detailed evidence. A missing task binding must show unbound status rather than attaching one user's assessment to another conversation.

Suggested next contract fields: originating task/session/message reference, assessment ID, evidence source references and times, original/reconsideration relationship, typed results, provider/model and usage, and Border-authored influence (`supported`, `challenged`, `changed`, `unavailable`) with explanation. These are proposed future view fields, not a claim that the current canvas already persists them.

No new canvas layout, detailed data view or redesigned three.js graph is implemented in spec125. Existing basic card plus reusable service/status contracts complete its UI scope.
