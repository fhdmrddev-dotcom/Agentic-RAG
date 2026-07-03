---
phase: 136-skill-publish-gate-gate-01
reviewed: 2026-07-03T04:23:07Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/api/skills.py
  - backend/app/models/skill.py
  - backend/app/services/publish_gate_service.py
  - backend/tests/integration/test_skills.py
  - backend/tests/test_publish_gate.py
  - frontend/src/components/skills/PublishGateDialog.test.tsx
  - frontend/src/components/skills/PublishGateDialog.tsx
  - frontend/src/components/skills/SkillCard.tsx
  - frontend/src/components/skills/SkillEvalSection.test.tsx
  - frontend/src/components/skills/SkillEvalSection.tsx
  - frontend/src/hooks/useSkills.ts
  - frontend/src/lib/api.ts
  - frontend/src/types/index.ts
  - supabase/full-schema.sql
  - supabase/migrations/084_skill_publish_overrides.sql
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
status: issues_found
---

# Phase 136: Code Review Report

**Reviewed:** 2026-07-03T04:23:07Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Adversarial review of the GATE-01 skill publish gate: gate-compute service, gated
`toggle-global` enforcement, `publish-gate` read endpoint, the append-only
`skill_publish_overrides` audit table, and the thin dialog/status-line frontend.

The core invariants hold under adversarial tracing:

- **Server is the sole gate authority.** The only path to `is_global=true` is
  `PATCH /skills/{id}/toggle-global`, which recomputes the gate server-side from
  `eval_runs` numeric columns. I hunted every other `skills`-table write path
  (`create_skill`, `update_skill` via `SkillUpdate` — no `is_global` field, extras
  ignored; `/skills/import`; `tool_dispatcher._handle_save_skill`; the evals.py
  promotion write; `skill_tuner_service`) — none can set `is_global`. The born-global
  side door in `create_skill` is hard-closed (`skills.py:185`).
- **Override on an unmet gate inserts an owner-visible record** with the gate
  snapshot at the moment of override (`skills.py:459-497`); a met gate records
  nothing; a plain refusal records nothing (proven in `test_publish_gate.py`).
- **Unshare is never gated; re-share re-gates** (the gate call is inside the
  `new_value is True` branch only; proven by `test_unshare_never_gated_reshare_regated`).
- **RLS on `skill_publish_overrides`** is owner-only SELECT with zero write policies
  in both migration 084 and the regenerated `full-schema.sql`.
- **D-03/D-04 compute logic** (numeric-only pass rule, content-equality version
  binding, completed-only filter, mixed-history precedence) is correct, including the
  adversarial non-completed-row-carrying-counts case, and the version-capture trigger
  (migration 079 `skills_capture_version`) makes the override's latest-version_number
  resolution sound in production.

What does not hold: the flip-based API can silently invert a stale client's intent
(WR-01), the modified handler still runs blocking Supabase I/O on the event loop
(WR-02), a failed publish UPDATE strands a false "published without a passing eval"
audit row and 500s (WR-03), a narrow race turns the gate's `LookupError` backstop
into a 500 (WR-04), and the eval-surface gate line goes stale immediately after the
very actions that change it (WR-05).

No structural findings block was provided; all findings below are narrative.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Flip-based toggle carries no target direction — a stale client can silently invert share/unshare, bypassing the confirm-dialog-always UX

**File:** `backend/app/api/skills.py:410-508` (and `frontend/src/components/skills/SkillCard.tsx:225-233`)
**Issue:** `toggle-global` computes `new_value = not skill_row["is_global"]` from the
server row, but the client decides *which UI flow to run* (gate dialog vs direct
unshare) from its **local** `skill.is_global`. If the two disagree (second tab,
second device, a re-fetch race, or a rapid double-click — the Globe button has no
pending/disabled state, unlike the Export button), the action inverts:

1. Card believes the skill is global (stale; it is actually private). User clicks
   Globe intending to **unshare** → `handleToggleGlobal()` sends no body → server
   sees private → runs the gate → if the gate is met, the skill is **published** —
   with no confirm dialog ever shown (violates the phase's confirm-dialog-always
   decision) and against the user's intent.
