import { $, esc } from "./engine.js";
import * as store from "./store.js";
import { STATUSES, KINDS, colourFor, progress, unitLabel, creatorLabel } from "../data/schema.js";
import { BAYS, STREET } from "../data/seed.js";
import { openManager, openEditor, openAccount } from "./editor.js";

const scrim = () => $("#scrim");
const sheet = () => $("#sheet");

export function show(html) {
  sheet().innerHTML = html;
  scrim().classList.add("on");
  sheet().querySelector(".x")?.addEventListener("click", close);
  sheet().querySelector(".x")?.focus();
}
export function close() { scrim().classList.remove("on"); sheet().innerHTML = ""; }
export function isOpen() { return scrim().classList.contains("on"); }

export function initPanels() {
  scrim().addEventListener("click", e => { if (e.target === scrim()) close(); });
  addEventListener("keydown", e => { if (e.key === "Escape") close(); });
}

const head = (title, sub) => `<header><div><h2>${title}</h2><div class="sub">${sub}</div></div>
  <button class="x" aria-label="Close">✕</button></header>`;

const fmtDate = d => {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t) ? d : t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export async function openBook(id) {
  const it = store.get(id);
  if (!it) return;
  const list = store.byBay(KINDS[it.kind].bay);
  const idx = list.findIndex(x => x.id === it.id);
  const st = STATUSES[it.status];
  const pct = Math.round(progress(it) * 100);
  const url = await store.coverURL(it);

  show(head(esc(it.title), [it.genres.join(" · "), it.creator, it.year].filter(Boolean).map(esc).join(" · "))
    + `<div class="body">
    <div class="spread">
      <div class="cover" style="background:${colourFor(it)}">
        ${url ? `<img class="art" src="${esc(url)}" alt="">` : ""}
        <div class="kicker">Vol. ${idx + 1}</div>
        <div><div class="t">${esc(it.title)}</div>
          ${it.altTitle ? `<div class="jp">${esc(it.altTitle)}</div>` : ""}</div>
        <div class="st">${esc(it.creator || KINDS[it.kind].label)}${it.year ? " · " + it.year : ""}</div>
      </div>
      <div>
        <div class="stamp" style="color:${st.col}">${st.stamp}</div>
        ${it.rating != null ? `<div class="rate"><strong>${it.rating}</strong><small>/ 10</small></div>` : ""}
        <ul class="facts">
          <li><b>Kind</b><span>${esc(KINDS[it.kind].label)}</span></li>
          ${it.seasons ? `<li><b>Seasons</b><span>${it.seasons}</span></li>` : ""}
          <li><b>${esc(unitLabel(it))}</b><span>${it.done} / ${it.units}</span></li>
          ${it.creator ? `<li><b>${esc(creatorLabel(it))}</b><span>${esc(it.creator)}</span></li>` : ""}
          <li><b>Started</b><span>${fmtDate(it.started)}</span></li>
          <li><b>Finished</b><span>${fmtDate(it.finished)}</span></li>
        </ul>
        ${it.status === "watching" ? `<div class="bar"><i style="width:${pct}%"></i></div>
          <div class="sub">${pct}% through · ${Math.max(0, it.units - it.done)} to go</div>` : ""}
        ${it.note ? `<div class="note"><b>My note</b>${esc(it.note)}</div>` : ""}
        <div class="rowactions" style="margin-top:18px">
          <button class="btn tiny" id="edit">Edit this entry</button>
        </div>
      </div>
    </div>
    <div class="pager">
      <button class="btn ghost" data-go="-1">← Previous</button>
      <span>Volume ${idx + 1} of ${list.length}</span>
      <button class="btn ghost" data-go="1">Next →</button>
    </div></div>`);

  sheet().querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => {
    const next = list[(idx + +el.dataset.go + list.length) % list.length];
    if (next) openBook(next.id);
  }));
  $("#edit").addEventListener("click", () => openEditor(it.id, KINDS[it.kind].bay));
}

export function openNowPlaying() {
  const now = store.all().filter(i => i.status === "watching");
  const rows = now.length ? now.map(it => {
    const pct = Math.round(progress(it) * 100);
    return `<div class="entry"><div class="sw" style="background:${colourFor(it)}"></div><div style="flex:1">
      <h4>${esc(it.title)}</h4>
      <p>${esc(unitLabel(it))} ${it.done} of ${it.units}${it.started ? " · started " + fmtDate(it.started) : ""}</p>
      <div class="bar"><i style="width:${pct}%"></i></div></div></div>`;
  }).join("") : `<p class="shelfnote">Nothing on the go. Mark something as in progress and it shows up here.</p>`;
  show(head("On the monitor", "Everything you're in the middle of") + `<div class="body">${rows}
    <div class="rowactions" style="margin-top:18px">
      <button class="btn tiny" id="manage">Open the shelves</button></div></div>`);
  $("#manage").addEventListener("click", () => openManager());
}

