#!/usr/bin/env node
/**
 * SKETCH 164 — final assembly. Inlines the REAL project Tailwind CSS (built from
 * `frontend/tailwind.config.js` over `body.generated.html`, so the theme tokens
 * are the app's own Deep Midnight values, not a sketch approximation) plus this
 * sketch's own page chrome, and writes a standalone `index.html`.
 *
 * Run order (all three are reproducible from a clean checkout):
 *   1. copy emit.test.tsx.src into frontend/src/components/workflows/ and
 *      `npx vitest run` it            → dom.generated.json   (the REAL DOM)
 *   2. node build.cjs                 → body.generated.html + BUILD-CONTRACT.generated.md
 *   3. npx tailwindcss -c <cfg> -i src/index.css -o tw.generated.css --minify
 *   4. node assemble.cjs              → index.html
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const body = fs.readFileSync(path.join(HERE, "body.generated.html"), "utf8")
const tw = fs.readFileSync(path.join(HERE, "tw.generated.css"), "utf8")

const chrome = `
/* ── Sketch-164 page chrome. Deliberately namespaced s164-* so it CANNOT touch
      the real component markup below it: the whole point of this sketch is that
      the doors render under the app's own Tailwind classes, unstyled by me. ── */
.s164-root{max-width:1180px;margin:0 auto;padding:2rem 1.25rem 5rem;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:hsl(var(--foreground))}
.s164-head h1{font-size:2rem;font-weight:700;letter-spacing:-.02em;margin:.25rem 0 .5rem}
.s164-kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:hsl(var(--muted-foreground))}
.s164-lede{font-size:1.05rem;color:hsl(var(--muted-foreground));max-width:62ch;margin:0 0 1.25rem}
.s164-mech{border:1px solid hsl(var(--border));border-left:3px solid hsl(var(--primary));border-radius:.5rem;padding:.9rem 1.1rem;background:hsl(var(--card));font-size:.86rem;line-height:1.6}
.s164-mech p{margin:.5rem 0 0;color:hsl(var(--muted-foreground))}
.s164-caveat{border-top:1px dashed hsl(var(--border));padding-top:.6rem;margin-top:.7rem!important}
.s164-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:1.75rem 0 1.25rem;border-bottom:1px solid hsl(var(--border));padding-bottom:.6rem}
.s164-tab{appearance:none;border:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-foreground));border-radius:.45rem;padding:.4rem .8rem;font-size:.82rem;font-weight:500;cursor:pointer}
.s164-tab:hover{color:hsl(var(--foreground));border-color:hsl(var(--primary)/.5)}
.s164-tab-on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.s164-axis{display:flex;gap:.85rem;align-items:flex-start;border:1px solid hsl(var(--border));border-radius:.5rem;padding:.85rem 1rem;background:hsl(var(--card));margin-bottom:1.5rem}
.s164-axis p{margin:.3rem 0 0;font-size:.85rem;line-height:1.55;color:hsl(var(--muted-foreground));max-width:80ch}
.s164-badge{flex:none;font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:.28rem .55rem;border-radius:999px;border:1px solid}
.s164-badge-baseline{color:hsl(var(--muted-foreground));border-color:hsl(var(--border))}
.s164-badge-b{color:hsl(var(--primary));border-color:hsl(var(--primary)/.45);background:hsl(var(--primary)/.08)}
.s164-badge-c{color:hsl(var(--accent-violet));border-color:hsl(var(--accent-violet)/.45);background:hsl(var(--accent-violet)/.08)}
.s164-badge-p{color:hsl(var(--success));border-color:hsl(var(--success)/.45);background:hsl(var(--success)/.08)}
.s164-badge-d{color:hsl(var(--success));border-color:hsl(var(--success)/.7);background:hsl(var(--success)/.14);font-weight:600}
.s164-h3{font-size:.95rem;font-weight:600;margin:1.9rem 0 .3rem}
.s164-note{font-size:.8rem;line-height:1.6;color:hsl(var(--muted-foreground));margin:0 0 .7rem;max-width:88ch}
.s164-note code,.s164-mech code,.s164-axis code{font-family:ui-monospace,monospace;font-size:.92em;background:hsl(var(--muted));padding:.06rem .3rem;border-radius:.25rem}
/* The STAGE is the only place real component markup lives. It gets a viewport-ish
   box and the app's own background — nothing else. */
.s164-stage{border:1px solid hsl(var(--border));border-radius:.6rem;overflow:hidden;background:hsl(var(--background));resize:both}
.s164-stage-tall{height:520px}
/* Only the TALL stages force their child to fill — the doors are full-height
   surfaces (flex h-full). The padded stage holds the Run-modal dialog card,
   whose natural height is the point; forcing 100% there collapsed it to 0. */
.s164-stage-tall>*{height:100%}
.s164-stage-pad{padding:2rem;display:grid;place-items:center}
.s164-table{width:100%;border-collapse:collapse;font-size:.78rem;margin:.5rem 0 1.5rem;display:block;overflow-x:auto}
.s164-table th,.s164-table td{border:1px solid hsl(var(--border));padding:.45rem .6rem;text-align:left;vertical-align:top}
.s164-table th{background:hsl(var(--muted));font-weight:600;white-space:nowrap}
.s164-table code{font-family:ui-monospace,monospace;font-size:.95em}
.s164-where{color:hsl(var(--muted-foreground));font-size:.94em}
.s164-rule{color:hsl(var(--muted-foreground));font-size:.94em;line-height:1.5}
.s164-status{font-family:ui-monospace,monospace;font-size:.66rem;font-weight:700;text-transform:uppercase;padding:.15rem .4rem;border-radius:.25rem;white-space:nowrap}
.s164-status-new{color:hsl(var(--success));background:hsl(var(--success)/.12)}
.s164-status-change{color:hsl(var(--primary));background:hsl(var(--primary)/.12)}
.s164-status-shipped{color:hsl(var(--muted-foreground));background:hsl(var(--muted))}
.s164-pre{font-family:ui-monospace,monospace;font-size:.78rem;line-height:1.6;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:.45rem;padding:.8rem 1rem;overflow-x:auto;white-space:pre-wrap}
`

const out = `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sketch 164 — Telling the doors apart (Phase 193)</title>
<style>${tw}</style>
<style>${chrome}</style>
</head>
<body class="dark" style="background:hsl(var(--background));margin:0">
${body}
</body>
</html>
`

fs.writeFileSync(path.join(HERE, "index.html"), out, "utf8")
console.log(`index.html written — ${(out.length / 1024).toFixed(1)} KB (tailwind ${(tw.length / 1024).toFixed(1)} KB inlined)`)
