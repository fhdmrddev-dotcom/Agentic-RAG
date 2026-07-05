---
seed_id: SEED-102
title: Any user can silently shadow the built-in skill-creator by name collision (general case, not just the one known dev account)
status: closed
planted: 2026-07-05
closed: 2026-07-05
closed_by: "quick task 260705-hz1 (candidate fix #1 — tie-break reversal), commit 244668f0 on develop"
phase_origin: "Code review of Phase 137.2 (137.2-REVIEW.md, WR-02) — found while verifying the 'Protected' half of CREATE-01/SEED-101"
category: security-hardening — skill resolution / built-in protection
related_seeds:
  - SEED-101-skill-creator-native-builtin-protected (the phase that shipped the built-in this gap applies to)
related_memories: []
priority: medium
---

## Resolution (2026-07-05)

Closed via `/gsd:quick --validate` (task `260705-hz1`), implementing candidate fix #1 from
this seed: `_handle_load_skill` (`backend/app/services/tool_dispatcher.py`) now orders
`.order("is_system", desc=True).order("is_global", desc=True)` instead of the old
ascending `.order("is_global")` — precedence **system > global > owned** on a name
collision. A new regression test (`backend/tests/test_load_skill_collision.py`) proves
resolution picks the `is_system` built-in over a same-named owned row, using a
sorting-capable fake (not the passthrough fake elsewhere in the test suite, which would
have been a false-green). `create_skill`/`save_skill`/`import_skill` and every other
`.or_(...)` skill query were left untouched — candidate fix #2 (a name-collision guard on
write) remains a separate, not-yet-needed option if this tie-break ever proves
insufficient.

**Verification chain:** planned by `gsd-planner`, checked twice by `gsd-plan-checker`
(0 blockers both passes; the plan-checker independently hand-simulated the sorting logic
and confirmed it goes RED pre-fix / GREEN post-fix), executed by `gsd-executor` in an
isolated worktree (19/19 tests green, plus an explicit RED-check: temporarily reverting
the fix made the new test fail as expected, then restored). The orchestrator hit a
tool-availability outage preventing `git merge`/`git cherry-pick` of the worktree branch
— the fix was instead copied byte-for-byte (diffed to confirm) into the main tree and
committed directly as `244668f0`. **Independently re-confirmed 2026-07-05** once the
outage cleared: `pytest tests/test_load_skill_collision.py tests/test_load_skill_override.py
tests/integration/test_skills.py -q` → **19 passed**; `git show 244668f0 --stat` confirms
only `tool_dispatcher.py` (+6/-2) and the new test file were touched. Fully closed, no
outstanding verification gap.

# SEED-102 — skill-creator name collision: only one known instance was fixed, not the general case

## The finding (2026-07-05, code review of Phase 137.2)

Phase 137.2 (CREATE-01) shipped a protected, `is_system=true` built-in skill named
`skill-creator` (migration 087). The phase's own `137.2-RESEARCH.md` names a real risk
as **Pitfall 3**: `tool_dispatcher.py`'s `_handle_load_skill` resolves a skill by name
with:

```python
.or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
.eq("name", skill_name)
.eq("is_enabled", True)
.order("is_global")   # ascending: False (owned) sorts before True (global) on a tie
```

then takes `skill_row[0]` — **on a name collision, the owned row always wins over the
global built-in.** Plan 137.2-04 fixed the ONE known instance (the dev/test account's
private manual copy) via a scoped one-off `UPDATE` rename. That fix is explicitly
narrow — the plan text says "targets one specific dev user's private row that exists
on no other environment."

**What's still open:** nothing in `create_skill`, `_handle_save_skill` (the agent's
own `save_skill` tool), or `import_skill` rejects or dedupes a name that collides with
an existing `is_system=true` skill, and `_handle_load_skill`'s tie-break is untouched.
Any user — today or in the future, via the Create-Skill dialog, the agent's own
`save_skill` tool, or an imported ZIP whose `SKILL.md` frontmatter says
`name: skill-creator` — can silently shadow the built-in for their own sessions: the
Skills **list** still correctly shows the pinned "Built-in" badge, but the agent's
`load_skill("skill-creator")` call at **runtime** will silently execute the user's own,
unvetted, non-`is_system` content instead.

**Blast radius is self-contained** (a user can only shadow the built-in for
themselves, not for other accounts) — this is why it shipped as a code-review Warning,
not a Blocker, and did not block Phase 137.2 completion.

## Two candidate fixes (either closes the general case)

1. **Reverse the tie-break** in `_handle_load_skill` (`tool_dispatcher.py:665-677`) so
   an `is_system`/global row wins over an owned row on a name collision:
   `.order("is_system", desc=True).order("is_global", desc=True)` before taking the
   first row.
2. **Reject or auto-suffix** a create/save/import name that collides with an existing
   `is_system=true` skill's name — mirrors the empty-name guard already added in
   Phase 123 (`skills.py:174-175`).

Either fix touches `tool_dispatcher.py` and/or `skills.py` — files outside Phase
137.2's declared scope, and the narrow one-off fix was a deliberate, documented choice
(CONTEXT.md D-04), not an oversight. That's why this is a planted seed rather than an
in-flight scope expansion.

## Re-open trigger

- A user reports `load_skill("skill-creator")` (or any future `is_system` skill's
  name) silently running unexpected/wrong content — likely because they created,
  saved via the agent, or imported a skill with a colliding name.
- Any future phase that adds more `is_system` built-ins (raising the number of
  collision-prone names) should re-evaluate this before shipping.
- A milestone-level pass on skill-catalog integrity / trust boundaries.
