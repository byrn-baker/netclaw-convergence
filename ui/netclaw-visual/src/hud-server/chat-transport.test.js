import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chatTimeouts, postGatewayChat } from './chat-transport.js';

test('proxy deadline leaves time to deliver API timeout errors', () => {
  assert.deepEqual(chatTimeouts({}), { gateway: 900000, proxy: 930000 });
  assert.deepEqual(chatTimeouts({ HUD_CHAT_TIMEOUT_MS: '1000' }), { gateway: 1000, proxy: 31000 });
  for (const value of ['0', 'abc', '999', '3600001']) {
    assert.throws(() => chatTimeouts({ HUD_CHAT_TIMEOUT_MS: value }));
  }
});
test('delayed gateway reply succeeds and a stalled reply has an explicit timeout', async t => {
  const server = http.createServer((req, res) => {
    if (req.url === '/stall') return;
    setTimeout(() => { res.setHeader('content-type', 'application/json'); res.end('{"reply":"OK"}'); }, 100);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = 'http://127.0.0.1:' + server.address().port;
  const options = { headers: { 'Content-Type': 'application/json' }, body: '{}', timeoutMs: 2000 };
  const reply = await postGatewayChat(url, options);
  assert.equal(reply.ok, true);
  assert.deepEqual(await reply.json(), { reply: 'OK' });
  await assert.rejects(postGatewayChat(url + '/stall', { ...options, timeoutMs: 30 }), { name: 'TimeoutError' });
});
