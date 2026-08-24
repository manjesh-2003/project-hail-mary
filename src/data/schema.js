/* One shape for everything on the shelves.

   An anime, a film, a series and a book differ only in what the numbers are
   called, so the record is the same and each KIND supplies its own labels.
   Keeping one shape means the editor, the spines and the detail page are all
   written once. */

export const KINDS = {
  anime:  { bay: "anime",  label: "Anime",  unit: "Episodes", unitOne: "Episode", creator: "Studio",    seasons: true },
  film:   { bay: "screen", label: "Film",   unit: "Runtime",  unitOne: "Minute",  creator: "Director",  seasons: false },
  series: { bay: "screen", label: "Series", unit: "Episodes", unitOne: "Episode", creator: "Network",   seasons: true },
  book:   { bay: "books",  label: "Book",   unit: "Chapters", unitOne: "Chapter", creator: "Author",    seasons: false }
};

export const STATUSES = {
  watching: { label: "In progress",   stamp: "IN PROGRESS", col: "#C07A24" },
  done:     { label: "Finished",      stamp: "COMPLETED",   col: "#4F7C5E" },
  planned:  { label: "On the pile",   stamp: "ON THE PILE", col: "#6E6678" },
  dropped:  { label: "Set aside",     stamp: "SET ASIDE",   col: "#8E4034" }
};

export const GENRE_COLOUR = {
  Action: "#8E3B30", Adventure: "#245C58", Comedy: "#9A6A24", Drama: "#5A3B62",
  Fantasy: "#2F5A46", Horror: "#3A2F3A", Mystery: "#3A3542", Psychological: "#4A3550",
  Romance: "#8A4258", "Sci-Fi": "#2B475E", Thriller: "#3A3542", Sports: "#2F6E4A",
  Slice_of_Life: "#6B6A32", Music: "#5B4A78", Supernatural: "#43356A", Documentary: "#4A5560"
};
const FALLBACK_COLOUR = "#5A4536";

export function colourFor(item) {
  if (item.colour) return item.colour;
  for (const g of item.genres || []) {
    const key = g.replace(/\s+/g, "_");
    if (GENRE_COLOUR[g] || GENRE_COLOUR[key]) return GENRE_COLOUR[g] || GENRE_COLOUR[key];
  }
  return FALLBACK_COLOUR;
}

let counter = 0;
export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `it_${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

/* Fill in anything missing so the rest of the app never has to null-check. */
export function normalise(raw = {}) {
  const kind = KINDS[raw.kind] ? raw.kind : "anime";
  const units = num(raw.units, 1);
  const item = {
    id: raw.id || newId(),
    kind,
    title: (raw.title || "Untitled").trim(),
    altTitle: (raw.altTitle || "").trim(),
    year: raw.year == null || raw.year === "" ? null : num(raw.year, null),
    creator: (raw.creator || "").trim(),
    seasons: KINDS[kind].seasons ? (raw.seasons ?? 1) : null,
    units,
    done: clamp(num(raw.done, 0), 0, Math.max(units, 1)),
    status: STATUSES[raw.status] ? raw.status : "planned",
    rating: raw.rating == null || raw.rating === "" ? null : clamp(num(raw.rating, 0), 0, 10),
    genres: Array.isArray(raw.genres) ? raw.genres.filter(Boolean).slice(0, 6) : [],
    colour: raw.colour || null,
    started: raw.started || null,
    finished: raw.finished || null,
    note: (raw.note || "").trim(),
    cover: raw.cover || null,          // { kind:"blob", blobId } | { kind:"url", url }
    source: raw.source || null,        // { provider, id } when it came from a catalogue
    order: num(raw.order, 0),
    updatedAt: raw.updatedAt || Date.now()
  };
  // a finished thing has, by definition, been finished
  if (item.status === "done") item.done = item.units;
  if (item.status === "planned") item.done = 0;
  return item;
}

const num = (v, d) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const progress = it => (it.units > 0 ? it.done / it.units : 0);
export const unitLabel = it => KINDS[it.kind].unit;
export const creatorLabel = it => KINDS[it.kind].creator;
export const bayOf = it => KINDS[it.kind].bay;

/* Spine thickness. Episode counts vary from 1 to 1000+, so it's logarithmic —
   and a film gets a floor so it doesn't come out as a sheet of paper. */
export function spineWidth(it) {
  const n = it.kind === "film" ? 6 : Math.max(1, it.units);
  return 0.038 + 0.014 * Math.log2(1 + n / 10);
}
