# SEED-165 — `backend/tests/*.py` is outside every gate, and 54 failures have been rotting there

**Planted:** 2026-08-15, during Phase 193.2's close-out, at the operator's direction
**Surface:** Agentic-RAG — test tooling / CI gates
**Status:** open
**Priority:** high — not because the 54 failures are urgent, but because the *blindness* is unbounded

---

## ⚠ The finding is the blind spot, not the 54 failures

Phase 193.2 fixed one stale test, `backend/tests/test_182_extraction_parity.py`. Fixing it revealed
why nobody had noticed it was red: **the file lives in `backend/tests/`, not `backend/tests/unit/`,
and no gate this project runs looks there.**

- The full-backend gate is `pytest tests/unit -q` — baseline `62 failed / 2221 passed`.
- Every named workflow-suite command in every 193.x plan names files under `tests/unit/`.
- The vitest count gate is frontend-only.
- `tsc -p tsconfig.app.json` is frontend-only.

So `backend/tests/*.py` at the top level is checked by **nothing, ever**. Run for the first time in
this phase:

```
pytest tests/ -q --ignore=tests/unit --ignore=tests/integration
→ 54 failed, 939 passed, 3 skipped
```

**This is the same class of failure this project has now hit four times**, and the pattern is worth
naming rather than re-deriving:

| Instance | What was invisible | For how long |
|---|---|---|
| `WorkflowsPage.tsx` | absent from the `CLAUDE.md` hot-file ledger, so G-5 could never fire on it | 10 phases |
| `WorkflowDoorSwitch.tsx` | same | 6 phases |
| `WorkflowBuilderPage.tsx` | same | 10 phases |
| **`backend/tests/*.py`** | **absent from every gate command** | **unknown — at least since Phase 193.1** |

*A guardrail cannot see what is absent from its list.* Three times that list was the ledger table.
This time it is the gate's own path argument.

---

## What is actually failing (17 files, 54 cases) — measured 2026-08-15 at `f6e853f8`

```
15  test_dual_mode_wiring.py          3  test_agent_loop_catalog_override.py   1  test_knowledge_health.py
 5  test_mdl_verification.py          3  test_096_ci_workflow_regression.py    1  test_harness_gates.py
 5  test_harness_templates.py         2  test_evals_router.py                  1  test_181_flip_on.py
 4  test_skill_proposals_router.py    2  test_182_grounding_bundle.py          1  test_150_cipher.py
 4  test_provider_router.py           2  test_096_askuser_cleanup.py           1  test_098_scope_governance.py
 3  test_eval_runner.py               1  test_thread_workflow_endpoint.py
```

**None is Phase 193.2's**, and that was established read-only rather than asserted (reverting tracked
source to the phase base was attempted and correctly refused as destructive):

- This phase's **entire** non-comment change to `db/workflows.py` is **two `ORDER BY` lines** —
  `git diff c1a6c122..HEAD -- backend/app/db/workflows.py | grep -E "^[+-]" | grep -v "^[+-][+-]" | grep -vE "^[+-]\s*#"`.
- The one failure that *looked* like this phase's — `test_dual_mode_wiring`'s projection mismatch,
  where the real row carries `definition` / `is_mine` / `is_system_global` / `updated_at` and the
  test's fake carries three fields — traces to **`16617567`, Phase 192.1-01**, *"project `updated_at`
  from all four SELECT lists onto both models"*. Re-derive with
  `git log --oneline -S"updated_at" -- backend/app/db/workflows.py`.
- **10 of the 17 files do not reference this phase's changed modules at all**
  (`grep -cE "db\.workflows|models\.harness|publish_service|workflow_authoring"` → 0).

**Three distinct causes, spanning at least three milestones:**

1. **8 cases** — `AttributeError: module 'app.api.threads' does not have the attribute 'insert_run'`.
   A monkeypatch target that no longer exists. The test pins a symbol the source deleted.
2. **5 cases** — `ValueError: get_service_role_supabase requires an explicit org_id`. The v3.4
   org-scoping change (the one-way RLS door); these callers were never updated.
3. **1 case** — the 192.1 projection widening above. Plus assorted single-file rot.

⚠ ~~**`test_182_grounding_bundle.py`'s 2 failures are very likely the SAME defect Phase 193.2 just
fixed in `test_182_extraction_parity.py`** — a golden literal still pinning 193.1's *superseded*
hedged template header (`### Template placeholder fields (if the workflow must fill a template)`),
which D-26 replaced with two assertive arms at `grounding.py:618-632`. **Check that first; it may be
a two-line fix and it is the highest-confidence item in the list.**~~

