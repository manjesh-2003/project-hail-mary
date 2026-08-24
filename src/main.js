import * as THREE from "three";
import { S, $, initEngine, startLoop } from "./core/engine.js";
import { createPlayer, createRig, bindControls, groundY } from "./core/player.js";
import { buildSwitch } from "./core/mood.js";
import { initPhotos, openPhoto } from "./core/photos.js";
import {
  initPanels, isOpen, openBook, openNowPlaying, openStats,
  openBay, openWombats, openStreet, openManager, openEditor
} from "./core/panels.js";
import * as store from "./core/store.js";
import { ROOM_OWNER } from "./data/seed.js";
import { buildRoom, roofY, hotspots, routes, skylightAnchor, pokeWombats } from "./rooms/sid-loft.js";

/* The raised deck is only reachable by its steps, so a destination on the
   other level has to be prefixed with the stair route or the character
   just walks into the skirt and gives up. */
const LEVEL = .5;
function routeTo(x, z) {
  const here = groundY(player.pos.x, player.pos.z);
  const there = groundY(x, z);
  if (here > LEVEL && there <= LEVEL) return [...routes.down, [x, z]];
  if (here <= LEVEL && there > LEVEL) return [...routes.up, [x, z]];
  return [[x, z]];
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let player, rig, keyStep, hovered = null;

const HINT = {
  book:   o => `<b>${store.get(o.userData.id)?.title || "A book"}</b> — walk over and open it`,
  screen: () => `<b>The monitor</b> — what's playing right now`,
  tv:     () => `<b>The TV</b> — the count so far`,
  wombat: () => `<b>Pip &amp; Barrel</b> — go and say hello`,
  stairs: () => `<b>Down the stairs</b> — the street, and everyone else's loft`,
  sky:    () => `<b>The skylight</b> — climb up and lie back`,
  bay:    o => `<b>${o.userData.bay === "books" ? "Books" : "Movies &amp; series"}</b> — an empty bay`,
  photo:  () => `<b>Photo wall</b> — put your own pictures up`
};
const DEFAULT_HINT = "Click the floor to walk · drag to look · scroll to zoom · click anything to use it";
const hint = () => $("#hint");

/* ── stargazing ────────────────────────────── */
const sky = { yaw0: 0, pitch0: 0, base: null };

function enterSky() {
  // sit just *inside* the glass, looking straight out along the roof normal,
  // so the skylight frames the sky instead of the camera ending up on the roof
  const { center, normal } = skylightAnchor();
  const pos = center.clone().addScaledVector(normal, -1.35);
  const look = center.clone().addScaledVector(normal, 12);
  S.mode = "sky";
  rig.enabled = false;
  player.stop();
  player.obj.visible = false;
  sky.base = { pos, dir: look.clone().sub(pos).normalize() };
  sky.yaw0 = rig.yaw; sky.pitch0 = rig.pitch;
  S.camera.position.copy(pos);
  S.camera.lookAt(look);
  document.body.classList.add("skymode");
  $("#skyexit").hidden = false;
  hint().innerHTML = "Drag to look around the sky";
}

function exitSky() {
  S.mode = "room";
  rig.enabled = true;
  player.obj.visible = true;
  document.body.classList.remove("skymode");
  $("#skyexit").hidden = true;
  hint().innerHTML = DEFAULT_HINT;
}

/* ── picking ───────────────────────────────── */
function pick(cx, cy) {
  if (isOpen()) return;
  ndc.x = (cx / innerWidth) * 2 - 1;
  ndc.y = -(cy / innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, S.camera);

  const hit = raycaster.intersectObjects(S.clickable, false)[0];
  if (hit) return use(hit.object);

  // otherwise: walk to wherever the floor was clicked
  const spot = raycaster.intersectObjects(S.walkable, false)[0];
  if (!spot) return;
  const p = spot.point;
  player.goto(routeTo(p.x, p.z));
}

function use(o) {
  const kind = o.userData.kind;
  const key = kind === "bay" ? `bay_${o.userData.bay}` : kind;
  const spot = hotspots[key] || hotspots[kind];
  const open = () => {
    if (kind === "book") openBook(o.userData.id);
    else if (kind === "screen") openNowPlaying();
    else if (kind === "tv") openStats();
    else if (kind === "wombat") { pokeWombats(); openWombats(); }
    else if (kind === "stairs") openStreet();
    else if (kind === "bay") openBay(o.userData.bay);
    else if (kind === "photo") openPhoto(o.userData.index);
    else if (kind === "sky") enterSky();
  };
  if (!spot) return open();
  const near = Math.hypot(player.pos.x - spot.stand[0], player.pos.z - spot.stand[1]) < .85
    && Math.abs(groundY(player.pos.x, player.pos.z) - groundY(spot.stand[0], spot.stand[1])) < .3;
  if (near) return open();
  player.goto(spot.path ? spot.path : routeTo(spot.stand[0], spot.stand[1]), open);
}

/* ── hover ─────────────────────────────────── */
function updateHover() {
  if (S.mode !== "room" || isOpen()) return;
  raycaster.setFromCamera(ndc, S.camera);
  const hit = raycaster.intersectObjects(S.clickable, false)[0];
  const o = hit ? hit.object : null;
  if (o === hovered) return;
  if (hovered?.userData.kind === "book") hovered.position.z = hovered.userData.baseZ;
  hovered = o;
  if (o?.userData.kind === "book") o.position.z = o.userData.baseZ + .07;
  S.renderer.domElement.style.cursor = o ? "pointer" : "default";
  hint().innerHTML = o ? HINT[o.userData.kind](o) : DEFAULT_HINT;
}

/* ── go ────────────────────────────────────── */
async function start() {
  try {
    initEngine($("#gl"));
    initPanels();
    initPhotos();
    await store.init();
    buildRoom();

    player = createPlayer(S.scene);
    rig = createRig(S.camera, player, roofY);
    keyStep = bindControls(rig, player, pick);
    buildSwitch();

    if (new URLSearchParams(location.search).has("debug"))
      window.__phm = { S, player, rig, use, pick, enterSky, exitSky, THREE, store, openManager, openEditor };

    $("#owner").textContent = `${ROOM_OWNER}'s Loft`;
    const setCount = () => {
      const n = store.count();
      $("#count").textContent = `${n} ${n === 1 ? "volume" : "volumes"}`;
    };
    setCount(); store.onChange(setCount);
    $("#shelfbtn").addEventListener("click", () => openManager());
    $("#skyexit").addEventListener("click", exitSky);
    addEventListener("keydown", e => { if (e.key === "Escape" && S.mode === "sky") exitSky(); });
    addEventListener("pointermove", e => {
      ndc.x = (e.clientX / innerWidth) * 2 - 1;
      ndc.y = -(e.clientY / innerHeight) * 2 + 1;
    });

    startLoop((t, dt) => {
      if (S.mode === "room") {
        keyStep(dt);
        player.update(dt);
        rig.update(dt);
        updateHover();
      } else {
        // drag pans across the sky; a slow drift keeps it alive while you lie there
        const b = sky.base;
        S.camera.position.copy(b.pos);
        const dir = b.dir.clone();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (rig.yaw - sky.yaw0) * .9);
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        dir.applyAxisAngle(right, THREE.MathUtils.clamp((rig.pitch - sky.pitch0) * .9, -.85, .85));
        dir.x += Math.sin(t * .12) * .012;
        dir.z += Math.cos(t * .09) * .012;
        S.camera.lookAt(b.pos.clone().addScaledVector(dir, 12));
      }
    });
  } catch (err) {
    console.error(err);
    const l = $("#load");
    if (l) l.innerHTML = `<div class="loadinner"><h1>This room needs WebGL</h1>
      <p>Your browser couldn't start 3D graphics. Try a different browser, or turn on
      hardware acceleration in settings.</p></div>`;
  }
}

if (document.fonts?.ready) document.fonts.ready.then(start).catch(start);
else start();
