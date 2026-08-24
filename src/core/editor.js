/* The shelf editor: add, change and remove what's on the shelves.

   Lives in the same paper panel as everything else, so editing feels like
   writing in the book rather than opening a settings screen. */

import { $, esc } from "./engine.js";
import { show, close } from "./panels.js";
import * as store from "./store.js";
import { search, fetchCover, CatalogError } from "./catalog.js";
import { KINDS, STATUSES, colourFor, unitLabel, creatorLabel, bayOf } from "../data/schema.js";
import { BAYS } from "../data/seed.js";
import { isConfigured } from "./config.js";

const head = (title, sub) => `<header><div><h2>${title}</h2><div class="sub">${sub}</div></div>
  <button class="x" aria-label="Close">✕</button></header>`;

const val = sel => ($(sel)?.value ?? "").trim();
const setBusy = (el, on, label) => {
  if (!el) return;
  el.disabled = on;
  if (label) el.textContent = on ? "Working…" : label;
};

/* ── the manager: everything on the shelves ── */
export function openManager(bay = null) {
  const bays = ["anime", "screen", "books"];
  const active = bay || "anime";
  const rows = store.byBay(active);

  show(head("The shelves", "Add, change or remove anything here") + `<div class="body">
    <div class="tabs" role="tablist">
      ${bays.map(b => `<button role="tab" class="tab${b === active ? " on" : ""}" data-bay="${b}">
        ${esc(BAYS[b].label)} <em>${store.byBay(b).length}</em></button>`).join("")}
    </div>
    <div class="rowactions">
      <button class="btn" id="add">＋ Add an entry</button>
      <button class="btn ghost" id="exp">Export</button>
      <label class="btn ghost">Import<input type="file" id="imp" accept="application/json" hidden></label>
      <button class="btn ghost danger" id="rst">Reset to samples</button>
    </div>
    <div class="syncbar">
      <span class="dot ${store.isShared() ? "on" : ""}"></span>
      <span>${store.isShared()
        ? `Synced — your shelf follows you between devices.`
        : `Saved on this device only. Nobody else can see it.`}</span>
      <button class="btn tiny ghost" id="acct">${store.isShared() ? "Account" : "Set up syncing"}</button>
    </div>
    <p class="err" id="merr" hidden></p>
    ${rows.length ? `<ul class="mlist">${rows.map(rowHTML).join("")}</ul>`
      : `<p class="shelfnote">This bay is empty. Add something and it appears on the shelf straight away.</p>`}
    ${store.count() === 0 ? `<div class="rowactions" style="margin-top:14px">
      <button class="btn ghost" id="seed">Start from the sample shelf</button></div>` : ""}
  </div>`);

  $("#sheet").querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => openManager(t.dataset.bay)));
  $("#add").addEventListener("click", () => openEditor(null, active));
  $("#sheet").querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openEditor(b.dataset.edit, active)));
  $("#sheet").querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => confirmDelete(b.dataset.del, active)));

  $("#acct").addEventListener("click", () => openAccount(active));
  $("#exp").addEventListener("click", () => openExport(active));
  $("#imp").addEventListener("change", async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const n = await store.importJSON(await f.text());
      openManager(active);
      flash(`Imported ${n} ${n === 1 ? "entry" : "entries"}.`);
    } catch (err) { flash(err.message, true); }
  });
  $("#seed")?.addEventListener("click", async () => {
    const n = await store.addSeed();
    openManager(active);
    flash(`Added ${n} sample entries — change or delete any of them.`);
  });
  $("#rst").addEventListener("click", async () => {
    if (!confirm("Throw away everything on the shelves and go back to the sample entries?")) return;
    await store.resetToSeed();
    openManager(active);
  });
}

/* ── account ────────────────────────────────
   Sign-in is a link in an email: nobody has a password to lose, and this
   code never sees one. */
