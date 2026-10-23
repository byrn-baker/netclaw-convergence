import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const nonnegative = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
const short = s => typeof s === 'string' ? s.slice(0, 80) : '';
const baseModel = s => typeof s === 'string' ? s.split('@')[0].split('/').at(-1) : '';

export function projectContext(snapshot, key, selectedModel) {
  const row = key && snapshot?.sessions?.find(row => row.key === key);
  if (!row) return { available: false, reason: 'No context report for this chat yet.' };
  if (selectedModel && (baseModel(row.model) !== baseModel(selectedModel) ||
      (row.modelProvider && row.modelProvider !== selectedModel.split('/')[0]))) {
    return { available: false, reason: 'Context will update after the selected model runs.' };
  }
  const used = row.totalTokensFresh === true ? nonnegative(row.totalTokens) : null;
  const capacity = nonnegative(row.contextTokens);
  return { available: used !== null && capacity > 0, used, capacity,
    percentUsed: used !== null && capacity > 0 ? used / capacity * 100 : null,
    updatedAt: nonnegative(row.updatedAt),
    reason: used === null ? 'The gateway has no fresh context count.' : capacity > 0 ? null : 'Context capacity not reported.',
    model: short(row.model).split('@')[0] };
}
export function projectQuota(snapshot, provider) {
  const usage = snapshot?.usage;
  const entry = usage?.providers?.find(item => item.provider === provider);
  const windows = (entry?.windows || []).flatMap(window => {
    const used = nonnegative(window.usedPercent);
    return used !== null && used <= 100 ? [{
      label: short(window.label), usedPercent: used, remainingPercent: 100 - used,
      resetAt: nonnegative(window.resetAt),
    }] : [];
  });
  return { available: windows.length > 0, provider: short(provider), windows,
    updatedAt: nonnegative(usage?.updatedAt),
    reason: windows.length ? null : 'This provider has not reported account quota data.' };
}
export function createUsageReader(run = async args => {
  const { stdout } = await execute('openclaw', args, { timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  return JSON.parse(stdout.slice(stdout.indexOf('{')));
}, now = Date.now) {
  const cache = new Map();
  async function read(key, args, ttl) {
    let item = cache.get(key);
    if (item?.pending) return item.pending;
    if (item && now() - item.checked < ttl) return item;
    item ||= { data: null, checked: 0 };
    const pending = (async () => {
      try { item.data = await run(args); item.stale = false; }
      catch { item.stale = true; }
      finally { item.checked = now(); delete item.pending; }
      return item;
    })();
    item.pending = pending;
    cache.set(key, item);
    return pending;
  }
  return async ({ agentId, key, selectedModel }) => {
    const provider = typeof selectedModel === 'string' ? selectedModel.split('/')[0] : '';
    const [quota, session] = await Promise.all([
      read('quota:' + agentId, ['status', '--usage', '--agent', agentId, '--json', '--timeout', '10000'], 300000),
      key ? read('sessions:' + agentId, ['sessions', '--agent', agentId, '--json', '--limit', '100'], 15000) : null,
    ]);
    return {
      context: { ...projectContext(session?.data, key, selectedModel), stale: session?.stale === true },
      quota: { ...projectQuota(quota.data, provider), stale: quota.stale === true },
      checkedAt: now(),
    };
  };
}
