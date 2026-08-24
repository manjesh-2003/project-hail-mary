import * as THREE from "three";
import { S, orient, addClickable, onFrame } from "../core/engine.js";
import { world } from "../core/player.js";
import { registerStrip, registerLight, registerLamp, registerAmbient } from "../core/mood.js";
import { registerFrame } from "../core/photos.js";
import * as store from "../core/store.js";
import { colourFor, spineWidth, KINDS } from "../data/schema.js";
import { BAYS } from "../data/seed.js";
import {
  cv, tex, rnd, pick, woodTexture, brickTexture, plasterTexture, fabricTexture,
  plainRugTexture, indianRugTexture, spineTexture, screenTexture, tvTexture,
  skyTexture, moonTexture, snowSprite, leafSprite, plaqueTexture
} from "../core/textures.js";

/* ══════════════ Sid's loft ══════════════ */

export const R = { HW: 4.2, D: 13.0, KNEE: 1.58, RIDGE: 3.72 };
export const SLOPE_LEN = Math.hypot(R.HW, R.RIDGE - R.KNEE);
export const roofY = x => R.KNEE + (1 - Math.min(Math.abs(x), R.HW) / R.HW) * (R.RIDGE - R.KNEE);

const UP_L = new THREE.Vector3(R.HW, R.RIDGE - R.KNEE, 0).normalize();   // up the left slope
const UP_R = new THREE.Vector3(-R.HW, R.RIDGE - R.KNEE, 0).normalize();
const ALONG = new THREE.Vector3(0, 0, 1);

/* skylights, in slope-local coords: u along the room, v up the slope */
const SKYLIGHTS = [
  { u: 1.40, v: 2.55, w: 2.90, h: 2.0 },
  { u: -2.93, v: 2.50, w: 1.90, h: 1.8, clear: true }   // the stargazing one
];

export const WELL = { x0: -1.30, x1: .40, z0: 3.80, z1: 5.75 };
export const DECK = { x0: -4.14, x1: -1.15, z0: -3.58, z1: -2.28, y: 1.30 };
export const STAIR = { x0: -4.16, x1: -3.24, z0: -5.20, z1: -3.58 };

export const hotspots = {};   // kind -> { stand:[x,z], path?:[[x,z]…] }
export const routes = { up: [], down: [] };   // between floor and raised deck
const MATS = {};
let screenMesh, screenIdx = 0, screenTimer = 0, tvMesh = null;

/* Placeholders so the screens never render an empty card. */
const BLANK = { title: "Nothing on", altTitle: "", year: "", creator: "the shelf",
  units: 1, done: 0, genres: [], colour: "#3A3542", kind: "anime" };
const nowPlaying = () => {
  const w = store.all().filter(i => i.status === "watching");
  return w.length ? w : [BLANK];
};
const upNext = () =>
  store.all().find(i => i.status === "planned") || store.all()[0] || BLANK;

const block = (x0, x1, z0, z1) => world.blocks.push({ x0, x1, z0, z1 });

export function skylightAnchor() {
  const c = new THREE.Vector3(-R.HW, R.KNEE, 0)
    .addScaledVector(UP_L, SKYLIGHTS[1].v)
    .addScaledVector(ALONG, SKYLIGHTS[1].u);
  const normal = new THREE.Vector3(-UP_L.y, UP_L.x, 0);   // outward, up and to the left
  return { center: c, normal };
}

export function buildRoom() {
  buildShell();
  buildTrusses();
  buildSkyAndSnow();
  buildDesk();
  buildGableWall();
  buildCollection();
  buildBays();
  buildSeating();
  buildSofaLamp();
  buildEaves();
  buildPhotoWall();
  buildBed();
  buildStargazing();
  buildStairwell();
  buildWombats();
  buildGreenery();
  buildLights();
}

/* ── shell ─────────────────────────────────── */
function buildShell() {
  const oak = new THREE.MeshStandardMaterial({
    map: tex(woodTexture("#C9A177", "#9C7448", 9), 3, 7), roughness: .62
  });

  const fs = new THREE.Shape();
  fs.moveTo(-R.HW, -R.D / 2); fs.lineTo(R.HW, -R.D / 2);
  fs.lineTo(R.HW, R.D / 2); fs.lineTo(-R.HW, R.D / 2); fs.lineTo(-R.HW, -R.D / 2);
  const hole = new THREE.Path();          // shape-y maps to world -z after rotation
  hole.moveTo(WELL.x0, -WELL.z1); hole.lineTo(WELL.x1, -WELL.z1);
  hole.lineTo(WELL.x1, -WELL.z0); hole.lineTo(WELL.x0, -WELL.z0); hole.lineTo(WELL.x0, -WELL.z1);
  fs.holes.push(hole);
  const fgeo = new THREE.ShapeGeometry(fs);
  fgeo.rotateX(-Math.PI / 2);
  const uv = fgeo.attributes.uv, pp = fgeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / 2.4, pp.getZ(i) / 2.4);
  const floor = new THREE.Mesh(fgeo, oak);
  floor.receiveShadow = true;
  S.scene.add(floor); S.walkable.push(floor);

  const plaster = new THREE.MeshStandardMaterial({ map: tex(plasterTexture("#E6DED2"), 4, 2), roughness: .96 });
  MATS.plaster = plaster;
  MATS.roof = new THREE.MeshStandardMaterial({
    map: tex(plasterTexture("#E9E1D5"), 6, 3), roughness: .96, side: THREE.DoubleSide
  });

  [-1, 1].forEach(s => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(R.D, R.KNEE), plaster);
    w.position.set(s * R.HW, R.KNEE / 2, 0);
    w.rotation.y = s * -Math.PI / 2;
    w.receiveShadow = true; S.scene.add(w);
  });

  // roof slopes; the left one carries the skylights
  [-1, 1].forEach(s => {
    const shape = new THREE.Shape();
    shape.moveTo(-R.D / 2, 0); shape.lineTo(R.D / 2, 0);
    shape.lineTo(R.D / 2, SLOPE_LEN); shape.lineTo(-R.D / 2, SLOPE_LEN); shape.lineTo(-R.D / 2, 0);
    if (s === -1) SKYLIGHTS.forEach(k => {
      const p = new THREE.Path();
      p.moveTo(k.u - k.w / 2, k.v - k.h / 2); p.lineTo(k.u - k.w / 2, k.v + k.h / 2);
      p.lineTo(k.u + k.w / 2, k.v + k.h / 2); p.lineTo(k.u + k.w / 2, k.v - k.h / 2);
      p.lineTo(k.u - k.w / 2, k.v - k.h / 2);
      shape.holes.push(p);
    });
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), MATS.roof);
    m.receiveShadow = true;
    orient(m, new THREE.Vector3(s * R.HW, R.KNEE, 0), new THREE.Vector3(0, 0, -s), s === -1 ? UP_L : UP_R);
    S.scene.add(m);
  });

  // gable ends
  [-1, 1].forEach(s => {
    const shape = new THREE.Shape();
    shape.moveTo(-R.HW, 0); shape.lineTo(R.HW, 0);
    shape.lineTo(R.HW, R.KNEE); shape.lineTo(0, R.RIDGE); shape.lineTo(-R.HW, R.KNEE);
    shape.lineTo(-R.HW, 0);
    const mat = s === -1
      ? new THREE.MeshStandardMaterial({ map: tex(brickTexture(), 3, 2), roughness: .95 })
      : plaster;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    m.position.set(0, 0, s * R.D / 2);
    m.rotation.y = s === -1 ? 0 : Math.PI;
    m.receiveShadow = true; S.scene.add(m);
  });

  // glazing + frames
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#AFCBE4", transparent: true, opacity: .14, roughness: .05,
    transmission: .9, thickness: .02, side: THREE.DoubleSide
  });
  const frameM = new THREE.MeshStandardMaterial({ color: "#EFEAE2", roughness: .55 });
  const base = new THREE.Vector3(-R.HW, R.KNEE, 0);
  SKYLIGHTS.forEach((k, ki) => {
    const at = (du, dv) => base.clone().addScaledVector(UP_L, k.v + dv).addScaledVector(ALONG, k.u + du);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(k.w, k.h), glass);
    orient(pane, at(0, 0), ALONG, UP_L);
    S.scene.add(pane);
    if (ki === 1) addClickable(pane, "sky");
    const t = .10;
    const bars = [[k.w + t * 2, t, 0, k.h / 2], [k.w + t * 2, t, 0, -k.h / 2],
      [t, k.h, -k.w / 2, 0], [t, k.h, k.w / 2, 0]];
    if (!k.clear) bars.push([t * .5, k.h, 0, 0]);
    bars.forEach(([bw, bh, ou, ov]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, .13), frameM);
        b.castShadow = true;
        orient(b, at(ou, ov), ALONG, UP_L);
        S.scene.add(b);
      });
    const sn = new THREE.Mesh(new THREE.PlaneGeometry(k.w, .22),
      new THREE.MeshStandardMaterial({ color: "#E9EFF7", roughness: .9 }));
    orient(sn, at(0, -k.h / 2 + .11).addScaledVector(new THREE.Vector3(UP_L.y, -UP_L.x, 0), -.03), ALONG, UP_L);
    S.scene.add(sn);
  });
}