2. Card believes the skill is private; it is actually global. User confirms
   **Publish** in the dialog → server flips it to **private**, returns 200, and the
   client happily records `is_global=false`.

The server gate itself is never bypassed (becoming global always passes through the
gate branch), so this is not a security hole — but on a security-relevant action
(exposing a skill to every user), a silent intent inversion returning 200 is a
correctness defect.
**Fix:** Make the direction explicit. Add it to the existing body model and refuse a
mismatch:

```python
class TogglePublishBody(BaseModel):
    override: bool = False
    target: bool | None = None  # desired is_global; None = legacy flip

# in toggle_global, after computing skill_row:
if body and body.target is not None and body.target == skill_row["is_global"]:
    raise HTTPException(status_code=409, detail={"error": "state_conflict",
                        "is_global": skill_row["is_global"]})
new_value = body.target if (body and body.target is not None) else not skill_row["is_global"]
```

Have the dialog send `{"target": true, "override": ...}` and the unshare path send
`{"target": false}`. Additionally, disable the Globe button while a toggle is in
flight in `SkillCard` (mirror the `exporting` pattern).

### WR-02: Blocking Supabase calls on the event loop inside the modified `toggle_global` handler (D-v2.5-01)

**File:** `backend/app/api/skills.py:428-435, 500-507`
**Issue:** The phase's stated invariant (project rule D-v2.5-01) is that Supabase
calls inside async handlers are wrapped in `run_in_threadpool`. The gate compute and
the override read/insert are wrapped — but the same rewritten handler still executes
the Step-1 owner fetch (`skills.py:428-435`) and the Step-4 `is_global` UPDATE
(`skills.py:500-507`) as direct blocking calls on the event loop. Every gated publish
now takes this hybrid path, so under WORKER_COUNT=2 with concurrent streams, each
toggle stalls the loop twice. The code comment acknowledges the legacy handlers are
unwrapped, but this handler is no longer legacy — it is the GATE-01 hot path.
**Fix:** Wrap both calls in the same pattern already used three lines away:

```python
def _read_current():
    return (supabase.table("skills").select("*").eq("id", skill_id)
            .eq("user_id", current_user["id"]).maybe_single().execute())
current = await run_in_threadpool(_read_current)
...
def _apply_update():
    return (supabase.table("skills").update({"is_global": new_value})
            .eq("id", skill_id).eq("user_id", current_user["id"]).execute())
result = await run_in_threadpool(_apply_update)
```

### WR-03: Override audit row is committed before the publish UPDATE — a zero-row/failed UPDATE strands a false "published without a passing eval" record and 500s on `result.data[0]`

**File:** `backend/app/api/skills.py:497-508`
**Issue:** On the force-publish path the `skill_publish_overrides` INSERT
(`skills.py:497`) runs before the `is_global` UPDATE (`skills.py:501-507`). If the
UPDATE then matches zero rows (skill deleted concurrently — the FK cascade would
remove the just-inserted override row, benign) or the UPDATE call raises (transient
DB error — the override row survives), the request dies with an unhandled
`IndexError` at `result.data[0]` → 500, while `compute_publish_gate` will forever
report `last_override` for a publish that never happened. The eval surface then
renders "Published without a passing eval on ..." for a skill that is still private —
a false owner-visible audit statement, in a phase whose core value is audit honesty.
**Fix:** Guard the UPDATE result and keep the audit row truthful — either insert the
override after a confirmed UPDATE (and accept the reversed failure mode), or verify
the UPDATE and compensate:

```python
result = await run_in_threadpool(_apply_update)
if not result.data:
    raise HTTPException(status_code=404, detail="Skill not found")
return result.data[0]
```

plus move the `_insert_override` call after this check (the gate snapshot was already
computed, so the recorded state is still "at the moment of override").

### WR-04: `compute_publish_gate`'s `LookupError` backstop escapes both endpoints as an unhandled 500

