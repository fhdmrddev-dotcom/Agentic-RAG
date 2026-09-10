---
phase: 239
plan: "10"
subsystem: settings / frontend
seed: SEED-258
tags: [settings, app_settings, source-ceiling, operator-scope, copy, cross-language-pin]
requires:
  - 239-09 — the backend this surfaces (the knob, its bounds, the cost-bearing refusal)
  - SEED-227 precedent — a bounded `app_settings` number as a card on this same page
provides:
  - "SourceFileCeilingCard — the control, with its cost, recommendation and bounds on screen"
  - "sourceCeilingCopy — the words, with the ONE advisory number pinned across languages"
  - "FullAppSettings.source_max_file_size_mb + served _floor / _ceiling on the wire type"
  - "SEED-258's headline requirement, MET for its first instance"
affects:
  - frontend/src/pages/SettingsPage.tsx
  - frontend/src/lib/api/skills.ts
  - frontend/src/components/settings/SourceFileCeilingCard.tsx
  - frontend/src/components/settings/sourceCeilingCopy.ts
tech-stack:
  added: []
  patterns: [served-bounds-never-re-typed, cross-language ?raw pin, copy-module-owns-the-words, no-clamp-the-API-is-the-boundary]
key-files:
  created:
    - frontend/src/components/settings/SourceFileCeilingCard.tsx
    - frontend/src/components/settings/sourceCeilingCopy.ts
    - frontend/src/components/settings/__tests__/SourceFileCeilingCard.test.tsx
    - frontend/src/components/settings/__tests__/sourceCeilingCopy.test.ts
    - frontend/src/pages/__tests__/SettingsPage.sourceCeiling.test.tsx
  modified:
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/lib/api/skills.ts
    - frontend/src/pages/SettingsPage.test.tsx
    - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-258-source-size-ceilings-belong-in-settings-with-their-reasons.md
metrics:
  duration: ~2h
  completed: 2026-09-08
  tasks: 5
  commits: 5
---

# Phase 239 Plan 10: The Source Ceiling Becomes Something an Operator Can See — Summary

**Frontend only.** `239-09` shipped every byte of the backend and said in its own words that the
seed was still undischarged: *"The Settings UI does not yet show this knob … SEED-258's headline
requirement … is therefore NOT met yet."* This is that half — the control, and the three sentences
that make it a setting rather than a text box.

---

## ⚠ Base correction, first — the ninth agent in a row

The worktree came up on **`1335b4b1a`** (the v3.9 ship commit on `master`), **not** `81ad2d58b`.
Documented `origin/HEAD` behaviour; `git reset --hard 81ad2d58b` before any other action, verified
(`81ad2d58b merge(239-09): the source ceiling becomes one setting, three copies become one`).
Bootstrap clean afterwards: `BOOTSTRAP OK`, both junctions live, both `.env` files copied.

---

## Where it went, and why

### **Settings → Integrations (tab `2`).** One home. Not split.

| Reason | Detail |
|---|---|
| **Scope, by construction** | The knob writes `app_settings`, the **global operator singleton**. `GET`/`PUT /settings` both carry `require_visible("model_management")` — the *same* gate that decides whether this tab exists at all. The knob is operator-scope because of where it sits, not because of a check bolted onto it. SEED-258: *"A DoS guard a user can raise for themselves is not a guard."* |
| **The write path already exists** | `handleSaveIntegrations` already `PUT`s through `updateSettings`, which rethrows the backend's `detail` verbatim into the page-level error banner (`SettingsPage.tsx:986`). So the server's refusal — **the one place the cost sentence is authoritative** — reaches the operator with no new plumbing and nothing swallowed. |
| **The precedent lives here** | `multimodal_max_vision_calls` (SEED-227), the other bounded `app_settings` number, is a card on this page. SEED-258 names it explicitly: *"Precedent to follow, not invent."* |
| **Subject** | This tab is already where the app's dealings with **outside services** live — Tavily, the Docker sandbox. *"How large a file we accept from a server we do not control"* is that family. |

### ⛔ `ConnectionsPage` rejected — and this is a finding, not a preference

It is the obvious-looking home (connected sources live there) and it is **wrong**, for a reason
written into the page's own docblock: it is **UNGOVERNED BY DESIGN** — *"a connection is a per-user
asset, like a thread"* — and it was moved out of Settings in `235a0f9ff` **precisely so it would
stop depending on `model_management`**. It calls neither settings endpoint; `ConnectionsTab` fetches
its own rows through `listConnectorConnections()`.

