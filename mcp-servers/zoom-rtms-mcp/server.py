#!/usr/bin/env python3
"""
Zoom RTMS MCP Server — NetClaw for Zoom Meeting Intelligence (spec 118)

Exposes tools per contracts/zoom-rtms-mcp-tools.md for querying live meeting
context and historical meeting correlation. The autonomous recognition path
(extractor.py -> recognition.py -> zoom_channel_client.py -> Border) runs
independently of any tool call here — these tools are the on-demand query
surface for the agent/operator, per that contract's own framing.

Background services (webhook receiver, panel feed, Border channel client) share
one process and registry. Transient installer discovery imports no ingress/SDK
modules, starts no services, and refuses tool calls.
"""

import asyncio
import logging
import os
import threading
from contextlib import asynccontextmanager

_DISCOVERY_ONLY = os.environ.get("NETCLAW_MCP_DISCOVERY_ONLY") == "1"
if _DISCOVERY_ONLY:
    os.environ["FASTMCP_CHECK_FOR_UPDATES"] = "off"

from functools import wraps
from fastmcp.utilities.async_utils import call_sync_fn_in_threadpool
from fastmcp_tasks import TasksExtension
from fastmcp import FastMCP

if not _DISCOVERY_ONLY:
    import panel_feed
    import recognition
    import rtms_listener
    import webhook
    import zoom_channel_client
from models import registry

logging.basicConfig(level=os.environ.get("ZOOM_RTMS_LOG_LEVEL", "INFO"))
logger = logging.getLogger("zoom_rtms.server")

@asynccontextmanager
async def _lifespan(_server):
    # Native MCP startup and shutdown own the same in-memory meeting registry.
    # Merely importing a module (or listing it in the installer) starts nothing.
    try:
        if not _DISCOVERY_ONLY:await asyncio.to_thread(_start_background_services)
        yield {}
    finally:
        if not _DISCOVERY_ONLY:await asyncio.to_thread(_stop_background_services)


mcp = FastMCP("zoom-rtms",lifespan=_lifespan)
mcp.add_extension(TasksExtension(name="netclaw-zoom-rtms-mcp", concurrency=1))


def _task_tool(fn):
    """Register a threaded MCP task while preserving the direct Python callable."""
    @wraps(fn)
    def guarded(*args, **kwargs):
        if _DISCOVERY_ONLY:
            return {"error": "installer_discovery_only", "active": False}
        return fn(*args, **kwargs)
    @wraps(fn)
    async def run(*args, **kwargs):
        return await call_sync_fn_in_threadpool(guarded, *args, **kwargs)
    mcp.tool(task=True)(run)
    return guarded


def _tool(fn):
    @wraps(fn)
    def run(*args, **kwargs):
        if _DISCOVERY_ONLY:
            return {"error": "installer_discovery_only", "active": False}
        return fn(*args, **kwargs)
    mcp.tool()(run)
    return run


# ---------------------------------------------------------------------------
# Background services
# ---------------------------------------------------------------------------

_bg_loop: asyncio.AbstractEventLoop | None = None
_bg_thread: threading.Thread | None = None
_webhook_thread: threading.Thread | None = None
_panel_server = None
_bg_ready = threading.Event()
_bg_failure = None
_lifecycle_lock = threading.Lock()


def _on_meeting_started(meeting_uuid: str, payload: dict):
    if _bg_loop:
        asyncio.run_coroutine_threadsafe(rtms_listener.start_listener(meeting_uuid, payload),
                                          _bg_loop)


def _on_meeting_stopped(meeting_uuid: str):
    if _bg_loop:
        asyncio.run_coroutine_threadsafe(rtms_listener.stop_listener(meeting_uuid), _bg_loop)
        asyncio.run_coroutine_threadsafe(zoom_channel_client.notify_session_closed(meeting_uuid),
                                          _bg_loop)


