# Phase 189 — Deferred Items

Out-of-scope discoveries logged during execution. Each carries a concrete re-open trigger,
per the standing project rule.

---

## D-189-DEF-01 — `test_182_extraction_parity.py`'s NL-gen COUNT PIN has been RED since plan 189-02

**Found during:** plan 189-04, Task 2 (the blast-radius sweep over every suite that touches
`tool_names` / `assemble_grounding_bundle`).

**Status:** PRE-EXISTING at 189-04's HEAD, **not** caused by this plan. Measured, not assumed.

**What is failing:**

```
tests/test_182_extraction_parity.py::test_nl_gen_regression_test_count_unchanged
E   assert 7 == 2
E    +  where 7 = _count_test_defs(WindowsPath('.../tests/unit/test_103_grounding_fidelity.py'))
```

**How it was dated** (`git show <ref>:<path> | grep -c "^def test_\|^async def test_"`):

| Ref | test defs in `test_103_grounding_fidelity.py` | Pin expects |
|---|---|---|
| `fe7bd092~1` (before 189-02) | **2** | 2 ✅ |
| `fe7bd092` (189-02 Task 2) | **6** | 2 ❌ **broken here** |
| `HEAD` before 189-04 | **6** | 2 ❌ |
| after 189-04 | **7** | 2 ❌ (verdict unchanged) |

**Why it went unnoticed:** `tests/test_182_extraction_parity.py` is NOT in the nine-file
189-scope command from `189-RESEARCH.md` §D15, nor in the ten-file variant 189-02 introduced.
The phase's standing baseline (`166 passed / 2 pre-existing failed`) therefore cannot see it.

**Why 189-04 did not fix it:**

1. It is outside this plan's declared file scope — the plan's acceptance criteria require
   `git diff --stat` to list `grounding.py` plus its test files and nothing else, and that
   criterion exists to prove `openai_service.py` / `tool_dispatcher.py` were not touched.
2. The pin's own docstring says *"Bump these literals only when a Phase-103 test is
   deliberately added/removed."* The correct final literal is not knowable until Phase 189
   stops adding tests to that file — 189-11 and the gap rounds may add more. Bumping it to
   `7` now would just have to be bumped again.

**The fix, when it is taken:** one literal in
`backend/tests/test_182_extraction_parity.py:303` — `== 2` becomes the then-current count of
`def test_` / `async def test_` in `tests/unit/test_103_grounding_fidelity.py`. The sibling
assertion on `test_103_nl_generate.py` (`== 6`) is still correct and must not be touched.

**Re-open trigger:** the last plan in Phase 189 that adds or removes a test in
`tests/unit/test_103_grounding_fidelity.py` — or, if none does, `/gsd:verify-work 189`,
whichever comes first. Whoever bumps it should also add `tests/test_182_extraction_parity.py`
to the phase-scope pytest command so the next drift is visible the day it happens.

---

## D-189-DEF-02 — the author-facing tool rail will render a capability STRUCK THROUGH

**Found during:** plan 189-04, Task 2, while reading `PhaseFormPanel.tsx`'s `toolOptions`
docblock (read-only, as the plan instructed).

**The observation:** that docblock states a shipped behaviour —

> *"A TOOL THE DEFINITION NAMES THAT THE REGISTRY DOES NOT HAVE IS SHOWN, STRUCK THROUGH —
> never dropped. The server already answers `unregistered_tool` for it, and hiding it here
> would put the finding somewhere the author cannot act on it."*

D-20 deliberately keeps the three capabilities OUT of `GroundingBundle.tools`, which is the
rail's only options source. So **any surface that renders the generic tool rail for a phase
whose `available_tools` holds a capability will paint that capability struck through** — the
"registry does not have it" presentation — even though it is now perfectly valid at the
publish gate. The struck-through affordance is also still pressable, which would let an
author toggle a structurally-required capability off.

**Not a defect in 189-04**, and not fixable here: this plan touches no frontend file, and
`external_action` has no form surface yet. It is a live constraint on the plan that builds
one.

**Re-open trigger:** **plan 189-09** (`ExternalActionSection.tsx` + its `PhaseFormPanel`
mount). That plan must either scope the generic tool rail away from `external_action`, or
render the capability through its own section — it must NOT widen `toolOptions`, which is
the D-20 leak this phase's single net-new security property (V22) exists to prevent.

### ✅ CLOSED by plan 189-13 (`5963ba4b`, 2026-08-07) — and the PREMISE was measured FALSE

⚠ **The re-open trigger named plan 189-09; the surface actually landed in 189-13/189-14** after
the wave numbering shifted. 189-13 closed it.

