import assert from 'node:assert/strict';
import { changeTopology, resolveTopology, loadDeviceTopology, updateDeviceTopology, subscribeTopologyImages } from '../src/canvas-chat/topology-image-library.js';
let library = { images: {}, devices: {}, networkId: null };
const run = action => { library = changeTopology(library, action); };
const record = { name: 'Synthetic topology.png', points: [{ deviceId: 'R1', x: .2, y: .3 }] };
run({ kind: 'upload', deviceId: 'R1', id: 'one', record });
assert.equal(resolveTopology(library, 'R1').imageId, 'one');
assert.equal(resolveTopology(library, 'R2').record, null);
run({ kind: 'upload', deviceId: 'R3', id: 'three', record: { ...record, name: 'Other topology' } });
run({ kind: 'share', deviceId: 'R1', imageId: 'one', revision: 1, deviceIds: ['R2', 'R3'] });
assert.equal(resolveTopology(library, 'R2').imageId, 'one');
assert.equal(resolveTopology(library, 'R3').imageId, 'three', 'preserve destination override');
run({ kind: 'points', deviceId: 'R2', imageId: 'one', revision: 1, points: [{ deviceId: 'R2', x: .8, y: .9 }] });
assert.equal(resolveTopology(library, 'R1').record.points[0].deviceId, 'R2', 'shared mappings update');
assert.throws(() => run({ kind: 'points', deviceId: 'R1', imageId: 'one', revision: 1, points: [] }), /changed/);
run({ kind: 'share', deviceId: 'R1', imageId: 'one', revision: 2, network: true });
assert.equal(resolveTopology(library, 'new-device').imageId, 'one');
assert.equal(resolveTopology(library, 'new-device').inherited, true);
assert.equal(resolveTopology(library, 'R3').imageId, 'three');
run({ kind: 'detach', deviceId: 'R2' });
assert.equal(resolveTopology(library, 'R2').record, null, 'opt out from network default');
assert.equal(resolveTopology(library, 'R1').imageId, 'one', 'detach does not delete others');
run({ kind: 'inherit', deviceId: 'R2' });
assert.equal(resolveTopology(library, 'R2').imageId, 'one');
run({ kind: 'migrate', deviceId: 'R2', id: 'legacy', record });
assert.equal(resolveTopology(library, 'R2').imageId, 'one', 'legacy cannot undo explicit inherit');
run({ kind: 'upload', deviceId: 'R1', id: 'replacement', record });
assert.equal(resolveTopology(library, 'R2').imageId, 'one', 'replacement is device-only');
run({ kind: 'share', deviceId: 'R1', imageId: 'replacement', revision: 1, deviceIds: ['R3'], replace: true });
assert.equal(resolveTopology(library, 'R3').imageId, 'replacement');
run({ kind: 'stop-network', deviceId: 'R2', imageId: 'one' });
assert.equal(resolveTopology(library, 'new-device').record, null);
assert.equal(resolveTopology(library, 'R1').imageId, 'replacement');
run({ kind: 'migrate', deviceId: 'R4', id: 'migrated', record });
assert.equal(resolveTopology(library, 'R4').imageId, 'migrated');
run({ kind: 'migrate', deviceId: 'R5', id: 'removed', record: { removed: true } });
assert.equal(resolveTopology(library, 'R5').record, null);
assert.equal(Object.getPrototypeOf(library.devices), Object.prototype);
run({ kind: 'upload', deviceId: '__proto__', id: 'safe', record });
assert.equal(resolveTopology(library, '__proto__').imageId, 'safe');
assert.equal(Object.getPrototypeOf(library.devices), Object.prototype);
console.log('Topology sharing tests passed: linked mappings, device overrides, network default, future devices, opt-out, migration, conflict protection and safe IDs.');

