# Implementation plan

Use Bash for component orchestration and the existing Python helpers for JSON handling. No new runtime dependency is required for configuration merging.

1. Correct independent component paths.
2. Give legacy pip calls an automatic per-component runtime, retain explicit runtime overrides, and record dependency failures outside shell return codes.
3. Bind successful server registrations to the installed interpreter or console script; preserve existing custom registrations and non-MCP settings with backups. Use the same generated template for Hermes translation.
4. Test protected-system selection, failed creation/install, swallowed errors, component independence, launch command matching, selection filtering and upgrade preservation. Run project declaration checks and relevant contract suites.
5. Document migration and limitations, prepare patch release metadata, publish a PR.

Constitution: keep dependencies isolated, do not override PEP 668, preserve operator state, and report test coverage honestly. No tools, device interfaces or HUD behavior added; those surfaces need no feature changes. Analyze requirement-to-test coverage before PR.

Follow-up: retain isolation but use explicit component-specific UML bounds for its newer SDK. Declare Memory MCP package contents. Use a module launcher and import check for MemPalace, whose upstream file became a package. Extend tests for these observed installer failures.
