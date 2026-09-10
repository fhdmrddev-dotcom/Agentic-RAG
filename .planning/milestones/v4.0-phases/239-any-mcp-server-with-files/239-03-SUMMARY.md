---
phase: 239
plan: 239-03
title: The honesty fix for BUG-260907-01 — a working source connection reads "Ready as source"
status: complete
wave: 3
base_commit: 79f5e7f92
tasks_completed: 4
tasks_total: 4
requires:
  - GET /connectors/source-families publishing mcp + custom_mcp (239-01)
  - PROTOCOL_ADAPTERS / CONFIG_PROTOCOL_MARKERS in services/sources/base.py (239-01)
  - config["source_tools"] written on discovery (239-02)
provides:
  - RowVerdict "source-only" — zero ACTIONS is not zero USES
  - CONNECTION_STATE_SOURCE_ONLY = "✓ Ready as source", on both connectionStateOf arms
  - isSourceCapable's PROTOCOL door — the server's second resolution arm, on the client
  - ConnectionsTabView.sourceFamilies, fail-closed null, fetched by the container
  - F-6 closed — a discovery now shows the binding it just detected
  - F-7 closed — both ungated settings suites added to BOTH count-gate knobs
affects:
  - frontend/src/components/sources/ConnectedSourceSection.tsx (the Library picker now
    offers MCP file servers resolved by transport — behaviour change, not touched here)
  - frontend/src/components/sources/CreateWatchModal.tsx (same predicate, same widening)
key-files:
  created:
    - frontend/src/components/settings/__tests__/ConnectionFormPanel.refreshReceipt.test.tsx
  modified:
    - frontend/src/components/settings/connectionRowVerdict.ts
    - frontend/src/components/settings/connectionRowVerdict.test.ts
    - frontend/src/components/settings/connectionsCopy.ts
    - frontend/src/components/sources/sourceCapability.ts
    - frontend/src/components/sources/__tests__/sourceCapability.test.ts
    - frontend/src/components/settings/ConnectionsTab.tsx
    - frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx
    - frontend/src/components/settings/ConnectionFormPanel.tsx
    - frontend/src/lib/api/org.ts
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - D-239-08 honoured, and the AR-03 tension it sits on is argued rather than ignored
  - the plan's task-02 protocol check was WRONG on two of three arms — see F-1
  - the plan's task-03 rewrite of connectionStateOf would have re-broken three row pins
  - F-6 TAKEN rather than recorded as owed, with the reason stated — see the F-6 section
migration: none
---

# Phase 239 Plan 03: The Honesty Fix (BUG-260907-01) — Summary

A working OneDrive or MCP file connection with zero action tools now reads **`✓ Ready as
source`** in Settings → Connections instead of **`⚠ Not usable`** — and it says it only when
the SERVER has proven the row is browsable, so the fix cannot manufacture a green.

---

## Base commit — the worktree landed in the wrong place, for the THIRD wave running

The worktree arrived at **`1335b4b1a`** — *"Merge develop into master — ship v3.9
Connections"* — the same wrong HEAD `239-01` and `239-02` were both handed. Reset to the
stated base **`79f5e7f92`** (`merge(239-02): tool bindings auto-detected, published, and
overridable`), which is correct and contains both prior waves.

**Three for three. This is a hand-off defect in worktree creation, not a plan defect, and it
has now cost three separate agents the same first five minutes.** Wave 2 predicted it would
happen to me in as many words; it did.

---

## What shipped

### 1. `connectionRowVerdict.ts` — the input set went incomplete; the logic never went wrong

`RowVerdict` gains `"source-only"`; `RowVerdictInput` gains `isSourceCapable?: boolean`,
defaulting **`false`**.

⭐ **The finding worth keeping is about the ORIGINAL file, not about my change.** Every word of
its Phase 221 docblock is still correct about ACTIONS. What changed underneath it is that
Phase 238 shipped `SourceAdapter`s, creating a class of connection with **no actions that
works**. A verdict function does not become wrong by being outvoted; it becomes wrong by being
asked a question it has no input for.

