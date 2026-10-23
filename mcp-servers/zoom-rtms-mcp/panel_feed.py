"""Companion WebSocket server (research.md R3): a presentation-layer-only feed
from zoom-rtms-mcp to the browser-embedded Zoom App panel. Deliberately
separate from NCFED/GAIT/peer-trust — see contracts/zoom-app-panel-feed.md.

Handles:
  - avatar_state / topic_detected / investigation_result / connection_state
    pushes (US1/US3), broadcast to every viewer of a meeting_uuid at once
    (FR-011, SC-004) within 2 seconds of the underlying change (SC-009).
  - viewer_joined tracking (MeetingSession.viewers, SC-004 verification).
  - camera_overlay_enable/disable (US5), restricted to the sending
    participant's own participant_id (FR-019).
"""

import asyncio
import json
import logging
import mimetypes
import os
import time

from panel_auth import verify_context

import websockets
from websockets.datastructures import Headers
from websockets.http11 import Response

from models import registry

logger = logging.getLogger("zoom_rtms.panel_feed")

PORT = int(os.environ.get("ZOOM_PANEL_FEED_PORT", "8900"))

# The Zoom App's Home URL points at /panel/ on this same port (single ngrok
# tunnel / single production host, per quickstart.md) — panel.js then opens
# its WebSocket to "/" on that same host (see panel.js's wsUrl). This module
# therefore serves both: plain HTTP GET for anything under /panel, and the
# actual WebSocket upgrade for everything else (in practice, "/").
_STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "ui", "netclaw-zoom-app")
_STATIC_FILES = {
    "/panel/": "panel.html",
    "/panel": "panel.html",
    "/panel/panel.js": "panel.js",
    "/panel/panel.css": "panel.css",
    "/panel/overlay.js": "overlay.js",
}


_OAUTH_CALLBACK_BODY = (
    b"<html><body><p>NetClaw authorized. You can close this window and "
    b"return to your meeting.</p></body></html>"
)


async def _serve_static(connection, request):
    path = request.path.split("?", 1)[0]
    upgrade_hdr = request.headers.get("Upgrade", "")
    origin_hdr = request.headers.get("Origin", "")
    ua_hdr = request.headers.get("User-Agent", "")
    logger.debug("panel_feed request path=%r", path)
    if path == "/oauth/callback":
        # Zoom's install/consent flow redirects the browser here after the
        # user authorizes. This app's data access is scoped per-meeting via
        # the Zoom Apps SDK session (zoomapp:inmeeting), not a stored OAuth
        # token, so there is no code-exchange step to perform — this only
        # needs to give the browser a clean landing page instead of a 404/
        # connection error (discovered live 2026-08-17: nothing served this
        # path at all before, breaking the consent flow's final step).
        headers = Headers([
            ("Content-Type", "text/html"),
            ("Content-Length", str(len(_OAUTH_CALLBACK_BODY))),
            ("Strict-Transport-Security", "max-age=63072000; includeSubDomains"),
            ("X-Content-Type-Options", "nosniff"),
            ("Referrer-Policy", "strict-origin-when-cross-origin"),
        ])
        return Response(200, "OK", headers, _OAUTH_CALLBACK_BODY)
    filename = _STATIC_FILES.get(path)
    if filename is None:
        # Not a recognized static path — let it fall through to the
        # WebSocket handshake (the "/" case panel.js actually connects to).
        return None
    file_path = os.path.join(_STATIC_DIR, filename)
    try:
        with open(file_path, "rb") as f:
            body = f.read()
    except OSError:
        return Response(404, "Not Found", Headers([("Content-Type", "text/plain")]), b"not found")
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    headers = Headers([
        ("Content-Type", content_type),
        ("Content-Length", str(len(body))),
        # Every edit to panel.js during live debugging needs the very next
        # load to actually be the new file, not whatever Zoom's client
        # webview (or an intermediate proxy) decided to cache with no
        # explicit cache headers to go on.
        ("Cache-Control", "no-store"),
        ("Strict-Transport-Security", "max-age=63072000; includeSubDomains"),
        # No frame-ancestors directive: Zoom's desktop client embeds this
        # page from an origin that does not reliably match a zoom.us-style
        # HTTPS pattern (confirmed live 2026-08-19 — panel.html fetched fine,
        # 200 OK, but panel.js was never once requested by the real Zoom
        # client, only by manual curl checks; Zoom's own devforum reports the
        # same "ancestor violates frame-ancestors" failure mode and recommends
        # dropping the restriction rather than guessing at the client's
        # embedding origin). Zoom's own app-review process is the actual
        # control on who can embed this Home URL, not this header.
        ("Content-Security-Policy", "default-src 'self' https://appssdk.zoom.us; script-src 'self' https://appssdk.zoom.us"),
        # Zoom's own client-side app-launch validator checks the Home URL
        # response for a specific OWASP header set and silently aborts the
        # app load (generic client error, no page-visible signal) if any are
        # missing — confirmed live 2026-08-19 via Zoom's own webview console:
        # "Missing OWASP Secure Headers: [X-Content-Type-Options,
        # Referrer-Policy]". HSTS/CSP alone were not sufficient.
        ("X-Content-Type-Options", "nosniff"),
        ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ])
    return Response(200, "OK", headers, body)

