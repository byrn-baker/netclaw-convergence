#!/usr/bin/env bash
# Fixed dependency-only adapters. No legacy prompts, service start or home selection.
set -euo pipefail
umask 077
[ "$#" -eq 3 ] || exit 2
component="$1"; private_source="$2"; selected_home="$3"
[ "${HOME:-}" = "$selected_home/.setup/os-home" ] || exit 7
[ "$private_source" = "$selected_home/.setup/source" ] || exit 7
[ -f "$selected_home/.netclaw-setup-owner.json" ] || exit 7
case "$component" in n2n|hermes-hud|claw-certs) ;; *) exit 2 ;; esac
NETCLAW_DIR="$private_source"; NETCLAW_INSTALL_COMPONENT="$component"
NETCLAW_RUNTIME_ROOT="$selected_home/python-runtimes"
export NETCLAW_DIR NETCLAW_INSTALL_COMPONENT NETCLAW_RUNTIME_ROOT
source "$NETCLAW_DIR/scripts/lib/common.sh"
source "$NETCLAW_DIR/scripts/lib/pip-helper.sh"
define_paths
[ "$RUNTIME_HOME" = "$selected_home" ] || exit 7
cd "$NETCLAW_DIR"
case "$component" in
  n2n)
    netclaw_pip_install -r "$NETCLAW_DIR/mcp-servers/n2n-mcp/requirements.txt"
    netclaw_pip_install -r "$NETCLAW_DIR/mcp-servers/protocol-mcp/requirements.txt"
    netclaw_pip_install 'cryptography==46.0.5'
    ;;
  hermes-hud)
    [ "$RUNTIME" = hermes ] || exit 7
    netclaw_pip_install -r "$NETCLAW_DIR/mcp-servers/hermes-hud-mcp/requirements.txt"
    ;;
  claw-certs)
    netclaw_pip_install 'cryptography==46.0.5'
    ;;
esac
