# Phase 186 — Deferred Items (recorded, not built)

Written by 186-08. Each entry names **what was consciously not built**, **why**, and a
**concrete re-open trigger** — the project rule is that every deferral gets one, so a
deferred idea is a scheduled decision rather than a lost one.

---

## 1. D-186-17 — the `folder_scope` ordering trap (carried forward, both directions)

**What is deferred:** making `folder_scope` editable per phase. 186 did not touch it.

**Why it matters to whoever does.** A phase that declares `folder_scope` while the
workflow has **no** `project_folder_id` raises a raw Pydantic 422 at the shape tier
(`_folder_scope_requires_project`, `backend/app/models/harness.py:294`). Under D-186-04's
hold-the-write rule the autosave loop **holds the write and says why** rather than
PATCHing — so a draft that reaches that state is **permanently unsaveable** from the
canvas. Every keystroke after it would be held. The workflow-level binding must therefore
be settable **first**, and the per-phase control must be **gated on it**.

**The bind direction is now closed.** 186-08 shipped the workflow-level binding as a
control on the built canvas (D-186-15), so the "you cannot set the thing the per-phase
field depends on" half of the trap no longer exists.

**The UNBIND direction is the addendum D-186-17 did not anticipate.** The header picker
can now clear a binding as well as set one. Clearing it on a workflow whose phases carry
`folder_scope` would spring exactly the same 422. It is **unreachable today, and pinned by
a test rather than assumed**: `PhaseFormPanel` renders `folder_scope` as a read-only
display and no authoring control writes it — asserted in
`frontend/src/pages/WorkflowBuilderPage.header.test.tsx` (*"PhaseFormPanel renders
folder_scope, and writes it nowhere"*), which reads the panel's source with comments
stripped and fails if any of the three write shapes appears.

A client-side *"you cannot unbind while a step scopes a folder"* refusal was **rejected**:
that is the client computing a validation rule, which is what D-182-06 forbids. The
server owns every verdict.

**Re-open trigger:** the first plan that proposes an **editable `folder_scope` control**.
That plan must (a) land/keep the workflow-level binding first, (b) gate the per-phase
control on a bound workflow, (c) decide what an unbind does when a phase scopes a folder —
and (d) delete the unreachability assertion above **in the same commit**, because the
moment the field is writable that test is asserting something that is no longer true.

---

## 2. `BUG-260731-03`'s verdict half → Phase 187 (unchanged)

**What is deferred:** the deterministic build-time `POST /workflows/validate` `incomplete`
verdict for an unbound workflow whose phases carry retrieval tools.

**Why here and not there.** D-186-14 split the bug: 186 folds the **minimum** fix (the
author-time binding **control**), 187 keeps the **necessary** one (the deterministic
verdict). The bug report's own `re_open_trigger` says explicitly that it must **not** flip
to `closed` when 186 ships. The reason is in the report's second same-day update: the
publish-gauntlet judge **passed a worse deliverable than it had failed an hour earlier**
(11 files across 5+ folders vs 3 across 3). A probabilistic hard wall that fails open under
variance is not a control for this failure mode; a structural property of the definition
should be checked deterministically on the canvas, before a golden run is spent.

186-08 therefore adds **no** verdict, **no** severity, **no** code, **no** problems-tray
row, **no** node mark and **no** `blockedReason` entry — enforced by a source fence with
both a positive and a negative control.

**Re-open trigger:** Phase 187 (SEED-132 validation-envelope work / its SC#3
safe-by-construction claim). `BUG-260731-03` stays `status: folded` until **both** halves
are verified.

---

## 3. The repair path is reachable only with `visual_workflow_canvas` ON

**What is deferred:** a knowledge-base control on the **flag-off** Builder surface.

**Why.** D-181-01 — the v3.6 revert foundation, this milestone's HARD gate #1 — promises
the flag-off Builder is byte-identical for everyone, operators included, and that promise
is pinned as literal markup in `WorkflowBuilderPage.header.test.tsx`. A new affordance
rendered unconditionally would mean the off-switch no longer reverts v3.6. The reporting
operator hit this bug **with the canvas on** (the report's own complaint is that
regeneration "discards the authored canvas"), so gating loses nothing for the person who
reported it. Flag-off keeps the shipped display-only chip, byte for byte — including
hiding when unbound.

**Re-open trigger:** the flag-off Builder being kept as a *supported* long-term surface
rather than a revert switch — i.e. the first time an operator is asked to author a
workflow with `visual_workflow_canvas` off. At that point the flag-off surface needs its
own binding control and the markup pin must be updated deliberately.

---

*Recorded: 2026-08-01 · Phase 186-concurrency-autosave, plan 08*

---

## The frontend full-suite rot band is wider — and less STABLE — than SEED-056 records

**Status:** deferred, out of scope (executor scope boundary — none of it is caused by, or in a
file touched by, plan 186-09).

**What was observed.** Two consecutive full `npx vitest run` passes on the same tree reported
**43 failures / 12 files** and then **42 failures / 11 files**, and the failing SET differed
between them (`MessageItem` in one only; `model-info` and `WorkflowBuilderPage.session` in the
other only). SEED-056 records the band as "~14-17". The instability is the finding as much as the
size: a phase-verification gate that compares a single failure count against a single remembered
number will read as a regression or a fix at random.

**What was proven, so a later reader does not re-derive it:**

| Group | Failures | In isolation |
|---|---|---|
| 8 genuinely-rotten files (`streamsProvider`, `StreamsProvider.dedup`, `streamsProvider_075_9_clientkey`, `IngestionPage`, `MessageItem`, `Plan04.frontend`, `useMessages`, `model-info`) | 21 / 144 | **fail identically** — real rot, no parallel load needed |
| `PublishGauntlet.test.tsx` | 18 | **passes fully** |
| `WorkflowCanvas.test.tsx` | 2 | **passes fully** |
| the 5 suites importing `useDraftPersistence` + `builderStore.test.ts` + `PublishGauntlet` | 0 | **245 passed / 245** |

Total collected was **3556 on every run** — non-decreasing, so nothing was replaced or deleted
(the Phase 177 lesson).

**Why it is not fixed here.** Plan 186-09 changed three statements inside one function of
`useDraftPersistence.ts`. No file in the failing set imports that hook. Fixing 21 unrelated rotten
tests inside a gap-closure plan would bury the one change the phase's re-verification has to be
able to see.

**Re-open trigger:** the next `/gsd:verify-work 186` (or any phase gate) that wants to read the
frontend suite as a pass/fail signal. At that point the band needs to be measured **per file in
isolation**, not as a single whole-suite number — and `PublishGauntlet` / `WorkflowCanvas` need
their parallel-load flake fixed or their concurrency pinned, because they alone account for 20 of
the ~42 and are pure noise.

---

*Recorded: 2026-08-01 · Phase 186-concurrency-autosave, plan 09*

---

## The publish-time `flushPendingWrites()` seam — REJECTED, and not on cost

**What is deferred:** having `runGauntlet` `await` a flush the persistence hook exposes, so
stage 0 provably reads a token no outstanding PATCH can invalidate. 186-16 shipped the
weaker-looking half instead: a **refusal** on the existing `blockedReason` seam.

**Why the stronger fix is the wrong build here.**

1. *It would be an automatic write past the revert switch.* `renderPublish` — and therefore
   `PublishGauntlet` — is mounted **unconditionally** on the Builder header, on **both**
   branches of the flag gate (`WorkflowBuilderPage.tsx`, the single `actionGroup` both the
   flag-on and the flag-off header render). A flush called from `runGauntlet` would issue an
   unrequested PATCH on the **flag-off** surface — exactly the leak 186-13 closed for the
   hold release, and exactly what **D-181-01** (this milestone's HARD gate #1) exists to make
   impossible. Re-gating the flush on `enabled` turns the guarantee back into a condition:
   a conditional flush wearing a guarantee's clothes.
2. *It would need a five-hop seam.* `WorkflowBuilderPage` → `WorkflowDoorSwitch` →
   `WorkflowsPage` → `PublishGauntlet`, three of them pure pass-throughs, to carry a promise
   the existing seam already carries as a fact.

The refusal is also the vocabulary this phase speaks everywhere else — hold, and say why
(D-186-04 / D-186-12). Waiting one round trip and pressing again costs the person less than
an unrequested write costs the flag-off guarantee.

**Re-open trigger:** the first `draft_changed` refusal observed in **live** use despite this
gate (which would mean the ordering property in the memo's docblock does not hold in the
field), **or** the first phase that gives the gauntlet a flag-aware seam of its own — at
which point a flush can be awaited without writing on the reverted surface.

---

## Publish while the write loop is in `conflict` or `error` — NOT blocked by 186-16

**What is deferred:** extending the same refusal to `persistState.kind === "conflict"` and
`"error"`. 186-16 blocks **only** `saving`.

**Why.** The conflict case is arguably worse than the one that was closed — the server holds
a different definition than the screen does, so a publish there ships something the author is
not looking at. But it is a **different finding**, it is not in this gap-closure round's
operator-approved scope, and blocking it **changes what an author can do**: a draft with a
stale sibling tab would become unpublishable until the conflict is resolved, which is a
product decision rather than a race fix. `saving` is safe to block precisely because it is
**bounded** — `performWrite`'s `finally` always clears `inFlightRef` and every terminal
branch sets a non-`saving` state, so the block always ends by itself. `conflict` and `error`
are not bounded; blocking on them can only be right if the surface also offers the way out.

**Re-open trigger:** the first report of a publish shipping a definition the author had
already been told was in conflict, **or** the phase that gives the conflict banner a
publish-aware reading (i.e. the banner and the publish gate answering with one voice).

---

*Recorded: 2026-08-01 · Phase 186-concurrency-autosave, plan 16*

---

## WR-14 — the wait reason outranks the fixable ones, and it disables a click that spends nothing

**What is deferred:** two related changes, neither built. (a) Re-ranking `blockedReason` so a
"wait a moment" reason no longer displaces a "fix this" one. (b) Narrowing the disable so only
the **inner** Publish button — the one that spends a golden run — refuses while a write is
outstanding, leaving the outer `◆ Publish…` trigger free to open the modal.

**The shape as shipped**, re-derived at HEAD rather than inherited. `blockedReason`
(`frontend/src/pages/WorkflowBuilderPage.tsx:1093-1102`) evaluates
`if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT` as its **first** statement
(`:1094`), above the flag/phase gate (`:1095`) and therefore above all four verdict branches —
the empty-draft invitation (`:1096`), the degraded sentence (`:1097`) and the two verdict reads
(`:1098-1101`). `PublishGauntlet` derives `blocked` straight from that string (`:846`) and feeds
it to **both** gates: `canPublish = … && !blocked` (`:592`), which guards the golden run, and
`disabled={blocked}` (`:921`) on the outer trigger — whose entire `onClick` is `setOpen(true)`
(`:920`). So during sustained typing the actionable sentence flickers out once per debounce beat,
and a control that costs nothing is intermittently unclickable.

**Why it is deferred, not fixed here.** The rank is a **shipped, tested decision**, not an
oversight: `WorkflowBuilderPage.canvas.test.tsx:1864` pins *"the saving reason OUTRANKS the
empty-draft invitation — the nearest obstacle is the one named"*, and the memo's own docblock
(`:1076-1077`) states the rationale — fixing a verdict will not make Publish go until the PATCH
has landed. Reversing that is a product call about which sentence a person should read first, not
a race fix. Splitting the two gates is the more defensible half, and it is still a contract
change: the modal would open while its inner action refuses, which moves where the R12 reason is
placed and what the modal promises when it is opened.

**The widening this round caused, recorded rather than left to be discovered.** 186-18 closed
CR-03 by lifting the `saving` branch **above** the flag gate. That was the correct fix — a write
this client has outstanding is a fact about the client, not a verdict about the workflow — but it
means `SAVING_PUBLISH_WAIT` now outranks the verdict branches on the **flag-off** Builder too,
where before the gate returned `null` unconditionally. WR-14's flicker and its free-click cost
therefore now exist on **both** surfaces, not one. That is the price of closing the blocker, and
it was paid deliberately.

**Re-open trigger:** the first operator observation that the `◆ Publish…` trigger felt
unclickable or "flickery" while typing (rows 3b and 8 of `186-VALIDATION.md` are the sessions
most likely to surface it), **or** the first phase that gives `blockedReason` a rank/kind model
able to distinguish "wait a moment" from "fix this" — at which point the outer trigger should
stop being gated by a wait at all, and `canvas.test.tsx:1864`'s rank assertion must be rewritten
in the same commit rather than deleted.

---

## WR-15 — the `saving` block has no ceiling

**What is deferred:** a client-side timeout or abort belt on the draft write, and closing the one
branch that can leave the reading at `{kind:"saving"}`.

**The shape as shipped.** `performWrite` sets `{ kind: "saving" }` synchronously before the
request leaves (`frontend/src/hooks/useDraftPersistence.ts:633`). Its `finally`
(`:738-740`) clears `inFlightRef` and **nothing else** — it does not touch the reading — so the
bound on the block rests entirely on every terminal branch setting a non-`saving` state. One
branch does not: `if (creatingRef.current) break` (`:638`) sits *below* the `saving` assignment
and returns without a further `setState`. It is unreachable today (prior IN-01: `creatingRef` can
only be true inside the synchronous region that set it), which is why it is a warning rather than
a defect. Separately there is **no network ceiling at all**: `updateWorkflowDraft`
(`frontend/src/lib/api.ts:3430-3449`) accepts an optional `signal` but the hook's only call site
(`useDraftPersistence.ts:650-654`) passes three arguments and no signal, and nothing anywhere
arms a timer against the fetch.

**Why it is deferred.** This file's §"Publish while the write loop is in `conflict` or `error`"
entry argues that `saving` is safe to block on **precisely because it is bounded**. WR-15 is the
observation that the bound is a property of the branch set rather than a guarantee. Adding an
abort belt is a **transport-wide decision**, not a local patch: the sibling assertion
`useDraftPersistence.test.tsx:712` — *"cancels no write — the abort belt `useLiveValidation` uses
is deliberately absent"* — pins the absence as a **choice**, because a half-applied timeout could
abort a write the server has already committed, leaving the client believing nothing was written
while the row moved. Waiting is strictly safer than that.

**Re-open trigger:** the first live observation of a `Saving…` reading that never resolves (or a
Publish control that stays disabled with `SAVING_PUBLISH_WAIT` after the network settled),
**or** the first phase that gives the workflow-draft transport an abort/timeout policy — that
plan owns deleting the absence-pinning assertion at `useDraftPersistence.test.tsx:712` in the
same commit, because the moment a belt exists that test asserts something untrue.

---

## WR-16 — `reload()`'s catch spans more than the request

**What is deferred:** narrowing the try scope so only the network call is caught, and the
post-read work (the row lookup and the store write) is allowed to fail as itself.

**The shape as shipped.** `reload()` (`frontend/src/hooks/useDraftPersistence.ts:988-1032`) opens
its `try` at `:993` and closes it at `:1015`. Inside that scope, **after** the request has
already succeeded, sit `rows.find(…)` (`:995`) and
`store.getState().setDrafted(row.definition …)` (`:1008`). A throw from either lands in the same
catch (`:1015-1027`), which — while `haltedRef` is set — restores the conflict with
`RELOAD_FAILED_NOTE` (`:289`): a sentence that tells the person we could not reach the server. So
a failure *after* a server that answered is reported as a network failure, inviting a retry that
cannot work.

**Why it is deferred.** It is a real honesty defect, and it is also **the exact catch that
GAP-4/CR-02 was repaired in** — this phase's most recently closed blocker. Re-scoping it means
re-proving the whole F21 family (both exits stay mounted and pressable through a failed exit,
`haltedRef`-guarded so a conflict that did not happen is never fabricated). That is a deliberate
piece of work with its own falsification set, not a line move inside a gap-closure round.

**Re-open trigger:** the first report of the reload note appearing against a server that
demonstrably answered, **or** any change that makes the reload path parse more of the response
body (which widens the surface the mis-attribution covers).

---

## WR-17 — a second Reload shows the first failure's note

**What is deferred:** clearing `state.note` when a new resolution starts.

**The shape as shipped.** `reload()`'s entry (`useDraftPersistence.ts:988-993`) takes the
re-entrancy guard, sets `reloadingRef` and `setResolving(true)` — and never touches the reading.
So a second press, made while the previous attempt's `{kind:"conflict", note: RELOAD_FAILED_NOTE}`
is on screen, keeps asserting a past network failure while a fresh attempt is in flight and both
exits are disabled by `resolving`.

**Why it is deferred.** Same mechanism and, in practice, the same edit as WR-16 — they are one
change to one function. Splitting them across rounds would touch the CR-02 repair twice and
re-prove the F21 family twice.

**Re-open trigger:** identical to WR-16's. **These two re-open together**, in one plan, with one
falsification pass over the failed-exit family.

---

## WR-18 — `overwrite()` degrades to an unguarded write on a `null` token

**What is deferred:** refusing the Overwrite, or re-reading first, when the refusal body carried
no `detail.token`.

**The shape as shipped**, traced end to end. `updateWorkflowDraft` throws
`new WorkflowStaleTokenError(body.detail?.token ?? null)` on a `stale_token` 409
(`frontend/src/lib/api.ts:3460`) — the `?? null` is the degradation's origin. `refusalOf`
(`useDraftPersistence.ts:403-412`) carries that through as `{ kind: "conflict", currentToken:
carried ?? null }`, and the catch stores it (`:661`). `overwrite()` then assigns it
unconditionally: `tokenRef.current = conflictTokenRef.current` (`:1058`), directly above
`await performWrite()` (`:1073`). Back in the transport, the `If-Match` header is **added only**
when the token is a non-empty string (`api.ts:3440-3443`) — deliberately, so a missing token
sends no header rather than an empty one. Net effect: a `null` token turns "Overwrite" from a
guarded single-shot write into an unguarded one.

**Why it is deferred — it is the sharpest of the five, and every answer changes the product.**
Refusing removes an exit that **D-186-08 guarantees is always offered** ("the person picks the
exit; neither control is ever a silent no-op"). Re-reading turns the one-request exit into two,
which is the round trip `overwrite()` was explicitly designed to avoid (its docblock: the
server's disambiguating re-read already fetched the token). Choosing between those is a product
decision, and it belongs with the phase that also gives the conflict banner a publish-aware
reading — the same seam this file's §"Publish while the write loop is in `conflict` or `error`"
entry names.

**The containment, stated honestly so nobody has to re-derive its size.** The server still
applies its owner scope (`auth.uid() = created_by` at both the RLS layer and the service-layer
WHERE) and its published-row guard. What a null token loses is the **optimistic** guard — the
third writer's concurrent edit would not be refused — not an authorisation. This is a lost
concurrency check inside one owner's own drafts, not a path to somebody else's data.

**Re-open trigger:** the first `stale_token` 409 observed in the field whose body lacks
`detail.token` (which would make the degradation live rather than theoretical), **or** the phase
that gives the conflict banner and the publish gate one voice — that plan owns deciding which of
the two answers ships.

---

**What was CLOSED this round, so this file alone separates the five carried from the three
fixed.** `CR-03` (the publish refusal was dead code on the flag-off Builder) was closed by
**plan 186-18**, which lifted the `saving` branch above the flag gate and added the flag-off
canvas row that observes it. `WR-12` (the flag-off hold release resolved to silence) and `WR-13`
(a conflict resolved by Overwrite left a stale arming for a later hold to flush) were closed by
**plan 186-19**. Those three are **not** deferrals and have no entry above; the five entries in
this block — WR-14, WR-15, WR-16, WR-17, WR-18 — are the ones carried forward.

---

*Recorded: 2026-08-01 · Phase 186-concurrency-autosave, plan 20*