export function openAccount(bay = "anime") {
  const configured = isConfigured();
  const shared = store.isShared();
  const user = shared ? store.auth.currentUser() : null;

  const body = !configured
    ? `<p class="shelfnote">This copy isn't pointed at a database yet, so the shelves live on
         this device. To make them follow you around and let friends look at them, someone has
         to create the project once and drop two values into <code>src/core/config.js</code>.
         The steps are in <code>supabase/README.md</code>.</p>
       <div class="note"><b>Meanwhile</b>Export from one device and import on another. It's
       clumsy, but nothing is lost while we wait.</div>`
    : shared
      ? `<p class="shelfnote">Signed in as <b>${esc(user?.email || "you")}</b>. Everything you
           change is saved to your shelf, and your friends can look at it from theirs.</p>
         <div class="rowactions"><button class="btn ghost" id="out">Sign out</button></div>`
      : `<p class="shelfnote">Sign in and your shelf moves off this device: it follows you to
           your phone, and your friends can visit it. We'll email you a link — there's no
           password to remember.</p>
         <label class="fld"><span>Your email</span>
           <input id="email" type="email" autocomplete="email" placeholder="you@example.com"></label>
         <div class="rowactions" style="margin-top:14px">
           <button class="btn" id="in">Email me a link</button>
           <button class="btn ghost" id="back">Not now</button>
         </div>`;

  show(head("Syncing", configured ? (shared ? "Signed in" : "Not signed in") : "Not set up yet")
    + `<div class="body">${body}<p class="err" id="aerr" hidden></p></div>`);

  $("#back")?.addEventListener("click", () => openManager(bay));
  $("#out")?.addEventListener("click", async () => {
    await store.auth.signOut();
    await store.reload();
    openManager(bay);
    flash("Signed out. Back to this device's shelf.");
  });
  $("#in")?.addEventListener("click", async () => {
    const email = val("#email");
    const err = $("#aerr");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      err.hidden = false; err.textContent = "That doesn't look like an email address."; return;
    }
    setBusy($("#in"), true, "Email me a link");
    try {
      await store.auth.signIn(email);
      show(head("Check your email", esc(email)) + `<div class="body">
        <p class="shelfnote">A sign-in link is on its way. Open it on this device and you'll
        come straight back here, synced.</p>
        <div class="rowactions"><button class="btn ghost" id="back2">Back to the shelves</button></div>
        </div>`);
      $("#back2").addEventListener("click", () => openManager(bay));
    } catch (e) {
      err.hidden = false; err.textContent = e.message || "Couldn't send that link.";
    } finally { setBusy($("#in"), false, "Email me a link"); }
  });
}

/* Export shows the text as well as offering the file. Some places the page
   runs — an embedded viewer, a locked-down browser — quietly ignore a
   download, and a button that appears to do nothing is worse than no button. */
async function openExport(bay) {
  const json = await store.exportJSON();
  const n = store.count();
  show(head("Export the shelves", `${n} ${n === 1 ? "entry" : "entries"}, cover art included`)
    + `<div class="body">
    <p class="shelfnote">Copy this, or save it as a file. Import it back on another device to
    move the shelves across.</p>
    <div class="rowactions">
      <button class="btn" id="copy">Copy to clipboard</button>
      <button class="btn ghost" id="dl">Save as a file</button>
      <button class="btn ghost" id="back">Back</button>
    </div>
    <label class="fld"><span>The data</span>
      <textarea id="dump" rows="10" readonly>${esc(json)}</textarea></label>
    <p class="err" id="xerr" hidden></p></div>`);

  $("#back").addEventListener("click", () => openManager(bay));
  $("#copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(json);
      flash("Copied.");
    } catch {
      const ta = $("#dump");
      ta.focus(); ta.select();
      $("#xerr").hidden = false;
      $("#xerr").textContent = "Couldn't reach the clipboard — the text is selected, so copy it by hand.";
    }
  });
  $("#dl").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "shelf.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    flash("If nothing downloaded, copy the text instead.");
  });
}

