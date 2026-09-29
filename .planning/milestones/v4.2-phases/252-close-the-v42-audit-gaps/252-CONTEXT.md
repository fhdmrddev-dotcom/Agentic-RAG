# Phase 252: Close the v4.2 audit gaps - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

> ⚠ **Discussion mode: AUTONOMOUS.** The operator's instruction was *"continue with discussion of
> this phase and plan research if needed and then execute it — finish it end to end, I will leave
> you unattended."* Every gray area below was therefore **decided by Claude, not selected by the
> operator**, and each decision states the evidence it rests on. ⛔ A decision recorded here is
> Claude's call under an explicit autonomy grant — it is **not** an operator ruling, and nothing
> downstream may cite it as one. The three genuinely operator-owned items (`BUS-246`, `BUS-247`,
> `BUS-248`, and the `DEBT-06` disposition) are left **untouched and still owed**.

<domain>
## Phase Boundary

**This phase closes gaps that five green phase verifications could not see. It ships no new
capability.**

Scope is **`.planning/v4.2-MILESTONE-AUDIT.md` §8 and nothing else** — four blockers, the
`BUG-260915-01` correction-then-fix, seven of nine warnings, and a reported-bugs register sweep.
It re-closes **`CRED-01`, `CRED-03`, `WATCH-04`, `HONEST-03`** against the same requirement ids;
it adds none.

**In scope:**
- **B-1** — migration 181's function ACLs reach a greenfield bootstrap (`CRED-03`, `CRED-04`)
- **B-2** — the credential-smell fallback stops writing the credential to the log (`CRED-01`)
- **B-3** — a server-issued (RFC 7591 DCR) `client_id` cannot brick a connection (`CRED-01`)
- **B-4** — "Sync now" reports the real `triggerWatchSync` result (`WATCH-04`, `WATCH-06`)
- **Flow C Hole 1** — todos stop reading `Not ticked` on a live run after thread open (`HONEST-03`)
- **Flow C Hole 2** — `PhaseCard`/`PhaseTimeline` stop claiming `running` for a dead run (`HONEST-03`, `HONEST-04`)
- **W-1 / W-2 / W-3** — source-health honesty: the one-cause connection pill, the tautological
  `429`, the `token_revoked` label that promises a verb its control does not perform
- **W-4** — `POST /setup/provider-key` answers a named 400 on a refused write, not an opaque 500
- **W-6 / W-7 / W-8** — two live `TS2556` errors, a count-gate pin carrying permanent slack, a
  dangling seed path
- **Register sweep** (docs only) — six stale-open reports, one duplicate id

**Out of scope (explicitly):**
- ⛔ **`DEBT-06`.** Not in scope, and **must not be quietly ticked by this phase.** Its milestone-close
  arm is contested between `.planning/DEBT-06-AUDIT.md` and `.planning/DEBT-06-REFUSALS.md`, and the
  ruling is the operator's (`BUS-247`).
- ⛔ **`BUS-246` / `BUS-247` / `BUS-248`.** Operator rulings. Claude may not close bus items.
- ⛔ **W-5 and W-9** — both resolved clean at the audit; no work exists to do.
- ⛔ Any new user-facing capability. That is a phase, not a gap (**G-7**).

</domain>

<decisions>
## Implementation Decisions

### Re-derivation before planning — what was measured, and what the audit got wrong

⭐ **Every claim in `§8` was re-driven against source before this context was written.** Three
findings changed the shape of the work, and are recorded here so a planner does not inherit them
unmeasured (`feedback_dont_inherit_unmeasured_claims`).

- **D-01 — CONFIRMED, all five headline defects.** `--no-privileges` at
  `scripts/regenerate-full-schema.sh:104`; **zero** `REVOKE … EXECUTE ON FUNCTION` in either
  bootstrap artifact against **31 REVOKEs** in `181_revoke_public_secdef_functions.sql`; the raw
  `ValidationError` at `connector_service.py:578-581`; the unvalidated DCR write at
  `connectors.py:1326-1352` → `connector_service.py:654`; the `"✓ Synced just now (0 changes)"`
  literal at `WatchRowCard.tsx:239-240`; `reconcileInFlightRef` declared at
  `StreamsProvider.tsx:1503` and read at `:1975` with **no thread key**.

- **D-02 — ⚠ W-6's SECOND SENTENCE IS STALE AND THE ORIGINAL IS KEPT RATHER THAN OVERWRITTEN.**
  The audit says `WorkspacePanel.derived.test.tsx` *"is also in neither count-gate knob, by its own
  comment."* **Measured false:** it is pinned at `vitest-count-gate.cjs:152` (`4`) **and** listed in
  TARGETS at `:4212`. `git log -S` shows **the same commit `b0dd02f28` both adopted the suite and
  authored the two `TS2556` errors.** ⭐ What is stale is the **comment inside the test file**
  (`WorkspacePanel.derived.test.tsx:55-56`), which still claims the suite is ungated — so W-6 is
  **two fixes plus a false comment**, not three fixes. The prose rotted; the gate did not.

