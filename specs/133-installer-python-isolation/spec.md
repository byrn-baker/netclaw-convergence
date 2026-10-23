# Spec 133: Installer Python isolation

Status: implemented; under review in PR #279. Date: 2026-10-01.

## Problem and acceptance

A selected BGP install exits on an unset REPO_ROOT. Legacy Python components attempt system installs on PEP 668 hosts, swallow dependency failures, and can report success. Existing onboarded OpenClaw configurations receive no MCP registrations.

P1: Installing a legacy Python component creates an installer-owned isolated runtime without modifying system Python. Each component uses its own runtime; explicitly isolated integrations retain their current runtime.
P1: A failed dependency install, including one inside a subshell or warning handler, fails the component and final installer status. No failed component gets newly activated.
P1: Successful selected components receive matching launch commands and repository working directories. Preserve unrelated configuration, credentials and custom existing launch commands.
P2: BGP and other vendored components work independently of Claw Certification selection.

Verification distinguishes package installation and local protocol startup from remote connectivity. No device changes, external messages or credentialed network operations are authorized by this development task.

## Boundaries

Existing operator environments are not deleted or silently adopted. Retain shared legacy dependency bounds inside automatic component runtimes pending separate dependency upgrades. Remote, Node, uvx and dedicated runtime components retain their transport choices. Failures are conservative: a recovered fallback still requires a clean rerun. No promise that all upstream integrations work without credentials or compatible Python versions.

## Startup compatibility found during validation

Fresh gNMI startup failed because FastMCP rejects the description constructor keyword. Use the supported instructions keyword. Nautobot installs the bundled server declared in the MCP template, rather than an unused community alternative.
