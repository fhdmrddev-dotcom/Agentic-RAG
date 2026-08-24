---
phase: 188
plan: 04
subsystem: run-state-honesty
tags: [wave-3, falsification, BUG-260609-04, RUNVIZ-01, RUNVIZ-02, streams-provider, reconcile-floor]
requires:
  - "188-02 — the same function (`reconcilePhases`) and the same test file; its 7 tests all still pass"
provides:
  - "reconcilePhases' LIVE branch overlays REAL slug + phase_type from wf.phases, joined by phase_index — BUG-260609-04 closed at its root in code"
  - "phaseType stops flattening to `unknown` mid-run — the second, previously unrecorded half of the same bug"
  - "The positional status derivation is PROVABLY byte-unchanged (it appears on no +/- line of the diff)"
  - "A mechanical floor guard in PhaseReconcile.test.tsx: a lagging DB row can never drag PhaseTimeline's forward-only counter backward"
  - "PhaseReconcile.test.tsx 7 → 12 tests (3 falsifications + 1 floor guard + 1 fallback positive control)"
affects:
  - "Every 188 surface that reads `Phase.slug` or `Phase.phaseType` from the LIVE slice — the canvas run view most of all (it joins by phase_index, so it was already immune; the developer panel was not)"
  - "188-05 (the shared phase-state module) — it inherits a live branch that now consumes `wf.phases`, so the overlay must survive the DB_PHASE_STATUS extraction"
  - "188-12 (the operator UAT gate) — the live single-phase render is the ONLY remaining condition for flipping BUG-260609-04 to closed"
tech-stack:
  added: []
  patterns:
    - "Overlay IDENTITY, never STATUS, onto a forward-only derivation — a lagging source row must not be allowed to move a monotonic counter backward"
    - "Join a repair by the key that CANNOT be corrupted (`phase_index`), never by the value being repaired (`slug`)"
    - "Read a Map twice rather than hoisting into a block body, when the extra indent would otherwise make a no-op line LOOK modified in the diff — byte-identity you can grep for beats byte-identity you have to argue for"
    - "Replace a comment whose PREMISE was measured false; never append a correction under a claim that is still standing (the 188-02 precedent, inverted — 02 extended a docblock whose reasoning was sound)"
    - "Ship a green-before-AND-after fence in the same block as the RED, so the very next reader sees what the fix was not allowed to do"
key-files:
  created: []
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx
    - .planning/reported-bugs/BUG-260609-04.md
    - .planning/reported-bugs/BUG-260609-02.md
decisions:
  - "D-188-04-A: `byIndex.get(i)` is read TWICE rather than hoisted into an arrow block body. Hoisting would have re-indented the status ternary by two spaces, turning the plan's central acceptance criterion (`no line containing that ternary is modified`) from a grep into an argument. The duplicate Map.get on a handful of phases is free; the mechanical proof is not."
  - "D-188-04-B: the live branch's comment was REPLACED, not extended — the opposite of 188-02's docblock call. 02 extended because the docblock's own reasoning was the argument FOR the fix; here the comment's premise ('slugs are unknown ahead of live phase_started') is the thing RESEARCH measured FALSE, so leaving it would leave a false claim on the file."
  - "D-188-04-C: a fifth test (not requested) asserts the placeholder fallback is byte-for-byte unchanged when `wf.phases` is absent. RESEARCH OQ4 proved that case unreachable against the shipped backend, which is exactly why an unexercised fallback would otherwise be a line nobody has ever read."
metrics:
  duration: ~25 min
  completed: 2026-08-05
  tasks: 3
  commits: 3
---

# Phase 188 Plan 04: The Live-Branch Identity Overlay Summary

`reconcilePhases` stopped inventing step names. The live branch's positional skeleton now takes the **real** `slug` and `phase_type` off `wf.phases` — data the server had been sending all along — while the forward-only status floor it feeds is left byte-identical, which is the entire difficulty of this plan.

## What Was Built

### Task 1 — three falsifications and a fence, observed RED (`7af820d6`)

One `describe` block, **192 insertions / 0 deletions**, and **no production source touched** — `git diff --numstat -- frontend/` for the commit lists exactly one file.

