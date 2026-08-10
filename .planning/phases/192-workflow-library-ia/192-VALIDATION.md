---
phase: 192
slug: workflow-library-ia
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 192 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `192-RESEARCH.md` § "Validation Architecture" (measured at `HEAD = a0795512`).
> The Per-Task Verification Map is filled by `/gsd:plan-phase` once plans exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + `@testing-library/react`, jsdom (frontend) · pytest (backend, D-04 only) |
| **Config file** | `frontend/vite.config.ts` (`test:` block — `environment: "jsdom"`, `setupFiles: ["./src/setupTests.ts"]`, `globals: true`, excludes `tests/e2e/**`) |
| **Quick run command** | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 <files>` |
| **Full suite command** | `node scripts/vitest-count-gate.cjs` |
| **Typecheck command** | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` |
| **Lint commands** | `cd frontend && npx eslint <paths>` · a11y: `npx eslint <paths> -c eslint.a11y.config.js` |
| **Backend command** | `cd backend && venv/Scripts/python -m pytest tests/unit -k published_workflows` |
| **Estimated runtime** | count gate ~90 s · a touched-suite quick run ~10–20 s |

⚠ **`tsc --noEmit` alone checks ZERO files here.** The root `tsconfig.json` is a solution file; the
real project is `tsconfig.app.json`. A task that writes `npx tsc --noEmit` has written a no-op gate.

⚠ **`npm run build` runs `tsc -b && vite build`** — `-b` is not the same as `-p … --noEmit` (the
recorded v3.3 lesson). Use `-p tsconfig.app.json --noEmit` for a typecheck gate.

⚠ **`GSD_VITEST_MAX_WORKERS=4` is mandatory** in any parallel/worktree run (CLAUDE.md § Parallel
execution, rule 2). Uncapped concurrent vitest runs on this box produce bare timeouts in suites the
plan never touched.

---

## Measured baselines at `HEAD = a0795512` — the sticks everything is measured against

| Measurement | Value | Command |
|---|---|---|
| Typecheck errors (whole app) | **33** | `npx tsc -p tsconfig.app.json --noEmit 2>&1 \| grep -c "error TS"` |
| Lint on `WorkflowsPage.tsx` + its test | **0** | `npx eslint src/pages/WorkflowsPage.tsx src/pages/WorkflowsPage.test.tsx` |
| a11y-lint on `WorkflowsPage.tsx` | **0** | `npx eslint src/pages/WorkflowsPage.tsx -c eslint.a11y.config.js` |
| Lint on `src/pages` (whole dir) | 21 (pre-existing, other files) | `npx eslint src/pages` |
| The 7 affected suites | **123 tests / 0 failed** | see RESEARCH § "The test blast radius" |
| Count gate | 51 pinned files, `BASELINE_TOTAL` = **2775** | `grep -n "BASELINE_TOTAL = " scripts/vitest-count-gate.cjs` |
| `WorkflowsPage.tsx` size | **1407 L** / 21 commits / 10 phases | `wc -l` · `git log --oneline -- <file> \| wc -l` |

Any regression above these is introduced by this phase. **Both zeros are load-bearing:** a new lint or
a11y-lint error in this phase's files is this phase's.

---

## ⚠ The count gate does NOT protect this phase's own file

`src/pages/WorkflowsPage.test.tsx` appears in **neither `TARGETS` nor `BASELINE`** of
`scripts/vitest-count-gate.cjs`. Nor do `src/pages/__tests__/RunModal.test.tsx`,
`RunModal.a11y.test.tsx`, `PublishedCardDelete.test.tsx`, `WorkflowBuilderPage.session.test.tsx`, or
`ChatLayoutLaunch.test.tsx`. `src/pages/` is reached only by five *named files*;
`src/pages/__tests__/` is reached by nothing at all.

**74 of the 123 covering tests are invisible to the gate** — a deleted `it()` during the restructure
leaves it green. This is the eighth recorded occurrence of the two-knob trap and it is why Wave 0
commit 1 is a gate-adoption commit, before any source change.

---

## Sampling Rate