/* ── trusses + ridge LEDs ──────────────────── */
function buildTrusses() {
  const beam = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#8A6034", "#4E3418", 4), 1, 4), roughness: .74 });

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(.24, .30, R.D), beam);
  ridge.position.set(0, R.RIDGE - .16, 0); ridge.castShadow = true; S.scene.add(ridge);

  const N = 8;
  for (let i = 0; i < N; i++) {
    const z = -R.D / 2 + .95 + i * ((R.D - 1.9) / (N - 1));
    [[-1, UP_L], [1, UP_R]].forEach(([s, dir]) => {
      if (s === -1 && SKYLIGHTS.some(k => Math.abs(z - k.u) < k.w / 2 + .10)) return;
      const raf = new THREE.Mesh(new THREE.BoxGeometry(.19, SLOPE_LEN, .26), beam);
      raf.castShadow = raf.receiveShadow = true;
      orient(raf, new THREE.Vector3(s * R.HW, R.KNEE, z).addScaledVector(dir, SLOPE_LEN / 2),
        new THREE.Vector3(0, 0, s), dir);
      S.scene.add(raf);
    });
    const tie = new THREE.Mesh(new THREE.BoxGeometry(3.5, .17, .24), beam);
    tie.position.set(0, 2.62, z); tie.castShadow = true; S.scene.add(tie);
    const post = new THREE.Mesh(new THREE.BoxGeometry(.15, .78, .2), beam);
    post.position.set(0, 3.0, z); post.castShadow = true; S.scene.add(post);
  }

  [[-1, UP_L], [1, UP_R]].forEach(([s, dir]) => {
    const pur = new THREE.Mesh(new THREE.BoxGeometry(.16, .22, R.D), beam);
    pur.position.copy(new THREE.Vector3(s * R.HW, R.KNEE, 0).addScaledVector(dir, SLOPE_LEN * .30));
    pur.castShadow = true; S.scene.add(pur);
  });

  const ledMat = registerStrip(new THREE.MeshBasicMaterial({ color: "#FFD79A", toneMapped: false }));
  [-1, 1].forEach(s => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, R.D - .4), ledMat);
    strip.position.set(s * .19, R.RIDGE - .33, 0); S.scene.add(strip);
  });
  for (let i = 0; i < 5; i++) {
    const l = new THREE.PointLight("#FFC98A", 3.4, 8.5, 2);
    l.position.set(0, R.RIDGE - .45, -R.D / 2 + 1.4 + i * ((R.D - 2.8) / 4));
    S.scene.add(l); registerLight(l);
  }
}

/* ── sky, moon, snow ───────────────────────── */
function buildSkyAndSnow() {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 36, 22),
    new THREE.MeshBasicMaterial({ map: tex(skyTexture()), side: THREE.BackSide, toneMapped: false }));
  S.scene.add(dome);

  // a real moon, placed so it sits in the stargazing skylight
  const { center, normal } = skylightAnchor();
  const moonPos = center.clone().addScaledVector(normal, 30).add(new THREE.Vector3(4.5, 5.5, -2.5));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.5, 28, 22),
    new THREE.MeshBasicMaterial({ map: tex(moonTexture()), toneMapped: false }));
  moon.position.copy(moonPos); S.scene.add(moon);
  // extra deep stars so the sky reads well when you lie back
  const SN = 1400, sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    const v = new THREE.Vector3(rnd(-1, 1), rnd(.05, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(38, 52));
    sp[i * 3] = v.x; sp[i * 3 + 1] = v.y; sp[i * 3 + 2] = v.z;
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  S.scene.add(new THREE.Points(sgeo, new THREE.PointsMaterial({
    size: .30, map: new THREE.CanvasTexture(snowSprite()),
    transparent: true, depthWrite: false, toneMapped: false, fog: false
  })));

  // snow, strictly above the ridge so nothing drifts through the room
  const FLOOR_Y = R.RIDGE + .45, CEIL_Y = 15, N = 1200;
  const pos = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rnd(-13, 5);
    pos[i * 3 + 1] = rnd(FLOOR_Y, CEIL_Y);
    pos[i * 3 + 2] = rnd(-R.D / 2 - 3, R.D / 2 + 3);
    spd[i] = rnd(.3, .95);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  S.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: .13, map: new THREE.CanvasTexture(snowSprite()),
    transparent: true, depthWrite: false, toneMapped: false, fog: false
  })));
  onFrame((t, dt) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      p[i * 3 + 1] -= spd[i] * dt;
      p[i * 3] += Math.sin(t * .5 + i) * dt * .16;
      if (p[i * 3 + 1] < FLOOR_Y) { p[i * 3 + 1] = CEIL_Y; p[i * 3] = rnd(-13, 5); }
    }
    geo.attributes.position.needsUpdate = true;
  });
}