export function openStats() {
  const all = store.all();
  const done = all.filter(i => i.status === "done").length;
  const now = all.filter(i => i.status === "watching").length;
  const units = all.reduce((n, i) => n + i.done, 0);
  const rated = all.filter(i => i.rating != null);
  const avg = rated.length ? (rated.reduce((n, i) => n + i.rating, 0) / rated.length).toFixed(1) : "—";
  show(head("The count so far", "Everything on the shelves, added up") + `<div class="body">
    <ul class="facts">
      <li><b>On the shelves</b><span>${all.length}</span></li>
      <li><b>Finished</b><span>${done}</span></li>
      <li><b>In progress</b><span>${now}</span></li>
      <li><b>Episodes &amp; chapters</b><span>${units.toLocaleString()}</span></li>
      <li><b>Average rating</b><span>${avg}</span></li>
      <li><b>Roughly</b><span>${Math.round(units * 23 / 60)} hours</span></li>
    </ul>
    <div class="rowactions" style="margin-top:18px">
      <button class="btn tiny" id="manage">Open the shelves</button></div></div>`);
  $("#manage").addEventListener("click", () => openManager());
}

export function openBay(key) {
  const bay = BAYS[key];
  const rows = store.byBay(key);
  show(head(bay.label, `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`) + `<div class="body">
    <p class="shelfnote">${esc(bay.blurb)}</p>
    ${rows.length ? `<ul class="mlist">${rows.map(it => `<li class="mrow">
        <span class="chip" style="background:${colourFor(it)}"></span>
        <div class="mmain"><h4>${esc(it.title)}</h4>
          <p>${esc(KINDS[it.kind].label)}${it.year ? " · " + it.year : ""} ·
             <b style="color:${STATUSES[it.status].col}">${esc(STATUSES[it.status].label)}</b></p></div>
        <div class="mbtns"><button class="btn tiny ghost" data-open="${it.id}">Open</button></div>
      </li>`).join("")}</ul>`
      : `<p class="shelfnote">Nothing here yet.</p>`}
    <div class="rowactions" style="margin-top:18px">
      <button class="btn" id="addhere">＋ Add to this bay</button>
      <button class="btn ghost" id="manage">Manage the shelves</button>
    </div></div>`);
  sheet().querySelectorAll("[data-open]").forEach(b =>
    b.addEventListener("click", () => openBook(b.dataset.open)));
  $("#addhere").addEventListener("click", () => openEditor(null, key));
  $("#manage").addEventListener("click", () => openManager(key));
}

export function openWombats() {
  show(head("Pip &amp; Barrel", "Two one-year-old wombats, one pillow bed") + `<div class="body">
    <div class="entry"><div class="sw" style="background:#4A3A2C"></div><div style="flex:1">
      <h4>Pip</h4><p>Sleeps like it's a competition. Will surface for food and nothing else.</p></div></div>
    <div class="entry"><div class="sw" style="background:#5A4536"></div><div style="flex:1">
      <h4>Barrel</h4><p>Cannot sit still. Starts most of the chasing, loses most of it too.</p></div></div>
    <div class="note"><b>House rule</b>If a wombat is asleep on the bed, the bed belongs to the wombat.
    Sit on the floor like everyone else.</div></div>`);
}

export function openStreet() {
  show(head("Down the stairs", "The street isn't built yet") + `<div class="body">
    <p class="shelfnote">These steps are how you'll get between houses. Everyone gets their own floor,
    decorated their own way — walk down, along the street, and up into someone else's.</p>
    <div class="map">${STREET.map(h => `<div class="house${h.me ? " me" : ""}">
      <div style="font-size:26px${h.me ? "" : "; opacity:.35"}">🏠</div>
      <h4>${esc(h.n)}</h4><p>${esc(h.s.toUpperCase())}</p></div>`).join("")}</div>
    <div class="note" style="margin-top:20px"><b>Next</b>A shared database, so a shelf follows you
    between devices and your friends can see it — then this door goes somewhere.</div></div>`);
}

export { openManager, openEditor, openAccount };
