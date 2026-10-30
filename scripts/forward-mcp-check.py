#!/usr/bin/env python3
"""Check a Forward Networks MCP endpoint: initialize, then list its tools.

Reads FORWARD_URL (base URL, e.g. https://fwd.app) and FORWARD_AUTH_BASE64
(base64 of accessKey:secret) from the environment so the credential never
appears in argv or output. The credential is only sent over https (plain
http is allowed for loopback testing) and is never forwarded on a redirect.
Exit 0 when the server answers both requests.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

HINTS = {
    401: 'credentials rejected: check the API token access key and secret',
    403: "MCP is off for this org ('Enable MCP server') or the license is expired",
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def post(url, auth, payload, session=None):
    headers = {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    }
    if session:
        headers['Mcp-Session-Id'] = session
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
    with OPENER.open(request, timeout=30) as response:
        return response.read().decode(), response.headers.get('Mcp-Session-Id') or session


def rpc(url, auth, payload, session=None):
    body, session = post(url, auth, payload, session)
    # Streamable HTTP may answer as SSE events instead of plain JSON.
    events = [line[5:].strip() for line in body.splitlines() if line.startswith('data:')]
    messages = [m for m in (json.loads(e) for e in events) if isinstance(m, dict)] if events else [json.loads(body)]
    if not messages or not isinstance(messages[0], dict):
        raise ValueError('reply is not a JSON-RPC object')
    reply = next((m for m in messages if m.get('id') == payload['id']), messages[0])
    error = reply.get('error')
    if error:
        detail = error if isinstance(error, dict) else {'message': error}
        raise ValueError(f"JSON-RPC error {detail.get('code')}: {detail.get('message')}")
    return reply, session


def initialized(url, auth, session):
    """Tell a stateful server the handshake is done. Best effort: tools/list is the real check."""
    try:
        post(url, auth, {'jsonrpc': '2.0', 'method': 'notifications/initialized'}, session)
    except (urllib.error.URLError, OSError):
        pass


def server_message(error):
    """The server's own explanation from a JSON error body, if it sent one."""
    try:
        message = json.loads(error.read().decode()).get('message')
    except (ValueError, AttributeError, OSError):
        return ''
    return message.strip()[:200] if isinstance(message, str) else ''


def main():
    base = os.environ.get('FORWARD_URL', '').rstrip('/')
    auth = os.environ.get('FORWARD_AUTH_BASE64', '')
    if not base or not auth:
        print('FORWARD_URL and FORWARD_AUTH_BASE64 must be set', file=sys.stderr)
        return 2
    try:
        base64.b64decode(auth, validate=True)
    except ValueError:
        print('FORWARD_AUTH_BASE64 is not valid base64', file=sys.stderr)
        return 2
    parts = urlsplit(base)
    if parts.scheme != 'https' and not (parts.scheme == 'http' and parts.hostname in ('127.0.0.1', 'localhost', '::1')):
        print('FORWARD_URL must be https:// (the API token is sent as HTTP Basic)', file=sys.stderr)
        return 2
    url = base + '/api/mcp'
    try:
        init, session = rpc(url, auth, {
            'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
            'params': {'protocolVersion': '2025-03-26', 'capabilities': {},
                       'clientInfo': {'name': 'netclaw-forward-check', 'version': '1'}},
        })
        initialized(url, auth, session)
        tools, _ = rpc(url, auth, {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}}, session)
    except urllib.error.HTTPError as error:
        hint = HINTS.get(error.code, 'redirects are not followed' if 300 <= error.code < 400 else error.reason)
        reason = server_message(error)
        print(f'HTTP {error.code} from {url}: {reason + " (" + hint + ")" if reason else hint}', file=sys.stderr)
        return 1
    except ValueError as error:
        print(f'Unexpected response from {url}: {error}', file=sys.stderr)
        return 1
    except (urllib.error.URLError, OSError) as error:
        print(f'Cannot reach {url}: {type(error).__name__}', file=sys.stderr)
        return 1
    info = (init.get('result') or {}).get('serverInfo') or {}
    names = sorted(t['name'] for t in (tools.get('result') or {}).get('tools', []))
    print(f"server: {info.get('name', '?')} {info.get('version', '')}".rstrip())
    print(f"tools ({len(names)}): {', '.join(names)}")
    return 0 if names else 1


if __name__ == '__main__':
    sys.exit(main())
