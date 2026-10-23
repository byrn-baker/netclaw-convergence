#!/usr/bin/env bash
# Twilio Voice MCP Server Installation Script
# Configures bidirectional voice calling for NetClaw

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${CYAN}[STEP]${NC} $1"; }

NETCLAW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TWILIO_MCP_DIR="$NETCLAW_DIR/mcp-servers/twilio-voice-mcp"
ENV_FILE="${HOME}/.openclaw/.env"
CONFIG_FILE="$NETCLAW_DIR/config/twilio-voice.json"

set_env() {
    printf '%s' "$2" | python3 "$NETCLAW_DIR/scripts/write-env.py" "$ENV_FILE" "$1"
}

echo "========================================="
echo "  NetClaw Twilio Voice Integration"
echo "========================================="
echo ""
echo "  Bidirectional voice calling:"
echo "  - Emergency alerts (P1 incidents, device down)"
echo "  - On-demand status calls"
echo "  - Inbound voice commands"
echo ""
echo "  Guardrails:"
echo "  - Rate limits: 3/hour, 10/day"
echo "  - Quiet hours: 10 PM - 7 AM (emergency override)"
echo "  - Whitelist-only calling"
echo ""

# ═══════════════════════════════════════════
# Step 1: Check prerequisites
# ═══════════════════════════════════════════

log_step "1/5 Checking prerequisites..."

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

if [ ! -d "$TWILIO_MCP_DIR" ]; then
    log_error "Twilio MCP directory not found: $TWILIO_MCP_DIR"
    exit 1
fi
log_info "Twilio Voice MCP found: $TWILIO_MCP_DIR"

# ═══════════════════════════════════════════
# Step 2: Install dependencies
# ═══════════════════════════════════════════

log_step "2/5 Installing Python dependencies..."

source "$NETCLAW_DIR/scripts/lib/pip-helper.sh"
netclaw_pip_install -r "$TWILIO_MCP_DIR/requirements.txt" || {
    log_error "Dependency installation failed; setup stopped before configuration."
    exit 1
}
log_info "Dependencies installed"

# ═══════════════════════════════════════════
# Step 3: Configure Twilio credentials
# ═══════════════════════════════════════════

log_step "3/5 Configuring Twilio API credentials..."
echo ""
echo -e "  Get credentials from ${CYAN}https://console.twilio.com${NC}"
echo "  1. Account → Account SID (starts with AC)"
echo "  2. Account → API Keys → Create Key"
echo "     - Save API Key SID (starts with SK)"
echo "     - Save API Key Secret"
echo "  3. Phone Numbers → Buy a number (for caller ID + inbound)"
echo ""

# Create .env file directory if needed
mkdir -p "$(dirname "$ENV_FILE")"

# Check if credentials already exist
if grep -q "TWILIO_ACCOUNT_SID=" "$ENV_FILE" 2>/dev/null; then
    log_info "Twilio credentials already configured in $ENV_FILE"
    read -r -p "Reconfigure Twilio credentials? [y/N]: " reconfigure
    if [[ ! "$reconfigure" =~ ^[Yy] ]]; then
        log_info "Keeping existing credentials"
    else
        read -r -p "Account SID (ACxxxxxxxx): " account_sid
        read -r -p "API Key SID (SKxxxxxxxx): " api_key_sid
        read -r -s -p "API Key Secret: " api_secret
        echo ""
        read -r -p "Twilio Phone Number (+1XXXXXXXXXX): " phone_number

        set_env "TWILIO_ACCOUNT_SID" "$account_sid"
        set_env "TWILIO_API_KEY_SID" "$api_key_sid"
        set_env "TWILIO_API_SECRET" "$api_secret"
        set_env "TWILIO_PHONE_NUMBER" "$phone_number"
        log_info "Twilio credentials updated"
    fi
else
    read -r -p "Configure Twilio credentials now? [Y/n]: " configure
    if [[ "$configure" =~ ^[Nn] ]]; then
        log_warn "Skipping credential configuration — add manually to $ENV_FILE"
    else
        read -r -p "Account SID (ACxxxxxxxx): " account_sid
        read -r -p "API Key SID (SKxxxxxxxx): " api_key_sid
        read -r -s -p "API Key Secret: " api_secret
        echo ""
        read -r -p "Twilio Phone Number (+1XXXXXXXXXX): " phone_number

        set_env "TWILIO_ACCOUNT_SID" "$account_sid"
        set_env "TWILIO_API_KEY_SID" "$api_key_sid"
        set_env "TWILIO_API_SECRET" "$api_secret"
        set_env "TWILIO_PHONE_NUMBER" "$phone_number"
        set_env "TWILIO_WEBHOOK_URL" ""
        log_info "Twilio credentials saved to $ENV_FILE"
    fi
fi