def _run_background_loop():
    global _bg_loop,_panel_server,_bg_failure
    loop = asyncio.new_event_loop()
    _bg_loop = loop
    recognition.set_bg_loop(loop)
    asyncio.set_event_loop(loop)

    async def _startup():
        global _panel_server
        _panel_server=await panel_feed.start_panel_feed_server()
        await zoom_channel_client.get_client()
    try:
        loop.run_until_complete(_startup())
        _bg_ready.set()
        loop.run_forever()
    except BaseException as error:
        _bg_failure=error;_bg_ready.set()
    finally:
        pending=asyncio.all_tasks(loop)
        for task in pending:task.cancel()
        if pending:loop.run_until_complete(asyncio.gather(*pending,return_exceptions=True))
        if _panel_server is not None:
            _panel_server.close();loop.run_until_complete(_panel_server.wait_closed())
            _panel_server=None
        loop.close();_bg_loop=None


def _start_background_services():
    global _bg_thread,_webhook_thread,_bg_failure
    if _DISCOVERY_ONLY:raise RuntimeError('installer_discovery_only')
    with _lifecycle_lock:
        if _bg_thread is not None:raise RuntimeError('background_services_already_owned')
        _bg_ready.clear();_bg_failure=None
        webhook.on_meeting_started = _on_meeting_started
        webhook.on_meeting_stopped = _on_meeting_stopped
        zoom_channel_client.on_investigate_result = recognition.handle_investigate_result
        _bg_thread=threading.Thread(target=_run_background_loop,daemon=True,name='zoom-rtms-bg-loop')
        _bg_thread.start()
        if not _bg_ready.wait(40) or _bg_failure is not None:
            raise RuntimeError('background_services_unavailable')
        _webhook_thread=webhook.start_webhook_server()


def _stop_background_services():
    global _bg_thread,_webhook_thread
    with _lifecycle_lock:
        if _webhook_thread is not None:
            webhook.stop_webhook_server(_webhook_thread);_webhook_thread=None
        loop=_bg_loop
        if loop is not None and loop.is_running():
            async def close():
                for meeting_uuid in list(rtms_listener._active_listeners):await rtms_listener.stop_listener(meeting_uuid)
                await zoom_channel_client.close_client()
            asyncio.run_coroutine_threadsafe(close(),loop).result(timeout=10)
            loop.call_soon_threadsafe(loop.stop)
        if _bg_thread is not None:
            _bg_thread.join(timeout=12)
            if _bg_thread.is_alive():raise RuntimeError('background_shutdown_unverified')
            _bg_thread=None
        webhook.on_meeting_started=None;webhook.on_meeting_stopped=None
        zoom_channel_client.on_investigate_result=None

# ---------------------------------------------------------------------------
# MCP tools (contracts/zoom-rtms-mcp-tools.md)
# ---------------------------------------------------------------------------


@_tool
def zoom_enable_listening(meeting_id: str) -> dict:
    """Enable RTMS listening for a meeting (FR-001/FR-015).

    If Zoom's own auto-start-for-RTMS-apps setting is enabled (confirmed live
    for this feature's own Marketplace app during setup), a MeetingSession is
    typically already created via the rtms_started webhook by the time an
    operator would call this. This tool additionally supports the
    REST-triggered launch path (research.md, RTMS getting-started guide) for
    meetings without auto-start — that REST call requires live Zoom OAuth
    credentials (ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET/ZOOM_ACCOUNT_ID) not
    available in this environment; if a session doesn't already exist and
    those credentials aren't configured, this returns rtms_unavailable rather
    than silently pretending to succeed.
    """
    session = registry.get(meeting_id)
    if session:
        return {"meeting_uuid": meeting_id, "listening_enabled": True}
    if not (os.environ.get("ZOOM_CLIENT_ID") and os.environ.get("ZOOM_CLIENT_SECRET")):
        return {"error": "rtms_unavailable",
                "reason": "no active session and no Zoom OAuth credentials configured for "
                          "REST-triggered launch"}
    return {"error": "rtms_unavailable",
            "reason": "REST-triggered launch not implemented in this environment — "
                      "rely on auto-start (already enabled for this app) instead"}