- **D-03 — ⭐ A FINDING THE AUDIT DID NOT MAKE, AND IT IS THE REASON B-4 SHIPPED.**
  **`frontend/src/components/sources/WatchRowCard.tsx` HAS NO TEST FILE AT ALL** (`find` returns the
  source and nothing else), and **`src/components/sources` is not a directory entry in TARGETS** —
  only ten individually-named files are. So the component holding B-4's three defects was invisible
  to both count-gate knobs at every count. ⛔ **The audit's own note that SC#3's evidence was a
  non-collapse assertion understates it: there was no suite for the assertion to be weak in.**
  A `WatchRowCard.test.tsx` is therefore a **deliverable of this phase**, not a nicety.

- **D-04 — B-4's missing `catch` is real but is NOT the contradiction's cause.** Measured:
  `WatchedFoldersSection.handleSyncNow` already wraps `triggerWatchSync` in try/catch and never
  rejects, so the card's `handleRowSync` cannot observe a throw. **The contradiction is that the
  parent correctly records `refused` into its own `refusals` state while the card independently
  claims success from a literal.** Fixing only the `catch` would ship a no-op — the same class of
  error the ROADMAP flags for `BUG-260915-01`.

### B-1 — the greenfield ACL gap (SC#1)

- **D-05 — The ACL block goes in `scripts/full-schema-supplement.sql` as a new section 6.** No
  migration. 181 is correct and applied; the supplement is the only artifact that can carry a grant
  past `--no-privileges`. Idempotent, matching the file's stated contract.
- **D-06 — `supabase/full-schema.sql` is updated in the SAME COMMIT, and the mechanism is PROVEN,
  not asserted.** `regenerate-full-schema.sh` cannot run here (**Docker is denied in this
  environment**), so the artifact cannot be regenerated from the live DB. ⭐ **Measured instead:**
  `diff <(tail -n 259 supabase/full-schema.sql) scripts/full-schema-supplement.sql` is **empty** —
  the supplement is appended **byte-identically** as the file's tail. Migration 181 changes **no
  schema object**, only ACLs, so the `pg_dump` half is unchanged by construction. **Applying the
  identical edit to both files therefore reproduces exactly what the script would emit**, and the
  plan MUST re-run that same `diff` afterwards as its proof. ⛔ This is the one sanctioned exception
  to *"never hand-edit `full-schema.sql`"*, and it is sanctioned only because the equivalence is
  mechanically checkable. A plan that does not print the post-edit `diff` has not earned it.
- **D-07 — ⭐ THE DURABLE FIX IS A GATE, BECAUSE THIS IS THE THIRD RECURRENCE.**
  `full-schema.sql:7449-7456` documents this exact class for migration 118; 181 reproduced it; the
  supplement header already carries a **prose** maintenance note that did not prevent it.
  **Prose in a register nobody re-reads is this project's own recorded failure mode.** Ship
  `scripts/check-schema-acl-parity.cjs`: it scans `supabase/migrations/*.sql` for
  `REVOKE|GRANT … ON FUNCTION`, extracts each function identity, and FAILS naming any that the
  supplement does not mirror. ⛔ **It must be DRIVEN RED against a planted omission** (delete one
  mirrored function, see it named, restore, prove the file md5-identical) — *a guard nobody has
  seen fire is not a guard*, and this project measured two vacuous gates in Phase 242 alone.
  ⚠ A gate is a **guard, not a capability** — G-7 does not fire on it.

### B-2 — the credential in the log (SC#2)

- **D-08 — `e.errors(include_input=False)`, and the log line names the fields, never the values.**
- **D-09 — Driven RED against the REAL pydantic model, never a stub.** The test constructs a row
  whose `custom_client_id` holds a value the shipped `_validate_custom_client_id` rejects, runs it
  through the real `_to_response`, captures the emitted record with `caplog`, and asserts **zero**
  occurrences of that value in the **formatted message**. ⛔ Assert on the rendered string, not on
  `record.args` — the integration checker measured **six occurrences in one message**, and an
  assertion over structured args would not have seen them.
- **D-10 — Sweep for siblings, and report the result either way.** `grep` `backend/app/` for any
  other site logging a `ValidationError`/exception object directly. If there are none, **say so
  in the SUMMARY** — "the only place in the codebase" is a claim, and a claim needs a measurement.

### B-3 — the DCR `client_id` that can brick a connection (SC#3)

- **D-11 — VALIDATE AT THE WRITER, NOT AT A REQUEST MODEL.** `CustomClientId` guards three request
  models; the DCR path is not a request. The single seam every writer passes through is
  `connector_service.store_oauth_client_credentials`. **Apply the shipped
  `_validate_custom_client_id` there.** ⛔ Do NOT add a fourth request model — that re-opens the
  same bypass one writer over.
- **D-12 — On refusal, REFUSE THE REGISTRATION, do not store and do not silently continue.**
  Raise a named exception; `connectors.py`'s DCR block catches it and answers **422** naming the
  server, saying automatic setup could not be completed, and pointing at BYO credentials.
  ⛔ It must NOT fall through to the existing `if not client_id: 422` — that message says the
  server *"does not offer to create one"*, which would be a false statement about a server that
  demonstrably did.
- **D-13 — AND leave a repair path for rows ALREADY bricked, because SC#3 asks for either and this
  ships both.** ⭐ The repair path **already exists structurally** — `store_oauth_client_credentials`
  is an UPDATE, and the BYO form's `custom_client_id` is validated — but it is **unnamed**: B-2's
  degraded fallback renders `"Connection configuration requires update (validation failed)"`, which
  tells a person nothing they can act on. **Name it**: the degraded `error_message` says the stored
  application id is not valid and that entering an application id in the connection's settings
  replaces it. ⛔ Do not echo the stored value — that is B-2 in a second register.
