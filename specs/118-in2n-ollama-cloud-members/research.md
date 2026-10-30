# Research: iN2N member provider assignments

**Retrospective reconstruction — 2026-10-30.** This artifact was added during
spec 1011 maintenance from repository evidence at `09748c37`. It is not evidence
that planning preceded the historical implementation, and it claims no new runtime
verification. Original documents and their status statements remain unchanged.

## Evidence reviewed

- [specs/118-in2n-ollama-cloud-members/spec.md](../../specs/118-in2n-ollama-cloud-members/spec.md)
- [specs/118-in2n-ollama-cloud-members/tasks.md](../../specs/118-in2n-ollama-cloud-members/tasks.md)
- [scripts/in2n-profiles.py](../../scripts/in2n-profiles.py)
- [scripts/in2n-member-home.py](../../scripts/in2n-member-home.py)
- [scripts/in2n-services.py](../../scripts/in2n-services.py)

## Interpretation and limits

The historical proposal replaces monolithic domain offload with separately scoped
member homes and services. The provisioning/profile/service scripts are the current
implementation anchors; the spec's named models and operator-specific home paths
are historical settings, not portable or current-provider recommendations.

A generated profile is not evidence that a model exists, accepts tools or responds
within budget. Runtime qualification requires current provider access and each
member's actual tool contract. No provider call, home overwrite, service activation
or live configuration removal was performed for this reconstruction.