@_tool
def zoom_disable_listening(meeting_uuid: str) -> dict:
    """Disable listening and destroy the live buffer immediately (FR-014)."""
    existed = registry.destroy(meeting_uuid)
    return {"listening_enabled": False, "existed": existed}


@_tool
def zoom_list_active_meetings() -> dict:
    """FR-015: which meetings currently have listening enabled."""
    return {"meetings": [
        {"meeting_uuid": s.meeting_uuid, "started_at": s.started_at,
         "connection_state": s.connection_state}
        for s in registry.list_active()
    ]}


@_tool
def zoom_meeting_status(meeting_uuid: str) -> dict:
    session = registry.get(meeting_uuid)
    if not session:
        return {"error": "not_found"}
    return {"connection_state": session.connection_state, "avatar_state": session.avatar_state,
            "participant_count": len(session.viewers)}


@_tool
def zoom_recent_transcript(meeting_uuid: str, minutes: float = None) -> dict:
    session = registry.get(meeting_uuid)
    if not session:
        return {"error": "not_found"}
    entries = session.buffer.recent(minutes=minutes, kinds={"transcript"})
    return {"entries": [{"timestamp": e.timestamp, "participant_id": e.participant_id,
                          "participant_name": e.participant_name, "text": e.text}
                         for e in entries]}


@_tool
def zoom_recent_chat(meeting_uuid: str, minutes: float = None) -> dict:
    session = registry.get(meeting_uuid)
    if not session:
        return {"error": "not_found"}
    entries = session.buffer.recent(minutes=minutes, kinds={"chat"})
    return {"entries": [{"timestamp": e.timestamp, "participant_id": e.participant_id,
                          "participant_name": e.participant_name, "text": e.text}
                         for e in entries]}


@_tool
def zoom_active_speaker(meeting_uuid: str) -> dict:
    session = registry.get(meeting_uuid)
    if not session:
        return {"error": "not_found"}
    speaker_entries = session.buffer.recent(kinds={"speaker_change"})
    return {"participant_id": speaker_entries[-1].participant_id if speaker_entries else None}


@_tool
def zoom_live_context(meeting_uuid: str) -> dict:
    session = registry.get(meeting_uuid)
    if not session:
        return {"error": "not_found"}
    current = None
    if session.current_investigation_id:
        req = session.investigations.get(session.current_investigation_id)
        if req:
            current = {
                "request_id": req.request_id, "raw_text": req.raw_text,
                "location": req.location, "technology": req.technology,
                "time_window": req.time_window, "routing_outcome": req.routing_outcome,
                "answer_summary": req.answer_summary,
            }
    speaker_entries = session.buffer.recent(kinds={"speaker_change"})
    return {
        "connection_state": session.connection_state,
        "avatar_state": session.avatar_state,
        "recent_transcript": [e.text for e in session.buffer.recent(kinds={"transcript"})],
        "recent_chat": [e.text for e in session.buffer.recent(kinds={"chat"})],
        "active_speaker": speaker_entries[-1].participant_id if speaker_entries else None,
        "current_investigation": current,
    }


@_task_tool
def zoom_search_historical_meetings(query: str, time_hint: str = None) -> dict:
    """US2/T031: thin pass-through to the official Zoom Meetings MCP
    (research.md R6). Not implemented against a live Zoom MCP connection in
    this environment — the official Zoom MCP's exact tool name/credential
    shape is still TBD per research.md R6/task T030. Returns explicitly so,
    rather than fabricating a result (spec's own "no matching past meeting"
    requirement extended to "can't search at all yet")."""
    return {"matches": [], "note": "official Zoom Meetings MCP integration pending "
                                    "confirmation of its tool name/credential shape (R6/T030)"}


if __name__ == "__main__":
    mcp.run(show_banner=not _DISCOVERY_ONLY)
