import * as THREE from "three";
import { $, esc } from "./engine.js";
import { show, close } from "./panels.js";

/* The photo wall. Pictures are downscaled in the browser and kept in
   localStorage, so they survive a refresh on this device — they do NOT
   travel to anyone else yet. That waits for accounts. */

const KEY = "phm.sid.photos.v1";
const SLOTS = 4;
const MAXPX = 720;

let store = new Array(SLOTS).fill(null);
const frames = [];   // { mesh, mat, index }

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) store = arr.slice(0, SLOTS);
    }
  } catch { /* private mode, blocked storage — carry on empty */ }
  while (store.length < SLOTS) store.push(null);
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); }
  catch { /* quota or blocked; the photo still shows this session */ }
}

function placeholder(i) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 384;
  const g = c.getContext("2d");
  g.fillStyle = "#2B2F3A"; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "rgba(226,196,132,.5)"; g.lineWidth = 4;
  g.setLineDash([14, 10]); g.strokeRect(22, 22, 468, 340); g.setLineDash([]);
  g.fillStyle = "rgba(232,222,208,.55)";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "600 40px Karla, sans-serif";
  g.fillText("+", 256, 168);
  g.font = "500 22px Karla, sans-serif";
  g.fillText("add a photo", 256, 216);
  g.font = "500 16px Karla, sans-serif";
  g.fillStyle = "rgba(232,222,208,.3)";
  g.fillText(`frame ${i + 1}`, 256, 300);
  return c;
}

function applyTexture(i) {
  const f = frames[i];
  if (!f) return;
  const src = store[i];
  const finish = img => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    f.mat.map?.dispose?.();
    f.mat.map = t;
    f.mat.needsUpdate = true;
  };
  if (!src) return finish(placeholder(i));
  const img = new Image();
  img.onload = () => finish(img);
  img.onerror = () => finish(placeholder(i));
  img.src = src;
}

/* shrink to a sane size before it goes anywhere near storage */
function ingest(file, i, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAXPX / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      store[i] = c.toDataURL("image/jpeg", .82);
      save(); applyTexture(i); done(null);
    };
    img.onerror = () => done("That file didn't decode as an image.");
    img.src = reader.result;
  };
  reader.onerror = () => done("Couldn't read that file.");
  reader.readAsDataURL(file);
}

export function registerFrame(mesh, mat, index) {
  frames[index] = { mesh, mat, index };
  applyTexture(index);
}

export function initPhotos() { load(); }

export function openPhoto(i) {
  const has = !!store[i];
  show(`<header><div><h2>Photo wall</h2><div class="sub">Frame ${i + 1} of ${SLOTS}</div></div>
      <button class="x" aria-label="Close">✕</button></header>
    <div class="body">
      <p class="shelfnote">Pick a picture for this frame. It's resized in your browser and saved on
      this device only — it stays on the wall when you come back, but nobody else can see it until
      the project has accounts.</p>
      <div class="photoactions">
        <label class="btn">
          <input type="file" accept="image/*" hidden id="pf">
          ${has ? "Replace photo" : "Choose a photo"}
        </label>
        ${has ? `<button class="btn ghost" id="pclear">Remove</button>` : ""}
      </div>
      <p class="err" id="perr" hidden></p>
    </div>`);

  $("#pf").addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;
    ingest(file, i, err => {
      if (err) { const p = $("#perr"); p.hidden = false; p.textContent = err; }
      else close();
    });
  });
  $("#pclear")?.addEventListener("click", () => {
    store[i] = null; save(); applyTexture(i); close();
  });
  void esc;
}
