import * as THREE from "three";
import { S, $ } from "./engine.js";
import { skinTexture } from "./textures.js";

/* ══════════════════════════════════════════════
   A blocky character you send places by clicking,
   with a third-person camera that follows.
   ══════════════════════════════════════════════ */

export const world = {
  bounds: { x0: -3.85, x1: 3.85, z0: -6.1, z1: 6.1 },
  blocks: [],   // {x0,x1,z0,z1} you cannot stand in
  steps: []     // {x0,x1,z0,z1, y0,y1, axis:'z'|'x'} raised ground: ramps and decks
};

export const RADIUS = .26;

/* ground height at a point — 0 unless inside a ramp or deck */
export function groundY(x, z) {
  let h = 0;
  for (const s of world.steps) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    let y;
    if (s.axis === "z") {
      const t = (z - s.z0) / (s.z1 - s.z0);
      y = s.y0 + (s.y1 - s.y0) * t;
    } else if (s.axis === "x") {
      const t = (x - s.x0) / (s.x1 - s.x0);
      y = s.y0 + (s.y1 - s.y0) * t;
    } else y = s.y1;
    if (y > h) h = y;
  }
  return h;
}

function inBlock(x, z) {
  for (const b of world.blocks)
    if (x > b.x0 - RADIUS && x < b.x1 + RADIUS && z > b.z0 - RADIUS && z < b.z1 + RADIUS) return true;
  return false;
}

/* If you somehow end up inside a piece of furniture, every neighbouring
   square is illegal too and you'd be trapped forever. Detect that and let
   the move through so you can walk back out. */
export const isStuck = (x, z) => inBlock(x, z);

/* A move is legal when it stays in the room, clear of furniture, and the
   ground doesn't jump — which is what keeps you on the stairs instead of
   stepping straight up onto the platform or off its edge. */
export function canStand(fromY, x, z) {
  const b = world.bounds;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false;
  if (inBlock(x, z)) return false;
  return Math.abs(groundY(x, z) - fromY) <= .30;
}

