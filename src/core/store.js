/* The shelf's data layer.

   Everything above this line talks to `store` and nothing else. Swapping the
   adapter underneath — IndexedDB now, a shared database later — should not
   require the room, the editor or the panels to change at all. */

import * as local from "./adapters/indexeddb.js";
import * as remote from "./adapters/supabase.js";
import { isConfigured } from "./config.js";
import { normalise, newId, bayOf } from "../data/schema.js";
import { SEED } from "../data/seed.js";

let adapter = local;
let items = new Map();          // id -> item, kept in memory for synchronous reads
let ready = false;
const listeners = new Set();
const urlCache = new Map();     // blobId -> object URL

export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => { for (const fn of listeners) { try { fn(); } catch (e) { console.error(e); } } };

export function useAdapter(a) { adapter = a; }
export const isReady = () => ready;
export const adapterName = () => adapter.name;

/* Cover art is resized before it is stored — a phone photo is 4MB and a
   book spine is 200px wide. */
const MAX_EDGE = 900;
async function shrink(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && blob.size < 400_000) { bmp.close?.(); return blob; }
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.86));
    return out || blob;
  } catch {
    return blob;      // odd format; keep the original rather than lose it
  }
}

/* Signed in to a configured project → the shared shelf. Otherwise the local
   one, so the app still works offline and before anyone has an account. */
export async function chooseAdapter() {
  if (isConfigured() && await remote.available()) { adapter = remote; return remote; }
  adapter = local;
  return local;
}

export const isShared = () => adapter === remote;
export const auth = remote;

/* Called after signing in or out: swap storage and reload from scratch. */
export async function reload() {
  ready = false;
  items.clear();
  urlCache.forEach(URL.revokeObjectURL);
  urlCache.clear();
  await init();
}

export async function init() {
  if (ready) return;
  await chooseAdapter();
  if (!(await adapter.available?.() ?? true)) {
    console.warn("storage unavailable — running from the seed, nothing will be saved");
    SEED.forEach((raw, i) => {
      const it = normalise({ ...raw, order: i });
      items.set(it.id, it);
    });
    ready = true; emit(); return;
  }
  const rows = await adapter.all();
  if (!rows.length && adapter !== remote) {
    /* A local first run gets the sample shelf so the room isn't bare. A
       signed-in one deliberately does not: everyone can read everyone's
       shelves, and a street where four people all own the same twelve
       entries is worse than a street with an empty room in it. There's a
       button for it in the manager instead. */
    const seeded = SEED.map((raw, i) => normalise({ ...raw, order: i }));
    await adapter.putMany(seeded);
    seeded.forEach(it => items.set(it.id, it));
  } else {
    rows.map(normalise).forEach(it => items.set(it.id, it));
  }
  ready = true;
  emit();
}

/* Copy the sample shelf in alongside whatever is already there. */
export async function addSeed() {
  const base = items.size;
  const seeded = SEED.map((raw, i) => normalise({ ...raw, id: newId(), order: base + i }));
  await adapter.putMany(seeded);
  seeded.forEach(it => items.set(it.id, it));
  emit();
  return seeded.length;
}