**The premise was checked before anything was written, and it does not hold at HEAD.**
`PhaseFormPanel.tsx` renders `ToolsField` inside **two mutually exclusive `pt === …` branches**
(`llm_agent`, `llm_batch_agents`) and its render body has **no default arm** — six `pt ===`
branches, no fallback. So `external_action` never reaches the generic rail, no capability is
painted struck through, and **no render code needed to change.**

**What WAS missing is the whole point of the closure: a MECHANICAL guard.** "True today by
construction" is exactly the claim a later branch silently falsifies — and this phase's own
history is the argument, since 189-04's PLANT 2 showed the entire fidelity suite stays GREEN
while the D-20 hole is open (V22 is the only thing that can see it).

**Five cases added to `PhaseFormPanel.rails.test.tsx`** (pin 27 → 32, moved in-commit):
`external_action` renders no tool rail *nor the degraded one* (with a non-vacuity floor proving
the panel DID render); a positive control that the identical rails DO produce a rail on
`llm_agent`; no capability NAME anywhere in the panel HTML under three `toolOptions` shapes
**including `"degraded"`** (which prints what the step already names); `toolOptions` NOT widened,
asserted on source; and `<ToolsField` mounted **exactly twice** with no `external_action`-gated
mount.

**PLANT Z5 — the exact wrong fix D-20 rejects** (give the type the generic rail and widen its
options with `send_email` / `create_ticket` / `post_message`) — driven into `PhaseFormPanel.tsx`
and **observed RED on four of the five**, then restored md5-identical (`8c740775…`,
`grep -c "PLANT"` → 0). **V22 re-run: `1 passed`.** No backend file was touched by 189-13.

**Standing constraint for 189-14**, which builds `ExternalActionSection`: it must render the
capability through its OWN section and **must not widen `toolOptions`** — doing so now fails
four named frontend tests *plus* V22, rather than passing silently.

---

## D-189-DEF-03 — the LIVE RUN SURFACE has no honest wire signal for `recorded_not_sent`

**Found during:** plan 189-11, Task 2 B (deciding what the third branch emits, having read
`StreamsProvider.tsx` / `streamsStore.ts` as the plan instructed — read-only, both untouched).

**The measurement, at three sites, re-derived by symbol search:**

| Site | What it does |
|---|---|
| `StreamsProvider.onPhaseCompleted` | `phase_completed` → `setPhaseStatusForThread(..., "done")` — a "✓ Complete" card |
| `StreamsProvider.onRunCompleted` | on `status === "completed"` fires `finalizeAllPhasesForThread` |
| `streamsStore.finalizeAllPhasesForThread` | sweeps every `running` / `retrying` / `pending` phase → `"done"` |

**The gap.** The engine branch this plan added deliberately emits NO SSE for a
`recorded_not_sent` phase — emitting `phase_completed` would paint the exact lie the branch
exists to prevent, on the live surface. But emitting nothing leaves the card non-terminal, and
`finalizeAllPhasesForThread` then sweeps it to `done` when the run completes. **So a live
viewer sees the governed step as "Complete" until a reconcile fetch replaces it with the DB
status**, which `phaseStatusFromDb` (189-08) correctly derives as `recorded-not-sent` and
189-10 renders as *"Not sent — recorded"*. CLAUDE.md's own rule covers the class — Realtime is
a best-effort HINT and the fetch is the source of truth — so this is a latency-of-honesty gap,
not a persistent lie.

**Why it was not fixed here.** `189-11-PLAN.md` names both files as READ-ONLY (`git diff` must
show NO edit to either) and no plan in this phase touches them: 189-12 through 189-15 are the
canvas/panel rollout, and 189-16 is documentation. Closing it properly needs an additive SSE
event **plus** a client handler **plus** a `finalizeAllPhasesForThread` exclusion — three files
in one commit, which is a plan, not a deviation. `189-RESEARCH.md` §A3 flagged exactly this
("189 owes `PhaseReconcile.test.tsx:235` a row for the new status") and it stayed unplanned.

**Re-open trigger:** whichever comes first — (a) `/gsd:verify-work 189` if a UAT row observes
the run surface during an `external_action` run and sees "Complete" before reconcile, or
(b) **Phase 190**, which MUST close it: once the send is real, the difference between "sent"
and "recorded, not sent" stops being a wording question. The fix shape is the shipped
`phase_failed` precedent, whose own comment records why the emit-failure branch needed a new
event rather than silence: *"the finalize sweeps skip terminal statuses, so the card is never
repainted 'done' over the failure alert."*