- **D-14 — The G-4 S2 row (`McpAuthDoor` BYO-OAuth, LIVE) is driven as far as this environment
  permits, and the remainder is recorded ⛔ OWED with its reason — never silently dropped.**
  A live OAuth consent needs an interactive browser and a third-party account; this project has
  measured that **Google refuses sign-in in a DevTools-driven Chrome**, and the operator is absent.
  **Drive here:** the code-level proof — a test through the real DCR path with a non-compliant
  server-issued id, asserting refusal + no write + a nameable repair. **Leave owed:** the live
  consent leg, with an exact operator recipe in VALIDATION.md. *A scoreboard that lists only what
  passed is not a scoreboard.*

### B-4 — "Sync now" says what happened (SC#4)

- **D-15 — Widen `onSyncNow` to return the outcome; the card renders from it and never invents one.**
  `onSyncNow: (watch) => Promise<WatchSyncOutcome>`. ⛔ The card must not call `triggerWatchSync`
  itself — the parent owns the refusal/pending state and a second caller would be a second writer.
- **D-16 — ONE outcome slot, so a refusal and a success are structurally unable to co-render.**
  Today the refusal notice (`:611-613`) and `syncOutcome` (`:380-385`) are independent slots. **The
  card renders exactly one line, from one discriminated value.** ⛔ Not "hide one when the other is
  set" — two slots with a rule is how the pair drifted apart; one slot cannot.
- **D-17 — Never claim a count the response does not carry.** `WatchSyncResponse` has no change
  count — it carries `status`, `message`, `next_check_within_seconds`, `reader_running`. The queued
  reading is the shipped `COPY.asked(withinPhrase(...))` sentence, **reused not re-written**; the
  refused reading is `res.message`. ⛔ **`(0 changes)` is deleted and nothing replaces it.**
- **D-18 — Add the `catch` anyway (D-04 notwithstanding), and make it honest.** The parent's swallow
  is what makes the card's optimism invisible; a rejected promise must render a failure reading,
  not leave the previous one standing.
- **D-19 — `WatchRowCard.test.tsx` is created, and it asserts the rendered CONTENT.** ⛔ Not
  presence by `data-testid` — *presence assertions cannot see content drift* is this project's own
  recorded finding, and it is **precisely how B-4 shipped green**. At minimum: a refusal renders the
  refusal and **no** success sentence; a queued sync renders the queued sentence and **no** count;
  a rejection renders a failure reading.

### Flow C Hole 1 — todos on a live run (SC#5)

- **D-20 — ⛔ CORRECT `BUG-260915-01` BEFORE ANY CODE. This is a task, and it comes first.**
  `.planning/reported-bugs/todo-rows-flash-not-ticked-on-a-live-run-after-thread-open.md` states a
  mechanism that is **measurably false** — `StreamsProvider.tsx:1936-1942` shows `setViewingThread`
  already fires `actions.reconcile(threadId)`. Rewrite the mechanism and mark candidate #1
  **already implemented**, keeping the original struck through rather than deleted. ⭐ *A review is
  a claim about code, not the code.*
- **D-21 — A NEW per-thread `reconcilingThreads: Set<string>` slice, NOT a reuse of `loadingThreads`.**
  `loadingThreads` also drives `MessageList`'s cold-load skeleton (`streamsStore.ts:219`); reusing it
  would silently change a second surface. **One home per concern.** `reconcile` adds the thread on
  entry and removes it in the existing `finally` that already clears the in-flight ref (`:2506`).
- **D-22 — Make the in-flight lock PER-THREAD.** `reconcileInFlightRef` (`:1503`) becomes a
  `Set<string>`/`Map` keyed by `threadId`. ⚠ The code's own comment at `:2028` already names this as
  the blocker for a retry it wanted and could not take — **this decision unblocks that too, and the
  plan must NOT take the retry** (that is a behaviour change, not a gap fix).
- **D-23 — `isRunLive = isStreaming || isLoading || isReconciling`, on THREE SEPARATE `const` LINES.**
  ⛔⛔ **NEVER inside a hook call.** `TodosSection.tsx:250-264` carries a shouting comment about
  exactly this: `||` short-circuits, the second hook is never called, React throws *"Rendered fewer
  hooks than expected"*, **and the whole page goes blank** — shipped that way for one commit in
  Phase 250 and found by driving the app, not by a test. **The pin
  `TodosSection.test.tsx → "hooks are never short-circuited"` must be extended to the third hook.**
- **D-24 — ⭐ "Reconciling" means *we do not know yet*, and the honest render is NOT "ticked".**
  Folding it into `isRunLive` is correct **only** because `isRunLive`'s sole job is to suppress the
  `Not ticked` claim during a window where liveness is unknown. ⛔ If `isRunLive` is read anywhere
  that asserts something POSITIVE about a live run, that read needs its own signal — the plan must
  check every consumer of `isRunLive`/`DerivedRow` before widening it.

### Flow C Hole 2 — the panel's other run-state surface (SC#5)

