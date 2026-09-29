---
phase: 252-close-the-v42-audit-gaps
plan: 03
subsystem: library-watched-sources
tags: [SC#4, W-1, W-2, W-3, WATCH-03, WATCH-04, WATCH-06, WATCH-07, honesty, first-suite]
requires:
  - "frontend/src/lib/api/sources.ts — WatchSyncResponse (read only, unchanged)"
  - "backend/app/services/sources/failure_cause.py — the Cause union (read only, UNTOUCHED)"
provides:
  - "WatchSyncOutcome — the discriminated verdict the parent returns and the card renders"
  - "CONNECTION_PILL_FOR_CAUSE — cause → connection-pill reading, as DATA"
  - "WatchRowCard.test.tsx — the component's first test suite, 9 cases"
affects:
  - "frontend/src/components/sources/WatchedFoldersSection.tsx (the only caller)"
tech-stack:
  added: []
  patterns:
    - "one derived slot instead of two independent renderers"
    - "a new cause adds a ROW, never an `if` (sourceHealthVocabulary.ts:49)"
    - "assert rendered CONTENT, never testid presence"
key-files:
  created:
    - frontend/src/components/sources/__tests__/WatchRowCard.test.tsx
  modified:
    - frontend/src/components/sources/WatchRowCard.tsx
    - frontend/src/components/sources/WatchedFoldersSection.tsx
    - frontend/src/components/sources/sourceHealthVocabulary.ts
    - frontend/src/components/sources/sourceHealthVocabulary.test.ts
    - frontend/src/components/sources/bug260912AppCredentials.test.ts
    - frontend/src/components/sources/WatchedFoldersSection.test.tsx
decisions: [D-03, D-04, D-15, D-16, D-17, D-18, D-19, D-28, D-29, D-30, D-43, D-44a]
metrics:
  duration: ~1h
  completed: 2026-09-16
---

# Phase 252 Plan 03: Make the watched-source card say what happened — Summary

The card now reports the outcome the server actually produced, in one slot that cannot contradict
itself, with no invented change count and no rate-limit claim nothing can justify — and the
component has a test suite for the first time in its life.

## What shipped

| # | Task | Commit |
|---|---|---|
| 1 | `WatchRowCard.test.tsx` — the first suite, driven RED | `9f652cc8f` |
| 2 | B-4 — the outcome comes from the parent, in ONE slot | `f0d869db1` |
| 3 | W-1 / W-2 / W-3 — three honest readings | `d1850cb67` |

Base: `53e2435b7` (asserted; the worktree arrived on stale `master` and was reset).

---

## Task 1 — the RED drive, with every failure quoted

**7 of 9 cases failed on the shipped code; cases 5 and 7 passed, exactly as the plan required.**
The plan asked for cases 1, 2, 3, 4, 6 and 8 — case 6 is written as two cases (`6a` `token_revoked`,
`6b` `app_credentials_invalid`), so seven failures is the six the plan named.

### ⚠ The first drive was a RED FOR THE WRONG REASON, and it was thrown away

Cases 1-3 initially failed with:

```
TestingLibraryElementError: Unable to find an element by: [data-testid="sources-sync-now"]
```

That is a **harness bug, not a defect**: `openCard` clicked the `sources-source-line` wrapper, but
the `onClick` that opens the card sits on the `<button>` *inside* it, so the card never opened and
no control existed to click. **A RED whose cause is the test is not a RED** — it proves the case
binds nothing. The helper was fixed to click `within(line).getByRole("button")` and to `await` the
card, and the reason is written into the helper's docblock so the next author does not repeat it.

### The real RED, verbatim

| # | Case | Actual failure output |
|---|---|---|
| **1** | never claims a change count | `AssertionError: expected 'Invoices● Connected●ReadingWork Drive…' not to contain '0 changes'` — received: `…Checked 5 min ago · 4 files✓ Synced just now (0 changes)Sync nowHistory…` |
| **2** | ⛔⛔ refusal + success co-render | `AssertionError: expected … not to contain 'Synced just now'` — received: `…✓ Synced just now (0 changes)Sync nowHistoryPurge missing filesReading is switched off for this source.` |
| **3** | a rejected sync shows a failure | `AssertionError: expected … to contain 'The check could not be asked for.'` — received: `…Checked 5 min ago · 4 filesSync nowHistoryPurge missing files` (**nothing at all was rendered**) |
| **4** | a 503 is not a 429 | `AssertionError: expected <span …(2)>…(1)</span> to be null` — received a `sources-run-pill` reading **`Run failed (429)`** |
| **6a** | `token_revoked` ≠ Connected | `expect(element).not.toHaveTextContent(/connected/i)` — Received: `● Connected` |
| **6b** | `app_credentials_invalid` ≠ Connected | `expect(element).not.toHaveTextContent(/connected/i)` — Received: `● Connected` |
| **8** | the control names the door | `expect(element).toHaveTextContent(/Settings/)` — Received: `Reconnect Work Drive` |
| **5** | ⭐ CONTROL | **passed** before and after |
| **7** | ⭐ CONTROL | **passed** before and after |

⭐ **Case 2's received string is the whole plan in one line.** One card, one click, rendering
`✓ Synced just now (0 changes)` **and** `Reading is switched off for this source.` simultaneously.
That is not a wording problem; it is the surface asserting two incompatible facts.

### `data-testid` usage — every hit accounted for

`grep -c "getByTestId\|findByTestId"` → **11**, and **none of them is an assertion.** Each is a
*query target* whose assertion is over text, or a navigation step:

| Site | What it scopes | The assertion |
|---|---|---|
| `openCard` ×2 | finding the collapsed line / awaiting the card | navigation, no assertion |
| cases 1, 2, 3 | `sources-sync-now` | `await user.click(...)` — an action, not an assertion |
| case 4 | `sources-run-pill` | `within(...).queryByText(/429/)` — **content** |
| case 5 ×2 | `sources-run-pill` | `.textContent` compared between two mounts — **content** |
| cases 6a, 6b, 7 | `sources-connection-pill` | `toHaveTextContent(/connected/i)` — **content** |
| case 8 | `sources-fix` | `toHaveTextContent(/Reconnect/)` + `/Settings/` — **content** |

⛔ There is **no** `expect(getByTestId(x)).toBeInTheDocument()` anywhere in the file — measured:
`grep -c "toBeInTheDocument"` → **0**, so the claim is not a reading of my own intent. That is the
rule the suite exists to honour: *presence assertions cannot see content drift*, and a
non-collapse assertion is exactly what let B-4 ship green.

---

## Task 2 — B-4: one slot, fed by the parent

**(a)** `handleSyncNow` now returns `WatchSyncOutcome`. ⚠ **Every state write is byte-for-byte the
behaviour it already had** — D-04 measured the parent was correct; its only fault was silence. The
queued sentence is now built **once** into a local and used twice (pending state + return value),
so the two cannot disagree.

**(b/c)** The card derives `syncLine = syncOutcome ?? (refusal ? {kind:"refused", says:refusal} : null)`
and renders **exactly one** element from it. The second renderer is **deleted, not guarded**.

**(d)** The count literal is gone and nothing replaces it.

### `grep -rn "sources-refusal" frontend/src` — the result the plan asked for

Run **before** the change:

```
src/components/sources/WatchedFoldersSection.history.test.tsx:329:  await waitFor(() => expect(screen.getByTestId("sources-refusal")).toBeInTheDocument())
src/components/sources/WatchedFoldersSection.history.test.tsx:330:  expect(screen.getByTestId("sources-refusal")).toHaveTextContent(/switched off on this server/)
src/components/sources/WatchRowCard.tsx:612:            <p data-testid="sources-refusal" className="text-[11px] text-muted-foreground">
```

**Yes — a parent-level suite does scope by it.** So the one slot carries
`data-testid={kind === "refused" ? "sources-refusal" : "sources-sync-outcome"}`, derived from the
same single value. `WatchedFoldersSection.history.test.tsx` passes untouched.

### ⚠ One behavioural consequence, stated rather than left to be discovered

The single slot lives where the success chip already lived — inside the actions toolbar, which is
gated on `!isDegraded`. The deleted refusal block was **not** so gated. In practice this is
unreachable (a degraded card renders no Sync control, so it cannot produce a refusal), but it is a
real difference and is recorded here rather than claimed as a pure move.

### Acceptance greps — all at 0

| grep | result |
|---|---|
| `0 changes` | **0** |
| `Synced just now` | **0** |
| `{refusal &&` | **0** |
| `triggerWatchSync` | **0** |
| `dangerouslySetInnerHTML` | **0** (TM-252-15) |
| `onSyncNow` reach | `WatchRowCard.tsx`, `WatchedFoldersSection.tsx`, and the new suite — ⛔ **never** `IngestionTab` or `LibraryPage` |

---

## Task 3 — W-2's verdict: **NO genuine rate-limit cause exists**

**The answer is NO, and the `429` reading therefore DISAPPEARS ENTIRELY. Nothing replaces it.**

### The line that decides it

`backend/app/services/sources/failure_cause.py:97`, inside `_STATUS_CAUSE`:

```python
429: "unreachable",
```

sitting in the same table as `408`, `500`, `502`, `503`, `504` — all mapped to the identical cause.
And the client mirror, `sourceHealthVocabulary.ts:313`, puts the rate-limit tells in the **same
regex alternation** as timeouts and 5xx:

```
tim(?:ed|e) ?out|timeout|connection (?:reset|refused|aborted|error)|\b429\b|rate ?limit|quota exceeded|\b5\d\d\b|…
```

The `Cause` union (`failure_cause.py:71`) carries `token_revoked`, `folder_gone`, `unreachable`,
`connection_disabled`, `app_credentials_invalid`, `unknown` — **no rate-limit member.**

⭐ **A 429 and a 503 are indistinguishable downstream of classification**, so no vocabulary row
could have been keyed on rate limiting honestly. ⛔ **No cause was invented to keep the string
alive** — a label nothing can justify is worse than no label.

⚠ **`failure_cause.py` was NOT touched.** Its `Cause` union is still ONE plain-text line, and the
`?raw` fence that binds the frontend to it is unaffected.

### The tautology, verbatim (quoted here because the card may not quote it — see Pitfall 8 below)

```ts
// :184  the default
const cause: SourceFailureCause = stopped?.cause ?? classifySourceFailure(watch.last_error)
// :247-248  the deleted guard
const isRateLimited =
  cause === "unreachable" && Boolean(classifySourceFailure(watch.last_error) === "unreachable")
```

With `stopped` absent the two conjuncts are the **same expression**, so the guard was
`cause === "unreachable"` — the **catch-all**. Deleted; the pill renders `presentation.label`.

### W-1 — the pill reads the cause

New table `CONNECTION_PILL_FOR_CAUSE` in the vocabulary; the card reads `pill.glyph`/`pill.label`
and styles from a local `CONNECTION_PILL_CLASS` keyed by `tone`. The deleted binary, verbatim:

```ts
const isConnectionDisabled = stopped?.cause === "connection_disabled"
```

| cause | pill | why |
|---|---|---|
| `token_revoked` | ⊙ Authorisation withdrawn | connection-level |
| `app_credentials_invalid` | ⊙ Credentials rejected | connection-level |
| `connection_disabled` | ⊙ Connection Off | **shipped string, preserved word for word** |
| `folder_gone` | ● Connected | ⚠ NOT connection-level |
| `unreachable` | ● Connected | ⚠ NOT connection-level |
| `unknown` | ● Connected | the ordinary case — a healthy watch resolves here |

**Pill region reading (the plan asked for the region and the reading):** `WatchRowCard.tsx:317-335`.
`grep -c "cause ===" WatchRowCard.tsx` → **0**. The pill is a map lookup with **no inline cause
ternary**; the only two ternaries in the element are `syncLine.kind === "refused"` (the testid) and
the `queued` styling, neither of which is a cause branch.

### W-3 — the door is named, the verb survives

`CONTROL_FOR_CAUSE.token_revoked.label` → `` `Reconnect ${named(connectionName)} in Settings ↗` ``.
`action` is **unchanged** at `"reconnect"`.

`grep -n "action:" sourceHealthVocabulary.ts | sort -u` yields exactly the three shipped actions —
`reconnect`, `repick_folder`, `retry` — plus the type declaration listing those same three. **No
fourth action.**

⚠ **The two siblings DISAGREE about the arrow, so this was a decision and not a transcription.**
`connection_disabled` ends `in Settings ↗`; `app_credentials_invalid` ends `in Settings` (no arrow).
The arrow was taken, because it marks a control that **leaves this surface**, and `runFix` for
`reconnect` does exactly that (it only navigates). Recorded in the row's comment.

---

## ⛔ THE FINDING OF THIS PLAN: Pitfall 8 fired **FIVE** times, and every time on prose I wrote

Every one was caught by a guard rather than by review, and each is recorded because the class is
this repo's most reliably-repeated mistake: **a `?raw` fence, and a `grep` acceptance criterion,
cannot tell code from a comment.**

| # | What I wrote | What fired | Where |
|---|---|---|---|
| 1 | a comment forbidding raw-HTML injection, which **named the prop** | `⛔ no per-file row is built with raw HTML` | `WatchedFoldersSection.test.tsx` |
| 2 | comments quoting the deleted literals to record their removal | the plan's own acceptance greps read **2 / 1 / 1 / 2** instead of 0 | Task 2 criteria |
| 3 | a docblock quoting the deleted `cause === "…"` binary | `⭐ PROVED — the leaf's source contains NO per-cause branch` | `sourceHealthVocabulary.test.ts` |
| 4 | a docblock naming the causes in prose | the occurrence pin read **7**, not 4 | `sourceHealthVocabulary.test.ts` |
| 5 | a JSX `{/* */}` comment mentioning `watch.last_error` | `⛔ the raw last_error is only ever handed to the vocabulary leaf` | `WatchedFoldersSection.test.tsx` |

⭐ **#5 is the sharpest and is worth carrying forward:** that fence strips comments by dropping
lines whose trimmed form starts with `*`. A **JSX block comment's continuation lines do not**, so a
`{/* … */}` block is invisible to the stripper and reads as live code. A `//` or `/** */` comment
would have been stripped; the JSX one was not.

**Resolution, applied uniformly: describe, never quote.** Every reason is kept in the source; every
*literal* moved here, where no grep mistakes it for a live one. Each site now carries a one-line
note saying why it does not spell the thing it is about — the same discipline
`sourceHealthVocabulary.ts` already applies to its fifth and sixth causes.

---

## Deviations from Plan

### `[Rule 3 - Blocking]` Two files outside `files_modified` had to be edited

Both are test files whose **pins asserted the defects this plan removes**. Neither could be left:
the plan cannot complete with the tree red.

**1. `frontend/src/components/sources/WatchedFoldersSection.test.tsx`** — its SC#2 discrimination
case asserted `expect(runPills[0]).toHaveTextContent(/run failed \(429\)/i)` against a fixture
carrying `last_error: "429 Too Many Requests: Rate limit exceeded"`. **That line was pinning W-2's
defect.** Re-baselined to `not.toHaveTextContent(/429/)` **plus a non-vacuity assertion** that the
pill still says something. ⭐ What the case is *about* — that the two pills **discriminate** — is
unchanged and still driven, and it now also serves as a live control for W-1's "not every failure
is a connection failure" half. Case count unchanged (44 declared / 49 run).

**2. `frontend/src/components/sources/bug260912AppCredentials.test.ts`** — its occurrence pin on
`app_credentials_invalid` read `toBe(4)`; the new table makes it 5. Re-baselined 4 → 5. Case count
unchanged (10 declared / 14 run).

### `[Rule 2 - Correctness]` Two occurrence pins re-baselined — and why that is not loosening

The plan warned: *"if it breaks, that pin is the thing to check first, not to loosen."* It was
checked, and here is the check.

Both pins assert *"N occurrences, and **every one is a table**."* The new `CONNECTION_PILL_FOR_CAUSE`
is **a fourth/fifth TABLE**, so the **invariant is untouched** — only the count of tables moved:

- `connection_disabled`: **3 → 4**
- `app_credentials_invalid`: **4 → 5**

Three things make this a re-baseline rather than a loosening:

1. Both remain **exact equalities** — never `toBeGreaterThan`, which would be a pin that cannot fail.
2. The **companion** fences are untouched and still prove the real property independently:
   `not.toMatch(/cause\s*===\s*["']/)` and `not.toMatch(/case\s+["']app_credentials_invalid["']/)`
   still red on any branch smuggled in as the extra occurrence.
3. Each identifier is spelled in **exactly its table positions and nowhere in prose**, so the count
   is `+1` and not `+3` — verified: `grep -c connection_disabled` → **4**, after finding **7**.

This is the same discipline the file already applied twice to its backend-cause pin (`4 → 5`, then
`5 → 6`), and both re-baselines ship in the **same commit** as the table that moved them.

### `[Rule 1 - Harness]` The first RED drive was invalid and was re-driven

See Task 1 above. No source was changed on the strength of the invalid drive.

---

## Where the code disagreed with the plan

| Plan said | The code said | Resolution |
|---|---|---|
| `sourceHealthVocabulary.test.ts` is a **42-case** suite | it is **69** at base | The plan's figure is stale by 27. The real change is **69 → 74**, attributed below. |
| *"match the exact punctuation and arrow its two siblings use"* | the two siblings **disagree** — one has `↗`, the other does not | Took the arrow, with the reason recorded in the row. Named as a decision, not a transcription. |
| W-2 case 5 should assert *"the pill does say so"* for a genuine rate limit | no cause can express that, and a 429 read `Run failed (429)` **before** the fix — so any such assertion would fail before and after | Case 5 asserts the **indistinguishability** instead: a 429 fixture and a 503 fixture render the **same** pill. True before (both `Run failed (429)`) and after (both the state label) — a real control that is also the honest finding. |
| `files_modified` lists four files | six were needed | Two pinned the defects; Rule 3, documented above. |

---

## `sourceHealthVocabulary.test.ts`: 69 → 74, attributed case by case

**+5, all mine, no residual.**

| Case added | What it pins |
|---|---|
| `⛔ W-1 — the two AUTHORISATION causes do not claim the connection is fine` | `token_revoked` and `app_credentials_invalid` labels do not match `/connected/i`, and both carry `tone: "attention"` |
| `⭐ W-1 CONTROL — a failure that is NOT connection-level still reads Connected` | `folder_gone`, `unreachable` **and** `unknown` read `Connected` — the other half of D-29, without which the table could have been flipped wholesale |
| `W-1 — the shipped switched-off reading is preserved word for word` | `Connection Off`, byte-identical |
| `W-1 — every cause has a pill, so a new cause cannot render an empty one` | key-set equality with `SENTENCE_FOR_CAUSE`, non-empty label + glyph, tone in the enum |
| `⛔ W-2 — no cause in the taxonomy means RATE LIMITED` | 429 / 503 / timeout all classify to `unreachable`, **plus a non-vacuity assertion** that the union carries no rate-limit member. ⭐ This is W-2's measurement, pinned so it cannot rot into an assumption. |

The three `token_revoked` label assertions and the `connection_disabled` occurrence pin were
**edited in place**, not added — hence `+5` exactly.

---

## ⛔ Per-file counts for Plan 05 to pin

**This plan did NOT edit `scripts/vitest-count-gate.cjs`.** Plan 05 is its sole writer.

| File | Count | Note |
|---|---|---|
| `src/components/sources/__tests__/WatchRowCard.test.tsx` | **9** | ⭐ **NEW — in neither knob today.** Needs BOTH: `src/components/sources` is not a TARGETS *directory* entry, so this suite currently **runs nowhere**. |
| `src/components/sources/sourceHealthVocabulary.test.ts` | **74** | was 69; `+5`, attributed above |
| `src/components/sources/bug260912AppCredentials.test.ts` | **14** | unchanged — assertion edited inside an existing case |
| `src/components/sources/WatchedFoldersSection.test.tsx` | **49** | unchanged — same |
| `src/components/sources/WatchedFoldersSection.history.test.tsx` | unchanged | untouched; passes |

⚠ **D-03's structural half is still owed and is Plan 05's call:** adding a
`src/components/sources` **directory** entry to TARGETS would close the whole class this plan's
finding is about, rather than the one file it happened to catch.

---

## Verification

| Gate | Result |
|---|---|
| `vitest run src/components/sources/__tests__/WatchRowCard.test.tsx` | **9 passed / 9** |
| `vitest run src/components/sources/` | **14 of 15 files green · 348 passed** |
| `tsc -p tsconfig.app.json --noEmit` | **67 errors — SET byte-identical to base**, `diff` returns nothing; **0** name a `src/components/sources/` file |
| `node scripts/check-hot-file-ledger.cjs 252` | `ledger gate OK` — 281 rows, 31 subject files, 13 watched, every one has a row |
| Deleted files | **none** (`git diff --diff-filter=D` empty) |
| `GSD_VITEST_MAX_WORKERS` | **2** on every invocation; never changed |

### ⚠ The one red, and it is INHERITED — proven by measurement, not by unchangedness

`src/components/sources/sourceComposition.test.tsx` — **16 failed | 33 passed.**

`git diff --numstat 53e2435b7 HEAD` on it is **empty**, but that alone proves nothing: the suite
**mounts `WatchedFoldersSection` / `WatchRowCard` (7 references)**, so my source changes could have
broken it. So it was measured directly: the four source files were checked out at `53e2435b7`
(explicit paths only — no blanket reset, no `git clean`, no stash), the suite was run, and the
result was **`16 failed | 33 passed`** — **identical, case for case.** The files were then restored
from the commit. ⛔ **Fully inherited. Zero attributable to this plan.**

⚠ **And CLAUDE.md's figure for this standing red is now STALE.** It records
*"`16 failed | 33 passed` → **`18 failed | 31 passed`** (re-measured 2026-09-08)"*. Measured today
at this base: **`16 failed | 33 passed`** — i.e. back to the *original*, struck-through figure. A
standing-red count that rots in both directions is exactly how an inherited red gets mistaken for a
new one. Not corrected here (CLAUDE.md is outside this plan's `files_modified`); flagged for the
phase close.

⛔ The repo-wide count gate was **not** run, per the plan's instruction — it is already RED at base
on two `sketchComposition.test.tsx` failures (SEED-171, 4th reproduction), which is neither mine nor
my concern.

---

## Known Stubs

None. Every reading the card renders is derived from a real value.

## Threat Flags

None. No new network surface, auth path, file access or schema change. `res.message` reaches one
new render site and is rendered as a React child (auto-escaped);
`grep -c "dangerouslySetInnerHTML" WatchRowCard.tsx` → **0**.

## Self-Check: PASSED

- `frontend/src/components/sources/__tests__/WatchRowCard.test.tsx` — FOUND
- `9f652cc8f` · `f0d869db1` · `d1850cb67` — all FOUND in `git log`
