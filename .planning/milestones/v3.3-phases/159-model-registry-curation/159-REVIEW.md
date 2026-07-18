---
phase: 159-model-registry-curation
reviewed: 2026-07-18T03:09:14Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - backend/app/api/admin.py
  - backend/app/services/model_discovery_service.py
  - backend/app/models/user_settings.py
  - backend/app/api/settings.py
  - backend/app/main.py
  - scripts/curate_models.py
  - supabase/migrations/103_model_discovery_filter.sql
  - frontend/src/lib/api.ts
  - frontend/src/lib/model-defaults.ts
  - frontend/src/components/admin/ModelRegistryTab.tsx
  - frontend/src/components/admin/ModelDiscoveryPanel.tsx
  - frontend/src/components/admin/ControlRoomPage.tsx
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: clean
---

# Phase 159: Code Review Report

**Reviewed:** 2026-07-18T03:09:14Z
**Depth:** deep (cross-file: import graph, call chains, API-boundary type consistency, error propagation)
**Files Reviewed:** 12 source files (backend + frontend + migration)
**Status:** clean — **no Critical/BLOCKER findings survive scrutiny.** 2 warnings + 5 info remain (see below).

## Summary

Phase 159 adds operator model-registry curation: a `POST /admin/models` add-by-ID write, a
shared `UTILITY_MODEL_EXCLUDE` utility-model classifier, a display-only discovery suitability
filter persisted as an `app_settings` flag, and a family-default capability pre-fill table.

I traced every item on the priority list to ground truth. **All eight security-critical
invariants hold:**

1. **SQL injection on `POST /admin/models` — SAFE.** The upsert builds `insert_cols` /
   `set_clause` from the code constant `_ADD_MODEL_CAP_COLUMNS` plus the three fixed columns
   (`model_id`, `provider`, `enabled`); every value is an asyncpg `$N` bind via
   `pool.execute(sql, *values)`. No client value or identifier is ever interpolated into SQL —
   byte-identical to the `set_model_capability` pattern. `test_159_add_model.py` asserts
   `"kimi-k3" not in sql and "moonshot" not in sql` and `"EXCLUDED" in sql`.
2. **Auth/operator gating — SAFE.** `add_model_by_id` is `@router.post("/models")` on the router
   declared with `dependencies=[Depends(require_operator)]` (admin.py:137). `require_operator`
   404s non-operators (byte-identical, no RLS backstop). The audit floor is per-endpoint. No
   un-gated write hole.
3. **Input validation before any DB touch — PRESENT.** Blank/whitespace id → 422; provider not in
   `PROVIDER_ENDPOINTS` → 422; wrong-typed int/bool cap → 422; case-folded duplicate (built-in OR
   override) → 409. All execute before the upsert. The 8-provider `PROVIDER_ENDPOINTS` allowlist
   exactly matches the frontend `ADD_PROVIDER_ROSTER`.
4. **Added models land DISABLED, never auto-enabled — HOLDS.** `enabled` is a forced literal
   `False` appended to `values`; `AddModelRequest` has no `enabled` field and Pydantic's default
   `extra="ignore"` drops any injected `enabled`. Tests confirm `True not in args`.