⚠ **`source-only` is returned ABOVE the `discoveryHasRun` split, and that is a decision I owe
an argument for, because AR-03 says an absence is not evidence.** The argument: `✓ Ready`
asserts that ACTIONS EXIST, which an empty discovery genuinely cannot evidence. `✓ Ready as
source` asserts that an ADAPTER IS REGISTERED for this family and the credential is not
revoked or errored — two facts we HOLD, from the server's published registry and from the
row's own status. It is a weaker and differently-shaped claim, and it is measured rather than
assumed. D-239-08 specifies exactly this ordering; I did not silently reinterpret it.

### 2. `sourceCapability.ts` — the server's SECOND door, which the client never had

`services/sources/base.py` resolves an adapter **twice**: an exact `service_id`, and failing
that the **transport the row declared**. The client only did the first. So an MCP file server
— whose `service_id` is *whatever the person setting it up typed* — was invisible to the
client as a source, for every server anyone will ever connect.

Added as **two dicts mirroring `PROTOCOL_ADAPTERS` and `CONFIG_PROTOCOL_MARKERS`**, never an
`||` chain, by `base.py`'s own recorded instruction. The door still requires the SERVER to
have published that protocol as a family: drop `mcp` from `/connectors/source-families` and
every protocol case goes false with no edit here — which is what keeps *"rows, not code"*
true rather than merely stated.

### 3. `connectionsCopy.ts` — one word, one union member, and an arm in TWO places

`CONNECTION_STATE_SOURCE_ONLY = "✓ Ready as source"`. ⛔ Not `✓ Ready`: that word claims
actions this row does not have, and re-using it would reintroduce precisely the defect
`CONNECTION_STATE_UNUSABLE` exists to close — the bug report says so explicitly and it is
right.

⭐ **The arm is added in two places and the second one is the interesting half.** Inside the
`oauth_byo && active` branch it fixes the reported OneDrive row. Below that branch it reaches
an **MCP file server, which is never `oauth_byo`** — and the RED drive showed that such a row
was reading **`✓ Ready`** today from the generic `last_check_verdict === "ok"` fallback. So
the Microsoft-365 over-claim was alive, unnoticed, on the very family this phase adds, and no
test anywhere could see it.

### 4. `ConnectionsTab.tsx` — the row asks the server, and fails closed when it has not been told

`sourceFamilies?: string[] | null` on the view (default `null`), threaded to `ConnectionRow`
at all three mount sites; the container reads `listSourceFamilies()` on `requestKey`, beside
the connections read. ⚠ **The `.catch` sets `null`, never `[]`** — an empty array asserts
*"the server publishes no source families"* and would let a failed fetch assert something,
while `null` says *"we were not told"*. `source_only` takes `text-success` and the success
dot: a warning colour beside a good word is half the defect left standing.

---

## RED evidence — quoted, not summarised

### Tasks 01 + 03 — `connectionRowVerdict.test.ts`

```
 Test Files  1 failed (1)
      Tests  6 failed | 31 passed (37)
```

Six distinct reasons, not one load error:

```
AssertionError: expected 'unusable' to be 'source-only'          ← the OneDrive row
AssertionError: expected 'undiscovered' to be 'source-only'      ← before any check
AssertionError: expected undefined to be truthy                  ← the closed union
AssertionError: expected 'unusable' to be 'source_only'          ← the shipped resolver
AssertionError: expected undefined to be '✓ Ready as source'     ← the word itself
AssertionError: expected 'ready' to be 'source_only'             ← ⭐ THE MCP OVER-CLAIM
```

⚠ **Four of the new cases PASSED at RED and they are PINS, not drives** — the fail-closed
default, the "capability never upgrades a row with actions" case, and the revoked/disabled
guards are satisfied by a tree without the feature. Said plainly rather than counted as
evidence; the six above are the drive.

### Task 02 — `sourceCapability.test.ts`, driven RED against **the plan's own proposed code**

