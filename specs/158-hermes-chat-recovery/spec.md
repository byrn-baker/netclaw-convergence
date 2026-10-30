# Feature Specification: Preserve Submitted Questions and Drafts During Recovery

**Feature Branch**:`158-hermes-chat-recovery`

**Created**:2026-10-29

**Status**:Accepted under the owner's chronological four-issue SDD request

**Input**:[Issue #301](https://github.com/automateyournetwork/netclaw/issues/301), created2026-10-18T04:02:46Z; follows completed specs156/157.

## User Scenarios & Testing

### User Story 1 - Recover the question actually submitted (Priority: P1)

An operator sends ORIGINAL, sees an unknown outcome, edits the restored composer to UNSENT, then checks status. The answer remains paired with ORIGINAL and UNSENT stays editable.

**Why this priority**: Wrong attribution misrepresents what was executed and loses user work.

**Independent Test**: Render the actual Chat component with controlled responses for unknown→completed; inspect transcript, composer and submission count.

**Acceptance Scenarios**:

1. **Given** an unknown request and edited draft, **When** completion is recovered, **Then** the original question and answer appear once and the edited draft remains unchanged.
2. **Given** an untouched restored original draft, **When** completion is recovered, **Then** the original draft is cleared because it has been answered.
3. **Given** a refreshed page or reopened chat, **When** recovery runs, **Then** it uses the recorded original question, never the current composer.

### User Story 2 - Observe repeatedly without duplicate turns (Priority: P2)

An operator checks status again or reloads history and continues to see one turn for the same request.

**Why this priority**: Repeated observations must not imply repeated execution.

**Independent Test**: Repeated recovery, local storage restoration and history loading preserve request identity and one question/answer pair without new submissions.

**Acceptance Scenarios**:

1. **Given** a recovered turn, **When** status is checked again, **Then** its existing identity is reused and no duplicate pair is appended.
2. **Given** an older pending record without original-question evidence, **When** recovery is attempted, **Then** the UI directs the operator to owned history without attributing the answer to a draft.

### Edge Cases

Lost submission response before request ID; changed or cleared draft; repeated identical questions; refresh while observing; history lacking request metadata; storage failure; terminal failure; changed runtime; local Avatar uses the same conversation.

## Requirements

### Functional Requirements

- **FR-001**: The immutable submitted question MUST be saved with its local submission identity before submission and retained through status observation and refresh.
- **FR-002**: Recovery MUST pair the answer with that original question and merge by request identity; repeated observations MUST NOT duplicate turns.
- **FR-003**: A draft edited or cleared after submission MUST survive recovery; only an unchanged restored original may be cleared.
- **FR-004**: Storage, archive and history behavior MUST preserve recovery identity where available and MUST NOT guess attribution when original evidence is missing.
- **FR-005**: Recovery MUST perform observation only, preserve runtime/owner isolation and unknown-outcome protections, and submit no extra agent request.

### Key Entities

- **Submission record**: Original question, local nonce and eventual request identity, separate from editable draft.
- **Transcript turn**: User/assistant messages associated with one request.
- **Draft**: Unsent editable text, independent of recorded submission.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Actual UI regression shows ORIGINAL paired with its answer, UNSENT still in composer and exactly one submission.
- **SC-002**: Repeated recovery and refresh/history tests show one turn per request identity.
- **SC-003**: Missing-origin, unchanged/cleared draft, storage and runtime-isolation cases pass without fabricated attribution.

## Assumptions

Source implementation and isolated React/browser-storage fixtures only; no provider/device or deployed-runtime work. Existing saved records may lack original text and cannot use a draft as a substitute. OpenClaw behavior remains compatible.
