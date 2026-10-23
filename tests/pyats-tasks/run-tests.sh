#!/usr/bin/env bash
set -euo pipefail
TASK_TEST_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec python3 "$TASK_TEST_ROOT/tests/pyats-tasks/check_upstream.py"
