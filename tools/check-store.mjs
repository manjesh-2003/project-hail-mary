/* Data-layer checks: does an edit survive a reload, and does the shelf follow?
   Runs against the built page so it exercises the real bundle. */

import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(here, "shots");
mkdirSync(SHOTS, { recursive: true });
const PAGE = "file://" + resolve(here, "..", "dist", "sid-loft.html") + "?debug=1";

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
// IndexedDB needs an origin, so serve rather than use file://
const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push("PAGEERROR: " + e.message));
page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text()); });

await page.goto(PAGE);
await page.waitForTimeout(22000);

const dbg = (fn, arg) => page.evaluate(fn, arg);
const shot = f => page.screenshot({ path: resolve(SHOTS, f) });

const seeded = await dbg(() => ({
  count: window.__phm.store.count(),
  adapter: window.__phm.store.adapterName(),
  spines: window.__phm.S.clickable.filter(c => c.userData.kind === "book").length
}));

/* open the manager from the HUD */
await page.click("#shelfbtn");
await page.waitForTimeout(900);
const manager = await dbg(() => ({
  title: document.querySelector(".sheet h2")?.textContent,
  rows: document.querySelectorAll(".mrow").length,
  tabs: document.querySelectorAll(".tab").length
}));
await shot("20-manager.png");

/* add an entry through the real form */
await page.click("#add");
await page.waitForTimeout(700);
await page.fill("#f_title", "Test Entry: A Made-Up Show");
await page.fill("#f_creator", "Nobody Studio");
await page.fill("#f_year", "2026");
await page.fill("#f_units", "12");
await page.fill("#f_done", "5");
await page.selectOption("#f_status", "watching");
await page.fill("#f_genres", "Sci-Fi, Drama");
await page.fill("#f_note", "Added by the automated check.");
await shot("21-editor.png");
await page.click("#save");
await page.waitForTimeout(1600);

const afterAdd = await dbg(() => {
  const it = window.__phm.store.all().find(i => i.title.startsWith("Test Entry"));
  return {
    count: window.__phm.store.count(),
    found: !!it,
    id: it?.id || null,
    units: it?.units, done: it?.done, status: it?.status,
    genres: it?.genres, creator: it?.creator,
    spines: window.__phm.S.clickable.filter(c => c.userData.kind === "book").length
  };
});

/* edit it */
await dbg(id => window.__phm.openEditor(id, "anime"), afterAdd.id);
await page.waitForTimeout(800);
await page.fill("#f_title", "Test Entry: Renamed");
await page.fill("#f_done", "12");
await page.selectOption("#f_status", "done");
await page.fill("#f_rating", "7.5");
await page.click("#save");
await page.waitForTimeout(1500);
const afterEdit = await dbg(id => {
  const it = window.__phm.store.get(id);
  return { title: it?.title, done: it?.done, status: it?.status, rating: it?.rating };
}, afterAdd.id);

/* does it survive a reload? that's the whole point of a backend */
await page.reload();
await page.waitForTimeout(20000);
const afterReload = await dbg(id => {
  const it = window.__phm.store.get(id);
  return {
    count: window.__phm.store.count(),
    title: it?.title || null,
    rating: it?.rating ?? null,
    spines: window.__phm.S.clickable.filter(c => c.userData.kind === "book").length
  };
}, afterAdd.id);
await shot("22-after-reload.png");

/* delete it again and confirm the shelf shrinks */
const afterDelete = await dbg(async id => {
  await window.__phm.store.remove(id);
  await new Promise(r => setTimeout(r, 400));
  return {
    count: window.__phm.store.count(),
    gone: !window.__phm.store.get(id),
    spines: window.__phm.S.clickable.filter(c => c.userData.kind === "book").length
  };
}, afterAdd.id);

/* export round-trip */
const exported = await dbg(async () => {
  const json = await window.__phm.store.exportJSON();
  const parsed = JSON.parse(json);
  return { items: parsed.items.length, hasVersion: parsed.version === 1 };
});

console.log(JSON.stringify({
  seeded, manager, afterAdd, afterEdit, afterReload, afterDelete, exported,
  errors: errs.slice(0, 8)
}, null, 2));

await browser.close();
