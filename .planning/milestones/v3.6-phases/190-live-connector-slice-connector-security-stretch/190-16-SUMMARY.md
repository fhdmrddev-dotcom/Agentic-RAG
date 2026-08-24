---
phase: 190-live-connector-slice-connector-security-stretch
plan: 16
subsystem: frontend-settings
tags: [react, settings, instrument-table, conn-02, d-25, d-26, d-27, sketch-155-c, wcag-1-4-1, graded-guards, count-gate, wave-5, plant-driven]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 09
    provides: "the five typed client functions + three TS types in lib/api.ts, and the API-ENFORCED org-admin write gate this surface only MIRRORS"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 12
    provides: "ConnectionPicker's seam vocabulary (name · sends-to · state) and the measured react-refresh cost that made this plan author a sibling copy module"
provides:
  - "frontend/src/components/settings/ConnectionsTab.tsx — the 155-C five-column instrument table, its filter bar + live count, four greyscale-legible states, two DISTINCT empty states, graded destructive guards with receipts, and the D-26 OFF banner"
  - "frontend/src/components/settings/connectionsCopy.ts — every user-visible string as an exported identifier plus the pure derivations, in a .ts sibling so the .tsx exports components only"
  - "Connections as the SIXTH Settings tab at routing key 5, rendered visually fourth, with no renumbering and no deep link"
  - "the D-190-DEF-07 RESOLUTION — branch (b), the gate is right and the copy moved, both halves in ONE commit"
  - "frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx — 34 cases, SEVEN driven RED against real plants in production source"
  - "the suite registered on BOTH count-gate knobs (a TARGETS line AND a BASELINE pin) in the commit that created it"
