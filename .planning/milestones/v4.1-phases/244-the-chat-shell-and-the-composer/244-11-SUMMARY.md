---
phase: 244-the-chat-shell-and-the-composer
plan: 11
subsystem: frontend/chat
tags: [SHELL-01, gap-closure, G-3, G-4, BUG-260911-02, reconcile, error-legibility]
gap_closure: true
gap_closure_round: 1
requires:
  - "frontend/src/stores/streamsStore.ts — the per-thread reconcileErrors Map (D-075.4-A1)"
  - "frontend/src/providers/StreamsProvider.tsx — useReconcileErrorForThread selector"
  - "frontend/src/components/chat/ChatArea.tsx — the shipped amber reconcile-error banner"
provides:
  - "a visible failure state for a snapshot that 503s, with the shipped Retry control"
  - "a banner sentence that is TRUE when the transcript is empty"
  - "a written G-4 ruling on BUG-260911-02, and a one-visit discriminator for it"
affects:
  - "every chat thread open — this is the reconcile path"
tech-stack:
  added: []
  patterns:
    - "a console.error is NOT a user-visible state"
    - "an abort is a navigation, not a failure"
    - "a banner sentence is a claim ABOUT THE SCREEN and must depend on the screen"
key-files:
  created:
    - frontend/src/__tests__/providers/streamsProvider_244_snapshot_failure.test.tsx
    - .planning/phases/244-the-chat-shell-and-the-composer/244-11-UAT-ROW.md
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/phases/244-the-chat-shell-and-the-composer/244-01-BUG-260911-02-TRACE.md
    - .planning/reported-bugs/BUG-260911-02-first-click-on-a-thread-selects-it-but-does-not-open-it.md
    - .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md
decisions:
  - "G-4 verdict: SECOND CAUSE — the snapshot-503 path reproduces BUG-260911-02's complaint and its measured evidence, but provably cannot render the welcome pane the report literally describes."
  - "BUG-260911-02 stays `folded`, never closed — nothing here was reproduced in a browser."
  - "Retry-After: 10 is cited as evidence and deliberately NOT consumed — an automatic retry is new behaviour (G-7) and a 503-storm amplification risk."
  - "The `cap_paused` correlation is recorded as a correlation and is NOT upgraded to a cause anywhere in this plan's output."
  - "`streamsStore.ts` gets NO ledger row here — 244-13 owns it."
metrics:
  duration: ~1h40m
  tasks: 3
  commits: 4
  completed: 2026-09-12
---

# Phase 244 Plan 11: The chat surface says when a snapshot fails — Summary

**One-liner:** A swallowed `catch` in `StreamsProvider.reconcile` made a 503 snapshot render a
perfect frame around a silently empty transcript; the failure is now recorded in the SHIPPED
per-thread error slice and the SHIPPED amber banner tells the person so — with a sentence that is
true when nothing is on screen.

⚠ **SELF-VERIFIED, NOT REVIEWED** (D-244-21 / OV-SOLO-01). Gemini is unavailable; no independent
second reviewer exists for this plan. Every verdict below is this executor's own.

⛔ **`SHELL-01` is BUILT, DRIVE OWED — not closed** (D-244-14 / D-244-19). The browser row is
`244-11-UAT-ROW.md`, four arms, every verdict `pending`.

---

## What changed, and why it is not new surface

Everything needed was already shipped, which is what makes this a gap fix rather than a feature
(G-7): the per-thread `reconcileErrors` Map (`D-075.4-A1`), its selector
`useReconcileErrorForThread`, and `ChatArea.tsx`'s amber `reconcile-error-banner` with **Retry**
and **dismiss** — all live, all already driven by the `loadMessages` failure path, and **reached by
nothing on the snapshot path.** This plan connects a shipped producer to a shipped renderer.

**No new slice, no new banner, no new endpoint, no new retry mechanism, no new state, no new
effect, no new prop.** `git diff --stat` for the whole source change is `+43 / -1` across two files,
most of it comment.

### 1. `StreamsProvider.tsx` — record instead of swallow

The swallow was one clause: `console.error("reconcile failed:", err); return`. It now

- keeps the `console.error` (a diagnostic, not a substitute for state),
- **returns early without writing** on `err instanceof DOMException && err.name === "AbortError"`,
- otherwise writes the per-thread entry using the **byte-equivalent expression** the
  `loadMessages` second-failure path already uses,
- `return`s exactly as before, so it still cannot hydrate from an undefined snapshot.

⭐ **A docstring already asserted the routing that did not exist.**
`frontend/src/lib/api/threads.ts:1063` reads *"Both surface as a generic Error to the caller; the
StreamsProvider consumer routes via its existing error handler."* **There was no such routing.** A
claim in a docstring is not a claim anything executes.

