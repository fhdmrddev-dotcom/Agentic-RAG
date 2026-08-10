# Deferred items — quick 260809-klo (BUG-260809-02)

Carried forward from the plan's `<deferred>` block, plus one discovery made during
execution. Every entry has a concrete re-open trigger; none is left as a vague "later".

---

## D-klo-DEF-01 — the blocking copy names an internal field

**Status: ✅ CLOSED 2026-08-10.** Fixed as its own change once the owed UAT row on
BUG-260809-02 passed. **Two claims in the analysis below were FALSE and are corrected at
the end of this section — do not inherit them.**

The copy now reads:

> **Add the Business requirement — one line saying what this workflow must deliver — before publishing.**

Rather than editing the two strings "in lockstep" as this entry proposed, the string was
given **one home**: `BUSINESS_REQUIREMENT_MISSING_MESSAGE` in
`backend/app/services/harness/grounding.py`, directly beside the
`business_requirement_missing` predicate that was ALREADY shared. Phase 182 had shared the
rule but left the sentence copy-pasted — which is exactly the drift this entry predicted,
so the structural fix removes the possibility rather than re-synchronising two copies.
`workflows.py` (the `/validate` seam) and `publish_service.py` (publish stage 1) now both
reference the constant; `grep -rn "must declare exactly one business_requirement"
backend/app/` returns nothing but stale `.pyc`.

**Verified:** `tests/unit/test_publish_service.py` 28 passed; `tests/unit -k "workflow or
grounding or validate or publish"` **180 passed**; `PublishGauntlet.test.tsx` +
`WorkflowBuilderPage.canvas.test.tsx` **179 passed / 2 files** at
`GSD_VITEST_MAX_WORKERS=4`. Driven live in the browser against local on a draft that still
has no requirement (`fdc29e13`) — the Publish affordance renders the NEW sentence and stays
correctly disabled.

**⚠ Two corrections to this entry, on measurement.** It asserted the change would need
test edits because "`PublishGauntlet.test.tsx:239` pins the `named_failures` text, and
`backend/tests/` pins the publish stage-1 prose." **Both are false, in both halves:**
- `PublishGauntlet.test.tsx:239` supplies its own **fixture** string — and already a
  DIFFERENT one (*"exactly one business_requirement must be declared"*), which is itself
  proof it was never a pin on the shipped wording.
- The real prose site is `WorkflowBuilderPage.canvas.test.tsx:3183`, which likewise
  **defines** the message and asserts it is relayed verbatim — so it tests relay fidelity
  with an arbitrary string and is indifferent to the backend's wording.
- `backend/tests/` pins only `blocked_stage == "business_requirement"` (the CODE), and its
  one `named_failures` fixture at `test_publish_service.py:1009` uses yet a third invented
  string.

**Net: zero test edits were required.** The wording was changeable all along; the entry's
own analysis is what made it look expensive. Same lesson as the `PHASE_GLYPHS` pointer —
nothing typechecks prose, so a plausible file:line in a planning doc survives every gate.

---

<details><summary>Original entry, kept for the record (contains the two false claims corrected above)</summary>

**Status:** deferred, carried verbatim from the plan. **Not folded in — it is a BACKEND
change**, and this task was capped at the frontend control.

The sentence *"a workflow must declare exactly one business_requirement before publish"*
is authored in **two backend sites** — `backend/app/api/workflows.py:718` (the `/validate`
seam) and `backend/app/services/harness/publish_service.py:166-168` (`named_failures`,
publish stage 1). It reaches the UI **verbatim by design**: `blockedReason`'s own docblock
says the FIRST verdict's `message` is relayed and *"never rewritten and never mapped."*

So the frontend has no legitimate one-line fix — rewriting it client-side would install
exactly the message mapping D-182-06 forbids, and would desynchronise `/validate`'s
wording from the gauntlet's. A correct fix edits both backend strings **in lockstep**,
plus their assertions (`PublishGauntlet.test.tsx:239` pins the `named_failures` text, and
`backend/tests/` pins the publish stage-1 prose).

**Re-open trigger:** the next phase that touches `publish_service.py`'s stage table OR
`workflows.py`'s `_ROUTE_ASSIGNED_CODES` block changes both strings in the same commit to
say what to DO rather than name the field — e.g. *"this workflow still needs a one-line
description of what it must deliver."* If no such phase appears by the close of the
connections milestone, raise it as its own `/gsd:fast`.