**File:** `backend/app/services/publish_gate_service.py:84-85` (callers: `backend/app/api/skills.py:451`, `backend/app/api/skills.py:540`)
**Issue:** `compute_publish_gate` raises `LookupError("skill not found")` when the
owner-scoped skill read returns nothing. Both callers owner-verify first, so this
fires only when the skill is deleted between the endpoint's owner check and the gate's
own read — but when it fires, no caller catches it, so FastAPI converts the
defense-in-depth backstop into a 500 Internal Server Error instead of the 403/404 the
surrounding code uses. A backstop that crashes the request is not a backstop.
**Fix:** Translate it at the call sites (or centrally):

```python
try:
    gate = await compute_publish_gate(supabase, skill_id, current_user["id"])
except LookupError:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                        detail="Skill not found or you are not the owner")
```

### WR-05: The eval-surface publish-gate line is hydrated once per skill and never refreshed — it shows a stale verdict immediately after the actions that change it

**File:** `frontend/src/components/skills/SkillEvalSection.tsx:155, 374-380, 543-567`
**Issue:** `publishGate` is fetched only in the `[skillId]` mount effect. Every
in-surface action that changes the server gate leaves the line stale until the user
switches skills or reloads:

- A passing eval completes (`onEvalComplete` → `loadReadout`) — the line still says
  "Not publishable yet — run an eval on the current version" next to the fresh
  "2/2 with-skill cases passed" rollup it contradicts.
- A proposal promotion rewrites the live instructions (and creates a new version) —
  the "Publish ready" line survives even though the gate has honestly reset to
  `passed_on_older_version`.
- A force-publish from `SkillCard` inserts an override — the owner-visible
  "Published without a passing eval" record does not appear.

For a phase whose success criterion is an *honest* publish-readiness readout, a
readout that contradicts on-screen evidence right after the user acts is a defect,
not a nicety.
**Fix:** Re-fetch the gate wherever the durable readout is re-fetched — the cheapest
correct hook is inside `loadReadout` (it already carries the skill-switch guard):

```tsx
const gate = await getPublishGate(requestedSkill).catch(() => null)
if (currentSkillRef.current !== requestedSkill) return
if (gate) setPublishGate(gate)
```

and additionally after `refetchProposal` reconciles a `promoted` status.

## Info

### IN-01: `PublishGate.state` is an unenforced `str` on the backend while both clients assume a closed union