/* ── desk ──────────────────────────────────── */
function buildDesk() {
  const g = new THREE.Group();
  const topM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#C08B52", "#8A5C2E", 4), 1, 3), roughness: .5 });
  const carcass = new THREE.MeshStandardMaterial({ color: "#26262A", roughness: .7 });
  const L = 5.4, DP = .82, TY = .755;

  const top = new THREE.Mesh(new THREE.BoxGeometry(DP, .07, L), topM);
  top.position.set(-R.HW + DP / 2 + .04, TY, .9);
  top.castShadow = top.receiveShadow = true; g.add(top);
  const ret = new THREE.Mesh(new THREE.BoxGeometry(1.5, .07, DP), topM);
  ret.position.set(-R.HW + DP / 2 + .76, TY, .9 + L / 2 - DP / 2);
  ret.castShadow = ret.receiveShadow = true; g.add(ret);

  const ped = new THREE.Mesh(new THREE.BoxGeometry(DP - .06, .70, 1.1), carcass);
  ped.position.set(-R.HW + DP / 2 + .04, .36, 2.85); ped.castShadow = true; g.add(ped);
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(.02, .17, 1.0),
      new THREE.MeshStandardMaterial({ color: "#303035", roughness: .6 }));
    d.position.set(-R.HW + .03, .58 - i * .21, 2.85); g.add(d);
  }
  [[-R.HW + .12, .1], [-R.HW + .12, -1.5]].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(.07, TY - .04, .07), carcass);
    l.position.set(x, (TY - .04) / 2, z); g.add(l);
  });

  // slatted panel + ledge behind the desk
  const slatM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#9A6B3C", "#5E3F1E", 3), 1, 1), roughness: .66 });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(.03, R.KNEE - .06, 4.6), slatM);
  backing.position.set(-R.HW + .02, (R.KNEE - .06) / 2 + .03, .9);
  backing.receiveShadow = true; g.add(backing);
  for (let i = 0; i < 40; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.035, R.KNEE - .10, .055), slatM);
    s.position.set(-R.HW + .05, (R.KNEE - .10) / 2 + .05, .9 - 2.25 + i * .115);
    s.castShadow = true; g.add(s);
  }
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(.22, .05, 2.0), slatM);
  ledge.position.set(-R.HW + .11, 1.46, 2.1); ledge.castShadow = true; g.add(ledge);

  // ultrawide
  const SW = 1.62, SH = .66;
  const sgeo = new THREE.PlaneGeometry(SW, SH, 40, 1);
  const pa = sgeo.attributes.position;
  for (let i = 0; i < pa.count; i++) pa.setZ(i, -((pa.getX(i) / (SW / 2)) ** 2) * .085);
  sgeo.computeVertexNormals();
  const scr = new THREE.CanvasTexture(screenTexture(nowPlaying()[0]));
  scr.colorSpace = THREE.SRGBColorSpace;
  screenMesh = new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ map: scr, toneMapped: false }));
  screenMesh.position.set(-R.HW + .40, 1.15, .55);
  screenMesh.rotation.y = Math.PI / 2;
  addClickable(screenMesh, "screen");
  g.add(screenMesh);

  const bez = new THREE.Mesh(new THREE.BoxGeometry(.05, SH + .05, SW + .05),
    new THREE.MeshStandardMaterial({ color: "#1D1E22", roughness: .5 }));
  bez.position.set(-R.HW + .35, 1.15, .55); bez.castShadow = true; g.add(bez);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(.07, .28, .12),
    new THREE.MeshStandardMaterial({ color: "#1D1E22", roughness: .5 }));
  neck.position.set(-R.HW + .34, .90, .55); g.add(neck);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(.34, .025, .5),
    new THREE.MeshStandardMaterial({ color: "#1D1E22", roughness: .5 }));
  foot.position.set(-R.HW + .40, .80, .55); foot.castShadow = true; g.add(foot);

  const glow = new THREE.PointLight("#7FB2E0", 2.0, 3.4, 2);
  glow.position.set(-R.HW + .95, 1.15, .55); g.add(glow);
  onFrame(t => { glow.intensity = 1.85 + Math.sin(t * 3.2) * .2; });

  const m2 = new THREE.Mesh(new THREE.PlaneGeometry(.42, .62),
    new THREE.MeshBasicMaterial({ color: "#2A1E38", toneMapped: false }));
  m2.position.set(-R.HW + .42, 1.11, -.62); m2.rotation.y = Math.PI / 2 - .34; g.add(m2);
  const m2b = new THREE.Mesh(new THREE.BoxGeometry(.04, .68, .48),
    new THREE.MeshStandardMaterial({ color: "#1D1E22", roughness: .5 }));
  m2b.position.set(-R.HW + .39, 1.11, -.62); m2b.rotation.y = -.34; m2b.castShadow = true; g.add(m2b);

  const pc = new THREE.Mesh(new THREE.BoxGeometry(.24, .48, .52),
    new THREE.MeshStandardMaterial({ color: "#17181C", roughness: .45, metalness: .3 }));
  pc.position.set(-R.HW + .34, 1.03, -1.35); pc.castShadow = true; g.add(pc);
  const rgb = new THREE.Mesh(new THREE.PlaneGeometry(.40, .34),
    new THREE.MeshBasicMaterial({ color: "#B248D8", toneMapped: false, transparent: true, opacity: .34 }));
  rgb.position.set(-R.HW + .463, 1.03, -1.35); rgb.rotation.y = Math.PI / 2; g.add(rgb);
  const rgbL = new THREE.PointLight("#A63FD0", .38, 1.25, 2);
  rgbL.position.set(-R.HW + .75, 1.03, -1.35); g.add(rgbL);
  onFrame(t => {
    const h = (t * .06) % 1;
    rgb.material.color.setHSL(h, .75, .55);
    rgbL.color.setHSL(h, .75, .5);
  });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(.52, .006, 1.15),
    new THREE.MeshStandardMaterial({ color: "#1E2028", roughness: .95 }));
  pad.position.set(-R.HW + .62, TY + .037, .62); g.add(pad);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(.20, .028, .82),
    new THREE.MeshStandardMaterial({ color: "#141519", roughness: .6 }));
  kb.position.set(-R.HW + .60, TY + .054, .62); kb.castShadow = true; g.add(kb);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10),
    new THREE.MeshStandardMaterial({ color: "#191A20", roughness: .55 }));
  mouse.position.set(-R.HW + .60, TY + .06, 1.32); mouse.scale.set(.8, .42, 1.15); g.add(mouse);

  [[-.02], [1.62]].forEach(([z]) => {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(.16, .30, .18),
      new THREE.MeshStandardMaterial({ color: "#1B1C21", roughness: .7 }));
    sp.position.set(-R.HW + .30, TY + .19, z); sp.castShadow = true; g.add(sp);
  });

  // architect lamp
  const lampM = new THREE.MeshStandardMaterial({ color: "#B5482F", roughness: .45, metalness: .2 });
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .03, 18), lampM);
  lb.position.set(-R.HW + .45, TY + .05, 3.2); g.add(lb);
  const a1 = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .52, 8), lampM);
  a1.position.set(-R.HW + .45, TY + .30, 3.2); a1.rotation.z = -.30; g.add(a1);
  const a2 = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .44, 8), lampM);
  a2.position.set(-R.HW + .68, TY + .55, 3.2); a2.rotation.z = .95; g.add(a2);
  const hoodM = new THREE.MeshStandardMaterial({ color: "#C4523A", roughness: .5, side: THREE.DoubleSide,
    emissive: "#FFB454", emissiveIntensity: .35 });
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(.055, .13, .17, 18, 1, true), hoodM);
  hood.position.set(-R.HW + .92, TY + .50, 3.2); hood.rotation.z = 2.1; hood.castShadow = true; g.add(hood);
  const lampL = new THREE.PointLight("#FFB765", 2.6, 3.4, 2);
  lampL.position.set(-R.HW + .95, TY + .38, 3.2); g.add(lampL);
  registerLamp(lampL, hoodM);

  // chair
  const chair = new THREE.Group();
  const shellM = new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#D6D3CE"), 1, 1), roughness: .85 });
  const trimM = new THREE.MeshStandardMaterial({ color: "#2B2B2F", roughness: .6 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.56, .12, .56), shellM);
  seat.position.y = .50; chair.add(seat);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(.54, .78, .13), shellM);
  bk.position.set(0, .93, -.24); bk.rotation.x = -.13; chair.add(bk);
  [[-.26], [.26]].forEach(([x]) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(.07, .74, .16), trimM);
    w.position.set(x, .94, -.23); w.rotation.x = -.13; chair.add(w);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.09, .05, .30), trimM);
    arm.position.set(x, .70, -.02); chair.add(arm);
  });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .30, 12), trimM);
  col.position.y = .30; chair.add(col);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spk = new THREE.Mesh(new THREE.BoxGeometry(.32, .035, .06), trimM);
    spk.position.set(Math.cos(a) * .17, .13, Math.sin(a) * .17); spk.rotation.y = -a; chair.add(spk);
  }
  chair.traverse(o => { if (o.isMesh) o.castShadow = true; });
  chair.position.set(-R.HW + 1.55, 0, .75); chair.rotation.y = -1.35;
  g.add(chair);

  const rug = new THREE.Mesh(new THREE.BoxGeometry(1.9, .014, 3.0),
    new THREE.MeshStandardMaterial({ map: tex(plainRugTexture("#C4BAA9", "#9E8F79", "#7E6E56")), roughness: 1 }));
  rug.position.set(-R.HW + 1.75, .007, 1.1); rug.receiveShadow = true; g.add(rug);

  S.scene.add(g);

  block(-R.HW, -R.HW + .92, -1.85, 3.7);
  block(-R.HW + .9, -R.HW + 1.62, 3.15, 4.05);
  block(-R.HW + 1.2, -R.HW + 1.95, .35, 1.2);
  hotspots.screen = { stand: [-R.HW + 1.3, -.3] };

  onFrame((t, dt) => {
    const now = nowPlaying();
    screenTimer += dt;
    if (screenTimer > 7) {
      screenTimer = 0;
      screenIdx = now.length ? (screenIdx + 1) % now.length : 0;
      screenMesh.material.map.image = screenTexture(now[screenIdx]);
      screenMesh.material.map.needsUpdate = true;
    }
  });
}

/* ── brick gable: TV, media unit, art ──────── */
function buildGableWall() {
  const Z = -R.D / 2 + .04;
  const g = new THREE.Group();
  const unitM = new THREE.MeshStandardMaterial({ color: "#2B2A2E", roughness: .55 });
  const legM = new THREE.MeshStandardMaterial({ color: "#8A6034", roughness: .6 });

  const unit = new THREE.Mesh(new THREE.BoxGeometry(2.7, .46, .52), unitM);
  unit.position.set(1.05, .30, Z + .28); unit.castShadow = unit.receiveShadow = true; g.add(unit);
  [[-1.1], [1.1]].forEach(([dx]) => [[-.16], [.16]].forEach(([dz]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.022, .018, .16, 8), legM);
    l.position.set(1.05 + dx, .08, Z + .28 + dz); l.rotation.x = .12; g.add(l);
  }));
  const woodTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, .05, .54), legM);
  woodTop.position.set(1.05, .555, Z + .28); woodTop.castShadow = true; g.add(woodTop);

  const tvW = 2.05, tvH = 1.16;
  const tvPanel = new THREE.Mesh(new THREE.PlaneGeometry(tvW, tvH),
    new THREE.MeshBasicMaterial({ map: tex(tvTexture(upNext())), toneMapped: false }));
  tvPanel.position.set(1.05, 1.36, Z + .075);
  addClickable(tvPanel, "tv"); g.add(tvPanel);
  tvMesh = tvPanel;
  store.onChange(() => {
    tvMesh.material.map.image = tvTexture(upNext());
    tvMesh.material.map.needsUpdate = true;
  });
  const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(tvW + .06, tvH + .06, .06),
    new THREE.MeshStandardMaterial({ color: "#141418", roughness: .45 }));
  tvFrame.position.set(1.05, 1.36, Z + .04); tvFrame.castShadow = true; g.add(tvFrame);
  const tvGlow = new THREE.PointLight("#6E86B8", 1.1, 3.4, 2);
  tvGlow.position.set(1.05, 1.36, Z + .7); g.add(tvGlow);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(.18, .82, .18),
    new THREE.MeshStandardMaterial({ color: "#1C1D22", roughness: .7 }));
  tower.position.set(2.62, .41, Z + .3); tower.castShadow = true; g.add(tower);

  [{ x: -.62, y: 2.05, w: .46, h: .60, c: "#E8E2D6" },
   { x: 1.95, y: 2.20, w: .34, h: .26, c: "#DED6C6" },
   { x: 2.38, y: 2.16, w: .26, h: .32, c: "#E4DCCC" }].forEach(f => {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, .03),
      new THREE.MeshStandardMaterial({ color: "#2A2622", roughness: .6 }));
    fr.position.set(f.x, f.y, Z + .04); fr.castShadow = true; g.add(fr);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(f.w - .06, f.h - .06),
      new THREE.MeshStandardMaterial({ color: f.c, roughness: .9 }));
    art.position.set(f.x, f.y, Z + .06); g.add(art);
  });

  S.scene.add(g);
  block(-.35, 2.45, -R.D / 2, -R.D / 2 + .62);
  hotspots.tv = { stand: [1.05, -R.D / 2 + 1.5] };
}

