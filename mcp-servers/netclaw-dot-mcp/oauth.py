"""Minimal single-owner OAuth 2.1 authorization server for the Dot plugin connector.

Authorization code + PKCE(S256), user-defined client (id/secret), refresh tokens.
The authorize step requires the owner passphrase (the facade's static token) so an
unauthenticated visitor can never mint a code. Tokens persist hashed in a 0600 file.
"""
import base64
import hashlib
import hmac
import html
import json
import os
import secrets
import time
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

ACCESS_TTL, REFRESH_TTL, CODE_TTL = 3600, 30 * 86400, 300
DEFAULT_REDIRECT_HOSTS = {"chatgpt.com", "chat.openai.com", "platform.openai.com"}


def _h(v):
    return hashlib.sha256(v.encode()).hexdigest()


class OAuth:
    def __init__(self, owner_secret, client_id, client_secret, base_url, store=None, redirects=None):
        self.owner, self.cid, self.csec, self.base = owner_secret, client_id, client_secret, base_url.rstrip("/")
        self.store = Path(store or Path.home() / ".openclaw" / "dot" / "oauth.json")
        self.redirects = set(redirects or [])
        self.codes, self.fails = {}, 0
        try:
            self.tokens = json.loads(self.store.read_text())
        except (OSError, ValueError):
            self.tokens = {}

    def _save(self):
        self.store.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(self.store, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            json.dump(self.tokens, f)

    def redirect_ok(self, uri):
        if uri in self.redirects:
            return True
        u = urlparse(uri)
        return not self.redirects and u.scheme == "https" and u.hostname in DEFAULT_REDIRECT_HOSTS

    def valid_access(self, tok):
        rec = self.tokens.get(_h(tok))
        return bool(rec and rec["kind"] == "access" and rec["exp"] > time.time())

    def metadata(self):
        return {"issuer": self.base, "authorization_endpoint": f"{self.base}/oauth/authorize",
                "token_endpoint": f"{self.base}/oauth/token", "response_types_supported": ["code"],
                "grant_types_supported": ["authorization_code", "refresh_token"],
                "code_challenge_methods_supported": ["S256"],
                "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"]}

    def resource_metadata(self):
        return {"resource": f"{self.base}/mcp", "authorization_servers": [self.base]}

    def _issue(self):
        acc, ref = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        now = time.time()
        self.tokens = {k: v for k, v in self.tokens.items() if v["exp"] > now}
        self.tokens[_h(acc)] = {"kind": "access", "exp": now + ACCESS_TTL}
        self.tokens[_h(ref)] = {"kind": "refresh", "exp": now + REFRESH_TTL}
        self._save()
        return {"access_token": acc, "token_type": "Bearer", "expires_in": ACCESS_TTL, "refresh_token": ref}

    def authorize_form(self, q, error=""):
        hidden = "".join(f'<input type=hidden name="{html.escape(k)}" value="{html.escape(v)}">' for k, v in q.items())
        return (f"<!doctype html><title>NetClaw Dot</title><body style='font-family:sans-serif;max-width:28rem;margin:4rem auto'>"
                f"<h2>Authorize ChatGPT Dot to use NetClaw?</h2><p style='color:#b00'>{html.escape(error)}</p>"
                f"<form method=post>{hidden}<input type=password name=passphrase placeholder='owner passphrase' autofocus>"
                f"<button>Approve</button></form></body>")

    def authorize(self, q, passphrase=None):
        """Returns (status, headers, body). q is a flat dict of query params."""
        if q.get("response_type") != "code" or q.get("client_id") != self.cid:
            return 400, {}, "invalid_request"
        if not self.redirect_ok(q.get("redirect_uri", "")) or q.get("code_challenge_method") != "S256" or not q.get("code_challenge"):
            return 400, {}, "invalid_request"
        if passphrase is None:
            return 200, {"content-type": "text/html"}, self.authorize_form(q)
        if self.fails >= 5 or not hmac.compare_digest(_h(passphrase), _h(self.owner)):
            self.fails += 1
            time.sleep(min(self.fails, 5))
            return 403, {"content-type": "text/html"}, self.authorize_form(q, "Wrong passphrase")
        self.fails = 0
        code = secrets.token_urlsafe(32)
        self.codes[code] = {"challenge": q["code_challenge"], "redirect": q["redirect_uri"], "exp": time.time() + CODE_TTL}
        params = {"code": code}
        if q.get("state"):
            params["state"] = q["state"]
        sep = "&" if "?" in q["redirect_uri"] else "?"
        return 302, {"location": q["redirect_uri"] + sep + urlencode(params)}, ""

    def token(self, form, auth_header=""):
        cid, csec = form.get("client_id", ""), form.get("client_secret", "")
        if auth_header.startswith("Basic "):
            try:
                cid, _, csec = base64.b64decode(auth_header[6:]).decode().partition(":")
            except Exception:
                return 401, {"error": "invalid_client"}
        if not (hmac.compare_digest(cid, self.cid) and hmac.compare_digest(_h(csec), _h(self.csec))):
            return 401, {"error": "invalid_client"}
        g = form.get("grant_type")
        if g == "authorization_code":
            rec = self.codes.pop(form.get("code", ""), None)  # single use
            if not rec or rec["exp"] < time.time() or rec["redirect"] != form.get("redirect_uri"):
                return 400, {"error": "invalid_grant"}
            v = base64.urlsafe_b64encode(hashlib.sha256(form.get("code_verifier", "").encode()).digest()).rstrip(b"=").decode()
            if not hmac.compare_digest(v, rec["challenge"]):
                return 400, {"error": "invalid_grant"}
            return 200, self._issue()
        if g == "refresh_token":
            k = _h(form.get("refresh_token", ""))
            rec = self.tokens.get(k)
            if not rec or rec["kind"] != "refresh" or rec["exp"] < time.time():
                return 400, {"error": "invalid_grant"}
            del self.tokens[k]
            return 200, self._issue()
        return 400, {"error": "unsupported_grant_type"}


def parse_form(body: bytes):
    return {k: v[0] for k, v in parse_qs(body.decode(), keep_blank_values=True).items()}