⛔ **The abort arm is load-bearing.** `reconcile` fires from `setViewingThread` on **every** thread
switch. Without it, every switch that cancels an in-flight snapshot would raise a failure banner on
the thread the person actually wanted — manufacturing the ROADMAP's own named failure mode (*a
signal nobody will trust after the first false one*) out of the fix for a silence.

### 2. `ChatArea.tsx` — one sentence, one new state

The non-`ApiError` arm now selects on `messages.length === 0`:

| transcript | sentence |
|---|---|
| **empty** | `Couldn't load this conversation. It's still there — try again.` |
| **non-empty** | `Couldn't load latest messages. Showing cached version.` (byte-unchanged) |

The new literal names **no status code, no exception type and no dependency** (`T-244-11-01`) and
interpolates nothing from the server. The `ApiError` arm, the `data-testid` selection, the 409 arm,
`NON_RETRYABLE`, `hideRetry`, the dismiss control, `role` and `aria-live` are all untouched.

**Why it matters, in the reporter's own words:** `BUG-260911-02` records *"the natural reading is
'this conversation is empty'"* — and then two UAT prompts were typed into that pane and went
nowhere. **The old sentence would have confirmed the misreading.**

---

## RED, measured per case — including the two surprises

⛔ Both RED drives were against **unmoved production code**:
`git diff -- StreamsProvider.tsx ChatArea.tsx` was **EMPTY** at the end of Task 1.

| Case | Expected at RED | **Measured at RED** |
|---|---|---|
| **Test 1** — a 503 writes `reconcileErrors` | RED | ✅ **RED** |
| Test 2 — happy path writes nothing | GREEN | ✅ GREEN |
| Test 3 — `AbortError` writes nothing | GREEN | ✅ GREEN |
| **Test 4** — the slice stays per-thread | GREEN (control) | ⚠ **RED** |
| **Test 5** — empty transcript ⇒ no cached claim | RED | ✅ **RED** |
| Test 6 — non-empty keeps the shipped sentence | GREEN | ✅ GREEN |

**Verbatim failures, as required:**

```
FAIL  streamsProvider_244_snapshot_failure.test.tsx > Test 1 (THE GAP) — a 503 from
      getSnapshot writes the thread's reconcileErrors entry
AssertionError: expected false to be true // Object.is equality
- Expected  - true
+ Received  + false
  at streamsProvider_244_snapshot_failure.test.tsx:148:71
```

```
FAIL  ChatAreaBanner.test.tsx > Test 5 (THE GAP) — an EMPTY transcript does not claim a
      cached version, and Retry is offered
TestingLibraryElementError: Unable to find an element with the text: Couldn't load this
conversation. It's still there — try again.
```

### ⚠ Surprise 1 — a "control" was RED, and that is a finding

**Test 4 was written as a per-thread-scoping CONTROL and failed at RED time.** Its positive half
(`reconcileErrors.has(THREAD_A) === true`) sits **downstream of the very write the gap was
missing**, so it could not have been green. **A control can live downstream of the defect it
guards — record its measured colour, never assume it.** The plan anticipated exactly this
possibility (*"a control that is already red is a finding, not a nuisance"*) and it fired.

### ⚠ Surprise 2 — the shipped suite's case (c) pinned its claim in the state that refutes it

`ChatAreaBanner.test.tsx` case **(c)** asserts *"a plain reconcile Error keeps the cached-version
copy"* — and was written against a hard-coded `messages: []`. **It therefore pinned that sentence
in the ONE state where the sentence is false.** It was re-fixtured with a non-empty transcript; its
claim and its assertions are unchanged. **A fixture that cannot express the state a claim is about
will pin the claim in the state that refutes it.**

⚠ A consequence: mounting a non-empty transcript made `MessageList`'s follow-scroll effect throw
`bottomRef.current?.scrollIntoView is not a function` (jsdom performs no layout), which took the
whole case down **before any assertion ran**. Stubbed in-file, with a comment naming
`MessageList.scroll.test.tsx` as the suite that actually owns that effect — **this suite says
nothing about scrolling.**

---

## G-4 — the ruling: ⭐ **SECOND CAUSE**

Written as `## 6.` of `244-01-BUG-260911-02-TRACE.md`, **APPENDED** — `git diff -U0` shows a single
hunk at `@@ -170,0 +171,97 @@`, so §§1-5 are byte-unchanged and keep their refutations.

**The discriminator, driven against source.** §3(c) established that the welcome branch is gated on
`if (!thread)` (`ChatArea.tsx:517`). So a failed snapshot on a **selected** thread renders the
**thread frame with an empty transcript**, never the welcome pane.

