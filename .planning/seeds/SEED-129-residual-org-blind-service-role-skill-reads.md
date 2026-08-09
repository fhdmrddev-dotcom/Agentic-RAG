---
seed_id: SEED-129
title: Three residual org-blind service-role skill reads survived the SEED-125 sweep (tuner auto-seed, harness skill_snapshot, agent_loop catalog)
status: open
planted: 2026-07-25
phase_origin: "Phase 182 code review + fix (182-REVIEW.md CR-01). While closing the grounding-registry leak, the one-copy grep for the org-gated predicate surfaced three MORE call sites still carrying the pre-SEED-125 flat filter `.or_(f\"user_id.eq.{user_id},is_org_shared.eq.true\")` with no org_id term. SEED-125's fix covered the six tool_dispatcher.py sites only — these three were never in its scope."
folded_into: null
category: security / tenancy-isolation — the residual tail of SEED-125. Same defect class, same predicate, different call sites: none of them is a tool_dispatcher site, so the 2026-07-22 sweep never touched them.
related_seeds: [SEED-125, SEED-124, SEED-091]
related_decisions:
  - "SEED-125 CLOSED 2026-07-22 by org-gating six `tool_dispatcher.py` sites through one shared helper. Its closure note scopes the fix to `tool_dispatcher` — it does NOT claim repo-wide coverage, so this is a scope gap, not a regression of that fix."
  - "Phase 182 CR-01 fix promoted the org-gated predicate out of `tool_dispatcher` into a new import-light shared home, `backend/app/utils/skill_visibility.py` (`build_skill_visibility_or` + `skill_row_visible`), and re-pointed every existing caller. Closing these three sites is now a small mechanical change against that one helper — the hard part (a cycle-free shared home) is already done."
  - "D-165-01 / mig 111 semantic split — `skills.is_org_shared` is a genuine user org-share toggle; `is_system` is the platform-universal allow-list. The org-gated branch (owner OR is_org_shared) is what must be org-scoped; these three sites apply neither."
confirmed:
  - "backend/app/services/skill_tuner_service.py:491 — CONFIRMED leaky. Its own docstring states `get_supabase()` is the SERVICE-ROLE client (RLS bypassed) — this app-code `.or_(...)` scoping is the SOLE leak gate, and the predicate has no org term. Trigger-tuner auto-seed can therefore draw bait skills (id, name, description) from a disjoint org."
needs_confirmation:
  - "backend/app/services/harness/skill_snapshot.py:72 (`_resolve_skill_query`) — identical flat predicate. The client is passed in by callers (lines 116, 184); confirm whether it is the service-role or a user-JWT client before assigning severity. If service-role, a cross-org `skill_ref` resolves and its INSTRUCTIONS are snapshotted into a harness run."
  - "backend/app/services/agent_loop.py:1284 (Deep-Mode skill catalog, `skill_catalog_override is None` branch) — identical flat predicate on `ctx.supabase`. SEED-125 established that `ctx.supabase` on the producer path IS the service-role BYPASSRLS client, which would make this leaky by the same argument, but the provenance was not traced end-to-end during Phase 182 and must be confirmed rather than assumed."
not_affected:
  - "backend/app/api/skills.py — runs on the per-request user-JWT client, so membership RLS supplies the org gate (mig 107/108). No app-layer predicate needed."
re_open_triggers:
  - "Any pen-test or security audit exercises the Trigger Tuner auto-seed, a harness workflow run that resolves a skill by `skill_ref`, or Deep-Mode skill-catalog assembly across two orgs and observes a foreign org's skill id/name/description/instructions."
  - "A user in org B runs the Trigger Tuner and sees a bait skill named by a disjoint org A (reproduces today with the personal-org backfill from mig 105)."
  - "Any future phase touches `skill_tuner_service.py`, `harness/skill_snapshot.py`, or the `agent_loop.py` skill-catalog block — org-gate the read in that same commit rather than planting another sibling."
  - "A `grep -rn 'or_(f\"user_id.eq.' backend/app/services --include=*.py` returns a hit that runs on a service-role client and is not routed through `app/utils/skill_visibility.py`. NOTE: the bare repo-wide grep returns ~10 hits and most are LEGITIMATE — `app/api/*` sites run on the per-request user-JWT client where membership RLS supplies the org gate. The invariant is 'no org-blind predicate on a SERVICE-ROLE client', not 'no occurrences of this predicate'."
priority: high
suggested_phase: "Dedicated security /gsd:quick (mirrors the SEED-125 pattern, now much cheaper — reuse `app.utils.skill_visibility`). Should land before any phase widens org membership or ships the Trigger Tuner / harness runs to a multi-member org."
---

# SEED-129 — Residual org-blind service-role skill reads (the SEED-125 tail)

## The gap

SEED-125 closed the cross-org skill leak on the agent's **tool** surface by org-gating six
`tool_dispatcher.py` sites behind one shared helper. That sweep was scoped to `tool_dispatcher`.
Three call sites elsewhere still carry the original pre-fix predicate verbatim:

```python
.or_(f"user_id.eq.{user_id},is_org_shared.eq.true")   # no org_id term
```

On a service-role (BYPASSRLS) client this predicate **is** the only tenancy gate, so the
`is_org_shared` branch matches every org's shared skills, not just the caller's.

| Site | What leaks | Status |
|---|---|---|
| `skill_tuner_service.py:491` | skill `id, name, description` used as Trigger-Tuner bait | **Confirmed** — docstring self-declares the service-role client and "SOLE leak gate" |
| `harness/skill_snapshot.py:72` | full skill row incl. `instructions`, snapshotted into a run | Needs client-provenance confirmation |
| `agent_loop.py:1284` | Deep-Mode skill catalog `id, name, description` | Needs client-provenance confirmation |

`app/api/skills.py` is **not** affected — it runs on the user-JWT client, where membership RLS
(mig 107/108) supplies the org gate.

## Why it is cheap to close now

Phase 182's CR-01 fix already solved the hard part: the org-gated predicate now lives in a
cycle-free, import-light shared home at `backend/app/utils/skill_visibility.py`, exposing both
the query-side `build_skill_visibility_or(user_id, org_ids)` and the Python-side
`skill_row_visible(row, user_id, org_ids)`. `tool_dispatcher`'s six sites, plus the new grounding
registry, already route through it. Closing these three means resolving the caller's org set at
each site and swapping the predicate — no new design work.

Note the blocking-I/O constraint that shaped the Phase 182 fix: where the read is a plain `def`
invoked via `run_in_threadpool`, resolve the org set in the **async caller** and thread it in
rather than making the sync function await (D-v2.5-01).

## How we would know this is closed

1. Every **service-role** skill read routes through `app/utils/skill_visibility.py`. Do not use a
   bare repo-wide grep as the gate: `grep -rn 'or_(f"user_id.eq.' backend/app --include=*.py`
   returns ~10 hits and most are legitimate `app/api/*` sites on the user-JWT client, where
   membership RLS is the gate. A closing phase must classify each hit by **client provenance**
   (service-role vs user-JWT) and gate only the former. Worth checking in the same pass:
   `classification_matcher.py:270` carries the same predicate on the service side and was not
   assessed during Phase 182.
2. A two-org live leg per site: org B exercises the Trigger Tuner auto-seed, a harness run
   resolving a `skill_ref`, and Deep-Mode catalog assembly, and sees **zero** of org A's
   `is_org_shared` skills — while `is_system` built-ins still resolve cross-org (the legitimate
   universal escape must survive).
3. A falsification-tested regression test per site: it must FAIL against the flat predicate before
   being trusted (the discipline that caught the real defect in Phase 182).
