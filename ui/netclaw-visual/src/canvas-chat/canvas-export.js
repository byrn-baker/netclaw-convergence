// Extracted from NetClaw Canvas; see LICENSE for the adapted workflow.


function clip(s, n) { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }

function nodeTitle(n) {
  if (n.title) return n.title;   // user-set custom thread/window name wins
  if (n.kind === "terminal") return n.terminalDevice ? `Terminal · ${n.terminalDevice}` : "SSH Terminal";
  if (n.kind === "config-review") return n.configSourceName ? `Config review · ${n.configSourceName}` : "Configuration review";
  if (n.kind === "result") return n.artifactName ? `Result · ${n.artifactName}` : "Result";
  if (n.synthFrom && n.synthFrom.length) {
    const u = n.messages.find((m) => m.role === "user" && !m.relate);
    return u && u.content ? clip(u.content, 40) : `Synthesis of ${n.synthFrom.length}`;
  }
  if (n.depth === 0) {
    const u = n.messages.find((m) => m.role === "user" && !m.relate);
    return u && u.content ? clip(u.content, 40) : "New thread";
  }
  return n.sourceQuote || "Branch";
}

const EXPORT_FACETS = [["context", "Context"], ["summary", "Summary"], ["sources", "Authoritative source"], ["action", "Suggested action"]];

function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function mdInlineHtml(text) {
  const codes = [];
  let s = escHtml(text).replace(/`([^`]+?)`/g, (m, a) => { codes.push(a); return "\u0000" + (codes.length - 1) + "\u0000"; });
  s = s.replace(/\*\*([^*]+?)\*\*/g, (m, a) => "<strong>" + a + "</strong>");
  s = s.replace(/\*([^*]+?)\*/g, (m, a) => "<em>" + a + "</em>");
  s = s.replace(/_([^_]+?)_/g, (m, a) => "<em>" + a + "</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => "<code>" + codes[+i] + "</code>");
  return s;
}

function mdBlockHtml(md) {
  const lines = String(md).split(/\n/); const out = []; let list = null, code = null;
  const closeList = () => { if (list) { out.push("</" + list + ">"); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w[\w+.-]*)?\s*$/);
    if (fence) { if (code == null) { closeList(); code = []; } else { out.push("<pre><code>" + code.map(escHtml).join("\n") + "</code></pre>"); code = null; } continue; }
    if (code) { code.push(line); continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { closeList(); out.push("<hr>"); continue; }
    const b = line.match(/^\s*[-*•]\s+(.*)$/), n = line.match(/^\s*\d+[.)]\s+(.*)$/), h = line.match(/^\s*(#{1,3})\s+(.*)$/);
    if (b) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push("<li>" + mdInlineHtml(b[1]) + "</li>"); }
    else if (n) { if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push("<li>" + mdInlineHtml(n[1]) + "</li>"); }
    else if (h) { closeList(); const lvl = Math.min(6, h[1].length + 2); out.push("<h" + lvl + ">" + mdInlineHtml(h[2]) + "</h" + lvl + ">"); }
    else if (line.trim()) { closeList(); out.push("<p>" + mdInlineHtml(line) + "</p>"); }
    else closeList();
  }
  if (code) out.push("<pre><code>" + code.map(escHtml).join("\n") + "</code></pre>");
  closeList();
  return out.join("\n");
}

function branchSections(node) {
  const secs = [];
  (node.messages || []).forEach((m) => {
    if (m.role === "user" && !m.relate) { if ((m.content || "").trim()) secs.push({ kind: "q", label: "You asked", body: m.content }); }
    else if (m.role === "tool") { /* verbose tool output omitted from notes */ }
    else if (m.tabs) { EXPORT_FACETS.forEach(([k, lbl]) => { const body = (m.tabs[k] || "").trim(); if (body) secs.push({ kind: "facet", label: lbl, body }); }); }
    else if (m.relate) { if ((m.content || "").trim()) secs.push({ kind: "relate", label: "Relates back to origin", body: m.content }); }
    else if ((m.content || "").trim()) secs.push({ kind: "a", label: "Answer", body: m.content });
  });
  return secs;
}

function branchToMarkdown(node) {
  const L = ["# " + (nodeTitle(node) || "Untitled branch"), ""];
  if (node.sourceQuote) L.push("> Branched from: “" + node.sourceQuote + "”", "");
  branchSections(node).forEach((s) => { L.push((s.kind === "facet" ? "### " : "## ") + s.label, "", s.body.trim(), ""); });
  L.push("---", "*Exported from NetClaw Canvas*");
  return L.join("\n");
}

function branchToHtmlFragment(node) {
  const P = ["<h1>" + escHtml(nodeTitle(node) || "Untitled branch") + "</h1>"];
  if (node.sourceQuote) P.push("<blockquote><em>Branched from: “" + escHtml(node.sourceQuote) + "”</em></blockquote>");
  branchSections(node).forEach((s) => {
    P.push(s.kind === "facet" ? "<h3>" + escHtml(s.label) + "</h3>" : "<h2>" + escHtml(s.label) + "</h2>");
    P.push(mdBlockHtml(s.body));
  });
  P.push("<hr><p><small>Exported from NetClaw Canvas</small></p>");
  return P.join("\n");
}

function branchToHtmlDoc(node) {
  const title = escHtml(nodeTitle(node) || "Untitled branch");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;max-width:760px;margin:40px auto;padding:0 20px;color:#1a1a1a}h1{font-size:1.6em}h2{margin-top:1.4em;font-size:1.2em}h3{margin-top:1em;font-size:1.02em;color:#444}blockquote{border-left:3px solid #ccc;margin:0 0 1em;padding-left:12px;color:#666}code{background:#f2f2f2;padding:1px 4px;border-radius:4px;font-size:.9em}pre{background:#f6f6f6;padding:10px;border-radius:6px;overflow:auto}pre code{background:none;padding:0}hr{border:none;border-top:1px solid #e5e5e5;margin:24px 0}small{color:#888}</style>
</head><body>
${branchToHtmlFragment(node)}
</body></html>`;
}

async function copyRich(html, text) {
  try {
    if (navigator.clipboard && typeof window !== "undefined" && window.ClipboardItem) {
      await navigator.clipboard.write([new window.ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
      return true;
    }
  } catch {}
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  return false;
}

function downloadTextFile(name, mime, content) {
  try {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener"; a.style.display = "none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch { return false; }
}

function branchFileName(node) {
  const t = (nodeTitle(node) || "branch").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return t || "branch";
}

export { clip, nodeTitle, EXPORT_FACETS, escHtml, mdInlineHtml, mdBlockHtml, branchSections, branchToMarkdown, branchToHtmlFragment, branchToHtmlDoc, copyRich, downloadTextFile, branchFileName };