/* ── anime collection alcove ───────────────── */
let shelfBooks = null;      // the group the spines live in, rebuilt on change

function buildCollection() {
  const Z = -R.D / 2 + .04;
  const g = new THREE.Group();
  const caseM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#A9793F", "#6E4A22", 3), 1, 1), roughness: .6 });
  const backM = new THREE.MeshStandardMaterial({ color: "#3A2A1C", roughness: .95 });
  const W = 1.9, H = 1.62, DP = .30, X = -1.85, Y0 = .78;

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, .03), backM);
  back.position.set(X, Y0 + H / 2, Z + .02); g.add(back);
  [[-W / 2], [W / 2]].forEach(([dx]) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.05, H, DP), caseM);
    s.position.set(X + dx, Y0 + H / 2, Z + DP / 2); s.castShadow = true; g.add(s);
  });
  const ROWS = 4, gap = H / ROWS, rowY = [];
  for (let i = 0; i <= ROWS; i++) {
    const y = Y0 + i * gap;
    const b = new THREE.Mesh(new THREE.BoxGeometry(W, .045, DP), caseM);
    b.position.set(X, y, Z + DP / 2); b.castShadow = b.receiveShadow = true; g.add(b);
    if (i < ROWS) rowY.push(y + .022);
    if (i > 0) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(W - .12, .015, .015),
        registerStrip(new THREE.MeshBasicMaterial({ color: "#FFD9A0", toneMapped: false })));
      led.position.set(X, y - .035, Z + DP - .04); g.add(led);
    }
  }
  const shelfLight = new THREE.PointLight("#FFCE96", 2.6, 3.0, 2);
  shelfLight.position.set(X, Y0 + H / 2, Z + .75); g.add(shelfLight); registerLight(shelfLight);

  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(.56, .105),
    new THREE.MeshStandardMaterial({ map: tex(plaqueTexture(BAYS.anime.label)), roughness: .35, metalness: .65 }));
  plaque.position.set(X, Y0 - .075, Z + DP + .002); g.add(plaque);

  shelfBooks = new THREE.Group();
  g.add(shelfBooks);
  S.scene.add(g);

  const geom = { X, W, DP, Z, gap, rowY };
  fillShelf(geom);
  store.onChange(() => fillShelf(geom));

  block(-2.9, -.8, -R.D / 2, -R.D / 2 + .42);
  hotspots.book = { stand: [X, -R.D / 2 + 1.05] };
}

/* Re-lay the spines from whatever is on the shelf now. Called on every
   change, so adding a title in the editor puts a book on the wall. */
function fillShelf({ X, W, DP, Z, gap, rowY }) {
  if (!shelfBooks) return;
  for (const m of [...shelfBooks.children]) {
    shelfBooks.remove(m);
    m.geometry?.dispose?.();
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => {
      mat?.map?.dispose?.(); mat?.dispose?.();
    });
  }
  for (let i = S.clickable.length - 1; i >= 0; i--)
    if (S.clickable[i].userData.kind === "book") S.clickable.splice(i, 1);

  const items = store.byBay("anime");
  const INNER = W - .22;
  // as many rows as it takes, spilling onto the shelves the props used to have
  const rows = [];
  let row = [], width = 0;
  for (const it of items) {
    const w = spineWidth(it) + .008;
    if (width + w > INNER && row.length) { rows.push(row); row = []; width = 0; }
    row.push(it); width += w;
  }
  if (row.length) rows.push(row);

  const slots = [rowY[1], rowY[2], rowY[0], rowY[3]];
  rows.slice(0, slots.length).forEach((set, ri) => {
    const y = slots[ri];
    const total = set.reduce((s, it) => s + spineWidth(it) + .008, 0);
    let x = X - total / 2;
    set.forEach((it, k) => {
      const w = spineWidth(it), h = gap * .68 + (k % 3) * .012, d = .20;
      const paper = new THREE.MeshStandardMaterial({ color: "#E8DECC", roughness: .95 });
      const side = new THREE.MeshStandardMaterial({ color: colourFor(it), roughness: .78 });
      const book = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
        side, side, paper, paper,
        new THREE.MeshStandardMaterial({ map: tex(spineTexture(it)), roughness: .68 }), side]);
      book.position.set(x + w / 2, y + h / 2, Z + .04 + d / 2 + .03);
      book.castShadow = book.receiveShadow = true;
      if (it.status === "planned") { book.rotation.z = .17; book.position.x += .035; }
      addClickable(book, "book", { id: it.id, baseZ: book.position.z });
      shelfBooks.add(book);
      x += w + .008;
    });
  });

  const bookend = new THREE.Mesh(new THREE.BoxGeometry(.028, .26, .19),
    new THREE.MeshStandardMaterial({ color: "#8A7038", roughness: .3, metalness: .8 }));
  bookend.position.set(X + W / 2 - .1, rowY[1] + .13, Z + .16);
  bookend.castShadow = true; shelfBooks.add(bookend);
  void DP;
}

/* ── the other shelf bays ──────────────────── */
function bayUnit(len, h, rows, perRow, label) {
  const g = new THREE.Group();
  const woodM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#8F6339", "#5A3C1C", 3), 2, 1), roughness: .66 });
  const backM = new THREE.MeshStandardMaterial({ color: "#3B2A1B", roughness: 1 });
  const DP = .30;
  const back = new THREE.Mesh(new THREE.BoxGeometry(len, h, .03), backM);
  back.position.set(0, h / 2, -DP / 2); g.add(back);
  [[-len / 2], [len / 2]].forEach(([x]) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.05, h, DP), woodM);
    s.position.set(x, h / 2, 0); s.castShadow = true; g.add(s);
  });
  const gap = h / rows, rowY = [];
  for (let i = 0; i <= rows; i++) {
    const y = i * gap;
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, .045, DP), woodM);
    b.position.set(0, y, 0); b.castShadow = b.receiveShadow = true; g.add(b);
    if (i < rows) rowY.push(y + .023);
    if (i > 0) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(len - .12, .014, .014),
        registerStrip(new THREE.MeshBasicMaterial({ color: "#FFD9A0", toneMapped: false })));
      led.position.set(0, y - .032, DP / 2 - .035); g.add(led);
    }
  }
  const cols = ["#7C3B32", "#2F5A46", "#2B475E", "#5A3B62", "#8A6A2A", "#3A3542",
                "#245C58", "#6B3A20", "#4A4E6B", "#7A4A2E"];
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: .84 }), rows * perRow);
  inst.castShadow = inst.receiveShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let n = 0;
  rowY.forEach(y => {
    let x = -len / 2 + .09;
    for (let i = 0; i < perRow; i++) {
      const bw = rnd(.032, .075), bh = rnd(gap * .5, gap * .76), bd = rnd(.16, .22);
      if (x + bw > len / 2 - .09) break;
      const tilt = Math.random() < .07 ? rnd(.12, .25) : 0;
      m4.makeRotationZ(-tilt);
      m4.setPosition(x + bw / 2, y + bh / 2, -DP / 2 + bd / 2 + .05);
      m4.scale(new THREE.Vector3(bw, bh, bd));
      inst.setMatrixAt(n, m4);
      col.set(pick(cols)).offsetHSL(0, rnd(-.05, .05), rnd(-.07, .07));
      inst.setColorAt(n, col);
      n++; x += bw + .004;
    }
  });
  inst.count = n; inst.instanceMatrix.needsUpdate = true;
  g.add(inst);

  if (label) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(.58, .11),
      new THREE.MeshStandardMaterial({ map: tex(plaqueTexture(label)), roughness: .35, metalness: .65 }));
    p.position.set(0, h + .09, DP / 2 - .01); g.add(p);
    const hot = new THREE.Mesh(new THREE.BoxGeometry(len, h, DP + .1),
      new THREE.MeshBasicMaterial({ visible: false }));
    hot.position.set(0, h / 2, .05);
    g.add(hot);
    g.userData.hot = hot;
  }
  return g;
}

