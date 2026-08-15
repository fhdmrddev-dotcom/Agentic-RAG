---
phase: 194-stop-a-running-workflow
plan: 03
subsystem: frontend-panel
tags: [run-control, stop, workspace-panel, g-5, fence, honesty]
requires:
  - "useStreamActions().stopThread — StreamsProvider.tsx:2400-2415 (the ONE durable cancel path)"
  - "the shipped showTimeline harness gate — WorkspacePanel.tsx"
  - "lucide Square — the shipped Stop-CONTROL mark (MessageInput.tsx:420, ActiveRunsTray.tsx:132)"
provides:
  - "data-testid=panel-stop-run — the PRIMARY Stop on the workflow run surface"
  - "F-1 / V-05 — the union-scoped no-cancel-through-the-lock fence"
affects:
  - "frontend/src/components/panel/WorkspacePanel.tsx"
  - "frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx"
  - "frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx"
tech-stack:
  added: []
  patterns:
    - "S5 the additive-sibling frontend mount (the G-5 red line)"
    - "S6 ?raw source fences — extended to a THREE-DIRECTORY import.meta.glob union"
decisions:
  - "The Stop resolves through stopThread(threadId), never workflowLock.runId — the lock carries two id types and cancelRun swallows 404, so a lock-wired Stop is a silent success that stops nothing"
  - "lucide Square is a REUSE, not a choice — the panel is the third occurrence of one mark for one concept; ⏹ and ■ both refused"
  - "The ninth mock key ships in the RED commit, one commit EARLIER than the plan's 'same commit' wording — strictly safer"
  - "The F-1 sweep is RAW, not comment-stripped (the 193 D-24(a) precedent), affordable only because the union contains zero cancelRun occurrences today"
key-files:
  created: []
  modified:
    - "frontend/src/components/panel/WorkspacePanel.tsx (+88/−1)"
    - "frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx (+266/−0)"
    - "frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx (+10/−0)"
metrics:
  duration: "~35 min"
  completed: 2026-08-16
  tasks: 2
  commits: 3
---

# Phase 194 Plan 03: The Primary Panel Stop Summary

A user watching a workflow run in the workspace panel can now stop it from the panel — one
`useStreamActions` import and one additive-sibling control inside the shipped `showTimeline`
gate, resolving through `stopThread(threadId)` so the id-type landmine cannot fire — plus a
three-directory union fence driven RED five times against real production-source plants.

---

## What shipped

| # | Commit | What |
|---|---|---|
| 1 | `d39a0513` | `test(194-03)` — the RED gate: 7 V-04 cases + the NINTH mock key in **both** panel test files |
| 2 | `580d3f60` | `feat(194-03)` — the mount |
| 3 | `ad166d45` | `test(194-03)` — the F-1 / V-05 union fence |

**Base asserted:** `3f2d564181d38216aea933672b7dd5ddf044b904`.
⚠ **The worktree forked from the WRONG base and was corrected before any commit** — `git merge-base`
returned `3781a3fe`, and HEAD sat on `fda79214` (*"Merge develop into master"*). This is the failure
mode `CLAUDE.md` records as 12/12 in Phase 192 and again on a single worktree on 2026-08-14; the
`<worktree_branch_check>` `git reset --hard` corrected it and `git rev-parse HEAD` then read
`3f2d5641` exactly. **The assertion is not ceremony — it fired.**

---

## Task 1 — the mount (V-04)

**The control:** a run-level row inside the shipped `showTimeline` gate, a sibling of the run soul
and the run receipt. Lead word `This run`, a destructive-token button carrying the lucide `Square`
plus the word `Stop`, `aria-label="Stop this workflow run"`, `data-testid="panel-stop-run"`.

