#!/usr/bin/env node
/**
 * SKETCH 174 — assembly. Inlines the real project Tailwind CSS plus a deliberately thin
 * page chrome: this page is a PICTURE, so the chrome must not compete with it.
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const body = fs.readFileSync(path.join(HERE, "body.generated.html"), "utf8")
const tw = fs.readFileSync(path.join(HERE, "tw.generated.css"), "utf8")

const chrome = `
.s174-root{max-width:1280px;margin:0 auto;padding:2rem 1.25rem 4rem;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:hsl(var(--foreground))}
.s174-kicker{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:hsl(var(--muted-foreground))}
.s174-head h1{font-size:1.9rem;font-weight:700;letter-spacing:-.02em;margin:.3rem 0 .6rem}
.s174-lede{font-size:1rem;line-height:1.6;color:hsl(var(--muted-foreground));max-width:74ch;margin:0 0 1.5rem}
.s174-lede strong,.s174-lede em{color:hsl(var(--foreground))}
.s174-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .9rem}
.s174-tab{appearance:none;border:1px solid hsl(var(--border));background:transparent;color:hsl(var(--muted-foreground));border-radius:.45rem;padding:.4rem .85rem;font-size:.82rem;font-weight:500;cursor:pointer}
.s174-tab:hover{color:hsl(var(--foreground));border-color:hsl(var(--primary)/.5)}
.s174-tab-on{background:hsl(var(--primary));border-color:hsl(var(--primary));color:hsl(var(--primary-foreground))}
.s174-cap{font-size:.86rem;line-height:1.6;color:hsl(var(--muted-foreground));margin:0 0 .8rem;max-width:88ch;min-height:1.4em}
/* The screen. A real laptop-ish viewport, resizable so the height question can be felt. */
.s174-screen{border:1px solid hsl(var(--border));border-radius:.7rem;overflow:hidden;background:hsl(var(--background));height:780px;resize:vertical;box-shadow:0 18px 48px -24px rgba(0,0,0,.7)}
.s174-screen>*{height:100%}
.s174-foot{font-size:.8rem;line-height:1.7;color:hsl(var(--muted-foreground));margin:1.1rem 0 0;max-width:92ch}
.s174-foot strong{color:hsl(var(--foreground))}
`

const out = `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sketch 174 — The line that opens (Phase 197)</title>
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