First RED, `2 failed | 10 passed (12)` — the two protocol doors. The four ⛔ containment cases
passed vacuously, so **two of them were driven RED against defects planted in the shipped
file** and the file restored **md5 `ebe038e95f2d21cdfa978fc75f36dddb`**, identical before and
after both plants:

```
# plant 1 — the PLAN's own arm, verbatim: families.includes("mcp") && Boolean(c.mcp_server_url)
× ⛔ AN `mcp_server_url` ALONE IS NOT A SOURCE CLAIM — the server does not read it either
AssertionError: expected true to be false

# plant 2 — presence instead of non-emptiness in the config marker
× ⛔ an EMPTY source_tools marker declares nothing — `None`, never `{}`
AssertionError: expected true to be false
```

GREEN across both files: `49 passed (49)`.

### Task 04 — `ConnectionsTab.test.tsx`

```
 Test Files  1 failed (1)
      Tests  5 failed | 97 passed (102)
```

```
AssertionError: expected '⚠ Not usable' to be '✓ Ready as source'   ← the bug, verbatim
AssertionError: expected '✓ Ready' to be '✓ Ready as source'        ← the MCP over-claim, at the DOM
AssertionError: expected '⚠ Not usable' to be '✓ Ready as source'   ← both kinds in ONE table
AssertionError: expected '⚠ Not usable' to contain '✓'              ← glyph + tone
AssertionError: expected '/**\r\n * Phase 190-16 …' to match /listSourceFamilies\(\)/
```

⚠ **Every assertion is on rendered CONTENT — the `textContent` of `connections-row-state`,
compared by exact equality.** Phase 235's finding applied deliberately: a fence asserting a
block exists by `data-testid` cannot see the content drift inside it, and on this surface the
WORDS ARE THE DELIVERABLE.

### F-6 — `ConnectionFormPanel.refreshReceipt.test.tsx`

```
 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

AssertionError: expected '' to be 'ls'
AssertionError: expected "vi.fn()" to be called with arguments: [ 'conn-mcp-1' ]
AssertionError: expected '' to be 'cat'
```

⚠ **My FIRST RED attempt was a HARNESS failure and not the defect**, and it is recorded
because a harness failure looks exactly like a drive in a summary: `Unable to find an
accessible element with the role "button" and name "Refresh actions"`. An `mcp` row does not
render the capability shape's *Refresh actions* control at all — it has `McpAuthDoor`'s
*Discover tools*. Fixed the harness, re-drove, and only then was `expected '' to be 'ls'` a
statement about the product. The 4th case (a failed re-read blanks nothing) passes vacuously
today and is a pin.

---

## Measured gate results — verdict lines verbatim

**In-scope suites, at BASE, before any edit** (`src/components/settings src/components/sources`):

```
 Test Files  1 failed | 29 passed (30)
      Tests  17 failed | 731 passed (748)
```

**At HEAD:**

```
 Test Files  1 failed | 29 passed (30)
      Tests  16 failed | 761 passed (777)
```

⚠ **`17` at base against `16` at HEAD is a COUNT difference and NOT a set difference, and I
proved that rather than assuming it.** The one failing file both times is
`src/components/sources/sourceComposition.test.tsx` — the standing red CLAUDE.md names, in
NEITHER count-gate knob by a Phase 235 decision. I captured the failing SET at HEAD, then
checked the base version of my five source files back out, re-ran, captured the set again:

```
16 = 16 · SETS IDENTICAL — zero new, zero gone
```

The count moves between a directory batch and a solo run; the membership does not. **Counting
would have made a clean change look like it fixed something, and a tail would have hidden it
entirely.**

⚠ **THE EXPERIMENT THAT PROVED IT ALSO DESTROYED UNCOMMITTED WORK, and that is worth
recording rather than quietly redoing.** `git checkout <base> -- <five files>` silently
discarded my in-progress `ConnectionsTab.tsx` edits, which were not yet committed. Nothing was
lost permanently — I reapplied them and the suite went green again — but the correct order is
**commit first, then measure**. A file-scoped checkout is not the blanket reset the
destructive-git rules forbid, and it is still capable of eating work.

**Settings directory at HEAD, after the F-6 fix:**

