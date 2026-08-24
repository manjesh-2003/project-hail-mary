/* Shared storage adapter.

   Same shape as the IndexedDB one, so `store.js` cannot tell them apart:
   available / all / get / put / putMany / remove / putBlob / getBlob /
   removeBlob / clear.

   Rows live in `items`, cover art in the `covers` bucket under
   <user-id>/<item-id>. Who may read and write what is enforced by the
   database, not by this file — see supabase/schema.sql. */

import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../config.js";

export const name = "supabase";

let client = null;
let session = null;
let viewing = null;      // whose shelf we're looking at; null = your own

export function db() {
  if (client) return client;
  const cfg = supabaseConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}

export async function available() {
  const c = db();
  if (!c) return false;
  const { data } = await c.auth.getSession();
  session = data?.session || null;
  return !!session;
}

export const currentUser = () => session?.user || null;
export const setViewing = id => { viewing = id || null; };
export const viewingId = () => viewing || session?.user?.id || null;
const canWrite = () => !viewing || viewing === session?.user?.id;

/* ── auth ──────────────────────────────────────
   A link in an email: no password for anyone to lose, and none for this
   code to handle. */
export async function signIn(email) {
  const c = db();
  if (!c) throw new Error("No project configured.");
  const { error } = await c.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: location.href.split("#")[0] }
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  await db()?.auth.signOut();
  session = null;
}

export function onAuth(fn) {
  const c = db();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_e, s) => { session = s; fn(s); });
  return () => data?.subscription?.unsubscribe();
}

/* ── rows ──────────────────────────────────── */
const toRow = (it, owner) => ({
  id: it.id, owner,
  kind: it.kind, title: it.title, alt_title: it.altTitle,
  year: it.year, creator: it.creator, seasons: it.seasons,
  units: it.units, done: it.done, status: it.status, rating: it.rating,
  genres: it.genres, colour: it.colour,
  started: it.started, finished: it.finished, note: it.note,
  cover_path: it.cover?.kind === "path" ? it.cover.path : null,
  source: it.source, order: it.order
});

const fromRow = r => ({
  id: r.id, kind: r.kind, title: r.title, altTitle: r.alt_title,
  year: r.year, creator: r.creator, seasons: r.seasons,
  units: r.units, done: r.done, status: r.status, rating: r.rating,
  genres: r.genres || [], colour: r.colour,
  started: r.started, finished: r.finished, note: r.note,
  cover: r.cover_path ? { kind: "path", path: r.cover_path } : null,
  source: r.source, order: r.order,
  updatedAt: r.updated_at ? Date.parse(r.updated_at) : Date.now()
});

function fail(error, what) {
  if (!error) return;
  throw new Error(`Couldn't ${what}: ${error.message}`);
}

export async function all() {
  const c = db();
  const id = viewingId();
  if (!c || !id) return [];
  const { data, error } = await c.from("items").select("*").eq("owner", id).order("order");
  fail(error, "load the shelves");
  return (data || []).map(fromRow);
}

export async function get(id) {
  const c = db();
  const { data, error } = await c.from("items").select("*").eq("id", id).maybeSingle();
  fail(error, "load that entry");
  return data ? fromRow(data) : undefined;
}

export async function put(item) {
  if (!canWrite()) throw new Error("This is someone else's shelf — you can look, not rearrange.");
  const c = db();
  const { error } = await c.from("items").upsert(toRow(item, session.user.id));
  fail(error, "save that entry");
  return item;
}

export async function putMany(items) {
  if (!items.length) return items;
  if (!canWrite()) throw new Error("This is someone else's shelf — you can look, not rearrange.");
  const c = db();
  const { error } = await c.from("items").upsert(items.map(i => toRow(i, session.user.id)));
  fail(error, "save those entries");
  return items;
}

export async function remove(id) {
  if (!canWrite()) throw new Error("This is someone else's shelf — you can look, not rearrange.");
  const { error } = await db().from("items").delete().eq("id", id);
  fail(error, "delete that entry");
}

/* ── cover art ─────────────────────────────────
   `key` is our blob id; the object path folds in the user id so the storage
   policy can check ownership from the folder name alone. */
const objectPath = key => `${session.user.id}/${key}`;

export async function putBlob(key, blob) {
  if (!canWrite()) throw new Error("This is someone else's shelf.");
  const path = objectPath(key);
  const { error } = await db().storage.from("covers")
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
  fail(error, "upload that cover");
  return path;
}

export async function getBlob(key) {
  const path = key.includes("/") ? key : objectPath(key);
  const { data, error } = await db().storage.from("covers").download(path);
  if (error) return null;         // a missing cover is not worth an exception
  return data;
}

export async function removeBlob(key) {
  const path = key.includes("/") ? key : objectPath(key);
  await db().storage.from("covers").remove([path]);
}

/* A cover the browser can fetch straight from the CDN, for the flat panel. */
export function publicURL(path) {
  const { data } = db().storage.from("covers").getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function clear() {
  if (!canWrite()) throw new Error("This is someone else's shelf.");
  const { error } = await db().from("items").delete().eq("owner", session.user.id);
  fail(error, "clear the shelves");
}

/* Everyone with a room, for the street. */
export async function people() {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("profiles").select("id, handle, room").order("handle");
  if (error) return [];
  return data || [];
}
