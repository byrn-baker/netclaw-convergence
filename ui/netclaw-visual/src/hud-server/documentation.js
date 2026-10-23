import fs from 'node:fs';
import path from 'node:path';
import { readBounded } from './bindings.js';
export function documentContent(root, entries, id) {
  const item = entries.find(d => d.id === id); if (!item) throw Error('Not found');
  const file = path.resolve(root,item.path), real = fs.realpathSync(file);
  if (!real.startsWith(fs.realpathSync(root)+path.sep) || real !== file) throw Error('Not found');
  return { ...item, content: readBounded(file,8*1024*1024) };
}
export function mountDocumentation(app, root) {
  const read = file => JSON.parse(readBounded(path.join(root,'docs/reference',file),8*1024*1024));
  app.get('/api/hud/documentation', (_req,res) => {
    try { res.json({ documents:read('documents.json') }); } catch { res.status(503).json({ error:'Documentation index unavailable; run scripts/build-hud-reference.py' }); }
  });
  app.get('/api/hud/documentation/:id', (req,res) => {
    try { res.json(documentContent(root,read('documents.json'),req.params.id)); } catch { res.status(404).json({ error:'Document unavailable' }); }
  });
  app.get('/api/hud/reference', (_req,res) => {
    try { res.json(read('interfaces.json')); } catch { res.status(503).json({ error:'Interface reference unavailable' }); }
  });
  app.get('/api/hud/openapi.json', (_req,res) => {
    try { res.json(read('hud-openapi.json')); } catch { res.status(503).json({ error:'OpenAPI reference unavailable' }); }
  });
}
