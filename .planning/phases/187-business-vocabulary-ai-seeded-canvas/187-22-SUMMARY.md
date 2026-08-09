---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 22
subsystem: workflow-studio-frontend
tags: [governance, seed-receipt, CR-04, integrity, falsification]
requires:
  - "187-13 (SeedReceipt component)"
  - "187-15 (the page mount + onDraft wiring)"
  - "187-16/187-20 (the CR-01 copy split this plan's data-flow fix completes)"
provides:
  - "receiptPhases — an arrival snapshot of the generation, replacing the live store selector at the SeedReceipt mount"
  - "a prop contract on SeedReceipt.phases naming the snapshot obligation and where the caller keeps it"
  - "three end-to-end CR-04 fences (tools edit / added step / grounding dial), each with a positive control"
  - "two rerender-based standing fences on the leaf + one builderSource pin on the wiring"
affects:
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/components/workflows/SeedReceipt.tsx
tech-stack:
  added: []
  patterns:
    - "caller-side snapshot for past-tense copy (the receipt is a receipt; the canvas is the ledger)"
    - "page-level falsification for a caller defect, component-level fences for what the leaf owns"
    - "needles assembled from parts so a grep of the guard cannot satisfy the guard"
key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/SeedReceipt.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - frontend/src/components/workflows/SeedReceipt.test.tsx
decisions:
  - "CR-04 is closed in the CALLER, not the leaf: one snapshot mechanism closes all three input paths at once"
  - "The review's proposed component-level falsification is NOT implemented — it contradicts its own proposed fix (planner_note verified against live source)"
  - "The plan's `grep -n \"phases={phases}\" returns nothing` criterion is an inherited FALSE claim — re-derived (see Deviations)"
  - "The plan's `prior 22` count for WorkflowBuilderPage.canvas.test.tsx is an inherited FALSE claim — the measured baseline is 113"
metrics:
  duration: ~50 min
  tasks: 3
  commits: 3
  completed: 2026-08-03
---

# Phase 187 Plan 22: CR-04 — the seed receipt describes its own generation Summary

The seed receipt now renders from a snapshot of the generation that produced it (`receiptPhases`, captured beside the single `setDrafted` transition) instead of the live `useStore` selector — so a post-arrival edit in the sibling inspector can no longer make the card claim the author's own act as the AI's.

## What was built

