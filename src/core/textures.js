import * as THREE from "three";

/* Every surface in the house is drawn at runtime on a <canvas>.
   No image files, so a room stays one self-contained page. */

export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];

export function cv(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}

export function tex(canvas, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* fit text to a width by shrinking the font until it does */
export function fitText(g, text, maxW, startPx, weight, family) {
  let px = startPx;
  do {
    g.font = `${weight} ${px}px ${family}`;
    if (g.measureText(text).width <= maxW) break;
    px -= 2;
  } while (px > 12);
  return px;
}

export function woodTexture(base, dark, planks = 6) {
  const [c, g] = cv(512, 512);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const step = 512 / planks;
  for (let i = 0; i < planks; i++) {
    const y = i * step;
    g.fillStyle = `rgba(0,0,0,${rnd(.015, .075).toFixed(3)})`; g.fillRect(0, y, 512, step);
    g.strokeStyle = dark; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
    for (let k = 0; k < 20; k++) {
      g.strokeStyle = `rgba(0,0,0,${rnd(.015, .06).toFixed(3)})`; g.lineWidth = rnd(.5, 1.8);
      const yy = y + rnd(3, step - 3);
      g.beginPath(); g.moveTo(0, yy);
      g.bezierCurveTo(170, yy + rnd(-4, 4), 340, yy + rnd(-4, 4), 512, yy + rnd(-3, 3)); g.stroke();
    }
  }
  return c;
}

export function brickTexture() {
  const [c, g] = cv(1024, 512);
  g.fillStyle = "#5C4A3E"; g.fillRect(0, 0, 1024, 512);
  const bw = 128, bh = 42, gap = 6;
  const tones = ["#9A5B3C", "#A8664A", "#8E4F35", "#B3714F", "#7E4530", "#A25E3F", "#95573A"];
  for (let row = 0, y = 0; y < 512; row++, y += bh + gap) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let x = off; x < 1024 + bw; x += bw + gap) {
      g.fillStyle = pick(tones); g.fillRect(x, y, bw, bh);
      g.fillStyle = `rgba(0,0,0,${rnd(.02, .12).toFixed(3)})`; g.fillRect(x, y, bw, bh);
      g.fillStyle = "rgba(255,255,255,.055)"; g.fillRect(x, y, bw, 2);
      for (let k = 0; k < 22; k++) {
        g.fillStyle = `rgba(0,0,0,${rnd(.02, .09).toFixed(3)})`;
        g.fillRect(x + rnd(0, bw), y + rnd(0, bh), rnd(1, 5), rnd(1, 3));
      }
    }
  }
  return c;
}

export function plasterTexture(base) {
  const [c, g] = cv(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd(.01, .04).toFixed(3)})`;
    g.fillRect(rnd(0, 256), rnd(0, 256), rnd(1, 3), rnd(1, 3));
  }
  return c;
}

export function fabricTexture(base) {
  const [c, g] = cv(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "0,0,0"},${rnd(.01, .05).toFixed(3)})`;
    g.fillRect(rnd(0, 256), rnd(0, 256), 2, 1);
  }
  return c;
}