affects: [190-17, 190-18, 190-15, 190-verify-phase, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A sibling `*Copy.ts` module for every user-visible string, so a .tsx exports components ONLY — 190-12 measured the alternative at 5 → 10 react-refresh errors; measured here, `eslint src/components/settings/` stays at 5"
    - "Derive an expensive-looking count from a response the app ALREADY fetches — measure the corpus first, then take the live count rather than the plan's on-demand-expand fallback"
    - "When a caller-scoped read cannot support a `0`, give zero its OWN WORD (`none you can see`) and state the scope once at the foot of the table"
    - "A settled read carries the KEY it answered, so the effect body holds NO synchronous setState — the cascading render `react-hooks/set-state-in-effect` exists to stop"
    - "Prove a NEW count-gate pin twice: that it CATCHES a deletion, and that the suite is inside TARGETS at all — the two knobs fail independently"

key-files:
  created:
    - frontend/src/components/settings/ConnectionsTab.tsx
    - frontend/src/components/settings/connectionsCopy.ts
    - frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/lib/api.ts
    - scripts/vitest-count-gate.cjs
    - .planning/phases/190-live-connector-slice-connector-security-stretch/190-UI-SPEC.md
    - .planning/phases/190-live-connector-slice-connector-security-stretch/deferred-items.md

key-decisions:
  - "D-190-DEF-07 RESOLVED, branch (b): the 190-09 write gate STAYS and the COPY moved. Branch (a) would delete a security gate from a security phase inside a Settings-table plan and turn a shipped plant-driven test RED"
  - "The OFF state REMOVES every write affordance rather than disabling it — the structural half of the same resolution, because a rendered button the API refuses is the mirror image of a hidden button the API honours"
  - "`Used by` is a LIVE count computed client-side from the shipped listPublishedWorkflows() payload — measured first (204 defs / 125 published / 48 kB / 1.6 ms), so zero new wire and zero schema change"
  - "The count is caller-scoped and therefore a FLOOR, so zero renders as `none you can see`, never `0 steps`, with the scope stated once at the table's foot"
  - "`GovernedFeature` was NOT widened: it costs five exhaustive-map edits, two of them in /admin, which D-25 fences. One documented fail-closed reader instead, and both owed halves logged as D-190-DEF-09"
  - "Every user-visible string lives in a sibling `connectionsCopy.ts`, taking 190-12's named one-line fix rather than repeating its measured debt"

patterns-established:
  - "Author the copy module first, then the .tsx — the eslint number is a measurement you can hold flat rather than a cost you discover"
  - "A slow new suite inside the count gate is not merely slow: this one's default per-keystroke userEvent delay red SIX unrelated shipped suites as timeouts"

requirements-completed: []

# Metrics
duration: 68min
completed: 2026-08-09
---

# Phase 190 Plan 16: Settings → Connections, the Instrument Table Summary

**The 155-C instrument table ships whole — five locked columns, a load-bearing filter bar and live count, four states that read in greyscale, two empty states that are DIFFERENT strings, and the platform banner told once and never on a row — and the blocking D-190-DEF-07 contradiction is RESOLVED rather than passed on: the gate stays, the copy moved, and the OFF state now REMOVES the writes the API refuses, all in one commit.**

## Performance

- **Duration:** ~68 min (04:02 → 04:24 committing; the measurement and plant work sits either side)
- **Completed:** 2026-08-09
- **Tasks:** 3, each committed individually
- **Files:** 8 (3 created, 5 modified) — **2 208 insertions, 6 deletions, ZERO file deletions** across all three commits (`git diff --diff-filter=D --name-only HEAD~3 HEAD` prints nothing)

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | `ConnectionsTab.tsx` + `connectionsCopy.ts` — the table, the states, the banner, **and the D-190-DEF-07 resolution** | `5af38925` |
| 2 | `SettingsPage.tsx` — one `TabsTrigger` + one `TabsContent` at routing key `5` | `34221a41` |
| 3 | `ConnectionsTab.test.tsx` (34 cases) + BOTH count-gate knobs | `307b4099` |

---

# ⭐ THE BLOCKING CONFLICT: D-190-DEF-07, RESOLVED — BRANCH (b)

The orchestrator's instruction was *"resolve it; do not pass it on… move the copy and the gate in the SAME commit."* Done, in `5af38925`.

**The contradiction, both sides.** Plan 190-09 attached `require_visible("live_connectors")` to the three connector WRITE endpoints, per its own plan. UI-SPEC §2h's operator-approved banner said, verbatim: *"Connections below **can be saved** and bound to a workflow."* With the cold default `"off"`, an org admin's create / edit / delete is refused 403 — so the banner promised a save the API declines, **to exactly the audience that reads it**.

**The branch taken: (b) — the GATE is right, the COPY moves.** Four reasons, in order of weight:

| # | Reason |
|---|---|
| 1 | Branch (a) means **deleting a security gate from a security phase, inside a Settings-table plan** — and it would turn a shipped, plant-driven test RED (`test_190_connectors_api.py` case 9 asserts the OFF direction refuses the write). Removing a gate that was PROVED to work is not a copy fix. |
| 2 | Of the two possible errors, the gate is the **more restrictive** one. A phase whose whole discipline is not over-claiming should not ship a live-credential WRITE surface more open than its plan says. |
| 3 | **The copy is what this plan owns.** The banner string is authored here, in this commit. |
| 4 | The banner renders **only** while the switch is off — the exact state it now describes — so the corrected sentence can never appear in a state it does not fit. |

**What moved, all in `5af38925`:**

1. **UI-SPEC §2h's second sentence**, with the full reasoning and the reversal cost written beside it.
2. **The rendered string** — `connectionsCopy.CONNECTIONS_BANNER_BODY`, asserted by character-identity in the suite:
   > `Connections below are read-only until an operator turns it on — nothing here can be added or changed, and no message, ticket or email will leave. Steps still record what they would have done and read “Not sent — recorded”.`
3. **THE STRUCTURAL HALF, which is the part a copy-only fix would have missed.** While the switch is off, **every write affordance is REMOVED, not disabled** — no `＋ Add a connection` (neither in the header nor in the empty state), no row `⋯`. This is the shipped 185 rule, and it is the only shape under which the banner and the API's 403 tell the same story. *A hidden button the API still honours is one defect; a rendered button the API refuses is the other, and this surface ships neither.* Two suite cases guard it.
4. **`deferred-items.md` D-190-DEF-07 marked RESOLVED**, with the branch, the reasoning table and the reversal cost.

**REVERSAL COST — four edits, and they may NEVER be separated:** delete the three `dependencies=[Depends(require_visible("live_connectors"))]` entries in `backend/app/api/connectors.py`; re-point `test_190_connectors_api.py` case 9; restore §2h + `CONNECTIONS_BANNER_BODY` to 155-C's wording; drop the OFF-state affordance removal in `ConnectionsTab.tsx`. A gate without the copy under-claims; the copy without the gate is the D-31 defect.

⚠ **ONE HALF IS OWED AND IS NAMED, NOT CLOSED.** UI-SPEC **§9's panel notice** carries the same false sentence (*"You can save this connection and workflow authors can bind it to a step"*) and is out of this plan's surface. **Plan 190-17 must amend it in the commit that builds the panel**, and must remove the panel's write affordances under the same OFF state. A pointer sits in §2h and in the deferred entry so it cannot be lost.

---

# ⭐ THE `Used by` MEASUREMENT — measured BEFORE committing to a live count

The plan required *"measure it once against the local corpus before committing to a live count (research OQ#6); if it is slow, make it an on-demand expand"*. Measured 2026-08-09 against the live local Supabase (`psycopg2`, port 54322):

| Measurement | Value |
|---|---|
| `workflow_definitions` rows | **204** |
| …of which `status='published'` | **125** |
| Total `definition` JSONB across published rows | **48 kB** |
| Phases per definition | **2.21 average, 5 maximum** |
| Server-side scan (`jsonb_array_elements(definition->'phases')` counting `connection_id`) | **1.6 ms** |
| Existing `connection_id` references | **0** (nothing is bound yet — 190 is building it) |
| `connector_connections` rows | **0** |

**CHOICE: the LIVE count, and it costs ZERO new wire.** The scan is not slow (1.6 ms server-side), and — the decisive finding — **no new endpoint is needed at all**: `GET /workflows/published` already returns each `definition` **inline** (`api.ts:1335-1340`, `api/workflows.py:212-220`), so the count is computed in the browser from a response the app already fetches. The plan's named fallback (an on-demand expand) is not taken and is not owed.

⚠ **AND THE HONEST CAVEAT, which the count's own WORD carries.** `GET /workflows/published` is **OWNER-scoped** (`created_by = me` OR `is_system_global`, `api/workflows.py:183`) — **not org-wide**. So the count is a **FLOOR**: it is every step the caller can see, and a colleague's published workflow is invisible to it. Two consequences, both shipped:

- **Zero gets its own word.** `usedByLabel(0)` renders `none you can see`, never a bare `0 steps` — which would claim *nothing depends on this*, a claim the read cannot support.
- **The scope is stated ONCE**, at the foot of the table, never per row (§2h's 24-identical-lines finding, one scale down): *"“Used by” counts published workflow steps you can see. A colleague’s published workflow is not counted here."*

The plan's §2g grading is followed exactly (Delete always sheets; Disable sheets only when `Used by > 0`), and the residual risk is bounded by design: **Delete — the irreversible half — sheets regardless of the count**, and Disable's worst case under a partial count is a colleague's step reading `Not sent — recorded` until someone re-enables, which is the reversible state D-26 already makes the platform default.

---

# ⭐ THE THREE ICON SLUGS — verified against the INSTALLED package, not against any document

The Phase-127 empty-icon trap (`fluent-emoji:direct-hit` shipped BLANK) makes this mandatory. Verified 2026-08-09 by reading `frontend/node_modules/@iconify-json/fluent-emoji/icons.json` directly — **version 1.2.7, 3174 icons**:

| Capability | Slug | Installed? |
|---|---|---|
| `send_email` | `envelope` | ✅ **PRESENT** |
| `create_ticket` | `ticket` | ✅ **PRESENT** |
| `post_message` | `speech-balloon` | ✅ **PRESENT** |

**Near-misses measured ABSENT and recorded so nobody tries them:** `email` ✗ · `outbox` ✗ · `direct-hit` ✗. (Present-but-not-chosen alternates, for the record: `e-mail`, `admission-tickets`, `left-speech-bubble`.)

All three are imported through the deep `~icons/fluent-emoji/<slug>` subpath, build-time bundled by `unplugin-icons` exactly as `phaseGlyph.tsx:54-60` does — **a missing slug fails the build**, which is the verify-or-bundle discipline stated as a mechanism rather than a habit. They are **capability marks, never vendor logos** (U-12): the mark says *"this sends an email"*, not *"this is Fastmail"*, and the vendor is told in text where it is actionable — the `Sends to` column carries the real host.

---

## Verification (RUN, never quoted — every pin was re-measured at HEAD)

| Check | Result |
|---|---|
| `npx vitest run …/ConnectionsTab.test.tsx` | **34 passed, 0 failed** (plan asks ≥ 8) |
| `node scripts/vitest-count-gate.cjs` | **`count gate OK` — 50/50 pinned files, no per-file decrease, `failed 0`**, running total **2786**, pinned total **2739 → 2773** |
| The new pin CATCHES a deletion | **`[count-decrease] ConnectionsTab.test.tsx — pinned 34, ran 33 (-1)`, exit 1, at `failed 0`** — driven, then restored md5-identical |
| `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33 → 33, unmoved.** Baseline RE-MEASURED at HEAD before any edit, never quoted from a plan |
| `eslint src/components/settings/` | **5 → 5, unmoved.** All five are pre-existing `react-refresh/only-export-components` in `ProviderPicker.tsx` / `ModelPillRow.tsx` |
| the eight D-23/D-24 fenced files | **blob-identical at BOTH revs.** Existence confirmed first (`git cat-file -e` OK ×8 at `de122b9a` AND `HEAD`), then `git rev-parse <rev>:<path>` compared — all eight hashes equal, so the empty numstat is *identical*, not *absent* |
| `git diff --numstat de122b9a HEAD -- frontend/package.json frontend/package-lock.json backend/requirements.txt` | **empty** — zero installs, zero shadcn blocks (T-190-SC) |
| `grep -c "<table" ConnectionsTab.tsx` · `grep -c "divide-y"` | **0** · **2** (the shipped 068-A roster, no new primitive) |
| `grep -c "title=" ConnectionsTab.tsx` | **0** |
| `grep -cE "font-semibold\|font-bold" ConnectionsTab.tsx` | **0** — no third authored weight; the card title's `700` is inherited chrome from `SectionCard` |
| `grep -c 'value="5"' SettingsPage.tsx` | **2** (one trigger, one content) |
| routing keys renumbered | **0** — `git diff -U0 \| grep -cE '^-.*value="[0-4]"'` prints `0` |
| deep link added | **NO** — `grep -cE '\?tab=\|useNavigate\|useSearchParams'` is **0 at HEAD and 0 now** |
| `git diff --diff-filter=D --name-only HEAD~3 HEAD` | **empty** — no commit deleted a file |
| `graphify update .` | 20 118 nodes / 53 418 edges rebuilt (untracked artefact; nothing entered a commit) |

### `npm test` — measured, attributed, and NOT a regression

```
 Test Files  8 failed | 240 passed (248)
      Tests  21 failed | 4621 passed (4642)
```

**The eight failing files are byte-for-byte the set D-190-DEF-05 recorded**, and this was checked by name rather than by count: `IngestionPage` · `MessageItem` · `Plan04.frontend` · `useMessages` · `StreamsProvider.dedup` · `streamsProvider` · `streamsProvider_075_9_clientkey` · `lib/model-info` — the chat / ingestion surfaces, i.e. the recorded **SEED-056 rot**. `ConnectionsTab.test.tsx` is not among them.

⚠ **Two things moved and both are stated rather than smoothed:**

1. **The rot SHRANK back.** D-190-DEF-06 recorded it growing to **9 files / 26 tests** at 190-09 (the extra was `ChatHistoryColumn.test.tsx`, which that entry itself noted was partly ordering-dependent). At HEAD it reads **8 / 21** — D-190-DEF-05's original figure. `ChatHistoryColumn` is no longer in the failing set. Nothing in this plan touches it; the movement is the ordering-dependence D-190-DEF-06 predicted.
2. **The suite total grew 4588 → 4642, and the +54 is exactly accounted for**: this plan's **34** plus plan 190-12's **20** (`ConnectionPicker.test.tsx`, which landed after 190-09 took its 4588 reading). No test was lost.

The honest instrument for this phase remains `node scripts/vitest-count-gate.cjs`, per D-190-DEF-05's own re-open note.

---

## The seven plants → RED cycles

The suite passed **34/34 on its first run**, which proves nothing on its own — so every load-bearing case was falsified against a **real plant in real production source**, applied by a `read_bytes`/`write_bytes` harness with the restore in a `finally`, the case re-run, and the file verified **md5-identical** (`cb66363a…`) after each. `git diff --stat` on the target is empty.

| # | Plant applied to `ConnectionsTab.tsx` | Observed RED |
|---|---|---|
| A | the filtered-to-zero branch points at `CONNECTIONS_EMPTY_BODY` (§2d's named conflation) | `Failed Tests 1` |
| B | the `aria-label={moreActionsLabel(connection.name)}` line deleted — i.e. the Radix default | `Failed Tests 2` |
| C | the Add button rendered `disabled={!canWrite}` instead of REMOVED | `Failed Tests 1` |
| D | Disable's grading short-circuited (`if (false)`) so it always flips direct | `Failed Tests 1` |
| E | the OFF banner rendered unconditionally (`{true &&`) — the D-26 non-vacuity control | `AssertionError: expected <div …> to be null` |
| F | the technical name moved out of its `<code>` into a `<span>` | `AssertionError: expected 'SPAN' to be 'CODE'` |
| G | a `data-secret="api_token"` node planted into a row (T-190-16-T7) | `AssertionError: expected '<section aria-label="connections" …' not to contain 'secret'` |

**Plant C is the one to read.** U-02's failure mode is precisely that a `toBeDisabled()` assertion **passes on the defect** — a control that could never do anything must be REMOVED, so only an absence assertion can see it. Plant C makes the button exist-but-disabled, which is exactly what a careless "fix" would ship, and the case goes red.

**Plant F also recorded a harness lesson worth keeping:** the first attempt swapped only the opening `<code` tag, leaving `</code>` unmatched — the file failed to PARSE and vitest reported *"no tests"*, not a RED. A build break is not a falsification. The plant was re-run with a balanced tag swap and produced the real `expected 'SPAN' to be 'CODE'`.

---

## Files Created/Modified

- **`frontend/src/components/settings/ConnectionsTab.tsx`** *(created, 848 L)* — `ConnectionsTabView` (the presentational leaf, props in / DOM out, the `UsersAndAccess` shape) plus `ConnectionsTab` (the connected container owning three reads and two writes). The header records D-25's *why Settings*, sketch 155-C's *why a sixth tab*, the roster re-use, the icon rule with the three verified slugs, and the D-190-DEF-07 structural consequence.
- **`frontend/src/components/settings/connectionsCopy.ts`** *(created, 452 L)* — every user-visible string as an exported identifier, plus the pure derivations (`connectionStateOf`, `destinationFactsOf`, `usageCountsFrom`, `usedByLabel`, `credentialLabel`, `connectionsCountLabel`, `connectionMatchesQuery`, `liveConnectorsOnFrom`).
- **`frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx`** *(created, 660 L)* — 34 cases in eleven groups.
- **`frontend/src/pages/SettingsPage.tsx`** *(+39 / −0)* — one import block, one `TabsTrigger value="5"` (rendered fourth), one `TabsContent value="5"` wrapping the tab body in the shared `SectionCard`.
- **`frontend/src/lib/api.ts`** *(+14 / −0)* — **comment only.** A dated note on `GovernedFeature` explaining why it is deliberately stale and pointing at D-190-DEF-09.
- **`scripts/vitest-count-gate.cjs`** *(+77 / −1)* — a `TARGETS` line, a `BASELINE` pin at 34, and the `BASELINE_TOTAL` marker corrected to the script's own printed figure.
- **`190-UI-SPEC.md`** *(+36 / −5)* — §2h's second sentence, the branch, the structural half, the reversal cost and the §9 pointer.
- **`deferred-items.md`** *(+82 / −0)* — D-190-DEF-07 marked RESOLVED; D-190-DEF-09 opened.

## Decisions Made

1. **D-190-DEF-07 → branch (b)** (above). The gate stays; copy and structure moved together.
2. **A sibling `connectionsCopy.ts` rather than exports out of the `.tsx`.** 190-12 measured the alternative at `eslint src/components/workflows/` 5 → 10 on `react-refresh/only-export-components` and named the fix; taken here rather than repeated. Measured before writing a line: `eslint src/components/settings/` reported **5 errors, all pre-existing**. Measured after: **still 5.**
3. **The `Used by` LIVE count off an existing endpoint** (above), with the caller-scoped floor carried by the WORD rather than left implicit.
4. **`GovernedFeature` NOT widened.** Attempted and reverted on measurement: it takes `tsc` **33 → 38**, and all five new errors are `Record<GovernedFeature, …>` exhaustive maps, **two of them in `/admin` source** — which D-25 fences. The honest completion of that half is a `FeatureVisibility.FEATURES` operator card, which is a user-facing capability and belongs to its own plan. One documented fail-closed reader instead, and **both** owed halves logged together as **D-190-DEF-09**.
5. **`Check credential` is REMOVED, not inert.** `checkConnectorConnection` lands with its endpoint in 190-15 (`api.ts` says so in its own section header), so the menu item renders only when a handler is supplied — the same removed-not-disabled rule, applied to this plan's own seam. A suite case drives both directions.
6. **The row NAME is the panel affordance, not a click on the whole row.** A `<button>` carrying the name is keyboard-reachable with a real accessible name and nests nothing; today it renders as plain text because 190-17 owns the panel.

---

## Deviations from Plan

### 1. [Rule 3 — blocking] `GovernedFeature` cannot name `live_connectors`, so the banner could not read its own feature

- **Found during:** Task 1, wiring the OFF banner.
- **Issue:** plan 190-09 made `live_connectors` a governed feature **server-side**; the client union was never widened, so `features.live_connectors` is a type error.
- **Fix:** ONE documented, fail-closed reader (`liveConnectorsOnFrom`) rather than a half-widened type — after measuring that widening costs `tsc` 33 → 38 across five exhaustive maps, two of them inside the `/admin` tree D-25 fences.
- **Logged:** **D-190-DEF-09**, carrying both owed halves, the five exact error sites, and the `visual_workflow_canvas` precedent for the operator card's shape.

### 2. [Scope — a fifth file, deliberately] `connectionsCopy.ts` is not in `files_modified`

The plan says every string is *"an exported identifier from this module"*, meaning `ConnectionsTab.tsx`. The orchestrator's brief asked me to *"consider taking that fix's shape here rather than repeating the debt"*. Taken, and it is a measurement rather than a preference: the settings directory carries **5** pre-existing `react-refresh` errors and now still carries **5**. Both halves of the plan's intent survive — every string is still an exported identifier, still asserted by character-identity.

### 3. [Rule 2 — the OFF state removes write affordances]

Not in the plan's task text; it is the structural half of the D-190-DEF-07 resolution, without which the amended banner and the API's 403 would still disagree. Two suite cases guard it.

### 4. [Rule 1 — `react-hooks/set-state-in-effect`]

The container's first draft called `setReadFailed(false)` synchronously in an effect body — eslint 5 → 6. Rewritten as a keyed settled-read union (`ConnectionPicker.tsx:177-201`'s idiom), which removes the cascading render and returns eslint to 5.

### 5. [RECORDED — two planning documents edited, both mandated]

`190-UI-SPEC.md` and `deferred-items.md` are outside `files_modified`. The orchestrator's brief made the UI-SPEC edit **mandatory** (*"move the copy and the gate in the SAME commit"*), and D-190-DEF-07's own re-open trigger required the deferred entry to be marked resolved with the chosen half named.

### 6. [RECORDED — a plan acceptance criterion is unsatisfiable as written]

Task 3 asks for `cd frontend && npm test` to report `0 failed`. Measured: **21 failed / 4621 passed**, across the eight files D-190-DEF-05 already records. Not this phase's signal (D-190-DEF-05 / -06), and the attribution above is by FILE NAME, not by count.

### 7. [RECORDED — one acceptance grep is satisfied by a stronger check]

The plan asks that `live_connectors` *"appears inside a `<code>` element"* in `ConnectionsTab.tsx`. The literal appears **3 times** in that file (≥ 1, as asked) but in its docblock; the `<code>` renders `{CONNECTIONS_BANNER_OPERATOR_FLAG}`, because the string's single source is the copy module. The `<code>` half is therefore asserted on the **RENDERED DOM** (`expect(flag.tagName).toBe("CODE")`, plus exactly-once), which survives the string being sourced from elsewhere in a way a source grep cannot. Driven RED by plant F.

**Total deviations:** 2 auto-fixed (Rules 1 and 3), 1 Rule-2 addition, 4 recorded scope/criterion notes. **Zero packages installed.**

## Issues Encountered

- **A slow new suite inside the count gate REDS FILES IT NEVER TOUCHES.** The first gate run with `ConnectionsTab.test.tsx` in it reported **8 failing tests — 2 mine and SIX in unrelated shipped suites** (`WorkflowBuilderPage`, `FlowEdge`, `PhaseNode`, `PhaseSpineGraph`, `StepTypePicker`, `WorkflowCanvas.editing`), every one a bare `STACK_TRACE_ERROR` timeout. None was a regression: my `userEvent.setup()` calls used the DEFAULT per-keystroke delay, and the wall-clock cost starved six neighbours past the 5 s default. `userEvent.setup({ delay: null })` cleared **all eight**. Recorded in the gate's own map so the next author does not spend the hour I nearly spent hunting a phantom regression.
- **A `<code>` → `<span>` plant that touched only the opening tag broke the PARSE**, and vitest reported *"no tests"* rather than a failure. A build break is not a RED; the plant was redone balanced.
- **The plant harness needed explicit `encoding="utf-8"` on both `subprocess` capture and stdout.** Windows `cp1252` could decode neither vitest's ANSI output nor this surface's glyphs, and the first two runs died in the reader thread — after the `finally` had already restored the file, which is why the abort was harmless.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| **T-190-16-T7** | The rendered markup is swept for `secret`, `ciphertext`, `password`, `xoxb-`, `api_token` and `enc:v1:`. Driven RED by plant G (a planted `data-secret` node). The response model carries no credential in either form (190-09), and this surface renders only name, destination, counts, verdict and state |
| **T-190-16-U02** | The Add button is asserted **ABSENT from the DOM** for a non-admin — three ways (`queryByTestId`, `queryByText`, and a whole-body text sweep) — plus the row `⋯` absent, plus a positive control that an admin DOES get both. Driven RED by plant C, which shipped the exact `disabled` defect a `toBeDisabled()` assertion would have passed. The API gate (190-09) remains the wall |
| **T-190-16-A11Y** | `aria-label="More actions for {name}"` on the icon-only trigger, with **three DISTINCT names asserted across three rows** and reachability proved through `getByRole`, not just the attribute. Driven RED by plant B. Every state carries a glyph AND a word, asserted separately so a chip that lost its glyph cannot pass |
| **T-190-16-BANNER** | Exactly ONE banner node and ONE heading in the whole document; ZERO per-row notices, asserted per row for both the heading and the technical name; a non-vacuity control for the switch-ON direction (driven RED by plant E); and the technical name proved to render inside a real `<code>`, exactly once (driven RED by plant F) |
| **T-190-16-DESTRUCT** | Delete ALWAYS sheets, even at zero known victims; Disable sheets only above zero and flips direct below it; Enable flips direct even at nine victims. The victim is named **in the button label** in both sheets, and nothing fires until Confirm. Every write lands as `✎ {verb} · recorded` on a `role="status"` node, with a sweep proving no toast root is mounted anywhere |
| **T-190-16-ICON** | All three slugs read out of the installed `@iconify-json/fluent-emoji@1.2.7` icon set (3174 icons) and confirmed PRESENT; three near-misses confirmed ABSENT and recorded. Imported through the deep `~icons/…` subpath, so a missing slug fails the BUILD |
| **T-190-SC** | Zero installs, zero shadcn blocks, no `table` primitive introduced (asserted in the suite as well as by grep). `git diff --numstat` on `package.json` / `package-lock.json` / `requirements.txt` across the whole plan is empty |

## Known Stubs

**Three deliberate absences, each with a named owner — none is a hardcoded empty value and none is placeholder text.** The distinction matters: every one is a control that is REMOVED because its wire does not exist yet, which is the shipped 185 rule, not a stub rendered inert.

| Absent | Owner | Why it is absent rather than inert |
|---|---|---|
| `onCheck` — the `Check credential` menu item | **190-15** | `checkConnectorConnection` and its endpoint arrive in one commit (`api.ts`'s section header says so). A menu item that called nothing would be the dead affordance §2f forbids. A suite case drives both directions |
| `onAdd` — the `＋ Add a connection` button | **190-17** | The add/edit push-split panel is that plan's surface. The button appears the moment a handler is passed — proved by the admin positive control |
| `onOpen` — row click → the panel | **190-17** | Same. The name renders as text today and becomes a `<button>` when the handler arrives |

None prevents this plan's goal: the plan's stated output is *"the tab, the table and its states"*, and all three ship whole.

## Threat Flags

**None.** This plan adds no network endpoint, no auth path, no file access and no schema. It consumes three endpoints that already shipped (`GET /connectors/connections`, `GET /workflows/published`, `GET /features`) and calls two writes 190-09 already gated.

## Cloud parity (D-22)

**Nothing new is owed.** No env var is read, no reference data is seeded, no bundled service is added and no sandbox tag changes. The standing queue is unchanged at **`099 → 117` + `SECRETS_ENCRYPTION_KEY`**.

⚠ **One non-code half is UNCHANGED but now more visible:** `live_connectors` is `"off"` by cold default everywhere, and turning it on is still an operator action via `PUT /admin/visibility`. **D-190-DEF-09 records that there is no Control Room CARD for it yet**, which means the banner's closing sentence names the right home before that home has a row in it. Stated here rather than discovered in UAT.

## Next Phase Readiness

**Ready.** What downstream plans can assume, and what they owe:

| Owed by | What |
|---|---|
| **190-17** | The add/edit panel. Pass `onAdd` + `onOpen` to `ConnectionsTabView` and the affordances appear. **It MUST also amend UI-SPEC §9's panel notice** — that sentence is false under D-190-DEF-07 branch (b) — and remove the panel's write affordances under the same OFF state, in the SAME commit |
| **190-15** | `checkConnectorConnection` + its endpoint in one commit; pass `onCheck` and the menu item appears |
| **190-18** | The refusal copy. `connectionsCopy.ts` is the established home for a string on this surface; §4c's six sentences belong in the panel's own copy module beside it |
| **A `/gsd:quick`** | **D-190-DEF-09** — widen `GovernedFeature`, add the five map keys, author the `FeatureVisibility.FEATURES` card |
| **`/gsd:verify-work 190`** | Do **not** read `npm test` as a regression signal (D-190-DEF-05 / -06). Use `node scripts/vitest-count-gate.cjs` (50 files, `failed 0`) plus the per-suite run |

**Two things not to re-litigate:** the D-190-DEF-07 branch (its reasoning and its four-edit reversal cost are written in three places), and the count-gate registration (both knobs moved, the pin is proved to catch a deletion, and the remaining `+13` drift is two pre-existing under-pins this plan deliberately did not fold into its commit).

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| `ConnectionsTab.tsx` exists | `[ -f … ]` | **FOUND** (848 L) |
| `connectionsCopy.ts` exists | `[ -f … ]` | **FOUND** (452 L) |
| `ConnectionsTab.test.tsx` exists | `[ -f … ]` | **FOUND** (660 L) |
| `190-16-SUMMARY.md` exists | `[ -f … ]` | **FOUND** |
| commit `5af38925` (Task 1) | `git log --oneline --all \| grep` | **FOUND** |
| commit `34221a41` (Task 2) | `git log --oneline --all \| grep` | **FOUND** |
| commit `307b4099` (Task 3) | `git log --oneline --all \| grep` | **FOUND** |
| the suite is registered on BOTH gate knobs | `grep -c "ConnectionsTab.test.tsx" scripts/vitest-count-gate.cjs` | **5** (one `TARGETS` line, one `BASELINE` key, three in the notes) |
| no commit deleted a file | `git diff --diff-filter=D --name-only HEAD~3 HEAD` | **empty** |