- **D-25 — `PhaseTimeline` derives run liveness and passes ONE optional prop down.** It already
  holds `threadId` (`PhaseTimeline.tsx:141-145`). `PhaseCard` gains `runLive?: boolean` and reads
  `isRunning = phase.status === "running" && runLive !== false`. ⛔ **`PhaseCard` must not acquire a
  `threadId` or a store read** — it is G-5 FIRING at 10 phases and takes one prop, not a new
  dependency. The default `undefined` keeps every existing caller and test byte-unchanged.
- **D-26 — The not-live reading is a NEW ROW in `phaseStatusMeta`, never an `if` at the call site.**
  `sourceHealthVocabulary.ts:49` states the project rule verbatim: *a new cause adds a ROW, never an
  `if`*. The row is a **quiet terminal** in the family `pending`/`skipped`/`unknown` already share —
  not an alarm — and it says the run ended without this step reporting. ⛔ No spinner, no
  `aria-busy`, not forced-open.
- **D-27 — `WorkspacePanel.tsx` is NOT modified.** It already mounts `PhaseTimeline threadId={...}`
  at `:542`. The fix lands entirely inside the timeline and the card, so the panel's three
  additive-sibling contracts (`RunSoul`, `RunSeam`, the cancel seam — each of which swears it adds
  no prop to `PhaseTimeline`/`PhaseCard`) stay true. ⚠ Their promise is about **those siblings**,
  not about the timeline's own owner — D-25 adds the prop from `PhaseTimeline`, which is the
  component that legitimately owns it.

### Warnings W-1 / W-2 / W-3 — source-health honesty

- **D-28 — W-2 first; it is the worst of the three.** `WatchRowCard.tsx:247-248`'s `isRateLimited` is
  `cause === "unreachable" && classifySourceFailure(last_error) === "unreachable"`, and `cause`
  already **defaults to that same expression** (`:184`) — a tautology. `unreachable` is the
  catch-all, so a Drive **503**, a DNS failure and a socket timeout all render **`Run failed (429)`**.
  **Delete the pseudo-discriminator.** A `429` is claimed only from evidence that names rate
  limiting; absent that, render `presentation.label`. ⛔ Same honesty class as `BUG-260909-07`, in
  the code that fixed it.
- **D-29 — W-1: the connection pill reads the CAUSE, not one boolean.** `token_revoked` and
  `app_credentials_invalid` are connection-level failures and must not render `● Connected`.
  Source the reading from `sourceHealthVocabulary` — ⛔ never a local ternary, which is how the
  one-cause binary got there.
- **D-30 — W-3: `token_revoked`'s label names the DOOR, like its two siblings.** `runFix` only
  navigates (`WatchedFoldersSection.tsx:357-367`); `connection_disabled` and
  `app_credentials_invalid` were already reworded to say *"in Settings ↗"*. **Keep the verb
  `Reconnect`** — unlike the other two, reconnecting genuinely is the fix for a revoked token — and
  name where it happens. ⛔ Do not add a fourth `action`; the three-named-actions pin stays green
  **by construction**, exactly as the two prior rows did.

### Warnings W-4 / W-6 / W-7 / W-8

- **D-31 — W-4: `POST /setup/provider-key` catches `SettingsWriteRefused` → 400.** Copy the shipped
  shape from `admin.py:1784` / `settings.py:951`; ⛔ the existing **500** arm for a `False` return
  stays byte-unchanged — it means a different thing (an honest write-through failure, not a refusal).
- **D-32 — W-6: give the two `vi.fn()` stubs rest parameters, like the one three lines above them.**
  `WorkspacePanel.derived.test.tsx:62-63`. **And correct the file's stale in-neither-knob comment**
  (see D-02). ⛔ Baseline is **67** `tsc -p tsconfig.app.json --noEmit` errors, measured today —
  "zero errors" is not a reachable criterion; the acceptance is a **set diff of 67 → 65** with the
  two `TS2556` lines gone and nothing new. ⛔ `npx tsc --noEmit` checks **zero files** here.
- **D-33 — W-7: correct the pin `ConnectionGrantsList.test.tsx` 8 → 9.** Measured: the file has
  **9** cases against a pin of **8** — one unit of permanent slack since Phase 221, so a deleted
  case would keep the gate green.
- **D-34 — W-8: `ThinkingBlock.tsx:158` → `SEED-284-one-home-for-the-elapsed-formatter.md`.**
  Verified: the cited `SEED-269-…-elapsed-formatter.md` does not exist; the bare id `SEED-269`
  resolves to an unrelated seed (`…explanations-are-noise…`) plus a `SEED-269-superseded-id.md`.

### Register sweep (a task, not a plan — ROADMAP G-8)

- **D-35 — Flip the six stale-open reports** — `BUG-260911-01`, `BUG-260910-03`, `BUG-260913-01`,
  `BUG-260907-02`, `BUG-260828-02` (the grant-override one), `BUG-260902-06`. ⛔ **Flip a report only
  against a NAMED artifact that closes it** — where the citing phase does not actually close the
  bug, the honest edit is `folded_into` + a reason, not `closed`. *A register that says `closed`
  without a verifier is the defect this sweep exists to fix.*
