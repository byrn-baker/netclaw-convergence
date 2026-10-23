/**
 * NetClaw Zoom App side panel (spec 118, tasks T021/T034/T035/T036/T037).
 * Connects to zoom-rtms-mcp's panel_feed WebSocket
 * (contracts/zoom-app-panel-feed.md), renders avatar/status/results, wires
 * Collaborate Mode + Guest Mode (US3), and offers the camera-overlay toggle
 * (US5, delegates the actual Layers API call to overlay.js).
 */

const AVATAR_ICONS = {
  listening: "🦞", thinking: "🤔", investigating: "🔍", answered: "✅",
};

let meetingUuid = null;
let participantId = null;
let ws = null;
let overlayEnabled = false;

const avatarEl = document.getElementById("avatar");
const statusEl = document.getElementById("status");
const topicEl = document.getElementById("topic");
const resultEl = document.getElementById("result");
const overlayBtn = document.getElementById("overlay-toggle");

async function connect() {
  let context;
  try {
    if (typeof zoomSdk === "undefined") throw new Error("Open this panel inside Zoom");
    context = (await zoomSdk.getAppContext()).context;
    if (!context) throw new Error("Zoom meeting context unavailable");
  } catch (_) {
    statusEl.textContent = "Open NetClaw inside a Zoom meeting to connect securely.";
    statusEl.className = "degraded";
    return;
  }
  const wsUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/";
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    statusEl.textContent = "Verifying meeting…";
    send({ type: "authenticate", context });
    context = null;
  };
  ws.onclose = (event) => {
    statusEl.className = "degraded";
    if (event.code === 1008) {
      statusEl.textContent = "Meeting authorization failed. Reopen NetClaw in Zoom.";
      return;
    }
    statusEl.textContent = "Disconnected — retrying…";
    setTimeout(connect, 3000);
  };
  ws.onerror = () => {};
  ws.onmessage = (event) => {
    try { handleServerMessage(JSON.parse(event.data)); }
    catch (_) { statusEl.textContent = "Unable to read meeting update."; }
  };
}

