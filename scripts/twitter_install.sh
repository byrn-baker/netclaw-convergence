#!/usr/bin/env bash
# Twitter MCP Server Installation Script
# Configures Twitter/X integration for NetClaw

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
TWITTER_MCP_DIR="$NETCLAW_DIR/mcp-servers/twitter-mcp"
ENV_FILE="${HOME}/.openclaw/.env"

set_env() {
    printf '%s' "$2" | python3 "$NETCLAW_DIR/scripts/write-env.py" "$ENV_FILE" "$1"
}

echo "========================================="
echo "  NetClaw Twitter/X Integration Setup"
echo "========================================="
echo ""
echo "  Free Tier: One-way broadcast only"
echo "  - Post tweets (≤280 chars)"
echo "  - Post threads (auto-split)"
echo "  - Post with images"
echo "  - 50 tweets/24hr limit"
echo ""
echo "  Cannot read mentions or replies"
echo ""

# ═══════════════════════════════════════════
# Step 1: Check prerequisites
# ═══════════════════════════════════════════

log_step "1/4 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    log_error "Python 3.10+ is required. Install from https://python.org/"
    exit 1
fi

PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)' 2>/dev/null || echo "0")
PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)' 2>/dev/null || echo "0")
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
    log_error "Python 3.10+ required. Found: Python $PY_MAJOR.$PY_MINOR"
    exit 1
fi
log_info "Python 3.$PY_MINOR detected"

if [ ! -d "$TWITTER_MCP_DIR" ]; then
    log_error "Twitter MCP directory not found: $TWITTER_MCP_DIR"
    exit 1
fi
log_info "Twitter MCP found: $TWITTER_MCP_DIR"

# ═══════════════════════════════════════════
# Step 2: Install dependencies
# ═══════════════════════════════════════════

log_step "2/4 Installing Python dependencies..."

source "$NETCLAW_DIR/scripts/lib/pip-helper.sh"
netclaw_pip_install -r "$TWITTER_MCP_DIR/requirements.txt" || {
    log_error "Dependency installation failed; setup stopped before configuration."
    exit 1
}
log_info "Dependencies installed"

# ═══════════════════════════════════════════
# Step 3: Configure credentials
# ═══════════════════════════════════════════

log_step "3/4 Configuring Twitter API credentials..."
echo ""
echo "  To get Twitter API credentials:"
echo "  1. Go to https://developer.twitter.com/en/portal/dashboard"
echo "  2. Create a project and app (Free tier is sufficient)"
echo "  3. Under 'Keys and tokens', generate:"
echo "     - Consumer Keys (API Key and Secret)"
echo "     - Access Token and Secret (with Read and Write permissions)"
echo ""

# Create .env file directory if needed
mkdir -p "$(dirname "$ENV_FILE")"

# Check if credentials already exist
if grep -q "TWITTER_API_KEY=" "$ENV_FILE" 2>/dev/null; then
    log_info "Twitter credentials already configured in $ENV_FILE"
    read -r -p "Reconfigure Twitter credentials? [y/N]: " reconfigure
    if [[ ! "$reconfigure" =~ ^[Yy] ]]; then
        log_info "Keeping existing credentials"
    else
        read -r -p "Twitter API Key (Consumer Key): " api_key
        read -r -p "Twitter API Secret (Consumer Secret): " api_secret
        read -r -p "Twitter Access Token: " access_token
        read -r -p "Twitter Access Secret: " access_secret

        # Update existing values
        set_env "TWITTER_API_KEY" "$api_key"
        set_env "TWITTER_API_SECRET" "$api_secret"
        set_env "TWITTER_ACCESS_TOKEN" "$access_token"
        set_env "TWITTER_ACCESS_SECRET" "$access_secret"
        log_info "Twitter credentials updated"
    fi
