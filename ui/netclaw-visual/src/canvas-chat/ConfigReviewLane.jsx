import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAX_CONFIG_CHARS = 2_000_000;

function cleanFileName(value, fallback = "running-config") {
  const stem = String(value || fallback)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return stem || fallback;
}

function downloadTextFile(name, type, text) {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

function reviewMarkdown(node) {
  const source = String(node.configSource || "").replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const notes = Array.isArray(node.configNotes) ? node.configNotes : [];
  const byLine = new Map();
  notes.forEach((note) => {
    const key = Number.isInteger(note.afterLine) ? note.afterLine : -1;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key).push(note);
  });
  const rendered = [];
  const emitNotes = (afterLine) => {
    (byLine.get(afterLine) || []).forEach((note) => {
      const author = note.author || "Local reviewer";
      const text = String(note.text || "").trim().replace(/\n/g, "\n  ");
      rendered.push(`! [NETCLAW REVIEW NOTE — ${author}] ${text}`);
    });
  };
  emitNotes(-1);
  lines.forEach((line, index) => {
    rendered.push(line);
    emitNotes(index);
  });
  const sourceName = node.configSourceName || "running-config.txt";
  return [
    `# Configuration review: ${sourceName}`,
    "",
    "> Review artifact only. This file contains commentary and must not be sent to a device.",
    "",
    `- Source lines: ${lines.length}`,
    `- Review comments: ${notes.length}`,
    `- Exported: ${new Date().toISOString()}`,
    "",
    "```text",
    ...rendered,
    "```",
    "",
  ].join("\n");
}

function noteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ConfigReviewLane({
  node,
  color,
  isActive,
  selected,
  animate,
  theme,
  portalTheme,
  laneRef,
  onFocus,
  onDragStart,
  onResizeStart,
  onToggleMin,
  onDelete,
  onAutoFit,
  onCommit,
  onPatch,
}) {
  const fileRef = useRef(null);
  const source = String(node.configSource || "").replace(/\r\n?/g, "\n");
  const notes = Array.isArray(node.configNotes) ? node.configNotes : [];
  const [sourceMode, setSourceMode] = useState(!source);
  const [sourceDraft, setSourceDraft] = useState(source);
  const [sourceNameDraft, setSourceNameDraft] = useState(node.configSourceName || "running-config.txt");
  const [editingNote, setEditingNote] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [query, setQuery] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const lines = useMemo(() => source.split("\n"), [source]);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingLines = normalizedQuery
    ? lines.reduce((count, line) => count + (line.toLowerCase().includes(normalizedQuery) ? 1 : 0), 0)
    : 0;

  const flashMessage = (message) => {
    setFlash(message);
    window.setTimeout(() => setFlash(""), 2300);
  };

  const updateNotes = (updater) => {
    onPatch((current) => ({
      configNotes: updater(Array.isArray(current.configNotes) ? current.configNotes : []),
    }));
  };

  const addNote = (afterLine) => {
    onCommit();
    const id = noteId();
    updateNotes((current) => [
      ...current,
      {
        id,
        afterLine,
        text: "",
        author: "Local reviewer",
        createdAt: new Date().toISOString(),
      },
    ]);
    setSelectedLine(afterLine);
    setEditingNote(id);
  };

  const updateNote = (id, text) => {
    updateNotes((current) => current.map((note) => (note.id === id ? { ...note, text } : note)));
  };

  const finishNote = (id) => {
    updateNotes((current) => current.filter((note) => note.id !== id || String(note.text || "").trim()));
    setEditingNote(null);
  };

  const removeNote = (id) => {
    onCommit();
    updateNotes((current) => current.filter((note) => note.id !== id));
    if (editingNote === id) setEditingNote(null);
  };

  const beginReview = () => {
    const nextSource = sourceDraft.replace(/\r\n?/g, "\n").slice(0, MAX_CONFIG_CHARS);
    if (!nextSource.trim()) {
      flashMessage("Paste or import a running configuration first");
      return;
    }
    const sourceName = sourceNameDraft.trim() || "running-config.txt";
    onCommit();
    onPatch({
      configSource: nextSource,
      configSourceName: sourceName,
      configNotes: [],
      title: `Config review · ${cleanFileName(sourceName, "running-config")}`,
    });
    setSourceMode(false);
    setSelectedLine(null);
    setEditingNote(null);
    flashMessage(source ? "Source replaced; previous comments cleared" : "Source locked for review");
  };

  const importSource = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_CONFIG_CHARS * 2) {
      flashMessage("Configuration file is too large");
      return;
    }
    try {
      const text = (await file.text()).slice(0, MAX_CONFIG_CHARS);
      setSourceDraft(text);
      setSourceNameDraft(file.name || "running-config.txt");
      setSourceMode(true);
    } catch {
      flashMessage("Unable to read that configuration file");
    }
  };

  const exportSource = () => {
    const stem = cleanFileName(node.configSourceName);
    flashMessage(
      downloadTextFile(`${stem}.txt`, "text/plain;charset=utf-8", source)
        ? "Original source downloaded"
        : "Download blocked by browser",
    );
  };

  const exportReview = () => {
    const stem = cleanFileName(node.configSourceName);
    flashMessage(
      downloadTextFile(`${stem}-review.md`, "text/markdown;charset=utf-8", reviewMarkdown(node))
        ? "Review package downloaded"
        : "Download blocked by browser",
    );
  };

  const noteEditor = (note) => (
    <div key={note.id} style={{ display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) 28px", alignItems: "start", gap: 7, padding: "6px 8px", background: "#FFF7D6", borderTop: "1px solid #E7C96B", borderBottom: "1px solid #E7C96B" }}>
      <span style={{ paddingTop: 4, color: "#8A6515", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 9, textAlign: "right" }}>NOTE</span>
      {editingNote === note.id ? (
        <textarea autoFocus aria-label={`Review comment after line ${note.afterLine + 1}`}
          value={note.text}
          onChange={(event) => updateNote(note.id, event.target.value)}
          onBlur={() => finishNote(note.id)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              if (!note.text.trim()) removeNote(note.id);
              else setEditingNote(null);
            }
          }}
          placeholder="Write a review comment…  Ctrl/Cmd+Enter saves"
          style={{ width: "100%", minHeight: 44, boxSizing: "border-box", resize: "vertical", border: "1px solid #D7B84E", borderRadius: 6, background: "#FFFCED", color: "#352B12", padding: "6px 8px", font: "11.5px/1.45 ui-monospace, Menlo, Consolas, monospace", outline: "none" }} />
      ) : (
        <button onClick={() => { onCommit(); setEditingNote(note.id); }}
          style={{ minHeight: 28, border: "none", background: "transparent", color: "#352B12", padding: "3px 0", textAlign: "left", font: "11.5px/1.45 ui-monospace, Menlo, Consolas, monospace", cursor: "text", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {note.text}
          <span style={{ display: "block", color: "#8A6515", font: "9px/1.3 system-ui, sans-serif", marginTop: 3 }}>
            {note.author || "Local reviewer"} · click to edit
          </span>
        </button>
      )}
      <button onClick={() => removeNote(note.id)} aria-label="Delete review comment" title="delete comment"
        style={{ width: 24, height: 24, border: "none", borderRadius: 5, background: "transparent", color: "#A8324E", cursor: "pointer", fontSize: 15 }}>×</button>
    </div>
  );

  return (
    <div ref={laneRef} onMouseDown={onFocus} className="lane-in"
      style={{ position: "absolute", left: node.x, top: node.y, width: node.w, height: node.min ? 48 : node.h, zIndex: node.z,
        transition: animate ? "left .35s cubic-bezier(.22,1,.36,1), top .35s cubic-bezier(.22,1,.36,1), width .3s cubic-bezier(.22,1,.36,1)" : "none",
        display: "flex", flexDirection: "column", borderRadius: 12, background: theme.card,
        borderTop: `1px solid ${isActive ? color : theme.hairline}`,
        borderRight: `1px solid ${isActive ? color : theme.hairline}`,
        borderBottom: `1px solid ${isActive ? color : theme.hairline}`,
        borderLeft: `4px solid ${color}`,
        boxShadow: isActive ? "0 0 0 2px var(--ring), 0 12px 30px var(--shadow)" : "0 4px 14px var(--shadow)",
        overflow: "hidden", ...(selected && !isActive ? { outline: `2px solid ${color}`, outlineOffset: 1 } : {}) }}>

      <div onMouseDown={onDragStart} onDoubleClick={(event) => { event.stopPropagation(); onToggleMin(); }}
        title={node.min ? "double-click to expand" : "double-click to collapse"}
        style={{ padding: "8px 12px", borderBottom: node.min ? "none" : `1px solid ${theme.hairline}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "grab", userSelect: "none", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span aria-hidden="true" style={{ color, fontSize: 14 }}>▤</span>
          <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color, fontWeight: 700 }}>Config review</span>
          <span style={{ color: theme.muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.configSourceName || "new review"}</span>
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onMouseDown={(event) => event.stopPropagation()} onClick={onToggleMin} title={node.min ? "expand" : "minimize"}
            style={{ width: 20, height: 20, border: "none", background: "transparent", color: theme.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, borderRadius: 4 }}>{node.min ? "□" : "–"}</button>
          <button onMouseDown={(event) => event.stopPropagation()} onClick={onDelete} title="close this review; stays in the sidebar"
            style={{ width: 20, height: 20, border: "none", background: "transparent", color: "#A8324E", cursor: "pointer", fontSize: 15, lineHeight: 1, borderRadius: 4 }}>×</button>
        </div>
      </div>

      <div style={{ display: node.min ? "none" : "flex", flex: 1, minHeight: 0, flexDirection: "column", background: theme.card }}>
        <div onMouseDown={(event) => event.stopPropagation()}
          style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "7px 8px", background: theme.cardAlt, borderBottom: `1px solid ${theme.hairline}`, flexShrink: 0 }}>
          {!sourceMode && (
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="find in configuration…"
              aria-label="Find in configuration"
              style={{ flex: "1 1 170px", minWidth: 130, height: 29, boxSizing: "border-box", border: `1px solid ${theme.hairline}`, borderRadius: 6, background: theme.card, color: theme.ink, padding: "0 8px", fontSize: 11.5 }} />
          )}
          <input ref={fileRef} type="file" accept=".txt,.cfg,.conf,.config,text/plain" onChange={importSource} style={{ display: "none" }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ height: 29, border: `1px solid ${theme.hairline}`, borderRadius: 6, background: theme.card, color: theme.ink, padding: "0 8px", fontSize: 11, cursor: "pointer" }}>Import</button>
          {!sourceMode && (
            <>
              <button onClick={() => { setSourceDraft(source); setSourceNameDraft(node.configSourceName || "running-config.txt"); setSourceMode(true); }}
                style={{ height: 29, border: `1px solid ${theme.hairline}`, borderRadius: 6, background: theme.card, color: theme.ink, padding: "0 8px", fontSize: 11, cursor: "pointer" }}>Replace source</button>
              <button onClick={exportSource}
                style={{ height: 29, border: `1px solid ${theme.hairline}`, borderRadius: 6, background: theme.card, color: theme.ink, padding: "0 8px", fontSize: 11, cursor: "pointer" }}>Original</button>
              <button onClick={exportReview}
                style={{ height: 29, border: "none", borderRadius: 6, background: color, color: "#fff", padding: "0 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Export review</button>
              <button onClick={() => setShareOpen(true)}
                style={{ height: 29, border: `1px solid ${theme.hairline}`, borderRadius: 6, background: theme.card, color: theme.ink, padding: "0 8px", fontSize: 11, cursor: "pointer" }}>Share</button>
            </>
          )}
        </div>

        {sourceMode ? (
          <div onMouseDown={(event) => event.stopPropagation()} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 9, padding: 12, background: "#0B1118" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={sourceNameDraft} onChange={(event) => setSourceNameDraft(event.target.value)}
                aria-label="Configuration source name" placeholder="running-config.txt"
                style={{ flex: 1, height: 30, boxSizing: "border-box", border: "1px solid #334155", borderRadius: 6, background: "#111A24", color: "#D6DEEB", padding: "0 9px", font: "11.5px ui-monospace, Menlo, Consolas, monospace" }} />
              {source && (
                <button onClick={() => setSourceMode(false)}
                  style={{ height: 30, border: "1px solid #334155", borderRadius: 6, background: "#111A24", color: "#CBD5E1", padding: "0 10px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
              )}
              <button onClick={beginReview}
                style={{ height: 30, border: "none", borderRadius: 6, background: color, color: "#fff", padding: "0 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{source ? "Replace and review" : "Start review"}</button>
            </div>
            {source && notes.length > 0 && (
              <div style={{ color: "#F5C06A", fontSize: 10.5 }}>Replacing the immutable source clears {notes.length} existing review comment{notes.length === 1 ? "" : "s"}.</div>
            )}
            <textarea autoFocus value={sourceDraft} onChange={(event) => setSourceDraft(event.target.value.slice(0, MAX_CONFIG_CHARS))}
              aria-label="Running configuration source"
              placeholder={"Paste an existing running configuration here.\n\nThe source will be locked when review begins; comments remain separate from device commands."}
              spellCheck={false}
              style={{ flex: 1, minHeight: 0, resize: "none", border: "1px solid #334155", borderRadius: 7, background: "#090E14", color: "#D6DEEB", padding: "10px 12px", font: "12px/1.48 ui-monospace, Menlo, Consolas, monospace", outline: "none", tabSize: 2 }} />
          </div>
        ) : (
          <>
            <div style={{ padding: "4px 9px", display: "flex", alignItems: "center", gap: 7, background: "#0D141D", borderBottom: "1px solid #1F2937", color: "#94A3B8", fontSize: 10.5, flexShrink: 0 }}>
              <span style={{ color: "#7FDBCA", fontWeight: 700 }}>LOCAL DRAFT</span>
              <span>{lines.length} lines · {notes.length} comment{notes.length === 1 ? "" : "s"}</span>
              {normalizedQuery && <span>· {matchingLines} match{matchingLines === 1 ? "" : "es"}</span>}
              <span style={{ marginLeft: "auto", color: "#64748B" }}>select a line and press Enter to comment below it</span>
            </div>
            <div onMouseDown={(event) => event.stopPropagation()}
              style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#090E14", color: "#D6DEEB", padding: "6px 0 18px" }}>
              <div style={{ display: "flex", alignItems: "center", minHeight: 25, borderBottom: "1px dashed #263548" }}>
                <span style={{ width: 52, color: "#64748B", font: "9px ui-monospace, Menlo, monospace", textAlign: "right", paddingRight: 8 }}>HEADER</span>
                <button onClick={() => addNote(-1)} aria-label="Add comment before line 1"
                  style={{ border: "1px solid #334155", borderRadius: 5, background: "#111A24", color: "#7FDBCA", padding: "2px 7px", fontSize: 10, cursor: "pointer" }}>+ comment before first line</button>
              </div>
              {notes.filter((note) => note.afterLine === -1).map(noteEditor)}
              {lines.map((line, index) => {
                const lineNotes = notes.filter((note) => note.afterLine === index);
                const match = normalizedQuery && line.toLowerCase().includes(normalizedQuery);
                const active = selectedLine === index;
                return (
                  <React.Fragment key={index}>
                    <div tabIndex={0} role="group" aria-label={`Configuration line ${index + 1}: ${line || "blank line"}`}
                      onClick={() => setSelectedLine(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addNote(index);
                        }
                      }}
                      style={{ display: "grid", gridTemplateColumns: "52px minmax(0, 1fr) 31px", minHeight: 22, alignItems: "start", background: active ? "#173047" : match ? "#4B3E1838" : "transparent", outline: active ? "1px solid #2F6FB0" : "none", outlineOffset: -1 }}>
                      <span style={{ color: active ? "#7FDBCA" : "#526275", font: "10px/22px ui-monospace, Menlo, monospace", textAlign: "right", paddingRight: 8, userSelect: "none" }}>{index + 1}</span>
                      <code style={{ display: "block", minHeight: 22, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: match ? "#F5C06A" : "#D6DEEB", font: "11.5px/22px ui-monospace, Menlo, Consolas, monospace" }}>{line || " "}</code>
                      <button onClick={(event) => { event.stopPropagation(); addNote(index); }}
                        aria-label={`Add comment after line ${index + 1}`} title="add review comment below this line"
                        style={{ width: 24, height: 20, marginTop: 1, border: "none", borderRadius: 4, background: active ? "#0E7C7B" : "transparent", color: active ? "#fff" : "#64748B", cursor: "pointer", fontSize: 13 }}>+</button>
                    </div>
                    {lineNotes.map(noteEditor)}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        )}

        <div onMouseDown={onResizeStart} onDoubleClick={onAutoFit} title="drag to resize · double-click to reset review size"
          style={{ position: "absolute", right: 0, bottom: 0, width: 18, height: 18, cursor: "nwse-resize", background: `linear-gradient(135deg, transparent 50%, ${color} 50%)`, borderBottomRightRadius: 10, opacity: 0.75 }} />
      </div>

      {shareOpen && createPortal(
        <div onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 680, display: "grid", placeItems: "center", padding: 20, background: "rgba(3,7,12,0.7)", ...portalTheme }}>
          <div role="dialog" aria-modal="true" aria-label="Configuration review sharing"
            onMouseDown={(event) => event.stopPropagation()}
            style={{ width: "min(480px, 96vw)", background: theme.card, color: theme.ink, border: `1px solid ${theme.hairline}`, borderRadius: 12, boxShadow: "0 22px 60px rgba(0,0,0,0.45)", padding: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 7 }}>Company synchronization requires RBAC</div>
            <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.55 }}>
              This NetClaw Visual server does not currently authenticate individual web users, so it cannot safely decide who may read or edit a company review. N2N grants apply to agent peers, not human reviewers. This draft therefore remains local to this Canvas session.
            </div>
            <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 7, background: theme.cardAlt, border: `1px solid ${theme.hairline}`, fontSize: 11.5, lineHeight: 1.5 }}>
              Immediate sharing path: export the review package and place it in a company Git repository whose existing team permissions and review history provide access control and auditability.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 15 }}>
              <button onClick={() => setShareOpen(false)}
                style={{ height: 32, border: `1px solid ${theme.hairline}`, borderRadius: 7, background: theme.card, color: theme.ink, padding: "0 12px", fontSize: 11.5, cursor: "pointer" }}>Close</button>
              <button onClick={() => { exportReview(); setShareOpen(false); }}
                style={{ height: 32, border: "none", borderRadius: 7, background: color, color: "#fff", padding: "0 13px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Export review package</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {flash && createPortal(
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 700, background: "#1B2A4A", color: "#fff", fontSize: 12, padding: "8px 14px", borderRadius: 8, boxShadow: "0 8px 22px rgba(0,0,0,0.32)", ...portalTheme }}>{flash}</div>,
        document.body,
      )}
    </div>
  );
}
