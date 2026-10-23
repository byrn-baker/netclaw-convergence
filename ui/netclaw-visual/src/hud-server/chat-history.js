import { cookieFrom, displayBorderText } from './bindings.js';
import { gatewayAgentId } from './gateway-agent.js';
import { gatewayCall } from './chat-runtime.js';
import { publicChatModels } from './chat-models.js';
export function visibleChatMessages(messages) {
  return (Array.isArray(messages) ? messages : []).flatMap(message => {
    if (!['user', 'assistant'].includes(message?.role)) return [];
    const content = typeof message.content === 'string' ? message.content : Array.isArray(message.content)
      ? message.content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n') : '';
    return content.trim() ? [{ role: message.role, content: displayBorderText(content) }] : [];
  });
}
export function mountChatHistory(app, { bindings, config: readConfig, configPath, runtime, call = gatewayCall }) {
  let readers = 0;
  const context = req => {
    const config = readConfig(), agentId = gatewayAgentId(config), cookie = cookieFrom(req);
    bindings.read(cookie);
    return { config, agentId, cookie, port: config.gateway?.port || 18789 };
  };
  app.get('/api/chat/conversations', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let ctx;
    try { ctx = context(req); } catch { return res.status(401).json({ error: 'Private chat session unavailable.' }); }
    if (readers >= 4) return res.status(429).json({ error: 'History reader busy. Try again shortly.' });
    readers++;
    try {
      const tasks = bindings.chats(ctx.cookie, ctx.agentId);
      let rows = [], sourceAvailable = true;
      if (tasks.length) {
        try { rows = (await call('sessions.list', { agentId: ctx.agentId, limit: 500, includeDerivedTitles: true }, ctx.port, configPath)).sessions || []; }
        catch { sourceAvailable = false; }
      }
      const allowed = new Set(bindings.chats(ctx.cookie, ctx.agentId).map(t => t.id));
      const conversations = tasks.filter(t => allowed.has(t.id)).map(task => {
        const row = rows.find(r => r.key === task.gatewayKey);
        return { id: task.id, thread: task.publicThread || task.resumeThread || null,
          title: String(task.title || row?.derivedTitle || row?.displayName || 'Previous chat').slice(0, 100),
          updatedAt: row?.updatedAt || task.updatedAt || task.createdAt || null,
          active: row?.hasActiveRun === true };
      }).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      res.json({ conversations, sourceAvailable });
    } catch { res.status(503).json({ error: 'Previous chats are unavailable.' }); }
    finally { readers--; }
  });
  app.post('/api/chat/conversations/:id/open', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let ctx, task;
    try { ctx = context(req); task = bindings.ownedChat(ctx.cookie, req.params.id, ctx.agentId); }
    catch { return res.status(404).json({ error: 'Saved chat unavailable.' }); }
    if (readers >= 4) return res.status(429).json({ error: 'History reader busy. Try again shortly.' });
    readers++;
    try {
      const history = await call('chat.history', { sessionKey: task.gatewayKey, agentId: ctx.agentId, limit: 1000, maxChars: 500000 }, ctx.port, configPath);
      if (!Array.isArray(history.messages)) throw Error('Invalid history');
      const catalog = publicChatModels(ctx.config, await runtime.catalog(ctx.config, configPath));
      bindings.ownedChat(ctx.cookie, task.id, ctx.agentId); // Expiry/revocation recheck after I/O.
      const resumed = bindings.resumeChat(ctx.cookie, task.id, ctx.agentId);
      const info = history.sessionInfo || {};
      const model = catalog.models.find(m => m.label === `${info.modelProvider}/${info.model}`);
      res.json({ id: task.id, thread: resumed.publicThread, messages: visibleChatMessages(history.messages),
        chatModel: task.chatModel ?? model?.id ?? '', chatEffort: task.chatEffort ?? info.thinkingLevel ?? '',
        active: info.hasActiveRun === true, truncated: history.hasMore === true });
    } catch { res.status(503).json({ error: 'The saved transcript could not be loaded. Your current chat has been kept.' }); }
    finally { readers--; }
  });
}
