#!/usr/bin/env node
/**
 * SKETCH 165 — final assembly. Inlines the REAL project Tailwind CSS (built from
 * `frontend/tailwind.config.js` over `body.generated.html`, so the theme tokens are
 * the app's own Deep Midnight values rather than a sketch approximation) plus this
 * sketch's own page chrome, and writes a standalone `index.html`.
 *
 * Run order (all four steps reproduce from a clean checkout — see README.md):
 *   1. copy emit.test.tsx.src into frontend/src/components/workflows/ and vitest it
 *                                    → dom.generated.json   (the REAL DOM)
 *   2. node build.cjs                → body.generated.html + BUILD-CONTRACT.generated.md
 *   3. npx tailwindcss -c <cfg> -i src/index.css -o tw.generated.css --minify
 *   4. node assemble.cjs             → index.html
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const body = fs.readFileSync(path.join(HERE, "body.generated.html"), "utf8")
const tw = fs.readFileSync(path.join(HERE, "tw.generated.css"), "utf8")

/* ── Page chrome, namespaced s165-* so it CANNOT reach the real component markup.
      The whole point of this sketch is that the describe door and the template
      section render under the APP's own Tailwind classes, unstyled by me. ── */
const chrome = `
.s165-root{max-width:1180px;margin:0 auto;padding:2rem 1.25rem 5rem;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:hsl(var(--foreground))}
.s165-head h1{font-size:2rem;font-weight:700;letter-spacing:-.02em;margin:.25rem 0 .5rem}
.s165-kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:hsl(var(--muted-foreground))}
.s165-lede{font-size:1.05rem;color:hsl(var(--muted-foreground));max-width:66ch;margin:0 0 1.25rem;line-height:1.5}
.s165-mech{border:1px solid hsl(var(--border));border-left:3px solid hsl(var(--primary));border-radius:.5rem;padding:.9rem 1.1rem;background:hsl(var(--card));font-size:.86rem;line-height:1.65}
.s165-mech p{margin:.55rem 0 0;color:hsl(var(--muted-foreground))}
.s165-caveat{border-top:1px dashed hsl(var(--border));padding-top:.65rem;margin-top:.75rem!important}
.s165-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:1.75rem 0 1.25rem;border-bottom:1px solid hsl(var(--border));padding-bottom:.6rem}
.s165-tab{appearance:none;border:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-foreground));border-radius:.45rem;padding:.4rem .8rem;font-size:.82rem;font-weight:500;cursor:pointer}
.s165-tab:hover{color:hsl(var(--foreground));border-color:hsl(var(--primary)/.5)}
.s165-tab-on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.s165-axis{display:flex;gap:.85rem;align-items:flex-start;border:1px solid hsl(var(--border));border-radius:.5rem;padding:.85rem 1rem;background:hsl(var(--card));margin-bottom:1.5rem}
.s165-axis p{margin:.35rem 0 0;font-size:.85rem;line-height:1.6;color:hsl(var(--muted-foreground));max-width:88ch}
.s165-badge{flex:none;font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.28rem .55rem;border-radius:999px;border:1px solid;white-space:nowrap}
.s165-badge-baseline{color:hsl(var(--muted-foreground));border-color:hsl(var(--border))}
.s165-badge-b{color:hsl(var(--primary));border-color:hsl(var(--primary)/.45);background:hsl(var(--primary)/.08)}
.s165-badge-c{color:hsl(var(--accent-violet));border-color:hsl(var(--accent-violet)/.45);background:hsl(var(--accent-violet)/.08)}
.s165-badge-p{color:hsl(var(--success));border-color:hsl(var(--success)/.45);background:hsl(var(--success)/.08)}
.s165-h3{font-size:.95rem;font-weight:600;margin:1.9rem 0 .3rem}
.s165-note{font-size:.8rem;line-height:1.65;color:hsl(var(--muted-foreground));margin:0 0 .7rem;max-width:92ch}
.s165-note code,.s165-mech code,.s165-axis code{font-family:ui-monospace,monospace;font-size:.92em;background:hsl(var(--muted));padding:.06rem .3rem;border-radius:.25rem}
/* The STAGE is the only place real component markup lives. It gets a viewport-ish box
   and the app's own background — nothing else. Resizable so the responsive behaviour
   of a real full-height surface can be felt rather than assumed. */
.s165-stage{border:1px solid hsl(var(--border));border-radius:.6rem;overflow:hidden;background:hsl(var(--background));resize:both}
.s165-stage-tall{height:660px}
.s165-stage-tall>*{height:100%}
.s165-table{width:100%;border-collapse:collapse;font-size:.78rem;margin:.5rem 0 1.5rem;display:block;overflow-x:auto}
.s165-table th,.s165-table td{border:1px solid hsl(var(--border));padding:.45rem .6rem;text-align:left;vertical-align:top}
.s165-table th{background:hsl(var(--muted));font-weight:600;white-space:nowrap}
.s165-table code{font-family:ui-monospace,monospace;font-size:.95em;word-break:break-all}
.s165-where{color:hsl(var(--muted-foreground));font-size:.94em}
.s165-rule{color:hsl(var(--muted-foreground));font-size:.94em;line-height:1.55;min-width:26ch}
.s165-status{font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;padding:.15rem .4rem;border-radius:.25rem;white-space:nowrap}
.s165-status-new{color:hsl(var(--success));background:hsl(var(--success)/.12)}
.s165-status-change{color:hsl(var(--primary));background:hsl(var(--primary)/.12)}
.s165-status-shipped{color:hsl(var(--muted-foreground));background:hsl(var(--muted))}

/* ── The winner banner + the starred tab. The pick is stated ON the page rather than
      only in README frontmatter, because a page that opens on the winning variant with
      no explanation reads as though the others were never drawn. ── */
.s165-winner{border:1px solid hsl(var(--success)/.45);border-left:3px solid hsl(var(--success));border-radius:.5rem;background:hsl(var(--success)/.06);padding:.8rem 1rem;margin:1.5rem 0 0;font-size:.86rem;line-height:1.6}
.s165-winner strong{color:hsl(var(--success))}
.s165-winner>span{font-family:ui-monospace,monospace;font-size:.7rem;color:hsl(var(--muted-foreground));margin-left:.5rem}
.s165-winner p{margin:.45rem 0 0;color:hsl(var(--muted-foreground));max-width:92ch}
.s165-winner code{font-family:ui-monospace,monospace;font-size:.92em;background:hsl(var(--muted));padding:.06rem .3rem;border-radius:.25rem}
.s165-tab-won{border-color:hsl(var(--success));background:hsl(var(--success));color:hsl(var(--background))}
.s165-tab-won:hover{color:hsl(var(--background));border-color:hsl(var(--success))}
`

const out = `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sketch 165 — The template lands first (Phase 193.1)</title>
<style>${tw}</style>
<style>${chrome}</style>
</head>
<body class="dark" style="background:hsl(var(--background));margin:0">
${body}
</body>
</html>
`

fs.writeFileSync(path.join(HERE, "index.html"), out, "utf8")
console.log(
  `index.html written — ${(out.length / 1024).toFixed(1)} KB (tailwind ${(tw.length / 1024).toFixed(1)} KB inlined)`,
)
