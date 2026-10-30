# NetClaw deployment preset

Compatibility: Specify 0.7.1, source c12293c3dac84bf20fccb7dfc455a76792d7a6d6. Use the extension command to create a fresh deployment workspace outside the checkout and runtime homes. It uses an isolated pinned CLI, adds this preset with `specify preset add --dev`, and checks effective templates and emitted client content. No automated workflow dispatch is used.

The example is deliberately an incomplete, non-executable draft. The six commands produce deployment artifacts and stage native review. An assistant cannot apply or resume setup. Never put credentials in these documents. All findings must be resolved before submitting review. Report write-back uses the default redacted Claw Report and a separately selected, revision-checked destination.

A project override displaces preset templates. If resolution fails, inspect `.specify/templates/overrides` and preserve your custom content deliberately; do not claim the NetClaw workflow is active until the resolution check passes. The extension does not overwrite an existing deployment workspace.
