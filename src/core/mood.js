import * as THREE from "three";
import { $ } from "./engine.js";

/* The light switch. Anything registered here changes colour together;
   "Off" kills them and drops the room to moonlight only. */

export const MOODS = [
  { n: "Warm yellow",  c: "#FFD54A" },
  { n: "Sky blue",     c: "#79C6F2" },
  { n: "Magenta",      c: "#E8409E" },
  { n: "White",        c: "#FFF6EC" },
  { n: "Red",          c: "#FF4038" },
  { n: "Pink",         c: "#FF93B8" },
  { n: "Deep orange",  c: "#FF6A16" },
  { n: "Light yellow", c: "#FFF2C0" },
  { n: "Off",          c: "#20222A", off: true }
];

const mats = [];    // emissive strips: colour swaps directly
const lights = [];  // {light, base} so intensity can be restored
const lamps = [];   // warm practicals that also go dark when off

export function registerStrip(material) { mats.push(material); return material; }
export function registerLight(light) { lights.push({ l: light, base: light.intensity }); return light; }
export function registerLamp(light, emissiveMat) { lamps.push({ l: light, base: light.intensity, m: emissiveMat, e: emissiveMat?.emissiveIntensity ?? 0 }); return light; }

let ambient = null, hemi = null, ambientBase = 0, hemiBase = 0;
export function registerAmbient(a, h) {
  ambient = a; hemi = h; ambientBase = a.intensity; hemiBase = h.intensity;
}

export let current = 0;

export function setMood(i) {
  current = i;
  const m = MOODS[i];
  const col = new THREE.Color(m.c);

  for (const mat of mats) {
    mat.color.copy(col);
    if ("opacity" in mat) mat.opacity = m.off ? .35 : 1;
  }
  for (const { l, base } of lights) {
    l.color.copy(col);
    l.intensity = m.off ? 0 : base;
  }
  for (const { l, base, m: em, e } of lamps) {
    l.intensity = m.off ? 0 : base;
    if (em) em.emissiveIntensity = m.off ? 0 : e;
  }
  if (ambient) ambient.intensity = m.off ? ambientBase * .12 : ambientBase;
  if (hemi) hemi.intensity = m.off ? hemiBase * .16 : hemiBase;

  document.querySelectorAll("#moods button").forEach((b, k) =>
    b.setAttribute("aria-pressed", k === i ? "true" : "false"));
  const label = $("#moodname");
  if (label) label.textContent = m.n;
  document.body.classList.toggle("lights-out", !!m.off);
}

export function buildSwitch() {
  const wrap = $("#moods");
  wrap.innerHTML = MOODS.map((m, i) =>
    `<button type="button" data-i="${i}" title="${m.n}" aria-label="${m.n}"
      class="${m.off ? "off" : ""}" style="--sw:${m.c}">${m.off ? "⏻" : ""}</button>`).join("");
  wrap.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) setMood(+b.dataset.i);
  });
  setMood(0);
}