export function createPlayer(scene) {
  const g = new THREE.Group();
  const px = (m, w, h, d, y) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    box.position.y = y; box.castShadow = true; box.receiveShadow = true;
    g.add(box); return box;
  };
  const skinFace = skinTexture("face"), skinHair = skinTexture("hair");
  const shirt = new THREE.MeshStandardMaterial({ map: skinTexture("shirt"), roughness: .92 });
  const jeans = new THREE.MeshStandardMaterial({ map: skinTexture("jeans"), roughness: .95 });
  const bare = new THREE.MeshStandardMaterial({ color: "#D9A57E", roughness: .9 });
  const headMats = [
    new THREE.MeshStandardMaterial({ map: skinHair, roughness: .9 }),
    new THREE.MeshStandardMaterial({ map: skinHair, roughness: .9 }),
    new THREE.MeshStandardMaterial({ map: skinHair, roughness: .9 }),
    new THREE.MeshStandardMaterial({ map: skinHair, roughness: .9 }),
    new THREE.MeshStandardMaterial({ map: skinFace, roughness: .9 }),
    new THREE.MeshStandardMaterial({ map: skinHair, roughness: .9 })
  ];

  const legL = px(jeans, .17, .56, .19, .28);
  const legR = px(jeans, .17, .56, .19, .28);
  legL.position.x = -.10; legR.position.x = .10;
  legL.geometry.translate(0, -.28, 0); legR.geometry.translate(0, -.28, 0);
  legL.position.y = .56; legR.position.y = .56;

  px(shirt, .40, .52, .22, .82);
  const armL = px(bare, .13, .52, .16, .82), armR = px(bare, .13, .52, .16, .82);
  armL.position.x = -.265; armR.position.x = .265;
  armL.geometry.translate(0, -.26, 0); armR.geometry.translate(0, -.26, 0);
  armL.position.y = 1.08; armR.position.y = 1.08;
  [armL, armR].forEach(a => a.material = shirt);

  const head = new THREE.Mesh(new THREE.BoxGeometry(.34, .34, .34), headMats);
  head.position.y = 1.25; head.castShadow = true; g.add(head);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.26, 20),
    new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: .28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .012; g.add(shadow);

  scene.add(g);

  const p = {
    obj: g, head, legL, legR, armL, armR,
    pos: new THREE.Vector3(1.4, 0, 4.4),
    movedByKeys: false,
    yaw: Math.PI,
    queue: [], onArrive: null, walked: 0, speed: 2.35,
    get y() { return groundY(this.pos.x, this.pos.z); }
  };

  p.goto = (points, cb) => {
    p.queue = points.map(([x, z]) => new THREE.Vector2(x, z));
    p.onArrive = cb || null;
  };
  p.stop = () => { p.queue.length = 0; p.onArrive = null; };

  p.update = dt => {
    const target = p.queue[0];
    let moving = p.movedByKeys;
    p.movedByKeys = false;
    // Walk in short hops rather than one big jump, so a slow frame can't
    // carry the character straight through a piece of furniture.
    if (target) {
      let budget = p.speed * dt;
      let guard = 64;
      while (budget > 1e-4 && p.queue.length && guard-- > 0) {
        const tgt = p.queue[0];
        const dx = tgt.x - p.pos.x, dz = tgt.y - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < .10) {
          p.queue.shift();
          if (!p.queue.length && p.onArrive) { const fn = p.onArrive; p.onArrive = null; fn(); }
          continue;
        }
        const step = Math.min(budget, d, .12);
        const ux = dx / d, uz = dz / d;
        const y0 = groundY(p.pos.x, p.pos.z);
        let nx = p.pos.x + ux * step, nz = p.pos.z + uz * step;
        if (!canStand(y0, nx, nz)) {
          if (canStand(y0, nx, p.pos.z)) nz = p.pos.z;
          else if (canStand(y0, p.pos.x, nz)) nx = p.pos.x;
          else if (!isStuck(p.pos.x, p.pos.z)) { p.stop(); break; }
        }
        if (nx === p.pos.x && nz === p.pos.z) break;
        p.pos.x = nx; p.pos.z = nz;
        p.walked += step; budget -= step; moving = true;
        const want = Math.atan2(ux, uz);
        let diff = want - p.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.yaw += diff * Math.min(1, dt * 12);
      }
    }
    const gy = groundY(p.pos.x, p.pos.z);
    p.pos.y += (gy - p.pos.y) * Math.min(1, dt * 14);
    g.position.copy(p.pos);
    g.rotation.y = p.yaw;

    const sw = moving ? Math.sin(p.walked * 5.4) * .62 : 0;
    p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
    p.armL.rotation.x = -sw * .8; p.armR.rotation.x = sw * .8;
    g.position.y += moving ? Math.abs(Math.sin(p.walked * 5.4)) * .022 : 0;
  };

  return p;
}

/* ── third-person camera rig ───────────────── */
export function createRig(camera, player, roofY) {
  const rig = {
    yaw: Math.PI, pitch: .30, dist: 3.6,
    minDist: .45, maxDist: 7.5,
    target: new THREE.Vector3(),
    enabled: true
  };

  rig.update = dt => {
    if (!rig.enabled) return;
    const focus = rig.target.set(player.pos.x, player.pos.y + 1.28, player.pos.z);
    const cp = Math.cos(rig.pitch);
    let x = focus.x - Math.sin(rig.yaw) * cp * rig.dist;
    let z = focus.z - Math.cos(rig.yaw) * cp * rig.dist;
    let y = focus.y + Math.sin(rig.pitch) * rig.dist;

    // keep the camera inside the shell
    const b = world.bounds;
    x = THREE.MathUtils.clamp(x, b.x0 - .35, b.x1 + .35);
    z = THREE.MathUtils.clamp(z, b.z0 - .35, b.z1 + .35);
    y = THREE.MathUtils.clamp(y, .45, Math.min(3.45, roofY(x) - .12));

    camera.position.lerp(new THREE.Vector3(x, y, z), Math.min(1, dt * 14));
    camera.lookAt(focus);
  };
  return rig;
}

