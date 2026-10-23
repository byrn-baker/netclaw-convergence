import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import express from 'express';
import { createRagUpload, cleanupRagUpload } from './rag-upload.js';

test('same-name concurrent uploads retain distinct bytes until ingestion completes', async t => {
  const intake = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-upload-test-'));
  const requests = [];
  const app = express();
  const upload = createRagUpload(intake, 1);
  app.post('/', (req, res) => upload(req, res, err => {
    if (err) { cleanupRagUpload(req); return res.status(400).json({ code: err.code }); }
    requests.push(req);
    res.status(202).json({ accepted: true });
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const req of requests) cleanupRagUpload(req);
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(intake, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = async (text, extra = false) => {
    const form = new FormData();
    form.append('file', new Blob([text]), 'guide.md');
    form.append('doc_type', 'vendor');
    form.append('title', 'Guide');
    if (extra) form.append('unexpected', 'field');
    return fetch(url, { method: 'POST', body: form });
  };
  const responses = await Promise.all([send('first document'), send('second document')]);
  assert.deepEqual(responses.map(r => r.status), [202, 202]);
  assert.notEqual(requests[0].file.path, requests[1].file.path);
  assert.deepEqual(requests.map(req => fs.readFileSync(req.file.path, 'utf8')).sort(), ['first document', 'second document']);
  assert.equal(path.basename(requests[0].file.path), 'guide.md');
  cleanupRagUpload(requests[0]);
  cleanupRagUpload(requests[0]); // idempotent; cannot remove another request's input
  assert.ok(fs.existsSync(requests[1].file.path));
  cleanupRagUpload(requests[1]);
  assert.deepEqual(fs.readdirSync(intake), []);
  const oversized = await send('x'.repeat(1024 * 1024 + 1));
  assert.equal(oversized.status, 400);
  assert.equal((await oversized.json()).code, 'LIMIT_FILE_SIZE');
  assert.deepEqual(fs.readdirSync(intake), []);
  const unexpected = await send('body', true);
  assert.equal(unexpected.status, 400);
  assert.deepEqual(fs.readdirSync(intake), []);
});

test('invalid document cap fails instead of disabling upload limits', () => {
  for (const value of [NaN, 0, -1, Infinity, 1.5]) {
    assert.throws(() => createRagUpload('/unused', value), /positive integer/);
  }
});