**The defect.** Every sentence on the card is past-tense and first-person ("Here's what I built", "so I set them to must prove it", "N steps were already set"). Its data source was present-tense: `phases` was a live store selector handed straight into the card, and nothing closed the card on an edit. `PhaseFormPanel` sits on the same screen and writes the exact field the receipt's grounding classification reads. Ten seconds after arrival the author could switch a KB tool on and watch the card credit the AI with their act — CR-01's failure shape for the third time, on the one surface (SC#3) whose entire purpose is that safety is attributed to whoever applied it.

**The fix, in the caller.** Two prior rounds fixed this class by editing what the copy SAYS. This one fixed where the copy READS FROM, which is the only fix that closes all three input paths at once.

## Task-by-task

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Observe the failure — three post-arrival edits, RED | `fbf07b49` | `WorkflowBuilderPage.canvas.test.tsx` (+210) |
| 2 | Snapshot the generation — caller fix + prop contract | `ef4e59e7` | `WorkflowBuilderPage.tsx` (+8/−1), `SeedReceipt.tsx` (+25/−1) |
| 3 | Standing fences — replaceable pure projection + source pin | `4b0fe96e` | `SeedReceipt.test.tsx` (+138), `WorkflowBuilderPage.canvas.test.tsx` (+45) |

## Re-measured baselines (never inherited)

Every figure below was produced at HEAD **before** any edit in this plan.

```
$ cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx
 Test Files  1 passed (1)
      Tests  113 passed (113)

$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx
 Test Files  1 passed (1)
      Tests  60 passed (60)

$ cd frontend && npx vitest run <all three named files>
 Test Files  3 passed (3)
      Tests  401 passed (401)

$ grep -c "rerender(" src/components/workflows/SeedReceipt.test.tsx
0
```

| File | Before | After | Δ |
|---|---|---|---|
| `WorkflowBuilderPage.canvas.test.tsx` | 113 | 117 | +4 |
| `SeedReceipt.test.tsx` | 60 | 63 | +3 |
| `definitionOps.test.ts` | 228 (401−113−60) | 228 | 0 |
| **all three** | **401** | **408** | **+7** |
| `grep -c "rerender("` on `SeedReceipt.test.tsx` | **0** | **4** | +4 |

## Task 1 — the RED, transcribed verbatim

```
$ cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx

 ❯ src/pages/WorkflowBuilderPage.canvas.test.tsx (116 tests | 3 failed) 33324ms
     × CR-04 path 1 — switching a KB tool ON afterwards does not make the card claim it 211ms
     × CR-04 path 2 — a step the AUTHOR adds is not counted by the card's heading 290ms
     × CR-04 path 3 — flipping the grounding dial ON afterwards does not join the carried count 143ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > WorkflowBuilderPage 187-22 — CR-04: nothing the author does afterwards may change the receipt > CR-04 path 1 — switching a KB tool ON afterwards does not make the card claim it
AssertionError: expected { …(4) } to deeply equal { …(4) }

- Expected
+ Received

  {
    "carried": "0",
-   "detected": "0",
-   "grounded": "0",
-   "text": "Here's what I built — 3 steps✕Everything else is yours to change. Nothing is saved or published yet.",
+   "detected": "1",
+   "grounded": "1",
+   "text": "Here's what I built — 3 steps✕1 step reads your documents, so I set it to must prove it. You can't turn that off — but you can see exactly where it applies.⛨Must prove itWork out how to do it — it reads your documents (search_documents)Everything else is yours to change. Nothing is saved or published yet.",
  }

 ❯ src/pages/WorkflowBuilderPage.canvas.test.tsx:2599:27

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > WorkflowBuilderPage 187-22 — CR-04: nothing the author does afterwards may change the receipt > CR-04 path 2 — a step the AUTHOR adds is not counted by the card's heading
AssertionError: expected { …(4) } to deeply equal { …(4) }

- Expected
+ Received

  {
    "carried": "0",
    "detected": "0",
    "grounded": "0",
-   "text": "Here's what I built — 3 steps✕Everything else is yours to change. Nothing is saved or published yet.",
+   "text": "Here's what I built — 4 steps✕Everything else is yours to change. Nothing is saved or published yet.",
  }

 ❯ src/pages/WorkflowBuilderPage.canvas.test.tsx:2613:27

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/pages/WorkflowBuilderPage.canvas.test.tsx > WorkflowBuilderPage 187-22 — CR-04: nothing the author does afterwards may change the receipt > CR-04 path 3 — flipping the grounding dial ON afterwards does not join the carried count
AssertionError: expected <p …(2)></p> to be null

- Expected:
null

+ Received:
<p
  class="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground"
  data-testid="seed-receipt-carried"
>
  1 step was already set to must prove it.
</p>

 ❯ src/pages/WorkflowBuilderPage.canvas.test.tsx:2636:58

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯


 Test Files  1 failed (1)
      Tests  3 failed | 113 passed (116)
```

**Read of the RED, against the acceptance bar:**

- Exit non-zero, exactly the three new cases failing, **all 113 pre-existing cases still passing** (113 passed of 116).
- Every failure is a **text/count mismatch** against the captured arrival baseline — no `Unable to find an element`, no timeout. A selector failure would not have been a falsification.
- Path 1's observed text contains **"so I set"** — the authorship claim, printed over the author's own edit. That is the defect in one line.
- Each positive control ran and passed **before** the failing assertion: path 1's `aria-pressed="true"` on the KB chip and the canvas seal on `judge`; path 2's `await waitFor(() => expect(nodeSlugs()).toHaveLength(4))`; path 3's `aria-pressed="true"` on the strict dial plus the seal. Had any of them failed, the run would have stopped there instead of at the receipt comparison — which is how they are known to have passed.
- Scope at Task 1:
  ```
  $ git diff --name-only -- frontend/ backend/ supabase/
  frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
  supabase/.temp/cli-latest              ← pre-existing repo noise, not staged
  supabase/snippets/Untitled query 274.sql   ← pre-existing repo noise, not staged
  supabase/snippets/Untitled query 469.sql   ← pre-existing repo noise, not staged
  ```
  Only the one test file was staged and committed (`1 file changed, 210 insertions(+)`).

## Task 2 — the GREEN, transcribed verbatim

```
$ cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/workflows/SeedReceipt.test.tsx src/components/workflows/definitionOps.test.ts

 Test Files  3 passed (3)
      Tests  404 passed (404)
   Start at  23:06:53
   Duration  36.88s
```

401 at baseline + the 3 CR-04 cases = 404. Zero failures.

Flag-OFF byte-identity guard, unchanged:

```
$ cd frontend && npx vitest run src/components/admin/revertByteIdentical.test.tsx src/pages/WorkflowBuilderPage.header.test.tsx

 Test Files  2 passed (2)
      Tests  34 passed (34)
```

### The D-187-14 mount cap, by measurement

```
$ git diff --numstat -- frontend/src/pages/WorkflowBuilderPage.tsx
8	1	frontend/src/pages/WorkflowBuilderPage.tsx
```

**8 insertions, 1 deletion** against a cap of ≤ 15 / ≤ 2. The whole delta on a 1851-line hot file is:

1. a state declaration (`receiptPhases`) beside `showReceipt`, + a 3-line comment naming CR-04;
2. one setter call (`setReceiptPhases(def.phases)`) inside `onDraft`'s success branch beside `setDrafted`, + a 2-line comment naming D-187-09;
3. **one identifier** in the JSX: `phases={phases}` → `phases={receiptPhases}`.

The render body gains **no new line** — the only render-body change is the identifier swap (1 insertion / 1 deletion at the same position). The reasoning lives in the component's prop contract, not in the page.

The confirming greps:

```
$ grep -n "setReceiptPhases" frontend/src/pages/WorkflowBuilderPage.tsx
609:  const [receiptPhases, setReceiptPhases] = useState<readonly PhaseSpecJSON[]>([])
1218:        setReceiptPhases(def.phases)
```

One declaration, **one write**, and the write is inside `onDraft`'s success branch beside `setDrafted(def)`.

```
$ grep -nE "useState|useRef|useMemo" frontend/src/components/workflows/SeedReceipt.tsx
110:import { useId, useMemo } from "react"
217:  const rows = useMemo<GroundedRow[]>(() => {
```

No `useState`, no `useRef` — the leaf gained no hidden state.

```
$ git diff --name-only -- backend/     → (empty)
$ git status --porcelain supabase/migrations → (empty)
```

Typecheck (`npx tsc --noEmit -p tsconfig.app.json`, filtered to the touched files) reports **zero** errors in `WorkflowBuilderPage*` or `SeedReceipt*`. The repo-wide run has substantial pre-existing rot, none of it in this plan's files.

### The immutability precondition (T-187-R4-04), verified rather than assumed

The snapshot aliases the store's initial array, so it is only safe if every store op is immutable-by-construction. Verified at live source before the fix was written:

- `builderStore.setDrafted` — `const { phases, ...meta } = definition`; no copy, no mutation, so `def.phases` **is** the store's initial array reference.
- `definitionOps.patchPhaseConfig` — `phases.map(...)`, returning `{ ...p, config: { ...p.config, ...patch } }` for the changed member; the `delete next.name` operates on the **copy**.
- `definitionOps.setPhaseGovernance` — `phases.map((p) => (p.slug === slug ? { ...p, ...patch } : p))`.
- `assignIndices` — `ordered.map((phase, position) => ({ ...phase, phase_index: position }))`.
- `orderPhases` — `[...phases].sort(...)`, a copy before the sort.
- `addPhase` / `insertPhaseAt` / `movePhase` — all spread-and-slice into a fresh array, then `assignIndices`.

No mutating op found; no defensive copy needed; no scope change triggered.

## Task 3 — the standing fences, and two observed falsifications

```
$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx

 Test Files  2 passed (2)
      Tests  180 passed (180)
```

(117 page + 63 receipt.)

### Falsification probe A — cache the first `phases` inside the leaf

Applied: `import { useId, useMemo, useState }` plus, at the top of the component body,
`const [frozen] = useState(phases)` / `phases = frozen`.

```
$ npx vitest run src/components/workflows/SeedReceipt.test.tsx

     × PURE PROJECTION — handed a new snapshot, every sentence and all three counts describe THAT one 9ms
     × A NEW SNAPSHOT REPLACES THE OLD ONE — this leaf holds no cache of its first props 3ms
     × holds NO cache of its first props — the CR-04 wrong fix, fenced at the source 6ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed (1)
      Tests  3 failed | 60 passed (63)
```

Both required fences bit — the replaceability case **and** the source fence — plus the pure-projection case, which is the stronger result. Reverted cleanly:

```
$ git checkout -- frontend/src/components/workflows/SeedReceipt.tsx
$ git diff --stat -- frontend/src/components/workflows/SeedReceipt.tsx
(revert clean — no diff)
$ grep -nE "useState|useRef" frontend/src/components/workflows/SeedReceipt.tsx
(no cache hooks)
```

This is the probe that matters most: it is the **tempting wrong fix** the review's own proposed test would have forced. It is now impossible to land silently.

### Falsification probe B — revert the mount prop to the live selector

Applied: `phases={receiptPhases}` → `phases={phases}` at the `<SeedReceipt>` mount only.

```
$ grep -n "phases={phases}" src/pages/WorkflowBuilderPage.tsx
1550:          phases={phases}      ← WorkflowCanvas (correct — live)
1580:        phases={phases}        ← PhaseSpineGraph (correct — live)
1644:        phases={phases}        ← the planted regression

$ npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx

     × CR-04 path 1 — switching a KB tool ON afterwards does not make the card claim it 208ms
     × CR-04 path 2 — a step the AUTHOR adds is not counted by the card's heading 235ms
     × CR-04 path 3 — flipping the grounding dial ON afterwards does not join the carried count 234ms
     × SOURCE FENCE — the card is handed the arrival snapshot, and the snapshot is taken beside setDrafted 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed (1)
      Tests  4 failed | 113 passed (117)
```

The new `builderSource` fence **and** all three Task-1 cases failed, exactly as required. Reverted cleanly:

```
$ git checkout -- frontend/src/pages/WorkflowBuilderPage.tsx
$ git diff --stat -- frontend/src/pages/WorkflowBuilderPage.tsx
(revert clean — no diff)
$ grep -n "phases={receiptPhases}" frontend/src/pages/WorkflowBuilderPage.tsx
1644:        phases={receiptPhases}
```

### Final state after both probes

```
$ npx vitest run src/components/workflows/SeedReceipt.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/workflows/definitionOps.test.ts
 Test Files  3 passed (3)
      Tests  408 passed (408)

$ npx vitest run src/components/admin/revertByteIdentical.test.tsx src/pages/WorkflowBuilderPage.header.test.tsx
 Test Files  2 passed (2)
      Tests  34 passed (34)

$ git diff --name-only -- backend/            → (empty)
$ git status --porcelain supabase/migrations  → (empty)
```

## Deviations from Plan

### 1. [Rule 1 — inherited claim falsified] `grep -n "phases={phases}"` cannot return nothing

**Found during:** Task 2 acceptance.
**Claim:** the plan states `grep -n "phases={phases}" frontend/src/pages/WorkflowBuilderPage.tsx` must return nothing.
**Measured at HEAD, before any edit:**

```
$ git show HEAD:frontend/src/pages/WorkflowBuilderPage.tsx | grep -n "phases={phases}"
1543:          phases={phases}     ← <WorkflowCanvas>
1573:        phases={phases}       ← <PhaseSpineGraph>
1637:        phases={phases}       ← <SeedReceipt>   (the defect)
```

Three mounts, not one. The canvas and the spine **must** read the live selector — they are the ledger of *current* governance (threat register T-187-R4-02 says so explicitly: "the receipt is a receipt; the canvas is the ledger"). Satisfying the criterion literally would break both graphs.

**Re-derived property, and how it is enforced:** the `<SeedReceipt>` element specifically must not carry the live selector. The Task-3 source fence extracts that one element out of `builderSource` (`/<SeedReceipt\b[\s\S]*?\/>/`) and asserts over it, with a vacuity guard (`expect(element).toContain("kbTools")`) and a planted-literal positive control proving the pattern would have fired on the old wiring. This is strictly stronger than the file-wide grep, because a file-wide grep would have to be deleted the moment it was written.

No fix required; no scope change.

### 2. [Rule 1 — inherited claim falsified] the canvas suite's prior count is 113, not 22

**Found during:** Task 3 baseline re-measurement (which the plan itself mandates).
**Claim:** the plan's acceptance bar says `WorkflowBuilderPage.canvas.test.tsx` must exceed "its prior 22".
**Measured:** 113 tests at HEAD. The bar is applied against the measured 113 → 117.

### 3. [Rule 3 — measured, not guessed] the source fence's proximity window widened 400 → 500 chars

**Found during:** Task 3, first run.
The fence asserts the snapshot setter sits beside the `setDrafted(def)` transition. A 400-character window fell ~30 characters short: the two shipped comment blocks between the transition and the setter run to roughly 370 characters on their own. Observed failure:

```
AssertionError: expected 'setDrafted(def)\n        // 187-15 — …' to contain 'setReceiptPhases(def.phases)'
```

Widened to 500 with the measurement recorded in a comment beside it. Still far too narrow to reach another function, so the property ("the next few lines, comments included") is unchanged.

### 4. [planner_note verified, not re-litigated] the review's proposed component test is NOT implemented

The `<planner_note>` claim was re-verified against live source before Task 1: `SeedReceipt` recomputes every row, count and sentence from the `phases` prop on every render (`SeedReceipt.tsx` `:206-241` at HEAD — `useMemo` over `phases`, `seedReceiptHeading(phases.length)`, `rows.filter(...)`). A caller-side snapshot does not change that, so the review's proposed component-level "hand it a mutated array and the claim must stay absent" test would still fail after the review's own proposed fix, and could only be made green by caching inside the leaf.

The note is **confirmed**. The falsification lives at the page; the component carries the two properties it genuinely owns; and probe A above proves the wrong fix now reds three cases instead of going green.

## Known Stubs

None. No placeholder values, no hardcoded empty data reaching the UI, no TODO/FIXME added.

## Threat Flags

None. No new endpoint, no new request, no auth path, no file access, no persisted field, no schema change. `SeedReceipt` still imports nothing from the API client; the run-time grounding gate remains unconditional and server-side. The threat register's `T-187-R4-SC` package-legitimacy gate was not engaged — this plan installs nothing and adds no dependency.

## Requirements

`VOCAB-02` is exercised by this plan but is **NOT** marked complete here. Per the project's standing rule, `requirements.mark-complete`, `state.advance-plan` and `roadmap.update-plan-progress` write false completion records and were **not called by any task in this plan**. The orchestrator owns those writes.

## Self-Check: PASSED

```
$ [ -f frontend/src/pages/WorkflowBuilderPage.tsx ]                        → FOUND
$ [ -f frontend/src/components/workflows/SeedReceipt.tsx ]                 → FOUND
$ [ -f frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx ]            → FOUND
$ [ -f frontend/src/components/workflows/SeedReceipt.test.tsx ]            → FOUND
$ git log --oneline -4
4b0fe96e test(187-22): standing fences — a replaceable pure projection, and a source pin on the wiring
ef4e59e7 fix(187-22): the seed receipt renders from an arrival snapshot, not the live store (CR-04)
fbf07b49 test(187-22): observe CR-04 red — three post-arrival edits move the seed receipt
7a1b427e docs(187): record round-4 gap-closure planning (25 plans, 12 waves)
```

All three commit hashes exist; all four declared artifacts exist and carry their required contents (`receiptPhases`, `snapshot`, `CR-04`, `rerender(`).
