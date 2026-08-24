#!/usr/bin/env node
/**
 * Pull one generated Stitch screen into the prototype and make it NAVIGABLE.
 *
 *   node tools/fetch-screen.cjs <slug> "<downloadUrl>"
 *
 * Stitch emits a static page. This wraps it so the prototype behaves like the product:
 * any element whose visible text matches one of the slug's transition labels becomes a
 * real click target that drives the player.
 *
 * ⚠ The label match is on RENDERED TEXT, deliberately — not on a class or a data-attribute.
 * Stitch re-generates markup freely between runs, so a structural selector would silently
 * stop matching and the screen would look wired while being dead. Text is the only thing
 * the prompt actually pins, so it is the only honest hook. If a label stops matching, the
 * banner says so out loud rather than failing silent.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");

// Must stay in sync with journey.js `next[].label`.
const HOPS = {
  "library":        [["Build a workflow", "doors"], ["Run", "run-dialog"], ["Open", "builder-spine"]],
  "doors":          [["Describe it", "draft-arrival"], ["Build it yourself", "builder-spine"]],
  "draft-arrival":  [["Open in the builder", "builder-spine"], ["Publish", "publish"]],
  "run-dialog":     [["Run workflow", "run-surface"], ["Cancel", "library"]],
  "builder-spine":  [["Publish", "publish"], ["Canvas", "builder-canvas"], ["Workflows", "library"]],
  "builder-canvas": [["Spine", "builder-spine"]],
  "step-panel":     [["Publish", "publish"], ["Close", "builder-spine"]],
  "publish":        [["run the gauntlet", "run-surface"], ["Close", "builder-spine"]],
  "run-surface":    [["Workflows", "library"]],
  // The state sheets are specimens, not journey steps — no transitions, by design.
  "node-identity":   [],
  "run-panel-parts": [],
  "fork-delete":     [],
  "connections":     [],
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location));
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      let b = "";
      res.setEncoding("utf8");
      res.on("data", d => (b += d));
      res.on("end", () => resolve(b));
    }).on("error", reject);
  });
}

function bridge(slug) {
  const hops = HOPS[slug] || [];
  return `
<script>
(function(){
  var HOPS = ${JSON.stringify(hops)};
  var wired = 0, missed = [];
  HOPS.forEach(function(pair){
    var label = pair[0], to = pair[1], hit = null;
    var all = document.querySelectorAll("button,a,[role=button],div,span,p");
    for (var i=0;i<all.length;i++){
      var el = all[i];
      if (el.children.length) continue;
      if ((el.textContent||"").trim().toLowerCase().indexOf(label.toLowerCase()) !== -1){ hit = el; break; }
    }
    if (!hit){ missed.push(label); return; }
    var target = hit.closest("button,a,[role=button]") || hit;
    target.style.cursor = "pointer";
    target.setAttribute("data-hop", to);
    target.addEventListener("click", function(e){
      e.preventDefault(); e.stopPropagation();
      parent.postMessage({ type:"hop", to: to }, "*");
    }, true);
    wired++;
  });
  parent.postMessage({ type:"wired", slug:${JSON.stringify(slug)}, wired: wired, missed: missed }, "*");
})();
</script>`;
}

(async () => {
  const [slug, url] = process.argv.slice(2);
  if (!slug || !url) {
    console.error("usage: node tools/fetch-screen.cjs <slug> <downloadUrl>");
    process.exit(2);
  }
  let html = await get(url);
  if (!/<\/body>/i.test(html)) html += "</body>";
  html = html.replace(/<\/body>/i, bridge(slug) + "\n</body>");

  const out = path.join(ROOT, "screens", slug + ".html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, "utf8");

  const hops = (HOPS[slug] || []).map(h => h[0]);
  console.log("wrote " + path.relative(ROOT, out) + "  (" + html.length + " bytes)");
  console.log("hop labels this screen must contain: " + (hops.join(" · ") || "(none)"));
  console.log("open the player and read the wiring banner — a label that did not match is reported, never silently dropped.");
})().catch(e => { console.error("FAILED: " + e.message); process.exit(1); });