The fixture drives the **LIVE** branch (`mode: "harness"` + `lock_is_stale: false`) with `total_phases: 4`, `current_phase_index: 1`, `current_phase_slug: "draft-the-letter"`, and four real `wf.phases` rows (`collect-inputs` / `draft-the-letter` / `check-the-numbers` / `produce-the-report`, types `programmatic` / `llm_agent` / `llm_single` / `llm_emit`).

This block is the **mirror image of Plan 02's RED 2**, and the file now says so in both places. 02 had to drive the TERMINAL branch because the live one never touches `DB_PHASE_STATUS`; 04 has to drive the LIVE one because the terminal branch already carries real slugs. A test on the wrong branch would have been green before and after in either direction.

**Every DB row in the fixture reads `pending`** — deliberately behind the positional derivation, because that is the real mid-run shape (a `workflow_phases` row flips only at `complete_phase`). That single choice makes the same fixture serve three falsifications and the fence.

### Task 2 — the overlay (`fddbfb78`)

```ts
const byIndex = new Map<number, WorkflowPhaseState>(
  (wf.phases ?? []).map((r) => [r.phase_index, r]),
)
return Array.from({ length: total }, (_, i): Phase => ({
  slug:
    byIndex.get(i)?.slug ??
    (i === current ? (wf.current_phase_slug ?? `phase-${i}`) : `phase-${i}`),
  phaseIndex: i,
  phaseType: byIndex.get(i)?.phase_type ?? "unknown",
  status: i < current ? "done" : i === current ? "running" : "pending",
  subAgents: [],
  pendingAsk: null,
}))
```

**47 insertions / 6 deletions.** The six deletions, in full — nothing else was removed:

```
-  // Live/ACTIVE harness run → the existing forward-only skeleton floor (UNCHANGED):
-  // total_phases rows, the current one running. Slugs are unknown ahead of live
-  // phase_started (only current_phase_slug is known), so non-current rows carry
-  // positional placeholder slugs the live events replace.
-      slug: i === current ? (wf.current_phase_slug ?? `phase-${i}`) : `phase-${i}`,
-      phaseType: "unknown",
```

Four stale-premise comment lines plus the two identity lines. The replacement comment states the four things the plan required — that `wf.phases` is populated from t=0 (measured), that the overlay is therefore COMPLETE and D-188-22's "rows the harness has not inserted yet" clause describes an impossible case, that the join key is `phase_index` because a live slug can be a placeholder and an index cannot, and that STATUS is deliberately not overlaid, naming `PhaseTimeline.tsx:115-127`.

### Task 3 — the routing outcome (`6c749829`)

`BUG-260609-04` stays **`folded`**, not `closed`. Its `re_open_trigger` now records the code-level closure, the two corrections to what the folded note had assumed, why status is not overlaid, and the unchanged remaining condition — with an explicit instruction not to flip on the unit tests, *"they prove the reducer, not the render."*

`BUG-260609-02` stays **`open`**, trigger-only edit, with D-188-23 re-confirmed as a measurement rather than a restatement (see § Deviations 2).

## THE RAW RED — Task 1, against unmodified production source

`cd frontend && npx vitest run src/components/panel/__tests__/PhaseReconcile.test.tsx`, 2026-08-05, at commit `790d7892` with `StreamsProvider.tsx` untouched. Verbatim (ANSI stripped):

