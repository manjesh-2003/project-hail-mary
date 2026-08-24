# project-hail-mary

A hub of friends to share their media consumption. Everyone gets their own 3D room;
what you've watched sits on the shelves as books you can pull out and read.

Right now there is one room — **Sid's loft** — and the records in it are placeholder
samples. AniList and saving come next.

## Running it

```bash
npm install
npm run build          # writes dist/sid-loft.html
```

`dist/sid-loft.html` is a single self-contained file. Open it directly, serve it from
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
    mood.js            the light switch, including lights-out
    photos.js          the photo wall: upload, downscale, remember
  data/
    library.js         the catalogue, and which shelf bay owns what
  rooms/
    sid-loft.js        this room's geometry and furniture
tools/
  check.mjs            headless checks; screenshots land in tools/shots/
dist/                  built pages (committed, so hosting is just "push")
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

## Known gaps

- No persistence beyond the photo wall. Refresh and the shelf is the sample again.
- Cover art on the screens is generated, not real artwork.
- The street has nowhere to go until there's a second room and accounts.
