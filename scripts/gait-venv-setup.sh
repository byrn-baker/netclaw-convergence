#!/usr/bin/env bash
# Create a verified isolated GAIT generation; retain prior runtime for --restore.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${NETCLAW_PY:-python3}" "$SCRIPT_DIR/setup-gait-runtime.py" "$@"
