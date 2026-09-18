# Phase 252: Close the v4.2 audit gaps - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 252-close-the-v42-audit-gaps
**Areas discussed:** B-1 durability · B-3 refusal-vs-repair · B-4 outcome plumbing · Flow C Hole 1 liveness signal · Flow C Hole 2 not-live reading · plan shape & wave boundary · this phase's own review debt

---

> ⛔ **NO OPERATOR ANSWERED ANY QUESTION IN THIS LOG.** The operator's instruction was to run the
> phase end-to-end unattended. Every "Selected" mark below is **Claude's decision under that
> autonomy grant**, with the evidence it rests on. Nothing here is an operator ruling, and nothing
> downstream may cite it as one.

---

## Area 1 — B-1: how durable should the greenfield ACL fix be?

| Option | Description | Selected |
|--------|-------------|----------|
| A | Append 181's REVOKE/GRANT block to `full-schema-supplement.sql`. One file, exactly what §8 asks. | |
| B | Option A **plus** `scripts/check-schema-acl-parity.cjs`, driven RED against a planted omission. | ✓ |
| C | Change `regenerate-full-schema.sh` to drop `--no-privileges`. | |

**Decision:** B.
**Notes:** A is what the audit literally asks for and would be the **third** prose-only fix of the
same class — `full-schema.sql:7449-7456` already documents it verbatim for migration 118, and the
supplement header already carries a maintenance note telling maintainers to do exactly what nobody
did for 181. The ROADMAP's own words are *"the fix must be the durable one."*
C was rejected on measurement, not taste: dropping `--no-privileges` makes a `pg_dump` carry the
**local dev box's entire ACL state**, including roles and grants that exist only here, which is a
much larger and less reviewable artifact than the 31 lines actually owed.
⚠ Checked against **G-7**: a gate is a *guard*, not a user-facing capability, so the
new-capability-in-closure arm does not fire.

---

## Area 2 — B-3: refuse the DCR-issued `client_id`, or tolerate it?

| Option | Description | Selected |
|--------|-------------|----------|
| A | Validate at a fourth **request model**. | |
| B | Validate at the **writer** (`store_oauth_client_credentials`), refuse on failure, **and** name the repair path for rows already bricked. | ✓ |
| C | Loosen the **read** model so a non-compliant stored id never bricks a read. | |

**Decision:** B.
**Notes:** SC#3's wording is *"either never lands **or** leaves a repair path"* — B ships both arms,
so it cannot be half-satisfied.
A was rejected because the DCR value **is not a request** — it arrives in a remote server's
response. A fourth request model would guard a door this value does not come through, which is the
bypass one writer over.
C was rejected because it **inverts CRED-01**: the whole point of the smell check is that a value
failing it may be a secret, and making the read path swallow it re-opens exactly what Phase 248
closed.
⭐ Measured while deciding: the repair path **already exists structurally** —
`store_oauth_client_credentials` is an UPDATE and the BYO form's `custom_client_id` **is**
validated — but the degraded row says only *"Connection configuration requires update (validation
failed)"*, which names nothing a person can act on. So the owed work is to **name** it, not to
build it. The audit's *"no repair path"* is therefore slightly too strong; the corrected reading is
**"an unnamed repair path, which is the same thing to the person looking at it."**

---

## Area 3 — B-4: where does the sync outcome come from?

| Option | Description | Selected |
|--------|-------------|----------|
| A | Add a `catch` to `handleRowSync` and keep the literal. | |
| B | Widen `onSyncNow` to **return** the outcome; the card renders **one** slot from it; delete `(0 changes)`. | ✓ |
| C | Let the card call `triggerWatchSync` itself. | |

**Decision:** B.
**Notes:** A was rejected **on measurement**, and this is the finding worth keeping: the parent's
`handleSyncNow` already wraps the call in try/catch and **never rejects**, so the card's `catch`
can never fire and adding one alone ships a **no-op** — the same error the ROADMAP flags for
`BUG-260915-01`'s candidate #1.
C was rejected because the parent owns the refusal/pending state; a second caller is a second
writer, and two writers of one slice that differ is this repo's recorded drift mechanism.
⛔ Also decided here: **nothing replaces `(0 changes)`.** `WatchSyncResponse` carries no change
count, so any number the card printed would be invented. The honest readings are the parent's
existing queued sentence and the server's own refusal message.
⭐ **Found while deciding, and not in the audit:** `WatchRowCard.tsx` has **no test file at all**,
and `src/components/sources` is not a TARGETS **directory** entry — so the component holding all
three defects was invisible to both count-gate knobs at every total. A suite for it is now a
deliverable, and it asserts **rendered content**, never `data-testid` presence.

---

## Area 4 — Flow C Hole 1: what signal makes a thread "live" during reconcile?

| Option | Description | Selected |
|--------|-------------|----------|
| A | Set the existing `loadingThreads` during `reconcile`, mirroring `loadMessages`. | |
| B | A **new** per-thread `reconcilingThreads` Set, plus a per-thread in-flight lock. | ✓ |
| C | Call `loadMessages` on thread open as well as `reconcile`. | |

**Decision:** B.
**Notes:** A is the smallest diff and was rejected because `loadingThreads` has a **second
consumer** — `MessageList`'s cold-load skeleton (`streamsStore.ts:219`) — so reusing it changes a
surface nobody is looking at. One home per concern.
C was rejected outright: it restores the `Promise.all([getActiveRuns, loadMessages])` chain that
`D-075-02` deliberately collapsed into one `getSnapshot`, i.e. it undoes a shipped decision to fix
a symptom.
⚠ Carried into the decision as a hard constraint: the three liveness reads must sit on **three
separate `const` lines**. `TodosSection.tsx:250-264` documents that a `||` **inside** a hook call
short-circuits, React throws *"Rendered fewer hooks than expected"*, **and the whole page goes
blank** — shipped that way for one commit in Phase 250 and caught by driving the app, not by a test.
⭐ Recorded as a limit on the fix rather than papered over: *reconciling* means **"we do not know
yet"**, not "live". Folding it into `isRunLive` is right only because `isRunLive`'s job here is to
**suppress a false `Not ticked` claim**. Every consumer must be checked before the flag is widened.

