# Phase 232 — Reviewer Pre-Flight

**Reviewer:** Claude · **Builder:** Gemini · **Plans:** `232-01..04` at `a46b439cc`
**Tree:** `e9e43a5a8` · **Date:** 2026-09-05

**Verdict: ⚠ REVISE — 1 BLOCKING, 3 gaps, 1 advisory.**
Nothing here is a design objection. The contract shape, the zero-migration decision and the
callback-not-config reconciliation are all sound. **The blocking finding is a deletion whose blast
radius was not measured.**

⛔ **No fixes are handed over.** Each finding names what is true and what breaks; the remedy is the
builder's.

---

## ✅ What I checked and found GOOD — stated first, so REVISE is not read as a rejection

- **The zero-migration decision is correct and now properly sourced.** D-232-02 independently
  restates migration 127's `shape_is_not_ambiguous` and the live `capability=NULL` Google rows, and
  the operator ratification is **real and cited** — *"Option A: Zero migrations"*, 2026-09-05
  discuss-phase turn, now in `232-DISCUSSION-LOG.md`. My protocol concern on BUS-131 is **withdrawn**;
  it was a fair question and it has a real answer.
- ⭐ **The multi-folder foreclosure is genuinely reconciled, not deflected.** Folder picking is an
  interactive **callback contract** (`onSelectFolder({folderId, folderName, driveId, driveName})`)
  that persists nothing. So 232 forecloses nothing, and Phase 234's `connector_watches` table remains
  the single home for a watched folder. **That is a better answer than the one I was fishing for.**
- **H-2 is honoured.** `232-03` routes import through `async_mint_document_row` — the 229 splice —
  rather than minting by hand. That is the whole reason 229 came first.
- **The partial discharge is real, not nominal.** `232-03` moves the file-import route out of
  `connectors.py` into `services/sources/import_service.py` **and** updates `docs/HOT-FILE-LEDGER.md`
  + `CLAUDE.md` in the same commit, as the same-commit sync rule requires.
- **The count gate is pinned in both knobs.** `232-04` step 3 says *"Update `scripts/vitest-count-gate.cjs`
  TARGETS and BASELINE"* — **both**, which is the distinction Phase 214 had to learn the hard way.

---

## ⛔ BLOCKING G-1 — deleting `cloud_storage.py` breaks SIX test files, and none is in any `files_modified`

`232-03` truth: *"`backend/app/services/cloud_storage.py` is deleted with zero surviving references
in the repository"*, step 4/5: *"Delete `backend/app/services/cloud_storage.py`."*

**The plan set updates its four PRODUCTION consumers. It does not touch a single test.** Measured:

| Suite | Refs | How it breaks on deletion |
|---|---|---|
| `backend/tests/unit/test_connector_file_import.py` | 7 | ⛔ **`:10` MODULE-LEVEL `from app.services.cloud_storage import fetch_cloud_file, list_cloud_files`** → **COLLECTION ERROR** |
| `backend/tests/integration/test_chat_connectors_e2e.py` | 4 | ⛔ **`:20` MODULE-LEVEL import** → **COLLECTION ERROR** |
| `backend/tests/unit/test_service_tools.py` | 2 | `:400`, `:419` `monkeypatch.setattr("app.services.cloud_storage._list_google_drive_files", …, raising=True)` — ⚠ **`raising=True` ERRORS when the attribute is absent** |
| `backend/tests/integration/test_connector_import_splice.py` | 2 | `:133`, `:196` `patch("app.services.cloud_storage.fetch_cloud_file", …)` → patch target missing |
| `backend/tests/unit/test_connector_org_scope_and_refusals.py` | 3 | `:203`, `:223` function-level `from app.services.cloud_storage import _google_error_reason` |
| `backend/tests/unit/test_google_round1.py` | 1 | docstring reference only — **cosmetic, listed for completeness** |

⛔ **Why this is BLOCKING rather than a gap: two are MODULE-LEVEL imports, so they are COLLECTION
ERRORS, not test failures.** The backend baseline this phase is measured against is
**`72 failed / 3530 passed / 0 collection errors`**, and **`0 collection errors` is part of the
contract** — `CLAUDE.md`'s canonical command exists precisely to hold it. A phase that ships this as
written moves the gate from 0 collection errors to at least 2, and **a collection error hides every
other result in that file**, so the damage is larger than the two numbers suggest.

⚠ **Also note `_google_error_reason` is being MOVED, not deleted** — `232-02` step: *"Implement
`_google_error_reason` extracted and preserved from `cloud_storage.py`"*. So two of these suites are
testing a function that will still exist at a new address. **That is a re-point, not a rewrite** —
but it still has to appear in `files_modified`, or the executor will not touch it.

