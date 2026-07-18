---
phase: 141-template-input-resolver-run-scope-stretch
reviewed: 2026-07-07T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/app/services/template_asset_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/services/harness/phase_types.py
  - backend/tests/test_141_run_scope.py
  - supabase/migrations/092_workspace_files_run_claim.sql
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 141: Code Review Report

**Reviewed:** 2026-07-07
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 141 (COLL-02) run-scopes the ephemeral `template_input` resolver via a
nullable `run_claim` column, so a template claimed by one run-context cannot be
resolved by a foreign context (workflow→Deep, Deep→workflow, W1→W2), while
same-mode reuse (Deep→Deep, same-workflow-run) is preserved.

The core mechanism is **correct and secure**. I traced every path the phase
intent called out:

- **Claim WHERE predicate** — `(run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)`
  is sound three-valued logic that exactly mirrors the pure `claim_visible`
  helper, and the `$3 IS NULL` legacy arm is a genuine no-op. The foreign probe
  (`run_claim IS NOT NULL AND run_claim <> $3`) and expired probe are correctly
  ordered (eligible → foreign → expired → never) and preserve owner/thread scope.
- **Conditional stamp race-safety** — `UPDATE ... WHERE id = $2 AND run_claim IS NULL`
  plus the lost-race re-SELECT + `claim_visible` recheck correctly falls through
  to the honest error rather than leaking bytes.
- **Foreign-claim error path** — `_foreign_error()` returns `bytes=None`,
  `filename=None`, and names only the condition; the probe SELECTs `id` only and
  never reads it. No id/filename/byte leak.
- **Scope never widened** — `thread_id = $1` + `created_by = $2` are retained on
  every SELECT/UPDATE; the claim column is server-set only (no injection surface).
- **Emit-path `_ProducerStreamCtx` lineage** — on any real run
  (`ctx.run_id` = `workflow_runs.id`, never None) both the step-1 pre-resolve
  (`str(run_id)`) and the step-4 render re-dispatch
  (`own_claim_for_ctx(_ProducerStreamCtx)` → `str(inner.run_id)`) derive the same
  `str(W)`. The `'deep'` sentinel is never produced on the emit path in production.

No BLOCKER-level defect was found: no production leak, no crash, no scope
widening, and no Deep→Deep / same-workflow-run regression. The findings below are
test-reliability gaps and a non-production consistency footgun.

## Warnings

### WR-01: Production leak-prevention path (SQL WHERE + foreign probe) is never exercised by tests

**File:** `backend/tests/test_141_run_scope.py:188-208` (and the untested branch at `backend/app/services/template_asset_service.py:236-260`)

**Issue:** The resolver tests give false confidence about the *production* block
mechanism. In production the claim-aware WHERE excludes a foreign row, so the main
`fetchrow` returns `None`, `file_row` is `None`, the in-code mirror at
`template_asset_service.py:229-234` is **skipped** (guarded by
`file_row is not None`), and the **foreign probe** at lines 242-260 is what
returns `_foreign_error()`.

But `mock_asyncpg_pool` does not evaluate the WHERE — so
`test_resolver_foreign_claim_honest_error` seeds the foreign row as the *first*
`fetchrow` result, `file_row` is non-None, and the **in-code mirror** (a
defense-in-depth backstop) fires *before* the foreign probe is ever reached. The
production code path (WHERE → main SELECT None → foreign probe →
`_foreign_error`) is therefore **not covered by any test**. A regression in the
foreign-probe SQL (e.g. `<>` flipped to `=`, a dropped expiry gate, a widened
scope) would ship green. The same gap applies to the expired-probe branch
(lines 265-283), which no test reaches via a None-first `fetchrow`.

**Fix:** Add a test that drives the foreign probe directly — first `fetchrow`
returns `None` (the WHERE excluded the foreign row), second `fetchrow` returns a
foreign `id` row:
```python
async def test_resolver_foreign_probe_when_where_excludes(mock_asyncpg_pool):
    mock_asyncpg_pool.set_fetchrow_results([
        None,                       # main SELECT: claim WHERE excluded the foreign row
        {"id": _FILE_ID},           # foreign probe: a foreign non-expired row exists
    ])
    result = await resolve_template_source(
        pool=mock_asyncpg_pool, supabase=MagicMock(),
        thread_id=_THREAD, user_id=_USER, own_claim=DEEP_CLAIM,
    )
    assert result["bytes"] is None and result["error"]
    # assert the foreign-probe SQL was the one that ran (run_claim <> $3)
    probes = [c for c in mock_asyncpg_pool.calls if "run_claim <> $3" in c[0]]
    assert probes, "the production foreign-probe branch must be exercised"
```
Add a companion expired-probe test (`[None, None, {"id":..,"path":..}]`) to cover
lines 265-283.

### WR-02: `test_both_branch2_resolve_sites_pass_own_claim` matches comments, not executable code (false-green risk)

**File:** `backend/tests/test_141_run_scope.py:310-318`