| | trace §4's overlay click-sink | the snapshot-503 path |
|---|---|---|
| did the click select? | **no** | **yes** |
| `How can I help you?` | present | ⛔ **impossible** |
| starter-prompt chips | present | ⛔ **impossible** |
| after this plan | no banner | ⭐ **amber banner + Retry** |

Three literals occur **exactly once each** in `ChatArea.tsx` and all sit inside `if (!thread)`:
`How can I help you?` (`:550`) and the Phase-216 chips `📁 Search connected files` /
`💬 Draft a team update` (`:573-587`).

**Why SECOND CAUSE and not UNRELATED.** Taken literally the report describes the welcome pane,
which the 503 path provably cannot produce — read alone that argues UNRELATED. ⚠ **But the
report's described appearance is already a known-unreliable composite:** §3(c) refuted one of its
two halves (the "highlight" was almost certainly HOVER), so there is no single fixed appearance to
assert UNRELATED against. What is **not** in doubt is the report's measured evidence —
`thinking-trigger` `0` after click 1, `8` after click 2 — and the 503 path produces exactly that.
The UAT driver hit exactly that, on the same surface, while looking for this bug.

⛔ **`status:` stays `folded`.** Nothing here was reproduced in a browser. The `re_open_trigger` now
carries **both** discriminators in one visit and names the new banner as an observable **that did
not exist when the report was filed (2026-09-11)** — so its absence in the original is not evidence
either way.

---

## Ledger — both rows re-derived, rows + sections in one commit

| File | row said | **measured 2026-09-12** |
|---|---|---|
| `StreamsProvider.tsx` | `94 / 38 / 4528` | **`96 / 37 / 4614`** — STALE a **FIFTH** time |
| `ChatArea.tsx` | `72 / 36 / 710` | **`74 / 36 / 743`** — STALE, inside the same phase |

⚠ **`StreamsProvider.tsx`'s phase count went DOWN, 38 → 37**, and that is not a file losing
history: CLAUDE.md's recipe subtracts six-digit dated quick-task buckets and the prior reading did
not. **Re-derive with the recipe; never diff two numbers taken from two accountings.**

Both are **honoured by construction** — the provider's change is one existing `catch` (no new
action, slice, subscription or effect); ChatArea's is one ternary inside an already-rendered
`<span>` (zero new state, effects or props).

⛔ **`frontend/src/stores/streamsStore.ts` was NOT given a row.** `check-hot-file-ledger.cjs 244`
exits **1** at this base on that inherited `[no-row]`, named by `244-13-PLAN.md` — **244-13 owns
it.** A row minted by a non-owner goes stale before its owner lands, and a row present-and-wrong
stops the audit. The run was **non-vacuous**: `scan list: 265 rows · subject: 61 files · watched:
29`, and it named **exactly one** file, neither of them mine.

---

## Verification

| Gate | Result |
|---|---|
| `streamsProvider_244_snapshot_failure` + `ChatAreaBanner` + `ChatArea.capPausedComposer` | ✅ **19/19, `failed 0`** |
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ **set diff EMPTY both ways** vs the 67-error base |
| `node scripts/check-claude-md-size.cjs` | ✅ exit 0 — `96891 chars · 64.6% of limit` |
| `node scripts/check-hot-file-ledger.cjs 244` | ⚠ exit 1 on the INHERITED `streamsStore.ts` `[no-row]` — **244-13's** |
| `git diff --stat -- backend/ supabase/` | ✅ **EMPTY** — the 71-failure backend baseline is untouched and was not re-run |
| `git diff -- frontend/package*.json` | ✅ **EMPTY** — no package installed, no legitimacy audit owed (`T-244-11-SC`) |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | ⚠ `total 8221 · failed 11 · pinned total 7432` — **`[failing-tests]` was the SOLE violation reason** |

**Per-file, which is the deterministic half of the contract:**

```
  ChatAreaBanner.test.tsx                         9       9       0
  streamsProvider_244_snapshot_failure.test.tsx   4       4       0
```

Both read `expected == actual`, delta `0`. **The gate reported NO per-file decrease anywhere**, and
every pinned file resolved. My pinned contribution is `+6` (`+4` new suite, `+2` ChatAreaBanner
`7 → 9`) with **no residual** — every other `+N` in the run is an unpinned `— new` suite, which is
where the `+789` grand-vs-pinned gap lives.

### The 11 failures — triaged by filename BEFORE any re-run, and proved inherited

Filenames were extracted from the gate's **own persisted JSON** before anything was re-run, and
each checked against `git diff --numstat 32ada21e1 HEAD` and `git status --short` (clean). **None
of the five failing files is in this plan's diff.**