function buildBays() {
  const H = R.KNEE - .10;
  // right wall, by the brick gable
  const movies = bayUnit(1.8, H, 3, 28, BAYS.screen.label);
  movies.rotation.y = -Math.PI / 2;
  movies.position.set(R.HW - .17, 0, -5.1);
  S.scene.add(movies);
  addClickable(movies.userData.hot, "bay", { bay: "screen" });
  block(R.HW - .5, R.HW, -6.05, -4.15);
  hotspots.bay_screen = { stand: [R.HW - .95, -5.1] };

  // left wall, near the front
  const books = bayUnit(1.7, H, 3, 26, BAYS.books.label);
  books.rotation.y = Math.PI / 2;
  books.position.set(-R.HW + .17, 0, 5.15);
  S.scene.add(books);
  addClickable(books.userData.hot, "bay", { bay: "books" });
  block(-R.HW, -R.HW + .5, 4.28, 6.02);
  hotspots.bay_books = { stand: [-R.HW + .95, 5.15] };

  // one plain run to keep the library feel; the left wall's far end is
  // deliberately clear, because the stargazing steps start there
  const b = bayUnit(1.4, H, 3, 22, null);
  b.rotation.y = -Math.PI / 2; b.position.set(R.HW - .17, 0, 5.4);
  S.scene.add(b); block(R.HW - .5, R.HW, 4.65, 6.05);
}

/* ── one sofa, an Indian carpet, a low table ─ */
function buildSeating() {
  const g = new THREE.Group();
  const fab = new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#B9AE9E"), 2, 2), roughness: 1 });
  const fab2 = new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#C6BCAC"), 2, 2), roughness: 1 });

  const rug = new THREE.Mesh(new THREE.BoxGeometry(3.0, .016, 3.5),
    new THREE.MeshStandardMaterial({ map: tex(indianRugTexture()), roughness: 1 }));
  rug.position.set(1.72, .008, -1.25); rug.receiveShadow = true; g.add(rug);

  const sofa = new THREE.Group();
  const SW = 1.98, SD = .96;
  const base = new THREE.Mesh(new THREE.BoxGeometry(SW, .30, SD), fab);
  base.position.set(0, .17, 0); sofa.add(base);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(SW, .58, .20), fab);
  bk.position.set(0, .49, -SD / 2 + .10); sofa.add(bk);
  [-1, 1].forEach(s => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(.22, .30, SD), fab);
    a.position.set(s * (SW / 2 - .11), .45, 0); sofa.add(a);
  });
  for (let i = -1; i <= 1; i += 2) {
    const cu = new THREE.Mesh(new THREE.BoxGeometry(.80, .17, SD - .26), fab2);
    cu.position.set(i * .42, .405, .07); sofa.add(cu);
    const bc = new THREE.Mesh(new THREE.BoxGeometry(.78, .40, .16), fab2);
    bc.position.set(i * .42, .60, -SD / 2 + .25); bc.rotation.x = -.10; sofa.add(bc);
  }
  [[-.62, "#8A6F52"], [.58, "#6E7A6A"]].forEach(([x, col]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.32, .32, .12),
      new THREE.MeshStandardMaterial({ map: tex(fabricTexture(col), 1, 1), roughness: 1 }));
    p.position.set(x, .64, -SD / 2 + .24); p.rotation.set(-.12, 0, rnd(-.2, .2)); sofa.add(p);
  });
  const throwB = new THREE.Mesh(new THREE.BoxGeometry(.70, .05, .52),
    new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#A8705A"), 1, 1), roughness: 1 }));
  throwB.position.set(.5, .48, .22); throwB.rotation.z = .04; sofa.add(throwB);

  sofa.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  sofa.position.set(1.70, 0, .45);
  sofa.rotation.y = Math.PI;
  g.add(sofa);

  const woodM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#B98C57", "#7E5A2E", 2), 1, 1), roughness: .55 });
  const TX = 1.72, TZ = -1.45;
  const tbl = new THREE.Mesh(new THREE.BoxGeometry(1.05, .09, .60), woodM);
  tbl.position.set(TX, .40, TZ); tbl.castShadow = tbl.receiveShadow = true; g.add(tbl);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(.92, .05, .50), woodM);
  shelf.position.set(TX, .17, TZ); shelf.castShadow = true; g.add(shelf);
  [[-.45], [.45]].forEach(([dx]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .40, .54),
      new THREE.MeshStandardMaterial({ color: "#2E2C30", roughness: .6 }));
    l.position.set(TX + dx, .20, TZ); l.castShadow = true; g.add(l);
  });
  const bk1 = new THREE.Mesh(new THREE.BoxGeometry(.22, .035, .16),
    new THREE.MeshStandardMaterial({ color: "#6E4A72", roughness: .8 }));
  bk1.position.set(TX - .18, .462, TZ + .04); bk1.rotation.y = .3; g.add(bk1);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.045, .04, .1, 14),
    new THREE.MeshStandardMaterial({ color: "#B5462F", roughness: .5 }));
  cup.position.set(TX + .26, .495, TZ - .06); cup.castShadow = true; g.add(cup);

  S.scene.add(g);
  block(1.70 - SW / 2 - .05, 1.70 + SW / 2 + .05, .45 - SD / 2 - .05, .45 + SD / 2 + .05);
  block(TX - .58, TX + .58, TZ - .35, TZ + .35);
}

function buildSofaLamp() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: "#8A7038", roughness: .35, metalness: .75 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.19, .21, .035, 22), metal);
  base.position.y = .018; base.castShadow = true; g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 1.36, 12), metal);
  pole.position.y = .70; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .46, 12), metal);
  arm.position.set(-.22, 1.38, 0); arm.rotation.z = Math.PI / 2; g.add(arm);
  const shadeM = new THREE.MeshStandardMaterial({ color: "#E8D5AC", roughness: .72, side: THREE.DoubleSide,
    emissive: "#FFC070", emissiveIntensity: .55 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.13, .18, .24, 22, 1, true), shadeM);
  shade.position.set(-.45, 1.26, 0); shade.castShadow = true; g.add(shade);
  const l = new THREE.PointLight("#FFC078", 3.4, 5.0, 2);
  l.position.set(-.45, 1.16, 0); g.add(l);
  registerLamp(l, shadeM);
  // West end of the sofa, arm arching back over it. It used to sit on the
  // east side, where its base sealed the only corridor to the photo wall.
  g.position.set(.42, 0, .45);
  g.rotation.y = Math.PI;
  S.scene.add(g);
  block(.2, .66, .22, .68);
}

/* ── eaves cabinets ────────────────────────── */
function buildEaves() {
  const white = new THREE.MeshStandardMaterial({ color: "#EDE8E0", roughness: .55 });
  const handle = new THREE.MeshStandardMaterial({ color: "#8A8A90", roughness: .35, metalness: .7 });
  for (let i = 0; i < 3; i++) {
    const z = -3.0 + i * 1.1;
    const c = new THREE.Mesh(new THREE.BoxGeometry(.52, 1.05, 1.02), white);
    c.position.set(R.HW - .28, .53, z); c.castShadow = c.receiveShadow = true; S.scene.add(c);
    const d = new THREE.Mesh(new THREE.BoxGeometry(.02, .95, .94),
      new THREE.MeshStandardMaterial({ color: "#F5F1EA", roughness: .5 }));
    d.position.set(R.HW - .55, .53, z); S.scene.add(d);
    const h = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, .3), handle);
    h.position.set(R.HW - .57, .88, z); S.scene.add(h);
  }
  const worktop = new THREE.Mesh(new THREE.BoxGeometry(.58, .05, 3.5),
    new THREE.MeshStandardMaterial({ map: tex(woodTexture("#C08B52", "#8A5C2E", 3), 1, 3), roughness: .5 }));
  worktop.position.set(R.HW - .28, 1.08, -1.9); worktop.castShadow = true; S.scene.add(worktop);
  block(R.HW - .58, R.HW, -3.6, -.35);

  const panelM = new THREE.MeshStandardMaterial({ color: "#3A3B40", roughness: .98 });
  [[-1.6, 2.7], [.6, 2.7], [-1.6, 3.6], [.6, 3.6]].forEach(([u, v]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, .62, .05), panelM);
    p.castShadow = true;
    orient(p, new THREE.Vector3(R.HW, R.KNEE, 0).addScaledVector(UP_R, v).addScaledVector(ALONG, u), ALONG, UP_R);
    S.scene.add(p);
  });
}

