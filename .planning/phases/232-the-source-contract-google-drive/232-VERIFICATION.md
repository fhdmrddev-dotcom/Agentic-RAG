# Phase 232 Verification — The Source Contract + Google Drive

**Reviewer:** Claude · **Builder:** Gemini · **Range:** `53bb866e4..1ae6defbb`
**Date:** 2026-09-05

**Verdict: ✅ PASS on capability — ⛔ 2 REQUIRED CORRECTIONS, both bookkeeping.**

> ⚠ **Review independence preserved.** `232-04` was authored by Gemini and left uncommitted when
> that session went idle; I committed it **without changing a line** (`1ae6defbb`), so I built none
> of this phase (AGENTS.md §6.3). The one plan task I deliberately did **not** do is recorded below
> as an open gap rather than quietly fixed.

---

## 1. Driven, not read

⭐ **The contract was exercised end-to-end against a real adapter through the real registry**, not
inspected. Every verb, in order:

```
resolve mock_source  -> MockSourceAdapter
resolve google       -> GoogleDriveSourceAdapter
browse   (root)      -> [('mock-root', 'My Drive', 'folder')]
browse   (child)     -> [('folder-eng', 'Engineering', has_children=True)]
list_files           -> [('architecture.pdf', 'application/pdf', 1024),
                         ('readme.txt', 'text/plain', 256)]
read_file            -> architecture.pdf | application/pdf | 34 bytes
check                -> SourceHealth(ok=True, error=None,
                          details={'status': 'mock_connected', 'account': 'test@example.com'})
```

⭐ **`SourceRegistry` resolves BOTH families by `service_id`** — that is `SRC-01`'s "a source family
is a registration, not a branch" claim actually working, rather than asserted.

---

## 2. Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| **SRC-01** — one `browse / list / read / check` contract | ✅ | `sources/base.py` defines exactly four verbs (`:73`, `:82`, `:94`, `:105`); registry resolves two adapters; **driven above** |
| **SRC-02** — Drive as the first thin adapter | ✅ **structurally** | `adapters/google_drive.py` passes the **shared** conformance suite alongside the mock (`test_source_adapter_conformance.py` imports and fixtures both) |
| **SRC-01** — the shipped one-file import re-pointed onto it | ✅ | `connectors.py:1646` → `browse_connection_files`, `:1680` → `import_single_file`, `:1720-1730` → `SourceRegistry.get_adapter`. **No route reaches into a private Drive helper any more.** |
| **`cloud_storage.py` retired** | ✅ | file **deleted**; only two prose mentions survive (a docstring and a historical comment), both deliberate context |

⚠ **`SRC-02` is verified STRUCTURALLY, never behaviourally.** No live Google Drive was driven. The
phase records this honestly as **`OD-232-01`** in `232-VALIDATION.md` §4, marked
**INFERRED (OWED DRIVE)** — which is the right call and was my pre-flight G-3.
⛔ **A shared drive has still never been listed by this product.**

---

## 3. Gates

| Gate | Baseline (`53bb866e4`) | Now | Verdict |
|---|---|---|---|
| Backend `tests/unit` | 72 failed · 3530 passed · **0 collection errors** | **72 failed · 3567 passed · 0 collection errors** | ✅ failures **identical**, **+37 passing** |
| `tsc -p tsconfig.app.json` | 66 | **66** | ✅ exact |
| Source suites | — | **37 passed** | ✅ |
| `SourceFolderPicker.test.tsx` | — | **7 passed**, pinned in TARGETS **and** BASELINE | ✅ |
| Library + ingestion suites | — | **319 passed**, 2 failed | ✅ both failures are `BUS-114`'s inherited `IngestionStrip` fence, byte-unchanged |

⭐ **MY BLOCKING PRE-FLIGHT FINDING IS CLOSED BY MEASUREMENT, NOT BY CLAIM.** G-1 said deleting
`cloud_storage.py` would break six suites, two at module level, taking collection errors from 0 to
at least 2. **The suite now collects 4560 tests with ZERO collection errors** and all six files were
re-pointed. That is the finding working as intended: raised at pre-flight, fixed before execution,
verified after.

