---
type: measurement-pack
phase: 231
phase_name: "The Connection-Scoped Visibility Predicate"
builder: claude
reviewer: gemini
captured_by: gemini
captured_at: 2026-09-05
tree_state: UNTOUCHED — clean working tree at `d852cbc79`, captured before any Phase 231 work began
---

# Phase 231 — Measurement Pack

**What this is.** `AGENTS.md` §3.1 and §6.1 make the reviewer supply gate baselines and CLAUDE.md's three mandatory discuss-phase cross-checks — reported bugs, the seeds sweep, and the G-5 hot-file scan — as **measurements, on the bus, before `discuss-phase` opens**.

Phase 231 is Claude-built under the reciprocal review protocol (`BUS-119`); Claude owns building and `discuss-phase`. Gemini acts as reviewer and captures baselines on the untouched tree before any build action begins.

⚠ **There are no recommendations in this file.** Every line below is a measured fact with the command that produced it.

⚠ **Captured on the UNTOUCHED tree.** `git status --short` was empty; HEAD was `d852cbc79 fix(230): resolve SC#1 drive defects — jsonb progress scalar and document failure sync` on `develop`.

---

## 1 · Gate Baselines

| Gate | Command | Baseline |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` (from `frontend/`) | **66 errors** (exact baseline) |
| Frontend count gate | `$env:GSD_VITEST_MAX_WORKERS="2"; node scripts/vitest-count-gate.cjs` | **total 7435 · failed 2 · pinned total 6702** (the 2 failures are the inherited `IngestionStrip` fence, `BUS-114`) |
| Backend unit suite | `node scripts/check-backend-unit-baseline.cjs` | **72 failed · 3530 passed · 0 errors** (the 72nd is the GC/order flake documented on `BUS-117`) |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | **107,501 chars · 71.7% of limit · OK** (headroom 42,499) |
| Live schema migration | `supabase/migrations/` | **Migration 153** (`153_ingestion_jobs.sql`), 0 drift |

### 1.1 `tsc` Baseline Note
`npx tsc --noEmit -p tsconfig.app.json` yields exactly **66 errors** across the untouched tree. Any new error in a touched file is a regression.

### 1.2 Count Gate Baseline Note
Running with `--maxWorkers=2` yields **7435 total tests**, with **failed: 2**:
1. `src/components/ingestion/__tests__/IngestionStrip.test.tsx` :: `non-vacuity 3/3 — EXACTLY six distinct ingestion_step writes were extracted`
2. `src/components/ingestion/__tests__/IngestionStrip.test.tsx` :: `⭐ the six stages are in the backend's WRITE ORDER — an ORDERED comparison, never sorted`

Both failures are pre-existing and tracked under `BUS-114`.

### 1.3 Backend Unit Test Baseline Note
`check-backend-unit-baseline.cjs` measures **72 failed / 3530 passed / 0 errors**.
All 72 failures match the known rot set plus the `test_cross_worker_cancellation` GC unraisable exception flake tracked under `BUS-117`.

---

## 2 · G-5 Hot-File Scan (Blast Radius Triples)

Triples re-derived using the mandatory recipe:
`commits` (`git log --oneline -- <file> | wc -l`),
`phases` (distinct numeric buckets, excluding 6-digit dated quick tasks),
`lines` (`wc -l <file>`).

| File | commits / phases / lines | G-5 Status | Ledger Note |
|---|---|---|---|
| `backend/app/services/retrieval_service.py` | **17 / 9 / 362** | ⚠ **FIRES** | Absent from ledger its entire life. Owed a row in Phase 231's commit. |
| `backend/app/api/documents.py` | **76 / 32 / 2469** | ⚠ **FIRES** | Ledger says 75/32/2408 (discharged Phase 229). Commits +1, lines +61 since last sweep. |
| `backend/app/api/folders.py` | **11 / 7 / 233** | ⚠ **FIRES** | At 7 phases; fires G-5 if modified. |

---

## 3 · Live DB Measurement: The Four Visibility Sites

Queried directly against live Postgres (`:54322`) via `pg_policies` and `pg_get_functiondef`:

### Site 1: `documents` SELECT Policy
- **Policy**: `Users can view own or global-folder documents`
- **Cmd**: `SELECT`
- **Qual**:
  ```sql
  ((org_id IN ( SELECT current_user_org_ids() AS current_user_org_ids))
   AND ((auth.uid() = user_id)
        OR ((folder_id IS NOT NULL) AND folder_is_org_shared(folder_id))))
  ```

### Site 2: `document_chunks` SELECT Policy
- **Policy**: `Users can view their own chunks`
- **Cmd**: `SELECT`
- **Qual**:
  ```sql
  ((org_id IN ( SELECT current_user_org_ids() AS current_user_org_ids))
   AND ((auth.uid() = user_id)
        OR (EXISTS ( SELECT 1
                     FROM documents d
                     WHERE ((d.id = document_chunks.document_id)
                            AND (d.folder_id IS NOT NULL)
                            AND folder_is_org_shared(d.folder_id))))))
  ```

### Site 3: `match_document_chunks` Function
- **Security**: `SECURITY DEFINER = true`, `STABLE`
- **Where Clause**:
  ```sql
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())
    AND (
          dc.user_id = auth.uid()
       OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
    )
    AND d.is_latest = true
  ```

### Site 4: `keyword_search_chunks` Function
- **Security**: `SECURITY DEFINER = true`, `STABLE`
- **Where Clause**:
  ```sql
  WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())
    AND (
          dc.user_id = auth.uid()
       OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
    )
    AND d.is_latest = true
  ```

**Finding Confirmed**: All 4 sites share the identical org scope and two-arm disjunction (`owner OR shared folder`). Both search functions enforce `d.is_latest = true`.

---

## 4 · Seeds and Reported Bugs Cross-Check

### Reported Bugs
- Zero open bugs in `.planning/reported-bugs/` currently target Phase 231 or the visibility predicate.
- `BUG-260823-03` carries `status: deferred` with `re_open_trigger: "Trigger: Evaluated during canvas graph node interactions in Phase 231"`.

### Seeds Register
- `SEED-210`: *Inbound permission and lifecycle envelope* (source ACLs are first-class, not folder surrogates).
- `SEED-211`: *Permissions derived from metadata — the M-Files fork* (permissions derived from metadata, recorded with a migration path).
- `SEED-247`: *Thread-scoped attachments vs library documents* (retrieval gains a scope term; directly flags Phase 231 as the sequencing point for RLS predicate expansion).