/* ── photo wall ────────────────────────────── */
function buildPhotoWall() {
  const g = new THREE.Group();
  const X = R.HW - .04;
  const woodM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#A9793F", "#6E4A22", 3), 1, 1), roughness: .6 });

  const console_ = new THREE.Mesh(new THREE.BoxGeometry(.42, .52, 1.8), woodM);
  console_.position.set(R.HW - .23, .26, 1.0); console_.castShadow = console_.receiveShadow = true; g.add(console_);

  const FR = [[.48, .95], [1.42, .95], [.48, 1.34], [1.42, 1.34]];
  FR.forEach(([z, y], i) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(.05, .34, .58),
      new THREE.MeshStandardMaterial({ color: "#2A2622", roughness: .55 }));
    frame.position.set(X - .02, y, z); frame.castShadow = true; g.add(frame);
    const mat = new THREE.MeshStandardMaterial({ roughness: .78 });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.50, .28), mat);
    pic.position.set(X - .052, y, z); pic.rotation.y = -Math.PI / 2;
    g.add(pic);
    registerFrame(pic, mat, i);
    addClickable(pic, "photo", { index: i });
    const lip = new THREE.Mesh(new THREE.BoxGeometry(.03, .02, .58),
      new THREE.MeshBasicMaterial({ color: "#FFD9A0", toneMapped: false }));
    registerStrip(lip.material);
    lip.position.set(X - .06, y + .19, z); g.add(lip);
  });

  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(.42, .08),
    new THREE.MeshStandardMaterial({ map: tex(plaqueTexture("OUR PHOTOS")), roughness: .35, metalness: .65 }));
  plaque.position.set(X - .052, .64, .95); plaque.rotation.y = -Math.PI / 2; g.add(plaque);

  S.scene.add(g);
  block(R.HW - .45, R.HW, .05, 1.95);
  hotspots.photo = { stand: [R.HW - 1.05, 1.72] };
}

/* ── bed ───────────────────────────────────── */
function buildBed() {
  const g = new THREE.Group();
  const frameM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#9A6B3C", "#5E3F1E", 3), 1, 2), roughness: .62 });
  const sheetM = new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#E7E0D2"), 2, 2), roughness: 1 });
  const duvetM = new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#5E7566"), 2, 2), roughness: 1 });
  const W = 1.36, L = 2.0;

  const base = new THREE.Mesh(new THREE.BoxGeometry(W + .1, .28, L + .1), frameM);
  base.position.y = .16; base.castShadow = base.receiveShadow = true; g.add(base);
  const head = new THREE.Mesh(new THREE.BoxGeometry(W + .14, .62, .09), frameM);
  head.position.set(0, .55, -L / 2 - .02); head.castShadow = true; g.add(head);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(W, .22, L), sheetM);
  mat.position.y = .40; mat.castShadow = mat.receiveShadow = true; g.add(mat);
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(W + .06, .13, L * .68), duvetM);
  duvet.position.set(0, .55, L * .14); duvet.castShadow = true; g.add(duvet);
  [[-.32], [.32]].forEach(([x]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.56, .16, .32), sheetM);
    p.position.set(x, .58, -L / 2 + .27); p.rotation.z = rnd(-.05, .05); p.castShadow = true; g.add(p);
  });
  const throwB = new THREE.Mesh(new THREE.BoxGeometry(W + .1, .06, .48),
    new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#A8705A"), 1, 1), roughness: 1 }));
  throwB.position.set(0, .615, L / 2 - .32); throwB.castShadow = true; g.add(throwB);

  const ns = new THREE.Mesh(new THREE.BoxGeometry(.40, .46, .36), frameM);
  ns.position.set(-W / 2 - .32, .23, -L / 2 + .2); ns.castShadow = true; g.add(ns);
  const shadeM = new THREE.MeshStandardMaterial({ color: "#E8D5AC", roughness: .7, side: THREE.DoubleSide,
    emissive: "#FFC070", emissiveIntensity: .5 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, .16, 16, 1, true), shadeM);
  shade.position.set(-W / 2 - .32, .60, -L / 2 + .2); g.add(shade);
  const bl = new THREE.PointLight("#FFBE78", 2.0, 3.0, 2);
  bl.position.set(-W / 2 - .32, .62, -L / 2 + .2); g.add(bl);
  registerLamp(bl, shadeM);

  const rug = new THREE.Mesh(new THREE.BoxGeometry(.78, .012, 1.4),
    new THREE.MeshStandardMaterial({ map: tex(plainRugTexture("#C0B4A2", "#93826C", "#71614C")), roughness: 1 }));
  rug.position.set(-W / 2 - .55, .006, .2); rug.receiveShadow = true; g.add(rug);

  g.position.set(R.HW - 1.0, 0, 3.3);
  g.rotation.y = -Math.PI / 2;
  S.scene.add(g);
  block(R.HW - 2.2, R.HW, 2.2, 4.4);
}

/* ── stargazing steps + platform ───────────── */
function buildStargazing() {
  const g = new THREE.Group();
  const woodM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#A9793F", "#6E4A22", 3), 1, 1), roughness: .6 });
  const railM = new THREE.MeshStandardMaterial({ color: "#2B2A2E", roughness: .5, metalness: .35 });
  const skirtM = new THREE.MeshStandardMaterial({ color: "#EEE8DE", roughness: .85 });

  const PW = DECK.x1 - DECK.x0, PL = DECK.z1 - DECK.z0;
  const CX = (DECK.x0 + DECK.x1) / 2, CZ = (DECK.z0 + DECK.z1) / 2;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(PW, .09, PL), woodM);
  deck.position.set(CX, DECK.y, CZ);
  deck.castShadow = deck.receiveShadow = true; g.add(deck);
  S.walkable.push(deck);

  [[DECK.x0 + .1, DECK.z0 + .1], [DECK.x1 - .1, DECK.z0 + .1],
   [DECK.x1 - .1, DECK.z1 - .1], [DECK.x0 + .1, DECK.z1 - .1]].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(.07, DECK.y - .05, .07), woodM);
    l.position.set(x, (DECK.y - .05) / 2, z); l.castShadow = true; g.add(l);
  });
  // skirt boards; the stair side is left open where the treads arrive
  const skFront = new THREE.Mesh(new THREE.BoxGeometry(.04, DECK.y - .06, PL), skirtM);
  skFront.position.set(DECK.x1 - .02, (DECK.y - .06) / 2, CZ); skFront.receiveShadow = true; g.add(skFront);
  const skBack = new THREE.Mesh(new THREE.BoxGeometry(PW, DECK.y - .06, .04), skirtM);
  skBack.position.set(CX, (DECK.y - .06) / 2, DECK.z1 - .02); skBack.receiveShadow = true; g.add(skBack);
  const openW = STAIR.x1 - STAIR.x0;
  const skFrontZ = new THREE.Mesh(new THREE.BoxGeometry(PW - openW, DECK.y - .06, .04), skirtM);
  skFrontZ.position.set(DECK.x0 + openW + (PW - openW) / 2, (DECK.y - .06) / 2, DECK.z0 + .02);
  skFrontZ.receiveShadow = true; g.add(skFrontZ);

  const STEPS = 7, RISE = DECK.y / STEPS, GO = (STAIR.z1 - STAIR.z0) / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(openW - .06, .07, GO), woodM);
    t.position.set((STAIR.x0 + STAIR.x1) / 2, RISE * (i + 1) - .035, STAIR.z0 + GO * (i + .5));
    t.castShadow = t.receiveShadow = true; g.add(t); S.walkable.push(t);
    const ri = new THREE.Mesh(new THREE.BoxGeometry(openW - .06, RISE, .03), skirtM);
    ri.position.set((STAIR.x0 + STAIR.x1) / 2, RISE * (i + 1) - RISE / 2 - .035, STAIR.z0 + GO * i);
    g.add(ri);
  }

  const rail = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, PL), railM);
  rail.position.set(DECK.x1 - .04, DECK.y + .46, CZ); rail.castShadow = true; g.add(rail);
  [[DECK.z0 + .1], [DECK.z1 - .1]].forEach(([z]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.05, .46, .05), railM);
    p.position.set(DECK.x1 - .04, DECK.y + .23, z); g.add(p);
  });

  const cushion = new THREE.Mesh(new THREE.BoxGeometry(PW - .9, .15, PL - .34),
    new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#6B7A6E"), 2, 2), roughness: 1 }));
  cushion.position.set(CX + .2, DECK.y + .125, CZ); cushion.castShadow = true; g.add(cushion);
  [[-.26], [.28]].forEach(([dz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.40, .13, .28),
      new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#D9CFBC"), 1, 1), roughness: 1 }));
    p.position.set(DECK.x0 + .75, DECK.y + .26, CZ + dz);
    p.rotation.z = rnd(-.12, .12); p.castShadow = true; g.add(p);
  });
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(.66, .05, .54),
    new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#9E6A55"), 1, 1), roughness: 1 }));
  blanket.position.set(DECK.x1 - .62, DECK.y + .22, CZ - .18); blanket.castShadow = true; g.add(blanket);

  for (let i = 0; i < 14; i++) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(.016, 6, 6),
      registerStrip(new THREE.MeshBasicMaterial({ color: "#FFD892", toneMapped: false })));
    o.position.set(DECK.x1 - .04, DECK.y + .44 + Math.sin(i * .9) * .03, DECK.z0 + .1 + (i / 13) * (PL - .2));
    g.add(o);
  }
  const nook = new THREE.PointLight("#FFCE96", 1.5, 3.2, 2);
  nook.position.set(CX, DECK.y + .7, CZ); g.add(nook); registerLight(nook);

  S.scene.add(g);

  world.steps.push({ x0: STAIR.x0, x1: STAIR.x1, z0: STAIR.z0, z1: STAIR.z1, y0: 0, y1: DECK.y, axis: "z" });
  world.steps.push({ x0: DECK.x0, x1: DECK.x1, z0: DECK.z0, z1: DECK.z1, y0: DECK.y, y1: DECK.y, axis: "flat" });

  // Routed around the palm and up the treads; a straight line would jam
  // against the platform skirt. The same waypoints, reversed, are the only
  // way back down — anything else leaves you stranded on the deck.
  routes.up = [[-.6, -4.6], [-2.2, -5.4], [-3.5, -5.32], [-3.5, -3.05]];
  routes.down = [[-3.5, -3.05], [-3.5, -5.32], [-2.2, -5.4]];
  hotspots.sky = { stand: [-1.45, CZ], path: [...routes.up, [-1.45, CZ]] };
}

