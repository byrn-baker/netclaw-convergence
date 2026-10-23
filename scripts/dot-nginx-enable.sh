#!/usr/bin/env bash
# Add the /netclaw-dot/ location to the zoom vhost. Run with sudo. Backs up, validates, rolls back on failure.
set -euo pipefail
CONF=/etc/nginx/sites-enabled/zoom-rtms.conf
SNIP="$(dirname "$0")/../mcp-servers/netclaw-dot-mcp/nginx-netclaw-dot.conf.snippet"
cp -a "$CONF" "$CONF.bak.dot"
python3 - "$CONF" "$SNIP" <<'PY'
import sys
conf, snip = sys.argv[1:]
s = open(conf).read()
text = "".join(l for l in open(snip) if not l.startswith("#"))
# split snippet into its top-level location blocks; add only the ones not yet present
blocks, cur = [], []
for l in text.splitlines(True):
    cur.append(l)
    if l.startswith("}"):
        blocks.append("".join(cur)); cur = []
marker = "    location / {"
assert s.count(marker) == 1, "unexpected vhost layout"
added = 0
for b in blocks:
    key = b.splitlines()[0].strip()
    if key in s:
        continue
    s = s.replace(marker, "".join("    " + l if l.strip() else l for l in b.splitlines(True)) + "\n" + marker)
    added += 1
open(conf, "w").write(s)
print("blocks added:", added)
PY
if nginx -t; then systemctl reload nginx && echo "enabled: https://zoom.automateyournetwork.ca/netclaw-dot/mcp"
else cp -a "$CONF.bak.dot" "$CONF"; echo "nginx -t failed; rolled back" >&2; exit 1; fi
