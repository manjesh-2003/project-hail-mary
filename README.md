# project-hail-mary

A hub of friends to share their media consumption. Everyone gets their own 3D room;
what you've watched sits on the shelves as books you can pull out and read.

Right now there is one room — **Sid's loft**. What's on its shelves is yours to edit,
and once you sign in it follows you between devices and your friends can look at it
from theirs.

## Running it

```bash
npm install
npm run build          # writes docs/index.html
```

`docs/index.html` is a single self-contained file. Open it directly, serve it from
GitHub Pages, drop it on any static host — it needs no server and no build step at
the other end. That's deliberate: it also means it survives being emailed to a friend.

```bash
npm run check          # headless render + interaction smoke test
```

The check needs Playwright and a Chromium binary. Point `CHROMIUM` at one if it isn't
at `/opt/pw-browsers/chromium`.

## Layout

```
src/
  main.js              wires the room, the character and the panels together
  shell.html           page chrome: CSS, HUD, loading card, panel container
  core/
    engine.js          renderer, scene, camera, frame loop, click registry
    player.js          the blocky character, walking, collision, camera rig
    textures.js        every surface, drawn on a canvas at runtime
    panels.js          the paper UI that opens over the room
    editor.js          add, edit and delete what's on the shelves
    store.js           the data layer: one API, swappable storage underneath
    catalog.js         AniList lookup, so you don't type it all in
    mood.js            the light switch, including lights-out
    photos.js          the photo wall: upload, downscale, remember
    config.js          which database, if any (empty = local only)
    adapters/
      indexeddb.js     local storage: records and cover images
      supabase.js      shared storage: the same API, over the network
  data/
    schema.js          one Item shape for anime, films, series and books
    seed.js            what a brand-new shelf starts with
  rooms/
    sid-loft.js        this room's geometry and furniture
supabase/
  schema.sql           tables, storage bucket and access rules
  patch-001.sql        fixes for a project created before schema.sql settled
  README.md            how to turn syncing on — a one-off, about ten minutes
tools/
  check.mjs            headless checks; screenshots land in tools/shots/
  check-store.mjs      add/edit/delete round-trips and shelf rebuild
docs/                  the built page — GitHub Pages serves this folder
```

Adding a room means one new file in `src/rooms/` and one line in `build.mjs`.
Everything under `core/` is shared, so a fix to how books open fixes it everywhere.

## In the room

- **Walk** by clicking the floor. Drag to look, scroll to zoom, WASD if you prefer.
- **Books** on the lit alcove are the anime; click one to open its page.
- **The monitor** shows what's playing; **the TV** shows the totals.
- **The stairs** in the floor will lead to the street, once other rooms exist.
- **The skylight** over the raised deck: climb the steps, click it, lie back.
- **The photo wall** takes your own pictures — resized in-browser, kept in
  `localStorage` on that device only. Nobody else sees them yet.
- **The light switch** recolours every LED in the room, or turns everything off.
- **✎ Shelves** in the corner opens the editor: add, change or remove anything,
  search AniList to fill a title in, and upload your own cover art.

## The data layer

Everything reads and writes through `core/store.js`, never storage directly. There are
two adapters behind it and the app picks at startup: signed in to a configured project,
it uses the shared database; otherwise IndexedDB on this device. Nothing above the store
knows or cares which.

`core/config.js` names the project — see [`supabase/README.md`](supabase/README.md).
The two values in it are safe in a public repo, because the database itself decides who
may write what. The **secret** key never is.

One `Item` shape covers every kind of thing on the shelves. An anime, a film and a book
differ only in what the numbers are called, so `data/schema.js` holds the labels and the
record stays the same.

Cover art is stored as our own copy rather than a link to someone else's server. A link
would break when that server moves, and a 3D texture needs permission to read the pixels
that a lot of image hosts don't give. Auto-filled covers are best-effort for that reason;
uploading one always works.

## Known gaps

- The shared adapter is new. It has been run against the real database, but not by
  four people at once.
- Cover art uploads go to the `covers` bucket, which is public to read. Anyone with
  the URL can see a cover; nobody can guess one.
- The street still shows placeholders rather than real people.
- Search covers anime and manga. Films and series have to be typed in for now.
- The street has nowhere to go until there's a second room and accounts.
