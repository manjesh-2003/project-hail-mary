import * as THREE from "three";

export const S = {
  renderer: null, scene: null, camera: null,
  clickable: [],      // meshes that open something
  walkable: [],       // meshes you can click to walk onto
  anim: [],           // per-frame callbacks (t, dt)
  frames: 0,
  mode: "room"        // "room" | "sky"
};

export const $ = s => document.querySelector(s);
export const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function initEngine(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.25;
  S.renderer = r;

  S.scene = new THREE.Scene();
  S.scene.background = new THREE.Color("#06060A");

  S.camera = new THREE.PerspectiveCamera(58, 1, .08, 140);

  addEventListener("resize", resize);
  resize();
  return S;
}

export function resize() {
  S.camera.aspect = innerWidth / innerHeight;
  S.camera.updateProjectionMatrix();
  S.renderer.setSize(innerWidth, innerHeight, false);
}

export const onFrame = fn => S.anim.push(fn);

/* every interactive thing carries where the player should stand to use it */
export function addClickable(mesh, kind, extra = {}) {
  mesh.userData = { kind, ...extra };
  S.clickable.push(mesh);
  return mesh;
}

/* Place a mesh using explicit basis vectors — used for the roof planes,
   whose orientation can't be expressed as a simple Euler rotation. */
export function orient(mesh, origin, xAxis, yAxis) {
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
  mesh.matrixAutoUpdate = false;
  mesh.matrix.makeBasis(xAxis.clone().normalize(), yAxis.clone().normalize(), zAxis);
  mesh.matrix.setPosition(origin);
  mesh.matrixWorldNeedsUpdate = true;
  return mesh;
}

const clock = new THREE.Clock();

export function startLoop(perFrame) {
  S.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), .05);
    const t = clock.elapsedTime;
    perFrame(t, dt);
    for (const f of S.anim) f(t, dt);
    S.renderer.render(S.scene, S.camera);

    // frame-counted, so a busy main thread can't strand the loading card
    S.frames++;
    if (S.frames === 3) $("#load")?.classList.add("gone");
    else if (S.frames === 45) $("#load")?.remove();
  });
}
