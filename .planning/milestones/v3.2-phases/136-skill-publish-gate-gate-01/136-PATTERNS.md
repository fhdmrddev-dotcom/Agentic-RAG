# Phase 136: Skill Publish Gate (GATE-01) - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 11 (5 new, 6 modified)
**Analogs found:** 11 / 11

> This phase is a **read-model authorization gate** over the already-shipped eval substrate
> (migrations 079-083). There is no new domain and no new library — every file below has a
> strong in-repo analog, most of them in the sibling eval router / eval surface shipped by
> Phases 132-135. Copy those patterns; do not invent.

## File Classification

| New/Modified File | New? | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|------|-----------|----------------|---------------|
| `backend/app/api/skills.py` | mod | route/controller | request-response | `backend/app/api/evals.py` (`force_promote_skill_proposal` :1825, `get_eval_run` :379) + own `toggle_global` :406 / `create_skill` :155 | exact (self + sibling) |
| `backend/app/services/publish_gate_service.py` | NEW | service | transform / read-model | `backend/app/api/evals.py` `_compute_gate`/`promotion_gate` :1059-1144; `backend/app/services/classification_rule_service.py` | role+flow match |
| `backend/app/models/skill.py` | mod | model | request-response | own `SkillCreate`/`SkillResponse` + `PromotionGate` shape (`eval_run.py`) | exact |
| `supabase/migrations/084_skill_publish_overrides.sql` | NEW | migration | CRUD (append-only) | `supabase/migrations/083_skill_proposals.sql` + `081` eval_ratings block | exact |
| `backend/tests/test_publish_gate.py` | NEW | test | request-response | `backend/tests/test_skill_proposals_router.py` + `test_evals_router.py` (`_FilterSupabase`) | exact |
| `frontend/src/components/skills/PublishGateDialog.tsx` | NEW | component | request-response | `frontend/src/components/ui/alert-dialog.tsx` (primitive) + `SkillEvalSection.tsx` (refetch-not-optimistic) | role match |
| `frontend/src/components/skills/SkillCard.tsx` | mod | component | event-driven | own inline `confirmingDelete` block + `handleToggleGlobal` :58 | exact (self) |
| `frontend/src/components/skills/SkillEvalSection.tsx` | mod | component | request-response | own verdict-line :566 + `renderGateCounts` :96 | exact (self) |
| `frontend/src/lib/api.ts` | mod | utility (API client) | request-response | own `toggleSkillGlobal` :1569 / `createSkill` :1528 / `proposalError` :1739 / `forcePromoteProposal` :1839 | exact (self) |
| `frontend/src/types/index.ts` | mod | model (TS types) | request-response | own `EvalRun` :583 / `PromotionGate` :655 | exact (self) |
| `frontend/src/components/skills/PublishGateDialog.test.tsx` | NEW | test | request-response | `frontend/src/components/skills/SkillFormDialog.test.tsx` / `relationships/CreateLinkDialog.test.tsx` | role match |

---

## Pattern Assignments

### `backend/app/services/publish_gate_service.py` (NEW — service, the ONE gate helper)

This is the load-bearing new file: `compute_publish_gate(supabase, skill_id, user_id)` — a pure
READ over `eval_runs ⋈ skill_versions ⋈ skills` returning `{met, measured, passed, passing_run_id,
state, reason}`. Two analogs combine.

**Analog A — the D-03 authoritative rollup rule** (`backend/app/services/eval_runner_service.py:687-690`) — copy the boolean verbatim; the gate must recompute from the NUMERIC columns, never trust `verdict_summary` text:
```python
if final_status == "completed":
    measured_count = sum(1 for _v, st, _p in with_outcomes if st == "graded")
    passed_count = sum(1 for _v, _st, p in with_outcomes if p is True)
    verdict_summary = "pass" if (measured_count >= 1 and passed_count == measured_count) else "fail"
```
The gate's per-run predicate is exactly `measured_count is not None and measured_count >= 1 and passed_count == measured_count` (D-03).