- **After every task commit:** `npx tsc -p tsconfig.app.json --noEmit` (must stay at **33**) +
  `npx eslint <files touched>` (must stay at **0** for this phase's files) +
  `GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 <suites the task touches>`
- **After every plan wave:** `node scripts/vitest-count-gate.cjs` must be green. Any lowering of a
  pinned count rides in the **same commit** as its authorized deletion.
- **Before `/gsd:verify-work`:** full count gate green + `npx eslint src -c eslint.a11y.config.js` on
  the new `components/workflows/library/` subtree + all ten G-4 UAT rows driven.
- **Max feedback latency:** ~20 s (touched-suite quick run); ~90 s (full gate).

---

## Per-Task Verification Map

> Filled by the planner. One row per task; every task either carries an automated command or names a
> Wave 0 dependency that will provide one.

| Task ID | Plan | Wave | Req | Threat | Secure behavior | Test type | Automated command | Suite exists |
|---|---|---|---|---|---|---|---|---|
| 192-01-T1 | 01 | 1 | LIB-01…04 | T-192-06 | A deleted `it()` in any covering suite fails the gate with `[count-decrease]` | config | `node scripts/vitest-count-gate.cjs` | yes |
| 192-01-T2 | 01 | 1 | LIB-01…04 | T-192-07 | Adopt/decline recorded with its reason; every pin READ, never computed | config | `node scripts/vitest-count-gate.cjs` | yes |
| 192-02-T1 | 02 | 1 | LIB-01 | T-192-02 | Projection widens; no `WHERE` / `ORDER BY` / `owned_only` line changes | unit | `cd backend && venv/Scripts/python -m pytest tests/unit -k "workflow" -q` | yes |
| 192-02-T2 | 02 | 1 | LIB-01 | T-192-01 | `is_mine` computed server-side; **no raw `created_by` on the wire**, fence driven RED | unit + negative fence | `cd backend && venv/Scripts/python -m pytest tests/unit/test_published_workflow_ownership.py -q` | **192-02 creates it** |
| 192-02-T3 | 02 | 1 | LIB-01 | T-192-01 | Both fields optional → a frontend ahead of the backend degrades to *correct*, not merely non-fatal | typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit 2>&1 \| grep -c "error TS"` → **33** | yes |
| 192-03-T1 | 03 | 2 | LIB-03 | T-192-09 | Six modal states read OUT of the live DOM, observed twice, labelled CAPTURE, non-vacuous | characterization | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/__tests__/RunModal.test.tsx` | yes |
| 192-03-T2 | 03 | 2 | LIB-03 | T-192-08 | Capture provably predates the move — `git show <sha>:…/library/RunModal.tsx` exits non-zero | characterization + CLI proof | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/__tests__/RunModal.a11y.test.tsx src/pages/__tests__/RunModal.test.tsx` | yes |
| 192-04-T1 | 04 | 2 | LIB-03 | T-192-12 | Seven Sheet states captured with EXACT server counts; the real ≈169 L extent recorded | characterization | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/__tests__/PublishedCardDelete.test.tsx` | yes |
| 192-04-T2 | 04 | 2 | LIB-03 | T-192-11 | Never dismisses mid-delete · no optimistic vanish — pinned as behaviour, not bytes | unit + CLI proof | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/__tests__/PublishedCardDelete.test.tsx` | yes |
| 192-05-T1 | 05 | 2 | LIB-01, LIB-03 | T-192-14 | One vocabulary home; zero meaning-search words; the lock mark READ from `TIERS.STRICT.glyph` | typecheck + lint | `cd frontend && npx tsc -p tsconfig.app.json --noEmit 2>&1 \| grep -c "error TS"` → **33** | **192-05 creates it** |
| 192-05-T2 | 05 | 2 | LIB-01, LIB-02 | T-192-15 | Dedupe by `id`; chips derive only via `tierForDefinition` / `soulDeliverable`; no runtime API-client import | unit (pure) | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/components/workflows/library/libraryFilter.test.ts` | **192-05 creates it** |
| 192-05-T3 | 05 | 2 | LIB-01, LIB-03 | T-192-13, T-192-14 | F1 · F4 · F5 · threadGroups hash — over an explicitly-named subtree, written before four files exist | source fence + synthetic controls | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/components/workflows/library/librarySubtree.fences.test.ts` | **192-05 creates it** |
| 192-06-T1 | 06 | 3 | LIB-03 | T-192-13 | Module exports the component and no runtime value; names no `WorkflowsPage` specifier | typecheck + lint + fence | `cd frontend && npx tsc -p tsconfig.app.json --noEmit 2>&1 \| grep -c "error TS"` → **33** | yes (192-05) |
| 192-06-T2 | 06 | 3 | LIB-03 | T-192-16, T-192-18 | Six baselines hold with **ZERO re-capture**; export signature + default export unchanged | characterization | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/__tests__/RunModal.test.tsx src/pages/__tests__/RunModal.a11y.test.tsx src/pages/WorkflowsPage.test.tsx src/pages/WorkflowBuilderPage.header.test.tsx` | yes |
| 192-07-T1 | 07 | 3 | LIB-04, LIB-01 | T-192-14, T-192-21 | Create leads; search always on; six typed chips; zero `title=`; no invented glyph | lint + source fence | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/components/workflows/library/librarySubtree.fences.test.ts` | yes (192-05) |
| 192-07-T2 | 07 | 3 | LIB-01 | T-192-19, T-192-27 | Native `<select>`; the D-17 note; a `data-state` updating marker; no `cmdk` | a11y lint | `cd frontend && npx eslint src/components/workflows/library/LibraryToolbar.tsx -c eslint.a11y.config.js` | yes |
| 192-07-T3 | 07 | 3 | LIB-04, LIB-02 | T-192-21 | DOM-order proof; a zero-count chip still renders; no-title WITH a positive control | unit + positive control | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/components/workflows/library/LibraryToolbar.test.tsx` | **192-07 creates it** |
| 192-08-T1 | 08 | 4 | LIB-03 | T-192-11 | State + JSX move as ONE component; both invariant comments intact | a11y lint | `cd frontend && npx eslint src/components/workflows/library/WorkflowDeleteSheet.tsx -c eslint.a11y.config.js` | n/a — lint gate; the Sheet's behaviour is covered by `PublishedCardDelete.test.tsx` |
| 192-08-T2 | 08 | 4 | LIB-03 | T-192-12 | Seven baselines hold with **ZERO re-capture**, on the ORIGINAL render path | characterization | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/__tests__/PublishedCardDelete.test.tsx src/pages/WorkflowsPage.test.tsx src/pages/__tests__/RunModal.test.tsx` | yes |
| 192-09-T1 | 09 | 5 | LIB-02, LIB-03 | T-192-04 | One primary verb per row state; `Publish…` absent; `WorkflowSoul` consumed unchanged; the four shipped testids emitted **verbatim** (22 consumers, 3 pinned suites) | a11y lint + fence | `cd frontend && npx eslint src/components/workflows/library/WorkflowCard.tsx -c eslint.a11y.config.js` | **192-09 creates it** |
| 192-09-T2 | 09 | 5 | LIB-03 | T-192-23, T-192-24 | One fork word → two intact handlers; consequence via `aria-describedby`; draft delete on the single-draft endpoint | typecheck + source assertions | `cd frontend && npx tsc -p tsconfig.app.json --noEmit 2>&1 \| grep -c "error TS"` → **33** | yes |
| 192-09-T3 | 09 | 5 | LIB-02, LIB-03 | T-192-23, T-192-25 | `getElementById` round trip; two absences each with a positive control; cascade `not.toHaveBeenCalled` | unit + positive controls | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/components/workflows/library` | **192-09 creates it** |
| 192-10-T1 | 10 | 6 | LIB-01 | T-192-03, T-192-26 | `allSettled` with per-source isolation; three latest-wins tickets intact; D-17 semantics | unit | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/WorkflowsPage.test.tsx` | yes |
| 192-10-T2 | 10 | 6 | LIB-02, LIB-04 | T-192-18, T-192-28 | Shelves / rail / cards / banner removed; `NetNewFlag` and its `:382` Builder render UNTOUCHED | unit + byte-exact source | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/WorkflowBuilderPage.header.test.tsx src/pages/WorkflowBuilderPage.session.test.tsx` | yes |
| 192-10-T3 | 10 | 6 | LIB-01…04 | T-192-06 | Four rewrites, two authorized deletions, and the ONE pin lowering — same commit | config + unit | `node scripts/vitest-count-gate.cjs` | yes |
| 192-11-T1 | 11 | 7 | LIB-01, LIB-02 | T-192-19 | Search by name and by purpose at 200 rows; the paraphrase returns 0; every chip count equals its rows | unit | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/WorkflowsPage.test.tsx` | yes |
| 192-11-T2 | 11 | 7 | LIB-01 | T-192-03, T-192-27 | A rejected `/drafts` still renders published + starters; starters survive the project filter with a stated reason; `is_mine` ↔ provenance | unit | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/WorkflowsPage.test.tsx` | yes |
| 192-11-T3 | 11 | 7 | LIB-02, LIB-03, LIB-04 | T-192-29, T-192-23 | F2 · F3 (+ positive control) · create-first by `compareDocumentPosition` · draft endpoint vs cascade | negative fence + unit | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages src/components/workflows/library` | yes |
| 192-12-T1 | 12 | 8 | LIB-01…04 | T-192-06 | All five fences + the hash fence observed RED against REAL plants, restored md5-identical | negative fence, driven RED | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages src/components/workflows/library` | yes |
| 192-12-T2 | 12 | 8 | LIB-01…04 | T-192-30, T-192-31 | Subtree delta MEASURED (never the estimate); every suite pinned from a READ number; the G-5 ledger row updated | config + CLI measurement | `node scripts/vitest-count-gate.cjs` | yes |
| 192-12-T3 | 12 | 8 | LIB-01…04 | T-192-21, T-192-32 | Eleven G-4 rows driven at 200 workflows; a blocked row is ⛔ with its reason, never omitted | **manual — Chrome MCP** | manual (`evaluate_script` for DOM geometry; `take_screenshot` times out) | n/a |

*Status legend for execution: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Every row above starts ⬜ pending.*

**Sampling continuity:** no three consecutive tasks lack an automated verify. The only manual task in the
phase is `192-12-T3`, the G-4 operator checkpoint, and it is the LAST task of the LAST plan.

**Wave 0 dependencies, named rather than implied.** `192-02-T2`, `192-05-T1/T2/T3`, `192-07-T3`,
`192-08-T1` and `192-09-T1/T3` each create the suite that verifies them, in the same commit as the code
they verify. Every other task runs against a suite that already existed — because `192-01` (wave 1) put
the four previously-invisible covering suites into the gate **before any source changed**, and `192-03` /
`192-04` (wave 2) captured both characterization baselines while the destination modules **provably did
not exist**.

**Gate ownership across waves.** Worktrees isolate files, not a single shared config, so
`scripts/vitest-count-gate.cjs` is written by exactly THREE plans in three different waves: `192-01`
(adoption), `192-10` (the one authorized **lowering**, riding in the same commit as its two named
deletions) and `192-12` (pin every suite this phase created or grew). Suites created in waves 2–5 are
deliberately left unpinned **while their counts are still growing** — the 188-12 precedent, quoted in the
script itself — and that exemption **expires in `192-12`**. An unpinned suite is an unguarded one, so the
pin is owed, not waived.

**Parallelism, stated honestly.** Waves 1–3 run 2–3 plans concurrently; waves 4–8 are mostly serial. That
is not an oversight: `WorkflowsPage.tsx` is a single 1407-line file that four plans must cut, and
`scripts/vitest-count-gate.cjs` is a single shared config. Both are `files_modified` conflicts that no
amount of worktree isolation can remove. Every plan that CAN run beside another does.

### Requirement → behavior map (from RESEARCH § "Phase Requirements → Test Map")

| Req | Behavior | Type | Exists? |
|---|---|---|---|
| LIB-01 | Typing part of a name filters the list | unit | ❌ new |
| LIB-01 | A word only in `business_requirement` finds the row (D-07) | unit | ❌ new |
| LIB-01 | A paraphrase returns 0 and no copy implies otherwise (D-08) | unit + **source fence F5** | ❌ new |
| LIB-01 | Each chip's count equals the rendered row count under the live query (D-03) | unit (pure) | ❌ new |
| LIB-01 | The merge dedupes by `id` when both feeds return the same row (D-16) | unit (pure) | ❌ new |
| LIB-01 | A rejected `/drafts` fetch still renders published + starter rows (carve-out) | unit | ❌ new |
| LIB-01 | Project select re-queries with `project_folder_id` | unit | ✅ `WorkflowsPage.test.tsx:174` (rewrite interaction, keep assertion) |
| LIB-01 | Latest-wins: a stale response never paints over the selection | unit | ✅ `:187` **must stay green** |
| LIB-01 | Starters stay visible under a project selection, with a stated reason (D-17) | unit + **UAT U6** | ❌ new |
| LIB-02 | Every row renders `WorkflowSoul` with all five atoms | unit | ✅ `:251`, `:265` **must stay green** |
| LIB-02 | No developer string (`GET /workflows/...`) in user-visible DOM (D-11) | **negative fence F2** | ❌ new |
| LIB-03 | A draft row never exposes Run; a runnable row does | unit | ⚠ `:237` rewrite testids, keep contract |
| LIB-03 | `Publish…` is gone (D-10) | **negative fence F3** + positive control | ❌ new |
| LIB-03 | Fork on a **starter** → new suffixed slug + v1 | unit | ✅ `:446` **must stay green** |
| LIB-03 | Fork on a **published** row → same slug + v(N+1) | unit | ✅ `:394` **must stay green** |
| LIB-03 | The consequence sentence is wired by `aria-describedby` and names BOTH halves (D-13/D-14) | unit | ❌ new |
| LIB-03 | **Zero `title=` in the new library subtree** (D-14) | **negative source fence F1** | ❌ new |
| LIB-03 | No confirm sheet on the fork (D-15) | absence + positive control | ❌ new |
| LIB-03 | Draft `Delete` calls `deleteWorkflowDraft`, never the cascade path (D-18) | unit | ❌ new |
| LIB-04 | The create affordance precedes every row in DOM order | unit (`compareDocumentPosition`) | ❌ new |
| D-01 | `RunModal` renders byte-identically after the move (6 states) | **characterization** | ❌ **Wave 0** |
| D-01 | Delete Sheet renders byte-identically after the move (7 states) | **characterization** | ❌ **Wave 0** |
| D-01 | No module under `library/` imports `@/pages/WorkflowsPage` | **source fence F4** + positive control | ❌ new |
| D-01 | `lib/threadGroups.tsx` is byte-unchanged by this phase (158-B trigger #3) | **source fence** (`?raw` hash) | ❌ new |
| D-04 | `/published` and `/starters` both return `is_mine` + `is_system_global` | backend unit | ❌ new |
| D-04 | No raw `created_by` UUID appears on the wire | **negative fence** | ❌ new |
| D-04 | `is_mine` agrees with feed-derived provenance | integration | ❌ new |

---

## Negative fences — each must be driven RED against a real plant

188.2's binding lesson: **a negative fence must be observed RED against a real plant in production
source before it is trusted**, then the file restored byte-identically, with the md5 before/after
recorded in the SUMMARY (the 190-16 precedent).

| # | Fence | Plant that must turn it RED | Restore proof |
|---|---|---|---|
| **F1** | No `title=` attribute anywhere in `components/workflows/library/**` (`?raw` over every module) | Add `title="x"` to one button in the card component | file md5-identical after |
| **F2** | The rendered library view contains no node whose text matches `/GET \/workflows\//` | Re-insert the `:577` chip text into the toolbar | md5 |
| **F3** | No element with text `/^Publish…?$/` renders on any row (D-10) | Add a `Publish…` button to the draft branch | md5 |
| **F4** | No module under `library/` contains `from "@/pages/WorkflowsPage"` (ESM cycle) | Add that import to the moved `RunModal.tsx` — note it **typechecks and lints clean**, which is exactly why the fence must exist | md5 |
| **F5** | No copy **anywhere under `components/workflows/library/**`** contains a meaning-search word (`semantic`, `meaning`, `similar`, `AI-powered`, `smart`, `understands`, `natural language`) (D-08) | Set the search placeholder to `"Search by meaning…"` — authored in the toolbar module, **not** the vocabulary module | md5 |

⚠ **F5's scope is the subtree, not one file** (PATTERNS.md correction C-3). A fence scoped to
`libraryVocabulary.ts` alone is evaded by a `placeholder` authored inline in the toolbar — which is
exactly where its own plant lives. Widen it to `library/**`, the way
`governanceVocabulary.test.ts:66–77` already does.

**One positive control is required** (the Phase 187 lesson — an absence assertion with no positive
control proves nothing): F3's selector must be shown to actually *find* a `Publish…` button when one
exists.

---

## Wave 0 Requirements

- [ ] **Adopt four suites into `TARGETS` + `BASELINE`** of `scripts/vitest-count-gate.cjs`, at numbers
      read from the gate's own `actual` column across **two agreeing runs**:
      `src/pages/WorkflowsPage.test.tsx` (measured 23), `src/pages/__tests__/RunModal.test.tsx` (11),
      `RunModal.a11y.test.tsx` (8), `PublishedCardDelete.test.tsx` (7). `src/pages/__tests__/` needs
      three **file-level** `TARGETS` entries — the directory is covered by nothing.
      **This is commit 1 of the phase**, before any source change, so every later commit is measured
      against a stick that already existed.
- [ ] **Capture the `RunModal` characterization baseline** (6 render states, whole-`innerHTML`) in a
      commit where `components/workflows/library/RunModal.tsx` **provably does not exist** — prove it
      the way 188.2 did, by showing the destination path answers *"No such file or directory"* at the
      capture commit.
- [ ] **Capture the delete-Sheet characterization baseline** (7 render states) — same rule. Note the
      Sheet is **not** a self-contained JSX block: it closes over state at `:743` and `:768–799`, so
      its real extent is ≈169 L, not the 132 L the JSX range suggests.
- [ ] **Decide + record** whether `WorkflowBuilderPage.session.test.tsx` (23) and
      `ChatLayoutLaunch.test.tsx` (2) are adopted. *Recommendation: adopt `session` (it renders the
      live page three times and is unguarded), decline `ChatLayoutLaunch` (2 tests, owned by the
      layout concern)* — state the reason either way, per the script's own adoption rule.
- [ ] No framework install needed.

---

## Manual-Only Verifications — G-4 lived-experience UAT (FIRES)

This phase touches user-visible UI, so G-4 requires operator-defined "I'd recognise failure here"
scenarios. **All rows are judged at 200 workflows, never at 12** (the 045 real-scale lesson — all
three sketches ship a 12/54/200 selector for exactly this reason).

**Chrome MCP constraints, recorded and binding:** `take_screenshot` **times out repeatedly** → read
DOM geometry via `evaluate_script`; `computer` CLICKS can deliver **zero events** while `hover` /
`left_click_drag` work; `elementFromPoint` is machine-checkable reachability.

| # | Behavior | Req | Driven how | Pass bar |
|---|---|---|---|---|
| **U1** | At 200 workflows, find one named workflow by typing three characters | LIB-01 | `evaluate_script` types into the search input, counts rendered rows | Target row visible **without scrolling**; `elementFromPoint` on its centre returns a node inside that row |
| **U2** | Narrow with two chips at once and read the counts | LIB-01/02 | click chips, read chip label text + `querySelectorAll` row count | Every chip's number **equals** the rows it produces; no chip promises results it cannot deliver |
| **U3** | The create affordance is reachable with **zero scroll** | LIB-04 | measure `getBoundingClientRect().top` vs viewport at 200 rows | `top < window.innerHeight` at first paint, and it is the **first** interactive element in DOM order |
| **U4** | The fork verb's consequence is readable **without hover** | LIB-03 / D-14 | count `[title]` inside the library subtree **excluding the `workflow-soul` subtree** (see the correction below); read the `aria-describedby` target's `textContent` | `title` count = **0** in this phase's own chrome; described text present, non-empty, names **both** halves (new private copy **and** published stays live) |
| **U5** | "Tweak" no longer surprises — operator reads the card and states what the verb will do *before* clicking | LIB-03 / SC#3 | manual, operator | The stated expectation matches what happens |
| **U6** | Pick a project → what happens to starters is **explained, not silent** | D-17 | click the project select, read the toolbar | Starters remain **with a stated reason**. **Silence is a FAIL.** |
| **U7** | A paraphrase returns zero and the page does not pretend otherwise | LIB-01 / D-08 | type *"the thing that checks vendors"* | 0 results, honest empty state, one-click *Clear search & filters*, **no copy implying meaning-search** |
| **U8** | The delete Sheet still names exact counts and refuses to dismiss mid-delete (the moved code) | D-01 | open ⋯ → Delete workflow… | Exact server counts render; `Escape` during `deleting` does **not** close |
| **U9** | Run still launches (the moved RunModal) | D-01 | open Run → confirm | Lands on the run surface (canvas flag on) or a new chat thread (flag off) — matching the `run-destination` copy shown |
| **U10** | Touch, no hover (the real experience for a large share of users) | D-14 | emulate touch, re-read every action | Every explanation still legible |
| **U11** | A draft can be deleted from the library, under a guard lighter than the published Sheet | D-18 | open a draft's ⋯ → Delete | Row disappears; the published victim-naming Sheet is **not** what appeared |

**U6 exists because of a measured defect** (RESEARCH § "The unnamed IA defect"). It is the row most
likely to fail and the one no structural test can catch.

### ⚠ Correction to U4, made at plan time and stated rather than quietly fixed

U4 originally read `[title]` count = **0** across the whole library subtree. **That bar is
unachievable, and not for any reason 192 causes.** Measured independently
(`grep -n "title=" src/components/workflows/WorkflowSoul.tsx src/components/workflows/PhaseSpine.tsx`):

- `WorkflowSoul.tsx:99` — `title={tier.description}`
- `PhaseSpine.tsx:77` — `title={name || undefined}` (the comment above it says so outright: *"At card
  scale the name lives only in title= (quiet, hover-only)"*)

Both render inside **every** library row, and both files are locked as **consumed unchanged** (D-01
scope + `WorkflowSoul`'s own G-5 red line). This is precisely the carried defect CONTEXT.md
§`code_context` already recorded — *"the phase-type word is still hover-only (`title=`) on every chain
glyph … recorded here so a later reviewer cannot discover it and assume 192 added it."*

**Therefore:** U4's DOM sweep excludes the `workflow-soul` subtree and measures only the chrome this
phase authors. **F1 is unaffected** — it is a source fence over `library/**`, and neither
`WorkflowSoul.tsx` nor `PhaseSpine.tsx` lives there. Left unstated, U4 would have failed the phase for
a defect two prior phases shipped.

---

## ⚠ The cross-provider roster does NOT apply to this phase — stated, not omitted

CLAUDE.md § "UAT scoreboard recipe" requires the **full native roster (7) + OpenRouter** for any phase
touching streaming, the agent loop, provider routing, or UI state in that sense. **Phase 192 touches
none of them.** Verified: `WorkflowsPage.tsx` imports no provider symbol, reads no model registry, and
opens no SSE stream; the only backend change is two projected columns on two read endpoints. The
launch path (`onLaunch` → `ChatLayout.doRun`) is **unchanged** by this phase and is already covered by
`ChatLayout.launch.test.tsx` (pinned at 17).

**Therefore the 8-row cross-provider scoreboard is NOT triggered.** It is stated here in those words
rather than silently omitted: a phase that drops a required table without saying why is
indistinguishable from one that forgot.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (count-gate adoption + both characterization baselines)
- [ ] Every negative fence F1–F5 observed RED against its plant, restored md5-identical
- [ ] F3's positive control demonstrated
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 s
- [ ] All eleven G-4 UAT rows driven, or explicitly recorded as owed with the row to run first
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