**Issue:** This guard reads the raw source of `tool_dispatcher.py` /
`phase_types.py` and asserts `"own_claim_for_ctx" in td` and `"own_claim" in pt`
**without stripping comments** — unlike its sibling
`test_where_preserves_user_and_thread_scope` (line 304), which correctly strips
`#` lines first. Both target files mention `own_claim` extensively in comments
(e.g. `phase_types.py:1112-1118`, and the import + comment in
`tool_dispatcher.py:1964,2051-2055`). If a future edit deleted the actual
`own_claim = own_claim_for_ctx(ctx)` call / the `own_claim=own_claim` kwarg but
left the import or a comment, this "both-sites-wired" landmine guard would still
pass — defeating the Landmine-1 protection it exists to provide.

**Fix:** Strip comment lines before matching (mirror line 304), and assert the
call/kwarg shape rather than a bare token:
```python
td_code = "\n".join(l for l in td.splitlines() if not l.lstrip().startswith("#"))
pt_code = "\n".join(l for l in pt.splitlines() if not l.lstrip().startswith("#"))
assert "own_claim_for_ctx(ctx)" in td_code
assert "own_claim=own_claim" in td_code
assert "own_claim=own_claim" in pt_code
```

### WR-03: Emit-path step-1 vs step-4 own-claim derivation diverges on the `run_id is None` edge

**File:** `backend/app/services/harness/phase_types.py:1119` (vs the re-dispatch at `:1414-1417` + `_ProducerStreamCtx.__init__:1052`)

**Issue:** The GAP-B pre-resolve derives the claim as
`own_claim = str(run_id) if run_id is not None else None`, but the step-4 render
re-dispatch derives it via `own_claim_for_ctx(_ProducerStreamCtx(ctx, ...))`,
whose `workflow_run_id = getattr(inner, "run_id", None)` → `own_claim_for_ctx`
returns the `'deep'` **sentinel** (not `None`) when `run_id` is `None`. So on a
ctx with `run_id is None`:

- **step 1** resolves Branch 2 with `own_claim=None` → the legacy no-op: **no
  claim filter, no stamp** — it will happily read a *foreign*-claimed row's bytes
  into `src`, whose docx placeholder **names are parsed and injected into the
  model prompt** (`_template_oracle(src)` → user turn at `:1156,1171`);
- **step 4** resolves with `own_claim='deep'` → the row is filtered/blocked.

This cannot occur on a real workflow run (`ctx.run_id` is always
`workflow_runs.id`), so it is **not a production leak** and the delivered-bytes
path (step 4) correctly blocks. But it is a genuine inconsistency and a latent
footgun: the two sites are documented as deriving the *same* claim (`:1117-1118`),
and any future emit-ctx build site that omits `run_id` would silently take the
unfiltered step-1 branch.

**Fix:** Derive both sites from one source. Simplest: make step 1 use the same
sentinel fallback as `own_claim_for_ctx` so the two paths cannot diverge —
```python
# step 1 — match _ProducerStreamCtx/own_claim_for_ctx exactly (never None on this path)
own_claim = str(run_id) if run_id is not None else DEEP_CLAIM
```
or wrap the bag in `_ProducerStreamCtx` and call `own_claim_for_ctx` in both
places. (If `None` on this path is truly intended for minimal ctx, add an assert
that `run_id is not None` on a real emit so the divergence can never be reached
by accident.)

## Info

### IN-01: Command-tag parse for the losing-race check is brittle string-slicing

**File:** `backend/app/services/template_asset_service.py:305`

**Issue:** `status.strip().upper().endswith(" 0")` detects a 0-row `UPDATE` by
suffix matching. It is *correct* for this single-row (`WHERE id = $2`) UPDATE —
the count is only ever `0` or `1`, and the leading space guards against
`"UPDATE 10"`/`"UPDATE 20"` false positives — but the intent ("0 rows affected")
is obscured and would silently misbehave if the query ever became multi-row.

**Fix:** Parse the count explicitly:
```python
affected = int(status.rsplit(" ", 1)[-1]) if isinstance(status, str) and status.rsplit(" ",1)[-1].isdigit() else -1
if affected == 0:
    ...
```

### IN-02: A failed emit phase still permanently claims the user's ephemeral upload

**File:** `backend/app/services/harness/phase_types.py:1120-1127` + `backend/app/services/template_asset_service.py:296-301`

**Issue:** The emit executor's step-1 pre-resolve (used only for the
`no_template_bound` gate + the placeholder oracle) **stamps** the unclaimed
ephemeral row with `str(W)` on first resolve — even when the phase subsequently
fails at states (a)–(e) (model failed to emit, citation-gate reject, etc.). Once
stamped, a later Deep turn on the same thread is blocked with "belongs to a
different run — upload it again", so a *failed* workflow render burns the
template's Deep-reusability and forces a re-upload. This is consistent with the
documented "claim on first resolve" design (SC#1 cross-context block is the whole
point), so it is not a defect — flagging only to confirm the UX is intended
(claiming on a *doomed* emit, not only on a delivered one).

**Fix:** None required if intended. If not: defer the stamp until an actual
successful render (stamp inside `_handle_render_template` on the delivered path
rather than on the pre-resolve), accepting that the pre-resolve then reads
unclaimed bytes without claiming.

---

_Reviewed: 2026-07-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
