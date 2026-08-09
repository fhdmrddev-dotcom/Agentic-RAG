---
phase: 186-concurrency-autosave
plan: 06
subsystem: frontend
tags: [react-hook, autosave, debounce, single-flight, optimistic-concurrency, discriminated-union, source-fence]

# Dependency graph
requires:
  - phase: 186-03
    provides: "`updateWorkflowDraft(id, def, token?, signal?)` returning `WorkflowDraftWriteResult`, the `If-Match` echo, and the three named refusals (`WorkflowStaleTokenError.currentToken`, `WorkflowConflictError`, `WorkflowDraftUnreadableError`)"
  - phase: 186-04
    provides: "the reworded D-184-05 fence in `builderStore.ts` naming THIS file as the write's home, and `setProjectFolder` which arms `dirty` on a meta-only edit"
  - phase: 184-editable-canvas
    provides: "`useLiveValidation` (the composition to mirror), the shipped `onPersist` create-once guard, `builderStore`'s `dirty`/`markSaved` contract"
provides:
  - "`useDraftPersistence` — the whole draft write seam as one testable hook"
  - "`AUTOSAVE_DEBOUNCE_MS = 1000` with its stated reason and its stated LIMIT"
  - "`HOLD_PUBLISHING` / `HOLD_UNREADABLE` — the two hold sentences, one home each"
  - "`SAVE_FAILED_SENTENCE` — the cause-neutral refusal line (net-new export, see Deviations)"
  - "`PersistState` — the six-arm discriminated union the page renders"
affects:
  - "186-07 (composes the hook into `WorkflowBuilderPage.tsx`; renders the sentences and must not re-declare them)"
  - "186-08 (the promoted KB chip's `setProjectFolder` edit flows through this loop)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A single-flight write queue (inFlightRef / pendingRef / tokenRef) replacing the read-hook's abort belt — writes are serialized, never cancelled"
    - "Flush-on-release instead of retry-on-a-timer for a hold that can last minutes"
    - "A hold condition mirrored into a ref and read at FIRE time, deliberately kept OUT of the debounce effect's dependency array"

key-files:
  created:
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
  modified: []

key-decisions:
  - "`markSaved` is skipped when a newer edit is already queued behind a confirmed write — otherwise the first turn of the drain files a receipt for a payload the person has already superseded. This is the F8 rule applied to the queue, not just to refusals."
  - "A `dirty` gate on the debounce fire path (net-new, Rule 2). Without it, merely OPENING a draft PATCHes it, bumping the row and invalidating every other tab's token — the hook would manufacture exactly the conflict the phase exists to prevent."
  - "`overwrite` re-enters the ONE writer (adopt token → clear halt → `performWrite`) rather than issuing its own request, which is what keeps the receipt action at exactly one caller and makes a second-race refusal fall back into `conflict` for free."
  - "The published-row 409 (`WorkflowConflictError`) lands in the cause-neutral branch. The hook does NOT mint a second spelling of the page's `PUBLISHED_CONFLICT_MESSAGE` — flagged for 186-07."
  - "Three planner greps were unsatisfiable as literally written; each was replaced by a measurement of the PROPERTY it protects (see Deviations)."

patterns-established:
  - "A falsification run BEFORE the guard exists: the hook was first written with the in-flight guard removed and a date-parse planted, so F9 and F15 failed on real assertions rather than on an unresolvable import"

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-08-01
---

# Phase 186 Plan 06: `useDraftPersistence` — the write seam gets one testable home

**The persistence seam Phase 184 deliberately parked on a 1656-line page is now a 531-line hook: one debounce, one writer, at most one request outstanding, a token chain that never parses what it carries, two hold sentences on one mechanism, and a conflict that stops the loop dead and hands the person both exits.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files:** 2 created, 0 modified — 1174 insertions, 0 deletions
- **Tests:** 0 → **22**, all in one new co-located suite

## Accomplishments

