---
phase: 235
slug: the-source-says-what-it-did
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-06
---

# Phase 235 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `235-RESEARCH.md` §"Validation Architecture". **Every baseline figure below was
> MEASURED on 2026-09-06 in the research session — none is copied from CLAUDE.md, whose figures
> for both gates are stale.**

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest (`backend/venv`) |
| **Backend config** | `backend/pytest.ini` / `backend/tests/` |
| **Backend quick run** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/services/test_watch_*.py tests/unit/db/test_watches_db.py -x -q` |
| **Backend full suite** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors` |
| **Frontend framework** | vitest + @testing-library/react + jsdom |
| **Frontend quick run** | `cd frontend && npx vitest run src/components/sources --maxWorkers=2` |
| **Frontend gate** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` — **from the repo root** |
| **Estimated runtime** | backend full ~4 min · frontend gate ~6 min · quick runs < 40 s |

### ⚠ MEASURED baselines (2026-09-06) — compare against THESE, not CLAUDE.md

| Gate | CLAUDE.md says | **MEASURED** |
|---|---|---|
| vitest count gate | `6355` total / `5266` pinned / `120/120` files | **`total 7544 · failed 0 · pinned total 6814` · `count gate OK — 227/227 pinned files present`** · exit 0 |
| backend unit | ceiling **71** failed | **`72 failed, 3785 passed, 2 xfailed, 2 xpassed`**, 0 collection errors |

⛔ **The backend baseline is already ONE OVER CLAUDE.md's ceiling, and it is PRE-EXISTING** — Phase 234
measured 72 on its merge base too. **This phase does not inherit the blame and must not "fix" it.**
The operative rule for this phase is: **no NEW failure above 72.** A run reading 73+ has a real
regression; a run reading 72 is the inherited state. Record the number verbatim at every wave merge.

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/components/sources --maxWorkers=2` **plus** the
  pytest file for whatever backend file the task touched.