- **D-36 — Disambiguate the duplicate `BUG-260828-02`.** Two different bugs share the id. **The
  CLOSED one keeps it** (`no-authoring-surface-can-declare-a-workflow-input`, `verified_closed_by:
  214.1`) because it is cited by ROADMAP and verification artifacts; the **open**
  `grant-override-marker-claims-a-person-changed-it.md` takes a fresh id. Measured: `BUG-260828-01`
  … `-10` are taken, so the next free is **`BUG-260828-11`**. ⛔ Update the `id:` frontmatter AND
  the filename AND every in-repo citation in the same commit — *`status:`/`id:` frontmatter IS the
  index; prose in the body is invisible to any scan.*
- **D-37 — Tick the ROADMAP Phase Checklist row for 248** (already corrected to `[x]` at the audit —
  verify, do not re-do).
- **D-38 — Re-run `node scripts/check-seeds-register.cjs --phase 252` AFTER the plans exist.** Run
  today it reported **`0 seeds matched`** while printing *"the phase declares NO surfaces"* — an
  honest non-result, not a clean sweep. The sweep is only meaningful against a real
  `files_modified`.

### Plan shape (G-8)

- **D-39 — FIVE plans in TWO waves. Above the 3-4 target, and the reason is file contention, named.**
  - **Wave 1 (four plans, disjoint `files_modified`, genuinely parallel):**
    - `252-01` **Greenfield ACL parity + the setup refusal** — `scripts/full-schema-supplement.sql`,
      `supabase/full-schema.sql`, `scripts/check-schema-acl-parity.cjs`, `backend/app/api/setup.py`
      · **+ the register sweep as a task** (docs only, collides with nothing)
    - `252-02` **The connector credential boundary** — `backend/app/services/connector_service.py`,
      `backend/app/api/connectors.py`, `backend/app/models/connector.py` (B-2 **and** B-3 together,
      because both land in `connector_service.py` and two plans could not share it)
    - `252-03` **Source honesty** — `WatchRowCard.tsx` (+ its NEW suite),
      `WatchedFoldersSection.tsx`, `sourceHealthVocabulary.ts` (B-4, W-1, W-2, W-3)
    - `252-04` **Panel honesty** — `StreamsProvider.tsx`, `streamsStore.ts`, `TodosSection.tsx`,
      `PhaseTimeline.tsx`, `PhaseCard.tsx`, `phaseStatusMeta.ts`, `ThinkingBlock.tsx`
      · **+ the `BUG-260915-01` report correction as its FIRST task** (D-20)
  - **Wave 2 (one plan):**
    - `252-05` **Gate adoption** — the SOLE writer of `scripts/vitest-count-gate.cjs`: W-7's 8→9,
      `WatchRowCard.test.tsx` into BOTH knobs, and every pin wave 1 moved.
  - ⛔ **The fifth plan exists because `vitest-count-gate.cjs` is the one file three wave-1 plans
    would otherwise contend on**, and a wave boundary that looks parallel and is not is this
    project's recorded failure. **It is not a gap-closure round** — G-7 does not fire.
- **D-40 — Every worktree runs `bash scripts/bootstrap-worktree.sh "$(pwd)"` FIRST**, and every
  vitest invocation carries `GSD_VITEST_MAX_WORKERS=2`. ⛔ Never `rm -rf` a worktree —
  `bash scripts/teardown-worktree.sh <path>`.
- **D-41 — No plan mutates the local database**, so worktree rule 4 does not bind. B-1 edits SQL
  **text artifacts** only; ⛔ **nothing in this phase applies a migration or runs
  `regenerate-full-schema.sh`.**

### Gates, baselines and honesty about this phase's own close

- **D-42 — Backend baseline MEASURED TODAY: `71 failed · 4864 passed · 2 xfailed · 2 xpassed ·
  0 collection errors`.** Exactly at the locked ceiling of **71** — **zero headroom**. Any new
  failure breaks the gate. ⚠ **The `passed` figure has grown 3497 → 4864 since the ceiling was
  written; the ceiling is on FAILED and a bigger `passed` is the suite working.**
  ⛔ The failing SET is captured whole to `252-BASELINE-backend-raw.txt` (4,906 lines) and the 71
  node ids alone to `252-BASELINE-backend-failures.txt` — **not a tail.** ⚠ A first attempt here
  piped through `tail -15` and published **14 of 71**; it is recorded because it is the exact trap
  `feedback_capture_the_set_never_a_tail` names, and because a set that is wrong by 57 members
  cannot triage anything. **Count with `grep -c`; diff SETS, never counts.**
  **The 71 spread across 24 files**, the largest being `test_retrieval_service.py` (15),
  `test_sql_service.py` (12) and `test_explorer_agent.py` (6).
- **D-42a — ⭐ EVERY SUITE IN THIS PHASE'S BACKEND BLAST RADIUS IS GREEN AT BASE.** Measured:
  `grep "^FAILED" … | grep -i "connector\|setup\|oauth\|mcp"` returns **nothing**. So for plans
  `252-01` and `252-02`, *any* backend red is **this phase's** — there is no inherited noise to hide
  behind, and no plan may attribute a failure to the baseline without finding its node id in
  `252-BASELINE-backend-failures.txt`.
- **D-43 — Frontend typecheck baseline: 67 errors via `tsc -p tsconfig.app.json --noEmit`.**
  ⛔ `npx tsc --noEmit` type-checks **zero files** and exits 0 — it is vacuous here.
