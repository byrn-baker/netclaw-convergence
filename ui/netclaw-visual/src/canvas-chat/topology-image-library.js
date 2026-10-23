import { randomId } from '../shared/random-id.js';
import { database } from './topology-image-store.js';
import { validDevicePoints } from './topology-image-markers.js';

const KEY = 'topology-library-v3';
const empty = () => ({ images: {}, devices: {}, networkId: null });
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export function resolveTopology(library, deviceId) {
  const inherit = !own(library.devices, deviceId) || library.devices[deviceId] === '@network';
  const id = inherit ? library.networkId : library.devices[deviceId];
  const record = id ? library.images[id] : null;
  return { record: record || null, imageId: record ? id : null,
    network: Boolean(record && library.networkId === id), inherited: Boolean(record && inherit),
    linkedDevices: id ? Object.keys(library.devices).filter(d => library.devices[d] === id) : [] };
}

// Reducer is also exercised without any user storage by unit tests.
export function changeTopology(library, action) {
  const next = { ...library, images: { ...library.images }, devices: { ...library.devices } };
  const { deviceId } = action;
  if (action.kind === 'upload') {
    next.images[action.id] = { ...action.record, points: validDevicePoints(action.record.points), revision: 1 };
    Object.defineProperty(next.devices, deviceId, { value: action.id, enumerable: true, configurable: true, writable: true });
  } else if (action.kind === 'migrate') {
    if (!own(next.devices, deviceId)) {
      if (!action.record || action.record.removed) Object.defineProperty(next.devices, deviceId, { value: action.record ? null : '@network', enumerable: true, configurable: true, writable: true });
      else return changeTopology(next, { ...action, kind: 'upload' });
    }
  } else if (action.kind === 'points' || action.kind === 'share') {
    const current = resolveTopology(next, deviceId);
    if (!current.record || current.imageId !== action.imageId || current.record.revision !== action.revision) {
      throw new Error('This topology changed in another window. Reopen it and try again.');
    }
    if (action.kind === 'points') next.images[current.imageId] = { ...current.record, points: validDevicePoints(action.points), revision: current.record.revision + 1 };
    else {
      if (action.network) next.networkId = current.imageId;
      for (const id of [...new Set(action.deviceIds || [])]) {
        if (!action.replace && own(next.devices, id) && next.devices[id] !== '@network' && next.devices[id] !== current.imageId) continue;
        Object.defineProperty(next.devices, id, { value: current.imageId, enumerable: true, configurable: true, writable: true });
      }
    }
  } else if (action.kind === 'detach') {
    Object.defineProperty(next.devices, deviceId, { value: null, enumerable: true, configurable: true, writable: true });
  } else if (action.kind === 'inherit') {
    Object.defineProperty(next.devices, deviceId, { value: '@network', enumerable: true, configurable: true, writable: true });
  } else if (action.kind === 'stop-network') {
    if (next.networkId === action.imageId) next.networkId = null;
  } else throw new Error('Unknown topology action.');
  // Keep records while shared by another device or the network default.
  const used = new Set([...Object.values(next.devices), next.networkId]);
  for (const id of Object.keys(next.images)) if (!used.has(id)) delete next.images[id];
  return next;
}

const listeners = new Set();
let channel;
function bus() {
  if (!channel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('netclaw-topology-library');
    channel.onmessage = () => listeners.forEach(fn => fn());
  }
  return channel;
}
export function subscribeTopologyImages(fn) {
  listeners.add(fn); bus();
  return () => { listeners.delete(fn); if (!listeners.size) { channel?.close(); channel = null; } };
}
function notify() { listeners.forEach(fn => fn()); bus()?.postMessage('changed'); }

// Read/modify/write in ONE IndexedDB transaction: no lost updates between tabs.
async function access(action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', action ? 'readwrite' : 'readonly');
      const store = tx.objectStore('images');
      const request = store.get(KEY); let library, failure;
      request.onsuccess = () => {
        try {
          library = request.result || empty();
          if (action) { library = changeTopology(library, action); store.put(library, KEY); }
        } catch (e) { failure = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(library);
      tx.onabort = tx.onerror = () => reject(failure || new Error('Could not save topology sharing. Check browser storage permissions and space.'));
    });
  } finally { db.close(); }
}
async function legacyFor(deviceId) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', 'readonly'), request = tx.objectStore('images').openCursor();
      const candidates = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        try { const key = JSON.parse(cursor.key); if (['v1', 'v2'].includes(key[0]) && key[1] === deviceId) candidates.push({ version: key[0], record: cursor.value }); } catch { /* Not a legacy image key. */ }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(candidates.sort((a, b) => b.version.localeCompare(a.version) || (b.record.savedAt || 0) - (a.record.savedAt || 0))[0]?.record);
      tx.onabort = tx.onerror = () => reject(new Error('Could not read older topology attachments.'));
    });
  } finally { db.close(); }
}
export async function loadDeviceTopology(deviceId) {
  let library = await access();
  if (!own(library.devices, deviceId)) {
    const legacy = await legacyFor(deviceId);
    library = await access({ kind: 'migrate', deviceId, id: randomId(), record: legacy });
  }
  return { ...resolveTopology(library, deviceId), networkAvailable: Boolean(library.networkId) };
}
export async function updateDeviceTopology(action) {
  // Migrate recipients before checking conflicts, preserving their older images.
  if (action.kind === 'share') for (const id of new Set(action.deviceIds || [])) await loadDeviceTopology(id);
  const library = await access(action); notify();
  return { ...resolveTopology(library, action.deviceId), networkAvailable: Boolean(library.networkId) };
}
