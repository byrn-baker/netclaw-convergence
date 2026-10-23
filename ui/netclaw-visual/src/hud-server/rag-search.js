// Retrieval only: the HTTP client cannot select a tool or supply arbitrary filters.
export function ragSearchHandler(callTool) {
  let active = 0;
  return async (req, res) => {
    const { query, collection = 'documents', k = 5 } = req.body || {};
    if (typeof query !== 'string' || !query.trim() || query.length > 4000 ||
        typeof collection !== 'string' || !/^[\w.-]{1,128}$/.test(collection) ||
        !Number.isInteger(k) || k < 1 || k > 20) return res.status(400).json({ error: 'Provide a query (1–4000 characters), collection and 1–20 results.' });
    if (active >= 2) return res.status(429).json({ error: 'Retrieval busy. Try again shortly.' });
    active++;
    res.setHeader('Cache-Control', 'no-store');
    try {
      const result = await callTool('rag_search', { query: query.trim(), collection, k }, 120);
      if (!result.success) return res.status(503).json({ error: 'RAG retrieval unavailable. Check the local RAG service.' });
      return res.json(result.data);
    } catch { return res.status(503).json({ error: 'RAG retrieval unavailable. Check the local RAG service.' }); }
    finally { active--; }
  };
}
