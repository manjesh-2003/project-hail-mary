/* Bundles a room into one self-contained HTML file.
   Everything is inlined because the pages have to run from a file://
   path, from GitHub Pages, and from an Artifact host with a strict CSP. */

import * as esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOMS = {
  /* out/ is docs/ because that is what GitHub Pages serves: docs/index.html
     lands at https://<user>.github.io/<repo>/ with no path after it. */
  "sid-loft": { entry: "src/main.js", shell: "src/shell.html", out: "docs/index.html", body: "dist/sid-loft.body.html" }
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

mkdirSync(dirname(resolve(here, cfg.out)), { recursive: true });
writeFileSync(resolve(here, cfg.out), page);
/* The body on its own, for publishing as an Artifact (which supplies its own
   <head>). Build output, not source — dist/ is gitignored. */
mkdirSync(dirname(resolve(here, cfg.body)), { recursive: true });
writeFileSync(resolve(here, cfg.body), body);

console.log(`${which}: bundle ${Math.round(js.length / 1024)}KB · page ${Math.round(page.length / 1024)}KB → ${cfg.out}`);
