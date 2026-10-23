(() => {
  "use strict";
  const api = acquireVsCodeApi(),
    viewId = document.body.dataset.viewId,
    post = window.netclawPost(api, viewId),
    $ = (id) => document.getElementById(id);
  let busy = false,
    invalidated = false,
    readOnly = false,
    dirty = false,
    descriptor;
  const text = (tag, value, parent, cls) => {
    const e = document.createElement(tag);
    e.textContent = value;
    if (cls) e.className = cls;
    parent.append(e);
    return e;
  };
  const send = (type, fields = {}) => {
    if (
      !busy &&
      !invalidated &&
      (!readOnly || ["reload", "environment"].includes(type))
    ) {
      busy = true;
      controls();
      post(type, fields);
    }
  };
  function controls() {
    for (const e of document.querySelectorAll("button,input,select"))
      e.disabled =
        busy ||
        invalidated ||
        (!descriptor && e.id !== "reload") ||
        (readOnly && !["reload", "environment"].includes(e.id));
    if (!busy && descriptor && !readOnly)
      for (const f of descriptor.fields)
        $("value-" + f.key).disabled = $("intent-" + f.key).value !== "replace";
    $("environment").hidden = !readOnly;
    $("environment").disabled ||= !descriptor?.fields.length;
    $("save-fields").hidden = readOnly;
  }
  function draw(d) {
    descriptor = d;
    dirty = false;
    $("summary").replaceChildren();
    text("p", "INTEGRATION / " + d.id, $("summary"), "card-kicker");
    text("h2", d.name, $("summary"));
    text(
      "p",
      d.notes.length > 260 ? d.notes.slice(0, 260) + "…" : d.notes,
      $("summary"),
    );
    if (d.notes.length > 260) {
      const guidance = text("details", "", $("summary"), "source-details");
      text("summary", "Read full setup guidance", guidance);
      text("p", d.notes, guidance);
    }
    text("p", d.setupNote, $("summary"), "hint");
    const status = text("div", "", $("summary"), "toolbar");
    for (const label of [
      "Configuration: presence below",
      "Runtime loaded: unverified",
      "Endpoint: unverified",
    ])
      text("span", label, status, "pill");
    $("fields").replaceChildren();
    if (!d.fields.length)
      text(
        "p",
        "This HUD reports no environment fields for this integration. Review its setup guidance for CLI flags or runtime-owned configuration.",
        $("fields"),
        "empty-state",
      );
    for (const f of d.fields) {
      const box = text("section", "", $("fields"), "field-card");
      const label = text("label", f.label, box);
      label.htmlFor = "value-" + f.key;
      text(
        "p",
        `${f.key} · ${f.isSet ? "Configured" : "Not set"} · ${f.requirement === "unknown" ? "Requirement depends on setup" : f.requirement}`,
        box,
        "hint",
      );
      if (readOnly) continue;
      const intent = text("select", "", box);
      intent.id = "intent-" + f.key;
      intent.setAttribute("aria-label", "Change intent for " + f.label);
      for (const [v, l] of [
        ["keep", "Keep current value"],
        ["replace", "Replace value"],
        ["clear", "Clear value"],
      ]) {
        const o = text("option", l, intent);
        o.value = v;
      }
      const value =
        f.kind === "boolean" || f.kind === "enum"
          ? text("select", "", box)
          : text("input", "", box);
      value.id = "value-" + f.key;
      if (value.tagName === "SELECT") {
        for (const v of f.choices || ["true", "false"]) {
          const o = text("option", v, value);
          o.value = v;
        }
      } else {
        value.type =
          f.kind === "secret"
            ? "password"
            : f.kind === "url"
              ? "url"
              : f.kind === "number"
                ? "number"
                : "text";
        value.maxLength = 8192;
        value.autocomplete = "off";
        value.placeholder = f.example || "Enter a replacement";
      }
      value.disabled = true;
      value.hidden = true;
      const help = text(
        "p",
        f.help +
          (f.sharedWith.length
            ? " Shared with " + f.sharedWith.join(", ") + "."
            : ""),
        box,
        "hint",
      );
      help.id = "help-" + f.key;
      value.setAttribute("aria-describedby", help.id);
      intent.onchange = () => {
        dirty = true;
        value.hidden = intent.value !== "replace";
        value.disabled = intent.value !== "replace";
        value.required = intent.value === "replace";
        if (!value.hidden) value.focus();
      };
      value.oninput = () => {
        dirty = true;
      };
    }
  }
  $("mcp-form").onsubmit = (e) => {
    e.preventDefault();
    if (readOnly || !descriptor) return;
    const changes = {};
    for (const f of descriptor.fields) {
      const intent = $("intent-" + f.key).value;
      if (intent !== "keep")
        changes[f.key] = {
          intent,
          ...(intent === "replace" ? { value: $("value-" + f.key).value } : {}),
        };
    }
    send("save", { changes });
  };
  $("reload").onclick = () => send("reload", { dirty });
  $("setup").onclick = () => send("setup");
  $("environment").onclick = () => send("environment");
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (!m || m.viewId !== viewId || invalidated) return;
    if (m.type === "busy") {
      busy = m.busy;
      controls();
    }
    if (m.type === "configuration") {
      readOnly = Boolean(m.readOnly);
      draw(m.descriptor);
      $("source").textContent =
        m.source +
        (readOnly
          ? " · observed " + m.observedAt
          : " · revision " + m.revision.slice(0, 12));
      $("status").textContent = readOnly
        ? "Configuration inventory loaded · compatibility view"
        : "Configuration loaded. Existing values stay private.";
      $("status").className = "";
      controls();
    }
    if (m.type === "notice") $("status").textContent = m.message;
    if (m.type === "error") {
      $("status").textContent = m.message;
      $("status").className = "notice error";
      if (m.invalidated) {
        invalidated = true;
        $("fields").replaceChildren();
        descriptor = undefined;
        for (const b of document.querySelectorAll("button")) b.disabled = true;
      }
    }
  });
  post("ready");
})();