⚠ **THAT PREDICTION WAS WRONG, AND IT WAS FIXED THE SAME DAY — the correction is stated beside the
guess rather than replacing it, because the way it was wrong is the useful part.** `93a...`/`138568dd`
(2026-08-15) measured the actual cause: **`kb_tools`**. Phase **185-02** (`04d475d4`, GOVERN-01 /
D-185-09) added the field to `GroundingBundle` and projected it at `workflows.py:1014`; the
set-equality at `:132` and the whole-body dict at `:207` are **exact-shape** assertions that predate
it. Nothing to do with 193.1's header.

**The lesson: "same file prefix, same era, therefore same cause" is a guess, and this seed published
it as a near-certainty.** Both suites are named `test_182_*`, both touch grounding, and both went red
in the invisible directory — and they are two unrelated defects, **eight phases apart**. Treat every
remaining item in the table above as un-diagnosed until it is *run*, not until it is *recognised*.

**What the fix did, since it is the template for the rest:** the shape assertions were widened AND
the projection pin was made stronger than the failure required. The faked bundle now carries a
**distinctive** `kb_tools` rather than the `[]` default, because the field's own docblock says it
rides the bundle so the route *"serializes a field rather than reaching for the constant itself"* —
and a route that inlined `KB_TOOLS_SORTED` would pass against **both** the default and the real
value. Driven RED against exactly that plant, restored to an empty `numstat`. The healthy-path case
additionally pins the wire field against the constant, so widening `KB_TOOLS` without widening the
wire now fails there rather than in review.

**Two of the 54 are therefore closed. 52 remain, and the blindness that hid them is untouched** —
which is still what this seed is for.

---

## Why this was NOT fixed in Phase 193.2

54 failures across 17 files spanning three milestones' debt is **a phase, not a close-out task**.
Repairing it inside 193.2's close-out would be precisely the *"a closure round may NEVER introduce a
new user-facing capability / smuggle in unrelated work"* pattern **G-7** exists to stop — and 193.2
ran **zero** gap-closure rounds, which is a property worth keeping.

The operator was told the count, the causes and the recommendation, and chose to seed rather than
absorb. **That is recorded as a decision, not as an oversight.**

---

## The fix is a gate-scope decision, not 54 repairs

Repairing all 54 without widening the gate leaves the blindness intact and the next rot equally
invisible. **Do these in order:**

1. **Widen the backend gate** to cover `backend/tests/` and record a NEW measured baseline the way
   `tests/unit`'s `62 failed / 2221 passed` is recorded today. ⚠ **The baseline must be captured
   BEFORE any repair**, or there is nothing to judge the repairs against — the 193.2 wave-1 lesson.
2. **Triage the three causes**, cheapest first: the `test_182_grounding_bundle` staleness (likely 2
   lines), then the 8 `insert_run` monkeypatches (one dead symbol), then the 5 org-scoping callers.
3. **Only then repair**, and drive each fix RED before trusting its green — Phase 193.2 found **six**
   fences that were green while defending nothing, and the `test_182_extraction_parity` fix itself
   was driven RED against a planted one-word reword precisely because *a fixed literal and a loosened
   pin look identical from the outside*.
4. ⚠ **Do not fold `tests/integration/` in blind.** It is `--ignore`d here for a reason: Phase
   193.2's own `test_193_2_authoring_frequency.py` lives there and makes **real, paid provider
   calls**, gated behind an opt-in env var. A gate that runs it by default would spend money on every
   CI run. Widen to `tests/` top level first; treat `integration/` as a separate decision.

---

## Re-open trigger

**Any of the following fires this seed:**

- A phase's `files_modified` names any file under `backend/tests/` outside `unit/` and
  `integration/` — that phase inherits this measurement rather than re-deriving it.
- Any phase that changes `grounding.py`'s template section, `db/workflows.py`'s SELECT projection,
  or `app/api/threads.py`'s module-level symbols — all three already have stale pins here.
- Any work on CI gate configuration or `scripts/` gate tooling.
- The next milestone's planning sweep, whichever comes first.

## Related

- `SEED-056` — the frontend vitest rot set (the same disease on the other side of the stack; its
  62/2221 backend analog IS the recorded baseline this seed wants for the top level)
- `SEED-164` — the deferral that evaporated because nothing owned it; this seed exists so the same
  thing does not happen to 54 measured failures
- `.planning/phases/193.2-from-authored-to-runnable/193.2-REVIEW.md` — the review pass that led here
- Phase 192.1 (`16617567`) — the projection change behind one failure
- Phase 193.1 D-26 (`grounding.py:618-632`) — the header change behind at least two, probably three