```
 Test Files  21 passed (21)
      Tests  489 passed (489)
```

**Frontend count gate** — `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from
the repo root:

```
  total                                      7131    7869    +738
  total 7869  ·  failed 5  ·  pinned total 7131
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 5 test(s) failed — the gate requires 0.
```

**The gate was ALREADY RED at this phase's base and has been all phase** (wave 2 measured
`failed 19`), so this plan could not turn it green. What it can do is show the five are not
its own, by the procedure and not by re-running until green:

1. **Filenames taken from the gate's OWN persisted JSON before anything was re-run** —
   `C:\Users\...\Temp\vitest-count-gate-143732-1788819421934.json`. **Two files:**
   `src/pages/WorkflowsPage.test.tsx` (3) and
   `src/components/library/__tests__/sketchComposition.test.tsx` (2).
2. **Both are provably byte-unchanged by this plan.** `git diff --numstat 79f5e7f92 HEAD`
   lists thirteen files and neither is among them; `git status --short` is clean.
   **`WorkflowsPage.test.tsx` is one of SEED-171's five named cap-independent flaky suites.**
3. ⚠ **`sketchComposition.test.tsx`'s two failures are the suite's OWN POSITIVE CONTROLS** —
   *"the page renders its heading — the mount harness works"* and *"the four shipped tab
   triggers render"* — which is **character-for-character what wave 2 measured on the same
   suite two days ago**, on a different failing membership.
4. **The worker cap was NOT touched.** It is measured not to fix these.

Stated the way SEED-171 requires: these two files are **provably unmodified**, not *"fine"*.
One green sample of a flaky suite proves nothing, and a sibling agent's activity is not
something this worktree can observe.

**The arithmetic closes with no residual, on BOTH knobs** — which is what distinguishes growth
from drift:

| | wave 2 close | this plan | delta | accounted by |
|---|---|---|---|---|
| grand total | 7822 | **7869** | +47 | 15 verdict + 8 tab + 6 capability + **14 sourceTools (newly RUN)** + 4 refreshReceipt |
| pinned total | 7026 | **7131** | +105 | +66 tab re-baseline (36→102) + 15 + 6 + 14 + 4 |

**Backend unit baseline gate** — `node scripts/check-backend-unit-baseline.cjs`:

```
Summary:        71 failed, 4113 passed, 2 xfailed, 2 xpassed, 42 warnings in 189.49s (0:03:09)
Failed tests:   71 (allowed ceiling: <= 71)
Errors:         0 (allowed: 0)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```

⚠ **`71 / 4113 / 2 / 2` is character-for-character wave 2's close**, and **this plan's diff
contains zero backend files** (`git diff --numstat 79f5e7f92 HEAD` lists thirteen paths, all
under `frontend/`, `scripts/`, `docs/` and `CLAUDE.md`). So wave 2's `comm` trap — the
parametrize id truncated at a space and the interleaved warning text — never had to be
navigated here: the *counts* being identical on a tree with no backend delta is a stronger
statement than a set diff would have been, not a weaker one.

**Hot-file ledger gate:**

```
hot-file ledger — 6 file(s) from the command line
  scan list: 231 rows · subject: 6 files · watched: 6
ledger gate OK — every watched file has a row.
EXIT=0
```

At this plan's BASE the same command **FAILED**:

```
G-5 CANNOT FIRE ON 1 FILE(S) — they have no ledger row:
  [no-row] frontend/src/components/settings/connectionRowVerdict.ts
EXIT=1
```

**CLAUDE.md size + ledger-format gate:**

```
  CLAUDE.md                                   85945 chars   57.3% of limit  headroom   64055  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
