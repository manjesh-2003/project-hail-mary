/* Bundles a room into one self-contained HTML file in dist/.
   Everything is inlined because the pages have to run from a file://
   path, from GitHub Pages, and from an Artifact host with a strict CSP. */

import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOMS = {
  "sid-loft": { entry: "src/main.js", shell: "src/shell.html", out: "dist/sid-loft.html" }
};

const which = process.argv[2] || "sid-loft";
const cfg = ROOMS[which];
if (!cfg) {
  console.error(`unknown room "${which}". known: ${Object.keys(ROOMS).join(", ")}`);
  process.exit(1);
}

const result = await esbuild.build({
  entryPoints: [resolve(here, cfg.entry)],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  write: false,
  legalComments: "none"
});

const js = result.outputFiles[0].text;
const shell = readFileSync(resolve(here, cfg.shell), "utf8");
const body = shell.replace("__BUNDLE__", () => js);

const page =
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  "</head>\n<body>\n" + body + "\n</body>\n</html>\n";

mkdirSync(resolve(here, "dist"), { recursive: true });
writeFileSync(resolve(here, cfg.out), page);
writeFileSync(resolve(here, cfg.out.replace(".html", ".body.html")), body);

console.log(`${which}: bundle ${Math.round(js.length / 1024)}KB · page ${Math.round(page.length / 1024)}KB → ${cfg.out}`);
