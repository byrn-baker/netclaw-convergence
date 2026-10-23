import { gatewayAgentId } from './gateway-agent.js';
import fs from 'node:fs';
import path from 'node:path';
import { readBounded } from './bindings.js';
const number = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
const label = s => typeof s === 'string' && /^[a-zA-Z0-9_.:/@+-]{1,200}$/.test(s) ? s : 'Not recorded';
export function aggregateUsage(lines) {
  const groups = new Map(), seen = new Set(); let records = 0, missingUsage = 0, malformed = 0;
  for (const { line, source } of lines) {
    let e; try { e = JSON.parse(line); } catch { malformed++; continue; }
    const m = e.message; if (e.type !== 'message' || m?.role !== 'assistant') continue;
    const id = e.id && `${source}:${e.id}`; if (id && seen.has(id)) continue; if (id) seen.add(id);
    if (!m.usage || typeof m.usage !== 'object') { missingUsage++; continue; }
    const model = label(m.model), provider = label(m.provider), key = `${provider}|${model}`;
    if (!groups.has(key)) groups.set(key, { model, provider, calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, costRecords: 0, incompleteTokenRecords: 0 });
    const g = groups.get(key); g.calls++; records++;
    let incomplete = false;
    for (const k of ['input','output','cacheRead','cacheWrite']) { const n = number(m.usage[k]); if (n === null) incomplete = true; else g[k] += n; }
    if (incomplete) g.incompleteTokenRecords++;
    const cost = number(m.usage.cost?.total); if (cost !== null) { g.costUsd += cost; g.costRecords++; }
  }
  return { groups: [...groups.values()].map(g => ({ ...g, costUsd: g.costRecords ? g.costUsd : null })), records, missingUsage, malformed };
}
export function readUsage(directory) {
  let skippedFiles = 0, bytes = 0; const lines = [];
  try {
    const candidates = fs.readdirSync(directory).filter(n => /^[a-zA-Z0-9_.-]+\.jsonl$/.test(n)).map(name => {
      const stat = fs.lstatSync(path.join(directory,name)); return { name, stat };
    }).filter(x => x.stat.isFile() && !x.stat.isSymbolicLink()).sort((a,b) => b.stat.mtimeMs-a.stat.mtimeMs);
    for (const { name, stat } of candidates.slice(0,200)) {
      if (stat.size > 2 * 1024 * 1024 || bytes + stat.size > 32 * 1024 * 1024) { skippedFiles++; continue; }
      try { const content = readBounded(path.join(directory,name),2*1024*1024); bytes += stat.size; for (const line of content.split('\n').filter(Boolean)) lines.push({ line, source: name }); } catch { skippedFiles++; }
    }
    return { available: true, ...aggregateUsage(lines), skippedFiles: skippedFiles + Math.max(0,candidates.length-200),
      scope: 'Recorded usage in up to 200 most recently modified local main-agent transcript files, across retained dates. Maximum 2 MiB/file and 32 MiB total. No remote member usage implied.', generatedAt: new Date().toISOString() };
  } catch { return { available:false, groups:[], error:'Local usage records unavailable', generatedAt:new Date().toISOString() }; }
}
export function runtimeInventory(config) {
  const defaults = config?.agents?.defaults || {};
  const id = gatewayAgentId(config);
  const agent = config?.agents?.entries?.[id] || config?.agents?.list?.find(a => a.id === id);
  const model = agent?.model ?? defaults.model;
  const servers = config?.mcp?.servers ?? config?.mcpServers ?? {};
  return { llm: { primary_model: label(typeof model === 'string' ? model : model?.primary).split('@')[0], fallbacks: (Array.isArray(model?.fallbacks) ? model.fallbacks : []).map(value => label(value).split('@')[0]) },
    source:'Local runtime configuration; not execution telemetry',
    mcp_servers: Object.entries(servers).map(([name,s]) => ({ name:label(name), enabled:s?.enabled !== false, transport:s?.url ? 'HTTP' : 'stdio', tools: (Array.isArray(s?.tools) ? s.tools : []).map(t => label(typeof t === 'string' ? t : t?.name)) })) };
}