Putting a global DoS guard there would be the `user_settings` mistake wearing a different hat: a
member would see the control and the read would be refused. **The page that looks most topical is
structurally the one place this must not go.**

### ⛔ Control Room rejected

It reads `getSettings()` but writes config only through `setFlag` — its numeric inputs are model
discovery/registry, not general config. Landing here would have meant **a second write path to one
singleton**, which is the shape of the disagreement SEED-258 exists because of.

---

## The exact copy, as an operator reads it

Rendered with the shipped bounds (`floor 1`, `ceiling 50`) and the shipped recommendation (`25`):

> ### Largest file a connected source may import
>
> One limit, applied to every connected source — Google Drive, OneDrive and SharePoint, and any MCP
> server that serves files. A file over the limit is refused whole; nothing partial is ever imported.
>
> **Maximum file size** `[ 25 ]` MB
>
> Anything from 1 to 50 MB. Below 1 MB essentially nothing would import, while every sync still
> reported success. 50 MB is this app's own limit for a file uploaded by hand, so a connected source
> can never admit a file you could not add yourself.
>
> Raising this costs memory. A file is held whole in memory while it is fetched, once per request in
> flight, from a server we do not control — and an MCP server returns file content inside its reply,
> base64-encoded at 4/3 its size. The transport limit follows this number on its own; it is never a
> second setting.
>
> Recommended: 25 MB. It suits most document workloads and is the value the app ships with. Raise it
> only for a source you know holds larger files, and expect the memory cost above to rise with it.

**Four things are on screen, which is the requirement that IS this task:** the current value; that it
covers *every* connected source; **what raising it costs**; and a recommendation sitting beside that
tradeoff rather than instead of it. The bounds are stated so `1` and `50` are not discovered by being
refused.

### ⚠ One deliberate divergence from migration 174's wording

The migration says *"Google Drive, **Microsoft Graph**, any MCP file surface"* — those are **adapter
module names**. An operator never reads *"Microsoft Graph"* anywhere in this product;
`servicesCatalog.ts:100` calls that connection **Microsoft 365**, with OneDrive and SharePoint as its
file surfaces. **The migration's reasoning is echoed; its vocabulary is not.** Recorded in the ledger
so a later "correction" back to module names does not make the sentence accurate about code and wrong
about what the operator can see.

---

## ⛔ Where the numbers live — the fourth-private-constant problem

`239-09` deleted three copies of `MAX_FILE_BYTES` from three Python files. The easiest way to undo
that work is to re-type `50` in a React form, which is why `api/settings.py:79` says so out loud.

| Number | Home | How it is kept honest |
|---|---|---|
| floor / ceiling | **SERVED** — `source_max_file_size_mb_floor` / `_ceiling` on the response | The card takes them as **props**; the copy function takes them as **arguments**. A negative case hands it `3, 44` and asserts the sentence does **not** contain `50` — a function that ignored its arguments would pass the positive case by accident. |
| the recommendation, `25` | `sourceCeilingCopy.ts` — **the one number the frontend owns** | Advice, not a boundary, and the server does not serve it. **Pinned across languages**: `sourceCeilingCopy.test.ts` reads `backend/app/models/user_settings.py` via `?raw` and asserts equality with `SOURCE_MAX_FILE_SIZE_MB_DEFAULT`. |

⭐ **Why a test and not a comment.** `google_drive.py` asserted for its *entire life* that its 25 MB
*"match[ed] application upload ceiling"*; measured 2026-09-08 the ceiling was 50 MB and the sentence
had never been true. A recommendation drifted from the shipped default is worse than none — it
advises toward a value the product no longer chooses.

⚠ **The bounds start `null` in `SettingsPage`, and the `null` is load-bearing.** My first draft wrote
`useState(50)` — which is *itself* the fourth private constant. Corrected before commit: there is no
honest cold value for a bound the server has not stated, so the card mounts only once it has.

---

## RED evidence

TDD on. Tests authored and observed failing **before** any implementation existed, and committed
first (`b001ab1ea` precedes `574f48916`).

```
FAIL  src/components/settings/__tests__/sourceCeilingCopy.test.ts
FAIL  src/components/settings/__tests__/SourceFileCeilingCard.test.tsx
 Test Files  3 failed (3)
      Tests  6 failed | 3 passed (9)
```