function rowHTML(it) {
  const st = STATUSES[it.status];
  const pct = it.units ? Math.round(it.done / it.units * 100) : 0;
  return `<li class="mrow">
    <span class="chip" style="background:${colourFor(it)}"></span>
    <div class="mmain">
      <h4>${esc(it.title)}</h4>
      <p>${esc(KINDS[it.kind].label)}${it.year ? " · " + it.year : ""}${it.creator ? " · " + esc(it.creator) : ""}
         · <b style="color:${st.col}">${esc(st.label)}</b>
         ${it.status === "watching" ? ` · ${it.done}/${it.units} (${pct}%)` : ""}</p>
    </div>
    <div class="mbtns">
      <button class="btn tiny" data-edit="${it.id}">Edit</button>
      <button class="btn tiny ghost danger" data-del="${it.id}">Delete</button>
    </div>
  </li>`;
}

function confirmDelete(id, bay) {
  const it = store.get(id);
  if (!it) return;
  show(head("Delete this?", esc(it.title)) + `<div class="body">
    <p class="shelfnote">This takes <b>${esc(it.title)}</b> off the shelf for good, along with its
    cover and your note. There's no undo.</p>
    <div class="rowactions">
      <button class="btn danger" id="yes">Delete it</button>
      <button class="btn ghost" id="no">Keep it</button>
    </div></div>`);
  $("#no").addEventListener("click", () => openManager(bay));
  $("#yes").addEventListener("click", async () => {
    await store.remove(id);
    openManager(bay);
    flash("Deleted.");
  });
}

/* ── the entry form ─────────────────────────── */
let searchAbort = null;
let pendingCover = undefined;   // undefined = unchanged, null = clear, Blob/string = set

export function openEditor(id, bay = "anime") {
  const it = id ? store.get(id) : null;
  const kind = it?.kind || defaultKindFor(bay);
  pendingCover = undefined;

  show(head(it ? "Edit entry" : "Add to the shelf", it ? esc(it.title) : "Search for it, or type it in yourself")
    + `<div class="body">
    <div class="lookup">
      <label class="fld grow">
        <span>Find it</span>
        <input id="q" type="search" placeholder="Start typing a title…" autocomplete="off"
               value="${esc(it?.title || "")}">
      </label>
      <button class="btn" id="go">Search</button>
    </div>
    <div id="results" class="results" hidden></div>
    <p class="err" id="eerr" hidden></p>

    <div class="grid2">
      <label class="fld"><span>Title</span><input id="f_title" value="${esc(it?.title || "")}"></label>
      <label class="fld"><span>Original title</span><input id="f_alt" value="${esc(it?.altTitle || "")}"></label>
      <label class="fld"><span>Kind</span><select id="f_kind">
        ${Object.entries(KINDS).map(([k, v]) =>
          `<option value="${k}"${k === kind ? " selected" : ""}>${v.label}</option>`).join("")}
      </select></label>
      <label class="fld"><span>Year</span><input id="f_year" type="number" min="1900" max="2100"
        value="${it?.year ?? ""}"></label>
      <label class="fld"><span id="l_creator">${creatorLabel({ kind })}</span>
        <input id="f_creator" value="${esc(it?.creator || "")}"></label>
      <label class="fld"><span>Seasons</span><input id="f_seasons" type="number" min="1"
        value="${it?.seasons ?? 1}"></label>
      <label class="fld"><span id="l_units">${unitLabel({ kind })} in total</span>
        <input id="f_units" type="number" min="1" value="${it?.units ?? 1}"></label>
      <label class="fld"><span id="l_done">Watched so far</span>
        <input id="f_done" type="number" min="0" value="${it?.done ?? 0}"></label>
      <label class="fld"><span>Status</span><select id="f_status">
        ${Object.entries(STATUSES).map(([k, v]) =>
          `<option value="${k}"${k === (it?.status || "planned") ? " selected" : ""}>${v.label}</option>`).join("")}
      </select></label>
      <label class="fld"><span>Rating out of 10</span><input id="f_rating" type="number" min="0" max="10"
        step="0.1" value="${it?.rating ?? ""}"></label>
      <label class="fld"><span>Started</span><input id="f_started" type="date" value="${it?.started || ""}"></label>
      <label class="fld"><span>Finished</span><input id="f_finished" type="date" value="${it?.finished || ""}"></label>
      <label class="fld span2"><span>Genres, comma separated</span>
        <input id="f_genres" value="${esc((it?.genres || []).join(", "))}"></label>
      <label class="fld span2"><span>Spine colour</span>
        <span class="colrow">
          <input id="f_colour" type="color" value="${colourFor(it || { kind, genres: [] })}">
          <button type="button" class="btn tiny ghost" id="autocol">Match the genre</button>
        </span></label>
      <label class="fld span2"><span>Your note</span>
        <textarea id="f_note" rows="3" placeholder="What did you make of it?">${esc(it?.note || "")}</textarea></label>
    </div>

    <div class="coverblock">
      <div class="coverprev" id="cprev"><span>No cover</span></div>
      <div class="coveracts">
        <strong>Cover art</strong>
        <p class="shelfnote">Upload your own, or let a search fill it in.</p>
        <label class="btn tiny">Upload<input type="file" id="f_cover" accept="image/*" hidden></label>
        <button class="btn tiny ghost" id="clearcover">Remove</button>
      </div>
    </div>

    <div class="pager">
      <button class="btn ghost" id="cancel">Cancel</button>
      <button class="btn" id="save">${it ? "Save changes" : "Put it on the shelf"}</button>
    </div></div>`);

  if (it) renderCover(it);
  wireForm(it, bay, kind);
}

