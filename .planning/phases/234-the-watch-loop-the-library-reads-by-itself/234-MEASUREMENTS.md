# Phase 234 — REVIEWER BASELINES

**Captured by:** claude (REVIEWER — AGENTS.md 6.3; gemini BUILDS this phase)
**Captured:** 2026-09-05 → 2026-09-06, BEFORE the builder touched any source
**Base SHA:** `8cdc235b494ec4c05a134a5e6d8bd12cd81b6cfe` (branch `develop`)
**Tree state at capture:** no source modified. Dirty paths were `.agent-bus/OPEN.md`, deleted
`screenshots/*`, and two untracked artifacts. **No file under `backend/app`, `frontend/src` or
`supabase/migrations` was modified or staged.**

Every figure below was **re-measured**, not read from ROADMAP.md, CLAUDE.md or any claim. Where a
recorded figure disagreed with measurement, **both are shown** and the recorded one is marked
stale — never overwritten.

---

## 1. Gate baselines

| Gate | Command | Result at base |
|---|---|---|
| Backend unit | `pytest tests/unit -q --continue-on-collection-errors` (backend/, venv) | **71 failed · 3719 passed · 2 xfailed · 2 xpassed · 0 collection errors** · 282.52s |
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | ⚠ **RED** — `total 7538 · failed 1 · pinned total 6808` |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | **OK** — 110,751 chars · 73.8% · 39,249 to the hard limit, **9,249 to the warn band** |
| Deploy drift | `bash scripts/check-deploy-drift.sh` | **PASS** (2 pre-existing non-blocking WARNs) |
| G-7 rounds | `node scripts/check-gap-closure-rounds.cjs 234` | **0** — no phase directory existed at capture |

### 1a. ⚠ The frontend gate is RED **before** this phase starts

The builder must not inherit *"the gate is green"* as the phase's bar. It is not green now.

- **Failing file:** `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx`
- **Failing case:** `WorkflowBuilderPage 184-12 — growing the flow, and the two refusals …and to the PRECEDING one when the deleted step was last`
- **Signature:** `Error: STACK_TRACE_ERROR` at `WorkflowBuilderPage.canvas.test.tsx:1060`
- **Provenance:** filename taken from the gate's **own persisted JSON report BEFORE any re-run**,
  per CLAUDE.md's SEED-171 triage rule. The file is **byte-unchanged** against the base.
- **Classification:** **SEED-171's fifth member**, the cap-independent flaky set.
  ⚠ Recorded as an observation. **Provably unmodified is not the same as innocent** — one green or
  red sample proves nothing, and SEED-171 records that three of its five fail with a plain
  `AssertionError` rather than this signature, so the signature is not a reliable "not a real
  defect" tell.

**Consequence for planning:** an acceptance criterion of *"count gate OK"* was already unreachable
at the base commit. Pair it with per-file deltas and the explicitly-run in-scope suites.

### 1b. ⚠ Backend is EXACTLY at the ceiling — zero headroom

Measured **71 failed**; CLAUDE.md's locked baseline is **71**. **Any single new backend failure
breaks the mandatory gate.** (An earlier session recorded 72 before Phase 233; it measures 71 now.
The current measurement is the one that binds.)

---

## 2. Refuted claims in the ROADMAP entry for Phase 234

Stated as measured facts in the roadmap; **false at the base commit**.

### R-1 ⛔ The reserved migration numbers **157-160** are wrong

- `157` … `165` **never existed** (`git log --diff-filter=A` returns nothing across that range).
- `166_app_settings_vision_model.sql` and `167_resize_skill_embeddings_with_chunks.sql` were minted
  **on 2026-09-05** (`47680497a`, `7afd68b04`) — the numbering already jumped past the reserved block.
- Taking `157-160` now files this phase's schema **numerically before two migrations already applied
  to the live DB**, reordering the greenfield `--reset` sequence and the `full-schema.sql` rebuild
  against the order the live DB actually ran.
- ⚠ **OPERATOR decision, not one for either agent to settle** (CLAUDE.md). Posted `--to operator`.
  Do not pick a number by agent agreement.

### R-2 ⛔ Both `documents.py` line anchors are stale

The roadmap cites `documents.py:2483` and `documents.py:1894`. The file is **2406 lines** — `:2483`
does not exist.

