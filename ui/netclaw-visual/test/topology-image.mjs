import assert from 'node:assert/strict';
import { topologyImageKey, validateTopologyImage, MAX_TOPOLOGY_IMAGE_BYTES, readTopologyImage, saveTopologyImage, removeTopologyImage } from '../src/canvas-chat/topology-image-store.js';
const key = topologyImageKey({ deviceId: 'R1', type: 'prefix', value: '192.0.2.0/24', vrf: 'CORP' });
for (const change of [{ deviceId: 'R2' }, { vrf: 'GUEST' }, { value: '198.51.100.0/24' }, { vrf: null }]) {
  assert.notEqual(key, topologyImageKey({ deviceId: 'R1', type: 'prefix', value: '192.0.2.0/24', vrf: 'CORP', ...change }));
}
const png = new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])], 'test.png', { type: 'image/png' });
await validateTopologyImage(png);
await validateTopologyImage(new File([new Uint8Array([255,216,255,0])], 'test.jpg', { type: 'image/jpeg' }));
await validateTopologyImage(new File(['RIFF0000WEBP'], 'test.webp', { type: 'image/webp' }));
await assert.rejects(validateTopologyImage(new File(['<svg/>'], 'test.svg', { type: 'image/svg+xml' })), /valid PNG/);
await assert.rejects(validateTopologyImage(new File(['wrong data'], 'test.png', { type: 'image/png' })), /valid PNG/);
await assert.rejects(validateTopologyImage(new File([], 'empty.png', { type: 'image/png' })), /5 MB/);
await assert.rejects(validateTopologyImage({ size: MAX_TOPOLOGY_IMAGE_BYTES + 1 }), /5 MB/);
// Exercise the store contract without writing to the user's browser or filesystem.
const records = new Map(); let closed = 0; let abort = false;
globalThis.indexedDB = { open() {
  const request = { result: {
    close() { closed++; },
    transaction() {
      const tx = { objectStore() { return {
        get(k) { return { result: records.get(k) }; },
        put(v,k) { if (!abort) records.set(k,v); return {}; },
        delete(k) { records.delete(k); return {}; },
      }; } };
      queueMicrotask(() => abort ? tx.onabort() : tx.oncomplete());
      return tx;
    },
  } };
  queueMicrotask(() => request.onsuccess()); return request;
} };
await saveTopologyImage(key, { file: png, name: png.name });
assert.equal((await readTopologyImage(key)).name, 'test.png');
assert.equal(await readTopologyImage('other context'), undefined);
abort = true;
await assert.rejects(saveTopologyImage(key, { name: 'replacement.png' }), /storage/);
abort = false;
assert.equal((await readTopologyImage(key)).name, 'test.png', 'failed replacement preserves original');
await removeTopologyImage(key);
assert.equal(await readTopologyImage(key), undefined);
assert.equal(closed, 7);
console.log('Topology image validation, context isolation, storage lifecycle and failed replacement checks passed.');