export const all = () =>
  [...items.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

export const byBay = bay => all().filter(it => bayOf(it) === bay);
export const byKind = kind => all().filter(it => it.kind === kind);
export const get = id => items.get(id) || null;
export const count = () => items.size;

export async function put(raw) {
  const existing = raw.id ? items.get(raw.id) : null;
  const item = normalise({
    ...(existing || {}),
    ...raw,
    order: raw.order ?? existing?.order ?? items.size,
    updatedAt: Date.now()
  });
  items.set(item.id, item);
  try { await adapter.put(item); } catch (e) { console.error("save failed", e); }
  emit();
  return item;
}

export async function remove(id) {
  const it = items.get(id);
  if (!it) return;
  await dropCover(it);
  items.delete(id);
  try { await adapter.remove(id); } catch (e) { console.error("delete failed", e); }
  emit();
}

/* source: a File/Blob to store ourselves, a string URL to reference, or null */
export async function setCover(id, source) {
  const it = items.get(id);
  if (!it) return null;

  await dropCover(it);

  let cover = null;
  if (source instanceof Blob) {
    const blobId = newId();
    const stored = await adapter.putBlob(blobId, await shrink(source));
    cover = adapter === remote
      ? { kind: "path", path: stored }
      : { kind: "blob", blobId };
  } else if (typeof source === "string" && source.trim()) {
    cover = { kind: "url", url: source.trim() };
  }
  return put({ ...it, cover });
}

/* A URL the page and the 3D textures can both use. Blobs win because they
   are ours: no CORS, no hotlink that breaks when someone else's CDN moves. */
export async function coverURL(item) {
  if (!item?.cover) return null;
  if (item.cover.kind === "url") return item.cover.url;
  if (item.cover.kind === "path") return remote.publicURL(item.cover.path);
  const { blobId } = item.cover;
  if (urlCache.has(blobId)) return urlCache.get(blobId);
  const blob = await adapter.getBlob(blobId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(blobId, url);
  return url;
}

async function dropCover(it) {
  if (!it?.cover) return;
  if (it.cover.kind === "blob") {
    releaseURL(it.cover.blobId);
    try { await adapter.removeBlob(it.cover.blobId); } catch { /* already gone */ }
  } else if (it.cover.kind === "path") {
    try { await adapter.removeBlob(it.cover.path); } catch { /* already gone */ }
  }
}

function releaseURL(blobId) {
  const url = urlCache.get(blobId);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(blobId); }
}

export async function reorder(ids) {
  const updates = [];
  ids.forEach((id, i) => {
    const it = items.get(id);
    if (it && it.order !== i) { it.order = i; it.updatedAt = Date.now(); updates.push(it); }
  });
  if (!updates.length) return;
  try { await adapter.putMany(updates); } catch (e) { console.error(e); }
  emit();
}

export async function resetToSeed() {
  await adapter.clear?.();
  items.clear();
  urlCache.forEach(URL.revokeObjectURL);
  urlCache.clear();
  const seeded = SEED.map((raw, i) => normalise({ ...raw, order: i }));
  await adapter.putMany(seeded);
  seeded.forEach(it => items.set(it.id, it));
  emit();
}

/* Export / import — the stop-gap for moving a shelf between devices until
   the shared adapter lands. Blobs are inlined as data URLs. */
export async function exportJSON() {
  const out = [];
  for (const it of all()) {
    const copy = { ...it };
    if (it.cover?.kind === "blob" || it.cover?.kind === "path") {
      const blob = await adapter.getBlob(it.cover.blobId || it.cover.path);
      copy.cover = blob
        ? { kind: "url", url: await blobToDataURL(blob) }
        : null;
    }
    out.push(copy);
  }
  return JSON.stringify({ version: 1, exported: Date.now(), items: out }, null, 2);
}

export async function importJSON(text, { replace = false } = {}) {
  const data = JSON.parse(text);
  const rows = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(rows)) throw new Error("That file doesn't look like a shelf export.");
  if (replace) { await adapter.clear?.(); items.clear(); }
  let n = 0;
  for (const raw of rows) {
    const it = normalise({ ...raw, id: replace ? raw.id : newId() });
    if (it.cover?.kind === "url" && it.cover.url.startsWith("data:")) {
      const blob = await (await fetch(it.cover.url)).blob();
      const blobId = newId();
      const stored = await adapter.putBlob(blobId, blob);
      it.cover = adapter === remote ? { kind: "path", path: stored } : { kind: "blob", blobId };
    }
    items.set(it.id, it);
    await adapter.put(it);
    n++;
  }
  emit();
  return n;
}

const blobToDataURL = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});
