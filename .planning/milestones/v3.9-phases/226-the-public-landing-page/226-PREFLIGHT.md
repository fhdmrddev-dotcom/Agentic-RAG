# Phase 226 — PREFLIGHT

**Written 2026-09-03 by Claude (reviewer), against plans `226-01..05` at `9eb916c1a` on `phase-226`.**
Base of the worktree: `aec03333a` (develop). Measurements taken at HEAD of `develop`, read-only, every
claim with a file:line so it can be refuted rather than trusted.

**Verdict: GO WITH CHANGES.** Seven findings block or reshape a task; the rest are advisory. The plan
structure is right — wave split, fact manifest first, scenes as components, docs last. What is wrong is
mostly *numbers copied from the canvas instead of derived from code*, which is the exact failure
D-226-04 exists to prevent, plus one routing decision that Vercel's own documentation refutes.

⚠ **Declared conflict, up front.** I drew the canvas the operator approved as this phase's acceptance
bar. `AGENTS.md` §3.1 says the reviewer must not have shaped the build; the operator's ruling (recorded in
`224-PREFLIGHT.md`) is that an operator-approved design is the OPERATOR's bar, not mine. My post-phase
check is therefore driven against the *shipped page*, never against my drawing — and where this
pre-flight says the canvas is wrong (F-2), the code wins, not the canvas.

---

## BLOCKING — fix before the task that owns it runs

### F-1 · D-226-02 as planned cannot work: Vercel serves `index.html` before any rewrite runs

Plan 01 Task 2 rewrites `/` → `/landing.html` while keeping the app at `index.html`. Vercel's
configuration reference is explicit:

> *"The `source` property should NOT be a file because precedence is given to the filesystem prior to
> rewrites being applied. Instead, you should rename your static file or Vercel Function."*
> — https://vercel.com/docs/project-configuration/vercel-json, §rewrites (fetched 2026-09-03)

A request for `/` resolves to the static `index.html` on the filesystem, so the rewrite never fires and
the landing is unreachable at the root. The proposal's own D-226-02 said *"verify first"* — this is the
verification, and it fails.

**Required change (Plan 01, Tasks 1 + 2):**

1. **The landing IS `frontend/index.html`.** The app entry is renamed to `frontend/app.html`
   (`<script type="module" src="/src/main.tsx">` unchanged inside it). Vite MPA input:
   ```ts
   build: { rollupOptions: { input: {
     landing: resolve(__dirname, "index.html"),
     app:     resolve(__dirname, "app.html"),
   } } }
   ```
2. **`frontend/vercel.json`** becomes the SPA fallback onto the app file:
   ```json
   "rewrites": [ { "source": "/(.*)", "destination": "/app.html" } ]
   ```
   Filesystem precedence now does the right thing for free: `/` → static `index.html` (landing),
   `/assets/*` → static, everything else → `app.html`. `/setup` and `/invite` — the ONLY two literal
   paths `App.tsx` ever inspects (`App.tsx:225`, `:242`; there is no client router, `App.tsx:102,126`)
   — keep reaching the app.
3. **Dev and preview parity.** Vite's dev server SPA-fallbacks unknown paths to `index.html`, which is
   now the landing — so in dev `/app`, `/setup`, `/invite` would render marketing. Add a ~10-line
   `configureServer` + `configurePreviewServer` middleware in `vite.config.ts`: any request whose path is
   not `/`, has no file extension, and is not under `/@`/`/src`/`/node_modules` is rewritten to
   `/app.html`. Without this, SC#7's *"open `/`"* is testable only on a Vercel preview deploy, and every
   dev deep link breaks.
4. **Post-flow redirects** (`App.tsx:230`, `SetupWizard.tsx`, `AcceptInvitePage.tsx`) go to `/app`, as
   planned — that path hits the rewrite in prod and the middleware in dev.
5. **Sign in** cannot target `/login`: it is not a path anywhere (`App.tsx:244` renders `AuthPage` purely
   off `!user`). Use `${VITE_APP_URL || ""}/app`. Drop `/login` from the plan, the docs and the env
   var description.
6. **Say it in the summary and in `docs/LANDING.md`:** after this phase `localhost:5173/` is the landing
   and the app lives at `localhost:5173/app`. Every developer habit and every README line that says
   "open localhost:5173" changes meaning. Grep `docs/` and `README.md` for `5173` and fix the ones that
   mean the app.

### F-2 · Three headline facts in Plan 02 are wrong, because they were typed from the canvas

