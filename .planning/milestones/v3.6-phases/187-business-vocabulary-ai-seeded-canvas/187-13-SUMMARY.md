---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 13
subsystem: frontend/workflow-builder
tags: [vocab-02, req-5, d-187-08, d-187-09, d-187-10, d-187-14, seed-receipt, source-fence, sketch-150-b]
requires:
  - "SEED_RECEIPT_* — the 7 copy exports from plan 187-10 (seedReceiptHeading / seedReceiptGroundingLead / SEED_RECEIPT_ONE_WAY_RULE / seedReceiptStepReason / SEED_RECEIPT_NOTHING_COMMITTED / SEED_RECEIPT_DISMISS_LABEL / SEED_RECEIPT_DISMISS_GLYPH)"
  - "GOVERNANCE_SEAL_LABEL — the Req 7 binding phrase, shipped Phase 185"
  - "groundingCauseOf — THE ONE CLIENT GROUNDING DERIVATION (phaseVocabulary.ts, Phase 185)"
  - "nodeTitle(phase, ctx?) + NameContext — the 4-tier face, plan 187-04"
  - "the ProblemsTray caller-driven leaf prop contract (open owned by the caller)"
  - "the StepTypePicker panel-entrance idiom and the PhaseFormPanel ✕ aria-hidden treatment"
provides:
  - "SeedReceipt — the post-draft seed receipt component (Req 5), a pure caller-driven leaf"
  - "SeedReceiptProps — { phases, kbTools, nameContext?, open, onDismiss } — the contract 187-15 mounts against"
  - "SeedReceipt.test.tsx — 33 tests: Req 5's four acceptance criteria plus the ?raw purity / glyph / no-staging fence"
affects:
  - "187-15 (the page mount) — imports SeedReceipt and owns `open`, the dismissed-per-draft state and the canvasEnabled gate"
tech-stack:
  added: []
  patterns:
    - "a caller-driven presentational leaf: `open` is the caller's, `open === false` returns null"
    - "the conditional is the copy module's empty string, asked once (D-187-10)"
    - "a `?raw` source fence with a POSITIVE control on both halves"
    - "the no-staging-animation proof is a SOURCE property, never a timing test"
    - "guard needles assembled from parts (String.fromCodePoint / split identifiers) so the guard file cannot satisfy its own greps"
    - "membership assertions resolve rows by `[data-slug]`, never by a testid prefix that also matches a row's children"
key-files:
  created:
    - frontend/src/components/workflows/SeedReceipt.tsx
    - frontend/src/components/workflows/SeedReceipt.test.tsx
  modified: []
decisions:
  - "The receipt renders NO technical token of its own, so `useTechnicalNamesOptional` is deliberately not read — the plan's reveal instruction is conditional and its condition does not fire"
  - "The tool id inside a `detected` reason is NOT gated by the reveal: it is inside `seedReceiptStepReason`'s locked sentence, whose unqualified form is reserved for `tool unknown` — suppressing a tool we DO know would make the copy claim something false"
  - "Two one-shot entrances are spent, not one: the shipped panel idiom on the card and the seal's arrival pulse (sketch 150-B's 'one moment of attention'). Both `motion-reduce:animate-none`, neither delayed, no stagger"
  - "The word for a timing offset is forbidden OUTRIGHT in the component source, in code AND in prose — a comment is where 'we could stagger this later' gets written down"
  - "The grounded list is asserted by exact membership resolved off `[data-slug]`; a testid-prefix resolution counted a row's children as rows and was corrected"
metrics:
  duration: ~55 min
  tasks: 2
  commits: 2
  completed: 2026-08-02
---

# Phase 187 Plan 13: The seed receipt — Summary

The safety the AI silently applied is now legible on the surface that received it: the receipt
names the step count, every auto-grounded step **with its reason from the shipped derivation**,
states the one-way rule plainly, dismisses, and closes by saying nothing is committed — and it
proves at the source that it staged nothing, because nothing was streamed.

## What Was Built

**Task 1 — the component (`a91a5ed7`).** `frontend/src/components/workflows/SeedReceipt.tsx`,
296 lines, a **leaf**: presentational, caller-driven, no context read, no store reference, no
request. The prop contract mirrors `ProblemsTray`'s:

```ts
export interface SeedReceiptProps {
  phases: readonly PhaseSpecJSON[]
  kbTools: readonly string[]      // the SERVER's list, passed in — no table here
  nameContext?: NameContext       // the same object the canvas hands `toCanvas`
  open: boolean                   // owned by the caller; it never opens itself
  onDismiss: () => void
}
```