```
 RUN  v4.1.0 C:/Vibe Apps/Agentic RAG/frontend

 ❯ src/components/panel/__tests__/PhaseReconcile.test.tsx (12 tests | 3 failed) 684ms
     × a non-current EARLIER step carries its real name, not the positional placeholder 83ms
     × a non-current LATER step carries its real name too 74ms
     × every step carries its real phase type — the second, previously unrecorded half of the same bug 79ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/panel/__tests__/PhaseReconcile.test.tsx > Phase 188 — reconcilePhases LIVE branch identity overlay (BUG-260609-04 / D-188-22) > a non-current EARLIER step carries its real name, not the positional placeholder
AssertionError: the first step's real name, not a positional placeholder: expected 'phase-0' to be 'collect-inputs' // Object.is equality

Expected: "collect-inputs"
Received: "phase-0"

 ❯ src/components/panel/__tests__/PhaseReconcile.test.tsx:479:7
    477|       result.current.data[0].slug,
    478|       "the first step's real name, not a positional placeholder",
    479|     ).toBe("collect-inputs")
       |       ^
    480|     expect(result.current.data[0].slug).not.toBe("phase-0")
    481|   })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/components/panel/__tests__/PhaseReconcile.test.tsx > Phase 188 — reconcilePhases LIVE branch identity overlay (BUG-260609-04 / D-188-22) > a non-current LATER step carries its real name too
AssertionError: a later step's real name is already on the wire: expected 'phase-2' to be 'check-the-numbers' // Object.is equality

Expected: "check-the-numbers"
Received: "phase-2"

 ❯ src/components/panel/__tests__/PhaseReconcile.test.tsx:492:7
    490|       result.current.data[2].slug,
    491|       "a later step's real name is already on the wire",
    492|     ).toBe("check-the-numbers")
       |       ^
    493|     expect(result.current.data[2].slug).not.toBe("phase-2")
    494|     // And the CURRENT row keeps the name it already had (it was the o…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/components/panel/__tests__/PhaseReconcile.test.tsx > Phase 188 — reconcilePhases LIVE branch identity overlay (BUG-260609-04 / D-188-22) > every step carries its real phase type — the second, previously unrecorded half of the same bug
AssertionError: expected [ 'unknown', 'unknown', …(2) ] to strictly equal [ 'programmatic', 'llm_agent', …(2) ]

- Expected
+ Received

  [
-   "programmatic",
-   "llm_agent",
-   "llm_single",
-   "llm_emit",
+   "unknown",
+   "unknown",
+   "unknown",
+   "unknown",
  ]

 ❯ src/components/panel/__tests__/PhaseReconcile.test.tsx:507:57
    505|     // The report only ever named the slug. `phaseType: "unknown"` is …
    506|     // on the same row, and it is what drives the step's icon and its …
    507|     expect(result.current.data.map((p) => p.phaseType)).toStrictEqual([
       |                                                         ^
    508|       "programmatic",
    509|       "llm_agent",

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯


 Test Files  1 failed (1)
      Tests  3 failed | 9 passed (12)
   Start at  10:20:30
   Duration  3.76s (transform 1.09s, setup 204ms, import 1.37s, tests 684ms, environment 1.35s)
```

**Read the received values plainly.** The server had sent `collect-inputs` and the product rendered `phase-0`. It had sent `check-the-numbers` and the product rendered `phase-2`. It had sent four real phase types and the product rendered `unknown` four times. This is the operator's screenshot from 2026-06-10, reproduced in a unit test.

**The `9 passed` in that same run is the load-bearing half of this observation.** It contains the four Plan-02 cases, the two INV-4 cases, **the floor guard** and **the fallback positive control** — both of which are green *before* the fix. Three failures out of twelve, with the fence already standing, is what makes the three a measurement of the overlay rather than of a broken harness.

## THE STATUS DERIVATION IS BYTE-UNCHANGED — grepped, not argued

The single highest-risk line in the plan. Verified three independent ways:

```
$ git diff -U0 -- frontend/src/providers/StreamsProvider.tsx | grep -E '^[+-]' | grep 'i < current'
(none — the ternary appears on NO changed line)

$ git show HEAD:frontend/src/providers/StreamsProvider.tsx | grep -c 'i < current ? "done" : i === current ? "running" : "pending"'
1
$ grep -c 'i < current ? "done" : i === current ? "running" : "pending"' frontend/src/providers/StreamsProvider.tsx
1
```

One occurrence before, one after, and git itself reports it on neither side of the diff. **This is the whole reason for D-188-04-A:** hoisting `byIndex.get(i)` into an arrow block body would have re-indented that line by two spaces, and the criterion would have degraded from a grep anyone can re-run into a claim a reviewer has to accept.

The **behavioural** half is fenced separately, by the guard in the test file: the fixture's DB rows all read `pending` while `current_phase_index` is 1, and index 0 must still reconcile to `done`. An "overlay everything" refactor passes the grep above only if it also deletes that line — and then it fails the guard.

## Verification

