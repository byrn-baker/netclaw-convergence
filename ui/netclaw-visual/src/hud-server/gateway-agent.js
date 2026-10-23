export function gatewayAgentId(config, override = process.env.HUD_AGENT_ID) {
  const entries = config?.agents?.entries;
  const legacy = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  const ids = entries && Object.keys(entries).length ? Object.keys(entries) : legacy.map(a => a.id);
  const id = override || legacy.find(a => a.default)?.id
    || (ids.length === 1 ? ids[0] : ids.includes('main') || !ids.length ? 'main' : null);
  if (!id || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id) || (ids.length && !ids.includes(id))) {
    throw Error('Set HUD_AGENT_ID to a configured OpenClaw agent ID');
  }
  return id;
}
