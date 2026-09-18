---
phase: 250-run-honesty-the-residue
verified: 2026-09-15
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
independent_review: refused   # ⭐ RULED 2026-09-18 by the OPERATOR. WHO DECIDED: the operator, in person, on the drafted refusal at `.planning/phases/250-run-honesty-the-residue/250-REVIEW-REFUSAL.md` — claude prepared it and ruled on nothing (D-05). WHY: residual risk LOW; this was the second-strongest of the five drafts, and the operator chose to spend the available independent-review capacity on the security-bearing rows (252 / 253) and on 251, which carries two live criticals. THE EVIDENCE, VERBATIM: the ruling was recorded as the answer to `BUS-250`, which is now `[CLOSED]` in `.agent-bus/OPEN.md` — read it there rather than trusting this line. ⛔ A REFUSAL IS NOT A PASS: `verification_mode` stays `self-verified`, no §6.3 review ran, and the accepted risk is that a builder read its own work. RE-OPEN TRIGGER: gemini reviewing this phase at ANY time, before or after 2026-09-24 — at which point the verdict artifact is `250-REVIEW-IND.md`, this value returns to `done`, and the draft is void. FULL AUDIT: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`.
reviewer: null
verdict: PASS
owed:
  - "CLOSED 2026-09-15 — live mirror-image control DRIVEN at the operator's request; it FOUND a shipped hook-short-circuit defect that every gate was green over"
  - "HONEST-02 behavioural per-provider rows — an empty-output run cannot be produced on demand"
  - "parallel-thread axis, live"
  - "independent review (DEBT-06) — WAIVED BY INSTRUCTION, NOT SATISFIED"
  - "the 254 apparatus — `BUS-250` amended in place 2026-09-17 with the **2026-09-24** deadline and rank 5 of 5; a refusal is DRAFTED at `.planning/phases/250-run-honesty-the-residue/250-REVIEW-REFUSAL.md` and is NOT real until the operator rules (D-05 / REG-03). ⛔ This entry records the apparatus, not a discharge — `independent_review` still reads `owed`."
  - "the word NOT TICKED — claude's call from the operator's own vocabulary, G-2 sketch declined (D-250-12)"
---

# Phase 250 — Verification

**Verified:** 2026-09-15 · **Verifier:** Claude
⛔ **`verification_mode: self-verified` · `independent_review: owed`.** The builder and the
verifier are the same agent, by explicit operator instruction. This is **not** peer review and may
not be recorded as such — a fifth owed row beside 238 / 240 / 241 / 249 (`DEBT-06`).

---

## Success criteria, goal-backward

### SC#1 — *"Context trimming never drops the user's own question — a long thread keeps every question the user asked, and the agent never announces that a question asked eight turns ago was trimmed."* ✅

**Delivered.** `trim_messages_to_fit` evicts in four ordered passes; a user turn goes only when no
non-user group remains in **either** section.

**Evidence, not assertion:**
- `test_250_run_honesty_agent_loop.py` §1 — five fences. `1_1` (every question survives) and `1_2`
  (the newest question is never evicted) were **driven RED against the shipped code first**.
- `1_3` proves no orphaned tool result and no assistant stripped of its results.
- `1_4` proves the D-14 fast path returns the **same object** — Deep Mode byte-identical.
- `1_5` proves the loop still terminates and still shrinks on an all-user history.
- All **39** pre-existing `test_context_window.py` cases still pass, including the two D-078-01
  floor tests, which is what separates a re-ordering from a behaviour change.
- **Cross-provider, 8/8** at each provider's real budget with every thread ≥ 2× that budget
  (`250-UAT.md` §B).

⚠ **The half of SC#1 NOT delivered, stated plainly:** *"the agent never announces…"* is an
emergent property of the model no longer being handed a history missing the turn it is answering.
It is not separately asserted, because the announcement is model-generated prose. What is asserted
is the cause.

### SC#2 — *"A reasoning model that produces no text inside a tool loop says what happened rather than returning 'empty response after N iterations'."* ✅

**Delivered.** Four arms, each naming a distinct thing that occurred, with an explicit
`reason not captured` arm.

**Evidence:** `test_250_run_honesty_agent_loop.py` §2 — five fences. `2_1` and `2_3` driven RED
against the shipped sentence. `2_2`, `2_3` and `2_5` were then **driven RED against a planted
defect** (a fallback reading `full_reasoning_content` and branching on `provider`) and the file
restored **md5-identical**. `test_075_4_empty_response_iter_count.py` retired deliberately and
re-pointed at `BUG-260522-01`'s claim.

⚠ **Honest limits:** these are source-shape fences over a 3,300-line generator, stated as such in
the file. A behavioural per-provider drive was **not** possible — an empty-output run cannot be
produced on demand — and is recorded ⛔ in `250-UAT.md` §B2 rather than omitted.

### SC#3 — *"The workspace panel stops claiming a run is in progress the moment that run ends — including a run that timed out, which today leaves the panel working forever."* ✅

**Delivered, and verified on the reporting thread itself.**