- **D-44 — A red count-gate run is triaged by PROCEDURE, never by touching the cap.** Capture
  failing filenames from the gate's persisted JSON **before** re-running; check each against
  `git diff --numstat <base> HEAD`; a byte-unchanged member of SEED-171's five is recorded as
  *"provably unmodified"* — ⛔ never as *"fine"*. **One green sample of a flaky suite proves nothing.**

- **D-44a — ⛔ THE COUNT GATE IS ALREADY RED AT THIS PHASE'S BASE, AND THE PROCEDURE WAS RUN
  BEFORE ANY EDIT — so a plan cannot mistake this for damage it caused.**
  Measured today, `GSD_VITEST_MAX_WORKERS=2`, quiet tree, from the repo root, verdict line read
  verbatim:

  ```
    total 8379  ·  failed 2  ·  pinned total 7572
  RESULT: COUNT GATE VIOLATED (1 reason(s))
    FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
  ```

  **The failing SET, pulled from the gate's own persisted JSON before anything was re-run — both
  cases, not a count:**

  | File | Case | Error |
  |---|---|---|
  | `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — *"the mount harness works"* | `Error: STACK_TRACE_ERROR` |
  | `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — *"the four shipped tab triggers render"* | `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` |

  ⭐ **This is `SEED-171`'s recorded pair on its FOURTH reproduction** — it is written verbatim at
  `SEED-171-…md:357-358`, `:392-393` and `:473-474`, and the seed records that the suite re-runs
  **`46 passed | 1 skipped`, clean, in isolation**, with its pin of `47` intact. `git status --short
  frontend/src/components/library/` is **empty**, so both files are byte-unchanged at this base.
  **Recorded as *provably unmodified*, ⛔ never as *fine*.**
  ⛔ **The cap was NOT touched, and no plan may touch it.**
  ⭐ **Consequence for every plan in this phase:** *"the count gate is green"* is **not a reachable
  acceptance criterion here**. The criterion is **per-file deltas + the explicitly-run in-scope
  suites**, and the failing set must be **identical to the two rows above** — a third failure is the
  phase's, these two are not.

  ⚠ Also measured and worth not re-deriving: `total 8379 · pinned 7572`. CLAUDE.md's newest recorded
  figures are `7816 / 7020 / 241 files` (2026-09-07). **A growing number is the gate WORKING** — its
  contract is *no per-file DECREASE* and *zero NEW failing*, never a fixed grand total.
- **D-45 — `security_enforcement` and `code_review` are ON. Not optional.** B-1, B-2 and B-3 are
  live security defects.
- **D-46 — ⭐ THIS PHASE CLOSES `self-verified` + `independent_review: owed`, AND SAYS SO.**
  The ROADMAP states *"this phase is itself a `DEBT-06` row"*. The operator is absent by their own
  instruction, and Gemini cannot be driven from here. **Post a review request to the agent bus
  (`--to gemini`) at close and record the debt honestly.** ⛔ **Do NOT tick `DEBT-06`** and do not
  let a green gate stand in for a reviewer — `BUS-247` records a self-verified close that shipped
  two blockers with every gate green, which is how this phase came to exist.

### Claude's Discretion

- Exact wording of every new user-visible sentence, within the decisions above — sourced from the
  existing vocabulary modules (`sourceHealthVocabulary.ts`, `connectionsCopy.ts`, `COPY` in
  `WatchedFoldersSection.tsx`, `phaseStatusMeta.ts`), ⛔ never as a new literal at a call site.
- Test-file names and per-case breakdown, provided D-19's content-assertion rule holds.
- The internal shape of `check-schema-acl-parity.cjs`, provided it is driven RED (D-07).

### Folded Todos

None. The single `todo.match-phase` hit — `spike-nl-workflow-authoring.md` (score 0.60) — matched on
generic keywords (*derived, phases, run, real, 2026*) and has no relationship to the audit gaps.
⛔ Folding it would be the new capability G-7 forbids in a gap-closure phase. Recorded under
`<deferred>` so a later phase knows it was considered and why it was left.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The scope source — read FIRST, it is this phase's specification
- `.planning/v4.2-MILESTONE-AUDIT.md` **§2** — the four blockers, each with its measured table
- `.planning/v4.2-MILESTONE-AUDIT.md` **§3** — E2E flows; Flow C's two holes and why
  `BUG-260915-01` must be corrected before anyone builds its fix
- `.planning/v4.2-MILESTONE-AUDIT.md` **§8** — the ordered work list. ⛔ **Scope is this section and
  nothing else.**
- `.planning/v4.2-MILESTONE-AUDIT.md` **§9** — all nine warnings (W-5 and W-9 are ✅ resolved clean)
- `.planning/ROADMAP.md` **§"Phase 252: Close the v4.2 audit gaps"** (`:234-270`) — the five success
  criteria and the phase Flags block

### Project rules that BIND this phase
- `CLAUDE.md` § *Workflow guardrails* — **G-5** (hot-file ledger), **G-7** (gap-closure round cap),
  **G-8** (plan-count proportion), **G-4** (lived-experience UAT)
- `CLAUDE.md` § *Parallel execution — worktrees are ENABLED* — the four mandatory rules,
  `GSD_VITEST_MAX_WORKERS=2`, and the count-gate trajectory
- `CLAUDE.md` § *Reported bugs cross-check* and § *Seeds register cross-check* — the register
  lifecycle this phase's sweep discharges