/* pointer: drag to look, wheel to zoom, tap to go */
export function bindControls(rig, player, onPick) {
  const el = S.renderer.domElement;
  let down = null, dragged = false, pinch = 0;

  el.addEventListener("pointerdown", e => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged = false;
    el.setPointerCapture?.(e.pointerId);
  });

  el.addEventListener("pointermove", e => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!dragged && Math.hypot(dx, dy) > 6) dragged = true;
    if (!dragged) return;
    rig.yaw -= dx * .0055;
    rig.pitch = THREE.MathUtils.clamp(rig.pitch + dy * .004, -.28, 1.32);
    down.x = e.clientX; down.y = e.clientY;
  });

  el.addEventListener("pointerup", e => {
    if (!down || e.pointerId !== down.id) return;
    const wasDrag = dragged;
    down = null; dragged = false;
    if (!wasDrag) onPick(e.clientX, e.clientY);
  });
  el.addEventListener("pointercancel", () => { down = null; dragged = false; });

  el.addEventListener("wheel", e => {
    e.preventDefault();
    rig.dist = THREE.MathUtils.clamp(rig.dist + Math.sign(e.deltaY) * .32, rig.minDist, rig.maxDist);
  }, { passive: false });

  // pinch zoom
  const pts = new Map();
  el.addEventListener("pointerdown", e => pts.set(e.pointerId, e));
  el.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch) rig.dist = THREE.MathUtils.clamp(rig.dist - (d - pinch) * .006, rig.minDist, rig.maxDist);
      pinch = d;
    }
  });
  const clear = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  el.addEventListener("pointerup", clear);
  el.addEventListener("pointercancel", clear);

  // keyboard: WASD nudges the character, arrows swing the camera
  const keys = new Set();
  addEventListener("keydown", e => {
    if ($("#scrim").classList.contains("on")) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(k) || e.key.startsWith("Arrow")) {
      keys.add(e.key.startsWith("Arrow") ? e.key : k);
      player.stop();
      e.preventDefault();
    }
  });
  addEventListener("keyup", e => keys.delete(e.key.startsWith("Arrow") ? e.key : e.key.toLowerCase()));
  addEventListener("blur", () => keys.clear());

  return (dt) => {
    if (!keys.size || S.mode !== "room") return;
    if (keys.has("ArrowLeft")) rig.yaw += dt * 1.6;
    if (keys.has("ArrowRight")) rig.yaw -= dt * 1.6;
    let mf = 0, ms = 0;
    if (keys.has("w") || keys.has("ArrowUp")) mf += 1;
    if (keys.has("s") || keys.has("ArrowDown")) mf -= 1;
    if (keys.has("a")) ms -= 1;
    if (keys.has("d")) ms += 1;
    if (!mf && !ms) return;
    const sin = Math.sin(rig.yaw), cos = Math.cos(rig.yaw);
    let dx = sin * mf + cos * ms, dz = cos * mf - sin * ms;
    const n = Math.hypot(dx, dz) || 1;
    dx /= n; dz /= n;
    const step = player.speed * dt;
    const y0 = groundY(player.pos.x, player.pos.z);
    let nx = player.pos.x + dx * step, nz = player.pos.z + dz * step;
    if (!canStand(y0, nx, nz)) {
      if (canStand(y0, nx, player.pos.z)) nz = player.pos.z;
      else if (canStand(y0, player.pos.x, nz)) nx = player.pos.x;
      else if (!isStuck(player.pos.x, player.pos.z)) return;
    }
    player.pos.x = nx; player.pos.z = nz;
    player.walked += step;
    player.movedByKeys = true;
    player.yaw = Math.atan2(dx, dz);
  };
}