It is mounted at **run level and deliberately not inside or beside any individual phase row**, so it
cannot be misread as skipping a step (the Claude's-discretion constraint from CONTEXT).

**The id, which is the whole point.** `WorkflowLock.runId` carries two id types across its write
sites; `DELETE /runs/{id}` accepts only the producer id; and `cancelRun` swallows 404 deliberately.
Compose those three and a lock-wired Stop **silently succeeds while doing nothing**. The handler
therefore passes the **thread** id and lets `stopThread` resolve the producer id itself.

### The gates, measured

| Gate | Baseline (`194-BASELINE.md`) | After | Verdict |
|---|---|---|---|
| `WorkspacePanel.test.tsx` + `.derived.test.tsx` | 45 + ~4 | **57 passed / 0 failed** | ✅ |
| `tsc -p tsconfig.app.json --noEmit` | **33** | **33** | ✅ unmoved |
| count gate | `OK` · total 3918 · failed 0 · pinned 3868 · 75/75 | `count gate OK` · total **3930** · failed **0** · pinned total 3868 · **75/75** | ✅ (+12 = this plan's 12 new cases; a growing total is the gate WORKING) |

`failed` was **0 on the first run** of both the suite and the count gate, so no filename capture and
no second run was owed — recorded explicitly because `193.2-02` broke that rule and could not
afterwards prove its failures innocent.

### G-5 (D-01) — honoured BY CONSTRUCTION, stated as measurement rather than assertion

`WorkspacePanel.tsx` re-derived at HEAD: **14 commits / 9 phases** (`087 088 094 095.1 100 124 155
188 194`, zero quick-task buckets) **/ 580 L** — was `13 / 8 / 493` at `743965a1`. G-5 fires on the
count and no refactor is owed, because the mount adds **no second concern**:

| Figure | Before | After |
|---|---|---|
| `useState[(<]` call sites | **4** | **4** |
| `useEffect(` call sites | **3** | **3** |
| `fetch(` occurrences | **0** | **0** |
| props on `WorkspacePanelProps` | **5** | **5** |
| deleted lines in the file | — | **1** |

The single deleted line is `import { PanelRightClose, X } from "lucide-react"`, re-added with
`Square`. **No existing logic, gate or sibling was modified** — a modification would have produced a
second deleted line.

`git diff --numstat` against the base shows **0 deletions in both test files**, which is the
mechanical proof that no pre-existing assertion was edited.

### Acceptance greps

```
grep -c 'data-testid="panel-stop-run"'                        → 1
grep -c 'stopThread(threadId)'                                → 1
grep -cE "workflowLock\??\.runId|cancelRun\("                 → 0
```

⚠ **`stopThread(threadId)` read `2` on the first measurement, and it was the DOCBLOCK.** The first
draft of the mount's comment block quoted the call verbatim, so a grep meant to count the *wiring*
counted the *prose* instead. This is the 187-24 lesson that `RunSeam`'s own docblock ten lines above
already records about its label constant — and it was caught **by running the count, not by reading
it**. The comment now says so, on the spot, rather than being quietly reworded.

---

## Task 2 — the F-1 / V-05 fence

Scoped over the **union of the three mount directories** — `components/panel/`, `components/chat/`,
`components/workflows/` — each globbed **separately** via `import.meta.glob(..., {eager, ?raw})` and
each proved non-empty **by a named shipped file** (`WorkspacePanel.tsx`, `MessageItem.tsx`,
`ActiveRunsTray.tsx`, `WorkflowCanvas.tsx`), so a wrong glob for one directory cannot hide behind
another directory's files. Test sources are filtered out — a fence that swept its own file would red
on its own prose.

**Two clauses:**
- **(a)** no `cancelRun(` call site anywhere in the union — the only two production call sites are
  `StreamsProvider.tsx:2389`/`:2411`, and every mount routes through those (D-08: four mounts, ONE
  mechanism).
- **(b)** no lock `runId`, in any spelling (`workflowLock.runId` / `workflowLock?.runId` /
  `lock.runId`), reaches `cancelRun(` / `stopThread(` / `stopStream(`.

**The carve-out is proved, not assumed:** `continueRun` is deliberately absent from the cancel-call
needle, and a dedicated case asserts `MessageItem.tsx`'s shipped
`continueRun(workflowLock.runId)` is present in the sweep and green under the fence. `/continue` is
the one route with the dual-id fallback, which is exactly why that read is correct and a cancel is
not. A fence forbidding the identifier outright would have redded on shipped, correct code and been
rewritten to uselessness on its first run.

### RED observations — five plants, every file restored md5-identical

| # | Plant (production source) | Clause(s) RED | Failing output |
|---|---|---|---|
| 1 | `WorkspacePanel.tsx:461` → `void cancelRun(workflowLock.runId)` | **(a) + (b)** | `expected [ '../WorkspacePanel.tsx' ] to deeply equal []` |
| 2 | `WorkspacePanel.tsx:461` → `void cancelRun(workflowLock?.runId)` | **(a) + (b)** | `+ "../WorkspacePanel.tsx:461  onClick={() => void cancelRun(workflowLock?.runId)}"` |
| 3 | `chat/MessageList.tsx:178` → `void cancelRun(msg.runId)` | **(a)** | `+ "../../chat/MessageList.tsx"` |
| 4 | `workflows/WorkflowCanvas.tsx:588` → `void cancelRun(runState?.runId)` | **(a)** | `+ "../../workflows/WorkflowCanvas.tsx"` |
| 5 | `WorkspacePanel.tsx:461` → `void streamActions.stopThread(workflowLock.runId)` | **(b) ALONE** | `+ "../WorkspacePanel.tsx:461  onClick={() => void streamActions.stopThread(workflowLock.runId)}"` |

**md5 before → after every revert (all three files, verified after the last plant):**

```
frontend/src/components/panel/WorkspacePanel.tsx      e6b1d1050cf0ef303847f9c9d8d4816e  (unchanged)
frontend/src/components/chat/MessageList.tsx          c2ab248a096ac002d3a31897da7db0b7  (unchanged)
frontend/src/components/workflows/WorkflowCanvas.tsx  efe48905579150e8540520ca310e55f5  (unchanged)
```

⚠ **Plant 5 is the sharpest piece of evidence here and it was not in the plan.** The plan requires
four plants; plants 1–4 all red on clause (a), which would have left clause (b) **inert and
indistinguishable from live** — the precise failure this project shipped five times in Phase 193.2,
four in 193.1, three in 192.1 and five in 190. Plant 5 (`stopThread` with the lock's id — a real
naive-wiring shape, not a synthetic one) reds **(b) with (a) green**, which is the only available
proof that clause (b) is not redundant.

### The empty-sweep control — mechanised, and it taught something

Narrowing the workflows glob to `../../workflows-renamed/**` reds the count assertion at
`AssertionError: expected 0 to be greater than 0`.

⚠ **Under that narrowing, clauses (a) and (b) BOTH STAYED GREEN with a third of the union
invisible.** That is not a footnote — it *is* Phase 192.1's *"renamed module swept against the empty
string and passed green"*, reproduced on demand in this repository. The absence assertions cannot
detect their own blindness; only the named-file count guard can, which is why it is a separate case
that runs first.

A sixth case asserts the two regex needles themselves are live (both `?.` spellings, all three
cancel calls) **and** that they do not match their innocent neighbours (`msg.runId`,
`await continueRun(workflowLock.runId)`) — so a typo making either needle unmatchable could never
read as *"the tree is clean"*.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] `WorkspacePanel.derived.test.tsx` needed the ninth mock key too**
- **Found during:** Task 1
- **Issue:** The plan's `files_modified` names only `WorkspacePanel.tsx` and `WorkspacePanel.test.tsx`,
  but the plan's own `<action>` says *"Do the same for `WorkspacePanel.derived.test.tsx` if it carries
  its own copy of the mock."* It does — an explicit eight-key literal at `:42-51`. It renders the
  **real** `WorkspacePanel`, so the component reading `useStreamActions` throws the entire file.
- **Fix:** ninth key added, shipped in the RED commit.
- **Commit:** `d39a0513` (key) / `580d3f60` (the TS2556 fix below)

**2. [Rule 1 - Bug] TS2556 from a zero-arity mock stub — typecheck read 34, not 33**
- **Found during:** Task 1, at the typecheck gate
- **Issue:** `const useStreamActions = vi.fn(() => ({...}))` is zero-arity, and the mock **spreads**
  its args into it → `error TS2556: A spread argument must either have a tuple type or be passed to a
  rest parameter`. The baseline is 33; this read **34**.
- **Fix:** `vi.fn((..._a: unknown[]) => ({ stopThread: vi.fn() }))`, with the reason recorded inline
  so the rest parameter does not later look like clutter. Back to **33**.
- **Commit:** `580d3f60`

**3. [Rule 3 - Blocking] Vite rejects a shared options `const` in `import.meta.glob`**
- **Found during:** Task 2
- **Issue:** `import.meta.glob(pattern, SWEEP_OPTS)` fails at transform time —
  *"Invalid glob import syntax: Expected the second argument to be an object literal, but got
  Identifier"*. The transform is static.
- **Fix:** the options literal is inlined at each of the three calls, with a comment stating that the
  repetition is **required, not sloppy**.
- **Commit:** `ad166d45`

### Deliberate departures from the plan's letter

**A. The ninth mock key ships in the RED commit, not the GREEN one.** The plan says *"in the same
commit as the component change."* Under `tdd="true"` the RED gate must be a separate `test(...)`
commit, so the key landed one commit **earlier**. This is strictly safer and satisfies the plan's
actual intent: **no commit exists in which the component reads a hook its mock omits.** A mock
carrying an unused key is inert; a component reading a missing one throws.

**B. A fifth plant beyond the four the plan requires.** See Task 2 — plants 1–4 would have left
clause (b) unproven. Extra evidence, never a substitution: all four required plants were driven and
recorded.

**C. The F-1 sweep is RAW, not comment-stripped.** The plan does not specify. RAW is the stronger
choice (the Phase 193 D-24(a) precedent — a docblock quoting a forbidden call is caught too) and is
affordable **only because it was measured**: `grep -rn "cancelRun" <union>` returns nothing today.
The consequence is written into the fence: anyone needing to discuss the forbidden call in a union
docblock writes it without its parenthesis. The mount's own docblock was authored under that rule
(`grep -cE "cancelRun\(" → 0`).

### Not deviations, stated so a reader does not have to infer them

- **No package was added.** No toast library; `T-194-03-SC` is satisfied by construction.
- **Mount 4 was not touched** — nothing under `pages/WorkflowsPage.tsx` or
  `components/workflows/library/` is in this plan's diff (D-16, descoped).
- **`STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` are untouched.** No `gsd-sdk state.*`,
  `roadmap.update-plan-progress` or `requirements.mark-complete` verb was invoked. `git status`
  after the final commit shows only `.claude/settings.local.json` (a harness file, pre-existing and
  restored across the base correction — not this plan's).
- **No `git clean`, no `git stash`, no `rm -rf`.** The only `git reset --hard` is the sanctioned
  startup base correction.

---

## Threat model — dispositions honoured

| Threat ID | Disposition | Evidence |
|---|---|---|
| `T-194-03-01` Spoofing (of success) | **mitigated** | The mount resolves via `stopThread(threadId)`; `grep -cE "workflowLock\??\.runId\|cancelRun\("` → **0**; F-1 driven RED five times |
| `T-194-03-02` Elevation of Privilege | **transferred** | The client sends a thread-scoped resolution only; ownership stays server-side (plan 194-11) |
| `T-194-03-03` DoS via a stray Stop | **mitigated** | The control lives inside the shipped `showTimeline` gate; the Deep / no-run and empty-short-circuit cases assert `queryByTestId("panel-stop-run")` is null, each with a POSITIVE control (`phase-timeline` absent, `todos-section` present) so the absence measures the control and not the fixture |
| `T-194-03-SC` Tampering via npm | **mitigated** | No package added; `package.json` is not in the diff |

**Threat flags:** none. No new network endpoint, auth path, file access pattern or schema change —
the plan adds a client control over a route that already ships.

---

## Known stubs

None. The control is wired to the real resolver; no placeholder value, empty literal or
"coming soon" string was introduced.

---

## Honest caveats — what this plan did NOT prove

1. **The two negative V-04 cases passed at the RED gate** (5 failed / 47 passed), because nothing
   rendered yet. A negative assertion that is green before the feature exists is not evidence on its
   own; it became evidence only once the five positives went green in `580d3f60`. Both carry positive
   controls precisely so the absence is attributable to the control and not to the gate.
2. **`stopThread`'s own silent no-op window is untouched by this plan.** `StreamsProvider.tsx:2408`
   early-returns on a falsy `runId` — between the optimistic placeholder and the kickoff stamp, a
   click resolves to nothing and says nothing. PATTERNS § 8 flags it (*"Make it observable or disable
   the control until the id lands"*) and it is **out of this plan's scope**; the panel Stop inherits
   that window exactly as the composer and tray Stops do. It belongs to whichever plan owns SC#2's
   honesty surface.
3. **No browser UAT was driven.** V-04/V-05 are automated rows; the G-4 lived-experience rows for
   this control are owed at phase verification.
4. **The `CLAUDE.md` hot-file ledger row for `WorkspacePanel.tsx` is NOT written here** — that is
   D-02, owned by another plan. This summary records the re-derived triple (`14 / 9 / 580`) so that
   plan inherits a measurement instead of re-deriving it. ⚠ It will go stale on the next commit that
   touches the file, which in this repository has been *the same afternoon*.

---

## Self-Check: PASSED

```
FOUND: frontend/src/components/panel/WorkspacePanel.tsx
FOUND: frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx
FOUND: frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx
FOUND: d39a0513   test(194-03): add failing V-04 cases … plus the NINTH mock key
FOUND: 580d3f60   feat(194-03): mount the primary Stop on the workflow run surface
FOUND: ad166d45   test(194-03): the F-1 / V-05 union fence
```