- **After every plan wave:** BOTH full gates —
  `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) and
  `pytest tests/unit -q --continue-on-collection-errors` (backend, venv).
- **Before `/gsd:verify-work`:** vitest gate prints `count gate OK`, backend reads **≤ 72 failed**.
- **Max feedback latency:** ~40 s (quick run) · ~6 min (full gate).

⚠ **Capture failing filenames from the gate's own persisted JSON BEFORE re-running anything**
(SEED-171 procedure). Do not reach for the worker cap — it is measured NOT to fix these failures.
`GSD_VITEST_MAX_WORKERS=2` stands, and ≤ 2 concurrent test-running agents.

---

## Per-Requirement Verification Map

| # | Requirement | Behaviour that must be pinned | Layer | Automated command | Exists? |
|---|---|---|---|---|---|
| V-01 | SURF-02 | **All FOUR** `release_watch` arms write exactly one `connector_sync_runs` row — including `tick()`'s crash arm at `watch_service.py:115`, which is OUTSIDE `sync_watch` | backend pytest | `pytest tests/unit/services/test_watch_sync_runs.py -x` | ❌ Wave 0 |
| V-02 | SURF-02 | A tick with `listing.complete = False` writes `listing_complete = false`, and `count_missing = 0` is NOT rendered as "nothing deleted" | backend pytest | same file | ❌ Wave 0 |
| V-03 | SURF-02 | Prune keeps exactly N rows per watch and deletes the OLDEST — driven at N+3 | backend pytest | `pytest tests/unit/db/test_watches_db.py -x` | ⚠ extend existing |
| V-04 | SURF-02 | Quiet-run collapsing is **RENDERING**: N stored rows → 1 `quiet-fold` line; expanding shows all N | frontend vitest | `npx vitest run src/components/sources/WatchedFoldersSection.history.test.tsx` | ❌ Wave 0 |
| V-05 | LIB-10 | Hard cause ⇒ stopped on failure **1**; soft cause ⇒ stopped only at failure **3**; **failure 2 is NOT stopped** | backend pytest | `pytest tests/unit/services/test_source_health_verdict.py -x` | ❌ Wave 0 |
| V-06 | LIB-10 | Zero run rows ⇒ `neverRead`, **not** stopped | backend pytest | same file | ❌ Wave 0 |
| V-07 | LIB-10 | Each cause maps to exactly ONE control, and the map is **DATA** — a new cause needs no branch edit | frontend vitest | `npx vitest run src/components/sources/sourceHealthVocabulary.test.ts` | ❌ Wave 0 |
| V-08 | LIB-10 | The five binding rules hold over the WHOLE sentence table, non-vacuity case FIRST, em dash asserted by **runtime codepoint** | frontend vitest | same | ❌ Wave 0 |
| V-09 | LIB-10 | Every cause the backend classifier can emit HAS a sentence — pinned against the **live** `failure_cause.py` via `?raw`, never a copy of its table | frontend vitest | same | ❌ Wave 0 |
| V-10 | LIB-10 / D-235-12 | The reader-off statement appears **exactly once**, and no card is marked individually broken | frontend vitest | composition fence | ❌ Wave 0 |
| V-11 | SURF-03 | `RailItem` renders the badge at **both** 58px collapsed and 210px expanded | frontend vitest | `npx vitest run src/components/layout/__tests__/NavPanel.badge.test.tsx` | ❌ Wave 0 |
| V-12 | SURF-03 | The popover's action calls `onNavigate("documents")` **and** selects the Health tab — no URL, no `window.location` (SEED-185: there is no router) | frontend vitest | same + a `LibraryPage` case | ❌ Wave 0 |
| V-13 | SURF-03 / SC#4 | The badge does **not** render for a healthy source, nor for ONE soft failure | frontend vitest **and** backend pytest | both | ❌ Wave 0 |
| V-14 | SEED-239 / D-235-13 | One unprojectable row degrades **ONE** row; the other N−1 still render; the list is **not** a 500 | backend pytest | `pytest tests/unit/api/test_sources_degraded_row.py -x` | ❌ Wave 0 |
| V-15 | BUG-260906-02 (1) | Reader off ⇒ `/sync` **refuses** and names configuration, not the folder | backend pytest | `pytest tests/unit/api/test_sources_sync_honesty.py -x` | ❌ Wave 0 |
| V-16 | BUG-260906-02 (2) | The word **"scheduled"** appears in **neither** `api/sources.py` **nor** `WatchedFoldersSection.tsx:78` — a source fence over BOTH files | backend pytest **and** frontend `?raw` fence | both | ❌ Wave 0 |
| V-17 | BUG-260906-02 (3) / SEED-248 | Between click and tick the card shows `asked(...)`, flipping to the real outcome when `last_run_at` advances past the click | frontend vitest | history suite | ❌ Wave 0 |
| V-18 | SURF-01 (inherited, 234) | `checked every {N} minutes` still renders **verbatim** — a pinned invariant, do not reword | frontend vitest | `WatchedFoldersSection.test.tsx` | ✅ **exists, pinned at 6** |
| V-19 | D-235-21 | The health verdict is computed from the **live** reader state (`app.state.watch_service is not None`), never from `settings.watch_process_enabled` alone | backend pytest | `test_source_health_verdict.py` | ❌ Wave 0 |
| V-20 | D-235-03 | The shell signal surface accepts a **registry** of producers and Phase 235 registers exactly ONE — adding a second needs no new surface | frontend vitest | badge suite | ❌ Wave 0 |

---

## ⭐ The composition fence — how the BUILD-CONTRACT is asserted, RED first

**The sketch-218 lesson, in this project's own words** (`sketchComposition.test.tsx:5-9`):
> *"A contract that cannot name a MISSING BLOCK cannot tell 'built' from 'not built yet'."*
> 200 assertions, 0 failing, and four of five tabs carried none of the sketch's furniture.

**Four steps, in this order:**

**Step 1 (Wave 0) — make the contract machine-readable.** Add `--emit-json` to
`.planning/sketches/233-the-source-says-what-it-did/drive.cjs`, writing a **region-scoped**
`sourceComposition.json` (using that file's own `region()` helper at `:356-362`, which `--emit`
currently ignores) into `frontend/src/components/sources/__generated__/`. Ship the COPY object in the
same artifact so §1's strings are **imported, never re-typed** — **all 27 keys**, and the cause
sentences as **functions of the connection name**, not with `"Legal SharePoint"` baked in.
⛔ In-package copy, **never** `?raw` into `.planning/sketches/` — that directory is archived by
`/gsd:complete-milestone`.

**Step 2 (Wave 0) — write `sourceComposition.test.tsx` and land it RED.**
1. **Non-vacuity floor** — the imported JSON has ≥ 15 block kinds. *A moved import resolves EMPTY
   rather than throwing, and a contract of zero blocks makes every assertion pass over nothing.*
2. **Positive controls** — 2–3 cases GREEN in the red baseline. *A run where EVERY case is red is
   indistinguishable from a broken mount harness.*
3. **Every block** — one `it()` per kind from the distinct-20 set.
4. **Every named control** — `badge · open-health · sync-now · toggle-history · toggle-quiet · fix ·
   report-source · go-to-source`.
5. **The counts that must hold** — variant **B**: **9** `source-line` + **3** `source-card`; exactly
   **2** `attention-row`; collapsed **3** `run` vs expanded **17**; `instance-statement` **exactly
   once**.
6. **The §4 invariants as source fences** — no `"scheduled"`, no `"instantly"`, no `"on change"`,
   `--color-danger` never applied to a source state.

⛔ **NOT in `TARGETS` or `BASELINE` while red.** The gate's contract is *zero failing, forever*.

**Step 3 — record the RED run VERBATIM** in `.planning/phases/235-the-source-says-what-it-did/235-BASELINE.md`,
the way `217.1-BASELINE.md` did. **The red run is the deliverable.**

**Step 4 (final wave) — adopt BOTH knobs in ONE commit**, at the gate's own printed `— N new`
figure, never a guessed number, and never while red.

⚠ **Two knobs, and they answer different questions.** `TARGETS` decides what RUNS; `BASELINE`
decides what is GUARDED. **`src/components/sources` is NOT a TARGETS directory entry** (measured at
233) — a new suite there runs ONLY IF PINNED.

⚠ **The COPY half is asserted SEPARATELY**, in `sourceHealthVocabulary.test.ts`, over the whole
table. Text assertions live there; composition assertions live in the fence. **Neither substitutes
for the other — that is the whole 218 lesson.**

⚠ **Convention deviation, recorded rather than silent:** the BUILD-CONTRACT names `data-block`;
the shipped house convention is `data-testid` and `sketchComposition.test.tsx:33-38` actively
**forbids** `data-block` in the build (~1500 occurrences of the shipped convention). **Follow the
shipped convention**; the contract's block NAMES are what is binding, not its attribute spelling.

---

## Wave 0 Requirements

- [ ] `drive.cjs --emit-json` → `frontend/src/components/sources/__generated__/sourceComposition.json`
- [ ] `frontend/src/components/sources/sourceHealthVocabulary.ts` (+ `.test.ts`) — zero-import leaf
- [ ] `frontend/src/components/sources/sourceComposition.test.tsx` — **lands RED**
- [ ] `backend/app/services/sources/failure_cause.py` (+ unit tests) — the hard/soft classifier as DATA
- [ ] `backend/tests/unit/services/test_watch_sync_runs.py`
- [ ] `backend/tests/unit/services/test_source_health_verdict.py`
- [ ] `backend/tests/unit/api/test_sources_sync_honesty.py`
- [ ] `backend/tests/unit/api/test_sources_degraded_row.py`
- [ ] `frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx`
- [ ] Gate knobs (`TARGETS` **and** `BASELINE`) for every new frontend file — **both, same commit**,
      in the FINAL wave, never while red

---

## Manual-Only Verifications (G-4 lived-experience rows — operator, Chrome)

| # | Behaviour | Requirement | Why manual | Test instructions |
|---|---|---|---|---|
| M-1 | A real watch fails; the badge appears **on a page that is not the Library**; the popover names the source; the one control fixes it | SURF-03, LIB-10 | *"reaches a person"* is a felt judgement no wire format settles | Break a watch (revoke the Drive grant), sit on the Chat page, wait one poll interval, observe the rail badge, open the popover, click through to Health, then to the card, press the control |
| M-2 | The badge does **not** appear for a healthy source, and does **not** appear after ONE transient failure | SC#4 | Cry-wolf is only observable over time | Stop the local network for one tick, restore it, confirm nothing fires; confirm it fires on the third |
| M-3 | The Sync button says what it DID, never `"scheduled"`, and shows `Asked · next check within N` in between | BUG-260906-02 | The pending window is a live timing behaviour | Press Sync, watch the three states in order |
| M-4 | With `WATCH_PROCESS_ENABLED=false`, the instance statement appears **once** and no card is marked individually broken | D-235-12 | The "once, not per row" property is visual | Flip the env var, restart the backend, load the Ingestion tab |
| M-5 | A planted malformed `config` row degrades **that one row** and every other source still renders | SEED-239 / D-235-13 | The blast radius is the point | `UPDATE connector_connections SET config = '"broken"'::jsonb WHERE id = …`, reload the Ingestion tab |

⚠ **`NavPanel` is `hidden md:flex` — DESKTOP ONLY.** A `RailItem` badge alone does **not** satisfy
*"reaches a person where they already are"* on mobile. **This is the single most likely place
`SURF-03` gets closed against its own sentence a second time.** The phase must either carry a mobile
home for the signal or record the gap explicitly as a named deferral with a re-open trigger — never
close SURF-03 silently against a desktop-only surface.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers every ❌ reference above
- [ ] No watch-mode flags anywhere
- [ ] The composition fence landed RED and the red run is recorded verbatim in `235-BASELINE.md`
- [ ] Both gate knobs adopted in the FINAL wave, in one commit, at the gate's own printed figure
- [ ] Backend reads **≤ 72 failed** (the measured inherited baseline), vitest prints `count gate OK`
- [ ] Every process-level flag this phase depends on has its **measured** operator value recorded
      (D-235-21 — `WATCH_PROCESS_ENABLED` measured **`true`** in `backend/.env` on 2026-09-06)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** plan-set coverage APPROVED 2026-09-06 by `gsd-plan-checker` — `## VERIFICATION PASSED`,
no blockers, every V-01..V-20 row traced to an owning plan.

⚠ **`nyquist_compliant: true` records that the PLAN SET covers every row — not that the tests are
written.** `wave_0_complete` stays **false** until Wave 1 actually lands the Wave-0 files, and the
Sign-Off boxes stay unchecked until the thing each one asserts has been MEASURED. Ticking a box
because a plan promises it is the failure this file exists to prevent.
