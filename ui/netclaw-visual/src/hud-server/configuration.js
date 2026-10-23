// Project only keys/presence and static catalogue metadata. Never serialize values.
export function configurationInventory(mapping, values, environmentFile) {
  const known = new Set(Object.values(mapping).flatMap(item => item.env));
  const extra = Object.keys(values).filter(key => !known.has(key) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)).sort();
  const catalogue = { ...mapping, ...(extra.length ? { 'other-environment': { env: extra, files: [], notes: 'Additional variables stored in the environment file.' } } : {}) };
  return { environmentFile, integrations: Object.entries(catalogue).map(([id, item]) => ({
    id, notes: item.notes, files: item.files || [],
    fields: item.env.map(key => ({ key, isSet: Boolean(values[key]) })),
  })) };
}