export function plainRugTexture(base, border, accent) {
  const [c, g] = cv(512, 512);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = border; g.lineWidth = 26; g.strokeRect(30, 30, 452, 452);
  g.strokeStyle = accent; g.lineWidth = 5;
  g.strokeRect(56, 56, 400, 400); g.strokeRect(14, 14, 484, 484);
  for (let i = 0; i < 18000; i++) {
    g.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "0,0,0"},${rnd(.015, .07).toFixed(3)})`;
    g.fillRect(rnd(0, 512), rnd(0, 512), 2, 1);
  }
  return c;
}

/* Indian carpet: madder-red field, indigo and gold borders,
   a central medallion with corner spandrels and boteh motifs. */
export function indianRugTexture() {
  const S = 1024;
  const [c, g] = cv(S, S);
  const RED = "#8E2622", INDIGO = "#1E3A5C", GOLD = "#D2A44A",
        CREAM = "#E8D8B4", TEAL = "#2C6E63", ROSE = "#C4585A";

  g.fillStyle = RED; g.fillRect(0, 0, S, S);

  const band = (inset, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.strokeRect(inset, inset, S - inset * 2, S - inset * 2); };
  band(18, 30, INDIGO); band(44, 8, GOLD); band(74, 44, CREAM); band(112, 8, GOLD); band(134, 22, INDIGO);

  // boteh (paisley) running round the cream border
  const boteh = (x, y, s, rot, col) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.beginPath();
    g.moveTo(0, 14); g.bezierCurveTo(-13, 6, -12, -10, 0, -14);
    g.bezierCurveTo(9, -17, 14, -6, 6, 2); g.bezierCurveTo(2, 6, 2, 10, 0, 14);
    g.closePath(); g.fillStyle = col; g.fill();
    g.restore();
  };
  for (let i = 0; i < 13; i++) {
    const t = 96 + i * ((S - 192) / 12);
    boteh(t, 96, 1.05, 0, INDIGO); boteh(t, S - 96, 1.05, Math.PI, INDIGO);
    boteh(96, t, 1.05, -Math.PI / 2, INDIGO); boteh(S - 96, t, 1.05, Math.PI / 2, INDIGO);
  }

  // field lattice
  g.strokeStyle = "rgba(232,216,180,.22)"; g.lineWidth = 2;
  for (let x = 190; x < S - 170; x += 62)
    for (let y = 190; y < S - 170; y += 62) {
      g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x + 16, y); g.lineTo(x, y + 16); g.lineTo(x - 16, y);
      g.closePath(); g.stroke();
    }
  for (let i = 0; i < 46; i++) boteh(rnd(200, S - 200), rnd(200, S - 200), .62, rnd(0, 6.28), "rgba(232,216,180,.30)");

  // central medallion
  const cx = S / 2, cy = S / 2;
  const petal = (r1, r2, n, col, phase) => {
    g.beginPath();
    for (let a = 0; a <= 360; a += 2) {
      const rad = a * Math.PI / 180;
      const r = r1 + Math.sin(rad * n + phase) * r2;
      const x = cx + Math.cos(rad) * r, y = cy + Math.sin(rad) * r * .8;
      a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.fillStyle = col; g.fill();
  };
  petal(196, 26, 16, INDIGO, 0);
  petal(172, 22, 16, GOLD, 0);
  petal(150, 20, 16, CREAM, 0);
  petal(104, 16, 12, TEAL, .3);
  petal(66, 12, 8, ROSE, 0);
  g.fillStyle = GOLD; g.beginPath(); g.ellipse(cx, cy, 30, 24, 0, 0, 7); g.fill();
  g.fillStyle = INDIGO; g.beginPath(); g.ellipse(cx, cy, 14, 11, 0, 0, 7); g.fill();

  // corner spandrels
  [[200, 200, 0], [S - 200, 200, Math.PI / 2], [S - 200, S - 200, Math.PI], [200, S - 200, -Math.PI / 2]]
    .forEach(([x, y, r]) => {
      g.save(); g.translate(x, y); g.rotate(r);
      g.fillStyle = INDIGO;
      g.beginPath(); g.moveTo(-46, -46); g.quadraticCurveTo(52, -40, 46, 48);
      g.quadraticCurveTo(-6, 8, -46, -46); g.closePath(); g.fill();
      g.fillStyle = GOLD;
      g.beginPath(); g.ellipse(-4, -6, 15, 11, .6, 0, 7); g.fill();
      g.restore();
    });

  // pile wear
  for (let i = 0; i < 42000; i++) {
    g.fillStyle = `rgba(${Math.random() < .5 ? "255,255,255" : "0,0,0"},${rnd(.012, .06).toFixed(3)})`;
    g.fillRect(rnd(0, S), rnd(0, S), 2, 1);
  }
  // fringe
  g.strokeStyle = CREAM; g.lineWidth = 3;
  for (let x = 14; x < S - 10; x += 9) {
    g.beginPath(); g.moveTo(x, 2); g.lineTo(x, 16); g.stroke();
    g.beginPath(); g.moveTo(x, S - 2); g.lineTo(x, S - 16); g.stroke();
  }
  return c;
}

export function spineTexture(b) {
  const [c, g] = cv(256, 1024);
  g.fillStyle = b.c; g.fillRect(0, 0, 256, 1024);
  const grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0, "rgba(255,255,255,.16)");
  grd.addColorStop(.35, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,.35)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 1024);
  g.fillStyle = "rgba(214,178,102,.9)";
  g.fillRect(22, 70, 212, 7); g.fillRect(22, 108, 212, 3);
  g.fillRect(22, 916, 212, 3); g.fillRect(22, 947, 212, 7);
  g.save(); g.translate(128, 512); g.rotate(-Math.PI / 2);
  g.fillStyle = "#EAD9A8";
  const t = b.t.length > 30 ? b.t.slice(0, 29) + "…" : b.t;
  fitText(g, t, 720, 74, 600, "Fraunces, Georgia, serif");
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(t, 0, 4);
  g.restore();
  return c;
}

/* ── screens ──────────────────────────────────
   Rebuilt for legibility: poster block on the left,
   large type on a dark ground, generous contrast. */
export function screenTexture(b) {
  const W = 1536, H = 648;
  const [c, g] = cv(W, H);
  g.fillStyle = "#0C0F16"; g.fillRect(0, 0, W, H);

  // poster panel
  const PW = 420, PX = 44, PY = 74, PH = H - 74 - 128;
  const pg = g.createLinearGradient(PX, PY, PX + PW, PY + PH);
  pg.addColorStop(0, b.c); pg.addColorStop(1, "#0F1420");
  g.fillStyle = pg; g.fillRect(PX, PY, PW, PH);
  g.globalAlpha = .55;
  for (let i = 0; i < 26; i++) {
    g.fillStyle = i % 3 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.35)";
    g.beginPath(); g.ellipse(rnd(PX, PX + PW), rnd(PY, PY + PH), rnd(30, 150), rnd(8, 34), rnd(0, 3.14), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = "rgba(226,196,132,.75)"; g.lineWidth = 3;
  g.strokeRect(PX + 12, PY + 12, PW - 24, PH - 24);
  g.save();
  g.translate(PX + PW / 2, PY + PH / 2);
  g.fillStyle = "#F6EEDC"; g.textAlign = "center"; g.textBaseline = "middle";
  const short = b.t.split(":")[0];
  fitText(g, short, PH - 90, 66, 700, "Fraunces, Georgia, serif");
  g.rotate(-Math.PI / 2);
  g.fillText(short, 0, 0);
  g.restore();

  // header
  g.fillStyle = "#141925"; g.fillRect(0, 0, W, 58);
  g.fillStyle = "#F0A63A"; g.font = "700 24px Karla, sans-serif";
  g.textBaseline = "middle"; g.textAlign = "left";
  g.fillText("● NOW PLAYING", 44, 30);
  g.textAlign = "right"; g.fillStyle = "rgba(236,228,214,.75)";
  g.font = "500 22px Karla, sans-serif";
  g.fillText(`${b.studio}  ·  ${b.y}`, W - 44, 30);

  // title block
  const TX = PX + PW + 56, TW = W - TX - 56;
  g.textAlign = "left"; g.fillStyle = "#FFFFFF";
  const size = fitText(g, b.t, TW, 82, 700, "Fraunces, Georgia, serif");
  g.textBaseline = "alphabetic";
  g.fillText(b.t, TX, 214);
  g.fillStyle = "rgba(255,255,255,.62)";
  g.font = "400 30px Karla, sans-serif";
  g.fillText(b.jp, TX + 2, 214 + size * .62);
  g.fillStyle = "rgba(240,166,58,.95)";
  g.font = "600 24px Karla, sans-serif";
  g.fillText(b.g.join("   ·   ").toUpperCase(), TX + 2, 214 + size * .62 + 52);

  // transport
  g.fillStyle = "#141925"; g.fillRect(0, H - 128, W, 128);
  const pct = b.seen / b.eps;
  g.fillStyle = "#2E3648"; g.fillRect(44, H - 84, W - 88, 10);
  g.fillStyle = "#F0A63A"; g.fillRect(44, H - 84, (W - 88) * pct, 10);
  g.beginPath(); g.arc(44 + (W - 88) * pct, H - 79, 14, 0, 7); g.fill();
  g.fillStyle = "#FFFFFF"; g.font = "600 28px Karla, sans-serif";
  g.fillText(`Episode ${b.seen}`, 44, H - 32);
  g.textAlign = "right"; g.fillStyle = "rgba(255,255,255,.65)";
  g.fillText(`${b.eps - b.seen} left of ${b.eps}`, W - 44, H - 32);
  g.textAlign = "center"; g.fillStyle = "#FFFFFF";
  g.beginPath(); g.moveTo(W / 2 - 12, H - 52); g.lineTo(W / 2 - 12, H - 16);
  g.lineTo(W / 2 + 20, H - 34); g.closePath(); g.fill();
  return c;
}

export function tvTexture(b) {
  const W = 1280, H = 720;
  const [c, g] = cv(W, H);
  g.fillStyle = "#0A0D14"; g.fillRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, b.c); bg.addColorStop(.6, "#101724"); bg.addColorStop(1, "#05070C");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.globalAlpha = .45;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = i % 3 ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.4)";
    g.beginPath(); g.ellipse(rnd(0, W), rnd(0, H), rnd(60, 320), rnd(12, 60), rnd(0, 3.14), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  const vg = g.createLinearGradient(0, H * .3, 0, H);
  vg.addColorStop(0, "rgba(4,6,10,0)"); vg.addColorStop(1, "rgba(4,6,10,.94)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = "#F0A63A"; g.font = "700 30px Karla, sans-serif";
  g.letterSpacing = "9px";
  g.fillText("UP NEXT", 70, 430);
  g.letterSpacing = "0px";
  g.fillStyle = "#FFFFFF";
  fitText(g, b.t, W - 140, 92, 700, "Fraunces, Georgia, serif");
  g.fillText(b.t, 70, 528);
  g.fillStyle = "rgba(255,255,255,.72)";
  g.font = "500 30px Karla, sans-serif";
  g.fillText(`${b.eps} episodes  ·  ${b.studio}  ·  ${b.y}`, 72, 580);

  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 4;
  g.beginPath(); g.roundRect(70, 616, 200, 58, 29); g.stroke();
  g.fillStyle = "#FFFFFF"; g.font = "600 26px Karla, sans-serif";
  g.fillText("▶  Start", 112, 653);
  return c;
}

export function skyTexture() {
  const [c, g] = cv(2048, 1024);
  const grd = g.createLinearGradient(0, 0, 0, 1024);
  grd.addColorStop(0, "#050915"); grd.addColorStop(.45, "#0C1730"); grd.addColorStop(.75, "#1D2E52");
  grd.addColorStop(1, "#38507A");
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(226,236,255,${rnd(.12, .95).toFixed(2)})`;
    g.beginPath(); g.arc(rnd(0, 2048), rnd(0, 760), rnd(.6, 2.0), 0, 7); g.fill();
  }
  // a scatter of fainter, further stars rather than smeared cloud
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(200,214,240,${rnd(.05, .3).toFixed(2)})`;
    g.fillRect(rnd(0, 2048), rnd(0, 800), 1, 1);
  }
  return c;
}

export function moonTexture() {
  const [c, g] = cv(512, 512);
  // fill edge to edge: transparent canvas maps to black on the sphere's poles
  g.fillStyle = "#F2F4F8"; g.fillRect(0, 0, 512, 512);
  const seas = [[190, 180, 70], [300, 300, 58], [340, 180, 40], [200, 330, 46], [150, 250, 30]];
  seas.forEach(([x, y, r]) => {
    g.fillStyle = "rgba(178,188,206,.55)";
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  });
  for (let i = 0; i < 40; i++) {
    const x = rnd(40, 472), y = rnd(40, 472);
    if (Math.hypot(x - 256, y - 256) > 240) continue;
    g.fillStyle = `rgba(160,172,192,${rnd(.15, .45).toFixed(2)})`;
    g.beginPath(); g.arc(x, y, rnd(4, 18), 0, 7); g.fill();
  }
  return c;
}

export function snowSprite() {
  const [c, g] = cv(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(.4, "rgba(255,255,255,.7)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return c;
}

export function leafSprite(col) {
  const [c, g] = cv(64, 64);
  g.fillStyle = col;
  g.beginPath(); g.ellipse(32, 32, 30, 13, Math.PI / 5, 0, 7); g.fill();
  return c;
}

export function plaqueTexture(label) {
  const [c, g] = cv(512, 96);
  g.fillStyle = "#8A6A32"; g.fillRect(0, 0, 512, 96);
  g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, 78, 512, 18);
  g.fillStyle = "#F4E4B8";
  g.textAlign = "center"; g.textBaseline = "middle"; g.letterSpacing = "5px";
  fitText(g, label, 460, 44, 600, "Karla, sans-serif");
  g.fillText(label, 256, 50);
  g.letterSpacing = "0px";
  return c;
}

/* blocky character skin — one texture, six faces via UV offsets is
   overkill here, so each body part gets its own small canvas */
export function skinTexture(kind) {
  const [c, g] = cv(64, 64);
  if (kind === "face") {
    g.fillStyle = "#D9A57E"; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#3D2C22"; g.fillRect(0, 0, 64, 16);            // fringe
    g.fillStyle = "#FFFFFF"; g.fillRect(14, 28, 12, 10); g.fillRect(38, 28, 12, 10);
    g.fillStyle = "#25313F"; g.fillRect(18, 30, 6, 7); g.fillRect(42, 30, 6, 7);
    g.fillStyle = "#B07A5A"; g.fillRect(26, 42, 12, 4);
    g.fillStyle = "#8A5442"; g.fillRect(22, 50, 20, 4);
  } else if (kind === "hair") {
    g.fillStyle = "#3D2C22"; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 200; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd(.02, .07).toFixed(3)})`;
      g.fillRect(rnd(0, 64), rnd(0, 64), 3, 1);
    }
  } else if (kind === "shirt") {
    g.fillStyle = "#2F6E63"; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#28605A"; g.fillRect(0, 46, 64, 18);
    g.fillStyle = "#357A6E"; g.fillRect(0, 0, 64, 6);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd(.01, .05).toFixed(3)})`;
      g.fillRect(rnd(0, 64), rnd(0, 64), 2, 1);
    }
  } else {
    g.fillStyle = "#39435C"; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#323B51"; g.fillRect(0, 40, 64, 24);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