- `CLAUDE.md` § *Deployment* — the same-commit deployment-artifact parity rule that D-06 obeys
- `docs/HOT-FILE-LEDGER.md` — **every file in this phase's blast radius has a row; the gate was run
  and returned `ledger gate OK` over all 12.** ⛔ Read each file's own section before planning
  against it; the named seam and binding invariants live there, not in the summary table.

### B-1 — the greenfield bootstrap
- `supabase/migrations/181_revoke_public_secdef_functions.sql` — the 31 REVOKEs to mirror
- `scripts/full-schema-supplement.sql` — the destination; its header states the maintenance contract
- `scripts/regenerate-full-schema.sh` `:104` — the `--no-privileges` that makes a dump structurally
  unable to carry a grant
- `supabase/full-schema.sql` `:7449-7456` — **this exact failure class, documented verbatim for
  migration 118.** Third recurrence.
- `supabase/SETUP.md` `:179-244` — the mirror-it-into-the-supplement rule and its table

### B-2 / B-3 — the credential boundary
- `backend/app/services/connector_service.py` `:571-588` (B-2 handler) · `:640-675`
  (`store_oauth_client_credentials`, the single write seam)
- `backend/app/api/connectors.py` `:1310-1365` — the RFC 7591 dynamic-registration block
- `backend/app/models/connector.py` `:160-197` — `_validate_custom_client_id` and the
  `CustomClientId` annotation; `:286`, `:393`, `:600` — the three request models it already guards
- `.planning/reported-bugs/BUG-260907-02-custom-client-id-accepts-a-secret-into-a-readable-column.md`

### B-4 / W-1 / W-2 / W-3 — source honesty
- `frontend/src/components/sources/WatchRowCard.tsx` `:234-248` (sync + the tautology),
  `:251-285` (both pills), `:380-385` and `:611-613` (**the two contradictory slots**)
- `frontend/src/components/sources/WatchedFoldersSection.tsx` `:262-293` (`handleSyncNow`),
  `:352-368` (`runFix`)