**Two of the three files failed to COLLECT AT ALL** — no such module — which is the strongest RED
available. The third (`SettingsPage.sourceCeiling`) ran and failed 6 of 9.

**⚠ The `3 passed` is disclosed, not hidden**, exactly as `239-09` disclosed its own:

| Case | Why it passed at RED |
|---|---|
| `the fixture's own premise: getSettings serves the three SEED-258 fields` | **Meant to pass.** It exists because four cases in this phase passed vacuously on a bad fixture. |
| `is NOT also on the AI Model tab` | A **negative fence**, vacuous while nothing existed. ⚠ **And its premise was FALSE — see below.** |
| `a member never reaches it` | A negative fence, vacuous for the same reason. Its positive control is the operator case beside it, which *did* fail. |

### ⭐ A test premise measured FALSE, recorded rather than rewritten away

`is NOT also on the AI Model tab` passed at RED, then **failed after implementation** — while passing
when run in isolation. The cause is not flake and not leakage: **`handleTabChange` persists the
selection to `localStorage`** (`SettingsPage.tsx:590`), and jsdom keeps `localStorage` for a whole
file, so the case mounted on whichever tab an earlier case had opened. **Real product behaviour that
the suite's premise denied.**

It was **rewritten to assert the property actually wanted, which is stronger than the original**:
the title appears **exactly once** in the page, and its `[role="tabpanel"]` is `aria-labelledby` the
Integrations tab. *"Absent from tab 0"* would still have permitted a second copy on tab 1 — and the
brief's requirement is *"do not split it across both"*. The false premise is written into the test
body and into the ledger, because the premise is the finding.

**GREEN:**
```
$ npx vitest run src/components/settings/__tests__/SourceFileCeilingCard.test.tsx \
      src/components/settings/__tests__/sourceCeilingCopy.test.ts \
      src/pages/__tests__/SettingsPage.sourceCeiling.test.tsx
 Test Files  3 passed (3)
      Tests  29 passed (29)
   Duration  14.18s
```

---

## Gates — verbatim, and one of them is a problem that is NOT mine

### ⛔ The vitest gate is currently NON-DETERMINISTIC on this box, and it is PROVEN not to be this plan

