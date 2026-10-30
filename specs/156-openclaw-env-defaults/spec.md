# Feature Specification: Supported OpenClaw Environment Defaults

**Feature Branch**: `156-openclaw-env-defaults`

**Created**: 2026-10-29

**Status**: Accepted for implementation under the owner's four-issue SDD request

**Input**: Address [issue #262](https://github.com/automateyournetwork/netclaw/issues/262), created 2026-09-16T00:44:06Z, first in the requested chronological sequence.

## User Scenarios & Testing

### User Story 1 - Start integrations with valid settings (Priority: P1)

An operator installs an integration without supplying every optional setting and receives the documented defaults instead of unevaluated placeholder text.

**Why this priority**: Invalid numeric settings prevent integrations from starting; invalid flags silently change behavior.

**Independent Test**: Resolve the complete source configuration in an isolated environment and exercise numeric, boolean, URL, list and empty optional settings without starting providers.

**Acceptance Scenarios**:

1. **Given** an absent optional timeout, **When** configuration is prepared, **Then** the integration receives its documented numeric default.
2. **Given** an explicit operator timeout or flag, **When** configuration is prepared, **Then** that value takes precedence over the default.
3. **Given** a missing optional credential, **When** configuration is prepared, **Then** no fabricated credential or unresolved expression is passed to the integration.

### User Story 2 - Maintain and migrate configuration consistently (Priority: P2)

An operator or contributor can find the real defaults, understand how supported configuration is generated, and detect unsupported expressions before release.

**Why this priority**: The same convention affects many registrations and must not recur.

**Independent Test**: Validate the complete registration inventory and run existing installation/configuration regression checks.

**Acceptance Scenarios**:

1. **Given** the shipped configuration, **When** inspected or converted for a runtime, **Then** all variable substitutions use supported syntax and defaults remain documented by integration.
2. **Given** an existing private installation, **When** this source fix is developed and tested, **Then** its credentials, configuration and running services are unchanged.

### Edge Cases

- Explicit empty values, missing values and literal strings containing shell metacharacters.
- Variables shared by multiple integrations, including differing historical defaults.
- Renamed environment fields, optional secrets, remote transport URLs and home-relative paths.
- Both legacy installer and separate-home installer consumers of the source template.

## Requirements

### Functional Requirements

- **FR-001**: All shipped runtime substitutions MUST use supported variable syntax; no shell-style default expression may reach a child integration.
- **FR-002**: Optional values MUST retain documented defaults when absent; explicit nonempty operator values MUST take precedence without shell evaluation.
- **FR-003**: Missing optional secrets MUST remain empty or omitted; credentials MUST never be committed, logged or replaced with invented values.
- **FR-004**: Default behavior MUST be consistent across affected installation and configuration-generation paths, with any historical default conflict resolved and documented explicitly.
- **FR-005**: Contributor validation MUST reject reintroduction of unsupported substitutions and verify the full affected inventory plus representative resolved values.
- **FR-006**: Operator guidance MUST explain defaults and migration through supported setup; testing MUST use temporary configuration and leave existing installations unchanged.

### Key Entities

- **Registration**: One integration's launch settings and environment references.
- **Optional setting**: A variable, documented default and owning integration(s).
- **Operator value**: Installation-specific input that takes precedence over a default.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Zero unsupported default expressions remain in shipped runtime configuration.
- **SC-002**: Every affected optional setting resolves to its documented default when absent and preserves an explicit nonempty override.
- **SC-003**: Regression checks cover numeric, boolean, remote-address, list and empty-secret settings; existing configuration tests pass.
- **SC-004**: No existing runtime, provider or device is modified during verification.

## Assumptions

- The owner authorized local specifications, implementation and verification of all four issues in chronological order.
- This is a defect correction, not a new integration or permission grant. Release publication and external issue/PR communication are separate actions.
- The current source inventory, rather than the historical issue's approximate count, defines coverage.
