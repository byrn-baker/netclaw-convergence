#!/usr/bin/env bash
# Offline installer contracts. Native/provider qualification remains explicit.
set -euo pipefail
SETUP_INSTALLER_TEST_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$SETUP_INSTALLER_TEST_REPO"

# Do not inherit opt-in runtime, acquisition, service-manager or provider test
# authority from the calling shell. The contract runner supplies the private
# dependency interpreter through PATH; actual platform passes run separately.
while IFS= read -r setup_test_name; do
    case "$setup_test_name" in
        NETCLAW_TEST_*|NETCLAW_SETUP_*) unset "$setup_test_name" ;;
    esac
done < <(compgen -e)

exec python3 -m unittest discover -s tests -p 'test_setup*.py'