/* ── stairs down to the street ─────────────── */
function buildStairwell() {
  const g = new THREE.Group();
  const woodM = new THREE.MeshStandardMaterial({ map: tex(woodTexture("#B0824F", "#77522A", 3), 1, 1), roughness: .58 });
  const darkM = new THREE.MeshStandardMaterial({ color: "#33292C", roughness: 1, side: THREE.BackSide });
  const railM = new THREE.MeshStandardMaterial({ color: "#2B2A2E", roughness: .5, metalness: .35 });
  const W = WELL.x1 - WELL.x0, L = WELL.z1 - WELL.z0;
  const CX = (WELL.x0 + WELL.x1) / 2, CZ = (WELL.z0 + WELL.z1) / 2;

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(W + .04, 3.0, L + .04), darkM);
  shaft.position.set(CX, -1.5, CZ); g.add(shaft);

  [[W + .16, CX, WELL.z0 - .08], [W + .16, CX, WELL.z1 + .08]].forEach(([bw, x, z]) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(bw, .05, .16), woodM);
    t.position.set(x, .025, z); t.castShadow = true; g.add(t);
  });
  [[WELL.x0 - .08], [WELL.x1 + .08]].forEach(([x]) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(.16, .05, L + .32), woodM);
    t.position.set(x, .025, CZ); t.castShadow = true; g.add(t);
  });

  const STEPS = 9, RISE = .215, GO = L / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(W - .08, .06, GO * .96), woodM);
    tread.position.set(CX, -RISE * (i + 1) + .03, WELL.z0 + GO * (i + .5));
    tread.receiveShadow = true; g.add(tread);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(W - .08, RISE, .03),
      new THREE.MeshStandardMaterial({ color: "#EEE8DE", roughness: .8 }));
    riser.position.set(CX, -RISE * (i + 1) + RISE / 2, WELL.z0 + GO * i);
    g.add(riser);
  }

  const postAt = (x, z) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.05, .92, .05), railM);
    p.position.set(x, .46, z); p.castShadow = true; g.add(p);
  };
  postAt(WELL.x0 - .08, WELL.z0 - .08); postAt(WELL.x1 + .08, WELL.z0 - .08);
  postAt(WELL.x1 + .08, WELL.z1 + .08);
  const rail1 = new THREE.Mesh(new THREE.BoxGeometry(W + .16, .06, .06), railM);
  rail1.position.set(CX, .92, WELL.z0 - .08); rail1.castShadow = true; g.add(rail1);
  const rail2 = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, L + .16), railM);
  rail2.position.set(WELL.x1 + .08, .92, CZ); rail2.castShadow = true; g.add(rail2);
  for (let i = 1; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.02, .86, .02), railM);
    b.position.set(WELL.x0 + (W / 6) * i, .45, WELL.z0 - .08); g.add(b);
  }

  const below = new THREE.PointLight("#FFC98A", 7.0, 7.5, 2);
  below.position.set(CX, -1.15, CZ + .25); g.add(below);
  const lip = new THREE.PointLight("#FFC98A", 2.6, 3.4, 2);
  lip.position.set(CX, -.22, CZ - .5); g.add(lip);
  registerLight(below); registerLight(lip);

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.54, .105),
    new THREE.MeshStandardMaterial({ map: tex(plaqueTexture("↓  THE STREET")), roughness: .35, metalness: .6 }));
  sign.position.set(CX, .74, WELL.z0 - .12); sign.rotation.y = Math.PI; g.add(sign);

  const hot = new THREE.Mesh(new THREE.BoxGeometry(W, .5, L), new THREE.MeshBasicMaterial({ visible: false }));
  hot.position.set(CX, -.05, CZ);
  addClickable(hot, "stairs"); g.add(hot);

  S.scene.add(g);
  block(WELL.x0 - .18, WELL.x1 + .18, WELL.z0 - .18, WELL.z1 + .18);
  hotspots.stairs = { stand: [CX - .3, WELL.z0 - .65] };
}

/* ── the wombats ───────────────────────────── */
const BED = { x: .35, z: 2.25 };

function makeWombat(furHex) {
  const w = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: furHex, roughness: .96 });
  const dark = new THREE.MeshStandardMaterial({ color: "#241B15", roughness: .9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 14), fur);
  body.scale.set(1.15, .95, 1.45); body.position.y = .115; body.castShadow = true; w.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.098, 16, 14), fur);
  head.scale.set(1.06, .94, .96); head.position.set(0, .135, .175); head.castShadow = true; w.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(.052, 12, 10), fur);
  snout.scale.set(1, .8, 1.05); snout.position.set(0, .105, .245); w.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.024, 10, 8), dark);
  nose.scale.set(1.25, .85, .8); nose.position.set(0, .105, .288); w.add(nose);
  [[-.058], [.058]].forEach(([x]) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(.036, 10, 8), fur);
    ear.scale.set(.85, 1.05, .5); ear.position.set(x, .215, .148); w.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.0125, 8, 8), dark);
    eye.position.set(x * .78, .152, .243); w.add(eye);
  });
  const legs = [];
  [[-.085, .09], [.085, .09], [-.085, -.075], [.085, -.075]].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.032, .034, .075, 8), fur);
    l.position.set(x, .038, z); l.castShadow = true; w.add(l); legs.push(l);
  });
  w.userData.legs = legs;
  w.userData.head = head;
  return w;
}

let wombatState = "sleep", wombatTimer = 0;
export function pokeWombats() { wombatState = "play"; wombatTimer = 0; }

