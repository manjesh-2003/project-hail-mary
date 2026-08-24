/* Look a title up instead of typing it all in.

   AniList's public GraphQL needs no key and no account, which is why it's
   first. Films and books get their own providers later — the shape returned
   here is deliberately provider-agnostic so adding one is a new `search`
   function and nothing else. */

const ANILIST = "https://graphql.anilist.co";

const SEARCH = `
query ($q: String, $type: MediaType) {
  Page(perPage: 8) {
    media(search: $q, type: $type, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      format
      seasonYear
      episodes
      chapters
      volumes
      genres
      coverImage { large color }
      studios(isMain: true) { nodes { name } }
      staff(perPage: 1) { nodes { name { full } } }
    }
  }
}`;

export class CatalogError extends Error {}

async function gql(query, variables, signal) {
  let res;
  try {
    res = await fetch(ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      signal
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new CatalogError("Couldn't reach AniList. Check your connection, or fill the fields in by hand.");
  }
  if (res.status === 429) throw new CatalogError("AniList is rate-limiting us. Wait a minute and try again.");
  if (!res.ok) throw new CatalogError(`AniList returned ${res.status}. Try again, or fill the fields in by hand.`);
  const json = await res.json();
  if (json.errors?.length) throw new CatalogError(json.errors[0].message || "AniList rejected that query.");
  return json.data;
}

/* kind is ours ("anime" | "book"); AniList calls them ANIME and MANGA */
export async function search(q, kind = "anime", signal) {
  const term = (q || "").trim();
  if (term.length < 2) return [];
  const type = kind === "book" ? "MANGA" : "ANIME";
  const data = await gql(SEARCH, { q: term, type }, signal);
  return (data?.Page?.media || []).map(m => toResult(m, kind));
}

function toResult(m, kind) {
  const title = m.title?.english || m.title?.romaji || m.title?.native || "Untitled";
  const alt = [m.title?.native, m.title?.romaji].find(t => t && t !== title) || "";
  const units = kind === "book"
    ? (m.chapters || m.volumes || 1)
    : (m.episodes || (m.format === "MOVIE" ? 1 : 1));
  return {
    provider: "anilist",
    providerId: m.id,
    kind: m.format === "MOVIE" ? "film" : kind,
    title,
    altTitle: alt,
    year: m.seasonYear || null,
    creator: m.studios?.nodes?.[0]?.name || m.staff?.nodes?.[0]?.name?.full || "",
    units,
    seasons: 1,
    genres: (m.genres || []).slice(0, 4),
    colour: m.coverImage?.color || null,
    coverURL: m.coverImage?.large || null,
    format: m.format || null
  };
}

/* Try to take our own copy of the cover.

   This is best-effort on purpose: reading someone else's image as bytes needs
   their CORS blessing, and a 3D texture needs the bytes. If it's refused we
   keep the URL for the flat panel and let the person upload one for the spine,
   rather than pretending it worked. */
export async function fetchCover(url, signal) {
  if (!url) return { blob: null, url: null, reason: "no image" };
  try {
    const res = await fetch(url, { mode: "cors", signal });
    if (!res.ok) return { blob: null, url, reason: `image request returned ${res.status}` };
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return { blob: null, url, reason: "not an image" };
    return { blob, url, reason: null };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    return { blob: null, url, reason: "the image host doesn't allow cross-origin reads" };
  }
}
