# Return from WSL, release review and recording

**Order is fixed: complete Mac → Windows/WSL smoke and platform differences → back to Mac regression → package readiness, recording and human walkthrough.** Every Mac exit row in [MAC-COMPLETION.md](MAC-COMPLETION.md) now passes. Use the new Mac-complete source handoff for the seven Windows/WSL smoke and platform-difference rows.

The recording follows verified behavior. Current Mac engineering evidence is indexed in verification.md, including clean-OS Minimal wizard, installed clients, mixed Risk and synthetic UI/timing checks. Windows, hosted-provider turns and human rehearsal are not claimed.

## Return to this Mac session

Provide the exact pushed Mac baseline and WSL qualification commit identifiers and `spec153-wsl-return/` described in `WSL-HANDOFF.md`. The Mac build agent must verify the imported snapshot digest, inspect the WSL delta, preserve owner edits, reconcile every failure/skip, apply fixes on the Spec153 feature branch and rerun affected Mac checks. Reconcile `spec.md`, `plan.md`, `tasks.md`, `analysis.md` and `verification.md` against actual evidence. A synthetic native review is not a human click or installed-client acceptance.

Complete Windows qualification and affected Mac regression before describing cross-platform coverage as complete. Retain explicit unsupported cases, including the incompatible Webex plugin and unqualified production controls, in release notes and product messaging. Do not silently replace production with testing. Final packaging/publication follows the returned evidence and the owner's release instruction; this handoff performs neither.

## Recording run sheet

1. Start in the NetClaw view with a designated demo claw already present. Show **Existing NetClaw detected**, explain that setup creates a separate installation, and show where existing claws are managed.
2. Choose a new focused claw. Explain harness, provider/model, capabilities, channels and testing/production posture using the actual available choices. Show the Shape Advisor and an override. Do not promise unavailable choices.
3. Show the exact plan and native review, unique home/service/endpoints and the absence of secret values in the plan. Pause capture during native credential input if real test credentials are needed.
4. Apply and show truthful progress. Use a prepared rehearsal to avoid surprising downloads during the recording; disclose any edited wait. Show a cancellation/resume example only from a disposable run, with fresh review and unchanged completed work.
5. Open the Claw Report. Explain Tiers 1–3 and separately show optional live tiers only if actually executed with designated resources. A local canary is not a provider turn. Open the authenticated connection, switch between the two claw identities and demonstrate a scoped management operation with neighbor preservation.
6. Show the WSL evidence and the return-to-Mac outcome, then the verified release/version. End with the route for community feedback; the owner chose organic feedback instead of a recruited five-person study.

Rehearse keyboard navigation, narrow view, dark/light/high contrast and 200% zoom. Record owner observations separately from automated checks. Record the owner's Minimal walkthrough timing separately from the completed automated benchmark; acquisition timing and synthetic measurement limits are in clean-mac-minimal.json.
