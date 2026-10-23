#!/usr/bin/env bash
# Synthetic/offline only. HUD CI prepares npm dependencies before this harness.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
npm --prefix ui/netclaw-visual run test:canvas
npm --prefix ui/netclaw-visual run test:bundle
python3 scripts/test-install-pyats-genie.py
python3 ui/netclaw-visual/test/genie_adapter_test.py