EXIT=0
```

**`tsc -p tsconfig.app.json --noEmit`** — see F-3. The plan's *"exits 0"* criterion is
unsatisfiable at this base; the honest instrument is a SET diff, and it is clean:

```
base: EXIT=2, 66 errors    ·    HEAD: EXIT=2, 66 errors
TSC SET IDENTICAL — 66 = 66, zero added, zero removed
```

---

## Ledger triples — every one re-derived, none copied forward

Derived from git **after** every source commit and **before** the docs-only commit that writes
them, so wave 1's *"a triple went stale within the hour"* cannot repeat.

| File | ledger row read | **re-derived** | drift |
|---|---|---|---|
| `frontend/src/components/settings/connectionRowVerdict.ts` | **NO ROW AT ALL** | **2 / 2 / 99** | the gate FAILED |
| `frontend/src/components/sources/sourceCapability.ts` | 0 / 0 / 38 | **2 / 2 / 98** | +2 c, +2 ph |
| `frontend/src/components/settings/connectionsCopy.ts` | 13 / 7 / 737 | **15 / 8 / 784** | +2 c, +1 ph |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 23 / 8 / 1578 | **25 / 9 / 1635** | +2 c, +1 ph |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | 17 / 7 / 2376 | **24 / 10 / 2545** | +7 c, **+3 ph** |
| `frontend/src/lib/api/org.ts` | 6 / 4 / 562 | **11 / 8 / 629** | +5 c, **+4 ph** |
| `frontend/src/components/settings/connectionFormCopy.ts` | 7 / 5 / 968 | **15 / 8 / 1216** | +8 c, **+3 ph** |
| `backend/app/api/connectors.py` | 33 / 16 / 1879 | **39 / 18 / 2051** | +6 c, **+2 ph** |
| `backend/app/security/egress.py` | 10 / 3 / 938 | **13 / 5 / 982** | +3 c, **+2 ph** |
| `backend/app/services/connector_service.py` | 21 / 7 / 1601 | **23 / 9 / 1821** | +2 c, +2 ph |
| `frontend/src/lib/api/connectors.ts` | 12 / 7 / 690 | **16 / 10 / 718** | +4 c, **+3 ph** |

⚠ **`connectionFormCopy.ts` and `api/connectors.py` were measured by wave 2, published in its
summary, and NOT WRITTEN INTO THE LEDGER.** Wave 2's summary states *"`docs/HOT-FILE-LEDGER.md`
— which is what the gate reads — is fully updated"*; for these two rows it is not. A triple
derived and then not landed is indistinguishable from a triple never derived — and it is the
same failure mode this ledger records about itself, one register over.

**CLAUDE.md's abridged FIRING table** now carries all ten corrected triples plus the **three
rows waves 1 and 2 left owed**: `backend/app/services/sources/base.py` (`9 / 5 / 336`),
`backend/app/services/sources/__init__.py` (`5 / 3 / 40`), and
`backend/app/services/mcp_client.py` (`7 / 5 / 480` — **firing since Phase 222 while its row
read `no (2 phases)`**, the *present-and-wrong* state that answers an auditor and stops the
audit).

---

## Deviations from plan — reported, not worked around

### 1. ⛔ The plan's task-02 protocol check is WRONG on two of its three arms, and one of them is a FALSE GREEN

The plan specifies:

```ts
if (families.includes("mcp") && (c.auth_type === "mcp" || serviceId === "custom_mcp" || Boolean(c.mcp_server_url))) return true
```

- `serviceId === "custom_mcp"` is **dead code**: `custom_mcp` is published as a family, so the
  exact-id lookup one line above already returns `true`.
- `Boolean(c.mcp_server_url)` is a **false green**, and it is the one thing TM-239-07 forbids.
  The server does **not** read `mcp_server_url` — `_protocol_of` reads `auth_type` and the
  `config` marker and nothing else. **Shipped rows carry an MCP URL with
  `auth_type: "static_key"` and no `source_tools`** (a fixture in `connectionRowVerdict.test.ts`
  is exactly that shape), so the server resolves **no adapter** for them. Admitting them would
  print `✓ Ready as source` on a row that cannot browse, **and put a dead control in the
  Library picker** — `ConnectedSourceSection` and `CreateWatchModal` call the same predicate.

Implemented as the server's actual two doors. **The plan's arm is now a test**, driven RED
against itself planted in the shipped file.

### 2. ⛔ The plan's task-03 rewrite of `connectionStateOf` would have re-broken three shipped row pins

The plan says: *"When connection is active: compute verdict using `connectionRowVerdict`…"*.
The file's own docblock records what happens when that rule is applied to every shape:

> *"A FIRST CUT APPLIED IT TO EVERY SHAPE AND WAS MEASURABLY WRONG. Nine tests caught it,
> three of them byte-for-byte row pins, and they were RIGHT."*

A capability row advertises its actions from `SERVICE_TOOL_SPECS`, not from `discovered_tools`,
so a broad rule marks three working connections `⚠ Not usable`. **The `oauth_byo` scope was
kept and a second, narrow arm added below it** — reachable only by a row the server has
registered as a source, which `slack`/`smtp`/`jira` are not. That containment is a test that
composes the REAL predicate over the REAL families list, and all three pins stay green.

### 3. Two files were modified that the plan does not list, and both were required

- **`frontend/src/lib/api/org.ts`** — `auth_type` was `"static_key" | "oauth_byo" | null`.
  The backend's `AuthType` has read `Literal["static_key", "oauth_byo", "mcp"]` since this
  phase, so `c.auth_type === "mcp"` was a `tsc` error rather than a check. ⚠ **This is the
  THIRD wire-type drift in this one file**, and the field one line up carries a warning about
  the second. Wave 2 predicted I would need this file; it was right.
- **`frontend/src/components/settings/ConnectionFormPanel.tsx`** — the F-6 fix, below.

### 4. `scripts/vitest-count-gate.cjs` and `CLAUDE.md` are phase-close edits, not plan tasks

Both were explicitly owed by wave 2 and wave 1 and explicitly deferred to the last wave.

---

## The F-6 decision — TAKEN, with the reason

**Decision: fixed in this plan.** Three reasons, in order of weight:

1. **It is the same defect class as this plan's own headline.** `BUG-260907-01` is *a surface
   telling a person the opposite of what is true*. F-6 is a surface telling a person *"Not
   set"* about a binding the app detected correctly and stored one second earlier. Fixing one
   and shipping the other, in the same phase, on the same feature, is not a scope boundary —
   it is an inconsistency.
2. **The phase's owed G-4 UAT row cannot pass without it.** Wave 2 names the row: *"connect an
   MCP file server, press Refresh actions, reopen the panel, and read the binding."* Without
   this fix the row fails at step two, and the operator would report the phase's own new
   feature as broken when only its receipt is.
3. **I am the last wave.** Recording it as owed hands it to nobody. Wave 2 deferred it
   *specifically* because the repair sits on `handleDiscoverTools`'s reload seam, which the
   brief assigns to this plan.

**What it cost:** one handler, one existing client function (`getConnectorConnection`), a new
4-case suite. No new endpoint, no new API shape, no schema change.

**What guards it:** the seed fills a slot **only when that slot is empty**, so an unsaved
choice the server has never seen is never overwritten — the wipe wave 2 closed, in a new
costume. The re-read failing is silent, because the discovery itself succeeded and its tools
are already on screen; a worded error would report a failure of something nobody asked for.

---

## Findings that contradict the plan, the brief, or the prior waves

### ⭐ F-1 — the plan's own proposed capability check is a FALSE GREEN, and it is now a test

See deviation 1. **The strongest single finding of this plan**, because TM-239-07 names a false
green as worse than the bug being fixed, and the plan text would have shipped one.

### ⭐ F-2 — an MCP file server with zero action tools was reading `✓ Ready`, and nothing could see it

Surfaced by the RED drive, not by reading: `expected 'ready' to be 'source_only'`. The Phase
221 fix scoped the zero-action rule to the `oauth_byo` arm; an MCP row is never `oauth_byo`,
so it fell through to the generic `last_check_verdict === "ok"` fallback and claimed `✓ Ready`
with nothing to do. **The over-claim Phase 221 was created to kill was still alive on a second
family, and this plan found it by accident while fixing the opposite error.**

### ⚠ F-3 — the plan's `tsc` acceptance criterion is unsatisfiable, for the second wave running

Task 04 asks for `npx tsc -p frontend/tsconfig.app.json --noEmit` to **exit 0**. At this base
it exits **2 with 66 errors**, none of them this plan's. Wave 2 recorded the same at ~80. The
honest instrument is a SET diff, and it is **66 = 66, zero added, zero removed**. ⚠ Note the
count FELL from wave 2's base to mine while nobody fixed anything on purpose: another reason a
raw count is not evidence.

### ⚠ F-4 — a SECOND over-claim was found on the static_key arm and deliberately LEFT

A row with `service_id: "dropbox_drive"`, `auth_type: "static_key"`, zero tools and
`last_check_verdict: "ok"` reads **`✓ Ready`** today — the same generic fallback, on a family
with no adapter and no capability actions. **That is the Phase 221 defect surviving on a third
arm.** My first draft of the test asserted it should read `⚠ Not usable`; I corrected the TEST
rather than widening the rule, because closing it would change the reading of the three
capability row pins and belongs to whoever scopes it. **The case now pins only that such a row
can never claim the NEW word.** Candidate seed.

### ⚠ F-5 — the 200-char disposition cap governs `docs/HOT-FILE-LEDGER.md`, not only `CLAUDE.md`

`node scripts/check-claude-md-size.cjs` failed with **six** `[disposition-too-long]` findings
against the ledger's own scan list — my rows, 396–505 chars. I had written the narrative into
the cells on the assumption the cap applied to CLAUDE.md's abridged table alone. **It does
not**, and that is the same-commit sync rule being *enforced* rather than asked for: verdict in
the cell, reasons in the file's own section.

⚠ **And the section half is honoured by only 77 sections against 231 rows.** Neither wave 1 nor
wave 2 added a section for any new file (`mcp_source.py`, `sourceCapability.ts` and
`base.py` all have rows and no section). I added real sections for
`connectionRowVerdict.ts` and `sourceCapability.ts` and a shared `§239-03` block for the four
files that already had rows. **A rule that 154 rows do not follow is a rule the gate cannot
see; only the LENGTH half is executable today.**

### ⚠ F-6 — closed here. See the decision section above.

### ⚠ F-7 — closed here, and wave 2's diagnosis was exactly right

`ConnectionFormPanel.sourceTools.test.tsx` (14 cases) was in **neither** count-gate knob, and
the grand total moving by zero is what proved it. Both it and my new `refreshReceipt` suite are
now in **both** knobs; `ConnectionsTab.test.tsx`'s pin was also stale at **36 against an actual
102**, so 66 previously-unguarded cases in an already-running suite are now guarded too.
**TARGETS decides what RUNS and BASELINE decides what is GUARDED, and this file was on the
wrong side of both.**

### ⚠ F-8 — the widened predicate changes the Library picker, and nothing in this plan tests that

`isSourceCapable` is called by `ConnectedSourceSection.tsx` and `CreateWatchModal.tsx` to
filter which connections may be browsed. The protocol door means **an MCP file server now
appears in both**, which is correct and is the point of the phase — but it is a behaviour
change in two components this plan neither modified nor drove. Their suites are green and the
predicate's own suite covers the logic; **a live drive is owed at phase verification, and it is
the same row F-6's UAT names.**

---

## Threat model disposition

| id | disposition | how |
|---|---|---|
| TM-239-07 false-positive readiness | **mitigated** | `✓ Ready as source` requires `isSourceCapable === true`, which requires the SERVER's published family list (or a published protocol the row DECLARED) and a status that is not `revoked`/`error`. `null` families fail CLOSED, the container's `.catch` writes `null` not `[]`, `isSourceCapable` defaults `false` at every layer, and `disabled`/`revoked` still win in `connectionStateOf`. Six cases pin it at the unit level and four at the DOM |
| (new, not in the register) dead control in the Library picker | **mitigated** | `mcp_server_url` is refused as a capability signal, because the server refuses it too. Driven RED against the plan's own arm |
| (new) a capability row demoted to a source word | **mitigated** | `slack`/`smtp`/`jira` are not registered source families; pinned by composing the real predicate, and by the three byte-for-byte WIDE row pins that render with the fail-closed default |
| (F-6) an unsaved binding silently overwritten | **mitigated** | The seed fills EMPTY slots only; pinned |

No new endpoint, no new auth path, no schema change. One existing GET is called from one more
place.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema change was added.

---

## Known Stubs

None. Every value rendered comes from a real server read (`listSourceFamilies`,
`getConnectorConnection`) or from the row itself.

---

## Commits

| # | hash | message |
|---|---|---|
| 1 | `70146cbde` | `test(239-03): RED — a source-capable row with no actions is Ready as source` |
| 2 | `23f04100e` | `feat(239-03): a source-capable row with no actions reads Ready as source` |
| 3 | `1a1e2da37` | `test(239-03): RED — the protocol door the server has and the client did not` |
| 4 | `855ee5ff8` | `feat(239-03): the protocol door — an MCP server has no canonical name` |
| 5 | `7d45a61ce` | `test(239-03): RED — the rendered WORD on the row, not the presence of a block` |
| 6 | `98b3a5a7d` | `feat(239-03): the Connections row asks the server whether it is a source` |
| 7 | `986f2c925` | `test(239-03): RED — F-6, the binding lands in the database and not on screen` |
| 8 | `68870e20b` | `fix(239-03): F-6 — a discovery now shows the binding it just detected` |
| 9 | `2556c0bf7` | `docs(239-03): ledger rows, ten stale triples, and F-7's owed TARGETS entry` |

