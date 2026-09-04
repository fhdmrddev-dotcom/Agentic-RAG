# Landing canvas — working files

Source of the Claude Design canvas **Agentic RAG Landing**
(https://claude.ai/code/artifact/d33a1829-8e5c-498a-8f65-dcbda8cbc448), saved 2026-09-03.

- `Main.dc.html` — the single desktop artboard (Design Components format; `<script src="./support.js">` is replaced by the editor at render time).
- `icons.json` — brand-icon SVG bodies extracted from `frontend/node_modules/@iconify-json/logos` and `@lobehub/icons` (the same sets the app renders).
- `canvas.json` — artboard layout.

Re-seed with the `design` skill helper: `node seed-canvas.mjs --template payload.template.html --out agentic-rag-landing.html --title "Agentic RAG Landing" --artboard Main.dc.html --canvas canvas.json`.

Decisions and the drift-guard plan: `.planning/seeds/SEED-241-living-landing-page.md`.
