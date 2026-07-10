---
quick_id: 260705-hz1
slug: fix-seed-102-reverse-the-name-collision-tie-break
type: quick
completed: 2026-07-05
code_commits:
  - 03a3f7b522cba43b188039287c87d15a6b9e4a24  # fix — resolver tie-break reversal
  - 671015855d31fc43d68058f182a95b255ca36ed0  # test — collision regression guard
files_modified:
  - backend/app/services/tool_dispatcher.py
  - backend/tests/test_load_skill_collision.py
requirements: [SEED-102]
test_result: "19 passed (collision 1 + override 2 + integration test_skills 16) — backend venv"
---

# Quick 260705-hz1: Fix SEED-102 — reverse the load_skill name-collision tie-break

## One-liner

`_handle_load_skill` now orders the same-name candidate rows
`.order("is_system", desc=True).order("is_global", desc=True)` (precedence
**system > global > owned**) before taking `skill_row[0]`, so a protected `is_system`
built-in can no longer be silently shadowed by a user-owned row of the same name —
closing SEED-102 (candidate fix #1, the tie-break reversal).

## Root cause (SEED-102)

The resolver in `_handle_load_skill` fetched every enabled row the user can see for the
given name (`.or_(user_id.eq.<me>, is_global.eq.true)`) and disambiguated a name
collision with a single `.order("is_global")` — **ascending**. Ascending sorts
`is_global = False` (an owned row) ahead of `is_global = True` (a global/built-in row),
so `skill_row[0]` picked the **owned** row. A user who owns a skill named identically to
a protected built-in (e.g. `skill-creator`, seeded by migration 087) would have the
agent execute their own unvetted instructions instead of the vetted built-in — for their
own sessions. Any of the three write paths (Create-Skill dialog, the agent's `save_skill`
tool, or an imported ZIP with a colliding `name:`) can plant the shadowing row.

Blast radius was already self-contained (RLS means a user can only shadow the built-in
for themselves — no cross-user reach), but it broke the trust boundary that a protected
built-in is not overridable.

## Code change — `backend/app/services/tool_dispatcher.py`

Two lines inside `_handle_load_skill` (net +4 / −2): the disambiguation `.order(...)` and
the now-refreshed resolver comment. Nothing else in the file — and specifically NOT
`create_skill` / `_handle_save_skill` / `import_skill`, nor the other `.or_(...)`
save/lint queries (lines ~749/857/869/963/975) — was touched.

```python
    # Resolve skill -- on a name collision the most-authoritative row wins:
    # system > global > owned (SEED-102). is_system DESC pins a protected built-in
    # above any same-named owned row; is_global DESC is the secondary tie-break.
    _skill_resp = await aexec(
        ctx.supabase.table("skills")
        .select("id, name, description, instructions, user_id")
        .or_(f"user_id.eq.{ctx.current_user['id']},is_global.eq.true")
        .eq("name", skill_name)
        .eq("is_enabled", True)
        .order("is_system", desc=True).order("is_global", desc=True)   # was: .order("is_global")
    )
```

Chained multi-column ordering is already the idiomatic pattern for this table
(`backend/app/api/skills.py:151` — `.order("is_system", desc=True).order("name")` pins the
built-in to the top of the list endpoint). The `.select(...)` list is unchanged —
PostgREST orders by the named columns regardless of what is selected.

## Test change — `backend/tests/test_load_skill_collision.py` (new, 153 lines)

A genuine regression guard for the built-in-wins collision, mirroring
`test_load_skill_override.py`'s direct-`ToolContext` scaffolding (`emit=AsyncMock`,
`spawn=lambda c: c.close()`, `skill_instructions_override=None`, `@pytest.mark.asyncio`,
`skill_files` returns `[]`).

The load-bearing difference is the **supabase fake**. The override test's fake is a
PASSTHROUGH — `.order()` is a no-op and `.execute()` returns the seeded rows verbatim, so
a collision test using it would prove nothing (it returns `row[0]` in seed order
regardless of the code's ordering — false-green). The new `_SortingQuery` fake instead:

- **records** every `.order(col, desc=...)` call, and
- on `.execute()` applies them as a stable multi-key sort — recorded keys applied in
  reversed order so the first `.order()` is the primary key, `reverse=desc`, booleans
  sorting True-high when `desc=True` — mimicking SQL `ORDER BY col1 <dir1>, col2 <dir2>`.

A fresh builder is returned per `.table()` call so orders don't leak between the skills
and skill_files queries. The skills table is seeded with two `skill-creator` rows in
**adversarial (owned-first)** order — an OWNED row (`is_system=False, is_global=False`,
`"OWNED BODY"`) then the BUILT-IN (`is_system=True, is_global=True`, `"SYSTEM BODY"`) —
and the test asserts `payload["instructions"] == "SYSTEM BODY"`.

## Verification

```
cd backend && venv/Scripts/python.exe -m pytest \
  tests/test_load_skill_collision.py tests/test_load_skill_override.py \
  tests/integration/test_skills.py -q
→ 19 passed, 3 warnings
```

- New collision test GREEN against the fixed resolver ✓
- `grep -c '.order("is_system", desc=True).order("is_global", desc=True)'` = 1; no
  standalone `.order("is_global")` remains anywhere in the file ✓
- **RED-check performed** — temporarily reverting the order line back to
  `.order("is_global")` made the collision test FAIL with `assert 'OWNED BODY' ==
  'SYSTEM BODY'`, then it was restored (git confirms `tool_dispatcher.py` matches its
  committed state). This proves the sorting fake genuinely orders and the test is a true
  regression guard, not a false-green.
- No regression: `test_load_skill_override.py` (2) + `tests/integration/test_skills.py`
  (16) stay green ✓
- Scope containment: `git diff <base>..HEAD --stat` lists exactly
  `backend/app/services/tool_dispatcher.py` (+4/−2) and
  `backend/tests/test_load_skill_collision.py` (new) ✓

## Threat model outcome

Both `mitigate` threats in the plan register are closed by the single resolver change:
T-SEED102-01 (spoofing/tampering — owned row shadowing the built-in) and T-SEED102-02
(EoP — agent executing unvetted owned instructions). `is_system` precedence guarantees
`load_skill("skill-creator")` runs the vetted built-in body. T-SEED102-SC (supply-chain)
was `accept` — no new dependencies; this is a pure resolver + test change.

## Deviations

None. Both plan tasks executed exactly as written. No auto-fixes, no architectural
changes, no authentication gates.

## Known stubs

None.

## Self-Check: PASSED

- `backend/app/services/tool_dispatcher.py` — FOUND (contains the two-key
  `is_system`/`is_global` order; standalone `is_global` order gone)
- `backend/tests/test_load_skill_collision.py` — FOUND (1/1 green; asserts SYSTEM BODY)
- commit `03a3f7b522cba43b188039287c87d15a6b9e4a24` (fix) — FOUND on `worktree-agent-ae4e28f731a794ebc`
- commit `671015855d31fc43d68058f182a95b255ca36ed0` (test) — FOUND on `worktree-agent-ae4e28f731a794ebc`
