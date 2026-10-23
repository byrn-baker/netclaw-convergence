(() => {
  const api = acquireVsCodeApi(),
    $ = (id) => document.getElementById(id),
    send = window.netclawPost(api, document.body.dataset.viewId);
  let snapshot,
    busy = false,
    invalid = false,
    dirty = false,
    pendingFocus,
    page = 0,
    logs = "";
  const el = (tag, value, parent, cls) => {
    const n = document.createElement(tag);
    n.textContent = String(value ?? "Not reported");
    if (cls) n.className = cls;
    parent.append(n);
    return n;
  };
  const post = (type, fields = {}) => {
    if (busy || invalid) return;
    busy = true;
    controls();
    send(type, fields);
  };
  function controls() {
    for (const node of document.querySelectorAll(
      "button,input,select,textarea",
    ))
      node.disabled = busy || invalid;
    for (const node of $("policy-section").querySelectorAll(
      "button,input,select,textarea",
    ))
      node.disabled = busy || invalid || !snapshot?.editable;
    $("apply-security").disabled = busy || invalid || !snapshot?.editable;
    if (snapshot?.editableSettings === false)
      for (const node of $("enforcement").querySelectorAll(
        "button,input,select",
      ))
        node.disabled = true;
    for (const id of ["rule-filter", "previous", "next"])
      if ($(id)) $(id).disabled = busy || invalid;
    if (!busy && !invalid && pendingFocus) {
      window.netclawReveal($(pendingFocus));
      pendingFocus = undefined;
    }
  }
  function changed() {
    dirty = true;
    $("security-review").hidden = true;
  }
  function preview(operation) {
    post("preview", {
      operation,
      revision: snapshot?.revision,
      reason: $("security-reason").value,
    });
  }
  function posture(data) {
    $("posture").replaceChildren();
    const facts = data?.data ?? data ?? {};
    for (const [key, value] of Object.entries(facts)
      .filter(([key]) => !["data_dir", "config"].includes(key))
      .slice(0, 24)) {
      const card = el("article", "", $("posture"), "info-card");
      el(
        "h3",
        key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
        card,
      );
      if (value && typeof value === "object") {
        const rows = Array.isArray(value)
          ? value
          : Object.entries(value).map(([key, value]) => ({ [key]: value }));
        for (const row of rows.slice(0, 12))
          el(
            "p",
            typeof row === "object"
              ? Object.entries(row)
                  .map(
                    ([k, v]) =>
                      `${k.replaceAll("_", " ")}: ${v === null ? "not reported" : typeof v === "object" ? JSON.stringify(v) : v}`,
                  )
                  .join(" · ")
              : row,
            card,
            "hint",
          );
      } else el("p", value, card);
    }
    if (!$("posture").children.length)
      el("p", "No structured status was reported.", $("posture"), "notice");
  }
  function ruleRows() {
    if (snapshot?.product === "defenseclaw")
      return ["allowed", "denied"].flatMap((list) =>
        (snapshot.rules?.[list] || []).map((r) => ({
          ...r,
          list,
          title: r.name,
          description: `${list === "allowed" ? "Allow" : "Block"} · ${r.scope === "source" ? "Source record (audit only)" : r.connector || "All connectors · global fallback"} · ${r.reason || "No reason recorded"}`,
        })),
      );
    let network = snapshot?.network || {};
    try {
      network = JSON.parse($("network-json").value);
    } catch {}
    return Object.entries(network).map(([name, value]) => ({
      name,
      title: name,
      description: [
        ...(Array.isArray(value?.endpoints)
          ? value.endpoints
              .slice(0, 5)
              .map(
                (e) =>
                  `${e.host || "Host not reported"}:${e.port ?? "port not reported"} · ${e.access || "native access policy"} · ${e.enforcement || "native enforcement"}${Array.isArray(e.rules) ? ` · ${e.rules.length} layer7 rules` : ""}`,
              )
          : ["Advanced network rule"]),
        ...(Array.isArray(value?.binaries)
          ? value.binaries
              .slice(0, 4)
              .map((b) => `Executable: ${b.path || "not reported"}`)
          : []),
      ].join("\n"),
      value,
    }));
  }
  function rules() {
    const filter = $("rule-filter").value.toLowerCase(),
      rows = ruleRows().filter((r) =>
        JSON.stringify(r).toLowerCase().includes(filter),
      );
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / 50) - 1));
    $("rules").replaceChildren();
    for (const row of rows.slice(page * 50, page * 50 + 50)) {
      const card = el("article", "", $("rules"), "info-card");
      el(
        "p",
        snapshot.product === "defenseclaw"
          ? row.list === "allowed"
            ? "ALLOW RULE"
            : "BLOCK RULE"
          : "NETWORK POLICY",
        card,
        "eyebrow",
      );
      el("h3", row.title, card);
      el("p", row.description.slice(0, 700), card, "hint");
      if (
        snapshot.editable &&
        (!snapshot.nativeTools || row.scope === "connector")
      ) {
        const edit = el(
          "button",
          snapshot.product === "defenseclaw" ? "Edit rule" : "Edit policy",
          card,
          "secondary",
        );
        edit.onclick = () => {
          changed();
          if (snapshot.product === "defenseclaw") {
            $("tool-name").value = row.name;
            $("tool-connector").value = row.connector || "";
            $("tool-action").value = row.list === "allowed" ? "allow" : "block";
            $("tool-name").focus();
          } else $("network-json").focus();
        };
        const remove = el("button", "Remove from draft", card, "secondary");
        remove.onclick = () => {
          if (snapshot.product === "defenseclaw") {
            $("tool-name").value = row.name;
            $("tool-connector").value = row.connector || "";
            $("tool-action").value = "remove";
            $("tool-name").focus();
          } else {
            try {
              const value = JSON.parse($("network-json").value);
              delete value[row.name];
              $("network-json").value = JSON.stringify(value, null, 2);
              rules();
            } catch {
              $("status").textContent =
                "Correct the network JSON before removing a rule.";
            }
          }
          changed();
        };
      }
    }
    if (!rows.length)
      el(
        "p",
        filter
          ? "No rules match your search."
          : "No explicit rules were reported. Defaults and other scopes can still apply.",
        $("rules"),
        "notice",
      );
    $("rule-count").textContent =
      `${rows.length} matching rules · page ${page + 1} · 50 per page`;
    $("previous").hidden = page === 0;
    $("next").hidden = (page + 1) * 50 >= rows.length;
  }
  function values() {
    const key = $("setting-key").value,
      values =
        key === "mode"
          ? ["action", "observe"]
          : ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    $("setting-value").replaceChildren();
    for (const value of values) {
      const o = el("option", value, $("setting-value"));
      o.value = value;
    }
    const current = snapshot?.settings?.[key];
    if (values.includes(current)) $("setting-value").value = current;
  }
  function documents(data = {}) {
    $("permissions-section").hidden = !data.permissions;
    $("permissions").textContent = data.permissions
      ? JSON.stringify(data.permissions, null, 2)
      : "";
    $("policy-document-section").hidden = !data.policyYaml;
    $("policy-yaml").textContent = data.policyYaml || "";
    $("policy-location").textContent = data.policyLocation || "";
  }
  $("bind").onclick = () => post("bind", { dirty });
  $("refresh").onclick = () => post("refresh", { dirty });
  $("rule-filter").oninput = () => {
    page = 0;
    rules();
  };
  $("previous").onclick = () => {
    page--;
    rules();
  };
  $("next").onclick = () => {
    page++;
    rules();
  };
  $("log-filter").oninput = () => {
    $("security-logs").textContent = logs
      .split("\n")
      .filter((line) =>
        line.toLowerCase().includes($("log-filter").value.toLowerCase()),
      )
      .join("\n");
  };
  $("setting-key").onchange = () => {
    values();
    changed();
  };
  $("tool-rule").onsubmit = (e) => {
    e.preventDefault();
    preview({
      type: "rule",
      name: $("tool-name").value,
      connector: $("tool-connector").value,
      action: $("tool-action").value,
    });
  };
  $("enforcement").onsubmit = (e) => {
    e.preventDefault();
    preview({
      type: "setting",
      key: $("setting-key").value,
      value: $("setting-value").value,
    });
  };
  $("network-rule").onsubmit = (e) => {
    e.preventDefault();
    try {
      const network = JSON.parse($("network-json").value),
        name = $("network-name").value,
        host = $("network-host").value,
        binary = $("network-binary").value;
      if (
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name) ||
        Object.hasOwn(network, name) ||
        !host ||
        /[\s/@?:]/.test(host) ||
        !binary.startsWith("/") ||
        /[\r\n\0]/.test(binary)
      )
        throw Error(
          "Use a unique rule ID, a hostname/IP without URL credentials, and an absolute binary path.",
        );
      network[name] = {
        name,
        endpoints: [
          {
            host,
            port: Number($("network-port").value),
            protocol: "rest",
            enforcement: $("network-enforcement").value,
            access: "read-only",
          },
        ],
        binaries: [{ path: binary }],
      };
      $("network-json").value = JSON.stringify(network, null, 2);
      changed();
      rules();
      $("status").textContent =
        "Network draft updated. Preview it before applying.";
    } catch (error) {
      $("status").textContent =
        error.message || "Correct the network JSON first.";
    }
  };
  $("preview-network").onclick = () =>
    preview({ type: "network", content: $("network-json").value });
  $("apply-security").onclick = () => post("apply");
  $("cancel-security").onclick = () => post("cancel");
  for (const node of $("policy-section").querySelectorAll(
    'input:not([type="search"]),textarea,select',
  ))
    node.addEventListener("input", changed);
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (m.viewId !== document.body.dataset.viewId) return;
    if (m.type === "busy") {
      busy = m.busy;
      controls();
    }
    if (m.type === "security-unavailable") {
      if (snapshot) snapshot.editable = false;
      $("security-review").hidden = true;
      $("security-note").textContent =
        "Refresh failed. Any visible snapshot is historical; reload successfully before editing.";
      controls();
    }
    if (m.type === "unbound") {
      snapshot = undefined;
      documents();
      dirty = false;
      $("policy-section").hidden = true;
      $("status").textContent =
        "Observed result · choose a native target to inspect and edit its security rules.";
      $("security-target").textContent =
        "Selected NetClaw posture; native security target is not bound.";
      $("security-note").textContent =
        "Security profiles and gateways may protect multiple agents. Choose the exact existing target on this extension host.";
      posture(m.observed);
      controls();
    }
    if (m.type === "security") {
      snapshot = m.snapshot;
      documents(snapshot);
      dirty = false;
      page = 0;
      $("security-review").hidden = true;
      $("security-reason").value = "";
      const t = snapshot.target;
      $("security-target").textContent =
        `${snapshot.version} · ${t.securityHome}${t.product === "openshell" ? ` · ${t.gateway} / ${t.workspace} / ${t.sandbox}` : ""}`;
      $("security-note").textContent = snapshot.note;
      $("status").textContent = snapshot.editable
        ? "Security policy loaded. Review changes before applying."
        : snapshot.reason;
      posture({
        ...(snapshot.status.available
          ? snapshot.status.data
          : { status: snapshot.status.message }),
        ...(t.product === "openshell"
          ? {
              policy_source: snapshot.policySource,
              policy_revision: snapshot.policyVersion,
              active_policy_revision: snapshot.activePolicyVersion,
            }
          : {}),
      });
      $("policy-section").hidden = !snapshot.rules && !snapshot.network;
      $("tool-rule").hidden = $("enforcement").hidden =
        t.product !== "defenseclaw";
      $("network-rule").hidden = $("network-editor").hidden =
        t.product !== "openshell";
      $("policy-help").textContent =
        t.product === "defenseclaw"
          ? "Allow rules can bypass some checks; block rules deny matched tools. Connector overrides and native policy precedence still apply." +
            (snapshot.nativeTools
              ? " This version supports connector tool edits; global fallback, source records and enforcement defaults are view-only."
              : "")
          : "Sandbox-owned base network rules. Effective provider/global policy is a separate scope. Native layer7 allow/deny rules are not a universal host blacklist.";
      $("tool-connector").replaceChildren();
      const global = el(
        "option",
        "All connectors · global fallback",
        $("tool-connector"),
      );
      global.value = "";
      global.disabled = Boolean(snapshot.nativeTools);
      for (const name of snapshot.connectors || []) {
        const o = el("option", name, $("tool-connector"));
        o.value = name;
      }
      if (snapshot.nativeTools)
        $("tool-connector").value = snapshot.connectors?.[0] || "";
      $("network-json").value = JSON.stringify(snapshot.network || {}, null, 2);
      values();
      rules();
      logs = snapshot.logs.content || "";
      $("logs-note").textContent = snapshot.logs.available
        ? "Bounded, redacted snapshot. Refresh explicitly for new entries."
        : snapshot.logs.message;
      $("log-filter").oninput();
      controls();
    }
    if (m.type === "review") {
      $("security-review").hidden = false;
      $("review-summary").textContent = m.summary;
      $("review-difference").textContent = m.difference || "";
      $("review-impact").textContent =
        (m.weakening ? "This change can weaken protection. " : "") + m.impact;
      pendingFocus = "apply-security";
      controls();
    }
    if (m.type === "cancelled") $("security-review").hidden = true;
    if (m.type === "notice" || m.type === "error")
      $("status").textContent = m.message;
    if (m.type === "error") $("security-review").hidden = true;
    if (m.invalidated) {
      invalid = true;
      snapshot = undefined;
      documents();
      logs = "";
      $("network-json").value = "";
      $("security-reason").value = "";
      $("tool-name").value = "";
      $("security-logs").textContent = "";
      $("rules").replaceChildren();
      $("posture").replaceChildren();
      $("security-review").hidden = true;
      $("review-difference").textContent = "";
      controls();
    }
  });
  values();
  controls();
  post("ready");
})();