| Criterion | Result |
|---|---|
| The defect observed RED on unmodified source, raw output in this summary | ✅ above — 3 failed / 12, both fences green in the same run |
| `npx vitest run src/components/panel/__tests__/PhaseReconcile.test.tsx` exits 0 | ✅ **12 passed (12)** |
| The Plan-02 falsifications + INV-4 cases still pass | ✅ all 7 pre-existing tests green |
| `npx vitest run src/components/panel/__tests__/PhaseTimeline.test.tsx` (the counter the floor feeds) | ✅ **20 passed (20)** for the pair |
| `npx vitest run src/components/panel/__tests__/` exits 0 | ✅ **12 files · 154 passed (154)** |
| `npx vitest run src/providers` (no reducer collateral) | ✅ **6 files · 59 passed (59)** |
| The positional status ternary is byte-unchanged | ✅ on no `+`/`-` line; 1 occurrence before and after |
| `grep -c 'phase_index' StreamsProvider.tsx` — the join key is present | ✅ **8** (was 6 at HEAD — the Map construction + the type-import comment) |
| `npx tsc --noEmit -p tsconfig.app.json` reports 33 | ✅ **33** — and the error **set** is byte-identical to the pre-edit baseline (`diff` of the two full outputs is empty), not merely the same count |
| `node scripts/vitest-count-gate.cjs` exits 0, `failed` 0, no per-file decrease | ✅ **total 2216 · failed 0 · pinned 1037 · 26/26**; was 2211, `PhaseReconcile.test.tsx` printed `2 → 12  +10` |
| Task-2 deletions on `StreamsProvider.tsx` are only the stale comment + the 2 identity lines | ✅ `--numstat` **47 / 6**, all six enumerated above |
| `BUG-260609-04`: `status: folded` = 1, `status: closed` = 0, contains `188-04`, `verified_closed_by: null` present | ✅ 1 / 0 / 1 / 1 |
| `BUG-260609-02`: `status: open` = 1, contains `D-188-23` | ✅ 1 / 1 |
| Both reports' frontmatter still parses as valid YAML after the trigger edits | ✅ 15 frontmatter lines each; triggers parse as single double-quoted scalars (3563 / 1419 chars) |
| `git diff --name-only HEAD -- supabase/migrations/` empty | ✅ zero migrations |
| No `git add -A` / no `.planning/STATE.md` staged | ✅ every commit staged by explicit path; the pre-existing `.claude/**` dirt is untouched |

## Deviations from Plan

### 1. [D-188-04-A] The Map lookup is read twice, against the obvious refactor

The plan's action says *"build a `Map<number, WorkflowPhaseState>` … then in the `Array.from` callback overlay identity only"*, which reads most naturally as hoisting `const row = byIndex.get(i)` into a block-bodied arrow. That would have re-indented `status:` by two spaces and put it on a `+`/`-` line — silently converting the plan's own acceptance criterion (*"verify with `git diff` that no line containing that ternary is modified"*) into something unverifiable. The expression body was kept and `byIndex.get(i)` is read twice. The cost is one extra O(1) lookup per phase on a handful of phases; the gain is that the criterion is a command, not a claim. The reason is stated in the source comment so the next reader does not "clean it up".

### 2. [Rule 2 — completeness] BUG-260609-02's note is a measurement, not a restatement

The plan asked to *"append a dated 2026-08-05 note recording the D-188-23 review"*. Measured first: the trigger **already** carried a 2026-08-05 D-188-23 note from `/gsd:discuss-phase`, so both acceptance greps were already satisfied at HEAD and a paraphrase would have added a second sentence saying the same thing. What was appended instead is the *plan-level* confirmation the `/gsd:plan-phase` obligation actually calls for, with the claim checked rather than repeated: 188-04's whole diff is the live branch plus its test file, `subAgents: []` appears on no changed line, and no sub-results render site (`BatchResultList.tsx`, `WorkspacePanel.tsx`) is touched.

### 3. [Rule 2 — completeness] A fifth test the plan did not request

`POSITIVE CONTROL — with no phases on the wire the placeholder fallback is byte-for-byte unchanged`. RESEARCH OQ4 proves this path unreachable against the shipped backend, which is precisely the argument under which the publish gauntlet's `findIndex → -1` fail-open shipped (188-02's own lesson, third occurrence). The kept `?? phase-${i}` tails are now exercised rather than asserted, and the test pins that `total_phases` still governs the array length.