⭐ **This is the Phase 192.2 lesson firing again, verbatim from `CLAUDE.md`:** *"a plan that deletes a
source file must say which side of the gate it was on; silence reads as 'unchanged' and means
'unwatched'."* Here the file is on the **backend** side of the gate, watched by six suites, and the
plans say nothing.

---

## ⚠ G-2 — `frontend/src/lib/api/connectors.ts` fires G-5, has NO ledger row, and this phase makes it worse

**Measured `10 / 5 / 552`** — five phases, so **G-5 already FIRES**, and it appears in **neither**
`CLAUDE.md`'s table **nor** `docs/HOT-FILE-LEDGER.md` (`grep -c` returns **0** in both). `232-04`
modifies it, taking it to **six phases**.

⚠ **`lib/api.ts`'s row is the BARREL, not this module** — the same distinction already recorded for
`lib/api/org.ts`, `lib/api/knowledge.ts`, `lib/api/threads.ts` and `lib/api/workflows.ts`, each of
which needed its own row for exactly this reason.

**This was named in `232-MEASUREMENTS.md` §3 before planning began**, and `232-03` adds a ledger row
for `connectors.py` while nothing adds one for this file. **A hot file missing from the scan list is
permanently invisible to its own guardrail** — that is the table's stated purpose.

### Two more files `232-03` modifies that have no row either

| File | Measured | Row? |
|---|---|---|
| `backend/app/security/egress.py` | **10 / 3 / 938** | ⚠ **none — FIRES at exactly 3 phases** |
| `backend/app/services/google/sheets.py` | **1 / 0 / 133** | none — young, correctly absent |

⚠ **`egress.py` is the outbound-request chokepoint** and it crosses the G-5 threshold in this phase's
own commit — the same *"crossed the threshold in the commit that added its row"* pattern already
recorded for `FlowEdge.tsx`, `phaseStatusMeta.ts` and `tabs.tsx`.

---

## ⚠ G-3 — the plans assert shared-drive visibility as a TRUTH, but only test it against MOCKS

`232-02` must-have: *"`supportsAllDrives=true` and `includeItemsFromAllDrives=true` eliminate shared
drive invisibility."* Its test step is *"Test Shared Drives listing (`/drives` response mapping)"* —
**a mapping test over a canned response.**

⚠ **The ROADMAP explicitly flags this: *"Shared-drive invisibility is INFERRED, not driven."*** A
mocked assertion does not discharge an *inferred* flag — it re-states the inference in a test. The
only thing that settles it is a real Drive account with a real shared drive.

⭐ **This is the exact shape of `231-*`'s own blocking constraint:** *"A green gate proves nothing
about behaviour — Phase 230 shipped 30/30 green tests over a `progress` column that was corrupt in
the database."* And Phase 230's SC#1 **failed the first time it was actually driven** despite green
tests, clean `tsc` and a passing crash-recovery unit test.

**Either drive it against the live Google connection (two `service_id='google'` rows exist), or state
in the plan that it remains INFERRED and record it as an owed drive.** ⛔ What must not happen is a
must-have that reads like a driven fact when it is a mocked one — that is the *verdict cell
disagreeing with its evidence cell* finding this milestone has now hit twice.

---

## ⚠ G-4 — no `232-VALIDATION.md`

Phases 228, 229 and 230 each carry one, and **`230-VALIDATION.md` landed in the SAME commit as its
plans** (`43185fad6`) — so authoring it at plan time is this milestone's established pattern, not an
execute-time artifact.

`CLAUDE.md` is explicit: *"UAT rows MUST be authored under VALIDATION.md, NOT in PLAN.md tasks."*
⚠ Whether **SC#10**'s 4-axis cross-provider bandwidth fires here is a judgement I am deliberately not
making for the builder — 232 touches no provider routing, but it does add UI state. **What is not a
judgement call is that the file is absent while three consecutive phases have one.**

---

## Advisory — `service_tools.py`'s ledger row is stale in a way that matters

Row reads **`11 / 1 / 2018`**; re-derived at HEAD it is **`11 / 1 / 2018`** — ✅ **accurate, unusually
for this repo.** Recorded because I checked it and it held, not because it drifted.

⚠ But its disposition still reads *"absent for its ENTIRE LIFE — row added 221. Its bucket list is
ALL dated quick tasks, so it measures 0 phases at 1456 L"* — the **1456 L** in the prose disagrees
with the **2018** in its own cell. `232-03` modifies this file, so the same-commit sync rule applies.

---

## What I did NOT do

- **I did not run the gates against the plans.** Nothing has executed; there is nothing to measure yet.
- **I did not verify the `/drives` endpoint or `supportsAllDrives` semantics against Google's docs.**
  That is the builder's provider-docs-first obligation, and re-deriving it would be me doing the build.
- **I did not check the four plans' internal task ordering for wave-safety.** `depends_on` is declared
  (`01 → 02 → 03 → 04`, strictly serial), so there is no parallel-write hazard to audit.
