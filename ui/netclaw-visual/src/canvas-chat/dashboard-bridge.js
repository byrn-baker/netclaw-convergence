// A same-origin parent may prepare context, never send it or change sessions.
export function installDashboardBridge({ window: win, accept, assessment }) {
  const handler = event => {
    if (event.origin !== win.location.origin || event.source !== win.parent || win.parent === win) return;
    if (event.data?.type === 'netclaw:ready-query') win.parent.postMessage({ type: 'netclaw:canvas-ready' }, win.location.origin);
    if (event.data?.type !== 'netclaw:context') return;
    const content = event.data.content;
    if (typeof content !== 'string' || content.length > 16000 || !content.trim()) return;
    try { accept(content); win.parent.postMessage({ type: 'netclaw:context-accepted' }, win.location.origin); }
    catch { win.parent.postMessage({ type: 'netclaw:context-rejected' }, win.location.origin); }
  };
  win.addEventListener('message', handler);
  if (win.parent !== win) win.parent.postMessage({ type: 'netclaw:canvas-ready' }, win.location.origin);
  return () => win.removeEventListener('message', handler);
}
