# Phase 136: Skill Publish Gate (GATE-01) - Research

**Researched:** 2026-07-03
**Domain:** Server-side authorization gate over an existing endpoint (FastAPI/supabase-py) + thin React confirm surface; consumes the shipped eval substrate (migrations 079–083)
**Confidence:** HIGH — every load-bearing claim is verified against live code/migrations in this repo

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Block + recorded override.** Publishing with the gate unmet is BLOCKED; the owner may explicitly force-publish, with the unmet-gate evidence rendered at the moment of override, and the override recorded (what the gate state was + when). Mirrors 135 D-06 (`override_forced=true`). Never warn-only, never silent.
- **D-02 — Override visibility = owner only.** The override record is queryable and the owner sees an honest "published without passing eval" status on `SkillEvalSection`. NO consumer-facing marker in 136 (an "unverified" chip on global SkillCards is DEFERRED to Phase 137).
- **D-03 — Gate-satisfying run = ≥1 measured case AND every measured with-skill case passed** (`measured_count >= 1 AND passed_count == measured_count`). Adopts migration 081's non-authoritative default rollup as the AUTHORITATIVE publish rule. `not_measured` cases stay excluded. Interrupted / non-completed runs never satisfy. No percentage knob.
- **D-04 — Current version only.** The passing run must be tied to the skill's CURRENT instructions. Edit-after-a-pass honestly resets the gate to unmet until a re-eval passes. **Planner nuance:** 135's promotion applies the evaled draft's instructions to the live `skills` row, firing the 132 trigger and creating a near-duplicate version row — the gate MUST treat that promoted state as "current version passed" by **instruction-content equality or promotion linkage, NOT naive latest-version-id equality**.
- **D-05 — Confirm dialog always** on "Share globally": gate met → satisfied status + Publish; gate unmet → honest status (never evaled / latest failed / passed on older version) + a pointer to run an eval + the explicit force-publish affordance (evidence shown at that moment). One home for status + evidence + override.
- **D-06 — A small gate-status line also lives in `SkillEvalSection`** — publish readiness at a glance + the owner-visible override record. Keep both surfaces plain/undesigned (137 owns the designed experience).
- **D-07 — Server-side enforcement is the gate.** The toggle endpoint refuses private→global when the gate is unmet unless the request explicitly carries the override (structured error carrying gate status). Client dialog is UX, not the gate. Global→private (unshare) is never gated.
- **D-08 — Close the born-global side door:** `POST /skills` hard-sets `is_global=false` server-side, ignoring any client value (classification-rules precedent T-118-02-01). The gated toggle becomes the ONLY path to global. Import + agent `save_skill` already safe — verify with tests, don't change.
- **D-09 — Gate every share action.** Unshare→re-share runs the same gate check as a first publish. Already-global skills untouched until the owner unshares (this satisfies SC#3 future-publish-only). No grandfathering state.
- **D-10 — Net-new / additive only; red line (project D-14).** Gate logic READS `eval_runs`/`skill_versions`/`skills` and modifies only the skills router (toggle + create) + thin frontend (SkillCard dialog, SkillEvalSection status line, `api.ts`). NO agent-loop / provider-gateway / `threads.py` touch. Deep Mode byte-identical. NOT SC#10-flagged — standard G-4 lived UAT on the dialog.
- **D-11 — Migration discipline** (if a migration is needed — next in sequence = 084): apply via Supabase SQL editor or psycopg2 :54322 (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated `full-schema.sql` together.

### Claude's Discretion
- Where the override record lives: columns on `skills` vs a small audit row — planner picks the smallest honest shape, consistent with the append-only/service-role precedents.
- Exact structured-error shape from the gated toggle (e.g. 409 + gate payload) and dialog copy; the gate-status compute (inline query vs small service helper) and whether it's exposed as a tiny `GET` (gate-status) endpoint for the dialog.
- How "current version" equality is implemented (content hash vs promotion linkage vs latest-version resolution) per the D-04 planner nuance.
- Dialog component reuse (existing confirm-dialog primitives) — keep it plain per the 137 fence.

### Deferred Ideas (OUT OF SCOPE)
- Consumer-facing "unverified" badge on override-published globals → Phase 137 sketch candidate.
- Configurable pass threshold (percentage / per-skill / Settings knob) → only if lived usage demands it.
- Stale-pass warning state (satisfied by an older version's pass + warning) → rejected for hard current-version binding.
- Retroactive gating / sweep of already-published skills → explicitly out of scope (SC#3); a future governance phase could surface "published, never evaled" skills in a health view.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | A skill can only be published (made global/shareable) after ≥1 eval has run and passed — the publish flow surfaces this gate with a clear status and blocks (or warns with evidence) if unmet. | Gate compute is a pure READ of the shipped `eval_runs` rollup (migration 081 `passed_count`/`measured_count`, verified identical to D-03 at `eval_runner_service.py:688-690`) joined to `skill_versions.instructions` for the D-04 current-version binding. Enforcement wraps the existing owner-only `toggle_global` (`skills.py:406`); the born-global side door is `create_skill` (`skills.py:181`). Override record + evidence-at-override reuse the 135 force-promote idiom (`evals.py:1825-1908`). |
</phase_requirements>

## Summary

Phase 136 is a **small, backend-weighted authorization phase** with a thin, deliberately-undesigned frontend. There is **no new domain, no new library, and no new runtime** — the entire eval substrate the gate reads (`eval_runs`, `eval_results`, `skill_versions`, `skill_proposals`) shipped in Phases 132–135. The gate itself is a **query + comparison**, not new grading machinery: migration 081 already writes `passed_count` / `measured_count` at run finalize using a rule (`eval_runner_service.py:690`) that is byte-identical to D-03. D-03 simply promotes that non-authoritative default into the authoritative publish rule so the eval readout and the gate can never disagree.

The three real design tasks are: (1) implement the **D-04 current-version binding** robustly across the 135-promotion near-duplicate-version trap; (2) wrap the existing owner-only `toggle_global` endpoint with a server-side gate + structured refusal + recorded override, and close the `create_skill` born-global side door; and (3) render a thin confirm dialog + a `SkillEvalSection` status line reusing existing primitives. Every write path to `is_global=true` must funnel through the gated toggle.

**Primary recommendation:** Implement the D-04 current-version check by **instruction-content equality** (compare the passing run's linked `skill_versions.instructions` to the live `skills.instructions`), not latest-version-id equality — this is the ONLY approach that is correct under BOTH a manual edit AND the 135-promotion near-duplicate-version case, and it needs no join to `skill_proposals`. Expose a server-computed `GET /skills/{id}/publish-gate` for the dialog, gate the `PATCH .../toggle-global` (409 + gate payload on unmet, `override` body flag to force), hard-set `is_global=false` in `create_skill`, and record overrides in a small append-only `skill_publish_overrides` table (migration 084) consistent with the 5-table eval-domain precedent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gate decision (met/unmet + reason) | API / Backend | Database (read `eval_runs`⋈`skill_versions`⋈`skills`) | D-07: server is the gate; the client dialog is UX only. Never trust the client. |
| Enforcement (refuse private→global) | API / Backend | — | The `PATCH .../toggle-global` mutation is the single enforcement point (owner-scoped, service-role client). |
| Close born-global side door | API / Backend | — | `POST /skills` hard-sets `is_global=false` server-side (D-08). |
| Override record (what/when) | Database / Storage | API / Backend | Append-only audit row written by the service-role toggle handler (D-01/D-02). |
| Gate status at a glance | Frontend | API (GET publish-gate) | D-05 dialog + D-06 `SkillEvalSection` line render server-computed status; no client-side gate math. |
| Confirm + force-publish UX | Frontend (Browser) | — | `AlertDialog` primitive, plain per the 137 fence. |

## Standard Stack

**No new packages.** This phase composes only what is already installed and in use in the repo.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | in-repo | Router + `HTTPException` structured refusal | `skills.py` / `evals.py` are already FastAPI routers `[VERIFIED: codebase]` |
| supabase-py | in-repo | Service-role reads of `eval_runs`/`skill_versions`/`skills` + owner-scoped writes | The established data-access path; every eval route uses it `[VERIFIED: codebase]` |
| Pydantic (v2) | in-repo | Request/response models (`PublishGate`, toggle body) | House style; all eval models are Pydantic `[VERIFIED: backend/app/models/eval_run.py]` |
| React + `@/lib/api` fetch client | in-repo | Dialog + status line + `toggleSkillGlobal` client | `api.ts` already has the skill/eval clients `[VERIFIED: frontend/src/lib/api.ts]` |
| `@/components/ui/alert-dialog` (Radix) | in-repo | The D-05 confirm dialog | Already exported + used by 10 surfaces incl. skills `[VERIFIED: codebase]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Instruction-content equality (D-04) | Promotion-linkage (`skill_proposals.status='promoted'` ⋈ `re_eval_run_id`) | Linkage works for the promotion case but MISSES a manual edit that reverts to previously-passing text, and needs an extra join. Content-equality is strictly more general. |
| Content-equality by full-string compare | Content HASH (sha256) compare | Hashing avoids shipping long instruction text through query strings; but the recommended PostgREST FK-embed already fetches instructions server-side, so a Python `==` compare is simplest. Hash is a fine optimization if instruction bodies get large. |
| Small append-only audit table (override record) | Columns on `skills` (`published_with_override_at` + `gate_snapshot jsonb`) | Columns are smaller but only retain the LATEST override and pollute the content table; D-09 gates EVERY share action (repeatable unshare→reshare overrides), so a single column set loses honest history. |
| `GET /publish-gate` endpoint for the dialog | Client recomputes from `listEvalRuns` + skill instructions | D-07 mandates the server is the gate; a server GET keeps the dialog's displayed status authoritative and prevents drift. |

**Installation:** none. `pip`/`npm` untouched.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All code uses libraries already present and version-pinned in `backend/requirements.txt` and `frontend/package.json`. No `npm install` / `pip install` occurs. slopcheck gate is therefore vacuously satisfied (no new supply-chain surface).

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
  SkillCard "Share         │  FRONTEND (thin, 137-fenced)                 │
  globally" (Globe)  ──────▶│  is_global? false → open AlertDialog (D-05) │
  SkillCard.tsx:214-228     │  is_global? true  → direct unshare (D-07)   │
                          └───────────────┬─────────────────────────────┘
                                          │ 1) GET /skills/{id}/publish-gate
                                          ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  BACKEND — compute_publish_gate(skill_id, user_id)   [the ONE helper]  │
   │                                                                        │
   │   read skills.instructions (current)  ◀── skills                       │
   │   read completed eval_runs for skill  ◀── eval_runs (owner-scoped)     │
   │        embed skill_versions(instructions) via FK                       │
   │   gate MET ⇔ ∃ run where:                                              │
   │      run.status == 'completed'                                         │
   │      run.measured_count >= 1 AND run.passed_count == run.measured_count│  (D-03)
   │      run.skill_versions.instructions == skills.instructions           │  (D-04 content-eq)
   │   → PublishGate{ state, measured, passed, passing_run_id, reason }     │
   └───────────────┬───────────────────────────────────────┬──────────────┘
                   │ status → dialog renders                │
                   ▼                                        ▼
   dialog shows "Eval passed X/N          user clicks Publish / Force publish
   on current version" OR honest                     │
   unmet + how-to-satisfy + Force                     │ 2) PATCH /skills/{id}/toggle-global
                                                      ▼      body {override: bool}
   ┌──────────────────────────────────────────────────────────────────────┐
   │  toggle_global (skills.py:406)  — THE GATE (D-07)                      │
   │   owner-verify (existing 403)                                         │
   │   if new_value is True (private→global):                             │
   │      gate = compute_publish_gate(...)                                 │
   │      if not gate.met and not body.override → 409 + gate payload       │
   │      if not gate.met and body.override:                               │
   │           UPDATE skills.is_global = true                              │
   │           INSERT skill_publish_overrides (gate snapshot + when) ◀─┐   │  (D-01/D-02)
   │      else (met): UPDATE skills.is_global = true                   │   │
   │   if new_value is False (unshare): UPDATE, NO gate (D-07)         │   │
   └──────────────────────────────────────────────────────────────────┼───┘
                                                                       │
                          skill_publish_overrides (append-only, migration 084)
                                     │
                                     ▼  owner reads back via GET publish-gate / SkillEvalSection (D-06)
```

### Recommended surface structure (all additive)
```
backend/app/
├── api/skills.py            # MODIFY: toggle_global (gate), create_skill (hard-set is_global=false),
│                            #         + GET publish-gate endpoint (or a tiny sibling)
├── models/skill.py          # ADD: PublishGate + TogglePublishBody Pydantic models
├── services/                # OPTIONAL: publish_gate_service.py — compute_publish_gate() helper
│                            #           (keeps skills.py thin; mirrors classification_rule_service.py)
supabase/migrations/
└── 084_skill_publish_overrides.sql   # ADD (if audit-table shape chosen)
frontend/src/
├── components/skills/SkillCard.tsx        # MODIFY: intercept Globe click → dialog on private→global
├── components/skills/PublishGateDialog.tsx # ADD (thin): AlertDialog wrapper, status + force
├── components/skills/SkillEvalSection.tsx  # MODIFY: add gate-status line + override record (D-06)
└── lib/api.ts                             # ADD: getPublishGate(); MODIFY: toggleSkillGlobal(override?)
```

### Pattern 1: Content-equality current-version gate (D-04) — the load-bearing pattern
**What:** Determine "a passing eval exists on the skill's CURRENT instructions" by comparing the passing run's version text to the live skill text, not by version-id.
**When to use:** The single gate compute, every time.
**Why:** After a 135 promotion, `skills.instructions` is UPDATEd to the proposed text (`evals.py:1234-1243`), which fires the 079 capture trigger and mints a NEW `source='manual'` `skill_versions` row — but the passing re-eval pins the `self_improve` DRAFT version, whose id is NOT the latest. Content-equality sidesteps the id mismatch entirely.

```python
# Source: composed from verified schema (migration 080:45 FK) + rollup rule (eval_runner_service.py:690)
# ONE PostgREST query using FK embedding: eval_runs.skill_version_id -> skill_versions.id
def _read_passing_runs():
    return (
        supabase.table("eval_runs")
        .select("id, status, passed_count, measured_count, skill_versions(instructions)")
        .eq("skill_id", skill_id)
        .eq("user_id", user_id)          # the real owner gate (service-role client)
        .eq("status", "completed")        # interrupted/cancelled/running read NULL rollup — excluded (D-03)
        .execute()
    )

runs = (await run_in_threadpool(_read_passing_runs)).data or []
current_instr = skill_row["instructions"]     # live skills.instructions
def _satisfies(r: dict) -> bool:
    mc, pc = r.get("measured_count"), r.get("passed_count")
    ver = r.get("skill_versions") or {}
    return (
        mc is not None and mc >= 1 and pc == mc          # D-03 authoritative rule
        and ver.get("instructions") == current_instr      # D-04 current-version content-equality
    )
passing = [r for r in runs if _satisfies(r)]
met = len(passing) > 0
```
**Fallback if FK-embed is finicky:** two queries — (a) fetch completed passing runs' `skill_version_id`s; (b) fetch those `skill_versions` rows' `instructions`; compare in Python. Same result. `[VERIFIED: codebase — FK present at migration 080:45; embedding is standard PostgREST]`

### Pattern 2: Gate the mutation, not the read (D-07)
**What:** `toggle_global` recomputes the gate server-side on the private→global direction and refuses with a structured 409 unless `body.override` is set; unshare is never gated.
**Example:**
```python
# Source: extends verified toggle_global (skills.py:406-439) + 135 force-promote 409 idiom (evals.py:1865-1869)
new_value = not skill_row["is_global"]
if new_value is True:                          # private -> global ONLY (D-07)
    gate = await compute_publish_gate(supabase, skill_id, current_user["id"])
    if not gate["met"] and not (body and body.override):
        raise HTTPException(status_code=409, detail={"error": "publish_gate_unmet", "gate": gate})
    # met OR explicit override → proceed; on override, INSERT the audit row (D-01/D-02)
# new_value is False → unshare: no gate, straight UPDATE
```
Reuses the exact owner-only pattern already at `skills.py:414-426` (403 on non-owner) — keep the endpoint-local 403 convention (skills router historically uses 403; newer eval routes use 404 — CONTEXT.md established patterns).

### Pattern 3: Hard-set the create side door (D-08)
**What:** `create_skill` ignores `body.is_global` and inserts `False`.
**Example:**
```python
# Source: mirrors classification_rule_service.py:79 (T-118-02-01)
.insert({
    "user_id": current_user["id"],
    "name": body.name.strip(),
    "description": body.description,
    "instructions": body.instructions,
    "is_global": False,   # HARD-SET — never from the caller (D-08 / T-118-02-01)
})
```
`skills.py:181` today inserts `body.is_global` — this is the exact line to change. The frontend never sends `is_global` on create (`SkillFormDialog.tsx:332,480` build `{name, description, instructions}`), and the import path already hard-codes `False` (`skills.py:251`), so nothing legitimate breaks. `[VERIFIED: codebase]`

### Anti-Patterns to Avoid
- **Latest-version-id equality for D-04:** WRONG after a 135 promotion (the passing re-eval pins the draft, not the newest `manual` dup). Use content-equality. `[VERIFIED: evals.py:1228-1244]`
- **Trusting `verdict_summary` text as the gate:** it's a NON-authoritative display label (migration 081:67-74). Recompute from the numeric `measured_count`/`passed_count` columns so the gate rule is the source of truth even if the label ever drifts.
- **Client-side gate math:** violates D-07. Compute server-side; the dialog only renders what the server returns.
- **Gating unshare:** D-07 — global→private is never gated.
- **Retroactively sweeping existing global skills:** out of scope (SC#3). Already-global skills stay global untouched.
- **`.eq("instructions", <long text>)` in a PostgREST GET query string:** URL-length/PostgREST risk with large instruction bodies. Fetch and compare in Python (or hash).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pass/fail rollup | A new grader over `eval_results` | Read `eval_runs.passed_count`/`measured_count` (migration 081) | Already written at finalize with the exact D-03 rule (`eval_runner_service.py:688-690`) — recomputing risks divergence. |
| "Which version passed" traceability | A new join table or snapshot | `eval_runs.skill_version_id` FK ⋈ `skill_versions.instructions` | Traceability FK shipped in migration 080 (:45) specifically for this. |
| Owner scoping | Bespoke auth check | Existing `.eq("user_id")` service-role pattern + `_verify_owned_skill` (`evals.py:106`) | The real runtime gate everywhere in the eval domain; RLS is defense-in-depth. |
| Override-with-evidence interaction | A new pattern | The 135 force-promote idiom (`evals.py:1825-1908`: record `override_forced`, attach gate snapshot at override) | D-01 explicitly mirrors it; copy tone + shape. |
| Confirm dialog | A new modal component | `@/components/ui/alert-dialog` | Already used by SkillFormDialog + 9 other surfaces; plain per the 137 fence. |

**Key insight:** The gate is a *read model over already-honest data*. The eval domain deliberately left "the real publish threshold" to this phase (migration 081:67 comment: "Phase 136 owns the real threshold"). D-03 is designed to MATCH the existing default rollup so nothing displayed anywhere changes meaning — the phase's job is to *enforce* an existing computation, not invent one.

## Common Pitfalls

### Pitfall 1: The 135-promotion near-duplicate version (the headline trap)
**What goes wrong:** After a self-improvement promotion, a naive gate says "not published-eligible" even though the current instructions were just proven by a passing re-eval.
**Why it happens:** Promotion does `UPDATE skills SET instructions = proposed` (`evals.py:1234-1243`, and force-promote at `:1874-1883`). The 079 `capture_skill_version` trigger fires on any instructions change (`079:112-119`) and mints a fresh `source='manual'` version — now the LATEST — but the passing re-eval's `skill_version_id` points at the earlier `self_improve` DRAFT version (created at approval). Their `instructions` are identical; their ids are not.
**How to avoid:** Content-equality (Pattern 1). The draft version's `instructions == skills.instructions == the manual-dup's instructions`, so content-equality returns MET; version-id equality returns UNMET.
**Warning signs:** A skill that just showed "Promoted to the live skill" in `SkillEvalSection` but whose publish gate reads "never evaled / passed on older version."

### Pitfall 2: Partial-run rollup columns are NULL, not zero
**What goes wrong:** Treating a cancelled/interrupted run as a fail rather than as "no verdict."
**Why it happens:** The rollup is written ONLY when `final_status == "completed"` (`eval_runner_service.py:687`); running/cancelled/interrupted/errored runs carry NULL `passed_count`/`measured_count`.
**How to avoid:** Filter `.eq("status","completed")` and guard `measured_count is not None` — a NULL run is naturally excluded (D-03: "Interrupted / non-completed runs never satisfy"). `[VERIFIED: eval_runner_service.py:679-690]`

### Pitfall 3: Existing born-global skills in dev/live data
**What goes wrong:** Assuming D-08 must sweep or fix already-global skills created before the side door closed.
**Why it happens:** `POST /skills` currently trusts `body.is_global` (`skills.py:181`); some skills may already be global.
**How to avoid:** D-08 changes FUTURE creates only; SC#3 keeps existing globals untouched (no retroactive gating, no data migration of `is_global` rows). The gate fires on the next toggle-to-global, never on existing state.
**Warning signs:** A plan task proposing to re-scan or reset existing `is_global=true` skills — that contradicts SC#3.

### Pitfall 4: Re-share after unshare must re-gate
**What goes wrong:** Granting a "was-ever-published" grandfather pass.
**Why it happens:** Intuition that once-published stays eligible.
**How to avoid:** D-09 — "publish" is the toggle-to-global ACTION; every private→global flip runs the gate fresh. No grandfathering state exists. `[CONTEXT: D-09]`

### Pitfall 5: Blocking supabase-py calls inside async handlers
**What goes wrong:** Event-loop stalls under the default `WORKER_COUNT=2`.
**How to avoid:** Wrap every gate read + override INSERT in `run_in_threadpool` (project rule D-v2.5-01; the whole eval router already does this — `evals.py:115-126`, `:1234-1243`). `[VERIFIED: CLAUDE.md + evals.py]`

## Code Examples

### Verified rollup rule the gate adopts (D-03)
```python
# Source: backend/app/services/eval_runner_service.py:687-690 (VERIFIED verbatim)
if final_status == "completed":
    measured_count = sum(1 for _v, st, _p in with_outcomes if st == "graded")
    passed_count = sum(1 for _v, _st, p in with_outcomes if p is True)
    verdict_summary = "pass" if (measured_count >= 1 and passed_count == measured_count) else "fail"
```
The gate recomputes `measured_count >= 1 and passed_count == measured_count` from the stored columns — identical semantics, authoritative per D-03.

### Verified promotion write that creates the near-duplicate version (why D-04 needs content-equality)
```python
# Source: backend/app/api/evals.py:1234-1244 (VERIFIED verbatim)
def _promote():
    return (
        supabase.table("skills")
        .update({"instructions": proposed})   # fires 079 trigger -> new 'manual' version (Pitfall #1)
        .eq("id", skill_id)
        .eq("user_id", user_id)
        .execute()
    )
await run_in_threadpool(_promote)
new_status = "promoted"
```

### Verified 135 override-with-evidence idiom the D-01 record mirrors
```python
# Source: backend/app/api/evals.py:1885-1892 (VERIFIED verbatim)
def _mark_promoted():
    return (
        supabase.table("skill_proposals")
        .update({"override_forced": True, "status": "promoted"})
        .eq("id", str(proposal_id))
        .eq("user_id", user_id)
        .execute()
    )
```

### Recommended override-record migration (if audit-table shape chosen)
```sql
-- 084_skill_publish_overrides.sql (RECOMMENDED shape; planner may choose columns-on-skills instead)
-- Append-only, owner-scoped, service-role-written — mirrors 079/080/081/083 exactly.
CREATE TABLE public.skill_publish_overrides (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id         uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    skill_version_id uuid REFERENCES public.skill_versions(id) ON DELETE SET NULL,  -- current version at publish
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gate_state       text NOT NULL,   -- 'never_evaled' | 'latest_failed' | 'passed_on_older_version'
    gate_snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {measured_count, passed_count, reason}
    created_at       timestamptz NOT NULL DEFAULT now()   -- the "when" (D-01)
);
CREATE INDEX idx_skill_publish_overrides_skill_id ON public.skill_publish_overrides (skill_id);
CREATE INDEX idx_skill_publish_overrides_user_id  ON public.skill_publish_overrides (user_id);
ALTER TABLE public.skill_publish_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own publish overrides"
  ON public.skill_publish_overrides FOR SELECT USING (auth.uid() = user_id);
-- NO INSERT/UPDATE/DELETE policies — only the service-role toggle handler writes (035/079/080/081/083 precedent).
```
`[VERIFIED: migration numbering — 080/081/082/083 exist, next = 084]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `verdict_summary` a non-authoritative display label | Same numeric rule promoted to the authoritative publish gate (D-03) | This phase (136) | Gate and readout can never disagree — no new number is invented. |
| Two paths to `is_global=true` (gated toggle + trusting `create_skill`) | ONE path: the gated toggle; `create_skill` hard-sets false (D-08) | This phase (136) | Closes the born-global bypass. |
| Publish ungated | Server-side gate + recorded override (D-01/D-07) | This phase (136) | Blocks unproven global shares; keeps an honest override trail. |

**Deprecated/outdated:** none — this phase adds, it does not replace shipped behavior. The `verdict_summary` column stays as-is (still display-only); the gate reads the numeric columns.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST FK-embed `eval_runs.select("...,skill_versions(instructions)")` resolves the `eval_runs.skill_version_id → skill_versions.id` relationship in one query. | Pattern 1 | LOW — FK is verified present (migration 080:45); if embed misbehaves, the two-query fallback (documented) is equivalent. Not a blocker. |
| A2 | The audit-table override shape is preferred over columns-on-skills. | Alternatives / migration | LOW — explicitly Claude's-discretion; planner may pick columns-on-skills. Recommendation rests on D-09 repeatability + append-only precedent. Either is honest. |

**All other claims in this research are VERIFIED against live code/migrations or CITED from CONTEXT.md/CLAUDE.md.**

## Open Questions

1. **Override-record shape: audit table vs columns on `skills`.**
   - What we know: D-09 gates every share action (overrides are repeatable); the eval domain has a strong 5-table append-only/service-role/owner-only-RLS precedent; toggle-only column writes do NOT fire the 079 version trigger (`079:112-119` — trigger versions only on name/description/instructions change), so columns-on-skills is version-safe.
   - What's unclear: whether the owner wants full override history or only the latest state.
   - Recommendation: append-only `skill_publish_overrides` (migration 084) for honest history; note columns-on-skills as the smaller alternative in the plan and let discuss/plan pick.

2. **GET publish-gate as its own route vs folding status into the 409 payload only.**
   - What we know: D-05 wants "confirm dialog always" showing status at open; the PATCH 409 only fires on a click attempt.
   - What's unclear: whether the team wants the extra read route.
   - Recommendation: ship the tiny `GET /skills/{id}/publish-gate` (server-computed, reuses the one helper) so the dialog renders satisfied/unmet BEFORE the user commits — cleaner than a speculative PATCH-to-probe.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local (Postgres) :54322 | Migration 084 apply + gate reads + tests | ✓ (dev default) | in-repo (CLI-managed) | — (must be up to apply the migration per D-11) |
| psycopg2 / Supabase SQL editor | Apply migration 084 live (D-11) | ✓ | in-repo | Either path works (never `db push`/`db reset`) |
| pytest (backend) | Backend gate tests | ✓ | in-repo | — |
| vitest (frontend) | Dialog/status-line tests | ✓ | in-repo | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all tooling is already in the dev environment.

## Validation Architecture

*(nyquist_validation = true in .planning/config.json — section required.)*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) + vitest (frontend) |
| Config file | `backend/pytest.ini` / `backend/pyproject.toml` (existing eval tests run here); `frontend/vitest.config.*` |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/test_publish_gate.py -x` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest` · `cd frontend && npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior (Success Criterion) | Test Type | Automated Command | File Exists? |
|--------|------------------------------|-----------|-------------------|-------------|
| GATE-01 SC#1 | Publish with no passing eval → 409 + gate payload (blocked, evidence) | unit (API) | `pytest tests/test_publish_gate.py::test_toggle_global_blocked_when_no_passing_eval -x` | ❌ Wave 0 |
| GATE-01 SC#1 | `create_skill` hard-sets `is_global=false` even when body sends true (D-08) | unit (API) | `pytest tests/test_publish_gate.py::test_create_skill_ignores_body_is_global -x` | ❌ Wave 0 |
| GATE-01 SC#1 | Import + agent `save_skill` remain non-global (D-08 regression) | unit (API) | `pytest tests/test_publish_gate.py::test_import_and_save_skill_stay_private -x` | ❌ Wave 0 |
| GATE-01 SC#2 | After a passing eval on current version → toggle succeeds; gate reads satisfied `X/N` | unit (API) | `pytest tests/test_publish_gate.py::test_toggle_global_allowed_after_passing_eval -x` | ❌ Wave 0 |
| GATE-01 SC#2 (D-04) | Manual edit after a pass resets gate to unmet | unit (API) | `pytest tests/test_publish_gate.py::test_edit_after_pass_resets_gate -x` | ❌ Wave 0 |
| GATE-01 SC#2 (D-04 nuance) | 135-promotion near-dup version still reads "current version passed" | unit (API) | `pytest tests/test_publish_gate.py::test_promoted_near_dup_version_counts_as_current -x` | ❌ Wave 0 |
| GATE-01 SC#1 (D-01) | Override with `override=true` publishes + writes an override record with gate snapshot | unit (API) | `pytest tests/test_publish_gate.py::test_force_publish_records_override -x` | ❌ Wave 0 |
| GATE-01 SC#3 | Already-global skill is untouched; unshare→re-share re-gates (D-09) | unit (API) | `pytest tests/test_publish_gate.py::test_unshare_never_gated_reshare_regated -x` | ❌ Wave 0 |
| GATE-01 (D-03) | Interrupted/cancelled run never satisfies the gate | unit (API) | `pytest tests/test_publish_gate.py::test_interrupted_run_does_not_satisfy -x` | ❌ Wave 0 |
| GATE-01 (D-05/D-06) | Dialog renders satisfied vs unmet states; gate-status line in SkillEvalSection | component | `npm run test -- PublishGateDialog` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick pytest node for the touched behavior.
- **Per wave merge:** full backend `pytest` + `npm run test` (frontend).
- **Phase gate:** full suite green before `/gsd:verify-work`, then G-4 lived UAT on the actual dialog (block, force-with-evidence, satisfied, unshare-not-gated) — D-10 confirms NOT SC#10-flagged, so no cross-provider matrix; a single-provider lived pass on the dialog is the bar.

### Wave 0 Gaps
- [ ] `backend/tests/test_publish_gate.py` — covers GATE-01 SC#1/2/3 + D-01/D-03/D-04/D-08/D-09 (all API behaviors above)
- [ ] `frontend/src/__tests__/components/PublishGateDialog.test.tsx` — covers D-05 dialog states
- [ ] Shared fixtures: a helper that seeds a completed passing `eval_runs` row + linked `skill_versions` (reuse existing eval test fixtures if present under `backend/tests/`)
- [ ] Framework install: none — pytest + vitest already present.

## Security Domain

*(security_enforcement absent in config → treated as ENABLED.)*

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Handled upstream by `get_current_user`; unchanged. |
| V3 Session Management | no | Unchanged. |
| V4 Access Control | **yes** | Owner-scoping via app-code `.eq("user_id")` on the service-role client (the real gate); `_verify_owned_skill` (`evals.py:106`). Gate + override endpoints must verify ownership BEFORE compute/record. Keep the endpoint-local 403 convention on the skills router (existing `toggle_global` 403 at `skills.py:423`). RLS on `skill_publish_overrides` = owner-only SELECT, no client write policies. |
| V5 Input Validation | **yes** | Never trust the body for `is_global` (D-08 / T-118-02-01 hard-set). `skill_id` from path, `user_id` from auth — never body (evals.py precedent T-133-03). The `override` flag only reaches force-publish AFTER server ownership + gate recompute; it cannot fabricate a passing eval. |
| V6 Cryptography | no | No secrets/crypto introduced (optional content HASH for D-04 is non-security). |

### Known Threat Patterns for FastAPI + supabase-py (service-role)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forges `is_global=true` on create to bypass the gate | Elevation of Privilege | `create_skill` hard-sets `is_global=false`, ignoring the body (D-08). |
| Client sets `override=true` to publish an unproven skill silently | Tampering / Repudiation | Override is allowed (D-01) but the server re-verifies ownership, recomputes the gate, and RECORDS the override (gate snapshot + when) — owner-visible, non-repudiable. |
| Client fabricates a "passing" gate payload in the PATCH | Tampering | Server IGNORES any client gate data; it recomputes from `eval_runs` via the service-role read (D-07). The 409 payload is server→client only. |
| Cross-user reads a skill's gate / override record (IDOR) | Information Disclosure | Every read/write filtered by `.eq("user_id")`; RLS owner-only SELECT as defense-in-depth. Skills router returns 403 on non-owner (endpoint-local convention); eval reads 404. |
| Publish a skill whose passing eval belongs to an OLD version | Tampering (integrity of the "proven" claim) | D-04 content-equality binds the pass to the CURRENT instructions; edits reset the gate. |

## Sources

### Primary (HIGH confidence — verified in this repo)
- `backend/app/api/skills.py` — `create_skill` (:155-187, the D-08 side door at :181), `toggle_global` (:406-439, the gate wrap point + owner-only 403 pattern), import hard-set (:251)
- `backend/app/api/evals.py` — `_verify_owned_skill` (:106), `get_eval_run`/`list_eval_runs` (:379-481), promotion write (:1234-1244), force-promote override idiom (:1825-1908), `_compute_gate`/`promotion_gate` (:1059-1144)
- `backend/app/services/eval_runner_service.py` — the D-03 rollup rule written at finalize (:687-690), completed-only guard (:679-687)
- `backend/app/services/classification_rule_service.py:79` — the T-118-02-01 hard-set precedent for D-08
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — `skill_versions` shape + the capture trigger (:101-144) that mints the near-dup version (D-04 root cause)
- `supabase/migrations/080_eval_runs_and_results.sql` — `eval_runs.skill_version_id` FK (:45), `status` enum, `eval_results` shape
- `supabase/migrations/081_eval_verdict_and_ratings.sql` — `passed_count`/`measured_count`/`verdict_summary` (:64-74) + the "Phase 136 owns the real threshold" contract comment
- `supabase/migrations/083_skill_proposals.sql` — promotion linkage columns (`new_skill_version_id`, `re_eval_run_id`, `override_forced`), append-only/service-role/RLS precedent
- `frontend/src/components/skills/SkillCard.tsx:214-228` — the "Share globally"/"Unshare" Globe action to intercept
- `frontend/src/components/skills/SkillEvalSection.tsx` — the D-06 host surface (already fetches runs/verdicts/proposals; mounted at `SkillFormDialog.tsx:548`)
- `frontend/src/components/ui/alert-dialog.tsx:130-142` — the D-05 dialog primitive + its exports
- `frontend/src/lib/api.ts:1528-1580` — `createSkill`/`toggleSkillGlobal` clients to extend
- `frontend/src/types/index.ts:583-694` — `EvalRun`/`EvalResult`/`SkillProposal`/`SkillCreate` client contracts
- `.planning/config.json` — nyquist_validation=true; security_enforcement absent (enabled)
- `CLAUDE.md` — migration discipline (SQL editor/psycopg2, regen full-schema), `run_in_threadpool` rule, no-LangChain, RLS-on-all-tables

### Secondary (MEDIUM confidence)
- `.planning/phases/134-.../134-CONTEXT.md` (D-07 threshold deferral to 136), `135-CONTEXT.md` (D-06 override idiom, D-12 re-eval runs), `132-CONTEXT.md` (version-snapshot semantics) — via CONTEXT.md canonical refs (not re-read this session; summarized in CONTEXT.md)

### Tertiary (LOW confidence)
- none — no WebSearch was needed; this phase is fully answerable from the codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every library verified in-repo.
- Architecture / gate compute (D-03/D-04): HIGH — rollup rule, promotion trap, and FK are all verified verbatim in code/migrations.
- Enforcement seams (D-07/D-08): HIGH — exact lines identified (`skills.py:181`, `:406-439`).
- Override-record shape (D-01): MEDIUM — Claude's-discretion; a strong recommendation with a named alternative.
- Pitfalls: HIGH — each is grounded in a verified code location.

**Research date:** 2026-07-03
**Valid until:** 2026-08-02 (stable — internal codebase, no fast-moving external deps; re-verify only if Phase 135's promotion path or migration 081's rollup changes)

## Project Constraints (from CLAUDE.md)
- Python backend uses a `venv` virtual environment.
- No LangChain / LangGraph — raw SDK only (N/A here; no LLM calls in this phase).
- Pydantic for structured models (`PublishGate`, toggle body).
- **RLS on every table** — `skill_publish_overrides` (if created) needs owner-only RLS SELECT + no client write policies (service-role writes).
- **Migration discipline:** numbered SQL under `supabase/migrations/` (next = `084_*.sql`, `<digits>_name.sql`, no letter suffix); apply by pasting into the Supabase SQL editor or psycopg2 :54322 — NEVER `supabase db push`/`db reset`; then `bash scripts/regenerate-full-schema.sh` (no `--reset`); commit migration + regenerated `full-schema.sql` together; never hand-edit `full-schema.sql`.
- **No blocking I/O in async handlers** — wrap supabase-py calls in `run_in_threadpool` (D-v2.5-01).
- Settings live in `user_settings`/`app_settings` (N/A — no new setting per D-03).
- Local dev must never break; local↔cloud is an env-var switch (no hardcoded URLs/keys).
- Red line (project D-14 / phase D-10): never touch the agent loop / provider gateway / `threads.py`; Deep Mode byte-identical.
