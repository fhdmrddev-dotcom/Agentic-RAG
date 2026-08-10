---
phase: 189-governed-external-action-node-model
fixed_at: 2026-08-07T00:00:00Z
review_path: .planning/phases/189-governed-external-action-node-model/189-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 189: Code Review Fix Report

**Fixed at:** 2026-08-07
**Source review:** `.planning/phases/189-governed-external-action-node-model/189-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope (`critical_warning`): **8** — CR-01, CR-02, WR-01…WR-06
- Fixed: **8**
- Skipped: **0**
- Info findings (IN-01…IN-06): **not in scope**, untouched — see *Out of scope* below

Every behavioural fix carries a test that was **observed RED against the unfixed tree** and
green after. The received values are quoted, not paraphrased. Two findings were fixed
differently from the review's suggestion, and both departures are argued rather than silent
(WR-04, WR-06).

---

## Verification baselines

Measured **before** any edit, and re-measured after. Nothing below is inherited.

| Gate | Before | After | Verdict |
|---|---|---|---|
| `tsc --noEmit -p tsconfig.app.json` | 33 errors | **33** | unmoved |
| `vitest-count-gate.cjs` | — | **OK**, 47/47 pinned, 0 failing, 2640 total (+13) | no per-file decrease |
| `pytest tests/unit` | 62 failed / 1749 passed | **62 failed / 1752 passed** | 62 is the documented pre-existing baseline, unmoved |
| 189-scope pytest (10 files) | 2 failed | **2 failed / 220 passed** | same two pre-existing `test_182_grounding_bundle` DB-pool failures |
| `eslint` PhaseCard / PhaseTimeline | 3 / 4 findings | **3 / 4** | unmoved (see WR-05) |

**Pre-existing failures confirmed as pre-existing, by running them with my work stashed:**
`test_182_grounding_bundle.py` ×2 (asyncpg *pool is closing*), `src/lib/api.test.ts`
(`downloadWorkspaceFile` URL), `src/lib/model-info.test.ts` (`costTier`). None is touched by
this round.

**The count gate reported `failed 0`** — IN-06's concern (a red `failed` column on a clean
tree) did not reproduce in any of the runs here.

---

## Fixed Issues

### CR-01: An unarmed `llm_agent` step can whitelist an external capability and publish clean

**Files modified:** `backend/app/services/harness/grounding.py`,
`backend/tests/unit/test_103_grounding_fidelity.py`
**Commit:** `b6225aec`

The D-20 widening was unconditional and `_unregistered_tools` carried no `phase_type` term, so
a definition arriving via `POST /workflows`, the draft PATCH or the NL generator as
`{"phase_type": "llm_agent", "available_tools": ["send_email"]}` parsed, passed stage 2.6 and
published — on a step with `action_risk_armed: false` and no D-04 checkpoint. The boundary was
enforced by a UI option list while three prose blocks asserted the server enforced it.

**What changed:** the *widening* became conditional; the *rule* did not. `tool_names` stays the
wide fidelity set, so `GroundingBundle.tool_names`' documented contract and its matched-pair
fences (`test_the_fidelity_membership_set_contains_the_capabilities`, and V22 in
`test_182_grounding_bundle.py`) are untouched. The narrowing happens at `_unregistered_tools`,
the one membership site both presentations share — subtract-then-conditionally-add, so the
answer does not depend on what the caller passed.

**Why this is not the `phase_type` exemption the design rejected:** nothing is let *through* by
the type test. Rule 2 fires on every name it ever fired on, and now fires on three MORE names
for six of the seven types; the strictly narrower set is the default. It costs
`external_action` nothing, because `ExternalActionPhaseConfig`'s D-03 validator replaces
`available_tools` with `[capability]` and `capability` is a `Literal` over the same closed set —
so on that type the list is always exactly one admissible member and rule 2 can never flag it.
D-06 stays true by construction.

**Test movement.** The re-pointed case and the new control are the load-bearing part:

- `test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding` drove
  an **`llm_agent`** fixture and asserted zero findings — the design's own test certifying the
  wire-around as safe. Re-pointed at `external_action` (one phase per capability, forced by the
  single-valued `Literal`), which is the shape D-06 actually needs. **The assertion is
  unchanged and still on the SET**; only the shape under test was corrected.
- `test_a_capability_on_an_llm_agent_step_still_blocks_publish` is new — the missing negative
  control. **Observed RED against the unfixed source**, and green after.
- `test_a_shipped_tool_is_still_accepted_alongside_a_capability` had a docstring claiming it
  drove "an external_action workflow beside an llm_agent step" while actually driving the
  wire-around itself. It now drives that shape for real and asserts the mixed workflow is clean
  end to end.

The false safety claims in `grounding.py`'s two-set block are corrected in place, with the
wrong paragraph quoted rather than deleted.

---

### CR-02: A `recorded_not_sent` phase renders and announces as "Complete" on the live surface

**Files modified:** `backend/app/services/harness_engine.py`,
`backend/tests/test_harness_engine.py`, `frontend/src/lib/api.ts`,
`frontend/src/providers/StreamsProvider.tsx`,
`frontend/src/providers/__tests__/phaseHooks.test.tsx`,
`.planning/phases/189-governed-external-action-node-model/deferred-items.md`
**Commit:** `11a2fa69`

Emitting nothing did not leave the card unresolved — it left it `running`, and both store
sweeps act on exactly `{running, retrying}`. `finalizeEarlierPhasesForThread` (fired from the
**next** phase's `onPhaseStarted`) repainted it "✓ Complete" **mid-run, within milliseconds**;
`finalizeAllPhasesForThread` caught the last-phase case.

**What changed:** an additive `phase_recorded_not_sent` SSE, its `api.ts` wire branch, and the
`onPhaseRecordedNotSent` handler mapping to `"recorded-not-sent"` — the shipped `phase_failed`
precedent. **Two client files, not the three the deferred item predicted:** no sweep exclusion
was needed, because both sweeps already skip every terminal. No new `harness_audit` kind, so
D-09 and the *consequence is not receipt* argument are untouched; wire-only, and inert for an
older client (`api.ts` dispatches on an else-if chain).

**Falsified end to end, not per-seam.** `phaseHooks.test.tsx` drives raw SSE bytes → the REAL
`subscribeToRun` → the REAL `makeStreamCallbacks` handler → the REAL provider action bodies →
the store, over a two-step run in which **both sweeps fire**. Against the unfixed client:

```
AssertionError: CR-02: the live surface painted the recorded step Complete. …
expected 'done' not to be 'done'
```

**Received value: `'done'`** — the defect exactly as described. The producer half is fenced
separately in `test_harness_engine.py`, whose RED output documents the whole gap:

```
phase_recorded_not_sent frames=[], all emits=['phase_started', 'action_risk_pending',
'phase_transition', 'phase_started', 'phase_completed', 'delta', 'run_completed']
```

**`D-189-DEF-03` is closed**, with two of its own claims corrected on measurement rather than
overwritten: it named ONE sweep when there are two, and called this *"a latency-of-honesty gap,
not a persistent lie"* — false for the whole live session.

---

### WR-01: Migration 115's DROP+ADD is neither atomic nor idempotent

**Files modified:** `supabase/migrations/115_workflow_phases_recorded_not_sent.sql`
**Commit:** `b279b62f`

Wrapped in `BEGIN`/`COMMIT` and the DROP given `IF EXISTS`. Both are established house style —
migrations 108–113 (the six immediately preceding) all wrap in a transaction, and 048 / 063 are
the shipped CHECK-widening precedents using `IF EXISTS`.

> ### ⚠ OPERATOR: NOTHING TO PASTE. NO SCHEMA CHANGE. NO REGENERATION OWED.
>
> Migration 115 is **already applied to the live local DB**, and the block now produces
> *exactly* the constraint the bare pair produced — same six literals, same `= ANY (ARRAY[…])`
> form. **You do not need to re-paste anything**, `supabase/full-schema.sql` is unaffected, and
> `scripts/regenerate-full-schema.sh` is **not** owed.
>
> This is pure forward safety for the **cloud** apply, which the file's own note defers to the
> standing migration-parity window and which **has not happened yet**. That is the paste this
> protects.

I did **not** author a migration 116: no schema change is required, and adding one would put a
no-op ALTER in the parity queue.

**Verification is Tier-1 + house-precedent only, stated plainly:** no offline Postgres parser
(`sqlglot` / `pglast` / `sqlparse`) is installed in the venv, and executing DDL is the
operator's job under the project rule. The SQL body was re-read post-edit (six literals intact,
executable statements otherwise unchanged) and `test_migration_115.py` passes unchanged (3
passed) — it gates the resulting constraint and does not read the file text.

---

### WR-02: The recorded intent sweeps in the whole run-input bag, including `kickoff_prompt`

**Files modified:** `backend/app/services/harness/phase_types.py`,
`backend/tests/unit/test_189_no_egress.py`
**Commit:** `8aa32de0`

Excluded by **name** via a closed `_NON_ACTION_RUN_INPUTS` frozenset — never a prefix or type
heuristic, which would silently eat a badly-named real input.

New parametrised case (×3 capabilities) drives the **production** input bag, which is why no
existing case caught this: `_run_ctx()` starts from `inputs={}` and every case then assigns
hand-picked keys. It asserts **both** surfaces — the record Phase 190 would send, and the body
a human reads — with two positive controls that the real inputs still resolve.
**Observed RED 3/3** against the unfixed executor.

---

### WR-03: The no-egress falsification patches HTTP only

**Files modified:** `backend/tests/unit/test_189_no_egress.py`
**Commit:** `041a2ef1`

Added `smtplib.SMTP.__init__` (the **constructor**, so the connection attempt is caught and
`SMTP_SSL`/`LMTP` inherit it), `urllib.request.urlopen` and `socket.socket.connect`, each with
**its own inertness control** in the shape the two httpx controls already use.

The docstring now also states what is deliberately **not** patched and why — `subprocess` and
`os.system` are plausible in principle, but pytest, coverage and the import machinery all reach
for them, so a process-wide patch would break the harness rather than the test. Recorded so the
docstring stops over-claiming a second time.

`tests/unit` 62 failed / 1749 passed → 62 failed / **1752** passed. The widening was later
proved live in a *different* suite: WR-06's fence, driven against a planted send, reported
`smtplib.SMTP.__init__ was called - outbound egress attempted`.

---

### WR-04: The capability picker is a `radiogroup` with three tab stops and no arrow-key navigation

**Files modified:** `frontend/src/components/workflows/ExternalActionSection.tsx`,
`frontend/src/components/workflows/ExternalActionSection.test.tsx`
**Commit:** `8e208fdd`

**Departure from the review's preferred shape, argued.** The review offered two: drop to
`aria-pressed` in a `role="group"` (called "cheaper"), or keep the role and build the
behaviour. **I took the second.** It genuinely is a single-choice group; `role="group"` would
promise less but also describe it less well; and — decisive under my constraint not to weaken
existing assertions — retracting the role would have required rewriting five
`getByRole("radio")` call sites and the `radiogroup` case. Building the behaviour leaves every
existing assertion true and adds to it.

Roving tabindex (the chosen row owns the single stop; the first row owns it when nothing is
chosen, so the group is always reachable and never traps three stops), Arrow Up/Down/Left/Right
with wrapping, Home/End, selection following focus, and `preventDefault` on handled keys only.

Nine cases; **7 observed RED** against the unfixed component. The two that stay green either
way are the negative controls by construction — `Tab` must not be `preventDefault`ed, an
unhandled key writes nothing — and they are what stops the handler being a catch-all.

---

### WR-05: The developer panel prints the raw client status slug to the user

**Files modified:** `frontend/src/components/panel/PhaseCard.tsx`,
`frontend/src/components/panel/PhaseTimeline.tsx`,
**new** `frontend/src/components/panel/phaseStatusMeta.ts`,
`frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx`
**Commit:** `1f43e9ec`

**The table moved, and the split was forced rather than chosen.** Exporting `statusWord` from
`PhaseCard.tsx` — the review's first suggestion — was **measured as a new
`react-refresh/only-export-components` ERROR** on that file (3 → 4 lint errors), and the rule's
own message reads *"Use a new file to share constants or functions between components."* So I
took the review's stated alternative ("or lift `STATUS_META` beside it"), which is also the
shape 188.2 used five times over for `PhaseNodeCard`'s siblings.

**The move is byte-identical** — proved by `diff`, modulo the two added `export` keywords. No
row retuned, no glyph rechosen, no contrast token changed. `PhaseCard` is back to its 3
pre-existing lint errors; the new module is lint-clean; `tsc` unmoved at 33. No `?raw` fence
targets `PhaseCard.tsx` and no code imported `STATUS_META`, so nothing was silently weakened —
the new module's header records that the glyph-occurrence-count evidence moved with the table.

`statusWord` routes through `statusMeta`, so the 188.1-04 own-property guard covers this caller
too. Four cases, **all four RED** against the unfixed tree — received values included
`'notify — wat_is_th…'` (raw string leaked) and `'notify — construct…'` (inherited key leaked).

---

### WR-06: The publish golden run executes the external-action body with the checkpoint skipped

**Files modified:** `backend/app/services/harness_engine.py`,
`backend/tests/test_harness_engine.py`,
`.planning/phases/189-governed-external-action-node-model/deferred-items.md`
**Commit:** `653d05ca`

> **⚠ I did NOT take the review's proposed fix, and this is the finding to read closely.**

The review proposed the golden-run branch return a synthesized `PhaseOutcome` instead of
executing the body. **That carve-out would have to fabricate the recorded body**, because
`test_publish_service.py` already asserts the golden run's phase reaches `recorded_not_sent`
carrying the real `recorded_intent["capability"]` and a body containing `NOT SENT`. That means
a **second composer** for the one sentence `_external_action_body` owns — two vocabularies for
one state, on the surface whose entire discipline is that there is one — and it would stop the
golden run exercising the real executor, which is the thing D-06 is supposed to prove works.
Trading an inert risk for a live duplication is the wrong trade. (The review's snippet is a
sketch with a literal `"…"` placeholder, consistent with this.)

**What I did instead — the review's stated minimum, plus a mechanical trigger.**

1. The golden-run branch carries a loud, specific WR-06 warning naming `external_action`,
   naming Phase 190 as owner, and naming the two admissible fix shapes.
2. `test_a_golden_run_of_an_external_action_performs_no_egress` drives a **real** golden run
   (`is_golden_run=True`) with the WR-03 **widened** sentinel armed — imported from the
   no-egress suite rather than re-typed, so a future widening there strengthens this fence
   automatically — with anti-vacuity assertions that the step ran, recorded, and the run
   continued past it.
3. `D-189-DEF-04` records the decision, the rejected shape and the trigger.

**The fence is proved to bite, not assumed to.** Planting `smtplib.SMTP('smtp.example.com', 25)`
inside `_exec_external_action` produced:

```
tests.unit.test_189_no_egress._EgressAttempted:
    smtplib.SMTP.__init__ was called - outbound egress attempted