| File | at the full gate | alone at HEAD | **with my sources REVERTED to base** |
|---|---|---|---|
| `WorkflowBuilderPage.canvas.test.tsx` | 2 red | **green** | — |
| `PublishGauntlet.test.tsx` | 2 red | **green** | — |
| `WorkflowCanvas.test.tsx` | 2 red | 2 red | **green** |
| `sketchComposition.test.tsx` | 2 red | 2 red | ⛔ **2 red** |
| `WorkflowsPage.test.tsx` | 3 red | 1 red | ⛔ **1 red (a DIFFERENT case)** |

⭐ **That last column is the evidence, not an argument.** With `ChatArea.tsx` and
`StreamsProvider.tsx` checked out at `32ada21e1`, `sketchComposition` still failed the same two
cases and `WorkflowsPage` failed a *different* case, while `WorkflowCanvas` — red twice at HEAD —
went green. **The failing set is never the same twice**, which is `SEED-171`'s signature exactly.
The failures are 5000 ms timeouts and unrelated assertions (axe violations, an undo/redo key, a
project-filter count) in suites this plan's module graph does not reach.

⛔ **The cap was never touched** — `GSD_VITEST_MAX_WORKERS=2` on every run, per CLAUDE.md's
correction that adjusting it is measured NOT to fix these failures. ⚠ Stated as *"provably
unmodified"*, never *"fine"*: **one green sample of a flaky suite is not proof of innocence.**

⚠ **Near-name hazard:** `library/__tests__/sketchComposition.test.tsx` (this one) is a **different
file** from `sources/sourceComposition.test.tsx`, which CLAUDE.md records as a standing red in
NEITHER knob. Two `*Composition.test.tsx` files, two dispositions.

---

## Deviations from plan

**1. [Rule 3 — blocking] The bug report's filename is not what the plan wrote.** The plan names
`.planning/reported-bugs/BUG-260911-02.md`; the file on disk is
`BUG-260911-02-first-click-on-a-thread-selects-it-but-does-not-open-it.md`. Used the real path. The
acceptance grep still reads `1` for `^status: folded`.

**2. [Rule 3 — blocking] `Element.prototype.scrollIntoView` stubbed in `ChatAreaBanner.test.tsx`.**
Required by the plan's own Test 6 — jsdom has no layout, so the first non-empty transcript this
suite ever mounted crashed `MessageList`'s scroll effect before any assertion. Same stub
`MessageList.test.tsx` uses, with the boundary written into the comment.

**3. [Rule 2 — correctness] Case (c) of `ChatAreaBanner.test.tsx` was re-fixtured.** See *Surprise
2*. Not doing so would have left a shipped assertion pinning a sentence in the state that makes it
false — and it would have gone red against the fix for the wrong reason.

**4. Minor: `messages` is destructured from `useMessages()`, not a prop.** The plan's `<interfaces>`
block calls it *"already a PROP of ChatArea (destructured at `:62`)"*. It is a hook return,
destructured at `:62`. The substantive claim — *no new read, no new hook, no new prop* — holds
exactly.

**No Rule 4 (architectural) situations arose. No package was installed.**

---

## Known stubs

**None.** No hardcoded empty value, placeholder string or unwired data source was introduced. The
new sentence is a real literal rendered by a real branch driven by real state.

## Threat flags

**None.** No new endpoint, auth path, file access or schema surface. The one boundary this plan
touches (server error payload → rendered UI text) is registered as `T-244-11-01` and mitigated by
construction: the new sentence is a **client-authored literal** that interpolates nothing.

---

## What is owed

1. ⛔ **`244-11-UAT-ROW.md`, four arms, all `pending`** — driven at `/gsd:verify-work` with the
   `window.fetch` patch method. **`SHELL-01` is not closed until Arms 1-3 pass.**
2. ⛔ **`BUG-260911-02` stays `folded`.** Its own `re_open_trigger` (the right-hand-third click on
   an **unpatched** row) is a different visit from the UAT row and is still owed.
3. **Arm 4** is the live observation §6.4's verdict turns on.
4. Two deferrals recorded in `deferred-items.md`: consuming `Retry-After`, and the 503's own root
   cause.
5. ⚠ **An independent review.** This plan is a self-verification (D-244-21).

---

## Self-Check: PASSED

All five claimed artefacts exist on disk (`streamsProvider_244_snapshot_failure.test.tsx`,
`244-11-UAT-ROW.md`, `244-11-SUMMARY.md`, and the two modified source files). All five commits
resolve in `git log 32ada21e1..HEAD`, with the file lists above matching what each message claims.
`STATE.md` and `ROADMAP.md` are untouched — the orchestrator owns those writes.