# meeting_uuid -> set of websocket connections currently viewing that meeting
_connections: dict[str, set] = {}
# meeting_uuid -> participant_id -> websocket, for camera-overlay's "only own
# feed" restriction (FR-019)
_participant_sockets: dict[str, dict] = {}


async def _broadcast(meeting_uuid: str, message: dict):
    conns = _connections.get(meeting_uuid, set())
    dead = set()
    payload = json.dumps(message)
    for ws in tuple(conns):
        try:
            await ws.send(payload)
        except Exception:
            dead.add(ws)
    conns -= dead


async def push_avatar_state(meeting_uuid: str, state: str):
    session = registry.get(meeting_uuid)
    if session:
        session.avatar_state = state
    await _broadcast(meeting_uuid, {"type": "avatar_state", "meeting_uuid": meeting_uuid,
                                     "state": state})


async def push_topic_detected(meeting_uuid: str, location, technology, time_window):
    await _broadcast(meeting_uuid, {"type": "topic_detected", "meeting_uuid": meeting_uuid,
                                     "location": location, "technology": technology,
                                     "time_window": time_window})


async def push_investigation_result(meeting_uuid: str, request_id: str, answer_summary,
                                     evidence_refs):
    await _broadcast(meeting_uuid, {"type": "investigation_result", "meeting_uuid": meeting_uuid,
                                     "request_id": request_id, "answer_summary": answer_summary,
                                     "evidence_refs": evidence_refs or []})


async def push_connection_state(meeting_uuid: str, state: str):
    await _broadcast(meeting_uuid, {"type": "connection_state", "meeting_uuid": meeting_uuid,
                                     "state": state})


async def _handle_client_message(ws, meeting_uuid: str, msg: dict):
    kind = msg.get("type")
    participant_id = msg.get("participant_id")

    if kind == "viewer_joined":
        session = registry.get(meeting_uuid)
        if session and participant_id:
            session.viewers.add(participant_id)
        _participant_sockets.setdefault(meeting_uuid, {})[participant_id] = ws

    elif kind == "camera_overlay_enable":
        # FR-019: only ever applies to the sending participant's own feed —
        # the server never accepts a participant_id other than the one this
        # connection already identified itself as via viewer_joined.
        known = _participant_sockets.get(meeting_uuid, {}).get(participant_id)
        if known is ws:
            session = registry.get(meeting_uuid)
            if session:
                session.camera_overlay_enrollments.add(participant_id)
            logger.info("Camera overlay enabled for %s in %s", participant_id, meeting_uuid)

    elif kind == "camera_overlay_disable":
        known = _participant_sockets.get(meeting_uuid, {}).get(participant_id)
        if known is ws:
            session = registry.get(meeting_uuid)
            if session:
                session.camera_overlay_enrollments.discard(participant_id)
            logger.info("Camera overlay disabled for %s in %s", participant_id, meeting_uuid)


async def _handler(ws):
    meeting_uuid = None
    participant_id = None
    expiry_task = None
    try:
        first = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        if not isinstance(first, dict) or first.get("type") != "authenticate":
            raise ValueError("Authentication required")
        identity = verify_context(first.get("context"))
        meeting_uuid = identity["meeting_uuid"]
        participant_id = identity["user_id"]
        if len(_connections.get(meeting_uuid, ())) >= 64 or sum(map(len, _connections.values())) >= 256:
            raise ValueError("Panel connection capacity reached")
        _connections.setdefault(meeting_uuid, set()).add(ws)
        _participant_sockets.setdefault(meeting_uuid, {})[participant_id] = ws
        async def expire():
            await asyncio.sleep(max(0, identity["expires_at"] - time.time()))
            await ws.close(code=4001, reason="Refresh Zoom app context")
        expiry_task = asyncio.create_task(expire())
        await ws.send(json.dumps({"type": "identified", "meeting_uuid": meeting_uuid}))
        async for raw in ws:
            msg = json.loads(raw)
            if not isinstance(msg, dict):raise ValueError("Invalid panel message")
            if msg.get("meeting_uuid", meeting_uuid) != meeting_uuid:
                raise ValueError("Cross-meeting subscription refused")
            # The identity comes from Zoom's authenticated context, never from
            # a claimed participant ID or an active-meeting fallback.
            msg["participant_id"] = participant_id
            await _handle_client_message(ws, meeting_uuid, msg)
    except (ValueError, TypeError, asyncio.TimeoutError):
        await ws.close(code=1008, reason="Valid Zoom meeting context required")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if expiry_task:
            expiry_task.cancel()
        if meeting_uuid:
            conns = _connections.get(meeting_uuid, set())
            conns.discard(ws)
            if not conns:_connections.pop(meeting_uuid, None)
            participants = _participant_sockets.get(meeting_uuid, {})
            if participants.get(participant_id) is ws:
                participants.pop(participant_id, None)
                session = registry.get(meeting_uuid)
                if session:
                    session.viewers.discard(participant_id)
                    session.camera_overlay_enrollments.discard(participant_id)
            if not participants:_participant_sockets.pop(meeting_uuid, None)


async def start_panel_feed_server():
    server = await websockets.serve(
        _handler, os.environ.get("ZOOM_PANEL_FEED_HOST", "127.0.0.1"), PORT, process_request=_serve_static, max_size=65536, max_queue=16)
    logger.info(
        "Panel feed WebSocket + static panel (%s) listening on 0.0.0.0:%d",
        _STATIC_DIR, PORT)
    return server