### 4. Measured correction to the plan's predicted test count

The plan's Task-1 criteria imply the file reaches 11 tests. It reaches **12** (7 + 5, the fifth being deviation 3). The RED-observation comment inside the file was corrected to `12 tests | 3 failed` *after* the run rather than left at its drafted figure — recorded here rather than silently fixed, per the project's *don't inherit unmeasured claims* rule.

### 5. No `git stash` was used

188-02 recorded a process deviation for using `git stash` to obtain a pre-edit `tsc` baseline. This plan took the baseline **before** editing (`tsc-baseline.txt` in the scratchpad, captured at `790d7892` with a clean `frontend/src`) and diffed the full error set against it afterwards — the sanctioned alternative that summary itself recommended. The error set is identical, which is a stronger statement than "still 33".

## Known Stubs

None. Every line written is live: the overlay is in the shipped `reconcilePhases`, and all five new tests drive the real `usePhases` through a mounted real `StreamsProvider`.

## Threat Flags

None. Both register entries were handled as specified:

- **T-188-04-01** (tampering of meaning — a status overlay moving the counter backward) — **mitigated**. Identity only; the ternary is byte-unchanged by grep, and the behavioural fence (a fixture whose DB rows lag the counter) is green before and after.
- **T-188-04-02** (XSS via overlaid `slug` / `phase_type`) — **accepted as planned**. No new render site: `PhaseCard` renders both as plain React text children, and these are the same server-authored strings the terminal branch has surfaced since Phase 098.
- **T-188-SC** (supply chain) — **accepted**. Zero packages installed; `package.json` and both lockfiles untouched.

No security-relevant surface outside the register: no endpoint, no auth path, no file access, no schema change. `git diff --name-only HEAD -- supabase/migrations/` is empty.

## Commits

| Task | Commit | Files | Diff |
|---|---|---|---|
| 1 | `7af820d6` | `PhaseReconcile.test.tsx` | +192 / −0 |
| 2 | `fddbfb78` | `StreamsProvider.tsx` | +47 / −6 |
| 3 | `6c749829` | `BUG-260609-04.md`, `BUG-260609-02.md` | +2 / −2 |

## Notes for the Next Plan

- **BUG-260609-04 is closed in CODE, not in STATUS.** The report is still `folded`. The only remaining condition is the live single-phase run in `188-UAT.md` (Plan 12's operator gate) showing the real step name with no `phase-N` on screen. The trigger says in as many words: the unit tests prove the reducer, not the render.
- **188-05 inherits an overlay it must not drop.** The `DB_PHASE_STATUS` → `lib/phaseState.ts` extraction touches this exact function. The live branch now reads `wf.phases`; moving the status map out must leave `byIndex` and both `?.` reads intact, and the floor guard is what will catch it if not.
- **`PhaseReconcile.test.tsx`'s count-gate pin is now stale-low at 2 while the file runs 12.** 188-02 already flagged this at 7. Ten cases — including all five falsifications this phase has written — sit in gate slack and are deletable with the gate green. **Re-pin it at its printed `actual` before the phase closes**; this is verbatim the Phase-187 "truth 14" situation.
- **The live branch still synthesises `status` positionally**, and that is now a deliberate, documented, twice-fenced choice rather than an accident. Any future plan tempted to "finish the job" by overlaying status must first answer what happens to `PhaseTimeline.tsx:115-127` when a DB row lags.
- **`subAgents: []` and `pendingAsk: null` are still hardcoded on both branches.** Untouched here and out of this plan's scope, but that is the field BUG-260609-02 lives on.

## Self-Check: PASSED

- All four modified files exist on disk: `frontend/src/providers/StreamsProvider.tsx`, `frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx`, `.planning/reported-bugs/BUG-260609-04.md`, `.planning/reported-bugs/BUG-260609-02.md` — plus this summary.
- All three commits resolve in `git log`: `7af820d6`, `fddbfb78`, `6c749829`.
- `git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty — this plan deleted no file.
</content>
</invoke>
