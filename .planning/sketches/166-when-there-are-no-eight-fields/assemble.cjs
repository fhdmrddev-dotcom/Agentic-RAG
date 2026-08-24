#!/usr/bin/env node
/**
 * SKETCH 166 — final assembly. Inlines the REAL project Tailwind CSS (built from
 * `frontend/tailwind.config.js` over `body.generated.html`) plus this sketch's own
 * page chrome, and writes a standalone `index.html`.
 *
 * Run order (see README.md):
 *   1. copy emit.test.tsx.src into frontend/src/components/workflows/ and vitest it
 *   2. node build.cjs
 *   3. npx tailwindcss -c <cfg> -i src/index.css -o tw.generated.css --minify
 *   4. node assemble.cjs
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const body = fs.readFileSync(path.join(HERE, "body.generated.html"), "utf8")
const tw = fs.readFileSync(path.join(HERE, "tw.generated.css"), "utf8")

/* Namespaced s166-* so page chrome cannot reach the real component markup. */
const chrome = `
.s166-root{max-width:1180px;margin:0 auto;padding:2rem 1.25rem 5rem;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:hsl(var(--foreground))}
.s166-head h1{font-size:2rem;font-weight:700;letter-spacing:-.02em;margin:.25rem 0 .5rem}
.s166-kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:hsl(var(--muted-foreground))}
.s166-lede{font-size:1.05rem;color:hsl(var(--muted-foreground));max-width:66ch;margin:0 0 1.25rem;line-height:1.5}
.s166-mech{border:1px solid hsl(var(--border));border-left:3px solid hsl(var(--primary));border-radius:.5rem;padding:.9rem 1.1rem;background:hsl(var(--card));font-size:.86rem;line-height:1.65}
.s166-mech p{margin:.55rem 0 0;color:hsl(var(--muted-foreground))}
.s166-caveat{border-top:1px dashed hsl(var(--border));padding-top:.65rem;margin-top:.75rem!important}
.s166-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:1.75rem 0 1.25rem;border-bottom:1px solid hsl(var(--border));padding-bottom:.6rem}
.s166-tab{appearance:none;border:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-foreground));border-radius:.45rem;padding:.4rem .8rem;font-size:.82rem;font-weight:500;cursor:pointer}
.s166-tab:hover{color:hsl(var(--foreground));border-color:hsl(var(--primary)/.5)}
.s166-tab-on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.s166-axis{display:flex;gap:.85rem;align-items:flex-start;border:1px solid hsl(var(--border));border-radius:.5rem;padding:.85rem 1rem;background:hsl(var(--card));margin-bottom:1.5rem}
.s166-axis p{margin:.35rem 0 0;font-size:.85rem;line-height:1.6;color:hsl(var(--muted-foreground));max-width:88ch}
.s166-badge{flex:none;font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.28rem .55rem;border-radius:999px;border:1px solid;white-space:nowrap}
.s166-badge-baseline{color:hsl(var(--muted-foreground));border-color:hsl(var(--border))}
.s166-badge-b{color:hsl(var(--primary));border-color:hsl(var(--primary)/.45);background:hsl(var(--primary)/.08)}
.s166-badge-c{color:hsl(var(--accent-violet));border-color:hsl(var(--accent-violet)/.45);background:hsl(var(--accent-violet)/.08)}
.s166-badge-p{color:hsl(var(--success));border-color:hsl(var(--success)/.45);background:hsl(var(--success)/.08)}
.s166-h3{font-size:.95rem;font-weight:600;margin:1.9rem 0 .3rem}
.s166-note{font-size:.8rem;line-height:1.65;color:hsl(var(--muted-foreground));margin:0 0 .7rem;max-width:92ch}
.s166-note code,.s166-mech code,.s166-axis code{font-family:ui-monospace,monospace;font-size:.92em;background:hsl(var(--muted));padding:.06rem .3rem;border-radius:.25rem}
.s166-stage{border:1px solid hsl(var(--border));border-radius:.6rem;overflow:hidden;background:hsl(var(--background));resize:both}
.s166-stage-tall{height:660px}
.s166-stage-tall>*{height:100%}
/* ── The arm strip: the five reading states side by side, each showing only the
      spliced region plus the draft button's text. Horizontally scrollable rather
      than squeezed — a cell narrower than the 320px rail the section was designed
      for would misrepresent it. ── */
.s166-strip{display:flex;gap:.75rem;overflow-x:auto;padding-bottom:.75rem;margin-bottom:.5rem}
.s166-cell{flex:0 0 300px;margin:0;border:1px solid hsl(var(--border));border-radius:.55rem;background:hsl(var(--background));display:flex;flex-direction:column}
.s166-cell figcaption{display:flex;flex-direction:column;gap:.15rem;padding:.5rem .65rem;border-bottom:1px solid hsl(var(--border));background:hsl(var(--muted));font-size:.7rem}
.s166-cell figcaption code{font-family:ui-monospace,monospace;font-weight:700;color:hsl(var(--foreground))}
.s166-cell figcaption span{color:hsl(var(--muted-foreground));font-size:.66rem;word-break:break-all}
.s166-mini{padding:.65rem;flex:1}
.s166-cta{margin:0 .65rem .65rem;border-radius:.375rem;background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-size:.72rem;font-weight:500;text-align:center;padding:.4rem .5rem;line-height:1.35}
.s166-table{width:100%;border-collapse:collapse;font-size:.78rem;margin:.5rem 0 1.5rem;display:block;overflow-x:auto}
.s166-table th,.s166-table td{border:1px solid hsl(var(--border));padding:.45rem .6rem;text-align:left;vertical-align:top}
.s166-table th{background:hsl(var(--muted));font-weight:600;white-space:nowrap}
.s166-table code{font-family:ui-monospace,monospace;font-size:.95em;word-break:break-all}
.s166-where{color:hsl(var(--muted-foreground));font-size:.94em}
.s166-rule{color:hsl(var(--muted-foreground));font-size:.94em;line-height:1.55;min-width:26ch}
.s166-status{font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;padding:.15rem .4rem;border-radius:.25rem;white-space:nowrap}
.s166-status-new{color:hsl(var(--success));background:hsl(var(--success)/.12)}
.s166-status-change{color:hsl(var(--primary));background:hsl(var(--primary)/.12)}
.s166-status-shipped{color:hsl(var(--muted-foreground));background:hsl(var(--muted))}

/* ── The winner banner + the starred tab. The pick is stated ON the page rather than
      only in README frontmatter, because a page that opens on the winning variant with
      no explanation reads as though the others were never drawn. ── */
.s166-winner{border:1px solid hsl(var(--success)/.45);border-left:3px solid hsl(var(--success));border-radius:.5rem;background:hsl(var(--success)/.06);padding:.8rem 1rem;margin:1.5rem 0 0;font-size:.86rem;line-height:1.6}
.s166-winner strong{color:hsl(var(--success))}
.s166-winner>span{font-family:ui-monospace,monospace;font-size:.7rem;color:hsl(var(--muted-foreground));margin-left:.5rem}
.s166-winner p{margin:.45rem 0 0;color:hsl(var(--muted-foreground));max-width:92ch}
.s166-winner code{font-family:ui-monospace,monospace;font-size:.92em;background:hsl(var(--muted));padding:.06rem .3rem;border-radius:.25rem}
.s166-tab-won{border-color:hsl(var(--success));background:hsl(var(--success));color:hsl(var(--background))}
.s166-tab-won:hover{color:hsl(var(--background));border-color:hsl(var(--success))}
`

const out = `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sketch 166 — When there are no eight fields (Phase 193.1)</title>
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