**File:** `backend/app/models/skill.py:57-58` (consumer: `frontend/src/components/skills/PublishGateDialog.tsx:34-41`)
**Issue:** The Pydantic field is documented as `Literal "never_evaled" | "latest_failed" | "passed_on_older_version" | "passed"` but typed as plain `str`, so a
drifted/typo'd state passes validation silently. The dialog's `UNMET_COPY[gate.state]`
lookup has no fallback (unlike `unmetGateLine`'s `default:` branch), so an unknown
state renders an empty headline.
**Fix:** `state: Literal["never_evaled", "latest_failed", "passed_on_older_version", "passed"]` in `PublishGate`, and give `UNMET_COPY` a fallback (or reuse
`unmetGateLine`'s switch shape).

### IN-02: `SkillCreate.is_global` field survives as a dead, misleading input

**File:** `backend/app/models/skill.py:11`
**Issue:** `create_skill` now hard-sets `is_global=False`, so the request field is
accepted, validated, and silently discarded. Silent-ignore is the tested D-08
contract, but keeping the field advertises a capability the API no longer has.
**Fix:** Remove the field from `SkillCreate` (extra body keys are already ignored by
Pydantic's default config, so old clients keep working), or add a comment marking it
intentionally inert.

### IN-03: Globe (share/unshare) button click bubbles to the card's `onSelect`

**File:** `frontend/src/components/skills/SkillCard.tsx:225-233`
**Issue:** The card root has `onClick={() => onSelect(skill)}`; the Edit button stops
propagation (`SkillCard.tsx:211`) but the rewritten Globe handler does not, so
clicking Share/Unshare also switches the right-hand detail panel to this skill while
the gate dialog opens on top. Pre-existing pattern (Delete/Export/Try-in-Chat share
it), but this handler was rewritten this phase.
**Fix:** `onClick={(e) => { e.stopPropagation(); ... }}` on the Globe button.

### IN-04: Migration 084 — `gate_state` has no CHECK constraint, and the doc comment's `gate_snapshot` keys don't match the code

**File:** `supabase/migrations/084_skill_publish_overrides.sql:44-45`
**Issue:** (a) The comment fixes the `gate_state` domain
(`'never_evaled' | 'latest_failed' | 'passed_on_older_version'`) but the column is
unconstrained `text` — a service-code bug could write anything into the append-only,
never-mutated audit trail. (b) The comments (lines 12/45/55) document `gate_snapshot`
keys as `{measured, passed, reason}` while the handler writes
`{measured_count, passed_count, reason}` (`skills.py:488-492`).
**Fix:** Add `CHECK (gate_state IN ('never_evaled','latest_failed','passed_on_older_version'))` in a follow-up migration; align the comment
with the actual snapshot keys.

### IN-05: `api.ts` doc comment claims "404 cross-user" but the endpoint returns 403

**File:** `frontend/src/lib/api.ts:1612-1615` (server: `backend/app/api/skills.py:535-539`)
**Issue:** `getPublishGate`'s comment says the endpoint is "Owner-scoped server-side
(404 cross-user)"; the server raises 403. Harmless today (the client treats all
non-OK alike) but will mislead the next person wiring status-specific handling.
**Fix:** Correct the comment to 403 (or change the endpoint to 404 if enumeration
consistency with `list_skill_files` is preferred).

### IN-06: `SkillEvalSection.test.tsx` mocks only 5 of the 14 `@/lib/api` exports the component imports

**File:** `frontend/src/components/skills/SkillEvalSection.test.tsx:27-33`
**Issue:** The `vi.mock` factory omits `startEvalRun`, `getEvalRun`, `rateEvalResult`,
`proposeImprovement`, `getProposal`, `approveProposal`, `rejectProposal`,
`rerunProposalReeval`, and `forcePromoteProposal`. The suite passes only because
Vitest resolves missing mock exports lazily and these paths are never exercised; the
first future test that clicks "Run eval" will die with the confusing
`No "startEvalRun" export is defined on the mock` instead of a real assertion failure.
**Fix:** Add the remaining exports as `vi.fn()` stubs (one line each) so the mock is a
complete module surface.

### IN-07: PublishGateDialog gate-load failure is a dead end — no retry affordance

**File:** `frontend/src/components/skills/PublishGateDialog.tsx:107, 130-157`
**Issue:** Both footer actions are gated on `gate`, so a transient `getPublishGate`
failure ("Couldn't load the publish gate. Try again.") leaves only Cancel; "Try
again" requires closing and reopening the dialog. Fail-closed is the right default
(no publish without seeing the server gate), but the copy promises a retry the UI
doesn't offer.
**Fix:** Add a small "Retry" button in the `loadError` branch that re-runs the fetch
(extract the effect body into a `loadGate()` callback).

### IN-08: The unmet-gate copy has no awareness of `is_global` — an already-published skill reads "Not publishable yet"

**File:** `frontend/src/components/skills/SkillEvalSection.tsx:118-128` (model: `backend/app/models/skill.py:46-63`)
**Issue:** Editing (or force-promoting a proposal on) an already-global skill resets
the gate without unsharing — a deliberate phase decision (gate binds to share
actions only). But the readout then shows "Not publishable — ..." on a skill that
*is currently published globally*, which reads as a contradiction. The `PublishGate`
model doesn't carry `is_global` (the service reads it at
`publish_gate_service.py:76` but discards it), so the client can't distinguish
"not publishable" from "published, but its current version hasn't passed".
**Fix:** Add `is_global: bool` to `PublishGate` (the service already reads it) and
branch the copy: unmet + global → "Published, but the current version hasn't passed
an eval — re-eval or unshare."

---

_Reviewed: 2026-07-03T04:23:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