| Roadmap says | Measured |
|---|---|
| rule evaluation inside `ingest_document` at `:2483` | `ingest_document` at **`:1983`**; the rule-eval pass at **`:2280`** |
| `accept_classification` at `:1894` | **`:1847`** (writes `folder_id` at ~`:1908-1911`) |

✅ **The underlying H-4 claim is CONFIRMED at the corrected lines:** the rules engine writes only a
`_classification` **suggestion** into `metadata_dict` (`classification_matcher.build_suggestion`,
carrying `suggested_folder_id`) and **never writes `folder_id`**. The only code that moves a
document is `accept_classification`. The fence belongs there.

### R-3 ⛔ `claim_due_schedules` is not in `scheduler_service.py`

- Measured: **`backend/app/db/schedules.py:263`**.
- `backend/app/db/schedules.py` = **1 / 1 / 359** and **has no ledger row either** — the roadmap
  names only `scheduler_service.py` as owing one. The watch loop binds to *both*.
- `scheduler_service.py`'s surface is `launch_scheduled_run`, `_drive_run`, `SchedulerService`,
  `_as_uuid` — no claim function.

---

## 3. Hot-file ledger triples — RE-DERIVED at the base commit

Recipe: CLAUDE.md's, with six-digit dated-quick-task buckets excluded.

| File | recorded cell / roadmap | **measured** | verdict |
|---|---|---|---|
| `backend/app/services/scheduler_service.py` | 5 / 2 / 399 · **NO ledger row** | **5 / 2 / 399** | ✅ accurate. Row absence CONFIRMED: `0` hits in CLAUDE.md. The single hit at `docs/HOT-FILE-LEDGER.md:4693` is incidental prose inside **another file's** section, not a row. **A row is OWED in this commit.** |
| `backend/app/db/schedules.py` | *(named nowhere)* | **1 / 1 / 359** | ⚠ **invisible to G-5 for its entire life**, and it owns `claim_due_schedules` |
| `backend/app/api/documents.py` | 75 / 32 / 2408 | **81 / 33 / 2406** | ⚠ stale (+6 commits, +1 phase) |
| `backend/app/services/connector_service.py` | 21 / 7 / 1601 | **22 / 8 / 1613** | ⚠ stale |
| `backend/app/api/connectors.py` | 33 / 16 / 1879 | **35 / 17 / 1885** | ⚠ stale |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | cell 17/7/2376 · roadmap 20/8/2376 | **22 / 9 / 2418** | ⚠ stale in **both** |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 24 / 8 / 1578 | **24 / 8 / 1578** | ✅ accurate |

⚠ Both settings files fire G-5, so the roadmap's **G-1 risk is real**: bolting the sources UI onto
either gives it a third/fourth consecutive connection-settings phase.

---

## 4. Clean-slate baselines (so "it works now" can be told from "it already did")

| Property | Measured at base |
|---|---|
| `connector_watches` / `source_state` in migrations or backend | **absent** — nothing built yet |
| User-visible `"instantly"` / `"on change"` in `frontend/src` | **none.** All 10 grep hits are code comments or the `onChange` identifier — no user-facing string. SC#1's forbidden-word fence starts clean |
| Existing injection-fence surfaces (TRUST-03 blast radius) | `agent_loop.py`, `connectors/chat_tools.py`, `connectors/service_tools.py`, `email_provider.py`, `forced_emit.py`, `harness/phase_types.py` |
| SEED files present | `SEED-142` (binds the CLAUDE.md rule retirement) · `SEED-239` (one malformed config must degrade one source) |
| CLAUDE.md rule to retire **in the same commit** | line **34** — *"Ingestion is manual file upload only — no connectors or automated pipelines…"* |

---

## 5. What I will re-measure at review (never read from a claim)

1. Both gates from the repo root, verdict lines verbatim — backend against **71**, frontend against
   per-file deltas plus the named in-scope suites.
2. The ledger row for `scheduler_service.py` (and whether `db/schedules.py` got one).
3. CLAUDE.md line 34 retired **in the same commit** as the first sync — SEED-142's binding.
4. `SourceListing.complete=True` as a **structural assertion** gating every `missing` write, shipped
   in the same plan as the diff (H-5 / SRC-06).
5. The H-4 fence on `accept_classification` (`:1847`), driven rather than read.
6. SC#2, SC#3 and SC#5 are **behavioural** — they will be driven, not inspected.