function sendViewerJoined() {
  send({ type: "viewer_joined", meeting_uuid: meetingUuid, participant_id: participantId });
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function handleServerMessage(msg) {
  if (msg.type === "identified") {
    // Meeting identity verified by the server from Zoom app context.
    meetingUuid = msg.meeting_uuid;
    sendViewerJoined();
    return;
  }
  if (msg.meeting_uuid && msg.meeting_uuid !== meetingUuid) return;

  switch (msg.type) {
    case "avatar_state":
      avatarEl.textContent = AVATAR_ICONS[msg.state] || "🦞";
      statusEl.textContent = msg.state.charAt(0).toUpperCase() + msg.state.slice(1);
      statusEl.className = "";
      if (window.NetClawOverlay) window.NetClawOverlay.setState(msg.state);
      break;
    case "topic_detected":
      topicEl.style.display = "block";
      topicEl.textContent = [
        msg.location ? `Location: ${msg.location}` : null,
        msg.technology ? `Technology: ${msg.technology}` : null,
        msg.time_window ? `Time window: ${msg.time_window}` : null,
      ].filter(Boolean).join(" · ") || "Investigating detected topic…";
      break;
    case "investigation_result":
      resultEl.style.display = "block";
      resultEl.textContent = msg.answer_summary || "Could not complete this investigation.";
      break;
    case "connection_state":
      if (msg.state === "degraded") {
        statusEl.textContent = "Connection degraded";
        statusEl.className = "degraded";
      } else if (msg.state === "connecting") {
        statusEl.textContent = "Connecting…";
        statusEl.className = "connecting";
      }
      break;
  }
}

overlayBtn.addEventListener("click", async () => {
  if (overlayBtn.disabled) return;
  if (!window.NetClawOverlay) {
    statusEl.textContent = "Camera overlay unavailable in this build.";
    return;
  }
  overlayBtn.disabled = true;
  const next = !overlayEnabled;
  try {
    const ok = next ? await window.NetClawOverlay.enable() : await window.NetClawOverlay.disable();
    if (ok !== true) throw new Error("Camera overlay change was not confirmed.");
    overlayEnabled = next;
    overlayBtn.textContent = overlayEnabled ? "Disable camera overlay" : "Enable camera overlay";
    overlayBtn.className = overlayEnabled ? "enabled" : "";
    send({
      type: overlayEnabled ? "camera_overlay_enable" : "camera_overlay_disable",
      meeting_uuid: meetingUuid, participant_id: participantId,
    });
  } catch (error) {
    statusEl.textContent = "Camera overlay unavailable or change failed.";
    console.warn("NetClaw overlay change failed", error);
  } finally {
    overlayBtn.disabled = false;
  }
});

// ---- Zoom Apps SDK: Collaborate Mode + Guest Mode (US3) --------------------

async function initZoomSdk() {
  if (typeof zoomSdk === "undefined") {
    // Not running inside the Zoom client (e.g. local dev) — fall back to a
    // query-string meeting_uuid so the panel is still testable standalone.
    const params = new URLSearchParams(location.search);
    meetingUuid = params.get("meeting_uuid") || "dev-meeting";
    participantId = params.get("participant_id") || "dev-participant";
    connect();
    return;
  }

  // Collaborate Mode capabilities (startCollaborate/joinCollaborate/
  // leaveCollaborate/onCollaborateChange) only actually work once this app
  // has passed Zoom's app review — until then, requesting them can make
  // zoomSdk.config() reject outright. Request core + Collaborate together
  // first, but fall back to core-only rather than letting one rejected
  // capability set kill the whole panel before it ever connects.
  const CORE_CAPS = ["getAppContext", "getRunningContext", "getMeetingContext", "getUserContext", "onMeeting"];
  const COLLABORATE_CAPS = ["startCollaborate", "joinCollaborate", "leaveCollaborate", "onCollaborateChange"];
  let collaborateAvailable = true;
  try {
    await zoomSdk.config({ capabilities: [...CORE_CAPS, ...COLLABORATE_CAPS] });
  } catch (err) {
    console.warn("NetClaw: Collaborate Mode capabilities unavailable (app review pending?) — falling back to core capabilities.", err);
    collaborateAvailable = false;
    try {
      await zoomSdk.config({ capabilities: CORE_CAPS });
    } catch (err2) {
      console.error("NetClaw: zoomSdk.config failed even with core capabilities — falling back to standalone mode.", err2);
      const params = new URLSearchParams(location.search);
      meetingUuid = params.get("meeting_uuid") || "dev-meeting";
      participantId = params.get("participant_id") || "dev-participant";
      connect();
      return;
    }
  }

  // Split into two try/catch blocks (confirmed live 2026-08-19: a combined
  // block made it impossible to tell from the console which of the two calls
  // was actually the one throwing "No Permission for this API [code:80004,
  // reason:app_not_support]" — that ambiguity cost a full debugging round).
  try {
    const meetingContext = await zoomSdk.getMeetingContext();
    meetingUuid = meetingContext.meetingUUID;
  } catch (err) {
    console.error("NetClaw: getMeetingContext() failed — this is the critical one, no meeting_uuid means nothing can ever route:", err);
    // Last-resort fallback: Zoom sometimes appends meeting_uuid as a query
    // param on the Home URL launch even when the SDK call itself is denied.
    // Never falls back to a made-up value like "dev-meeting" here (unlike
    // the zoomSdk-undefined branch above) — a wrong meeting_uuid would
    // register this connection under a key nothing will ever push to,
    // identical in effect to never registering at all, just harder to debug.
    const params = new URLSearchParams(location.search);
    meetingUuid = params.get("meeting_uuid") || null;
  }

  try {
    const userContext = await zoomSdk.getUserContext();
    // Guest Mode (FR-012): an unauthenticated participant still has a
    // per-session participantId even without a Zoom login — treated
    // identically to an authenticated one by this panel and by panel_feed.py.
    participantId = userContext.participantId || userContext.screenName || "guest";
  } catch (err) {
    console.error("NetClaw: getUserContext() failed — camera-overlay own-feed restriction degrades to \"unknown\", viewer registration still proceeds on meeting_uuid alone:", err);
    participantId = "unknown-participant";
  }

  if (collaborateAvailable) {
    try {
      zoomSdk.onCollaborateChange((event) => {
        // Collaborate Mode (US3): every collaborator renders the same
        // meeting_uuid-scoped state via the shared panel_feed connection —
        // nothing extra needed here beyond making sure this connection is live.
        if (event.collaborateUUID && !ws) connect();
      });
    } catch (err) {
      console.warn("NetClaw: onCollaborateChange registration failed.", err);
    }
  }

  connect();
}

initZoomSdk();