- `frontend/src/components/sources/sourceHealthVocabulary.ts` `:49` (**"a new cause adds a ROW,
  never an `if`"**), `:165-205` (`CONTROL_FOR_CAUSE`)
- `frontend/src/lib/api/sources.ts` `:117-126` (`WatchSyncResponse` — ⛔ **it carries no change
  count**), `:193-204` (`triggerWatchSync`)

### Flow C — panel honesty
- `.planning/reported-bugs/todo-rows-flash-not-ticked-on-a-live-run-after-thread-open.md` —
  ⛔ **correct this BEFORE building (D-20)**
- `frontend/src/components/panel/TodosSection.tsx` `:243-264` — the shouting hook-order comment
- `frontend/src/providers/StreamsProvider.tsx` `:1503` / `:1975` / `:2506` (the global in-flight
  lock), `:1936-1942` (`setViewingThread` — reconcile **already** fires), `:2028` (the code's own
  note that the lock is global), `:3270-3290` / `:3381-3390` (`loadMessages` sets/clears
  `loadingThreads`), `:4762` / `:4793` (the two selectors)
- `frontend/src/stores/streamsStore.ts` `:219-222` — `loadingThreads`' **second** consumer
- `frontend/src/components/panel/PhaseCard.tsx` `:404-422` — `isRunning` from phase status alone
- `frontend/src/components/panel/PhaseTimeline.tsx` `:141-147` — it already holds `threadId`
- `frontend/src/components/panel/phaseStatusMeta.ts` — the status vocabulary the new row joins
- `frontend/src/components/panel/WorkspacePanel.tsx` `:542` — the mount. ⛔ **Not modified (D-27).**

### Gates and baselines
- `scripts/vitest-count-gate.cjs` `:152` / `:2887` / `:4212` / `:5120-5180`
- `scripts/check-hot-file-ledger.cjs` · `scripts/check-seeds-register.cjs` ·
  `scripts/check-gap-closure-rounds.cjs` (**G-7 clear**, run today) ·
  `scripts/check-claude-md-size.cjs`
- `.planning/phases/252-close-the-v42-audit-gaps/252-BASELINE-backend-raw.txt` — the full failing SET

### Design vocabulary
- `Skill("sketch-findings-agentic-rag")` — the panel shell, run-honesty and phase-timeline
  decisions. ⚠ **Load it before writing any user-visible sentence** in `PhaseCard`/`PhaseTimeline`
  or the watch card. **G-2 does NOT fire** — no new surface is drawn; every change is a correction
  to what an existing surface says.

### Deliberately NOT in scope — listed so they are not picked up by accident
- `.planning/DEBT-06-AUDIT.md` · `.planning/DEBT-06-REFUSALS.md` · `.planning/phases/251-.../251-BUS-TRIAGE.md`
  — the contested `DEBT-06` ruling and `BUS-246`/`247`/`248`. **Operator-owned.** Read for context;
  ⛔ change nothing.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`_validate_custom_client_id`** (`models/connector.py:160`) — the shipped smell-check. B-3 reuses
  it at the writer; ⛔ do not write a second copy.
- **`store_oauth_client_credentials`** (`connector_service.py:~640`) — already the single write seam
  (id→`config`, secret→ungranted column, legacy plaintext swept, `org_id`-scoped). B-3 validates
  **inside** it rather than adding a writer; that is also the repair path D-13 names.
- **`COPY.asked(withinPhrase(...))`** (`WatchedFoldersSection.tsx`) — the shipped queued sentence.
  B-4 **reuses** it; ⛔ it must not be re-written in the card.
- **`SettingsWriteRefused` → 400** (`admin.py:1784`, `settings.py:951`) — the exact shape W-4 copies.
- **`reconcileErrors` Map + `useReconcileErrorForThread`** — the shipped per-thread pattern D-21's
  new `reconcilingThreads` slice mirrors.
- **`phaseStatusMeta`'s quiet-terminal family** (`pending`/`skipped`/`unknown`) — the register D-26's
  new row joins.
- **`scripts/full-schema-supplement.sql` §5** (`connector_connections.secret_ciphertext`, mig 118) —
  the precedent for a manually-mirrored ACL; D-05's section 6 follows its shape.

### Established Patterns
- **A new cause adds a ROW, never an `if`** (`sourceHealthVocabulary.ts:49`). Binds D-26 and D-29.
- **Presence assertions cannot see content drift.** Binds D-19 — and is *how B-4 shipped green*.
- **`status:`/`id:` frontmatter IS the index.** Binds D-35 and D-36.
- **Additive-sibling discipline in `WorkspacePanel.tsx`** — three separate blocks each swear they add
  no prop to `PhaseTimeline`/`PhaseCard`. D-27 keeps all three true.
- **Hooks are never short-circuited** (`TodosSection.tsx:250`). Binds D-23, and the existing pin is
  extended rather than replaced.
- **A guard nobody has seen fire is not a guard.** Binds D-07.

### Integration Points
- `regenerate-full-schema.sh` concatenates header + dump + supplement; the supplement is
  `full-schema.sql`'s **byte-identical 259-line tail**, measured. That equivalence is D-06's licence
  and its required proof.
- `WatchRowCard` ← `WatchedFoldersSection` ← `IngestionTab` ← `LibraryPage`. The `onSyncNow`
  signature change (D-15) stops at the section — ⛔ it must not reach `IngestionTab`.
- `PhaseTimeline(threadId)` → `usePhases` → `PhaseCard(phase, position, timing)`. D-25 adds a
  **fourth optional prop**; the panel mount is untouched.

### ⚠ The gap that let B-4 ship, stated as an integration fact
`src/components/sources` is **not** a TARGETS **directory** entry — TARGETS names ten individual
files there — and `WatchRowCard.tsx` is in **neither** knob **and has no test file at all**. So the
count gate was structurally unable to say anything about it at any total. ⭐ **TARGETS decides what
RUNS; BASELINE decides what is GUARDED, and a file can be on the wrong side of both.**

</code_context>

<specifics>
## Specific Ideas

- **"Correct the report before building the fix"** is the phase's own method, not a formality. It
  applies twice: `BUG-260915-01`'s false mechanism (D-20) **and** W-6's stale in-neither-knob
  sentence (D-02). In both cases the register rotted and the code did not.
- **Every correction here keeps the original beside it, struck through rather than deleted** — this
  repo's recorded convention, and the reason each of these was findable at all.
- **The durable half is what makes B-1 different from its two predecessors.** 118 was fixed and
  documented; 181 reproduced it anyway. A third prose note would be the third recurrence's
  contribution to a fourth.

</specifics>

<deferred>
## Deferred Ideas

- **`backend/app/api/connectors.py`'s extraction — ⛔ OWED at its SIXTH landing** (2051→2071→2091→
  2102→2113→2140). This phase is landing **seven**. ⚠ Per G-5 a **seventh must propose the
  extraction FIRST**. Recorded here explicitly so the next phase to touch this file cannot claim it
  was not told. This phase's own landing is **honoured by construction** — one `except` arm and one
  validation call inside an existing block; no new route, no new helper.
- **`reconcile`'s one-shot retry** — the code at `StreamsProvider.tsx:2028` wants it and is blocked
  by the global lock that D-22 makes per-thread. ⛔ **Not taken here**: it is a behaviour change, not
  a gap fix. The unblocking is a side effect and must be named as one, not spent.
- **A `src/components/sources` directory entry in TARGETS** — would close the class D-03 found
  rather than the instance. Out of scope (it would adopt ~10 unpinned suites at once and move the
  shared gate for reasons unrelated to this phase). ⚠ Worth a seed at close.
- **`scripts/check-schema-acl-parity.cjs` generalised to table and column privileges** — D-07 ships
  the function-EXECUTE arm, which is the one that has now failed three times. The wider sweep is a
  separate piece of work.
- **The `DEBT-06` structural gap** — `grep -rln "independent_review" scripts/ .claude/hooks/` returns
  **nothing**, so the field `DEBT-06`'s close condition is written against has no gate, and 240's
  marker went stale in ten hours. ⛔ Out of scope by ROADMAP; survives any operator ruling on
  `BUS-247`.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (score 0.60) — matched on generic keywords only
  (*derived, phases, run, real, 2026*); nothing to do with the audit gaps. Left open. Folding an
  NL-authoring spike into a gap-closure phase is the new capability **G-7** forbids.

</deferred>

---

*Phase: 252-close-the-v42-audit-gaps*
*Context gathered: 2026-09-16*