| Fact | Plan 02 says | **Measured at HEAD** | Where |
|---|---|---|---|
| providers | 9 incl. `lmstudio` | **8** distinct `provider` values in `MODEL_CAPABILITIES`; `lmstudio` has **zero** rows there. `_PROVIDER_BASE_URLS` has **10** keys incl. `ollama` + `lmstudio` (both resolved dynamically) | `config.py:263-412`, `:10-21` |
| toolCount | 29 | **29** static entries — correct — but the plan's grouping ("KB navigation, memory, graph queries…") is invented; the dict's own phase comments group them 16 / 5 / 3 / 1 / 1 / 1 / 2. And connector tools (`service__action`) dispatch dynamically and never enter the dict | `tool_dispatcher.py:4202-4237`, `:4683-4688` |
| connectorCatalog | 15 (Gmail, Calendar, Drive as separate tiles) | **13**: slack, github, notion, google, microsoft, jira, **smtp**, custom_mcp, figma, linear, sentry, intercom, miro. Gmail / Calendar / Drive are *applications of* `google`, not catalog entries; `smtp` exists and the plan omits it | `servicesCatalog.ts:37-206` |
| settings tabs | "Knowledge & Retrieval" | the label is **dynamic** (`{retrievalTabLabel}`, currently "Search & Retrieval") and three of five tabs are gated on `canManageModels` | `SettingsPage.tsx:1001-1016` |
| orgAdmin tabs | 5 | **6** | `OrgAdminShell.tsx:85-102` |

**Required change (Plan 02, all three tasks):**

- The drift script must read the SAME source each fact claims. **No `+ lmstudio` hardcode** in
  `check-landing-drift.cjs` (Plan 02 Task 2 step 1 says exactly that) — a guard that adds the missing
  item by hand is the drift it exists to catch.
- Decide the convention per fact and write it into `facts.ts` as a comment AND into `docs/LANDING.md`:
  - providers: recommend **8 from `MODEL_CAPABILITIES`** as "model providers", plus a separate
    `localRuntimes` fact (**2**, `_PROVIDER_BASE_URLS` minus the 8: `ollama`, `lmstudio`) so the page can
    say "8 providers, plus local models via Ollama and LM Studio". Both derived, both guarded.
  - tools: **29 built-in** from `_TOOL_REGISTRY`, worded "plus every tool your connected services grant";
    groups come from the dict's own comment blocks or are dropped.
  - catalog: **13 from `CATALOG_SERVICES`**, and the Works-with grid shows 13 tiles. The canvas drew 15;
    D-226-04 says the canvas loses. The Google tile can list its applications as a subtitle if the
    design wants the Gmail/Calendar/Drive words — sourced from wherever the app enumerates them.
  - tabs: derive from the four files; record that Settings is the admin view (5) and the label is
    dynamic; org admin is 6.
