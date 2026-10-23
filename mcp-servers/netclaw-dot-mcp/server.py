"""NetClaw Dot MCP facade: three read-only tools over streamable HTTP with bearer auth.

Binds to 127.0.0.1 by default. Exposing it (tunnel/public HTTPS) is a separate,
owner-approved step; see docs/NETCLAW-DOT.md.
"""
import hashlib
import hmac
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import core  # noqa: E402
import oauth as oauth_mod  # noqa: E402
from fastmcp import FastMCP  # noqa: E402


PUBLIC_HOST = os.environ.get("NETCLAW_DOT_PUBLIC_HOST", "")  # e.g. zoom.automateyournetwork.ca
_hosts = ["127.0.0.1:*", "localhost:*"] + ([PUBLIC_HOST] if PUBLIC_HOST else [])
HTTP_HOST = os.environ.get("NETCLAW_DOT_HOST", "127.0.0.1")
HTTP_PORT = int(os.environ.get("NETCLAW_DOT_PORT", "8765"))
mcp = FastMCP("netclaw-dot")


def http_app():
    """Sessionless transport with explicit host/origin protection; bearer gate wraps it."""
    return mcp.http_app(path="/mcp", stateless_http=True,
                        host_origin_protection=True, allowed_hosts=_hosts,
                        allowed_origins=[])

RO = {"readOnlyHint": True, "destructiveHint": False}
PRINCIPAL = "owner"  # single-owner MVP; identity is the bearer token holder


@mcp.tool(annotations=RO)
def netclaw_inventory() -> dict:
    """List synthetic NetClaw device aliases with observation time."""
    return core.inventory(PRINCIPAL)


@mcp.tool(annotations=RO)
def netclaw_health_summary(aliases: list[str], checks: list[str]) -> dict:
    """Bounded health summary for up to 10 authorized aliases. checks: interface_summary, routing_summary, system_summary."""
    return core.health_summary(PRINCIPAL, aliases, checks)


@mcp.tool(annotations=RO)
def netclaw_audit_status(request_id: str) -> dict:
    """Completion status of a previous request by its server-issued ID."""
    return core.audit_status(PRINCIPAL, request_id)


@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True})
async def netclaw_ask(prompt: str) -> dict:
    """Ask the full local NetClaw agent (CML, pyATS, all skills) to do something. Returns a job_id at once;
    then call netclaw_job_result repeatedly until status is ok or error. NetClaw's own guardrails and change
    control decide what executes; a reply may report a pending approval. Device output is in the agent's reply."""
    return await core.ask(PRINCIPAL, prompt)


@mcp.tool(annotations=RO)
async def netclaw_job_result(job_id: str) -> dict:
    """Get the status/result of a netclaw_ask job (waits up to ~20s). status=running means call again."""
    return await core.job_result(PRINCIPAL, job_id)


class DotAuth:
    """ASGI front: OAuth endpoints, discovery, and bearer/OAuth-token gate for /mcp.

    The static NETCLAW_DOT_TOKEN is also accepted as a bearer (local testing, curl)."""

    def __init__(self, app, token, oauth):
        self.app, self.digest, self.oauth = app, hashlib.sha256(token.encode()).digest(), oauth

    async def _send(self, send, status, body=b"", headers=None):
        h = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
        await send({"type": "http.response.start", "status": status, "headers": h})
        await send({"type": "http.response.body", "body": body if isinstance(body, bytes) else body.encode()})

    async def _json(self, send, status, obj, extra=None):
        await self._send(send, status, json.dumps(obj), {"content-type": "application/json", "cache-control": "no-store", **(extra or {})})

    async def _body(self, receive):
        body = b""
        while True:
            m = await receive()
            body += m.get("body", b"")
            if not m.get("more_body"):
                return body[:65536]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path, method = scope["path"], scope["method"]
        if path.startswith("/.well-known/oauth-protected-resource"):
            return await self._json(send, 200, self.oauth.resource_metadata())
        if path.startswith("/.well-known/oauth-authorization-server"):
            return await self._json(send, 200, self.oauth.metadata())
        if path.startswith("/.well-known/"):  # unknown discovery docs (e.g. OIDC): clean 404, never 401
            return await self._json(send, 404, {"error": "not_found"})
        if path == "/oauth/authorize":
            q = oauth_mod.parse_form(scope.get("query_string", b""))
            pw = None
            if method == "POST":
                f = oauth_mod.parse_form(await self._body(receive))
                pw = f.pop("passphrase", "")
                q = {k: v for k, v in f.items()}
            st, h, body = self.oauth.authorize(q, pw)
            return await self._send(send, st, body, h)
        if path == "/oauth/token" and method == "POST":
            hdrs = dict(scope["headers"])
            st, obj = self.oauth.token(oauth_mod.parse_form(await self._body(receive)), hdrs.get(b"authorization", b"").decode())
            return await self._json(send, st, obj)
        hdr = dict(scope["headers"]).get(b"authorization", b"").decode()
        tok = hdr.removeprefix("Bearer ") if hdr.startswith("Bearer ") else ""
        static_ok = bool(tok) and hmac.compare_digest(hashlib.sha256(tok.encode()).digest(), self.digest)
        if not (static_ok or (tok and self.oauth.valid_access(tok))):
            meta = f"{self.oauth.base}/.well-known/oauth-protected-resource"
            return await self._send(send, 401, "unauthorized", {"content-type": "text/plain", "www-authenticate": f'Bearer resource_metadata="{meta}"'})
        await self.app(scope, receive, send)


def main():
    token = os.environ.get("NETCLAW_DOT_TOKEN", "")
    if len(token) < 24:
        sys.exit("NETCLAW_DOT_TOKEN (>=24 chars) is required; refusing to start unauthenticated")
    import uvicorn
    base = "https://" + (PUBLIC_HOST or "localhost") + "/netclaw-dot"
    cid, csec = os.environ.get("NETCLAW_DOT_CLIENT_ID", ""), os.environ.get("NETCLAW_DOT_CLIENT_SECRET", "")
    if not cid or len(csec) < 24:
        sys.exit("NETCLAW_DOT_CLIENT_ID and NETCLAW_DOT_CLIENT_SECRET (>=24 chars) are required")
    redirects = [u for u in os.environ.get("NETCLAW_DOT_REDIRECTS", "").split(",") if u]
    oa = oauth_mod.OAuth(token, cid, csec, base, redirects=redirects)
    uvicorn.run(DotAuth(http_app(), token, oa), host=HTTP_HOST, port=HTTP_PORT, log_level="warning")


if __name__ == "__main__":
    main()