5. **Discovery filter is DISPLAY-ONLY (SC#3) — HOLDS.** `buildChanges()` iterates the full
   `result.new` (ModelDiscoveryPanel.tsx:200), never `visibleNew`; the filter only affects the
   render `.map`. Hidden utility models stay in `accepted` and land `enabled:false` (`enableNow`
   starts empty). Server-is-source-of-truth re-fetch (`fetchRegistry`/`fetchSettings`), no
   optimistic mutation.
6. **ReDoS on `UTILITY_MODEL_EXCLUDE` — SAFE.** Plain bounded literal alternation with
   `re.IGNORECASE`, single linear `search()` scan — no nested quantifiers, no backreferences.
7. **204 flag write — SAFE.** `setFlag` checks `!res.ok` and returns `void`; it never calls
   `res.json()`, so the `PUT /admin/flags` 204 (no body) is never parsed.
8. **Fail-soft readback — SAFE.** `_val_bool(row, "model_discovery_filter_enabled", None, True)`
   uses `row.get()` (never raises on an absent column) and returns the `True` default — filter
   defaults ON, never silently OFF.

The `curate_models.py` DRY refactor preserves the exact pre-159 exclude behavior (plus a
documented, harmless `rerank` addition). `familyDefaults()` returns fresh objects (no shared-ref
mutation), `native_tools` pre-fill can only ever yield `"native"`/null (never `"none"`/false), so
a pre-fill can never silently disable tools. Frontend rendering is fully React-escaped (no XSS,
no `dangerouslySetInnerHTML`), and add-form server refusals surface in-form.

The two warnings below are robustness/data-integrity gaps, not security holes; per the phase's
status rule (clean unless a High/Critical survives) status is **clean**, but both warrant a fix.

## Warnings

### WR-01: Add-by-ID `ON CONFLICT DO UPDATE` fails UNSAFE — a raced duplicate silently overwrites + disables the existing row

**File:** `backend/app/api/admin.py:1225-1240` (the `add_model_by_id` upsert)

**Issue:** The add endpoint's case-folded duplicate guard reads
`load_all_model_overrides()`, which is a **30s-TTL, per-worker cache** that is only invalidated on
the *local* worker. With the documented default `WORKER_COUNT=2` and round-robin request routing,
a second worker's cache can be stale for up to 30s. When a duplicate slips past that best-effort
guard, the upsert does **not** fail — it runs
`INSERT ... ON CONFLICT (model_id) DO UPDATE SET ..., enabled = EXCLUDED.enabled` with
`EXCLUDED.enabled = False`, so it **overwrites the existing row's capabilities and forces it
`enabled=false`.** This directly contradicts the endpoint's own docstring ("never clobber an
existing row").

Concrete trigger (all operator-only): add "foo" (t=0, lands disabled) → enable "foo" via the
registry table (t=3s) → re-add "foo" — a double-submit or a caps typo-fix (t=8s) routed to a
worker whose all-overrides cache predates t=0. The guard misses, and the raced add **silently
disables the now-live "foo" and wipes its caps.** The more common variant (double-submitting a
brand-new add) is benign (both land disabled, last-write-wins caps) but still returns `200 {ok}`
instead of the intended 409, masking the duplicate.

The failure direction is safe for the auto-enable invariant (it only ever writes `enabled=false`),
which is why this is a WARNING and not a BLOCKER — but it is a genuine data-integrity / model-
availability gap that meets the "data-loss risk" bar; escalate if you weight the 2-worker default +
operator double-submit as a routine trigger.

**Fix:** Make a conflict fail SAFE for an *add* (an add is not an edit — that's what the PATCH seam
is for). Either drop the upsert clause so a duplicate raises, and map the unique violation to a
409:

```python
import asyncpg
...
sql = (
    f"INSERT INTO model_capabilities_overrides ({', '.join(insert_cols)}) "
    f"VALUES ({placeholders})"          # no ON CONFLICT — an add must not overwrite
)
try:
    await pool.execute(sql, *values)
    write_ok = True
except asyncpg.UniqueViolationError:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="That model is already in the registry — edit it in the table instead.",
    )
except Exception:
    logger.exception("add_model_by_id: upsert failed for %s", model_id)
```

This turns the cross-worker race into a truthful 409 (never a clobber, never a silent disable).

### WR-02: Discovery-filter toggle is a floating promise with no error surface — a failed persist silently reverts with no operator feedback

**File:** `frontend/src/components/admin/ModelDiscoveryPanel.tsx:349` (the checkbox `onChange`) and `frontend/src/components/admin/ControlRoomPage.tsx:558-565` (`handleSetDiscoveryFilter`)

**Issue:** The filter checkbox fires `onChange={() => void onSetFilter(!filterEnabled)}`, and
`handleSetDiscoveryFilter` is `async (enabled) => { await setFlag(...); if (alive.current) void
fetchSettings() }` with **no try/catch and no error surface anywhere.** If `setFlag` rejects, the
rejection is unhandled (console-only) and — because the checkbox is controlled by the (unchanged)
`filterEnabled` prop — it silently snaps back to its prior state with **zero feedback** to the
operator.

This has a concrete real-world trigger: the flag write half shipped ahead of migration 103, and
the migration is still pending in cloud (see IN-05). Until it is applied, `save_app_settings`
returns `False` for the missing column and `set_flag` returns a real **500** — which this path
swallows. It is also inconsistent with the sibling write paths in the same phase (`handleAddModel`
/ `handleSetCapability` propagate `ApiError` so the form can show the refusal), and with the
phase's own stated "never a silent failure" principle.

**Fix:** Surface the failure. Add a filter-error state to the panel and catch the rejection:

```tsx
// ControlRoomPage.tsx — let it throw to the panel (mirror handleAddModel), or:
const handleSetDiscoveryFilter = useCallback(async (enabled: boolean) => {
  try {
    await setFlag("model_discovery_filter_enabled", enabled)
    if (alive.current) void fetchSettings()
  } catch (err) {
    if (alive.current) setFilterError(err instanceof ApiError ? err.message : "Couldn’t save the filter default.")
  }
}, [fetchSettings])
```

Render `filterError` inline beside the checkbox (with `role="alert"`), matching the add form.

## Info

### IN-01: Failed operator writes leave no audit-log row — the `*.add_failed` / `*.write_failed` stamps are dead

**File:** `backend/app/api/admin.py:1229-1244` (add), and the mirrored `set_model_capability` / `set_flag` paths

**Issue:** On the 500 path the handler sets `request.state.audit_action = "model.add_failed"` then
raises `HTTPException`. FastAPI throws that exception into `operator_audit_floor` at its bare
`yield` (dependencies.py:281), so the post-yield audit write never runs — **no ledger row is
written for a failed add.** The `add_model_by_id` docstring overstates this ("On a persistence
failure: a `model.add_failed` stamp + a real 500"); the code comment correctly calls it
"belt-and-braces." This is a faithful mirror of the accepted `set_flag`/`set_model_capability`
pattern (not a 159 regression), but it is a real observability gap: an operator write that fails to
persist produces no audit trail. **Fix:** if a truthful failure row is wanted, wrap the floor's
`yield` in `try/except` and record on exception; otherwise soften the docstring to match reality.

### IN-02: Confirming a discovery run with the filter ON also creates disabled override rows for every hidden utility model

**File:** `frontend/src/components/admin/ModelDiscoveryPanel.tsx:146-155, 196-217`

**Issue:** `run()` seeds `accepted` with **all** new models (including utility ones), and
`buildChanges()` iterates the full `result.new`. So a single "Confirm" click after a run writes
`enabled=false` override rows for the N hidden utility models too — potentially hundreds of
embedding/audio/image rows that then populate the registry table (which shows disabled overrides).
This is **SC#3-compliant** (hidden models "remain in the confirmable payload" and land disabled, no
security/enable impact) and the hidden count is disclosed with a "Show all" affordance — so this is
working as specified, not a defect. Flagged only to confirm intent: the filter declutters the
discovery panel but the confirmed rows re-clutter the registry table. If the intent is
"confirmable only once revealed," `run()` should not pre-accept utility-tagged models.

### IN-03: A few utility-regex tokens hide genuinely chat-capable model ids by default

**File:** `backend/app/services/model_discovery_service.py:117-120`

**Issue:** `search-preview` (→ `gpt-4o-search-preview`), `computer-use` (→ Claude computer-use
models), and `realtime` (→ `gpt-4o-realtime-preview`) match ids that are chat/tool-capable, so they
are hidden by default. Because the filter is display-only and reversible via "Show all" (and never
gates confirmation), this is not a correctness bug — but verify the default-hide list matches
intent, since these are not pure embeddings/audio "noise." No fix required if deliberate.

### IN-04: `parseInt` in the number inputs silently truncates scientific-notation / trailing-garbage values

**File:** `frontend/src/components/admin/ModelRegistryTab.tsx:900-903` (`numOrUndef`) and `frontend/src/components/admin/ModelDiscoveryPanel.tsx:186-194` (`coerce`)

**Issue:** `<input type="number">` can legitimately hold `"1e5"`, and `parseInt("1e5", 10)` is `1`
(not `100000`); `parseInt("128k")` is `128`. So an exotic entry is silently truncated rather than
rejected. Impact is very low (operator-visible field, backend-validated int), and `parseInt` was
correctly chosen over `Number()` to keep `""` → omit. Consider `Number.isInteger(Number(s))`
normalization if you want to reject non-integer text outright. Not blocking.

### IN-05: The filter WRITE is not fail-soft against a missing column — pending migration 103 in cloud makes the toggle 500

**File:** `supabase/migrations/103_model_discovery_filter.sql`, `backend/app/api/admin.py:546-554`

**Issue:** The readback is fail-soft (defaults ON), but the write path
(`set_flag` → `save_app_settings`) targets the real `model_discovery_filter_enabled` column; until
migration 103 is applied it returns a real 500 ("Could not persist the flag"). This is the correct
honest-failure behavior and is tracked by the standing cloud-migration checklist (migs 099–103
pending per project memory) — but combined with WR-02 the 500 is currently invisible to the
operator. **Action:** apply migration 103 to cloud in the same promotion that ships this phase, and
fix WR-02 so a pre-migration toggle reports the failure instead of silently reverting.

---

_Reviewed: 2026-07-18T03:09:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