**Evidence:** `250-UAT.md` §A2 — `BUG-260902-01`'s own thread, its own todo
(*"Search knowledge base for report data"*), opened in a real browser: `NOT TICKED`, no animation,
`/run ended/i` false. Backend: `test_250_reconciler_gate.py` — `timed_out` / `cancelled` /
`failed` now reconcile (three fences driven RED), `cap_paused` still does not **in both
orderings**, step order preserved, a reconciler explosion still never raises into the finalizer.

⭐ **The `cap_paused` fences were themselves driven RED against an over-wide gate (`if True:`) and
the file restored md5-identical** — a fence that only ever passes proves nothing unless you know
it can fail.

### SC#4 — *"A task that completed leaves no todo asserting unfinished work — and nothing was auto-completed to achieve that."* ✅

**Delivered.** The marker never reaches the screen; the status slot reads `NOT TICKED`; the reason
is the row's `title`.

**Evidence:** `250-UAT.md` §A1 — the operator's own 2026-09-13 thread, in a browser:
`/run ended/i` **false**, three rows `NOT TICKED`, the title sentence present.
`TodosSection.test.tsx` — nine new cases including *"a completed todo is untouched on an ended run
— nothing is auto-completed"* and the `sr-only` count still reading `1 of 3 todos complete`.
⛔ `status` is never written by any of this.

---

## Gates

| Gate | Result |
|---|---|
| backend unit | **71 failed / 4822 passed** — **SET identical** to `250-backend-baseline-set.txt` after the one deliberate fence update |
| frontend count gate | at the phase close: ✅ **OK — 285/285, 0 failing**, pinned `7550 → 7563`. ⚠ **At the FIX round (after A3 found the hook defect): `failed 1`, total 8375, pinned 7567 → 7572** (`TodosSection` 21→22 for the new source fence; `WorkspacePanel.derived` 4→4 newly adopted). The one failure is `src/pages/WorkflowBuilderPage.canvas.test.tsx` — **SEED-171's FIFTH named flaky suite, its recorded `AssertionError: expected 0 to be greater than 0` signature**, also red at this phase's own baseline and at Phase 249's gap-closure. **PROVABLY UNMODIFIED**: `git diff a801fca3c..HEAD -- frontend/src/pages frontend/src/components/workflows` is EMPTY. Captured from the gate's persisted JSON BEFORE any re-run; cap untouched at 2; ⛔ the run was NOT repeated to obtain a green. |
| hot-file ledger | ✅ OK — 4 rows + same-commit sections added (3 were FIRING and had no row for their entire lives) |
| CLAUDE.md size | ✅ OK — 99,021 chars, 66 % of limit |
| `tsc -p tsconfig.app.json --noEmit` | 65 errors, **none naming this phase's files** (base 67) |
| G-7 gap-closure | ✅ clear — zero rounds |
| deploy drift | ✅ PASS |

⚠ **The count gate was RED at baseline with 3 inherited failures** and is green now.
`250-GATE-BASELINE.md` states in advance that a later green is **the flake resolving, not that
file being wrong** — recorded that way rather than as this phase fixing suites it never touched.

---

## What is NOT verified

1. ~~**The live mirror-image control**~~ — ✅ **CLOSED 2026-09-15**, driven at the operator's
   request. ⛔ **It found a REAL DEFECT that had shipped**: `useStreamingForThread(id) ||
   useLoadingForThread(id)` short-circuits the second hook the moment a run starts, crashing the
   page to white — and **every gate in this table was green over it**, because a `vi.fn()` standing
   in for a hook consumes no hook slot. Fixed, and pinned by a source fence driven RED against the
   exact defect. Full account: `250-UAT.md` §A3 and `250-SUMMARY.md` §4b.
   ⚠ **This is the phase's own thesis turned on itself** — a verification that claimed a component
   worked because green tests said so, while it crashed on the first real run.
2. **`HONEST-02` behaviourally** — fenced by source shape and by the absence of any provider value
   in the block, not by a real empty-output run.
3. **Parallel-thread axis, live** — thread-scoped by construction, not observed.
4. **Independent review** — ⛔ waived by instruction, not satisfied.
5. **The word `NOT TICKED`** — Claude's call, from the operator's own vocabulary. G-2's sketch was
   declined (`D-250-12`) because `SEED-105` and `run-state-honesty.md` D1 already carry an
   operator-approved vocabulary; that call is flagged for the operator, not buried.

---

## Verdict

**PASS on all four success criteria**, with four items owed.

⚠ **AMENDED 2026-09-15:** the original verdict read *"five items owed and none of them a defect"*.
The fifth — the live mirror-image control — was then driven at the operator's request and **found a
defect that had already shipped** (§4b). The sentence is corrected rather than overwritten, because
*"none of them a defect"* was a claim about work that had not been checked yet, and that is exactly
the class of overclaim this phase was built to remove.

⭐ **The phase's most useful output is not a line of code: the blocking measurement was taken
before planning, and it showed the report's own either/or was false.** Had it been skipped, one of
two mutually exclusive fixes would have been built at random — and the one that "looked right"
(a backend hunt) would have left the operator's actual complaint, the words, untouched.