// Exercise async store integration with isolated transactions, never the user's DB.
const records = new Map(); let failNextWrite = false, closed = 0, notified = 0;
const priorDb = globalThis.indexedDB;
globalThis.indexedDB = { open() {
  const opening = { result: { close() { closed++; }, transaction(_store, mode) {
    const snapshot = new Map([...records].map(([k,v]) => [k, structuredClone(v)]));
    let pending = 0, ended = false;
    const fail = mode === 'readwrite' && failNextWrite;
    if (fail) failNextWrite = false;
    const tx = { abort() { if (!ended) { ended = true; queueMicrotask(() => tx.onabort?.()); } }, objectStore() { return {
      get(key) { const req = {}; enqueue(() => { req.result = snapshot.get(key); req.onsuccess?.(); }); return req; },
      put(value, key) { const req = {}; enqueue(() => { snapshot.set(key, structuredClone(value)); req.onsuccess?.(); }); return req; },
      openCursor() {
        const req = {}, entries = [...snapshot]; let index = 0;
        const step = () => enqueue(() => {
          const entry = entries[index++];
          req.result = entry ? { key: entry[0], value: entry[1], continue: step } : null;
          req.onsuccess?.();
        });
        step(); return req;
      },
    }; } };
    function enqueue(fn) {
      pending++;
      queueMicrotask(() => {
        if (ended) return;
        fn(); pending--;
        queueMicrotask(() => {
          if (pending || ended) return;
          if (fail) { tx.abort(); return; }
          ended = true;
          if (mode === 'readwrite') { records.clear(); for (const [k,v] of snapshot) records.set(k,v); }
          tx.oncomplete?.();
        });
      });
    }
    return tx;
  } } };
  queueMicrotask(() => opening.onsuccess()); return opening;
} };
const unsubscribe = subscribeTopologyImages(() => notified++);
try {
  records.set(JSON.stringify(['v2', 'legacy-device', 'CORP', 'diagram']), { ...record, savedAt: 100 });
  records.set(JSON.stringify(['v2', 'legacy-device', 'GUEST', 'diagram']), { ...record, name: 'Newest image', savedAt: 200 });
  const migrated = await loadDeviceTopology('legacy-device');
  assert.equal(migrated.record.name, 'Newest image');
  assert.equal((await loadDeviceTopology('legacy-device')).imageId, migrated.imageId);
  await updateDeviceTopology({ kind: 'upload', deviceId: 'source', id: 'source-image', record });
  await updateDeviceTopology({ kind: 'share', deviceId: 'source', imageId: 'source-image', revision: 1, deviceIds: ['legacy-device', 'fresh'], network: true });
  assert.equal((await loadDeviceTopology('legacy-device')).record.name, 'Newest image', 'sharing preserves unmigrated legacy recipients');
  assert.equal((await loadDeviceTopology('fresh')).imageId, 'source-image');
  assert.equal((await loadDeviceTopology('future')).imageId, 'source-image');
  failNextWrite = true;
  await assert.rejects(updateDeviceTopology({ kind: 'points', deviceId: 'source', imageId: 'source-image', revision: 1, points: [] }), /storage/);
  assert.equal((await loadDeviceTopology('source')).record.points.length, 1, 'aborted write leaves mappings untouched');
  await updateDeviceTopology({ kind: 'points', deviceId: 'fresh', imageId: 'source-image', revision: 1, points: [] });
  assert.equal((await loadDeviceTopology('source')).record.points.length, 0);
  await assert.rejects(updateDeviceTopology({ kind: 'points', deviceId: 'source', imageId: 'source-image', revision: 1, points: record.points }), /changed/);
  await updateDeviceTopology({ kind: 'detach', deviceId: 'legacy-device' });
  assert.equal((await loadDeviceTopology('legacy-device')).record, null, 'legacy image does not resurface after detach');
  await updateDeviceTopology({ kind: 'inherit', deviceId: 'legacy-device' });
  assert.equal((await loadDeviceTopology('legacy-device')).imageId, 'source-image');
  assert.ok(notified >= 5 && closed >= 10);
  console.log('Async sharing store tests passed: migration, conflict preservation, linked updates, atomic failure, stale edit rejection, notifications and DB cleanup.');
} finally { unsubscribe(); globalThis.indexedDB = priorDb; }