- `heroFacts` "100% cited" is not derivable from code and Plan 02 does not say where it comes from.
  Either derive it (the gauntlet's `structural_gate` stage — *"citations / integrity checked during the
  run"* — is a real rule, so "every published workflow passes a citation gate" is derivable) or drop the
  number. A number on this page with no source is exactly what SEED-241 forbids.
- Plan 02 Task 2 lists no quote check, though D-226-05 names `stepIdentityVocabulary.ts`,
  `doorVocabulary.ts` and `PublishGauntlet.tsx` as quote sources. Assert each `verbatimQuotes` string
  appears verbatim in its named file. Measured: `"Paused — waiting for you."` is
  `stepIdentityVocabulary.ts:97` (`ASK_PAUSED`). Verify the other five the same way before typing them.

### F-3 · The import fence in Plan 01 checks source files, not the bundle — SC#1 says the CHUNK

Plan 01 Task 3 scans `src/landing/**` for forbidden import strings. A landing component that imports
`@/components/ui/button` is clean by that test even if `button` transitively pulls `@/lib/api`. SC#1
reads *"the landing chunk must not contain supabase, @/lib/api, StreamsProvider"*.

**Required change:** two fences, both cheap.
- Plan 01: walk the import graph **transitively** from `src/landing/main.tsx` (resolve `@/` and
  relative specifiers; stop at `node_modules`), and fail on any path under `src/lib/api*`,
  `src/lib/supabase*`, `src/providers/*`, `src/hooks/useAuth*`, `src/components/layout/*`.
- Plan 05 Task 3 already builds `dist`: grep the landing chunk(s) for `supabase`, `/lib/api`,
  `StreamsProvider`, `OrgProvider` and fail on a hit. That is the sentence SC#1 actually wrote.

### F-4 · Plan 04 Task 1 contradicts D-226-08

> *"Render official SVG symbol paths extracted from `icons.json` / `Main.dc.html`"*

That is vendoring the logos by hand — the thing D-226-08 forbids, and it will drift from the packages the
app renders. Everything needed is already installed and configured: `unplugin-icons` (`vite.config.ts:4,8`,
`Icons({ compiler: "jsx", jsx: "react" })`), `@iconify-json/logos` (`package.json:55`),
`@lobehub/icons` (`package.json:17`).

**Required change:** `BrandIcons.tsx` re-exports `~icons/logos/<name>` for connectors and the
`@lobehub/icons` provider components the app already uses (the icon convention in the sketch-findings
skill names them). If a logo exists in neither package, say so in the summary and render the tile
without a logo — never paste a path. (The `icons.json` in the canvas folder was a preview-time
convenience; it is not a source.)

### F-5 · The hook file Plan 02 names does not exist, and CI is missing

`.claude/hooks/post-tool-use.sh` — not present. The registry is `.claude/settings.json` →
`hooks.PostToolUse`, and the pattern to copy is entry 4: matcher `"Write|Edit"`, command
`.claude/hooks/claude-md-size-guard.js`, timeout 5. Add a fifth entry the same shape (a thin wrapper that
`node scripts/check-landing-drift.cjs`s and is **silent when green** — a hook that prints on every edit
is noise).

D-226-05 says *"in the PostToolUse hook and in CI"*. No plan adds a workflow. Plan 05 adds
`.github/workflows/landing-drift.yml` copied from `claude-md-size.yml` (`on: push` + `pull_request`,
paths: `frontend/src/landing/**`, `scripts/check-landing-drift.cjs`, and every source file the script
reads). House exit codes: `0` clear · `1` drift · `2` harness error (a source file missing is `2`, not
`1` — a missing source must never read as "no drift").

### F-6 · Do NOT touch `scripts/vitest-count-gate.cjs` in this phase

The 224 session is editing it on `develop` right now (plan 224-05 adopts suites into TARGETS/BASELINE).
It is the hottest script in the repo (141 commits) and a concurrent edit on `phase-226` is the one
guaranteed merge conflict. No 226 plan lists it — keep it that way. Record the new suites
(`landingBundleFence`, `facts`, `scenes`, `LandingPage`) and their printed counts in the 226 summary as
**OWED pins**; Claude adds `"src/landing"` to TARGETS and the BASELINE entries in the merge commit.

### F-7 · Plan 05 `files_modified` lists build output

`frontend/dist/assets/landing-*.js` is not a file the plan modifies; `dist` is gitignored. Remove it
from the frontmatter so the executor's file-fence does not try to reconcile it.

---

## ADVISORY — will bite at UAT if ignored

- **A-1 Reduced motion (Plan 03 Task 1).** `animation: none !important` shows each element's *initial*
  state, not the rich end state — and a loop's 100% keyframe is normally identical to 0%. Each scene
  needs explicit end-state rules under the media query (e.g. `.c-lift { transform: … ; opacity: 1 }`),
  authored per element, not a blanket `opacity:1; transform:none` (the "rich" state is often a non-zero
  transform). `scenes.test.tsx` should mock `matchMedia` for `(prefers-reduced-motion: reduce)` and
  assert the end-state class/attribute is applied — jsdom cannot see CSS, so test the switch, not the
  paint.
- **A-2 Literal-number fence (Plan 02 Task 3).** `\b(9|10|29|30|15)\b` over raw TSX will fire on
  `viewBox="0 0 24 24"`, `width={10}`, `strokeWidth`, hex colours and keyframe percentages. Scan JSX
  **text nodes** only (the text between `>` and `<`, or parse with `@babel/parser` which is already in
  `node_modules` via Vite) and allow-list `facts.ts` and tests.
- **A-3 `ControlRoomScene` "Providers 7/9 keyed"** embeds the provider count (and the wrong one).
  Storyboard numbers are fine; a *product count* inside a storyboard must come from `facts`.
- **A-4 `LandingPage.test.tsx`.** jsdom has no `IntersectionObserver` — stub it before mount or the
  reveal effect throws. The hero's `mousemove` tilt is a no-op in jsdom; do not assert on transforms.
- **A-5 Ingest formats convention.** `acceptedFormats.ts:27-36` records that the SERVER allows fourteen
  MIME types while the dropzone lists eight. The fact "11 = 8 + 3" is a convention (dropzone extensions
  + the three server-only override extensions at `documents.py:128-130`). Say so in `facts.ts` so the
  next person does not "fix" it to fourteen.
- **A-6 Fonts.** `landing.html` adds JetBrains Mono; keep the Inter/Manrope families and weights
  byte-identical to `index.html:11` (the proposal calls this a *duplicate*, and duplicates drift). Better:
  since the landing now IS `index.html` (F-1), the app's `app.html` carries the same link — one place
  to keep in sync, still two files.
- **A-7 `index.css` import.** The landing imports the app's whole token + Tailwind sheet. Fine for
  parity; measure the CSS size in Plan 05 alongside the JS (SC#6 says bundle, and CSS is part of it).
- **A-8 Deploy drift mechanics.** `check-deploy-drift.sh:112-137` compares `backend/.env.example`
  keys against `deploy/onebox.env.example`. `VITE_*` vars are frontend and not in `backend/.env.example`,
  so the script will not *require* them — add them to `deploy/onebox.env.example` and `docs/OPERATOR.md`
  anyway (D-226-03 / SC#4), and to `frontend/.env.example` if one exists, so the parity is documented
  even where the script cannot enforce it. Say in the summary that the script does not cover them.
- **A-9 SEED-241** must flip to `status: folded` (→ `shipped` at close) *in the seed file* — the
  frontmatter is the index; prose is invisible to the sweep.
- **A-10 390 px.** The comparison tables scroll inside `.cmp-scroll`; the models orbit and the hero
  stage are the likely overflow culprits — they need `max-width: 100%` + `overflow: hidden` on their
  own containers. A `body { overflow-x: hidden }` hides the symptom and fails G-4 (c) in spirit.
- **A-11 Merge shape.** Since the worktree base (`aec03333a`) develop has moved (224-04, a 227
  proposal, bus/state docs). Zero file overlap with any 226 `files_modified` as of `7811b58d1`.
  `phase-226` merges into develop **after 224 closes**, by the operator; if 224-05 lands its count-gate
  edit first, F-6 keeps 226 conflict-free.

---

## Measured facts the plans depend on (so nobody re-derives them wrongly)

| # | Fact | Value | Where |
|---|---|---|---|
| 1 | client router | **none** — `useState<ActiveView>` | `App.tsx:102,126` |
| 2 | literal path checks in the app | `/setup`, `/invite` only | `App.tsx:225,242` |
| 3 | `window.location.assign("/")` sites | `App.tsx:230` + AcceptInvitePage (per `App.tsx:233-241`) | |
| 4 | `/login`, `/admin` as paths | **do not exist** | grep, `App.tsx:244` |
| 5 | `vite.config.ts` | 14 lines, no `build` key, `unplugin-icons` configured | `vite.config.ts:1-14` |
| 6 | `frontend/vercel.json` | `buildCommand: vite build`, one rewrite `/(.*)` → `/index.html` | |
| 7 | gauntlet `STAGES` | 10, `what:` strings verbatim in the measurement file | `PublishGauntlet.tsx:196-207` |
| 8 | dropzone extensions | `.pdf .docx .pptx .xlsx .csv .txt .md .epub` | `acceptedFormats.ts:69-78` |
| 9 | server-only extensions | `.eml .msg .dxf` | `documents.py:128-130` |
| 10 | PostToolUse hook pattern | entry 4, `Write\|Edit`, `claude-md-size-guard.js`, timeout 5 | `.claude/settings.json` |
| 11 | CI pattern | `claude-md-size.yml`: checkout + `node scripts/…`, path-filtered push + PR | `.github/workflows/` |
| 12 | count-gate knobs | `BASELINE` at `:122`, `TARGETS` at `:3464` — **not to be edited in 226** (F-6) | `vitest-count-gate.cjs` |
| 13 | Google Fonts link | `index.html:9-11` (Inter 400-700, Manrope 500-800) | |
| 14 | tokens | `frontend/src/index.css:17` `:root`, `.dark` block below | |

Full measurement report with the derivation commands: Claude's scratchpad `226-measurements.md`
(session-local; the table above is the durable copy).

---

## What the post-phase review will drive (so the build can aim at it)

1. `vite build` → `dist/index.html` is the landing, `dist/app.html` is the app; the landing chunk greps
   clean for `supabase`, `/lib/api`, `StreamsProvider`, `OrgProvider`.
2. `node scripts/check-landing-drift.cjs` → 0 on HEAD; planted edit to `PublishGauntlet.tsx` `STAGES`
   → 1 with the offending fact named; restore md5-identical → 0. Same for one provider row and one
   catalog entry. A missing source file → 2.
3. Chrome, dev server: `/` is the landing; `/app` is the app; `/setup` and `/invite` reach the app;
   logged-in user at `/` sees marketing (by design, D-226-02) and Sign in takes them in.
4. Chrome: each of the eight scenes loops without hover; with `prefers-reduced-motion` emulated, no
   loop runs and each scene shows its end state.
5. Chrome at 390 px: `document.documentElement.scrollWidth === clientWidth`; the two tables scroll
   inside their own container.
6. Every number on the page is found in `facts.ts` and nowhere else in `src/landing/**/*.tsx`.
7. Bundle: landing JS gz < 400 KB, and the CSS figure reported beside it.
