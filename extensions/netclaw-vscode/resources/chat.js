(() => {
  const api = acquireVsCodeApi(),
    viewId = document.body.dataset.viewId;
  let selected = new Set(),
    sending = false,
    available = false,
    busy = true,
    invalidated = false,
    canStop = false,
    lost = false;
  const el = (id) => document.getElementById(id);
  const send = window.netclawPost(api, viewId);
  const controls = () => {
    for (const id of ["refresh", "new", "settings", "history", "prompt"])
      el(id).disabled = busy || invalidated;
    el("send").disabled = busy || invalidated || !available || lost || sending;
    el("cancel").disabled = busy || invalidated || !canStop || available;
  };
  const post = (type, payload) => {
    if (invalidated || (busy && !["draft", "ready"].includes(type))) return;
    if (type !== "draft") {
      busy = true;
      controls();
    }
    send(type, payload ? { payload } : {});
  };
  for (const id of ["refresh", "new", "settings", "cancel", "history"])
    el(id)?.addEventListener("click", () => post(id));
  const draft = () =>
    post("draft", { text: el("prompt").value, retain: el("retain").checked });
  let timer;
  el("prompt").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(draft, 350);
  });
  el("retain").addEventListener("change", draft);
  el("composer").addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      busy ||
      invalidated ||
      sending ||
      !available ||
      lost ||
      !el("prompt").value.trim()
    )
      return;
    sending = true;
    el("send").disabled = true;
    el("status").textContent = "Admitting request…";
    post("send", { text: el("prompt").value, contextIds: [...selected] });
  });
  const message = (role, text) => {
    const article = document.createElement("article"),
      heading = document.createElement("h2"),
      body = document.createElement("pre");
    heading.textContent = role;
    body.textContent = text;
    article.append(heading, body);
    el("transcript").append(article);
  };
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data.viewId !== viewId || invalidated) return;
    if (data.type === "notice") {
      el("status").textContent = data.message;
      return;
    }
    if (data.invalidated) {
      invalidated = true;
      el("status").textContent = data.message;
      for (const b of document.querySelectorAll("button")) b.disabled = true;
      return;
    }
    if (data.type === "sent") {
      el("prompt").value = "";
      sending = false;
      return;
    }
    if (data.type === "error") {
      el("status").textContent = data.message;
      sending = false;
      busy = false;
      controls();
      return;
    }
    if (data.type !== "state") return;
    busy = Boolean(data.busy);
    if (!busy) sending = false;
    if (data.initial) {
      el("prompt").value = data.saved.draft || "";
      el("retain").checked = data.saved.retain === true;
    }
    el("transcript").replaceChildren();
    for (const m of data.messages || [])
      message(m.role === "user" ? "You" : "NetClaw", m.content);
    const active = ![
      "completed",
      "failed",
      "cancelled",
      "interrupted",
    ].includes(data.state)
      ? { state: data.state }
      : null;
    available = ["completed", "failed", "cancelled", "interrupted"].includes(
      data.state,
    );
    lost = Boolean(data.saved.pendingNonce && !data.saved.operationId);
    canStop = data.canStop;
    controls();
    el("status").textContent = lost
      ? "Admission is unconfirmed. Check status; nothing will be resent."
      : active
        ? `Request ${active.state}. ${data.runtime === "openclaw" ? "Review owned history; this runtime has no request-status API." : "Check status to retrieve the existing request."} Nothing will be resent.`
        : "Ready for an explicit request.";
    el("contexts").replaceChildren();
    for (const context of data.contexts) {
      const label = document.createElement("label"),
        checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.has(context.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selected.add(context.id);
        else selected.delete(context.id);
      });
      label.append(
        checkbox,
        document.createTextNode(`${context.name} · ${context.size} bytes`),
      );
      el("contexts").append(label);
    }
    if (!data.contexts.length)
      el("contexts").textContent =
        "Use NetClaw: Add Selected Context after selecting text in an editor.";
  });
  controls();
  post("ready");
})();