- **One hook owns the whole seam (D-186-05).** Create-once-then-PATCH, the debounce timer, the saved/held/conflict/error state, the concurrency token, the hold conditions and every refusal branch. `builderStore.ts`'s reworded D-184-05 fence — which 186-04 pointed at `frontend/src/hooks/useDraftPersistence.ts` by name — is now true rather than aspirational.
- **At most ONE write is outstanding, ever.** `inFlightRef` / `pendingRef` / `tokenRef`: an edit that lands mid-flight sets a flag rather than issuing a second request, and the completion drains exactly one follow-up carrying the token the previous write returned. The suite asserts the invariant directly by counting concurrent entries into the mock, not just by counting calls.
- **No request this module issues is cancellable.** The one deliberate divergence from `useLiveValidation`, stated in the docblock in prose: cancelling cancels the client's interest, not the server's execution, and a cancelled write that still committed has consumed the token — the next save would then be refused as stale against the person's own change.
- **The token is bytes.** It is echoed and never inspected. A `?raw` source fence asserts no date-parsing call form exists in the module, with a positive control (it finds a planted parse) **and** a negative control (it leaves the docblock's own prose about dates alone).
- **One hold mechanism, two sentences.** `HOLD_PUBLISHING` (D-186-12) and `HOLD_UNREADABLE` (D-186-04) computed by one `useMemo`, mirrored into a ref, read at fire time, and never in the debounce effect's dependency array. Release **flushes** exactly one write carrying the latest definition; it does not re-arm a timer, because a publish runs for minutes.
- **A conflict halts the loop dead.** Three further edits after a stale-token refusal issue nothing at all. Reload (the default) reuses the shipped owner-scoped drafts read and adopts the row's token; Overwrite (a deliberate second click) re-enters the same writer with the token the refusal carried. Neither is ever invoked from inside the hook.
- **Never a false receipt, in two places.** A refusal of any kind leaves `dirty` armed and calls nothing — and so does a confirmed write that a newer edit has already superseded. The second half is not in the plan text; it is the same rule applied to the queue the plan asked for.

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The hook's core — one timer, one writer, never two PATCHes (F9, F15) | `e7fa55cb` |
| 2 | One hold mechanism, two sentences — and never a false `Saved ✓` (F8, F11) | `49b4982e` |
| 3 | Conflict halts the loop, and both escape hatches exist (F10) | `696791a2` |

## RED evidence — every guard observed failing before it could pass

Recorded verbatim from the runs.

### Task 1 — two separate REDs, the second a deliberate falsification

**RED 1 (the suite before the module).**

```
Error: Failed to resolve import "./useDraftPersistence?raw" from "src/hooks/useDraftPersistence.test.tsx". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

**RED 2 (the falsification — the stronger one).** The hook was then written with the in-flight guard **removed** from the fire path and `const _tokenAge = new Date(tokenRef.current ?? "").getTime()` **planted** in it, so both guards failed on real runtime assertions rather than on a collection error:

```
FAIL  F9  › holds the second edit rather than issuing a second PATCH…
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
FAIL  F9  › files no receipt for a save a newer edit already superseded
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
FAIL  F15 › names no date-parsing call form anywhere in the module
AssertionError: expected '/**\n * Phase 186-06 (CONCUR-01 / CON…' not to match /new Date\(|Date\.parse\(/
```

Both guards restored → `Tests 8 passed (8)`.

> This is the 185 lesson applied: *observe the falsification RED first*. An unresolvable import proves the file is absent; it proves nothing about whether the assertion can distinguish a correct hook from a broken one. The planted-defect run does.

### Task 2 — F8 and F11

```
 Test Files  1 failed (1)
      Tests  5 failed | 11 passed (16)

F8      AssertionError: expected { kind: 'error', …(1) } to deeply equal { kind: 'error', sentence: undefined }
F11     AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times   (×2)
F11     AssertionError: expected { kind: 'error', …(1) } to deeply equal { kind: 'held', sentence: undefined }
saveNow AssertionError: expected true to be false
```

GREEN → `Tests 16 passed (16)`.

### Task 3 — F10

```
 Test Files  1 failed (1)
      Tests  6 failed | 16 passed (22)

F10 AssertionError: expected { kind: 'error', …(1) } to deeply equal { kind: 'conflict', …(1) }
F10 AssertionError: expected 'error' to be 'conflict'                            (×2)
F10 AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times     ← further edits kept PATCHing
F10 TypeError: h.view.result.current.overwrite is not a function
F10 TypeError: h.view.result.current.reload is not a function
```

GREEN → `Tests 22 passed (22)`.

**Counts at the three required points: 8 → 16 → 22.** Strictly increasing at every task, as the plan required.

## The exported sentences — verbatim, for 186-07

**186-07 renders these and must not re-declare them.** Copy the identifiers, never the strings.

| Export | Value |
|---|---|
| `HOLD_PUBLISHING` | `Publishing — changes will save when it finishes` |
| `HOLD_UNREADABLE` | `Not saved — we can't read this shape yet` |
| `SAVE_FAILED_SENTENCE` | `Not saved — we couldn't complete the save` |
| `AUTOSAVE_DEBOUNCE_MS` | `1000` |

## The hook's final public signature

Identical to the plan's `<interfaces>` block **except for two additive changes**, both listed in Deviations:

```ts
useDraftPersistence(args: {
  definition: BuilderDefinition | null
  enabled: boolean
  initialDraftId: string | null
  initialToken: string | null
  store: BuilderStore
  publishInFlight: boolean
  validationCause: "unreadable" | "unreachable" | null
  onDraftCreated: (id: string) => void
}): {
  state: PersistState
  draftId: string | null
  saveNow: () => Promise<boolean>
  reload: () => Promise<void>
  overwrite: () => Promise<void>
}

type PersistState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "held"; sentence: string }
  | { kind: "conflict"; currentToken: string | null }
  | { kind: "error"; sentence: string }
```

Nothing was renamed. `SAVE_FAILED_SENTENCE` is a fourth export the plan's artifact list did not name; the six state arms are exactly as declared.

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/hooks/useDraftPersistence.test.tsx` | **22 passed** |
| `npx tsc -b --force` total errors | **33** == baseline |
| …of which name a touched file | **0** |
| `npx vite build` | **exit 0**, built in 4.82 s |
| `git diff --name-only HEAD~3 HEAD -- backend/ supabase/migrations WorkflowCanvas.tsx canvasNudge.ts WorkflowBuilderPage.tsx lib/api.ts` | **0 files** — every fence held, the page is untouched, no new API function |
| Files changed by this plan | exactly the two the plan names |
| The wider clean subset (the 7 files 186-04 measured at 214) | **219 passed** — non-decreasing (186-05 added 5) |
| Same 7 + `useLiveValidation.test.tsx` | **239 passed**, 0 failed |
| Post-commit deletion check (all three commits) | **0 tracked files deleted** |
| Untracked files left behind | none |

### Grep criteria — measured

| Criterion | Measured | Note |
|---|---|---|
| `grep -c "AbortController"` | **0** | prose says "abort belt" / "abort-controller" — see Deviation 1 |
| `grep -cE "new Date\(\|Date\.parse\("` | **0** | |
| `grep -c "markSaved()"` | **1** | one caller, on the confirmed-write path; prose never writes the call form |
| `grep -c "instanceof"` | **0** | classification by `name`; prose says "constructor-identity check" — Deviation 1 |
| `grep -c "haltedRef"` | **10** | ≥ 3 required |
| `grep -c "HOLD_PUBLISHING\|HOLD_UNREADABLE"` | **5** | ≥ 4 required (2 exports + 3 docblock/code mentions) |
| second declaration of `HOLD_PUBLISHING` anywhere in `frontend/src` | **none** | one `export const`, in this file |
| `grep -c "\[definition, enabled\])"` | **1** | Deviation 2 |
| any dependency array containing `validation` / `publishInFlight` / `token` **alongside** `definition` | **none** | the five other arrays are `[onDraftCreated]`, `[publishInFlight, validationCause]`, `[store]`, `[holdReason, store, performWrite]`, `[performWrite]` |
| `grep -c "listDraftWorkflows("` | **1** | one call site — Deviation 3 |
| test file uses `await vi.importActual` and spreads it | **yes** | |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Three acceptance greps forbid the very prose the plan asks the docblock to write**

- **Found during:** Tasks 1 and 2.
- **Issue:** The plan says `grep -c "AbortController"` must return **0** *"and the docblock explains why in prose"*; and `grep -c "instanceof"` must return **0** while the analog's idiom is literally named after not using it. Writing either identifier in a comment moves its count off zero. This is the fifth consecutive plan in this phase to hit the shape (186-01/02/03/04/05 all recorded it).
- **Fix:** Kept the counts, reworded the prose. The divergence section says *"the abort-controller belt that `useLiveValidation` uses in its cleanup is deliberately absent here"* and *"no request this module issues is cancellable"*, carrying every fact — cancels the client's interest not the server's execution, a cancelled write may still have committed and consumed the token, a read is idempotent and a write is not. The classifier docblock says *"branching on the NAME rather than on a constructor-identity check"* and adds *"no prototype comparison of any kind appears in this file"*.
- **Verification:** both counts are 0 on real code; both facts are stated.
- **Committed in:** `e7fa55cb`, `49b4982e`.

**2. [Rule 3 — Blocking] The dependency-array grep cannot match a `useEffect`**

- **Found during:** Task 1 verification.
- **Issue:** The criterion is `grep -n "\], \[definition, enabled\])"` — it requires a `]` immediately before `, [definition, enabled])`. A `useEffect` ends with `}, [definition, enabled])`, a brace. The grep as written returns 0 hits against a correct implementation.
- **Fix:** Satisfied the property and measured it with `grep -c "\[definition, enabled\])"` → **1**, plus the stronger check the criterion actually protects: an enumeration of every dependency array in the file, confirming none pairs `definition` with a hold condition, the token, or `publishInFlight`. The autosave effect's array is literally `[definition, enabled]`.
- **Committed in:** `e7fa55cb`.

**3. [Rule 3 — Blocking] `grep -c "listDraftWorkflows"` cannot be 1 — the import line counts**

- **Found during:** Task 3.
- **Issue:** The criterion requires the count to be **1**. `grep -c` counts matching LINES, and any use requires both an `import { listDraftWorkflows }` line and a call line — a minimum of 2. Achieving 1 would mean a namespace import purely to dodge a measurement, which is the obfuscation 186-03 explicitly caught and reverted in itself.
- **Fix:** Wrote the plain named import (house style) and measured the property: `grep -c "listDraftWorkflows("` → **1** (exactly one call site), and `git diff --name-only` confirms `frontend/src/lib/api.ts` was not touched — which is the criterion's real subject, *"no new API function was added"*.
- **Committed in:** `696791a2`.

**4. [Rule 2 — Missing critical functionality] A `dirty` gate on the fire path**

- **Found during:** Task 1.
- **Issue:** The effect runs on mount, and `definition` is a stable memo, so the timer matures ~1 s after the Builder opens **with no edit at all** and issues a write. That is not merely wasteful: the write bumps `updated_at`, which mints a new token and invalidates the one every other open tab holds. The hook would manufacture the exact stale-token conflict this phase exists to prevent, on every draft open.
- **Fix:** `if (!store.getState().dirty) return` on the fire path, with the reasoning in a comment. `saveNow` deliberately bypasses it — a person who presses Save means it.
- **Verification:** a dedicated case, *"writes nothing at all on mount"*, asserts zero creates and zero PATCHes after 5 debounce windows.
- **Committed in:** `e7fa55cb`.

**5. [Rule 1 — Bug] The first turn of the drain filed a receipt for a superseded save**

- **Found during:** Task 1, writing the queue.
- **Issue:** The plan's drain says the completion handler adopts the token and issues one follow-up. Written naively, that first completion also calls the receipt action — clearing `dirty` while the newer edit that queued the follow-up is still unsent. The leave guard would stop firing and the toolbar would read clean for a change that had not left the browser. This is the T-185-04-01 failure in a shape the plan text does not name.
- **Fix:** the receipt line is reached only when `pendingRef` is clear. A drain turn with work queued behind it `continue`s without filing anything, and the state stays `saving`.
- **Verification:** *"files no receipt for a save a newer edit already superseded"* asserts the receipt action ran exactly **once** across a two-turn drain.
- **Committed in:** `e7fa55cb`.

**6. [Additive] Two exports the plan's artifact list did not name**

- `SAVE_FAILED_SENTENCE` — the plan's Task 2 requires *"a generic honest sentence"* for 404 / network / timeout but names no constant for it. Declared here so it has one home, like the two hold sentences.
- `PersistState`, `DraftPersistenceArgs`, `DraftPersistence` are exported as types so 186-07 can annotate its props without re-declaring the shape.

---

**Total deviations:** 6 — 3 plan-internal blockers (unsatisfiable greps), 1 Rule 2, 1 Rule 1, 1 additive.
**Impact on scope:** none. Two files created, nothing else touched, no package installed, no backend or migration file changed.

## Issues Encountered

- **The three tasks' tests were first written in one pass and had to be carved back.** All 22 cases were authored together and passed at once, which would have destroyed the per-task RED evidence the plan requires. The hook and suite were reduced to Task-1 scope, committed, and then each later task's tests were added **before** its implementation so F8/F11 and F10 were genuinely observed failing. Every RED block above is from a real run; none is reconstructed.
- **`grep -n "overwrite("` returns 0 hits**, so the criterion's expectation that it *"shows the definition and the return-object entry"* cannot be met — neither `const overwrite = useCallback(` nor `{ …, overwrite }` contains that character sequence. The property was verified instead by listing **every** line naming `overwrite` (4: the interface field, one prose mention, the definition, the return entry) and confirming none is a call. A test also drives the strongest available version of the claim: after a conflict, twenty debounce windows and another edit produce zero further requests.

## Known Stubs

None. Every branch is wired end to end against the contract 186-03 shipped and asserted against the real error classes. The hook is not yet mounted — `WorkflowBuilderPage.tsx` still runs its own `onPersist`, because that file is 186-07's and the plan forbids opening it here — but nothing in this module is a placeholder.

## Notes for 186-07 (read before composing)

1. **The published-row 409 currently lands in the cause-neutral branch.** `WorkflowConflictError` is not specially classified, because the sentence for it (`PUBLISHED_CONFLICT_MESSAGE`) has exactly one home today, on the page, and minting a second spelling here would be the two-enums failure 186-04 just retired. **Today's shipped behaviour is that a published-row save shows its own sentence (184-11 / D-184-16 debt 3) — 186-07 must not regress it.** Two clean options: move `PUBLISHED_CONFLICT_MESSAGE` into this module (the page's copy has no other consumer, verified by grep) and add a branch to `refusalOf`, or add a discriminator to the `error` arm. Either is a small, contained change; doing neither loses a shipped sentence.
2. **`validationCause` must be derived by the caller as a primitive** — `validation.kind === "degraded" ? validation.cause : null`. Handing the whole `ValidationState` object in would defeat the entire reason the hold gate is value-stable.
3. **`enabled` is *drafted + canvas-enabled*, not `hasEdited`.** The dirty gate is what keeps a freshly opened draft from writing; do not gate `enabled` on `hasEdited` as `useLiveValidation` does, or a draft opened and edited once before `hasEdited` flips would not autosave.
4. **`onDraftCreated` should be the page's `setDraftId`.** The hook mirrors it into a ref, so an unstable identity is harmless.
5. **The page's `saveState` / `saveErrorMessage` / `savedTimerRef` are exactly what this replaces** — 186-04's Deviation 1 noted that `grep -rn "setSaveState" frontend/src` should reach 0 once 186-07 lands.
6. **`UNSAVED_LEAVE_PROMPT` and the `beforeunload` half still belong to the page** and still key on the store's `dirty`, which this hook only ever clears on a confirmed, non-superseded write. Its meaning changes exactly as D-186-03 predicted: from *"you forgot to save"* to *"a write genuinely failed"*.

## Threat surface

Every threat in the plan's register is implemented and asserted. No new network endpoint, auth path, file access or schema surface — the hook calls three already-shipped client functions and adds none.

| Threat | Where it is enforced | Where it is asserted |
|---|---|---|
| T-186-06-01 spoofing a success | the receipt action has ONE caller, on the confirmed-write path with nothing newer queued | F8 (a 422 leaves `dirty` true and files nothing) + the superseded-drain case |
| T-186-06-02 a stale write clobbering a newer one | every request carries `tokenRef.current`; the client re-derives no staleness verdict of its own | F9's token-chain assertions; F10's post-reload token assertion |
| T-186-06-03 retry storm after a conflict | `haltedRef` — no timer is even scheduled while set | F10: zero further requests across three edits, and across twenty debounce windows |
| T-186-06-04 a cancelled-but-committed write consuming the token | no cancellation of any kind on the write path | the `?raw` fence asserting the abort belt's absence |
| T-186-06-05 the raw 422 body reaching a rendered value | the named error carries a fixed sentence; this hook copies only that constant | F8 walks the whole reachable state graph against every string in the raw body |
| T-186-06-06 an automatic overwrite | neither exit is called from any effect or catch | the 4-line `overwrite` enumeration + the "never decides by itself" case |
| T-186-06-SC package installs | zero packages installed; the debounce is the shipped `setTimeout` closure | `git diff --name-only` = the two plan files |

## User Setup Required

None — no environment variable, no migration, no cloud-parity step, no package. `scripts/check-deploy-drift.sh` is unaffected.

## Self-Check: PASSED

- `frontend/src/hooks/useDraftPersistence.ts` — FOUND
- `frontend/src/hooks/useDraftPersistence.test.tsx` — FOUND
- commit `e7fa55cb` — FOUND in `git log`
- commit `49b4982e` — FOUND in `git log`
- commit `696791a2` — FOUND in `git log`

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*