---

## Area 5 — Flow C Hole 2: what does a `running` phase say when the run is dead?

| Option | Description | Selected |
|--------|-------------|----------|
| A | Keep the "Running" label; drop the spinner, `aria-busy` and forced-open. | |
| B | A **new row** in `phaseStatusMeta` — a quiet terminal saying the run ended without this step reporting. | ✓ |
| C | Give `PhaseCard` its own `threadId` and let it read liveness itself. | |

**Decision:** B, with A's suppressions included.
**Notes:** A alone still **says** *Running* about a run that is over — quieter, equally untrue.
C was rejected on **G-5**: `PhaseCard.tsx` is FIRING at 10 phases, and giving it a store read is a
new dependency on a hot file. `PhaseTimeline` already holds `threadId` and is the component that
legitimately owns the question, so it derives and passes **one optional prop** — default
`undefined`, every existing caller and test byte-unchanged.
⚠ B follows the project's own stated rule from `sourceHealthVocabulary.ts:49`: *a new cause adds a
**ROW**, never an `if`*. The row joins the existing quiet-terminal family
(`pending`/`skipped`/`unknown`) — not an alarm.
⭐ Checked rather than assumed: `WorkspacePanel.tsx` carries **three** additive-sibling blocks that
each swear they add no prop to `PhaseTimeline`/`PhaseCard`. Their promise is about **those
siblings**, so it survives — the prop comes from the timeline, which owns the card.

---

## Area 6 — plan shape and the wave boundary

| Option | Description | Selected |
|--------|-------------|----------|
| A | 4 plans, one wave. | |
| B | **5 plans in 2 waves** — 4 parallel, then a sole-writer gate-adoption plan. | ✓ |
| C | 3 plans (merge the two frontend plans). | |

**Decision:** B.
**Notes:** A reads parallel and is not: **three** of the four wave-1 plans would edit
`scripts/vitest-count-gate.cjs`, and *"a wave boundary that looks parallel and is not"* is this
project's recorded failure — the ROADMAP says so about Phase 251 two entries up.
C was rejected because it puts `WatchRowCard`/`WatchedFoldersSection` and
`StreamsProvider`/`TodosSection`/`PhaseCard` in one worktree for no benefit — they share no file.
⚠ **G-8 target is 3-4 and this is 5**, so the reason is named rather than assumed: the fifth plan
exists **only** to give `vitest-count-gate.cjs` a single writer. ⛔ It is **not** a gap-closure
round; G-7 does not fire, and `check-gap-closure-rounds.cjs 252` was run today and printed
**`G-7 clear`**.
⭐ B-2 and B-3 were **merged into one plan** for the same reason in the other direction — both land
in `connector_service.py`, and two plans cannot share it.

---

## Area 7 — this phase's own review debt

| Option | Description | Selected |
|--------|-------------|----------|
| A | Close `self-verified` — the operator granted autonomy. | |
| B | Build it, then **post a review request to the bus** and record `independent_review: owed`. | ✓ |
| C | Stop and wait for a reviewer. | |

**Decision:** B.
**Notes:** C contradicts the explicit instruction to finish end-to-end unattended.
A was rejected because the ROADMAP states outright *"this phase is itself a `DEBT-06` row"*, and
because **`BUS-247` records a self-verified close that shipped two blockers with every gate green** —
which is the reason this phase exists at all. An autonomy grant covers *doing the work*; it is not
a reviewer.
⛔ Consequence recorded in CONTEXT `D-46`: **`DEBT-06` is NOT ticked by this phase**, and the close
says `self-verified` + `independent_review: owed` in plain words rather than letting a green gate
stand in for a person.

---

## Claude's Discretion

- Exact wording of every new user-visible sentence, sourced from the existing vocabulary modules —
  ⛔ never as a new literal at a call site.
- Test-file names and per-case breakdown, subject to the content-assertion rule (CONTEXT `D-19`).
- The internal shape of `check-schema-acl-parity.cjs`, subject to being driven RED (CONTEXT `D-07`).

## Deferred Ideas

- `backend/app/api/connectors.py`'s **extraction — OWED at its sixth landing**; this phase is the
  seventh, and per G-5 the next touch must propose the extraction first.
- `reconcile`'s one-shot retry — unblocked as a side effect by the per-thread lock, ⛔ deliberately
  not spent here.
- A `src/components/sources` **directory** entry in TARGETS — would close the class, not the
  instance; would adopt ~10 unpinned suites at once. Worth a seed at close.
- Generalising the ACL parity gate to table and column privileges.
- The `DEBT-06` structural gap — `grep -rln "independent_review" scripts/ .claude/hooks/` returns
  **nothing**, so the field its close condition is written against has no gate at all.

## Reviewed, not folded

- `spike-nl-workflow-authoring.md` (todo match, score 0.60) — matched on generic keywords only
  (*derived, phases, run, real, 2026*). Folding an NL-authoring spike into a gap-closure phase is
  the new capability G-7 forbids.
- **Seeds sweep:** `node scripts/check-seeds-register.cjs --phase 252` printed
  `293/293 parsed · 0 duplicate ids` and **`0 seeds matched`**, while also printing *"the phase
  declares NO surfaces"* — an honest non-result, because no PLAN.md existed yet. ⛔ Re-run after
  planning (CONTEXT `D-38`).
