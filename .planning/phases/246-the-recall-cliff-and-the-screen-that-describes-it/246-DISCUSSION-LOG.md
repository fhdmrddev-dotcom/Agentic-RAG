# Phase 246: The Recall Cliff, and the Screen That Describes It - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 246-the-recall-cliff-and-the-screen-that-describes-it
**Areas discussed:** retrieval_service.py G-5 extraction obligation, Default search breadth & D-v4.0-EF-DEFAULT reversal (RECALL-01), Server GUC shortcut fix in retrieval_tuning.py (RECALL-02 / SEED-268), Settings UI & Retrieval Card Copy (SettingsPage.tsx)

---

## 1. `retrieval_service.py` G-5 Extraction Proposal

| Option | Description | Selected |
|--------|-------------|----------|
| Option 1B | Strictly fence `retrieval_service.py` (0 lines touched in Phase 246) — update defaults in `config.py` and knob logic in `retrieval_tuning.py` without incurring a 3rd landing | ✓ |
| Option 1A | Perform the G-5 extraction now — extract document fetching to `document_retrieval.py` and fusion/dedup to `retrieval_fusion.py` to permanently discharge the G-5 debt | |
| You decide | Proceed with the cleanest architectural approach | |

**User's choice:** Option 1B (Strictly fence `retrieval_service.py`)
**Notes:** `retrieval_service.py:126` already forwards `(user_settings.hnsw_ef_search if user_settings else settings.hnsw_ef_search)` dynamically and delegates GUC execution to `retrieval_tuning.py`. It hardcodes no defaults. Fencing the file eliminates blast radius and avoids triggering a 3rd G-5 landing in this phase.

---

## 2. Default Search Breadth & D-v4.0-EF-DEFAULT Reversal (`RECALL-01`)

### Implementation Mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Code default (No migration) | Update `config.py` and `models/user_settings.py` to 200; existing NULL rows in `app_settings` automatically resolve to 200 via `_val()` | ✓ |
| Code default + Migration | Update `config.py` / `models/user_settings.py` to 200 and add a migration backfilling `app_settings` rows to 200 | |
| You decide | Whichever keeps deployment simplest | |

**User's choice:** Code default (No migration)
**Notes:** Explicitly re-opens and reverses `D-v4.0-EF-DEFAULT` based on reproducible 100k chunk bench data (0.040 -> 1.000 recall). Keeps migration overhead at zero.

### Latency & Harness Guards
| Option | Description | Selected |
|--------|-------------|----------|
| Dual-measurement in harness | Assert HNSW index scan (`idx_scan > 0`) and record query latency before/after alongside recall without a brittle hard timeout | ✓ |
| Strict latency ceiling | Enforce an explicit hard timeout/ceiling (e.g. p95 query latency must stay under a fixed cap) | |
| You decide | Preserve Phase 241 harness methodology faithfully | |

**User's choice:** Dual-measurement in harness
**Notes:** Guarantees that recall is measured on an index scan rather than a Seq Scan, and records query latency deltas for transparency.

---

## 3. Server GUC Shortcut Fix (`RECALL-02` / `SEED-268`)

| Option | Description | Selected |
|--------|-------------|----------|
| Probe server setting on pool init | Query `current_setting('hnsw.ef_search', true)` so the system knows what Postgres holds, and never rely on a hardcoded 40 constant | ✓ |
| Delete shortcut unconditionally | Always execute `SET LOCAL hnsw.ef_search` for every search with a resolved value | |
| You decide | Implement whichever is cleanest and easiest to verify across non-40 test databases | |

**User's choice:** Probe server setting on pool init
**Notes:** Eliminates the hardcoded `_SERVER_DEFAULT_EF_SEARCH = 40` constant. When a server holds 64 and a user sets 40, `SET LOCAL` is properly issued.
**Review Round 1 Resolutions (Finding 2):**
- (2a) Connection isolation: Probe runs on a fresh connection outside any request transaction. Tested with a driven unit test proving a previous borrower's `SET LOCAL` cannot poison the cached server default.
- (2b) Fallback: If `current_setting` returns NULL (pgvector uninstalled/unknown GUC), server default resolves to `None` and issues nothing.
- (2c) Cache invalidation: Cache has a 60-second TTL rather than lifetime immutability, ensuring `ALTER SYSTEM/DATABASE` takes effect without restarts.
- (Finding 4): Probed server default replaces the `:155` no-op shortcut; `:131` and `:154` invalid fallbacks retain safe no-tuning behavior.
- (Finding 3): Hot-path statement execution of `SET LOCAL` for 200 is explicitly accepted as the mechanism for recall restoration.

---

## 4. Settings UI & Retrieval Card Copy

| Option | Description | Selected |
|--------|-------------|----------|
| Update copy to 'Default is 200' | Align copy and fallback to reflect that 200 is now the active out-of-the-box default while preserving the 1000-worse-than-400 warning | ✓ |
| Keep '200 is a good starting point' copy | Only update the frontend state/fallback from 40 to 200 without changing descriptive text | |
| You decide | Whichever phrasing feels most natural in the Settings page | |

**User's choice:** Update copy to 'Default is 200'
**Notes:** Ensures visual honesty on `SettingsPage.tsx` matching server reality.
**Review Round 1 Resolutions (Finding 1):**
- Pre-fetch loading state: `hnswEfSearch` initialized to `useState<number | null>(null)`. Screen renders a neutral skeleton/placeholder before data resolves, eliminating pre-fetch guesses.
- Dead code removal: Unreachable `??` fallback in `setHnswEfSearch(data.hnsw_ef_search)` removed, preventing frontend default drift.
- (Finding 5): G-2 sketch formally waived in writing.
- (Finding 6): SC#2 verification scoped locally against the test database; production deploy verification remains deferred per `D-242-08`.

---

## Claude's Discretion
None — all options were explicitly chosen.

## Deferred Ideas
None — discussion stayed strictly within phase scope.