Render order: the step-count heading and the dismiss control; **then, and only when at least one
step is grounded**, the grounding lead + the one-way rule + the per-step list (each row: the `⛨`
seal disc, the step's face, its reason); then the nothing-committed close.

Four properties are load-bearing rather than stylistic:

- **`groundingCauseOf` decides; this file renders.** The cause per step comes from the Phase-185
  one-home derivation over the `kbTools` prop. No KB tool id is written anywhere in the file — in
  code *or* in prose — so a sixth KB tool added server-side is picked up for free and there is no
  second derivation to drift (D-187-08 / T-187-13-02).
- **The named tool is the REAL intersection.** `intersectingKbTool` walks the step's own
  `available_tools` order, guarded off the loose JSONB shape, and returns the first entry the
  server's list contains — never a hardcoded id, and `null` on a miss so
  `seedReceiptStepReason` falls to its unqualified sentence rather than guessing.
- **The whole of the conditional is one empty string.** `seedReceiptGroundingLead(0)` returns
  `""` by 187-10's design, so D-187-10's zero case is asked about exactly once and the receipt
  keeps **one arrival behaviour**: with nothing grounded it still renders its orientation half and
  its nothing-committed half, with no list node at all.
- **Nothing is staged.** Generation is single-shot, so a row-by-row reveal would be pacing dressed
  as progress. Two one-shot `motion-reduce`-disabled entrances are spent — the shipped
  `StepTypePicker` panel idiom on the card, and the seal's arrival pulse (`animate-in zoom-in-50`),
  sketch 150-B's *one moment of attention*, marking the one thing the user did not ask for. Every
  seal fires on the same frame.

**Task 2 — the suite (`a50ca3de`).** `SeedReceipt.test.tsx`, 533 lines, **33 tests**, in seven
blocks: the grounded list, the zero-grounded draft, dismissal and the closed state, the copy
identity, the step faces, totality on malformed rows, and the source fence.

## Measured Results

| Measurement | Bar | Result |
|---|---|---|
| `SeedReceipt.test.tsx` | passes, 0 failed | **33 passed** |
| `SeedReceipt + definitionOps` | 0 failed | **255 passed** |
| `SeedReceipt + definitionOps + ProblemsTray + GovernanceSection` | 0 failed | **323 passed** |
| `npx tsc -b` — total errors / errors in `components/workflows` | no NEW error (D-ITEM-01) | **33 / 0** — identical to HEAD |
| `grep -cE "@/lib/api\|fetch(\|XMLHttpRequest\|EventSource"` | 0 | **0** |
| `grep -cE "setTimeout\|setInterval\|requestAnimationFrame\|animationDelay\|transitionDelay"` | 0 | **0** |
| `grep -ci "delay"` (stricter than the criterion) | — | **0** |
| `grep -cE "✦\|✓"` | 0 | **0** |
| `grep -c "search_documents\|KB_TOOLS"` | 0 | **0** |
| `grep -c "SEED_RECEIPT"` | ≥ 5 | **10** |
| `grep -c "dangerouslySetInnerHTML"` | 0 | **0** |
| `grep -c "if (!open) return null"` | ≥ 1 | **1** |
| `git status --porcelain frontend/src/pages/WorkflowBuilderPage.tsx` | empty | **empty** — the mount is 187-15's |

## TDD Gate Compliance

Task 2 is `tdd="true"`, but the plan's own ordering builds the component in Task 1 and tests it in
Task 2, so a natural RED-before-GREEN was not available for the feature itself. Falsification was
therefore **observed rather than asserted**, in three separate ways — the Phase-185 lesson
(*observe falsification RED first*) discharged on the properties that matter:

1. **The suite's own first run was RED: 5 failed / 28 passed.** Four of those five were defects in
   the *guards* and one was a fixture collision — all recorded under Deviations below. A suite that
   is green on its first run has usually not been watched.
2. **Mutation A — the grounding block made unconditional** (`{groundingLead ? …}` →
   `{groundingLead || true ? …}`): **5 failed / 28 passed.** That is D-187-10's exact prohibition —
   an empty grounded list where there should be none — and the zero-case block bites on it.
3. **Mutation B — the head of `available_tools` named instead of the intersection**
   (`kbTools.includes(tool)` → `… || true`): **2 failed / 31 passed.** The second fixture row exists
   precisely for this: it lists a non-KB tool first, so a component that named the head passes row 1
   and fails row 2.

Both mutations were reverted in place and the file re-verified green before either commit.

Commits are `feat(...)` then `test(...)` rather than a `test → feat` pair; the observations above are
the gate, matching plans 187-02 and 187-10's shape in this phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The membership helper resolved a row's children as rows**
- **Found during:** Task 2, first run.
- **Issue:** `listedSlugs()` resolved rows with `getAllByTestId(/^seed-receipt-step-[a-z]/)`, which
  also matches each row's `seed-receipt-step-seal` / `-face` / `-reason` children. It reported
  **seven** "rows" for two steps (`['contracts','','','',…]`). A membership assertion that resolves
  the wrong nodes is *worse* than the count it was written to replace — it would have passed on a
  component that rendered the right slugs on the wrong elements.
- **Fix:** resolve by `[data-slug]` — a structural property of the row itself, independent of any
  testid naming. The reason is recorded in the helper's docblock so it is not re-introduced.
- **Files modified:** `SeedReceipt.test.tsx`
- **Commit:** `a50ca3de`

**2. [Rule 1 — Bug] The "never prints a slug" guard failed on a fixture coincidence**
- **Found during:** Task 2, first run.
- **Issue:** the fixture step named *"Run the pricing policy check"* carried the slug `pricing`, so
  the guard found the slug inside the step's own **name** and went red. The component was correct;
  the fixture made the guard un-passable for the wrong reason.
- **Fix:** the slug is now `policy_check`, which is not a substring of any fixture name, with the
  constraint stated in the fixture comment. The guard now measures what it claims to.
- **Files modified:** `SeedReceipt.test.tsx`
- **Commit:** `a50ca3de`

**3. [Rule 1 — Bug] The hidden-DOM fence fired on `aria-hidden`**
- **Found during:** Task 2, first run.
- **Issue:** `/\bhidden\b\s*=/` matches inside `aria-hidden=`, because `-` is a word boundary. The
  fence therefore red-flagged the component's own **correct** a11y treatment on the seal and the
  dismiss glyph. A fence that fires on the good practice it sits beside gets deleted rather than
  fixed, so it had to be narrowed rather than relaxed.
- **Fix:** `/\shidden=|display:\s*none/`, with **three** controls: two planted positives and one
  planted `aria-hidden="true"` asserted NOT to match.
- **Files modified:** `SeedReceipt.test.tsx`
- **Commit:** `a50ca3de`

**4. [Rule 3 — Blocking] The `/delay/i` fence forced a prose rewrite of the component**
- **Found during:** Task 2, first run.
- **Issue:** the outright `/delay/i` fence (deliberately stricter than the plan's
  `animationDelay|transitionDelay` criterion) went red on the component's own **explanatory prose** —
  *"No delay: every row pulses on the same frame"*. Two ways out: weaken the fence to a code-shaped
  pattern, or keep the strong fence and stop writing the word.
- **Fix:** the strong fence stays and three comments in `SeedReceipt.tsx` were reworded
  (*"none waits its turn"*, *"nothing waits its turn"*). The rationale is in the test: a comment is
  exactly where *"we could stagger this later"* gets written down, and the point of the fence is
  that nobody re-opens the question by accident. `grep -ci delay` on the component is now **0**.
- **Files modified:** `SeedReceipt.tsx`, `SeedReceipt.test.tsx`
- **Commit:** `a50ca3de` (both files; the reword is a Task-2 finding on a Task-1 file)

### Decisions taken inside Claude's discretion

**5. No reveal accessor is read, because the receipt shows no technical token of its own.**
The plan's instruction is conditional — *"**If** the receipt shows any technical token at all, read
the app-wide boolean through the shipped accessor"* — and its condition does not fire: the receipt
renders each step's business face via `nodeTitle` and no slug, code or raw phase type (a test asserts
the surface's whole `textContent` contains none of the five fixture slugs). Reading a boolean nothing
branches on would be dead weight pretending to be a contract.

The one arguable technical token is the tool id inside a `detected` reason. It is **not** gated, and
that is deliberate: it lives inside `seedReceiptStepReason`'s locked sentence, whose *unqualified*
form (`"it reads your documents"`) is reserved by 187-10 for **"the tool is not known"**. Hiding a
tool we do know would make the copy assert something false — the opposite of the honesty this
receipt exists for.

**6. Two entrances, not one.** The plan allows *"at most ONE entrance on the panel itself … plus the
seal's one-time arrival pulse"*. Both are spent, and the suite pins the budget: `animate-in` appears
at most twice, `motion-reduce:animate-none` appears exactly as many times as `animate-in`, and
`animate-pulse|ping|bounce|spin` (the repeating families) appear zero times.

## Threat Model Compliance

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-187-13-01 (Spoofing — a client-side "grounded" read) | accepted, as planned | The receipt is display-only and `kbTools` is the server's, passed in. A test grounds a step on a tool id (`consult_the_archive`) that appears in no fixture list and no shipped constant — proving the read follows the server's palette rather than any local opinion. |
| T-187-13-02 (Tampering — a second grounding derivation) | mitigated | `grep -c "search_documents\|KB_TOOLS"` = **0**; the fence additionally asserts **no** KB tool id from the fixture list appears anywhere in the source, plus the shipped two-ids-in-one-array pattern. Positive control: `groundingCauseOf` and `seedReceiptStepReason` ARE imported. |
| T-187-13-03 (Repudiation — implying an event that did not occur) | mitigated | The no-staging fence: five scheduler/offset needles (assembled from parts) absent, no index-derived `.map((row, index) …)`, the word for a timing offset absent outright, ≤ 2 one-shot entrances each `motion-reduce`-disabled, and no repeating animation family. Every needle has a planted positive control. |
| T-187-13-04 (Input Validation / XSS — generated names and reasons) | mitigated | Every server- or model-authored string renders as a plain React text child; `dangerouslySetInnerHTML` count is **0**, fenced at the source. |
| T-187-13-05 (Tampering — governance vocabulary drift) | mitigated | Four sentences and both per-step reasons asserted **character-identically** against their `definitionOps` exports; the `⛨` disc carries the shipped `GOVERNANCE_SEAL_LABEL` as its `sr-only` announcement, once per row. The component authors no sentence. |
| T-187-13-06 (DoS — stale focus trap / hidden DOM) | mitigated | `open={false}` asserted to produce an **empty container**; the source fence pins `if (!open) return null` and forbids ` hidden=` / `display: none`, with an `aria-hidden` negative control so the fence cannot be quietly deleted. |

## Known Stubs

None. The component is fully implemented and every branch is exercised.

**One surface is intentionally unwired — that is the plan's shape, not a stub.** `SeedReceipt` has no
mount until plan 187-15 (D-187-14: the page gains one gated mount line and nothing else).
`WorkflowBuilderPage.tsx` is untouched by this plan, verified by an empty `git status --porcelain`.

## Threat Flags

None. No new network surface, auth path, file access pattern or schema. Both files are a pure
presentational component and its suite; the `?raw` fence and its positive control both pass.

## For plan 187-15 — what the mount owes

1. **`open` is yours.** The component never opens or closes itself. D-187-09: dismissal is
   **in-memory, per draft** — component state keyed to the draft, no storage key. A page reload
   re-showing the receipt is **correct**, not a bug: the grounding it describes is still true and
   nothing was persisted.
2. **`kbTools` is already on the page** (`WorkflowBuilderPage.tsx:861-889` → the canvas prop at
   `:1523`). Hand the receipt the same array; do not re-derive.
3. **`nameContext` should be the SAME object the canvas hands `toCanvas`**, or the receipt and the
   card it describes can name one step two ways. 187-12 recorded the 3-line `contextFor` shape
   (`assets.find(a => a.kind === "template")?.filename` → `NameContext.templateFilename`).
4. **The describe screen renders on BOTH flag branches** (187-05's carry-forward). This receipt lives
   above the **canvas**, on the drafted route — but if any part of the arrival is mounted on the
   describe screen it ships to `visual_workflow_canvas`-OFF users unless separately `canvasEnabled`-
   gated, and `WorkflowBuilderPage.describe.test.tsx`'s byte pin only covers the CTA flex column.
5. **CONTEXT's open discretion, still open:** whether the receipt also appears on the `autoDraft`
   hand-off path (`WorkflowBuilderPage.tsx:1202-1216`, the Phase-124 "Describe & run" door).
   CONTEXT recommends **yes** — it is a genuine AI seed — and asks that the choice be stated in the
   plan rather than discovered in UAT. This plan does not decide it; the component is indifferent.
6. **`grep -ci delay` on `SeedReceipt.tsx` must stay 0.** The fence is outright, in code and prose.
   If you need to explain timing in a comment there, say *"waits its turn"*.

## Verification

```
npx vitest run SeedReceipt.test.tsx                                      → 33 passed
npx vitest run SeedReceipt + definitionOps                               → 255 passed, 0 failed
npx vitest run SeedReceipt + definitionOps + ProblemsTray
                            + GovernanceSection                          → 323 passed, 0 failed
npx tsc -b                                                               → 33 errors, 0 in
                                                                           components/workflows
                                                                           (identical to HEAD —
                                                                            D-ITEM-01)
git status --porcelain frontend/src/pages/WorkflowBuilderPage.tsx        → empty
```

Falsification, observed and reverted: grounding block unconditional → **5 failed**; head-of-list tool
instead of the intersection → **2 failed**.

## Self-Check: PASSED

- `frontend/src/components/workflows/SeedReceipt.tsx` — FOUND (created)
- `frontend/src/components/workflows/SeedReceipt.test.tsx` — FOUND (created)
- commit `a91a5ed7` — FOUND in `git log`
- commit `a50ca3de` — FOUND in `git log`
- `git diff --diff-filter=D HEAD~2 HEAD` — empty; neither commit deleted a file
