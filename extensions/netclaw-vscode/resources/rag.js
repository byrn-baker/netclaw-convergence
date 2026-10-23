(() => {
  const api = acquireVsCodeApi(),
    viewId = document.body.dataset.viewId,
    $ = (id) => document.getElementById(id);
  const send = window.netclawPost(api, viewId);
  let busy = false,
    invalidated = false;
  const controls = () => {
    for (const element of document.querySelectorAll("button, input, select"))
      element.disabled = busy || invalidated;
    $("stage").disabled =
      busy || invalidated || !$("results").querySelector("input:checked");
  };
  const post = (type, fields) => {
    if (busy || invalidated) return;
    busy = true;
    controls();
    $("status").textContent =
      type === "search"
        ? "Searching backend knowledge…"
        : "Waiting for the knowledge operation…";
    send(type, fields);
  };
  const text = (tag, value, parent) => {
    const node = document.createElement(tag);
    node.textContent = String(value ?? "");
    parent.append(node);
    return node;
  };
  for (const id of ["refresh", "upload", "chat", "canvas", "more"])
    $(id).addEventListener("click", () => post(id));
  $("rag-search").addEventListener("submit", (event) => {
    event.preventDefault();
    $("status").textContent = "Searching backend knowledge…";
    post("search", {
      query: $("query").value,
      collection: $("collection").value,
    });
  });
  $("stage").addEventListener("click", () =>
    post("stage", {
      indices: [...$("results").querySelectorAll("input:checked")].map(
        (input) => Number(input.value),
      ),
    }),
  );
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (m.viewId !== viewId) return;
    if (m.type === "busy") {
      busy = m.busy;
      if (
        !busy &&
        $("status").textContent === "Waiting for the knowledge operation…"
      )
        $("status").textContent = "Ready for an explicit knowledge operation.";
      controls();
    }
    if (m.type === "notice" || m.type === "error")
      $("status").textContent = m.message;
    if (m.invalidated) {
      invalidated = true;
      controls();
    }
    if (m.type === "listing") {
      const selected = $("collection").value;
      $("collection").replaceChildren();
      for (const name of [
        ...new Set([
          ...(Array.isArray(m.stats.collections)
            ? m.stats.collections
            : Object.keys(m.stats.collections || { documents: 0 })),
          ...m.documents.map((d) => d.collection).filter(Boolean),
        ]),
      ]) {
        const option = text("option", name, $("collection"));
        option.value = name;
      }
      if ([...$("collection").options].some((o) => o.value === selected))
        $("collection").value = selected;
      $("stats").textContent =
        `${m.total} retained documents, snapshots and replicas · ${m.stats.total_chunks ?? "Unknown"} indexed chunks`;
      $("documents").replaceChildren();
      for (const doc of m.documents) {
        const row = document.createElement("article");
        $("documents").append(row);
        text("h3", doc.title, row);
        text(
          "p",
          `${doc.kind || "document"} · ${doc.collection} · ${doc.ingest_status}`,
          row,
        );
        text(
          "p",
          `${doc.chunk_count ?? 0} chunks · ${doc.ingest_ts || "Ingest time unavailable"}`,
          row,
        );
        if (doc.age_human)
          text(
            "p",
            `${doc.age_human}${doc.stale ? " · Stale snapshot" : ""}`,
            row,
          );
        if (doc.source_peer_identity)
          text(
            "p",
            `Replica from ${doc.source_peer_identity} · ${doc.replicated_at}`,
            row,
          );
        if (doc.error) text("p", doc.error, row);
      }
      if (!m.documents.length)
        text(
          "p",
          "No documents have been uploaded to this store.",
          $("documents"),
        );
      $("more").hidden = !m.nextCursor;
      $("status").textContent = "Collections refreshed.";
      controls();
    }
    if (m.type === "results") {
      $("results").replaceChildren();
      $("stage").disabled = true;
      m.results.forEach((result, index) => {
        const row = document.createElement("article");
        $("results").append(row);
        const label = document.createElement("label"),
          input = document.createElement("input");
        input.type = "checkbox";
        input.value = String(index);
        label.append(
          input,
          document.createTextNode(result.title || "Retrieved passage"),
        );
        row.append(label);
        input.addEventListener("change", () => {
          controls();
        });
        text("p", result.citation, row);
        if (result.low_confidence) text("p", "Low confidence retrieval", row);
        if (result.staleness_notice || result.age_human)
          text("p", result.staleness_notice || result.age_human, row);
        text("pre", result.chunk_text, row);
      });
      $("status").textContent = m.results.length
        ? `${m.results.length} cited passages. Select the results you want to review.`
        : m.message || "No matching passages.";
      controls();
    }
  });
  post("ready");
})();
