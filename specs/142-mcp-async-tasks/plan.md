# Plan

1. Inventory owned/declarative/dynamic tools and reviewed external sources. Capture per-tool eligibility and exclusions before editing.
2. Add exact extension requirements and explicit TasksExtension registrations with distinct queue names and bounded concurrency to eligible servers.
3. Mark eligible existing async tools optional-task capable. Register async thread-offloaded wrappers for selected blocking read tools while retaining original Python functions and schemas.
4. Validate SDK/extension wire behavior with controlled fixtures, foreground fallback, thread responsiveness, cancellation, error handling and authorization. Verify selected actual servers with patched vendor functions only.
5. Add coverage audit and CI contract suite, run catalog comparisons and affected tests. Evaluate external source patches only where the exact reviewed source and runtime can be verified.
6. Update coherence surfaces and release artifacts for the combined unpublished capability, then resume the already authorized PR/release process after checks pass.

Constitution: no live device action; no new MCP registration or HUD node for an extension to existing servers; existing tools and safety controls remain. README, TOOLS, SOUL, relevant skills, environment reference, installer/dependency surfaces and verification must explain adoption. Source publishing remains distinct from operational deployment.
