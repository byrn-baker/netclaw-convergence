# Spec152 milestone draft

The VS Code extension now opens the selected OpenClaw or Hermes installation's six
workspace Markdown files from the upper Connections panel. Operators can read, review
edits, save or upload/overwrite; no delete or rename operation exists. Verified owned
service controls provide full Start/Stop/Restart, including offline Start after editor
reload. Save & Restart runs only after the exact reviewed content is verified on disk.

Implementation and isolated Mac acceptance are complete for the evidence recorded in
verification.md. All 35 native source checks passed; extension regression passed 83
with one optional skip, and HUD regression passed 372. Version 1.1.0 is an unpublished
candidate, packaged and pushed solely for the owner-requested WSL inspection handoff.

The next acceptance environment is the real Windows/WSL installation. Open the candidate
in an ephemeral editor against that actual workspace, inspect without overwriting files
or restarting services, and record identity/host evidence. Linux live ownership controls,
production latency and prompt consumption are not claimed by Mac fixture results.
Merge, deployment and Marketplace publication require later owner direction.
