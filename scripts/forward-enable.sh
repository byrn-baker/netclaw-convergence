#!/usr/bin/env bash
# Enable the Forward Networks official MCP for existing NetClaw installations.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${CYAN}[STEP]${NC} $1"; }

NETCLAW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_DIR="$HOME/.openclaw"
OPENCLAW_ENV="$OPENCLAW_DIR/.env"
OPENCLAW_CONFIG="$OPENCLAW_DIR/openclaw.json"

set_env_var() {
    [ -n "$2" ] || return 0
    printf '%s' "$2" | python3 "$NETCLAW_DIR/scripts/write-env.py" "$OPENCLAW_ENV" "$1"
}

get_env_var() {
    python3 "$NETCLAW_DIR/scripts/write-env.py" --get "$OPENCLAW_ENV" "$1"
}

echo "========================================="
echo "  Forward Networks Official MCP"
echo "  for NetClaw"
echo "========================================="
echo ""
echo "  Served by Forward at <your-forward-host>/api/mcp (read-only)"
echo ""

log_step "1/4 Checking prerequisites..."
command -v python3 >/dev/null 2>&1 || { log_error "python3 is required."; exit 1; }
mkdir -p "$OPENCLAW_DIR"
[ -f "$OPENCLAW_ENV" ] || (umask 077; touch "$OPENCLAW_ENV")

log_step "2/4 Configuring credentials..."
echo "  Mint an API token at Settings > Account > API tokens in Forward."
read -r -p "Configure Forward credentials now? [Y/n] " config_now
if [[ ! "$config_now" =~ ^[Nn]$ ]]; then
    read -r -p "Forward base URL (e.g., https://fwd.app): " forward_url
    if [ -n "$forward_url" ]; then
        forward_url="${forward_url%/}"
        forward_url="${forward_url%/api/mcp}"
        case "$forward_url" in
            https://*|http://127.0.0.1|http://127.0.0.1:*|http://127.0.0.1/*|http://localhost|http://localhost:*|http://localhost/*) set_env_var "FORWARD_URL" "$forward_url" ;;
            *) log_error "Forward base URL must start with https:// (the API token is sent as HTTP Basic); not stored." ;;
        esac
    fi

    read -r -p "API token access key: " forward_key
    read -r -sp "API token secret: " forward_secret
    echo ""
    if [ -n "$forward_key" ] && [ -n "$forward_secret" ]; then
        # Key and secret travel over stdin only; never argv.
        forward_auth="$(printf '%s\n%s' "$forward_key" "$forward_secret" | python3 -c \
            'import base64,sys; k,s=sys.stdin.read().split("\n",1); print(base64.b64encode((k+":"+s).encode()).decode())')"
        set_env_var "FORWARD_AUTH_BASE64" "$forward_auth"
    elif [ -n "$forward_key" ] || [ -n "$forward_secret" ]; then
        log_warn "Both the access key and the secret are required; credentials were not changed (any existing FORWARD_AUTH_BASE64 is kept)."
    fi
    unset forward_key forward_secret forward_auth
else
    log_info "Skipping credential prompts. Set FORWARD_URL and FORWARD_AUTH_BASE64 in $OPENCLAW_ENV later."
    log_info "  FORWARD_AUTH_BASE64: echo -n 'accessKey:secret' | base64"
fi

log_step "3/4 Checking NetClaw config..."
if [ -f "$OPENCLAW_CONFIG" ]; then
    if grep -q '"forward-official-mcp"' "$OPENCLAW_CONFIG"; then
        log_info "forward-official-mcp is present in $OPENCLAW_CONFIG"
    else
        log_warn "forward-official-mcp is not present in $OPENCLAW_CONFIG"
        log_info "Copy config/openclaw.json or add the forward-official-mcp block from this repo."
    fi
    if grep -q '"forward-mcp"' "$OPENCLAW_CONFIG"; then
        log_warn "Legacy forward-mcp entry found in $OPENCLAW_CONFIG; remove it (the community server is no longer used)."
    fi
else
    log_warn "$OPENCLAW_CONFIG not found. Run ./scripts/install.sh first."
fi

log_step "4/4 Running smoke test..."
forward_url="$(get_env_var FORWARD_URL)"
forward_auth="$(get_env_var FORWARD_AUTH_BASE64)"
if [ -z "$forward_url" ] || [ -z "$forward_auth" ]; then
    log_warn "Credentials not set; skipping the smoke test. Re-run once FORWARD_URL and FORWARD_AUTH_BASE64 are set."
    exit 0
fi
if FORWARD_URL="$forward_url" FORWARD_AUTH_BASE64="$forward_auth" \
    python3 "$NETCLAW_DIR/scripts/forward-mcp-check.py"; then
    log_info "Forward MCP answered initialize and tools/list"
else
    log_error "Smoke test failed. Check FORWARD_URL, the API token, and that 'Enable MCP server' is on."
    exit 1
fi

echo ""
echo "Forward MCP integration is installed."
echo ""
echo "Next steps:"
echo "  1. Restart the OpenClaw gateway."
echo "  2. Verify MCP registration with your OpenClaw MCP list command."
echo "  3. Try: /forward trace a path from 10.1.1.10 to 8.8.8.8 in network <networkId>"
echo ""