**Why deferring is safe now:** with this task landed, the author reading that sentence has
the control in the header directly above the Publish button they just pressed. The copy is
unhelpful; it is **no longer a dead end**, which was the blocking half.

</details>

---

## D-klo-DEF-02 — the other definition-level fields

**Status:** deferred, carried verbatim from the plan.

BUG-260809-02's routing note asks whether `project_folder_id`, `inputs`, `assets` and
`category` are similarly unreachable from the canvas. **Measured for the first one only:**
`project_folder_id` **is** reachable (D-186-15, the `kbAffordance` picker this task's
control now sits beside). `inputs` / `assets` / `category` were **not measured** by this
task and are out of scope.

**Re-open trigger:** the first workflow-authoring phase after this one runs
`grep -rn "<field>" frontend/src` filtered to `value=|onChange` for each of the three, and
either produces a control or records a **measured** reason it is not needed.
⚠ **Do not inherit this paragraph as a finding — re-derive it.**

---

## D-klo-DEF-03 — an intermittent pre-existing test flake, observed but NOT fixed

**Status:** deferred under the executor SCOPE BOUNDARY (out-of-scope discovery: the failing
tests are not ones this task wrote or edited). **Recorded with measurements rather than
waved at.**

While running the wider six-suite command in the plan's Task 2 `<verify>` block, two
**shipped** tests failed intermittently. Neither is in the plan's contractual four-suite
gate, and neither was written or edited by this task:

| Test | Suite | Observed |
|---|---|---|
| `a whole session's api call log is [create, update, update]` | `WorkflowBuilderPage.session.test.tsx` | failed 2 of 6 six-suite runs |
| `POSITIVE CONTROL — with the flag ON the very same read finds the key` (D-14 rails) | `WorkflowBuilderPage.canvas.test.tsx` | failed 1 of 6 six-suite runs, 1 of 2 **serial** runs, 1 of 6 canvas-alone runs |

**Why it is judged a timing flake and not a regression, on evidence:**

1. **The failure identity WANDERS** between two unrelated suites across runs. A logic
   regression fails the same assertion every time.
2. **It reproduces with parallelism entirely disabled** (`--no-file-parallelism`), so it is
   not the `GSD_VITEST_MAX_WORKERS` oversubscription class alone. Every run in this task
   was capped at `GSD_VITEST_MAX_WORKERS=4` per CLAUDE.md.
3. **Both tests are of the known-fragile shape**: the D-14 control does
   `vi.resetModules()` + a dynamic re-import of the whole page module graph, then waits on
   `waitFor(...)` at Testing Library's **1 s default**; the session test drives
   `userEvent.type`/`click` through a full describe→draft→save flow. Both are wall-clock
   sensitive by construction (the SEED-056 / frontend-vitest-rot class).
4. **Each passes reliably in isolation** — the full session suite ran 23/23 green alone.

**The honest caveat, stated rather than hidden.** Pre-change, canvas-alone ran 4/4 green
and the six-suite ran 3/3 green — so I did **not** observe the flake before my change.
That sample is **too small to exclude a pre-existing rate**: 4 clean runs of a ~1-in-6
event has roughly a 48% chance of showing zero failures (0.83⁴). It is also plausible that
this task's ~90 added lines in `WorkflowBuilderPage.tsx` marginally lengthen the very
dynamic import the D-14 control waits on, nudging an already-marginal test over its 1 s
budget. **I could not distinguish these two readings with the samples taken, and I am not
claiming the flake is purely pre-existing.**

**What was deliberately NOT done:** the pinned tests were not edited. The plan forbids
editing any existing `it(`, and `scripts/vitest-count-gate.cjs` treats these files as
count-pinned. Widening a shipped test's timeout to make a green appear is precisely the
"fix the pin, not the cause" move this project has recorded against.

**Re-open trigger:** if either test fails in CI, or on the next phase that touches
`WorkflowBuilderPage.tsx` / `WorkflowBuilderPage.canvas.test.tsx`, raise the D-14 control's
`waitFor` to an explicit timeout (the file already defines `LAZY = { timeout: 10_000 }` for
exactly this reason and simply does not apply it at line 666) rather than re-deriving the
diagnosis. If it does not recur within two phases, close this item as environmental.
