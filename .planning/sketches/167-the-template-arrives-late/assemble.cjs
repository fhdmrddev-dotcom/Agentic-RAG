#!/usr/bin/env node
/**
 * SKETCH 167 — final assembly. Inlines the REAL project Tailwind CSS plus this
 * sketch's own page chrome, and writes a standalone `index.html`. See README.md
 * for the four-step chain.
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const body = fs.readFileSync(path.join(HERE, "body.generated.html"), "utf8")
const tw = fs.readFileSync(path.join(HERE, "tw.generated.css"), "utf8")

/* Namespaced s167-* so page chrome cannot reach the real component markup. */
const chrome = `
.s167-root{max-width:1180px;margin:0 auto;padding:2rem 1.25rem 5rem;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:hsl(var(--foreground))}
.s167-head h1{font-size:2rem;font-weight:700;letter-spacing:-.02em;margin:.25rem 0 .5rem}
.s167-kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:hsl(var(--muted-foreground))}
.s167-lede{font-size:1.05rem;color:hsl(var(--muted-foreground));max-width:66ch;margin:0 0 1.25rem;line-height:1.5}
.s167-mech{border:1px solid hsl(var(--border));border-left:3px solid hsl(var(--primary));border-radius:.5rem;padding:.9rem 1.1rem;background:hsl(var(--card));font-size:.86rem;line-height:1.65}
.s167-mech p{margin:.55rem 0 0;color:hsl(var(--muted-foreground))}
.s167-caveat{border-top:1px dashed hsl(var(--border));padding-top:.65rem;margin-top:.75rem!important}
.s167-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:1.75rem 0 1.25rem;border-bottom:1px solid hsl(var(--border));padding-bottom:.6rem}
.s167-tab{appearance:none;border:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-foreground));border-radius:.45rem;padding:.4rem .8rem;font-size:.82rem;font-weight:500;cursor:pointer}
.s167-tab:hover{color:hsl(var(--foreground));border-color:hsl(var(--primary)/.5)}
.s167-tab-on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.s167-axis{display:flex;gap:.85rem;align-items:flex-start;border:1px solid hsl(var(--border));border-radius:.5rem;padding:.85rem 1rem;background:hsl(var(--card));margin-bottom:1.5rem}
.s167-axis p{margin:.35rem 0 0;font-size:.85rem;line-height:1.6;color:hsl(var(--muted-foreground));max-width:88ch}
.s167-badge{flex:none;font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.28rem .55rem;border-radius:999px;border:1px solid;white-space:nowrap}
.s167-badge-baseline{color:hsl(var(--muted-foreground));border-color:hsl(var(--border))}
.s167-badge-b{color:hsl(var(--primary));border-color:hsl(var(--primary)/.45);background:hsl(var(--primary)/.08)}
.s167-badge-c{color:hsl(var(--accent-violet));border-color:hsl(var(--accent-violet)/.45);background:hsl(var(--accent-violet)/.08)}
.s167-badge-p{color:hsl(var(--success));border-color:hsl(var(--success)/.45);background:hsl(var(--success)/.08)}
.s167-h3{font-size:.95rem;font-weight:600;margin:1.9rem 0 .3rem}
.s167-note{font-size:.8rem;line-height:1.65;color:hsl(var(--muted-foreground));margin:0 0 .7rem;max-width:92ch}
.s167-note code,.s167-mech code,.s167-axis code{font-family:ui-monospace,monospace;font-size:.92em;background:hsl(var(--muted));padding:.06rem .3rem;border-radius:.25rem}
/* ── The RAIL. The real inspector panel is 320px wide; that width is the one property
      of the (deliberately unrendered) PhaseFormPanel this sketch borrows. ── */
.s167-pair{display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start;margin-bottom:.5rem}
.s167-rail{width:320px;flex:none;border:1px solid hsl(var(--border));border-radius:.55rem;background:hsl(var(--card));padding:.75rem;align-self:flex-start}
.s167-rail-head{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;padding-bottom:.5rem;margin-bottom:.25rem;border-bottom:1px solid hsl(var(--border));font-size:.72rem;font-weight:600;color:hsl(var(--foreground))}
.s167-rail-head span{font-family:ui-monospace,monospace;font-size:.62rem;font-weight:500;color:hsl(var(--muted-foreground))}
.s167-table{width:100%;border-collapse:collapse;font-size:.78rem;margin:.5rem 0 1.5rem;display:block;overflow-x:auto}
.s167-table th,.s167-table td{border:1px solid hsl(var(--border));padding:.45rem .6rem;text-align:left;vertical-align:top}
.s167-table th{background:hsl(var(--muted));font-weight:600;white-space:nowrap}
.s167-table code{font-family:ui-monospace,monospace;font-size:.95em;word-break:break-all}
.s167-where{color:hsl(var(--muted-foreground));font-size:.94em}
.s167-rule{color:hsl(var(--muted-foreground));font-size:.94em;line-height:1.55;min-width:26ch}
.s167-status{font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;padding:.15rem .4rem;border-radius:.25rem;white-space:nowrap}
.s167-status-new{color:hsl(var(--success));background:hsl(var(--success)/.12)}
.s167-status-produced{color:hsl(var(--success));background:hsl(var(--success)/.12)}
.s167-status-runinput{color:hsl(var(--muted-foreground));background:hsl(var(--muted))}
.s167-status-unnamed{color:hsl(38 92% 70%);background:hsl(38 92% 60%/.12)}
.s167-status-shipped{color:hsl(var(--muted-foreground));background:hsl(var(--muted))}

/* ── The winner banner + the starred tab. The pick is stated ON the page rather than
      only in README frontmatter, because a page that opens on the winning variant with
      no explanation reads as though the others were never drawn. ── */
.s167-winner{border:1px solid hsl(var(--success)/.45);border-left:3px solid hsl(var(--success));border-radius:.5rem;background:hsl(var(--success)/.06);padding:.8rem 1rem;margin:1.5rem 0 0;font-size:.86rem;line-height:1.6}
.s167-winner strong{color:hsl(var(--success))}
.s167-winner>span{font-family:ui-monospace,monospace;font-size:.7rem;color:hsl(var(--muted-foreground));margin-left:.5rem}
.s167-winner p{margin:.45rem 0 0;color:hsl(var(--muted-foreground));max-width:92ch}
.s167-winner code{font-family:ui-monospace,monospace;font-size:.92em;background:hsl(var(--muted));padding:.06rem .3rem;border-radius:.25rem}
.s167-tab-won{border-color:hsl(var(--success));background:hsl(var(--success));color:hsl(var(--background))}
.s167-tab-won:hover{color:hsl(var(--background));border-color:hsl(var(--success))}
`

const out = `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sketch 167 — The template arrives late (Phase 193.1)</title>
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