**Analog B — owner-scoped read + `run_in_threadpool` wrap** (`backend/app/api/evals.py` `_verify_owned_skill` :106-135 and `_read_arm_results` :1096-1108). The whole eval domain wraps every blocking supabase-py call — the new gate code MUST too (project rule D-v2.5-01; NOTE the existing `skills.py` handlers do NOT wrap — see Shared Patterns "run_in_threadpool gap"):
```python
def _read():
    return (
        supabase.table("skills")
        .select("id, name, description, user_id")
        .eq("id", skill_id)
        .eq("user_id", user_id)   # the REAL gate (service-role client bypasses RLS)
        .limit(1)
        .execute()
    )
resp = await run_in_threadpool(_read)
```

**Core pattern — D-04 content-equality (RESEARCH Pattern 1, the headline trap).** Read completed runs FK-embedding the version instructions, then compare TEXT not version-id:
```python
def _read_passing_runs():
    return (
        supabase.table("eval_runs")
        .select("id, status, passed_count, measured_count, skill_versions(instructions)")
        .eq("skill_id", skill_id)
        .eq("user_id", user_id)
        .eq("status", "completed")   # interrupted/cancelled → NULL rollup → excluded (D-03)
        .execute()
    )
runs = (await run_in_threadpool(_read_passing_runs)).data or []
current_instr = skill_row["instructions"]
def _satisfies(r: dict) -> bool:
    mc, pc = r.get("measured_count"), r.get("passed_count")
    ver = r.get("skill_versions") or {}
    return (mc is not None and mc >= 1 and pc == mc
            and ver.get("instructions") == current_instr)   # D-04 content-eq beats the 135 near-dup trap
```
`_compute_gate` (`evals.py:1111-1144`) is the exact "recompute-on-read, return None when nothing honest to show, all-blocking-threadpool-wrapped" shape to mirror for the helper's contract.

---

### `backend/app/api/skills.py` (MODIFY — route/controller, request-response)

Three edits. All three have a precise analog.

**Edit 1 — gate the `toggle_global` mutation** (wrap the existing endpoint at `skills.py:406-439`). Keep the existing owner-only 403 block VERBATIM (`skills.py:414-426`), then slot the gate in before the UPDATE. Structured-refusal shape copies the 135 force-promote 409 idiom (`evals.py:1865-1869`):
```python
# existing owner-verify block (skills.py:414-426) stays — keep the 403, endpoint-local convention
new_value = not skill_row["is_global"]
if new_value is True:                          # private -> global ONLY (D-07); unshare never gated
    gate = await compute_publish_gate(supabase, skill_id, current_user["id"])
    if not gate["met"] and not (body and body.override):
        raise HTTPException(status_code=409, detail={"error": "publish_gate_unmet", "gate": gate})
    # met OR explicit override → proceed; on override INSERT the audit row (Edit 2 of migration)
# new_value is False → straight UPDATE, no gate
```
The force-promote handler (`evals.py:1825-1908`) is the full override-and-record template: owner-verify → 409 unless overridable → apply write → record the override with a gate snapshot attached "at the moment of override" (D-01/D-02). Copy its structure for the override INSERT.

**Edit 2 — close the born-global side door in `create_skill`** (`skills.py:174-184`). The ONLY line to change is `:181` `"is_global": body.is_global,` → hard-set false. Precedent is verbatim `classification_rule_service.py:79`:
```python
.insert({
    "user_id": current_user["id"],
    "name": body.name.strip(),
    "description": body.description,
    "instructions": body.instructions,
    "is_global": False,   # HARD-SET — never from the caller (D-08 / T-118-02-01)
})
```
Import (`skills.py:251` already hard-codes `False`) and the agent `save_skill` tool are already safe — D-08 says verify with tests, don't change.