```

The plant was then reverted and `git status` confirmed the file clean.

**Re-open trigger:** that test turning RED — which is exactly the commit that makes a capability
perform real egress. No calendar date, no remembering.

⚠ **A Windows trap found while building it, recorded in the test:** `asyncio.run` builds a
fresh proactor loop whose self-pipe is a `socketpair()`, i.e. a `socket.connect` *inside* the
armed region. The first version of the fence failed in `proactor_events._make_self_pipe`, not
in the executor. The drive now accepts a loop built **before** the sentinel arms; every other
caller keeps `asyncio.run` byte-identically. Anyone reusing `_block_all_http` around an
`asyncio.run` needs the same ordering.

---

## Out of scope, and one thing the human should look at

**Info findings IN-01…IN-06 were not touched** (`fix_scope: critical_warning`). IN-06 is worth a
note: the count gate reported **`failed 0`** on every run in this round, so the red `failed`
column its header records did not reproduce here.

> ### ⚠ `D-189-DEF-01`'s count pin moved 7 → 8 and is STILL RED
>
> `tests/test_182_extraction_parity.py::test_nl_gen_regression_test_count_unchanged` asserts
> `_count_test_defs(test_103_grounding_fidelity.py) == 2`. It has been RED since **189-02**
> (`fe7bd092`) — this round did not create it. CR-01's negative control moved the number, so it
> now reads `assert 8 == 2`.
>
> **I deliberately did not fix it.** The one-literal bump is trivial, but it is not in the
> review's finding list, and fixing an unrelated pre-existing failure inside a closure round is
> exactly the scope-smuggling CLAUDE.md's G-7 names. Recorded in `deferred-items.md`.
>
> **When someone does bump it:** bump to the count measured at that moment, and **also add
> `tests/test_182_extraction_parity.py` to the phase-scope pytest command** — the file is
> invisible to the canonical nine-, ten- and fourteen-file scopes, so the blindness is the part
> that survives the literal.

**Deployment-artifact parity:** none of these commits touches an env var the app reads, a
seed-bearing migration, a bundled service, or the sandbox image tag, so the Phase-158
same-commit rule does not fire.

**Not verified here (out of a fixer's remit):** no live UAT was driven. CR-02 changes the
live streaming surface, and its proof is an end-to-end store-level drive, not a browser. A
lived-experience row watching an `external_action` step resolve on the run surface — the card
reading *Not sent*, the canvas reading *Not sent — recorded*, and the announcer saying *not
sent* — is still owed at phase verification.

---

_Fixed: 2026-08-07_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