**Baseline, captured BEFORE any edit** (the brief's rule — the set, never a tail):
```
numTotalTests 1514 passed 1487 failed 27 suites 411
timeout-shaped: 21  other: 6
```

**After, run 1:** `1514 → 1543` tests (**+29, exactly my new cases** — no other suite changed count),
`failed 91`, of which **78 timeout-shaped**.
**After, run 2:** `failed 83`, of which **70 timeout-shaped** — and **a completely different failing
set**, with all three of my suites absent from it.

**⭐ The decisive measurement, run rather than argued.** I re-ran the gate with my three new files
`--exclude`d, which reproduces the **baseline test set exactly**:

```
numTotalTests 1514 passed 1424 failed 90 suites 411
timeout-shaped: 75  other: 15
```

**Same 1514 tests, same 411 suites as the baseline — 27 failures then, 90 now.** My suites cannot be
the cause of failures in a run they are not in. The failing files across the three runs share almost
nothing (`HealthSignals.a11y`, `MaintenancePanel.a11y`, `ModelDiscoveryPanel`, `AcceptInvitePage`,
`WorkflowBuilderPage.preDraft.baseline` appear in one run and no other) — **SEED-171's signature:
the failing SET is never the same twice.**

**Cause, measured not guessed:** `git worktree list` shows a **second live agent worktree**
(`agent-aa447ed26e41f47dc`, locked) and `tasklist` counts **20 node processes**. CLAUDE.md's own
rule: *"at THREE concurrent test-running agents the gate goes non-deterministic regardless of cap."*

⛔ **The worker cap was NOT touched.** It stayed `GSD_VITEST_MAX_WORKERS=2` on every invocation, per
the brief and per the standing correction that adjusting the cap is measured *not* to fix these.

### ✅ The deterministic evidence — my exact blast radius

```
$ npx vitest run <the 3 new suites> src/pages/SettingsPage.test.tsx \
                 src/pages/__tests__/SettingsPage.a11y.test.tsx
 Test Files  1 failed | 4 passed (5)
      Tests  4 failed | 42 passed (46)
```

The 4 are all `SettingsPage.a11y.test.tsx`, and their node IDs **diff clean against the baseline set**:

```
$ diff a11y-base.txt a11y-after.txt
=== SettingsPage.a11y failing set IDENTICAL to base (4/4) ===
```

All four are `Unable to find role="button" and name /technical names/i` — the Phase 154 reveal
control, **inherited, red at base, and untouched by this plan** (my edit to that file is 5 fixture
lines). ⚠ Saying it the way this project requires: those four are **provably unmodified in cause**,
not "fine".

⚠ `sourceComposition.test.tsx` (the brief's standing 18/31 red) is under `src/components/sources`,
which is **not in this gate's directory set** — it never ran here. Named so its absence is not read
as a pass.

### ✅ TypeScript — both numbers, and the set diffed

```
$ npx tsc -p tsconfig.app.json --noEmit    # base:  67 errors
$ npx tsc -p tsconfig.app.json --noEmit    # after: 67 errors
```

Normalised (line/col and the `... N more ...` elision stripped, since adding 3 fields to a type
shifts both) and diffed as a **set**:

```
tsc-base.txt  -> 67 errors
tsc-after.txt -> 67 errors
=== TSC ERROR SETS IDENTICAL (67 base / 67 after, zero new) ===
```

⚠ **Three lines looked different on a raw diff and were not.** `SettingsPage.test.tsx(82,3)` reports
`TS2322` in **both** runs, and in both the incompatible property is **`self_improve_enabled`** — a
pre-existing hole my fixture edit neither caused nor cured. The other two shifted only by line number
(`869→890`, `1204→1230`). **A set diff needs normalising before it can be trusted, or it manufactures
exactly the finding you were looking for** — `239-09` recorded the same trap from the other side.

⛔ Run with `-p tsconfig.app.json`. `npx tsc --noEmit` on the default config type-checks **zero
files** and exits 0.

### ✅ Ledger and CLAUDE.md size

```
$ node scripts/check-hot-file-ledger.cjs --files <4 touched source files>
ledger gate OK — every watched file has a row.

$ node scripts/check-claude-md-size.cjs
  CLAUDE.md   87547 chars   58.4% of limit   headroom 62453  [OK]
```

⚠ **The ledger gate FAILED FIRST, unprompted**, with `[no-row]` on three files.

---

## Re-derived triples

| File | Row said | **Measured 2026-09-08** | Fires G-5? |
|---|---|---|---|
| `frontend/src/pages/SettingsPage.tsx` | `38 / 21 / 1500` | **`43 / 22 / 1647`** | ⚠ **FIRES** (22) |
| `frontend/src/lib/api/skills.ts` | **NO ROW AT ALL** | **`4 / 2 / 715`** | no (2 phases) |
| `frontend/src/components/settings/SourceFileCeilingCard.tsx` | new | **`1 / 1 / 117`** | no |
| `frontend/src/components/settings/sourceCeilingCopy.ts` | new | **`1 / 1 / 109`** | no |

Old figures recorded **beside** their replacements in `docs/HOT-FILE-LEDGER.md`, never over them;
sections added in the **same commit**; disposition cells under the 200-char cap. `CLAUDE.md`'s
G-5-firing table updated in the same commit for `SettingsPage.tsx`.

Three observations worth carrying:

- ⚠ **`lib/api/skills.ts` had no row for its entire life** — the **fifth** Phase-207 split module
  found without one, after `threads.ts`, `workflows.ts`, `connectors.ts` and `org.ts`. `lib/api.ts`'s
  row is the **barrel** and covers none of them.
- ⚠ **Its NAME is a trap.** `skills.ts` holds **`FullAppSettings` and `SettingsUpdate`** — the whole
  settings wire contract. A phase auditing "what did the settings change touch" will not grep a file
  called `skills`. Recorded rather than renamed: the rename is a real seam and belongs in a refactor.
- ⚠ **`SettingsPage.tsx`'s row was stale by 5 commits and a phase**, one plan after `239-09` re-derived
  five of its six rows and found five stale or absent.

**G-5 on `SettingsPage.tsx` is honoured by construction, and slightly better than the precedent:**
SEED-227 added its card **inline**; this plan added a `useState`, a read, a payload key and a
**mount**, with the card and its copy in their own files. **⛔ The named seam — tab registration out
of the page — is NOT taken and remains OWED.**

---

## Deviations from plan

1. **[Rule 1 — Bug, self-caught before commit] `useState(50)` for the ceiling.** My own first draft
   seeded the bounds with `1` and `50`, which is precisely the fourth private constant this work
   exists to prevent. Replaced with `number | null` and a mount guard.
2. **[Rule 3 — Blocking] Two existing fixtures failed to typecheck** once the three fields became
   required on `FullAppSettings` (`SettingsPage.test.tsx`, `SettingsPage.a11y.test.tsx`). Added the
   fields rather than relaxing the type — the backend's own stub comment is right that a default
   there *"would hide a field the API forgot to build"*.
3. **[Rule 1 — Bug in my own test] The false tab premise**, above. Rewritten to a stronger property,
   with the premise recorded.

None required Rule 4.

---

## ⛔ What I did NOT do — silence would read as done

- **⛔ I did NOT apply migration 174.** Still owed, still the operator's paste into the Supabase SQL
  editor. **The UI is correct in the meantime and this was designed for, not tolerated:** the column
  is absent, `_val()` returns the shipped 25, `GET /settings` serves `25 / 1 / 50`, and the card
  renders exactly that. Nothing on screen claims a value the DB holds.
- **⛔ SEED-258 stays `status: planted`.** I did not flip it. The seed was **widened into a CLASS**
  and this is its *first instance*: **16 unreachable settings fields** (including the 8-field
  extraction-engine bank) and **57 of 58 constants with no recorded verdict** are untouched. I added
  a dated *"PARTIALLY ANSWERED"* section to the seed recording what is done and what the instance
  establishes as the reusable pattern — per CLAUDE.md, *a seed is answered by editing the seed*.
- **⛔ No backend change, no `backend/` file touched.** Frontend only, as instructed.
- **⛔ I did NOT pin the three new suites into `scripts/vitest-count-gate.cjs`.** They run under the
  brief's gate command (which takes directories) but **`src/components/settings/` entries in `TARGETS`
  are FILE-LEVEL**, so a new file there is invisible to the count gate. **Named, not left silent** —
  this is the `SEED-222` situation and the same failure mode as `WorkflowScheduleModal.test.tsx`.
  Not done because it edits a `167 / 38 / 4786` hot file for reasons outside this plan's scope.
- **⛔ I did NOT run `graphify update .`** despite the standing CLAUDE.md rule — it writes into
  `graphify-out/`, outside this plan's scope, and would put unrelated files in the merge. **Owed.**
- **⛔ No manual UAT, and none of this was seen in a browser.** Every claim above is from vitest and
  `tsc`. **G-4 rows are owed**: at minimum (a) the card renders on Integrations for an operator with
  the real backend; (b) saving an in-range value persists and survives reload; (c) **saving an
  out-of-range value shows the server's refusal sentence** — the one thing that cannot be proven by a
  mock, since it depends on the live 400 body reaching the banner.
- **⛔ No accessibility audit of the new card.** `SettingsPage.a11y.test.tsx` is red at base for
  unrelated reasons and I added no aXe case for this card. The input is label-associated
  (`htmlFor`/`id`); nothing stronger is claimed.
- **⛔ I did NOT re-run the full vitest gate to a green line**, and could not have: the gate is
  non-deterministic on this box right now for a measured reason that is not this plan. What is
  offered instead is deterministic and stronger for this diff — the targeted blast-radius run and the
  exclusion run.
- **⛔ Nothing pushed. `master`, `production` and `backend/` untouched.**

---

## Self-Check: PASSED

Files claimed created — all present:
`SourceFileCeilingCard.tsx` · `sourceCeilingCopy.ts` · `SourceFileCeilingCard.test.tsx` ·
`sourceCeilingCopy.test.ts` · `SettingsPage.sourceCeiling.test.tsx`

Commits claimed — all present on `worktree-agent-afcfb34514027fdfc`:

| Commit | What |
|---|---|
| `b001ab1ea` | `test(239-10)` — RED, three suites |
| `574f48916` | `feat(239-10)` — the card and its copy module |
| `711b891c5` | `feat(239-10)` — wire types, page state, save payload, mount |
| `5cda90d90` | `docs(239-10)` — three ledger rows + sections + CLAUDE.md row |
| `66b9eb125` | `docs(239-10)` — SEED-258 partially answered in its own file |
