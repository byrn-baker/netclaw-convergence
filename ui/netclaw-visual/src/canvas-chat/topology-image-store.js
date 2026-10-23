export const MAX_TOPOLOGY_IMAGE_BYTES = 5 * 1024 * 1024;
// Device-wide: addresses, interfaces and VRFs do not partition attachments.
export const topologyDiagramKey = ({ deviceId }) => JSON.stringify(['v3', deviceId || 'unknown', 'diagram']);
export function topologyImageKey({ deviceId, type, value, vrf }) {
  return JSON.stringify(['v1', deviceId || 'unknown', vrf || null, type, value]);
}
export async function validateTopologyImage(file) {
  if (!file || !file.size || file.size > MAX_TOPOLOGY_IMAGE_BYTES) throw new Error('Choose an image up to 5 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(file.type === 'image/png' && png || file.type === 'image/jpeg' && jpeg || file.type === 'image/webp' && webp)) {
    throw new Error('Choose a valid PNG, JPEG or WebP image. SVG and other file types are not supported.');
  }
}

// Browser-local blobs only: no API, model upload or router write.
export function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('netclaw-topology-images', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser storage is unavailable. Enable site storage and try again.'));
    request.onblocked = () => reject(new Error('Close other NetClaw tabs and retry to update browser storage.'));
  });
}
async function transaction(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('images', mode);
      const request = operation(tx.objectStore('images'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(new Error('Could not save or read the topology image. Check browser storage space and permissions.'));
    });
  } finally { db.close(); }
}
export const readTopologyImage = key => transaction('readonly', store => store.get(key));
export const saveTopologyImage = (key, record) => transaction('readwrite', store => store.put(record, key));
export const removeTopologyImage = key => transaction('readwrite', store => store.delete(key));