---

## 4. ⛔ CORRECTION 1 — the "PARTIAL DISCHARGE" claim is FALSE. `connectors.py` GREW.

The ROADMAP promised the file-import route moving out would be *"a **PARTIAL DISCHARGE**, not merely
construction"*, and the ledger cell records it as achieved:

> `| backend/app/api/connectors.py | 30 / 14 / 1708 | ⚠ FIRES | ✅ **PARTIAL DISCHARGE (232-03)** — file browse & import extracted to services/sources/import_service.py (-28 net L) |`

**Measured across the whole phase:**

| | lines |
|---|---|
| at `53bb866e4` (phase start) | **1736** |
| at `1ae6defbb` (phase end) | **1757** |
| **phase net** | **+21 — the file is BIGGER** |

Per plan: `232-03` **−28**, then `232-04` **+49** (the `/browse` endpoint). The cell is true of
`232-03` alone and **false of Phase 232**.

⚠ **The triple is stale in the same range too** — cell reads `30 / 14 / 1708`, re-derived at HEAD it
is **`32 / 15 / 1757`**.

⭐⭐ **THIS IS PHASE 231's OWN RECORDED FINDING, REPEATING ONE PHASE LATER.** `231-SUMMARY.md`
finding #2 reads: *"Ledger cell written mid-phase falsified by the same phase's later commit… **The
rule this produces: write the ledger note LAST, or re-derive at the phase's final commit.** A phase
that touches a file twice falsifies its own note."* 232 touched the file twice and did it again.
**A cell that says `✅ DISCHARGED` stops the next audit** — that is precisely why this table's own
rules say a present-and-wrong row is worse than an absent one.

**Required:** re-derive to `32 / 15 / 1757` and restate the disposition honestly — the extraction is
real and worth recording, but the phase did **not** reduce the file.

---

## 5. ⛔ CORRECTION 2 — the `lib/api/connectors.ts` ledger row was promised and is absent

`232-04`'s own must-have: *"HOT-FILE-LEDGER.md and CLAUDE.md record the new G-5 ledger row for
`frontend/src/lib/api/connectors.ts` (10 / 5 / 552) in the same commit (G-2)."*

**Measured: `grep -c` returns 0 in BOTH `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md`.** The file now
sits at **six phases** with no row, so **G-5 cannot fire on it at any count**.

⚠ **`lib/api.ts`'s row is the BARREL, not this module** — the distinction already recorded for
`lib/api/org.ts`, `knowledge.ts`, `threads.ts` and `workflows.ts`, each of which needed its own row
for exactly this reason. It was named in `232-MEASUREMENTS.md` §3 **before planning began** and
again in the pre-flight.

⚠ **I did not write it myself**, deliberately: it is a task from `232-04`'s plan, and doing it would
make me a builder on a phase I am reviewing.

---

## 6. Minor — recorded, not required

- **The mock fixture is internally inconsistent.** `list_files` declares `architecture.pdf` at
  **1024 bytes**; `read_file` returns **34**. Harmless today, but any consumer that trusts `size`
  for progress, validation or a pre-flight check would never be caught out by this fixture.
- **`232-04` was committed by the reviewer**, which is unusual and is disclosed at the top of this
  report rather than left to be discovered in `git log`.

---

## 7. What was NOT verified

- ⛔ **No live Google Drive.** Browsing a real Drive, a real shared drive, and a real folder pick have
  **never happened**. `OD-232-01` owns this. ⚠ Its deadline is *"before v4.0 closeout **when** live
  credentials are available"* — the second clause is a **precondition nobody owns**, which is how
  Phase 230's SC#2/SC#3 came to be still owed.
- **The `/browse` endpoint over HTTP.** Driven at the adapter and registry layer, not through the
  running API — the backend was not up. The route's wiring is covered by its 7 passing tests.
- **Phase 238's measurement.** Whether this contract was *right* is answered by how small the
  Microsoft Graph adapter turns out to be, not by anything observable here.
