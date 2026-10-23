#!/usr/bin/env python3
"""
Twitter OAuth 2.0 Setup Script

This script helps you get OAuth 2.0 tokens with refresh capability.
Run again if authorization is revoked or refresh credentials expire.

Usage:
    python3 scripts/twitter_oauth2_setup.py

Requirements:
    - TWITTER_CLIENT_ID in your .env (from Twitter Developer Portal)
    - TWITTER_CLIENT_SECRET in your .env (from Twitter Developer Portal)
"""

import os
import importlib.util
from pathlib import Path
import time
import sys
import base64
import hashlib
import secrets
import webbrowser
from urllib.parse import urlencode, urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
import requests
from dotenv import load_dotenv

# Load environment
load_dotenv(os.path.expanduser("~/.openclaw/.env"))

CLIENT_ID = os.environ.get("TWITTER_CLIENT_ID")
CLIENT_SECRET = os.environ.get("TWITTER_CLIENT_SECRET")
REDIRECT_URI = "http://127.0.0.1:8000/callback"
SCOPES = "tweet.read tweet.write users.read offline.access"

# PKCE helpers
def generate_code_verifier():
    return secrets.token_urlsafe(32)

def generate_code_challenge(verifier):
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b'=').decode()

class CallbackHandler(BaseHTTPRequestHandler):
    """Handle the OAuth callback."""
    code = None
    expected_state = None

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        state = query.get('state', [])
        code = query.get('code', [])
        expected = CallbackHandler.expected_state
        if (parsed.path == '/callback' and len(state) == 1 and len(code) == 1
                and expected and secrets.compare_digest(state[0], expected)):
            CallbackHandler.code = query['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"""
                <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Success!</h1>
                <p>Authorization code received. You can close this window.</p>
                <p>Return to your terminal to finish setup.</p>
                </body></html>
            """)
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Error: Invalid callback or state")

    def log_message(self, format, *args):
        pass  # Suppress logging

class CallbackServer(HTTPServer):
    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(5)
        return connection, address


def main():
    if not CLIENT_ID:
        print("\n❌ TWITTER_CLIENT_ID not found in ~/.openclaw/.env")
        print("\nTo get your Client ID:")
        print("1. Go to: https://developer.twitter.com/en/portal/projects-and-apps")
        print("2. Click on your app → 'Keys and tokens' tab")
        print("3. Under 'OAuth 2.0 Client ID and Client Secret', copy the Client ID")
        print("4. Add to ~/.openclaw/.env: TWITTER_CLIENT_ID=your_client_id")
        print("5. Also add: TWITTER_CLIENT_SECRET=your_client_secret")
        sys.exit(1)

    print("\n🐦 Twitter OAuth 2.0 Setup")
    print("=" * 50)

    # Generate PKCE values
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)
    state = secrets.token_urlsafe(16)

    # Build authorization URL
    auth_params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256"
    }
    auth_url = f"https://twitter.com/i/oauth2/authorize?{urlencode(auth_params)}"

    print(f"\n1. Opening browser for authorization...")
    print(f"   If browser doesn't open, visit:\n   {auth_url}\n")

    # Start callback server
    CallbackHandler.code = None
    CallbackHandler.expected_state = state
    server = CallbackServer(('127.0.0.1', 8000), CallbackHandler)
    server.timeout = 1

    # Open browser
    webbrowser.open(auth_url)

    print("2. Waiting for authorization callback...")

    # Wait for callback
    deadline = time.monotonic() + 300
    try:
        while CallbackHandler.code is None and time.monotonic() < deadline:
            server.handle_request()
    finally:
        server.server_close()
        CallbackHandler.expected_state = None
    if CallbackHandler.code is None:
        sys.exit('Authorization callback timed out; no tokens saved.')

    code = CallbackHandler.code
    print(f"\n3. ✅ Authorization code received!")

    # Exchange code for tokens
    print("\n4. Exchanging code for tokens...")

    token_data = {
        "code": code,
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": code_verifier
    }

    # Use client secret if available (confidential client)
    if CLIENT_SECRET:
        auth = (CLIENT_ID, CLIENT_SECRET)
    else:
        auth = None
        token_data["client_id"] = CLIENT_ID

    response = requests.post(
        "https://api.twitter.com/2/oauth2/token",
        data=token_data,
        auth=auth,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30
    )

    if response.status_code != 200:
        print(f"Token exchange failed (HTTP {response.status_code}); no tokens saved.")
        sys.exit(1)

    tokens = response.json()

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in", 7200)

    if not isinstance(access_token, str) or not access_token:
        sys.exit('Token response missing access token; no tokens saved.')
    if refresh_token is not None and not isinstance(refresh_token, str):
        sys.exit('Token response has invalid refresh token; no tokens saved.')
    env_path = Path.home() / '.openclaw/.env'
    save_tokens(env_path, access_token, refresh_token)
    print(f"Tokens saved privately to {env_path}; access token lifetime {expires_in}s.")
    if not refresh_token:
        print("No refresh token received; offline refresh is unavailable.")


def save_tokens(path, access_token, refresh_token):
    spec = importlib.util.spec_from_file_location('env_writer', Path(__file__).with_name('write-env.py'))
    writer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(writer)
    # Validate both before changing any assignment.
    writer.quote(access_token)
    if refresh_token:
        writer.quote(refresh_token)
    updates = {'TWITTER_OAUTH2_ACCESS_TOKEN': access_token}
    if refresh_token:
        updates['TWITTER_OAUTH2_REFRESH_TOKEN'] = refresh_token
    path = Path(path)
    if path.is_symlink():
        raise ValueError('Refusing linked environment path')
    original = path.read_text() if path.exists() else ''
    lines = []
    for line in original.splitlines():
        match = writer.ASSIGNMENT.match(line.strip())
        if not match or match[1] not in updates:
            lines.append(line)
    lines.extend(key + '=' + writer.quote(value) for key, value in updates.items())
    writer.write_private(path, '\n'.join(lines) + '\n')

if __name__ == "__main__":
    main()
