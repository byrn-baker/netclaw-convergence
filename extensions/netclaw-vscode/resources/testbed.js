(() => {
  "use strict";
  const api = acquireVsCodeApi(),
    viewId = document.body.dataset.viewId,
    post = window.netclawPost(api, viewId),
    $ = (id) => document.getElementById(id);
  let snapshot,
    busy = false,
    invalidated = false,
    page = 0,
    mode = "cards",
    editing = null,
    pendingFocus,
    draftRevision = 0,
    reviewedRevision,
    formDirty = false,
    yamlDirty = false;
  const drafts = new Map(),
    fields = [
      "id",
      "alias",
      "os",
      "type",
      "platform",
      "connection",
      "protocol",
      "host",
      "port",
    ];
  const text = (tag, value, parent, cls) => {
    const e = document.createElement(tag);
    e.textContent = value;
    if (cls) e.className = cls;
    parent.append(e);
    return e;
  };
  const dirty = () => formDirty || yamlDirty || drafts.size > 0;
  const send = (type, data = {}) => {
    if (!busy && !invalidated && (!snapshot?.readOnly || type === "refresh")) {
      busy = true;
      controls();
      post(type, data);
    }
  };
  const readControls = new Set(["refresh", "filter", "previous", "next"]);
  function controls() {
    for (const e of document.querySelectorAll("button,input,textarea,select"))
      e.disabled =
        busy ||
        invalidated ||
        (!snapshot && e.id !== "refresh") ||
        (snapshot?.readOnly && !readControls.has(e.id));
    $("previous").disabled ||= page === 0;
    $("next").disabled ||=
      !snapshot ||
      (page + 1) * 50 >=
        snapshot.devices.filter((d) =>
          JSON.stringify(d)
            .toLocaleLowerCase()
            .includes($("filter").value.toLocaleLowerCase()),
        ).length;
    if (!busy && !invalidated && pendingFocus) {
      const target = $(pendingFocus);
      pendingFocus = undefined;
      window.netclawReveal(target);
    }
  }
  function clearSnapshot() {
    snapshot = undefined;
    drafts.clear();
    formDirty = yamlDirty = false;
    editing = null;
    pendingFocus = undefined;
    reviewedRevision = undefined;
    mode = "cards";
    $("yaml").value = "";
    $("device-form").reset();
    $("device-form").hidden = $("review").hidden = $("yaml-pane").hidden = true;
    $("cards-pane").hidden = false;
    $("devices").replaceChildren();
    $("target").textContent =
      $("note").textContent =
      $("count").textContent =
        "";
    controls();
  }
  function invalidate() {
    draftRevision++;
    reviewedRevision = undefined;
    $("review").hidden = true;
    // Typing stays entirely in the webview. In particular, do not set VS Code
    // state or round-trip through a remote extension host on each keystroke.
    // Save carries this revision so the host rejects an outdated preview.
  }
  function values() {
    return Object.fromEntries(fields.map((k) => [k, $("device-" + k).value]));
  }
  function stash() {
    if (editing !== null && formDirty) drafts.set(editing, values());
  }
  function connection(c) {
    $("device-connection").value = c?.name || "cli";
    $("device-protocol").value = c?.protocol || "ssh";
    $("device-host").value = c?.host || "";
    $("device-port").value = c?.port ?? "";
  }
  function edit(id) {
    stash();
    editing = id || "";
    const d = snapshot.devices.find((x) => x.id === id);
    for (const k of fields) $("device-" + k).value = d?.[k] || "";
    $("device-id").readOnly = Boolean(d);
    $("form-title").textContent = d ? "Edit " + d.id : "Add a device";
    const choice = $("connection-choice");
    choice.replaceChildren();
    for (const c of d?.connections || []) {
      const o = text("option", c.name, choice);
      o.value = c.name;
    }
    const option = text("option", "New connection…", choice);
    option.value = "";
    if (d?.connections?.length) choice.value = d.connections[0].name;
    connection(d?.connections?.[0]);
    const saved = drafts.get(editing);
    if (saved) for (const k of fields) $("device-" + k).value = saved[k];
    if (saved)
      choice.value = d?.connections?.some((c) => c.name === saved.connection)
        ? saved.connection
        : "";
    formDirty = Boolean(saved);
    $("device-form").hidden = false;
    $("yaml-pane").hidden = true;
    $("cards-pane").hidden = false;
    mode = "cards";
    pendingFocus = d ? "device-alias" : "device-id";
    controls();
  }
  function switchMode(next, id, discard) {
    invalidate();
    if (discard) {
      drafts.clear();
      formDirty = yamlDirty = false;
      $("yaml").value = snapshot.content;
    } else stash();
    if (next === "add" || next === "edit") {
      edit(next === "edit" ? id : "");
      return;
    }
    if (next === "close") {
      $("device-form").hidden = true;
      pendingFocus = "add";
      controls();
      return;
    }
    mode = next;
    $("cards-pane").hidden = next !== "cards";
    $("yaml-pane").hidden = next !== "yaml";
    $("device-form").hidden = true;
    pendingFocus = next === "yaml" ? "yaml" : "filter";
    controls();
  }
  function switchRequest(next, id) {
    send("switch", { mode: next, id, dirty: dirty() });
  }
  function draw() {
    if (!snapshot) return;
    const query = $("filter").value.toLocaleLowerCase(),
      rows = snapshot.devices.filter((d) =>
        JSON.stringify(d).toLocaleLowerCase().includes(query),
      );
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1));
    $("devices").replaceChildren();
    $("count").textContent = rows.length
      ? `${page * 50 + 1}–${Math.min(page * 50 + 50, rows.length)} of ${rows.length} devices`
      : snapshot.devices.length
        ? "No devices match your search."
        : snapshot.readOnly
          ? "The HUD returned no configured devices."
          : "Your testbed is empty. Add a device or import an inventory.";
    for (const d of rows.slice(page * 50, page * 50 + 50)) {
      const card = text("article", "", $("devices"), "info-card");
      text("p", d.os || "DEVICE", card, "card-kicker");
      text("h3", d.alias || d.id, card);
      const dl = text("dl", "", card, "facts");
      for (const [label, value] of [
        ["Device ID", d.id],
        ["Platform", d.platform || "Not specified"],
        ["Type", d.type || "Not specified"],
        [
          "Connections",
          d.connections
            .map(
              (c) =>
                `${c.name} · ${c.protocol || "unspecified"} · ${c.host || "no address"}${c.port ? ":" + c.port : ""}`,
            )
            .join("\n") || "None configured",
        ],
      ]) {
        text("dt", label, dl);
        text("dd", value, dl);
      }
      if (snapshot.readOnly) continue;
      const bar = text("div", "", card, "toolbar");
      const e = text("button", "Edit device", bar);
      e.addEventListener("click", () => switchRequest("edit", d.id));
      const r = text("button", "Remove", bar, "secondary danger");
      r.addEventListener("click", () =>
        send("preview", {
          draftRevision,
          operation: { type: "remove", id: d.id },
        }),
      );
    }
    controls();
  }
  $("filter").addEventListener("input", () => {
    page = 0;
    draw();
  });
  $("previous").onclick = () => {
    page = Math.max(0, page - 1);
    draw();
  };
  $("next").onclick = () => {
    page++;
    draw();
  };
  $("add").onclick = () => switchRequest("add");
  $("cards-mode").onclick = () => switchRequest("cards");
  $("yaml-mode").onclick = () => switchRequest("yaml");
  $("cancel-form").onclick = () => switchRequest("close");
  $("connection-choice").onchange = () => {
    const d = snapshot.devices.find((d) => d.id === editing);
    connection(
      d?.connections.find((c) => c.name === $("connection-choice").value),
    );
    formDirty = true;
    invalidate();
  };
  $("device-form").addEventListener("input", () => {
    formDirty = true;
    invalidate();
  });
  $("yaml").addEventListener("input", () => {
    yamlDirty = true;
    invalidate();
  });
  $("device-form").onsubmit = (event) => {
    event.preventDefault();
    const v = values();
    send("preview", {
      draftRevision,
      operation: {
        type: editing ? "update" : "create",
        id: v.id,
        fields: Object.fromEntries(
          ["alias", "os", "type", "platform"].map((k) => [k, v[k]]),
        ),
        connection: v.connection,
        endpoint: {
          protocol: v.protocol,
          host: v.host,
          ...(v.port ? { port: Number(v.port) } : {}),
        },
      },
    });
  };
  $("preview-yaml").onclick = () =>
    send("preview", {
      draftRevision,
      operation: { type: "document", content: $("yaml").value },
    });
  for (const type of ["refresh", "import", "export", "recover"])
    $(type).onclick = () => send(type, { dirty: dirty(), draftRevision });
  $("save").onclick = () => {
    if (reviewedRevision === draftRevision) send("save", { draftRevision });
  };
  $("cancel-review").onclick = () => invalidate();
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (!m || m.viewId !== viewId || invalidated) return;
    if (m.type === "busy") {
      busy = m.busy;
      controls();
      if (!busy) draw();
    }
    if (m.type === "loading") {
      clearSnapshot();
      $("status").textContent = "Loading testbed…";
      $("status").className = "";
    }
    if (m.type === "snapshot") {
      invalidate();
      snapshot = m.snapshot;
      drafts.clear();
      formDirty = yamlDirty = false;
      editing = null;
      $("device-form").hidden = $("review").hidden = true;
      $("yaml").value = snapshot.content || "";
      if (snapshot.readOnly) switchMode("cards", undefined, false);
      $("target").textContent =
        snapshot.source +
        (snapshot.readOnly
          ? " · observed " + snapshot.observedAt
          : " · revision " + snapshot.revision.slice(0, 12));
      $("note").textContent = snapshot.note;
      $("status").textContent = snapshot.readOnly
        ? "Testbed loaded · viewing only · no device connections"
        : "Testbed loaded · no device connections";
      $("status").className = "";
      draw();
    }
    if (m.type === "switch") switchMode(m.mode, m.id, m.discard);
    if (m.type === "imported") {
      $("yaml").value = snapshot.content;
      drafts.clear();
      formDirty = yamlDirty = false;
      $("device-form").hidden = true;
    }
    if (m.type === "preview") {
      if (m.draftRevision !== draftRevision) return;
      reviewedRevision = m.draftRevision;
      const r = m.review;
      const body = $("review-body");
      body.replaceChildren();
      for (const [label, value] of [
        ["Destination", r.source],
        ["Add", r.added.join(", ") || "None"],
        ["Update", r.changed.join(", ") || "None"],
        ["Remove", r.removed.join(", ") || "None"],
        ["Shared defaults", r.sharedChanged ? "Changed" : "Unchanged"],
        ["Topology configuration", r.topologyChanged ? "Changed" : "Unchanged"],
        [
          "Credential changes",
          r.secretChanges.map((s) => s.path + " · " + s.intent).join("\n") ||
            "Existing values retained",
        ],
        [
          "Collection consent",
          `${r.affected.length} affected device(s) will require new consent`,
        ],
      ]) {
        const p = text("p", "", body);
        text("strong", label + ": ", p);
        p.append(document.createTextNode(value));
      }
      text("p", r.notice, body, "hint");
      $("review").hidden = false;
      $("status").textContent = "Preview ready. No changes saved.";
      pendingFocus = "save";
      controls();
    }
    if (m.type === "notice") $("status").textContent = m.message;
    if (m.type === "error") {
      $("review").hidden = true;
      $("status").textContent = m.message;
      $("status").className = "notice error";
      if (m.invalidated) {
        invalidated = true;
        clearSnapshot();
      }
    }
  });
  controls();
  post("ready");
})();
