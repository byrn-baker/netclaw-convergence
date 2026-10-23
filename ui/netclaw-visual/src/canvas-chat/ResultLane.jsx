import React, { useMemo, useState } from "react";
import { ARTIFACT_FORMATS, validateArtifactContent } from "./artifact-formats.js";

const COLLAPSED_H = 48;

function readableBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function saveArtifact(node) {
  try {
    const blob = new Blob([node.artifactContent || ""], {
      type: `${node.artifactMime || "text/plain"};charset=utf-8`,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = node.artifactName || "result.txt";
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

export default function ResultLane({
  node,
  color,
  isActive,
  selected,
  animate,
  theme: C,
  laneRef,
  onFocus,
  onDragStart,
  onResizeStart,
  onToggleMin,
  onDelete,
  onAutoFit,
  onConvert,
  onBranch,
}) {
  const [convertFormat, setConvertFormat] = useState(node.artifactFormat || "json");
  const [notice, setNotice] = useState("");
  const validation = useMemo(
    () => validateArtifactContent(node.artifactContent, node.artifactFormat),
    [node.artifactContent, node.artifactFormat],
  );
  const validationOk = validation.status === "valid";
  const structureLabel = node.artifactStructure === "hierarchical"
    ? "Hierarchy"
    : node.artifactStructure === "flat"
      ? "Flat"
      : "Structured";

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  };

  const copy = async () => {
    if (!validationOk) {
      flash("Copy blocked: invalid result");
      return;
    }
    try {
      await navigator.clipboard.writeText(node.artifactContent || "");
      flash("Copied");
    } catch {
      flash("Copy blocked");
    }
  };

  return (
    <div ref={laneRef} data-node-kind="result" data-node-id={node.id} onMouseDown={onFocus} className="lane-in"
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.min ? COLLAPSED_H : node.h,
        zIndex: node.z,
        transition: animate ? "left .35s cubic-bezier(.22,1,.36,1), top .35s cubic-bezier(.22,1,.36,1), width .3s cubic-bezier(.22,1,.36,1)" : "none",
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        background: C.card,
        borderTop: `1px solid ${isActive ? color : C.hairline}`,
        borderRight: `1px solid ${isActive ? color : C.hairline}`,
        borderBottom: `1px solid ${isActive ? color : C.hairline}`,
        borderLeft: `4px solid ${color}`,
        boxShadow: isActive ? `0 0 0 2px ${color}22, 0 14px 34px var(--shadow)` : "0 4px 14px var(--shadow)",
        overflow: "hidden",
        ...(selected && !isActive ? { outline: `2px solid ${color}`, outlineOffset: 1 } : {}),
      }}>
      <div onMouseDown={onDragStart} onDoubleClick={(event) => { event.stopPropagation(); onToggleMin(); }}
        title={node.min ? "double-click to expand" : "double-click to collapse"}
        style={{ padding: "9px 12px", borderBottom: node.min ? "none" : `1px solid ${C.hairline}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "grab", userSelect: "none", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span aria-hidden="true" style={{ color, fontSize: 14 }}>▤</span>
          <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color, fontWeight: 800 }}>Result</span>
          <span style={{ color: C.ink, fontSize: 12.5, fontWeight: 750 }}>·</span>
          <span style={{ color: C.ink, fontSize: 12.5, fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.artifactName || "result"}</span>
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onMouseDown={(event) => event.stopPropagation()} onClick={onToggleMin} title={node.min ? "expand" : "minimize"}
            style={{ width: 22, height: 22, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, borderRadius: 4 }}>{node.min ? "▣" : "–"}</button>
          <button onMouseDown={(event) => event.stopPropagation()} onClick={onDelete} title="close this result; it remains in the Results rail"
            style={{ width: 22, height: 22, border: "none", background: "transparent", color: "#A8324E", cursor: "pointer", fontSize: 15, lineHeight: 1, borderRadius: 4 }}>×</button>
        </div>
      </div>

      {!node.min && (
        <>
          <div onMouseDown={(event) => event.stopPropagation()}
            style={{ padding: "8px 10px", borderBottom: `1px solid ${C.hairline}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", background: C.cardAlt, flexShrink: 0 }}>
            {[
              node.artifactLabel || String(node.artifactFormat || "file").toUpperCase(),
              `${node.artifactRecords || 0} records`,
              validationOk ? `✓ ${validation.label || "Validated"}` : "⚠ Invalid",
              structureLabel,
              ...(node.artifactParser ? [`${node.artifactParser} · ${node.artifactCommand || 'parsed output'}`] : []),
              `v${node.artifactVersion || 1}`,
              readableBytes(node.artifactBytes),
            ].map((label, index) => (
              <span key={`${label}-${index}`}
                style={{ height: 25, display: "inline-flex", alignItems: "center", border: `1px solid ${index === 2 ? (validationOk ? "#0E7C7B55" : "#A8324E55") : C.hairline}`, borderRadius: 6, background: C.card, color: index === 2 ? (validationOk ? "#0E7C7B" : "#A8324E") : C.ink, padding: "0 8px", fontSize: 10.5, fontWeight: index === 0 || index === 2 ? 700 : 500 }}>
                {label}
              </span>
            ))}
          </div>

          <div onMouseDown={(event) => event.stopPropagation()}
            style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${C.hairline}`, flexShrink: 0 }}>
            <button onClick={() => flash("Already open")} title="this result is already open in the canvas"
              style={{ height: 29, border: `1px solid ${C.hairline}`, borderRadius: 6, background: C.card, color: C.ink, padding: "0 9px", fontSize: 11, cursor: "pointer" }}>↗ Open</button>
            <button onClick={copy} disabled={!validationOk}
              title={validationOk ? "copy validated result" : "copy blocked because validation failed"}
              style={{ height: 29, border: `1px solid ${C.hairline}`, borderRadius: 6, background: C.card, color: C.ink, padding: "0 9px", fontSize: 11, cursor: validationOk ? "pointer" : "default", opacity: validationOk ? 1 : 0.45 }}>Copy</button>
            <button onClick={() => flash(saveArtifact(node) ? "Download started" : "Download blocked")} disabled={!validationOk}
              title={validationOk ? "download validated result" : "download blocked because validation failed"}
              style={{ height: 29, border: "none", borderRadius: 6, background: color, color: "#fff", padding: "0 11px", fontSize: 11, fontWeight: 750, cursor: validationOk ? "pointer" : "default", opacity: validationOk ? 1 : 0.45 }}>↓ Download</button>
            <select aria-label={`Convert ${node.artifactName || "result"} to format`} value={convertFormat} onChange={(event) => setConvertFormat(event.target.value)}
              style={{ height: 29, border: `1px solid ${C.hairline}`, borderRadius: 6, background: C.card, color: C.ink, padding: "0 7px", fontSize: 10.5 }}>
              {ARTIFACT_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
            </select>
            <button onClick={() => onConvert(convertFormat)}
              style={{ height: 29, border: `1px solid ${C.hairline}`, borderRadius: 6, background: C.card, color: C.ink, padding: "0 9px", fontSize: 11, cursor: "pointer" }}>Convert</button>
            <button onClick={onBranch} disabled={!validationOk}
              title={validationOk ? "branch with the validated artifact as context" : "branch blocked because validation failed"}
              style={{ height: 29, border: `1px solid ${C.hairline}`, borderRadius: 6, background: C.card, color: C.ink, padding: "0 9px", fontSize: 11, cursor: validationOk ? "pointer" : "default", opacity: validationOk ? 1 : 0.45 }}>⎇ Branch</button>
            {notice && <span role="status" style={{ fontSize: 10.5, color, fontWeight: 650 }}>{notice}</span>}
          </div>

          {validationOk ? (
            <div onMouseDown={(event) => event.stopPropagation()}
              style={{ flex: 1, minHeight: 0, overflow: "auto", background: C.codeBg, padding: "11px 13px" }}>
              <pre aria-label={`Validated ${node.artifactLabel || node.artifactFormat || "artifact"} result`}
                style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", tabSize: 2, color: "var(--codeText)", fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace', fontSize: 12, lineHeight: 1.55 }}>
                {node.artifactContent || ""}
              </pre>
            </div>
          ) : (
            <div role="alert" onMouseDown={(event) => event.stopPropagation()}
              style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", background: C.codeBg, padding: 24, color: "#A8324E", textAlign: "center", fontSize: 12, lineHeight: 1.55 }}>
              Result content withheld because validation failed: {validation.message || "invalid structured output"}
            </div>
          )}

          <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, borderTop: `1px solid ${C.hairline}`, color: C.muted, fontSize: 10.5, flexShrink: 0 }}>
            <span aria-hidden="true">⌘</span>
            <span>From {node.artifactSourceLabel || "Canvas"}</span>
            <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, Menlo, monospace" }}>
              {node.artifactCreatedAt ? new Date(node.artifactCreatedAt).toLocaleString() : ""}
            </span>
          </div>

          <div onMouseDown={onResizeStart} onDoubleClick={onAutoFit} title="drag to resize · double-click to reset result size"
            style={{ position: "absolute", right: 0, bottom: 0, width: 18, height: 18, cursor: "nwse-resize", background: `linear-gradient(135deg, transparent 50%, ${color} 50%)`, borderBottomRightRadius: 10, opacity: 0.75 }} />
        </>
      )}
    </div>
  );
}