function buildWombats() {
  const g = new THREE.Group();
  const plush = new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#A3A8AE"), 3, 3), roughness: 1 });
  const plushDark = new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#8A8F96"), 3, 3), roughness: 1 });

  const tub = new THREE.Mesh(new THREE.CylinderGeometry(.40, .36, .20, 28), plushDark);
  tub.position.set(BED.x, .10, BED.z); tub.castShadow = tub.receiveShadow = true; g.add(tub);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.355, .115, 12, 30), plush);
  rim.position.set(BED.x, .215, BED.z); rim.rotation.x = Math.PI / 2; rim.castShadow = true; g.add(rim);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(.30, 26),
    new THREE.MeshStandardMaterial({ map: tex(fabricTexture("#7C818A"), 2, 2), roughness: 1 }));
  inner.position.set(BED.x, .205, BED.z); inner.rotation.x = -Math.PI / 2; g.add(inner);

  const boxM = new THREE.MeshStandardMaterial({ color: "#B08A5C", roughness: .95 });
  const cbox = new THREE.Mesh(new THREE.BoxGeometry(.34, .2, .28), boxM);
  cbox.position.set(BED.x + .95, .1, BED.z + .5); cbox.rotation.y = .5; cbox.castShadow = true; g.add(cbox);

  const A = makeWombat("#4A3A2C"), B = makeWombat("#5A4536");
  g.add(A, B);

  const hots = [A, B].map(() => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(.42, .38, .5), new THREE.MeshBasicMaterial({ visible: false }));
    addClickable(h, "wombat"); g.add(h); return h;
  });

  S.scene.add(g);
  block(BED.x - .5, BED.x + .5, BED.z - .5, BED.z + .5);
  hotspots.wombat = { stand: [BED.x - .95, BED.z + .35] };

  const w = [
    { o: A, p: new THREE.Vector2(BED.x - .08, BED.z - .02), t: new THREE.Vector2(), yaw: 2.1, sp: .55, ph: 0 },
    { o: B, p: new THREE.Vector2(BED.x + .9, BED.z + .3), t: new THREE.Vector2(), yaw: 0, sp: .62, ph: 1.7 }
  ];
  const home = i => new THREE.Vector2(BED.x + (i ? .13 : -.13), BED.z + (i ? .1 : -.06));
  const roam = () => new THREE.Vector2(BED.x + rnd(-1.5, 1.5), BED.z + rnd(-1.3, 1.5));
  w.forEach((x, i) => x.t.copy(home(i)));

  const STATES = ["sleep", "play", "wander", "cuddle"];
  const pickState = () => {
    const next = pick(STATES.filter(s => s !== wombatState));
    wombatState = next;
    wombatTimer = 0;
  };

  onFrame((t, dt) => {
    wombatTimer += dt;
    const dur = wombatState === "play" ? 14 : wombatState === "wander" ? 12 : 18;
    if (wombatTimer > dur) pickState();

    w.forEach((x, i) => {
      const inBedState = wombatState === "sleep" || wombatState === "cuddle";
      if (inBedState) x.t.copy(home(i));
      else if (wombatState === "wander") {
        if (x.p.distanceTo(x.t) < .12 || x.t.equals(home(i))) x.t.copy(roam());
      } else {                                   // play: B chases A, A circles away
        if (i === 0) {
          const a = t * .9;
          x.t.set(BED.x + Math.cos(a) * 1.15, BED.z + Math.sin(a) * .95);
        } else {
          x.t.copy(w[0].p).add(new THREE.Vector2(Math.cos(t * 2) * .3, Math.sin(t * 2) * .3));
        }
      }

      const d = x.t.clone().sub(x.p);
      const len = d.length();
      const speed = inBedState ? 0 : x.sp * (wombatState === "play" ? 1.35 : 1);
      let moving = false;
      if (len > .06 && speed > 0) {
        d.multiplyScalar(Math.min(speed * dt, len) / len);
        x.p.add(d);
        moving = true;
        const want = Math.atan2(d.x, d.y);
        let diff = want - x.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        x.yaw += diff * Math.min(1, dt * 8);
      }

      const onBed = inBedState;
      const y = onBed ? .175 : .012 + (moving ? Math.abs(Math.sin(t * 7 + x.ph)) * .012 : 0);
      x.o.position.set(x.p.x, y, x.p.y);
      x.o.rotation.y = onBed ? (i ? 1.1 : 2.1) : x.yaw;
      x.o.rotation.z = moving ? Math.sin(t * 7 + x.ph) * .06 : 0;

      const breathe = 1 + Math.sin(t * 1.6 + x.ph) * (onBed ? .045 : .02);
      x.o.scale.set(.95, .95 * breathe, .95);
      x.o.userData.legs.forEach((l, k) => {
        l.position.y = .038 + (moving ? Math.max(0, Math.sin(t * 13 + k * 1.7 + x.ph)) * .022 : 0);
      });
      // a curious sniff when idle
      x.o.userData.head.rotation.x = moving ? 0 : Math.sin(t * 2.2 + x.ph) * .12;

      hots[i].position.set(x.p.x, y + .22, x.p.y);
    });
  });
}

/* ── plants ────────────────────────────────── */
function buildGreenery() {
  const potM = new THREE.MeshStandardMaterial({ color: "#D8D2C6", roughness: .8 });
  const leafM = c => new THREE.MeshStandardMaterial({
    map: new THREE.CanvasTexture(leafSprite(c)), transparent: true, alphaTest: .5,
    side: THREE.DoubleSide, roughness: .9
  });

  const palm = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.19, .15, .34, 16), potM);
  pot.position.y = .17; pot.castShadow = true; palm.add(pot);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd(-.2, .2);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.62, .26), leafM(i % 2 ? "#3F7A4A" : "#4E8E55"));
    l.position.set(Math.cos(a) * .22, .48 + rnd(-.1, .34), Math.sin(a) * .22);
    l.rotation.set(rnd(-.5, .1), -a, rnd(-.4, .4));
    palm.add(l);
  }
  // kept clear of the stair foot on the left wall
  palm.position.set(-3.0, 0, -R.D / 2 + .45); S.scene.add(palm);
  block(-3.3, -2.7, -R.D / 2, -R.D / 2 + .75);

  const hang = new THREE.Group();
  const hp = new THREE.Mesh(new THREE.CylinderGeometry(.15, .12, .2, 14), potM);
  hp.castShadow = true; hang.add(hp);
  for (let i = 0; i < 22; i++) {
    const a = rnd(0, 6.28), r = rnd(.05, .16);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.34, .15), leafM(i % 2 ? "#417C4C" : "#57975E"));
    l.position.set(Math.cos(a) * r, rnd(-.75, -.02), Math.sin(a) * r);
    l.rotation.set(rnd(-.7, .3), rnd(0, 6.28), rnd(-.6, .6));
    hang.add(l);
  }
  hang.position.set(-R.HW + .55, 1.95, 3.5); S.scene.add(hang);

  [[-R.HW + .13, 1.48, 1.7], [-R.HW + .13, 1.48, 2.4], [R.HW - .3, 1.14, -1.0], [R.HW - .3, 1.14, -2.8]]
    .forEach(([x, y, z], i) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.075, .06, .13, 12), potM);
      p.position.set(x, y + .065, z); p.castShadow = true; S.scene.add(p);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * 6.28;
        const l = new THREE.Mesh(new THREE.PlaneGeometry(.22, .1), leafM(i % 2 ? "#4A8752" : "#3E7748"));
        l.position.set(x + Math.cos(a) * .05, y + .19 + rnd(-.02, .07), z + Math.sin(a) * .05);
        l.rotation.set(rnd(-.6, -.1), -a, rnd(-.3, .3));
        S.scene.add(l);
      }
    });

  const tree = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(.19 - i * .04, .17, 10),
      new THREE.MeshStandardMaterial({ color: "#28503A", roughness: 1 }));
    c.position.y = .16 + i * .11; c.castShadow = true; tree.add(c);
  }
  const tk = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, .1, 8),
    new THREE.MeshStandardMaterial({ color: "#4A3220", roughness: 1 }));
  tk.position.y = .05; tree.add(tk);
  for (let i = 0; i < 12; i++) {
    const a = rnd(0, 6.28), yy = rnd(.14, .5), r = (1 - (yy - .14) / .4) * .15 + .03;
    const o = new THREE.Mesh(new THREE.SphereGeometry(.017, 6, 6),
      registerStrip(new THREE.MeshBasicMaterial({ color: "#FFD27A", toneMapped: false })));
    o.position.set(Math.cos(a) * r, yy, Math.sin(a) * r); tree.add(o);
  }
  const tl = new THREE.PointLight("#FFC97A", .7, 1.6, 2); tl.position.y = .3; tree.add(tl);
  registerLight(tl);
  tree.position.set(-.15, .58, -R.D / 2 + .32); S.scene.add(tree);
}

/* ── lights ────────────────────────────────── */
function buildLights() {
  const hemi = new THREE.HemisphereLight("#7C90B4", "#6A5240", 1.0);
  const amb = new THREE.AmbientLight("#8A7660", .55);
  S.scene.add(hemi, amb);
  registerAmbient(amb, hemi);

  const moon = new THREE.DirectionalLight("#BBD3F0", 1.5);
  moon.position.set(-9, 11, 3);
  moon.target.position.set(0, .8, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.setScalar(innerWidth < 800 ? 1024 : 2048);
  moon.shadow.camera.left = -8; moon.shadow.camera.right = 8;
  moon.shadow.camera.top = 9; moon.shadow.camera.bottom = -9;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 34;
  moon.shadow.bias = -.0016; moon.shadow.normalBias = .028;
  S.scene.add(moon, moon.target);
}