TDD gate sequence present four times: `test`→`feat` at #1→#2, #3→#4, #5→#6, and `test`→`fix`
at #7→#8.

---

## Self-Check: PASSED

| Check | Result |
|---|---|
| Created files exist | `ConnectionFormPanel.refreshReceipt.test.tsx`, `connectionRowVerdict.ts`, `sourceCapability.ts`, this SUMMARY — all **FOUND** |
| All nine commits exist | **9/9 FOUND** via `git log --oneline --all` |
| TDD gate sequence | `test`→`feat` ×3 and `test`→`fix` ×1 |
| Backend baseline | `71 failed / 4113 passed / 0 errors` — **`71 <= 71`, GATE PASSED**; zero backend files in the diff |
| `tsc` set diff | **66 = 66, zero added, zero removed** |
| Ledger gate | `EXIT=0` over all six files; **it FAILED at this plan's base** |
| CLAUDE.md gate | `EXIT=0` — 85,945 chars, 57.3%; it FAILED first on **six** over-long ledger cells (F-5) |
| Count-gate arithmetic | grand `+47` and pinned `+105`, **both close with no residual** |
| Count-gate triage | 2 files, **both provably byte-unchanged**; filenames taken from the gate's own JSON before any re-run; cap untouched |
| Standing-red set diff | `sourceComposition.test.tsx` **16 = 16, SETS IDENTICAL** base vs HEAD |
| Byte-for-byte row pins | green, and **because of** the fail-closed default rather than by luck |
| Planted-defect restores | `sourceCapability.ts` md5 `ebe038e9…` identical after both plants |
| ⚠ RED signal quality | **three genuine drives, and one first attempt that was a HARNESS failure** — recorded rather than dressed up |
| ⚠ Vacuous greens | 4 of the verdict cases and 4 of the capability cases passed at RED; named as PINS, and two of the four were then driven RED against plants |

⚠ **The two rows carrying ⚠ are the useful ones.** A harness failure reads exactly like a
drive once it is summarised, and a pin counted as a drive inflates the evidence.

## What this plan does NOT deliver

- **No live drive.** Everything is a unit/DOM result against doubles. The owed G-4 row is
  *"connect an MCP file server, press Refresh actions, read the binding, then look at the row
  in Settings → Connections and at the Library picker"* — one row that exercises F-6, F-8 and
  the headline fix at once.
- **The static_key `✓ Ready` over-claim (F-4) is left standing**, deliberately and named.
- **`ConnectedSourceSection` / `CreateWatchModal` are not re-tested** for the widened
  predicate (F-8).