function defaultKindFor(bay) {
  return Object.entries(KINDS).find(([, v]) => v.bay === bay)?.[0] || "anime";
}

function wireForm(it, bay, kind) {
  const relabel = () => {
    const k = val("#f_kind") || kind;
    $("#l_units").textContent = `${KINDS[k].unit} in total`;
    $("#l_creator").textContent = KINDS[k].creator;
    $("#l_done").textContent = k === "book" ? "Read so far" : "Watched so far";
    $("#f_seasons").closest(".fld").style.display = KINDS[k].seasons ? "" : "none";
  };
  $("#f_kind").addEventListener("change", relabel);
  relabel();

  $("#autocol").addEventListener("click", () => {
    const genres = val("#f_genres").split(",").map(s => s.trim()).filter(Boolean);
    $("#f_colour").value = colourFor({ genres, kind: val("#f_kind") });
  });

  $("#f_cover").addEventListener("change", e => {
    const f = e.target.files?.[0];
    if (!f) return;
    pendingCover = f;
    const url = URL.createObjectURL(f);
    $("#cprev").innerHTML = `<img src="${url}" alt="">`;
  });
  $("#clearcover").addEventListener("click", () => {
    pendingCover = null;
    $("#cprev").innerHTML = "<span>No cover</span>";
  });

  const run = () => runSearch(val("#q"), val("#f_kind"));
  $("#go").addEventListener("click", run);
  $("#q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); run(); } });

  $("#cancel").addEventListener("click", () => openManager(bay));
  $("#save").addEventListener("click", () => save(it, bay));
}

async function runSearch(q, kind) {
  const box = $("#results"), err = $("#eerr"), btn = $("#go");
  err.hidden = true;
  if (q.trim().length < 2) { box.hidden = true; return; }
  if (kind === "film" || kind === "series") {
    box.hidden = true; err.hidden = false;
    err.textContent = "Search only covers anime and manga for now — films and series need typing in by hand.";
    return;
  }
  searchAbort?.abort();
  searchAbort = new AbortController();
  setBusy(btn, true, "Search");
  box.hidden = false;
  box.innerHTML = `<p class="shelfnote">Searching…</p>`;
  try {
    const hits = await search(q, kind, searchAbort.signal);
    if (!hits.length) { box.innerHTML = `<p class="shelfnote">Nothing found. Type it in yourself below.</p>`; return; }
    box.innerHTML = hits.map((h, i) => `<button class="hit" data-i="${i}">
        ${h.coverURL ? `<img src="${esc(h.coverURL)}" alt="" loading="lazy">` : `<span class="nocov"></span>`}
        <span class="hitmain"><b>${esc(h.title)}</b>
        <em>${[h.year, h.creator, h.units ? `${h.units} ${h.kind === "book" ? "ch" : "ep"}` : ""]
          .filter(Boolean).map(esc).join(" · ")}</em></span>
      </button>`).join("");
    box.querySelectorAll(".hit").forEach(b =>
      b.addEventListener("click", () => applyHit(hits[+b.dataset.i])));
  } catch (e) {
    if (e.name === "AbortError") return;
    box.hidden = true; err.hidden = false;
    err.textContent = e instanceof CatalogError ? e.message : "Search failed. Fill the fields in by hand.";
  } finally {
    setBusy(btn, false, "Search");
  }
}

async function applyHit(h) {
  $("#f_title").value = h.title;
  $("#f_alt").value = h.altTitle || "";
  if (h.year) $("#f_year").value = h.year;
  if (h.creator) $("#f_creator").value = h.creator;
  if (h.units) $("#f_units").value = h.units;
  if (h.genres?.length) $("#f_genres").value = h.genres.join(", ");
  if (KINDS[h.kind]) $("#f_kind").value = h.kind;
  $("#f_kind").dispatchEvent(new Event("change"));
  $("#f_colour").value = h.colour && /^#[0-9a-f]{6}$/i.test(h.colour)
    ? h.colour : colourFor({ genres: h.genres || [], kind: h.kind });
  $("#results").hidden = true;

  if (!h.coverURL) return;
  $("#cprev").innerHTML = `<img src="${esc(h.coverURL)}" alt="">`;
  const got = await fetchCover(h.coverURL);
  if (got.blob) {
    pendingCover = got.blob;
  } else {
    // keep the link so the page still shows art, and say why the shelf can't
    pendingCover = h.coverURL;
    const err = $("#eerr");
    err.hidden = false;
    err.textContent = `Cover linked, but ${got.reason} — so it can show on this page, not on the 3D spine. Upload the image to use it there too.`;
  }
}

async function save(existing, bay) {
  const btn = $("#save"), err = $("#eerr");
  const title = val("#f_title");
  if (!title) { err.hidden = false; err.textContent = "It needs a title."; return; }
  setBusy(btn, true, existing ? "Save changes" : "Put it on the shelf");
  try {
    const item = await store.put({
      id: existing?.id,
      kind: val("#f_kind"),
      title,
      altTitle: val("#f_alt"),
      year: val("#f_year") || null,
      creator: val("#f_creator"),
      seasons: val("#f_seasons") || 1,
      units: val("#f_units") || 1,
      done: val("#f_done") || 0,
      status: val("#f_status"),
      rating: val("#f_rating") || null,
      genres: val("#f_genres").split(",").map(s => s.trim()).filter(Boolean),
      colour: val("#f_colour") || null,
      started: val("#f_started") || null,
      finished: val("#f_finished") || null,
      note: $("#f_note").value.trim(),
      cover: existing?.cover ?? null
    });
    if (pendingCover !== undefined) await store.setCover(item.id, pendingCover);
    openManager(bayOf(item) || bay);
    flash(existing ? "Saved." : "Added to the shelf.");
  } catch (e) {
    console.error(e);
    err.hidden = false; err.textContent = "Couldn't save that. " + (e.message || "");
  } finally {
    setBusy(btn, false, existing ? "Save changes" : "Put it on the shelf");
  }
}

async function renderCover(it) {
  const url = await store.coverURL(it);
  const box = $("#cprev");
  if (box) box.innerHTML = url ? `<img src="${esc(url)}" alt="">` : "<span>No cover</span>";
}

let flashTimer = null;
export function flash(msg, bad = false) {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = bad ? "bad on" : "on";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove("on"), 2600);
}

export { close };
