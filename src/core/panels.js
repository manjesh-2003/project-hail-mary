import { $, esc } from "./engine.js";
import { LIB, STATUS, WATCHING, BAYS, STREET } from "../data/library.js";

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

export function openBook(i) {
  const b = LIB[i], st = STATUS[b.status];
  const pct = Math.round(b.seen / b.eps * 100);
  show(head(esc(b.t), `${esc(b.g.join(" · "))} · ${esc(String(b.studio))} · ${b.y}`) + `<div class="body">
    <div class="spread">
      <div class="cover" style="background:${b.c}">
        <div class="kicker">Vol. ${i + 1}</div>
        <div><div class="t">${esc(b.t)}</div><div class="jp">${esc(b.jp)}</div></div>
        <div class="st">${esc(String(b.studio))} · ${b.y}</div>
      </div>
      <div>
        <div class="stamp" style="color:${st.col}">${st.stamp}</div>
        ${b.rate ? `<div class="rate"><strong>${b.rate}</strong><small>/ 10</small></div>` : ""}
        <ul class="facts">
          <li><b>Seasons</b><span>${esc(String(b.seasons))}</span></li>
          <li><b>Episodes</b><span>${b.seen} / ${b.eps}</span></li>
          <li><b>Studio</b><span>${esc(String(b.studio))}</span></li>
          <li><b>Started</b><span>${b.start || "—"}</span></li>
          <li><b>Finished</b><span>${b.end || "—"}</span></li>
        </ul>
        ${b.status === "watching" ? `<div class="bar"><i style="width:${pct}%"></i></div>
          <div class="sub">${pct}% through · ${b.eps - b.seen} episodes left</div>` : ""}
        <div class="note"><b>My note</b>${esc(b.note)}</div>
      </div>
    </div>
    <div class="pager"><button data-go="-1">← Previous</button>
      <span>Volume ${i + 1} of ${LIB.length}</span>
      <button data-go="1">Next →</button></div></div>`);
  sheet().querySelectorAll("[data-go]").forEach(el => el.addEventListener("click",
    () => openBook((i + +el.dataset.go + LIB.length) % LIB.length)));
}

export function openNowPlaying() {
  const rows = WATCHING.map(b => {
    const pct = Math.round(b.seen / b.eps * 100);
    return `<div class="entry"><div class="sw" style="background:${b.c}"></div><div style="flex:1">
      <h4>${esc(b.t)}</h4><p>Episode ${b.seen} of ${b.eps} · started ${b.start}</p>
      <div class="bar"><i style="width:${pct}%"></i></div></div></div>`;
  }).join("");
  show(head("On the monitor", "Everything you're in the middle of") + `<div class="body">${rows}
    <div class="note" style="margin-top:18px"><b>Note to self</b>Three going at once again. Should finish
    Monster before starting anything new, but I said that last month too.</div></div>`);
}

export function openStats() {
  const done = LIB.filter(b => b.status === "done").length;
  const eps = LIB.reduce((n, b) => n + b.seen, 0);
  show(head("The count so far", "Everything on the shelf, added up") + `<div class="body">
    <ul class="facts">
      <li><b>Volumes shelved</b><span>${LIB.length}</span></li>
      <li><b>Finished</b><span>${done}</span></li>
      <li><b>Still watching</b><span>${WATCHING.length}</span></li>
      <li><b>Episodes watched</b><span>${eps.toLocaleString()}</span></li>
      <li><b>Roughly</b><span>${Math.round(eps * 23 / 60)} hours</span></li>
    </ul>
    <div class="note"><b>Coming</b>Real cover art from AniList, a shelf that saves what you add,
    and a street with everyone else's floor on it.</div></div>`);
}

export function openBay(key) {
  const bay = BAYS[key];
  if (key === "anime") return openStats();
  show(head(bay.label, "An empty bay, waiting for a catalogue") + `<div class="body">
    <p class="shelfnote">${esc(bay.blurb)}</p>
    <div class="note"><b>Planned</b>Each bay gets its own list, its own spines and its own detail
    card — the same machinery the anime shelf uses, pointed at a different catalogue.</div></div>`);
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
    <div class="note" style="margin-top:20px"><b>Next</b>Accounts, so each loft remembers its own
    shelf — then this door actually goes somewhere.</div></div>`);
}