**Edit 3 — add `GET /skills/{id}/publish-gate`** for the dialog to render status before commit (Claude's discretion; RESEARCH recommends shipping it). Mirror the durable-readout route `get_eval_run` (`evals.py:379-422`): path skill_id + owner-scoped read, 404 on cross-user, returns the `compute_publish_gate` result.

---

### `backend/app/models/skill.py` (MODIFY — Pydantic models)

Add `PublishGate` (response) + `TogglePublishBody` (request `{override: bool = False}`) next to the existing `SkillCreate`/`SkillResponse` (flat `BaseModel`, house style). The `PromotionGate` model referenced by `evals.py` and mirrored in `types/index.ts:655` is the shape template — a flat model of honest counts + a verdict bool. Keep `SkillCreate.is_global` in the model (D-08 ignores it server-side; removing the field is not required and the frontend never sends it).

---

### `supabase/migrations/084_skill_publish_overrides.sql` (NEW — append-only audit table)

**Analog:** `supabase/migrations/083_skill_proposals.sql` (whole file) + the `eval_ratings` block in `081` (:81-122). Copy exactly: owner-scoped FKs, owner-only SELECT RLS, **NO INSERT/UPDATE/DELETE policies** (service-role toggle handler writes, bypassing RLS — the app-code `.eq("user_id")` is the real gate). The `083` header comment block is the migration-discipline boilerplate to reuse (SQL-editor/psycopg2 apply, regen full-schema, no `db push`/`db reset`).

RESEARCH recommends this exact shape (append-only over columns-on-skills, because D-09 gates every re-share so overrides repeat and need honest history):
```sql
CREATE TABLE public.skill_publish_overrides (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id         uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    skill_version_id uuid REFERENCES public.skill_versions(id) ON DELETE SET NULL,
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gate_state       text NOT NULL,                         -- 'never_evaled'|'latest_failed'|'passed_on_older_version'
    gate_snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {measured_count, passed_count, reason}
    created_at       timestamptz NOT NULL DEFAULT now()     -- the "when" (D-01)
);
```
The `083` RLS tail is the copy-target:
```sql
ALTER TABLE public.skill_publish_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own publish overrides"
  ON public.skill_publish_overrides FOR SELECT USING (auth.uid() = user_id);
-- NO INSERT/UPDATE/DELETE policies (035/079/080/081/083 precedent).
```
Next number confirmed = **084** (`082_threads_is_eval_flag.sql` and `083_skill_proposals.sql` are the current tail).

---

### `backend/tests/test_publish_gate.py` (NEW — router/service tests)

**Analog:** `backend/tests/test_skill_proposals_router.py` (whole structure) which reuses `_FilterSupabase` / `_override` / `_clear_overrides` / seed helpers from `backend/tests/test_evals_router.py:163-200`. Copy the scaffolding verbatim — an in-memory `_FilterSupabase` store honoring `.eq()`/`.in_()` chains, dependency-overridden `get_current_user`/`get_supabase`, `httpx.AsyncClient(transport=ASGITransport(app=app))`, OWNER vs OTHER_USER constants.

Seed shape to reuse (`test_skill_proposals_router.py:_seed` :45-118): a `skills` row + a `skill_versions` row (with `instructions`) + a completed `eval_runs` row (with `passed_count`/`measured_count`/`skill_version_id`) — exactly the store `compute_publish_gate` reads. For the D-04 near-dup test, seed two `skill_versions` with identical `instructions` but different ids and point the passing run at the older one (proves content-equality beats id-equality).

Test method skeleton (`test_propose_owner_can_draft` :133-168 is the copy-target):
```python
@pytest.mark.asyncio
async def test_toggle_global_blocked_when_no_passing_eval():
    from app.main import app
    store, ids = _seed(...)          # no passing run
    sb = _FilterSupabase(store)
    _override(app, user=OWNER, supabase=sb)
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.patch(f"/skills/{ids.skill_id}/toggle-global", json={}, headers=_H)
    finally:
        _clear_overrides(app)
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "publish_gate_unmet"
```
Cover the RESEARCH Test Map rows: blocked-no-eval, create hard-set, import/save_skill stay private, allowed-after-pass, edit-resets, promoted-near-dup-counts, force-records-override, unshare-never-gated/reshare-regated, interrupted-never-satisfies.

---

### `frontend/src/components/skills/PublishGateDialog.tsx` (NEW — thin confirm dialog)

**Analog:** `frontend/src/components/ui/alert-dialog.tsx` (the Radix primitive — `AlertDialog` / `AlertDialogContent` / `AlertDialogHeader` / `AlertDialogTitle` / `AlertDialogDescription` / `AlertDialogFooter` / `AlertDialogAction` / `AlertDialogCancel`, all already exported :130-142) + `SkillEvalSection.tsx` for the render-server-status / refetch-not-optimistic idiom. Keep it PLAIN (137 fence) — no new design-system chrome.

Behavior contract (D-05): open on private→global click, fetch `getPublishGate`, render gate MET (satisfied "Eval passed X/N on current version" + Publish) vs UNMET (honest reason + pointer to run an eval + explicit Force-publish that sends `override:true`). Render the SAME honesty numbers the eval surface speaks — copy the numeric readout style from `SkillEvalSection.tsx:566-572`:
```tsx
{evalRun && evalRun.measured_count != null && (
  <p className="text-xs font-medium text-foreground">
    {evalRun.passed_count ?? 0}/{evalRun.measured_count} with-skill cases passed
    {evalRun.measured_count < evalRun.case_count &&
      ` · ${evalRun.case_count - evalRun.measured_count} not measured`}
  </p>
)}
```

---

### `frontend/src/components/skills/SkillCard.tsx` (MODIFY — intercept the Globe click)

**Analog:** its OWN inline `confirmingDelete` local-state block (:105-130) is the in-card interaction idiom, and `handleToggleGlobal` (:58-65) is the exact handler to intercept. Today the Globe button (:214-228) calls `handleToggleGlobal` directly. Change: on the private→global direction, open `PublishGateDialog` instead of calling straight through; unshare (global→private) stays a direct call (D-07 never gated). The `skill.is_global` ternary at :226 already distinguishes the two directions — branch on it.

---

### `frontend/src/components/skills/SkillEvalSection.tsx` (MODIFY — add the D-06 gate-status line)

**Analog:** its OWN `renderGateCounts` helper (:96-111) and the per-run verdict line (:566-572) — the exact "honest counts, plain text, no chrome" render style. Add a gate-status line (publish readiness at a glance) + the owner-visible override record (D-02), fetched from `getPublishGate` and hydrated on mount the SAME way proposals are (the `useEffect [skillId]` init block :288-353 + refetch-not-optimistic `refetchProposal` :263-272). Do NOT redesign — 137 owns the design.

---

### `frontend/src/lib/api.ts` (MODIFY — client fns)

**Analogs (all in-file):**
- `toggleSkillGlobal` (:1569-1580) — MODIFY to accept an optional `override?: boolean` and POST it as a JSON body; keep the `res.status === 403` special-case, ADD a `res.status === 409` branch that parses `detail.gate` and throws a typed error the dialog can render.
- `createSkill` (:1528-1537) — reference only (unchanged client; the hard-set is server-side).
- `proposalError` helper (:1739-1751) — the exact "parse FastAPI `detail`, guard string-vs-array" extraction to reuse for the 409 gate payload (but here `detail` is an OBJECT `{error, gate}`, so extract `gate` explicitly rather than expecting a string).
- `forcePromoteProposal` (:1839-1853) — the "send explicit JSON body on a POST, throw via the shared error helper" shape for the override call.
- `getEvalRun` (:1673-1678) / `listEvalRuns` (:1685-1690) — the `getAuthHeaders → fetch → typed json cast` shape for the NEW `getPublishGate(skillId)` fn.

---

### `frontend/src/types/index.ts` (MODIFY — add `PublishGate` TS interface)

**Analog:** `PromotionGate` (:655-664) and `EvalRun` (:583-602) — flat interface, nullable fields, status-union style. Add `PublishGate { met: boolean; state: "never_evaled"|"latest_failed"|"passed_on_older_version"|"passed"; measured: number|null; passed: number|null; passing_run_id: string|null; reason: string }` mirroring the backend `PublishGate` Pydantic model exactly.

---

### `frontend/src/components/skills/PublishGateDialog.test.tsx` (NEW — component test)

**Analog:** `frontend/src/components/skills/SkillFormDialog.test.tsx` (same directory, dialog + mocked `@/lib/api`) or `frontend/src/components/relationships/CreateLinkDialog.test.tsx`. Mount the dialog, mock `getPublishGate` for the met/unmet branches, assert the satisfied `X/N` render vs the honest-unmet + Force-publish affordance (D-05). NOTE: some frontend vitest is pre-existing ROT (MEMORY `project_frontend_vitest_rot`) — author a fresh clean test, don't lean on a rotted sibling.

---

## Shared Patterns

### Owner-scoping (V4 Access Control)
**Source:** `backend/app/api/evals.py:106-135` (`_verify_owned_skill`) + `backend/app/api/skills.py:414-426` (existing 403).
**Apply to:** every new read/write in `skills.py` and `publish_gate_service.py`.
The service-role client bypasses RLS, so `.eq("user_id", user_id)` in app code is the REAL gate; RLS is defense-in-depth. **Endpoint-local convention split:** the skills router uses **403** on non-owner (keep it — `toggle_global` :423), while newer eval routes use **404**. Keep each endpoint consistent with its own file.

### `run_in_threadpool` gap (IMPORTANT — a real inconsistency the planner must resolve)
**Source rule:** CLAUDE.md D-v2.5-01 + `evals.py` (every blocking call wrapped, e.g. :115-126, :1096-1108).
**Observation:** the EXISTING `skills.py` `toggle_global` (:414-438) and `create_skill` (:174-184) call supabase-py **directly in the async handler — NOT wrapped**. This is a pre-existing skills-router inconsistency. The NEW gate compute + override INSERT are potentially heavier reads under `WORKER_COUNT=2`, so **new gate/override code should follow the evals.py `run_in_threadpool` pattern** (RESEARCH Pitfall #5), even though the surrounding legacy skills code doesn't. Don't silently copy the unwrapped legacy style into the new hot path.

### Structured 409 + evidence-at-override
**Source:** `backend/app/api/evals.py:1825-1908` (force_promote): 409 unless overridable → apply write → record `override_forced=true` + attach `_compute_gate(...)` snapshot "at the moment of override".
**Apply to:** the gated `toggle_global` (409 payload carries the gate) and the override INSERT (records gate_state + snapshot + when, D-01/D-02).

### Hard-set share flags server-side
**Source:** `backend/app/services/classification_rule_service.py:79` (`"is_global": False  # HARD-SET — never from the caller (T-118-02-01)`).
**Apply to:** `create_skill` insert (D-08).

### Append-only owner-scoped table (migration)
**Source:** `supabase/migrations/083_skill_proposals.sql` + `081` eval_ratings block.
**Apply to:** `084_skill_publish_overrides.sql` — owner-only SELECT RLS, no client write policies, `ON DELETE CASCADE` FKs, migration-discipline header comment.

### Refetch-not-optimistic (frontend)
**Source:** `SkillEvalSection.tsx` (`refetchProposal` :263-272; the whole surface reads DB state, never optimistic — T-135-04).
**Apply to:** PublishGateDialog + the SkillEvalSection gate-status line — render server-computed gate/override state, never client-side gate math (D-07).

### Client API error extraction
**Source:** `frontend/src/lib/api.ts:1739-1751` (`proposalError`) — parse FastAPI `detail`, guard string-vs-object so a structured 409 never renders `[object Object]`.
**Apply to:** `toggleSkillGlobal`'s new 409 branch and the override call.

---

## No Analog Found

None. Every file maps to an in-repo analog (mostly the sibling eval router/surface shipped in 132-135, plus each frontend file's own existing patterns). The only "weak" analogs are the two NEW test files, which have adjacent-directory dialog-test siblings but no 1:1 twin — noted inline with the frontend-vitest-rot caveat.

## Metadata

**Analog search scope:** `backend/app/api/` (skills, evals), `backend/app/services/` (eval_runner, classification_rule), `backend/app/models/skill.py`, `backend/tests/` (evals + proposals routers), `supabase/migrations/` (079-083), `frontend/src/components/skills/` + `ui/alert-dialog.tsx` + `lib/api.ts` + `types/index.ts`.
**Files scanned:** 14 read in full/targeted; 2 grep passes; migration + frontend-test directory listings.
**Pattern extraction date:** 2026-07-03
