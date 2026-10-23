(() => {
  const $ = (s) => document.querySelector(s);
  const post = window.netclawPost(
    acquireVsCodeApi(),
    document.body.dataset.viewId,
  );
  let available = false,
    busy = false,
    invalidated = false;
  const setDisabled = () =>
    document.querySelectorAll("button").forEach((b) => {
      b.disabled =
        busy ||
        invalidated ||
        b.dataset.unavailable === "true" ||
        (["start", "stop", "restart"].includes(b.dataset.action) && !available);
    });
  document.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button || button.disabled) return;
    post(button.dataset.action, { name: button.dataset.name });
  });
  window.addEventListener("message", ({ data: m }) => {
    if (m.viewId !== document.body.dataset.viewId) return;
    if (m.type === "busy") {
      busy = m.busy;
      setDisabled();
      return;
    }
    if (m.type === "error" || m.type === "notice") {
      $("#message").textContent = m.message;
      if (m.invalidated) invalidated = true;
      setDisabled();
      return;
    }
    if (m.type !== "state") return;
    const d = m.data,
      l = d.lifecycle;
    available = l.available;
    $("#workspace-path").textContent = d.workspace;
    $("#loading").textContent = d.loading;
    $("#service-summary").textContent = l.services.length
      ? l.services.map((s) => `${s.role}: ${s.state}`).join(" · ")
      : "Service ownership unavailable";
    $("#capability").textContent =
      l.reason ||
      `${l.activity} ${l.absent.includes("federation") ? "Federation is not configured." : ""}`;
    $("#services").replaceChildren(
      ...l.services.map((s) => {
        const badge = document.createElement("span");
        badge.className = "service-badge";
        badge.textContent = `${s.role} · ${s.state}`;
        return badge;
      }),
    );
    $("#file-list").replaceChildren(
      ...d.files.map((f) => {
        const row = document.createElement("article");
        row.className = "workspace-file";
        const button = document.createElement("button");
        button.className = "file-open secondary";
        button.dataset.action = "open";
        button.dataset.name = f.name;
        button.textContent = f.name;
        button.dataset.unavailable = String(Boolean(f.error));
        const description = document.createElement("div");
        const purpose = document.createElement("p");
        purpose.textContent = f.purpose;
        const meta = document.createElement("p");
        meta.className = "muted";
        meta.textContent =
          f.error ||
          `${f.exists ? f.bytes.toLocaleString() + " bytes" : "Missing · upload to create"} · ${d.kind === "hermes" ? "Stored persona file" : f.loadedWhen}`;
        description.append(purpose, meta);
        const upload = document.createElement("button");
        upload.className = "secondary file-upload";
        upload.dataset.action = "upload";
        upload.dataset.name = f.name;
        upload.textContent = "Upload";
        upload.setAttribute("aria-label", "Upload / overwrite " + f.name);
        row.append(button, description, upload);
        return row;
      }),
    );
    setDisabled();
  });
  post("ready");
})();
