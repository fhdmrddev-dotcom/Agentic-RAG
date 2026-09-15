---
seed_id: SEED-165
title: >
  `backend/tests/*.py` is outside every gate, and 54 failures have been rotting there
status: planted
status_note: |
  Phase 251 frontmatter migration: this file had NO frontmatter block at all, so no status was
  ever recorded for it. `planted` here is a MIGRATION DEFAULT — it is a statement about the
  absence, never a claim about the seed. Read the body and set it deliberately.
surface: Agentic-RAG
trigger_when: unset
---
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

## TRIAGE PASS — read-only, 2026-08-15, at the operator's direction

**Nothing was fixed in this pass and no test was edited.** The question it answers is the one that
makes mass-repair dangerous: **which of these are stale tests, and which are red because they are
telling the truth about a real defect?** Converting a truthful red to green erases the only evidence
that a regression exists — so every class below was traced to a *cause in the source*, not matched on
its error text.

**Verdict: 34 of 52 are VERIFIED STALE with a named cause. 18 are UNDIAGNOSED and must not be
touched until someone runs them.** No confirmed production defect was found — but *"none found in
the 34 I traced"* is not *"none exist in the 18 I did not."*

### Verified stale — cause traced to a deliberate source change

| # | Cluster | Cause, measured | Confidence |
|---|---|---|---|
| **8** | `test_dual_mode_wiring` monkeypatching `app.api.threads.insert_run` | **Phase 145-03 (`e033902c`)** routed the chat-run lifecycle through a `run_lifecycle` owner; `a7b64365` then removed the dead import. `threads.py:864-867` still carries the comment *"atomic co-write via the run_lifecycle owner (was: an insert_run here…)"*. `insert_run` is alive in `app/db/runs.py` and used by `evals.py` + `runs.py`. **The seam was relocated by an intentional refactor; the function did not vanish.** | **high** |
| **6** | `ValueError: get_service_role_supabase requires an explicit org_id` (`test_dual_mode_wiring` ×5, `test_098_scope_governance` ×1) | The **v3.4 one-way RLS door**. Production callers pass `org_id`; these test call sites were never updated. | **high** |
| **~8** | `403 "This feature is available to administrators only"` (`test_skill_proposals_router` ×4, `test_evals_router` ×2, `test_eval_runner` ×2) | **Phase 148-02 (`b6e419a1`)**, the `require_visible` factory. `feature_audience()` falls back to **safe-deny `"operators"`** on a cold cache / unknown feature (`user_settings.py:1257`), and the test env seeds no audience rows and no operator. ⚠ **The deny is FAIL-CLOSED BY DESIGN**, and `dependencies.py:535-540` explicitly carves out the Run/chat paths (`GET /settings/providers`, `/workflows/published\|starters`, the launch) so the gate cannot reach them. Not an access regression. | **high** |
| **9** | Model-default pins (`test_mdl_verification` ×5, `test_provider_router` ×4) — *expected `gpt-4.1-nano`, got `gpt-5.4-mini`*; *expected `gemini-2.5-flash`, got `gemini-3.5-flash`*; a provider-key set missing `minimax`/`moonshot` | `MODEL_CAPABILITIES` moved on under the project's **newest-models-first** rule. ⚠ **These tests are stale by construction, not by accident: they pin a specific model id, so they red on every registry refresh.** Repairing them by bumping the literal buys ~one milestone. Re-derive from the registry instead, exactly as the UAT roster rule requires. | **high** |
| **1** | `test_150_cipher::test_secret_columns_matches_main_allowlist` | ⚠ **Stale in the SAFE direction, and that distinction is the whole reason this one was checked first.** Production's `SECRET_COLUMNS` has an **extra** member — `supabase_management_token` — that the test's expected frozenset lacks. A new secret column was added and correctly enrolled in the encryption allowlist; only the pin lagged. **The dangerous direction would be production missing a column the test expects — a secret shipping unencrypted. That is NOT what happened.** | **high** |
| **1** | `test_dual_mode_wiring::test_published_workflows_list_endpoint` | **Phase 192.1-01 (`16617567`)** projected `updated_at` onto both models; the test's fake row carries three fields and the real row carries seven. | **high** |

### ⚠ UNDIAGNOSED — 18 cases, and they are the ones that matter

**These were NOT traced to a cause. Do not assume they are stale.** Each row names the first question
to ask, so the follow-up phase starts with an investigation rather than a guess.

| # | Cluster | First question |
|---|---|---|
| **5** | `test_harness_templates` — `KeyError: 'tool_call_id'` on `r["tool_call_id"]` | Production **still emits** `tool_call_id` (`phase_types.py:740, 775`). So which row is the test reading, and did its shape change — or is a row genuinely being written without the key on some path? |
| **3** | `test_096_ci_workflow_regression` — *"draft/review/execute: no completed UPDATE"* | Are phase-status `completed` writes still happening and the test's capture is stale, or did a status write stop landing? **This is the shape a real regression takes.** |
| **3** | `test_agent_loop_catalog_override` — *"exactly one self-heal kick"*, *"the kick was attempted"*, *"match_skills must be called once"* | Behavioural counts, not shape. Did the prefilter's self-heal path change deliberately? |
| **2** | `test_096_askuser_cleanup` — *"cancel escape must still expire the pending prompt"* | Does cancelling mid-phase still expire the prompt? If not, that is a **live defect on the ask_user path**, and `SEED-164` is adjacent. |
| **1** | `test_harness_gates` — *"expected 2 verify attempts, got 0"* | Bounded retry reaching `failed` after 3 attempts. **Zero attempts where two are expected is not a shape mismatch.** |
| **1** | `test_181_flip_on` — canvas ping 200 after flip-on | Feature-flag path; may be class-D gating, may not. |
| **1** | `test_knowledge_health` — never-retrieved excludes retrieved docs | |
| **1** | `test_thread_workflow_endpoint` — state shape | Likely a projection widening like the 192.1 one, but unverified. |
| **1** | `test_dual_mode_wiring` — a source-string assertion about the DELETE route's terminal-status tuple | A prose/source pin; check whether the tuple moved or the pin's scope is wrong. |

**The three to look at first, by risk rather than by count:** the `096_ci_workflow_regression`
missing-`completed`-UPDATE cluster, the `askuser_cleanup` non-expiring prompt, and
`harness_gates`' zero-of-two verify attempts. All three describe *behaviour that stopped happening*,
which is what a real regression looks like from the outside — unlike every verified-stale class
above, which describes a shape or a seam that moved.

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
