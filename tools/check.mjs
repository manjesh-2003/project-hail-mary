/* Headless render + interaction check.
   Software WebGL is slow, so waits are generous — this is a smoke test,
   not a benchmark. Screenshots land in tools/shots/. */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(here, "shots");
mkdirSync(SHOTS, { recursive: true });

const PAGE = "file://" + resolve(here, "..", "dist", "sid-loft.html") + "?debug=1";
const EXE = process.env.CHROMIUM || "/opt/pw-browsers/chromium";

const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errs = [];
page.on("pageerror", e => errs.push("PAGEERROR: " + e.message));
page.on("console", m => { if (m.type() === "error") errs.push("CONSOLE: " + m.text()); });

await page.goto(PAGE);
await page.waitForTimeout(24000);

const shot = f => page.screenshot({ path: resolve(SHOTS, f) });
const dbg = (fn, arg) => page.evaluate(fn, arg);

const info = await dbg(() => ({
  webgl: !!document.querySelector("#gl").getContext("webgl2"),
  clickables: window.__phm ? window.__phm.S.clickable.length : -1,
  walkable: window.__phm ? window.__phm.S.walkable.length : -1,
  moods: document.querySelectorAll("#moods button").length
}));
await shot("01-start.png");

/* park the character somewhere and frame it */
const place = async (x, z, camYaw, dist, pitch, file) => {
  await dbg(([x, z, y, d, p]) => {
    const { player, rig } = window.__phm;
    player.stop(); player.pos.x = x; player.pos.z = z;
    rig.yaw = y; rig.dist = d; rig.pitch = p;
  }, [x, z, camYaw, dist, pitch]);
  await page.waitForTimeout(1600);
  await shot(file);
};

await place(1.4, 2.6, Math.PI, 4.6, .34, "02-room.png");
await place(-1.9, -5.0, Math.PI, 2.0, .12, "03-shelf.png");
await place(2.7, -2.5, Math.PI * 1.05, 3.0, .42, "04-sofa-rug.png");
await place(3.0, 1.6, Math.PI * .5, 2.0, .16, "05-photowall.png");
await place(.4, 3.2, Math.PI, 2.6, .28, "06-wombats.png");
await place(1.7, 3.3, Math.PI * .5, 3.2, .3, "07-bed.png");

/* Software WebGL runs at a couple of frames a second, so wind the walk
   speed up for the movement checks — sub-stepping keeps collision honest. */
await dbg(() => { window.__phm.player.speed = 60; });

/* walk: click the far floor and check the character actually travels */
const before = await dbg(() => ({ x: window.__phm.player.pos.x, z: window.__phm.player.pos.z }));
await dbg(() => { window.__phm.player.goto([[0, -3.0]]); });
await page.waitForTimeout(5000);
const after = await dbg(() => ({ x: window.__phm.player.pos.x, z: window.__phm.player.pos.z }));
const walked = Math.hypot(after.x - before.x, after.z - before.z);

/* stairs up to the stargazing deck, then the sky */
await dbg(() => {
  const { player } = window.__phm;
  player.goto([[-.6, -4.7], [-2.9, -5.5], [-3.6, -5.4], [-3.6, -3.1], [-1.45, -2.93]]);
});
await page.waitForTimeout(14000);
const onDeck = await dbg(() => ({
  y: +window.__phm.player.pos.y.toFixed(2),
  x: +window.__phm.player.pos.x.toFixed(2),
  z: +window.__phm.player.pos.z.toFixed(2)
}));
await shot("08-on-deck.png");

await dbg(() => window.__phm.enterSky());
await page.waitForTimeout(2600);
await shot("09-stargazing.png");
const skyMode = await dbg(() => ({
  mode: window.__phm.S.mode,
  exitVisible: !document.querySelector("#skyexit").hidden
}));
await page.click("#skyexit");
await page.waitForTimeout(1200);
const backInRoom = await dbg(() => window.__phm.S.mode);

/* panels */
const usePanel = async kind => {
  await dbg(k => {
    const { S, use } = window.__phm;
    const o = S.clickable.find(c => c.userData.kind === k);
    if (o) use(o);
  }, kind);
  await page.waitForTimeout(13000);
  const r = await dbg(() => ({
    open: document.querySelector("#scrim").classList.contains("on"),
    title: document.querySelector(".sheet h2")?.textContent || null
  }));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  return r;
};
const book = await usePanel("book");
const photo = await usePanel("photo");
const bay = await usePanel("bay");
const wom = await usePanel("wombat");

/* lights off */
await page.click('#moods button[data-i="8"]');
await page.waitForTimeout(1400);
await place(1.4, 2.6, Math.PI, 4.6, .32, "10-lights-off.png");
const off = await dbg(() => document.querySelector("#moodname").textContent);
await page.click('#moods button[data-i="1"]');
await page.waitForTimeout(1200);
await shot("11-skyblue.png");
await page.click('#moods button[data-i="0"]');

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1800);
await shot("12-mobile.png");

console.log(JSON.stringify({
  ...info, walked: +walked.toFixed(2), onDeck, skyMode, backInRoom,
  book, photo, bay, wombat: wom, lightsOff: off,
  errors: errs.slice(0, 8)
}, null, 2));

await browser.close();
