#!/usr/bin/env node
/**
 * Pull EVERY screen of the Stitch project into the prototype in one pass.
 *
 *   node tools/sync.cjs screens.json
 *
 * `screens.json` is the raw `list_screens` result. Titles are matched to prototype slugs by the
 * TITLE_MAP below, newest-wins.
 *
 * ⚠ NEWEST-WINS IS LOAD-BEARING, AND IT IS WHY THIS EXISTS. Stitch sometimes answers an EDIT by
 * creating a NEW screen with a new title (`Spine View` -> `Spine Detail View`, `Canvas View` ->
 * `Live Canvas View`). Matching on title alone would then keep pointing the prototype at the
 * SUPERSEDED screen while everything looked fine — the revision would be invisible rather than
 * missing. So a slug takes the LAST matching title in the list, and every decision is printed.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const HERE = __dirname;

// slug -> ordered title patterns, LATER entries win
const TITLE_MAP = [
  ["library",        [/workflows library/i]],
  ["doors",          [/start a new workflow/i, /two doors/i]],
  ["draft-arrival",  [/arrival/i]],
  ["builder-spine",  [/spine view/i, /spine detail/i]],
  ["builder-canvas", [/canvas view/i, /live canvas/i]],
  ["step-panel",     [/step configuration/i, /advanced details/i]],
  ["publish",        [/gauntlet/i, /publish workflow/i]],
  ["run-dialog",     [/run dialog/i]],
  ["run-surface",    [/run monitoring/i, /run surface/i]],
  ["node-identity",  [/step node/i, /node identity/i]],
  ["run-panel-parts",[/run panel/i]],
  ["fork-delete",    [/fork/i, /delete/i, /two dialogs/i]],
  ["connections",    [/connection/i]],
];

const raw = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const screens = raw.screens || [];

const chosen = new Map();
for (const [slug, pats] of TITLE_MAP) {
  for (const sc of screens) {
    const title = sc.title || "";
    if (pats.some(p => p.test(title))) chosen.set(slug, sc); // later match wins
  }
}

let ok = 0, skipped = [];
for (const [slug] of TITLE_MAP) {
  const sc = chosen.get(slug);
  if (!sc) { skipped.push(slug); continue; }
  const url = sc.htmlCode && sc.htmlCode.downloadUrl;
  if (!url) { skipped.push(slug + " (no html)"); continue; }
  try {
    execFileSync("node", [path.join(HERE, "fetch-screen.cjs"), slug, url], { stdio: "pipe" });
    console.log(`  ok  ${slug.padEnd(18)} <- "${sc.title}"`);
    ok++;
  } catch (e) {
    console.log(`  FAIL ${slug} :: ${e.message.split("\n")[0]}`);
  }
}
console.log(`\n${ok} pulled.`);
if (skipped.length) console.log(`not found yet: ${skipped.join(", ")}`);