else
    read -r -p "Configure Twitter credentials now? [Y/n]: " configure
    if [[ "$configure" =~ ^[Nn] ]]; then
        log_warn "Skipping credential configuration — add manually to $ENV_FILE"
    else
        read -r -p "Twitter API Key (Consumer Key): " api_key
        read -r -p "Twitter API Secret (Consumer Secret): " api_secret
        read -r -p "Twitter Access Token: " access_token
        read -r -p "Twitter Access Secret: " access_secret

        # Append to .env
        set_env "TWITTER_API_KEY" "$api_key"
        set_env "TWITTER_API_SECRET" "$api_secret"
        set_env "TWITTER_ACCESS_TOKEN" "$access_token"
        set_env "TWITTER_ACCESS_SECRET" "$access_secret"
        set_env "TWITTER_HEARTBEAT_ENABLED" "false"
        set_env "TWITTER_HEARTBEAT_INTERVAL" "14400"
        log_info "Twitter credentials saved to $ENV_FILE"
    fi
fi

# ═══════════════════════════════════════════
# Step 4: Configure heartbeat (optional)
# ═══════════════════════════════════════════

log_step "4/4 Heartbeat configuration (optional)..."
echo ""
echo "  Heartbeat Mode: NetClaw autonomously posts CCIE-level insights"
echo "  - Default: Every 4 hours (6 tweets/day)"
echo "  - Categories: tip, hot_take, til, achievement, musing, community"
echo "  - Disabled by default (requires explicit opt-in)"
echo ""

read -r -p "Enable heartbeat tweets? [y/N]: " enable_heartbeat
if [[ "$enable_heartbeat" =~ ^[Yy] ]]; then
    if grep -q "TWITTER_HEARTBEAT_ENABLED=" "$ENV_FILE" 2>/dev/null; then
        set_env "TWITTER_HEARTBEAT_ENABLED" "true"
    else
        set_env "TWITTER_HEARTBEAT_ENABLED" "true"
    fi
    log_info "Heartbeat enabled — NetClaw will tweet every 4 hours"

    read -r -p "Custom interval in seconds? [14400]: " interval
    if [ -n "$interval" ]; then
        if grep -q "TWITTER_HEARTBEAT_INTERVAL=" "$ENV_FILE" 2>/dev/null; then
            set_env "TWITTER_HEARTBEAT_INTERVAL" "$interval"
        else
            set_env "TWITTER_HEARTBEAT_INTERVAL" "$interval"
        fi
        log_info "Heartbeat interval set to $interval seconds"
    fi
else
    log_info "Heartbeat disabled — use twitter-share skill for manual tweets"
fi

# ═══════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════

echo ""
echo "========================================="
echo "  Twitter Integration Setup Complete"
echo "========================================="
echo ""
echo "  MCP Server: $TWITTER_MCP_DIR/server.py"
echo "  Credentials: $ENV_FILE"
echo ""
echo "  Available Skills:"
echo "    twitter-heartbeat  — Autonomous CCIE-persona tweets"
echo "    twitter-share      — Manual tweet posting (human approval required)"
echo ""
echo "  MCP Tools (9):"
echo "    twitter_post_tweet           — Single tweet (≤280 chars)"
echo "    twitter_post_thread          — Thread for long content"
echo "    twitter_post_tweet_with_media — Tweet with image"
echo "    twitter_delete_tweet         — Delete by ID"
echo "    twitter_get_rate_limits      — Check 50/24hr quota"
echo "    twitter_generate_heartbeat_content — Heartbeat prompt"
echo "    twitter_check_duplicate      — Deduplication check"
echo "    twitter_get_history          — Recent tweet history"
echo "    twitter_post_heartbeat       — Post heartbeat tweet"
echo ""
echo "  Content Guardrails:"
echo "    ✓ IPv4/IPv6 sanitized to RFC 5737/3849 documentation ranges"
echo "    ✓ MAC addresses blocked"
echo "    ✓ Credentials and internal hostnames blocked"
echo "    ✓ #netclaw hashtag enforced"
echo ""
echo "  To test: Ask NetClaw to 'tweet about BGP path selection'"
echo ""
