import http from 'node:http';

export function chatTimeouts(env = process.env) {
  const value = env.HUD_CHAT_TIMEOUT_MS ?? '900000';
  if (!/^\d+$/.test(value) || Number(value) < 1000 || Number(value) > 3600000) {
    throw Error('HUD_CHAT_TIMEOUT_MS must be between 1000 and 3600000 milliseconds');
  }
  return { gateway: Number(value), proxy: Number(value) + 30000 };
}

// Use an explicit total deadline, independent of fetch's HTTP header deadline.
// Leave the UI proxy enough time to receive a structured timeout response.
export function postGatewayChat(url, { headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let timer;
    const req = http.request(url, { method: 'POST', headers }, res => {
      const chunks = [];
      let length = 0;
      res.on('data', chunk => {
        length += chunk.length;
        if (length > 16 * 1024 * 1024) {
          req.destroy(new Error('Gateway response exceeds size limit'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('error', fail);
      res.on('end', () => {
        clearTimeout(timer);
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode, json: async () => JSON.parse(text) });
      });
    });
    function fail(error) { clearTimeout(timer); reject(error); }
    req.on('error', fail);
    timer = setTimeout(() => {
      const error = new Error('Gateway chat deadline exceeded');
      error.name = 'TimeoutError';
      req.destroy(error);
    }, timeoutMs);
    req.end(body);
  });
}