# ═══════════════════════════════════════════
# Step 4: Configure whitelist
# ═══════════════════════════════════════════

log_step "4/5 Configuring phone whitelist..."
echo ""
echo "  Only whitelisted numbers can receive or make calls."
echo "  This is a security feature to prevent unauthorized calls."
echo ""

if [ -f "$CONFIG_FILE" ]; then
    log_info "Whitelist config exists: $CONFIG_FILE"
    read -r -p "Reconfigure whitelist? [y/N]: " reconfig_whitelist
    if [[ ! "$reconfig_whitelist" =~ ^[Yy] ]]; then
        log_info "Keeping existing whitelist"
    else
        read -r -p "Your mobile number (+1XXXXXXXXXX): " whitelist_phone
        read -r -p "Label for this number: " whitelist_label
        # Will update config below
    fi
else
    read -r -p "Your mobile number (+1XXXXXXXXXX): " whitelist_phone
    read -r -p "Label for this number [John Mobile]: " whitelist_label
    whitelist_label="${whitelist_label:-John Mobile}"
fi

# Create/update config file
if [ -n "${whitelist_phone:-}" ]; then
    mkdir -p "$(dirname "$CONFIG_FILE")"
    printf '%s\0%s\0' "$whitelist_phone" "$whitelist_label" | python3 "$NETCLAW_DIR/scripts/setup-profile.py" voice "$CONFIG_FILE" --template "$NETCLAW_DIR/config/twilio-voice.json.example"
    log_info "Whitelist configured: $whitelist_label ($whitelist_phone)"
fi

# ═══════════════════════════════════════════
# Step 5: Configure webhook (optional)
# ═══════════════════════════════════════════

log_step "5/5 Webhook configuration (for inbound calls)..."
echo ""
echo "  To receive inbound calls, you need a public webhook URL."
echo -e "  Development: ${CYAN}ngrok http 5001${NC}"
echo "  Production:  your public HTTPS domain"
echo ""

read -r -p "Configure webhook URL now? [y/N]: " configure_webhook
if [[ "$configure_webhook" =~ ^[Yy] ]]; then
    read -r -p "Webhook URL (e.g. https://abc123.ngrok-free.app/webhooks/twilio/voice): " webhook_url
    if [ -n "$webhook_url" ]; then
        if grep -q "^TWILIO_WEBHOOK_URL=" "$ENV_FILE" 2>/dev/null; then
            set_env "TWILIO_WEBHOOK_URL" "$webhook_url"
        else
            set_env "TWILIO_WEBHOOK_URL" "$webhook_url"
        fi
        log_info "Webhook URL configured"
        echo ""
        echo -e "  ${BOLD}Configure in Twilio Console:${NC}"
        echo "  1. Go to Phone Numbers → Manage → Active Numbers"
        echo "  2. Click your number"
        echo "  3. Under Voice → A call comes in:"
        echo "     - Webhook"
        echo "     - $webhook_url"
        echo "     - HTTP POST"
    fi
else
    log_info "Skipping webhook — outbound calls will still work"
fi

# ═══════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════

echo ""
echo "========================================="
echo "  Twilio Voice Setup Complete"
echo "========================================="
echo ""
echo "  MCP Server: $TWILIO_MCP_DIR/server.py"
echo "  Webhook Server: $TWILIO_MCP_DIR/webhook_server.py"
echo "  Credentials: $ENV_FILE"
echo "  Whitelist: $CONFIG_FILE"
echo ""
echo "  Available Skills (4):"
echo "    twilio-emergency-call  — Auto-call on P1 incidents"
echo "    twilio-outbound-call   — On-demand status calls"
echo "    twilio-inbound-voice   — Call NetClaw for voice commands"
echo "    twilio-daily-briefing  — Optional morning status calls"
echo ""
echo "  MCP Tools (6):"
echo "    twilio_voice_call            — Initiate outbound call"
echo "    twilio_voice_emergency_call  — Emergency auto-call"
echo "    twilio_voice_check_rate_limit — Check call quota"
echo "    twilio_voice_get_call_history — View call log"
echo "    twilio_voice_validate_number  — Validate phone format"
echo "    twilio_voice_check_quiet_hours — Check quiet hours"
echo ""
echo "  Guardrails:"
echo "    ✓ Rate limits: 3/hour, 10/day"
echo "    ✓ Quiet hours: 10 PM - 7 AM (emergency override)"
echo "    ✓ Whitelist-only calling"
echo "    ✓ Content sanitization (IPs, credentials filtered)"
echo ""
echo "  To start webhook server (for inbound calls):"
echo -e "    ${CYAN}cd $TWILIO_MCP_DIR && python3 webhook_server.py${NC}"
echo ""
echo "  To test: Ask NetClaw to 'call John with network status'"
echo ""
