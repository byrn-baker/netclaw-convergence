#!/usr/bin/env bash
# Dependency-only replacements for legacy steps with prompts or host mutation.
# Host package/service changes and external API checks are never run here.
set -euo pipefail
umask 077
[ "$#" -eq 3 ] || exit 2
component="$1"; private_source="$2"; selected_home="$3"
[ "${HOME:-}" = "$selected_home/.setup/os-home" ] || exit 7
[ "$private_source" = "$selected_home/.setup/source" ] || exit 7
[ -f "$selected_home/.netclaw-setup-owner.json" ] || exit 7
NETCLAW_DIR="$private_source"; NETCLAW_INSTALL_COMPONENT="$component"
NETCLAW_RUNTIME_ROOT="$selected_home/python-runtimes"
export NETCLAW_DIR NETCLAW_INSTALL_COMPONENT NETCLAW_RUNTIME_ROOT
source "$NETCLAW_DIR/scripts/lib/common.sh"
source "$NETCLAW_DIR/scripts/lib/pip-helper.sh"
define_paths
[ "$RUNTIME_HOME" = "$selected_home" ] || exit 7
cd "$NETCLAW_DIR"
clone_owned() {
    local destination="$1" origin="$2"
    # Failed or ambiguous clones need inspection; never pull/reset an old tree.
    [ ! -e "$destination" ] || return 7
    git clone -- "$origin" "$destination"
}
case "$component" in
  gtrace)
    command -v go >/dev/null || exit 78
    # Pinned release; the selected host must already provide Go >=1.24.2.
    # Refuse automatic toolchain installation or global binary/capability writes.
    export GOTOOLCHAIN=local
    go install -ldflags '-X main.Version=v0.15.1' github.com/hervehildenbrand/gtrace/cmd/gtrace@v0.15.1
    ;;
  nsm|batfish|packet-buddy|worldlabs-marble)
    netclaw_pip_install -r "$MCP_DIR/$component-mcp/requirements.txt"
    ;;
  nmap)
    clone_owned "$MCP_DIR/nmap-mcp" https://github.com/sbmilburn/nmap-mcp.git
    netclaw_pip_install -r "$MCP_DIR/nmap-mcp/requirements.txt"
    ;;
  checkpoint)
    clone_owned "$MCP_DIR/checkpoint-mcp-servers" https://github.com/CheckPointSW/mcp-servers.git
    cd "$MCP_DIR/checkpoint-mcp-servers"
    npm install --no-audit --no-fund
    printf 'n\n' | npm run build
    ;;
  threejs-viz)
    clone_owned "$MCP_DIR/sketchfab-mcp-server" https://github.com/gregkop/sketchfab-mcp-server.git
    git -C "$MCP_DIR/sketchfab-mcp-server" apply "$NETCLAW_DIR/scripts/patches/sketchfab-mcp-license-fix.patch"
    cd "$MCP_DIR/sketchfab-mcp-server"
    npm install --no-audit --no-fund
    npm run build
    ;;
  comfyui-viz)
    clone_owned "$MCP_DIR/comfyui-mcp" https://github.com/shawnrushefsky/comfyui-mcp.git
    cd "$MCP_DIR/comfyui-mcp"
    npm install --no-audit --no-fund
    npm run build
    cd "$NETCLAW_DIR"
    netclaw_pip_install -r "$MCP_DIR/topology-diagram-mcp/requirements.txt"
    netclaw_pip_install -r "$MCP_DIR/image-style-mcp/requirements.txt"
    ;;
  rag-mcp)
    # Model prefetch has its own size/consent flow. Never download models or
    # install LibreOffice as an incidental effect of installing this package.
    netclaw_pip_install -e "$MCP_DIR/rag-mcp"
    ;;
  aws|ipfabric|elastic|github)
    # Existing uvx/npx or remote/container transports: native discovery is the
    # operational check. No shell bootstrap, placeholder credentials or images.
    ;;
  *) exit 2 ;;
esac
