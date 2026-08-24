/* Local storage adapter.

   IndexedDB rather than localStorage because cover art is the point: blobs
   go in as blobs, with no base64 inflation and no 5MB ceiling. */

const DB = "project-hail-mary";
const VERSION = 1;
const ITEMS = "items";
const BLOBS = "blobs";

let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ITEMS)) {
        const s = db.createObjectStore(ITEMS, { keyPath: "id" });
        s.createIndex("kind", "kind");
        s.createIndex("order", "order");
      }
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB is blocked by another tab"));
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    try { out = fn(s); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("transaction aborted"));
  }));
}

export const name = "indexeddb";

export async function available() {
  if (!globalThis.indexedDB) return false;
  try { await open(); return true; } catch { return false; }
}

export async function all() {
  const rows = await tx(ITEMS, "readonly", s => s.getAll());
  return rows || [];
}

export async function get(id) {
  return tx(ITEMS, "readonly", s => s.get(id));
}

export async function put(item) {
  await tx(ITEMS, "readwrite", s => s.put(item));
  return item;
}

export async function putMany(items) {
  await tx(ITEMS, "readwrite", s => { items.forEach(i => s.put(i)); });
  return items;
}

export async function remove(id) {
  await tx(ITEMS, "readwrite", s => s.delete(id));
}

export async function putBlob(key, blob) {
  await tx(BLOBS, "readwrite", s => s.put(blob, key));
  return key;
}

export async function getBlob(key) {
  return tx(BLOBS, "readonly", s => s.get(key));
}

export async function removeBlob(key) {
  await tx(BLOBS, "readwrite", s => s.delete(key));
}

export async function clear() {
  await tx(ITEMS, "readwrite", s => s.clear());
  await tx(BLOBS, "readwrite", s => s.clear());
}
