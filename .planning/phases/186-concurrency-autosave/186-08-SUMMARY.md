---
phase: 186-concurrency-autosave
plan: 08
subsystem: workflow-builder
tags: [bug-fix, knowledge-base-binding, invitation-not-verdict, source-fence, flag-gate, red-first]

# Dependency graph
requires:
  - phase: 186-04
    provides: "`setProjectFolder` — writes `meta.project_folder_id` AND arms `dirty` in one `set()`; the `hasEdited` half was left for this plan, at the chip's call site"
  - phase: 186-07
    provides: "the composed autosave loop that makes the binding persist, `BuilderHeaderBar` (layout only, so `identityGroup` stayed on the page), and the warning that the flag-off header is pinned as literal markup"
  - phase: 186-06
    provides: "`useDraftPersistence` — the debounce, the `dirty` gate and the confirmed-write receipt the F14 page-level case rides"
provides:
  - "the KB binding as a CONTROL on the built canvas — BUG-260731-03's repair path (D-186-15)"
  - "`UNBOUND_KB_INVITATION` — the consequence sentence, an invitation and never a verdict (D-186-16)"
  - "`deferred-items.md` — D-186-17's carry-forward, its unbind addendum, and the flag-gate cost, each with a re-open trigger"
affects:
  - "187 (the deterministic `/validate` verdict half of BUG-260731-03 — NOT built here)"
  - "whichever phase makes `folder_scope` editable (it must delete this plan's unreachability assertion in the same commit)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A neutrality claim measured against a CONTROL RENDER, with a second render proving the measurement is sensitive at all"
    - "A vocabulary fence whose tokens are EXTRACTED from the shipped sources, with an emptiness control so the extraction cannot be vacuous"
    - "A comment-stripped source fence, so the constant's own docblock is free to name the seams it must stay out of"

key-files:
  created:
    - .planning/phases/186-concurrency-autosave/deferred-items.md
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
    - .planning/reported-bugs/BUG-260731-03-no-ui-to-rebind-workflow-knowledge-base.md

key-decisions:
  - "The promoted control is GATED on `canvasEnabled`. D-181-01 (the milestone's HARD gate #1) promises flag-off byte-identity and pins it as literal markup; a new affordance rendered unconditionally would break the v3.6 revert switch. The reporting operator hits this bug with the flag ON. Cost recorded with a re-open trigger."
  - "`hasEdited` is flipped at the CALL SITE (RESEARCH option (a)), not by widening the subscription's `meta` exclusion — that exclusion exists so generate/open do not start the loop."
  - "`boundFolderId` now reads the DEFINITION only when drafted. The shipped `|| projectFolderId` fallback would have made an UNBIND invisible — the picker would keep showing the folder just cleared."
  - "Unbinding is ALLOWED and proven unreachable-to-harm by test, not refused client-side — a client-side refusal is the client computing a validation rule (D-182-06)."
  - "`UNNAMED_KB_OPTION` added (not in the plan): an unnameable binding would otherwise render as a blank select, which reads as UNBOUND — the exact invisibility this plan exists to fix."

patterns-established:
  - "When a count criterion is met only because prose was reworded, say so — the number and the property are reported separately"

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-08-01
---

# Phase 186 Plan 08: The knowledge base becomes a control, and says what unbound means

**An author can now bind or re-bind a workflow's knowledge base from the built canvas, on
every entry path — and an unbound workflow stops being silent: it says `No knowledge base ·
searches everything`. The sentence is an invitation and claims nothing, machine-enforced
against a bound control render and by a source fence proved in both directions.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files:** 1 created, 3 modified — 594 insertions / 16 deletions
- **Tests:** `WorkflowBuilderPage.header.test.tsx` **15 → 27** (+12), observed RED first

## Task commits

| Task | Name | Commit |
|---|---|---|
| 1 | Promote the chip into the picker, with an honest unbound state | `99aa0c7e` |
| 2 | F16 — the chip states a fact and claims nothing; and the trap is recorded | `2cf67334` |

## The seam moved — and it moved back to the page

The prompt asked this plainly, so: **`identityGroup` is still on `WorkflowBuilderPage.tsx`,
and that is where the work landed.** 186-07 moved `BuilderHeaderBar` out of the page, but
that component owns *layout and nothing else* — it receives `identity` and `actions` as
opaque nodes and knows nothing about either. The chip lives in `identityGroup`, which never
left. `BuilderHeaderBar.tsx` and `BuilderSaveRegion.tsx` were **not opened**
(`git diff --name-only -- frontend/src/components/workflows/` → **0 files**), and 186-07's
handoff notes 1 and 2 are both honoured: the merged row still has exactly two direct
children, and nothing was added to the save cluster.

## What was built

### The control (D-186-15)

The shipped display-only `📁 <folder>` chip is now the **same select the describe screen
renders**, under the same `data-testid`, over the same `folderOptions` — already fetched
unconditionally on mount, so this issues no new request. One control, two mount points; a
net-new workflow-settings panel was rejected by D-186-15 (it fires G-2 and blows this
phase's UI budget).

`onChange` does two things and says why it does each:

1. `store.getState().setProjectFolder(id || null)` — 186-04's action, which writes
   `meta.project_folder_id` **and** arms `dirty` in one `set()`, so the leave guard and the
   autosave loop cannot see a binding the other missed;
2. `setHasEdited(true)` — **RESEARCH's open risk #4, taken as option (a)**. D-184-15's rule
   is *"nothing is claimed before the author's first EDIT"*, and a deliberate re-bind is an
   author edit. On a bug whose whole story is a failure that surfaced too late, the wrong
   answer is the one where this edit produces no live check. It is flipped at the call site
   rather than by widening the `hasEdited` subscription's `meta` exclusion — that exclusion
   exists so generate/open (which always replace `meta`) do not start the loop, and
   widening it would restart the loop on every document load. `grep -n "state.meta !== prev.meta"`
   still returns its shipped hit.

`projectFolderId` (the describe screen's own state) is deliberately **not** written from
here: in the drafted view the definition is the single source of truth for the binding, and
a second copy is the drift D-14 forbids.

### The invitation (D-186-16)

```
No knowledge base · searches everything
```

Declared as an exported constant whose docblock copies `EMPTY_DRAFT_INVITATION`'s structure
sentence for sentence: it is an INVITATION, not a claimed verdict; no severity, no code and
no lint rule is being computed; a null `project_folder_id` is not a finding; D-182-06 stays
intact because the server owns every verdict. The docblock also states **where it may
travel** — the chip, and nowhere else — and names the seams it must stay out of, which is
exactly why the source fence strips comments before it looks.

### The unbind direction, decided

Unbinding is allowed and is **proven unreachable-to-harm by test**, not blocked by a
client-side rule. A source comment on the unbind path names the trap (a phase declaring
`folder_scope` on an unbound workflow raises a raw 422, which under D-186-04's hold rule
produces a permanently unsaveable draft), states that it is unreachable because
`PhaseFormPanel` writes `folder_scope` nowhere, and points at the carry-forward record.

## RED evidence — observed before the implementation, not after

```
 FAIL … 186-08 / F16 — the KB binding is a CONTROL on the built canvas (D-186-15)
   › an UNBOUND drafted workflow says what unbound MEANS
   › the chip IS the picker — one control, and the author can reach it after drafting
   › a BOUND workflow reads its folder NAME, never a UUID, and stops inviting
   › choosing a knowledge base WRITES the binding and ARMS the guard (F14, page level)
 FAIL … 186-08 / F16 — the invitation is an INVITATION, never a verdict (D-186-16)
   › renders in exactly ONE place on the whole surface — the chip
       AssertionError: expected [] to have a length of 1 but got +0
   › carries NO severity word and NO severity tone — read out of the shipped sources

 Test Files  1 failed (1)
      Tests  6 failed | 21 passed (27)
```

After the source landed: **`Tests 27 passed (27)`**.

Note which cases were **already green** in that run, and why that is the point: the source
fence and its two controls, the bound-vs-unbound control comparison, and the
`folder_scope` premise. Those guard properties that were true before this plan and had to
stay true — a fence that only goes green after the feature lands is not fencing the
feature, it is describing it.

## How F16 avoids being vacuous

Three deliberate choices, because "assert the absence of a string" is the failure mode this
phase keeps catching:

1. **The chip's reading is the SELECTED option, not `textContent`.** A `<select>` carries
   every choice it offers in its text, so a whole-chip reading would claim the surface says
   *"No knowledge base · searches everything"* even while a folder is bound.
2. **Neutrality is measured against a control render.** The publish seam's rendered state
   (trigger markup + `aria-describedby` + reason count + reason text + tray-row count) is
   captured for a **bound** draft, then compared to the **unbound** one — and a *third*
   render with a zero-phase draft proves the reading can actually detect a reason reaching
   `blockedReason` (it picks up the shipped `Add a step to get started`). Without that
   sensitivity control, "the two readings are equal" would be measuring nothing.
   The tray-row count rides along and is 0 on both sides — the spine view does not mount the
   tray, so the load-bearing half of that comparison is the publish seam. Said plainly here
   rather than left to look stronger than it is.
3. **The severity vocabulary is EXTRACTED, never retyped.** The words come from the
   `Verdict` wire union in `lib/api.ts`; the tones come from `VERDICT_MARK.error`'s
   `className` in `nodePresentation.ts` — the **hard** mark only, because the soft mark is
   deliberately painted in the neutral tokens this chip also uses and asserting against
   those would forbid the chip from being quiet. Both extractions assert they are non-empty
   first, so a regex that stops matching cannot make the fence vacuously true.

The `?raw` fence has both controls the plan required: a **positive** one that plants
`UNBOUND_KB_INVITATION` inside the `blockedReason` memo and confirms the fence finds it, and
a **negative** one proving the constant's own docblock — which names `blockedReason`,
`verdicts`, `groupVerdicts` and `severity` in one breath, because that is what it is for —
does not trip it. That is the `useGroundingBundle.test.ts:294-316` over-broad-fence warning
applied deliberately rather than discovered.

## Verification

| Check | Result |
|---|---|
| `npx vitest run …header.test.tsx` | **27 passed** (15 before) |
| The 6 page/store suites together | **224 passed, 0 failed** |
| `npx vitest run src/pages/ src/components/workflows/ src/hooks/ src/lib/api.workflows.test.ts` | **1916 passed, 0 failed** (50 files) |
| `npx vitest run` (whole frontend) | 3532 passed, **21 failed** across 8 files — all in `src/__tests__/` (streams / chat / ingestion / model-info), the recorded SEED-056 rot band. **No workflow or page file fails; no NEW failing file.** |
| `npx tsc -b --force` total errors | **33** == baseline |
| …of which name a file this plan touched | **0** |
| `npx vite build` | **exit 0** |
| `git diff --name-only -- frontend/src/components/workflows/` | **0 files** |
| `git diff --name-only -- backend/ supabase/migrations` | **0 files** |
| Post-commit deletion check (both commits) | **0 tracked files deleted** |
| Untracked files left behind | none |

### Grep criteria — measured

| Criterion | Required | Measured | Note |
|---|---|---|---|
| `grep -c "boundFolderName &&"` | 0 | **0** | ⚠ number met, property partly — see Deviation 1 |
| `grep -c "UNBOUND_KB_INVITATION"` | ≥ 3 | **4** | constant, two docblock lines, render site |
| `"No knowledge base · searches everything"` | exactly 1 | **1** | declared once, read everywhere else |
| `grep -c "project-folder-picker"` | 2 | **2** | see Deviation 4 — it was 3 until prose was reworded |
| `UNBOUND_KB_INVITATION` inside the `blockedReason` memo | none | **none** | fenced, with both controls |
| `grep -n "state.meta !== prev.meta"` | shipped hit survives | **1 hit** | the subscription was not widened |

**On the 50-file total:** 186-07 recorded **1901**; this plan adds **+12** to one file, so
1913 was the expected figure and **1916** was measured. The 3-test difference predates this
plan — `git diff --name-only` across both commits lists only the two files above — and is
recorded rather than smoothed over.

## What this plan did NOT build

**The deterministic build-time `/validate` `incomplete` verdict for an unbound retrieval
workflow was NOT built and remains Phase 187's** (D-186-14, SEED-132 envelope). No verdict,
no severity, no code, no lint finding, no problems-tray row, no node mark and no
`blockedReason` entry was added. `BUG-260731-03` therefore stays `status: folded` — the
report's own `re_open_trigger` forbids flipping it to `closed` when 186 ships, and this plan
closes only the repair path.

## Deviations from Plan

### 1. [Rule 3 — Blocking · D-181-01] The promoted control is FLAG-GATED, and the "remove the gate" criterion is met in number but not wholly in property

- **Found during:** Task 1, before writing any code — 186-07's handoff note 4 said it in
  advance: *"Anything added to `identityGroup` that renders with the canvas flag off will
  break that pin — gate it, or update the pin deliberately and say so."*
- **Issue:** The plan asks for the `boundFolderName &&` gate to be removed so an unbound
  workflow always renders an explicit state. Doing that unconditionally adds a net-new
  affordance to the **flag-off** Builder, which D-181-01 — this milestone's HARD gate #1,
  inherited by every phase since 181 — promises is byte-identical for everyone, operators
  included, and which `WorkflowBuilderPage.header.test.tsx` pins as literal markup. The
  off-switch would no longer revert v3.6.
- **Fix:** the affordance is one expression with two arms. Flag **on** ⇒ the picker, always
  rendered, invitation when unbound. Flag **off** ⇒ the shipped display-only chip, byte for
  byte, including hiding when unbound. This is 186-07's own rule applied a second time (the
  quiet autosave line is gated because it describes canvas-only machinery; the conflict
  banner is not, because a refusal is reachable from any surface). The reporting operator
  hit this bug **with the canvas on** — the report's complaint is that regeneration
  "discards the authored canvas" — so gating costs the person who reported it nothing.
- **The number and the property, reported separately.** `grep -c "boundFolderName &&"`
  returns **0**, and that is honest as far as it goes — the gate is no longer a standalone
  condition. But the flag-off arm *does* still hide the unbound state, spelled
  `boundFolderName !== null ?` because a ternary chain cannot spell it `&&`. **The number
  moved further than the property did**, and saying so is the point: the criterion's
  protected property holds on the canvas surface and is deliberately unchanged on the
  frozen one. The flag-off markup pin passes **unedited**, which is the evidence.
- **Recorded:** `deferred-items.md` entry 3, with a concrete re-open trigger, and in the
  bug report's dated note under *Reachability caveat*.
- **Committed in:** `99aa0c7e`.

### 2. [Rule 2 — Missing critical functionality] An unnameable binding would have rendered as a blank control

- **Found during:** Task 1, wiring the select's `value`.
- **Issue:** `folderNames` and `folderOptions` are built from the same `listFolders()`
  array, so a bound id the author cannot see (folder deleted, or a fork that inherited
  someone else's binding) is simultaneously **unnameable and unoffered**. A `<select>` whose
  value matches no option renders **blank** — and a blank chip reads as *unbound*, which is
  precisely the invisibility this plan exists to remove, re-created by the fix.
- **Fix:** `UNNAMED_KB_OPTION` — *"A knowledge base outside your folders"* — appended as an
  option only when the bound id is not among the offered ones. Still a neutral fact about
  configuration with no severity and no code: the workflow **is** bound, we simply cannot
  name the folder. Not the raw id, because 103-ux's rule for this chip is a NAME and never a
  UUID. Module-local rather than exported, because nothing outside this file says it.
- **Committed in:** `99aa0c7e`.

### 3. [Rule 1 — Bug] The shipped `boundFolderId` fallback would have made an UNBIND invisible

- **Found during:** Task 1, deriving the select's value.
- **Issue:** The shipped chip read `meta.project_folder_id || projectFolderId` — the
  definition's binding with the describe screen's choice as a fallback. Harmless while the
  binding could only be *set*; wrong the moment it can be *cleared*. Unbinding sets
  `meta.project_folder_id` to null, the `||` falls through to the stale describe-screen
  choice, and the picker keeps showing the folder the author just cleared — while the
  definition, the PATCH and the golden run all say otherwise.
- **Fix:** in the drafted view the reading is the **definition only**. The fallback is
  unreachable on the way in (`onDraft` stamps the chosen id onto the definition before
  `setDrafted`; Open / Tweak / Use-this seed `projectFolderId` *from* the definition), so
  this loses nothing and closes the unbind hole. The reason is written into the memo.
- **Committed in:** `99aa0c7e`.

### 4. [Acceptance-criterion scope] Two greps counted my own docblock — the seventh plan in this phase to hit this shape

- **Found during:** Task 1 verification. `grep -c "project-folder-picker"` returned **3**
  where the criterion says 3 *"would mean a new control was authored"*, and
  `grep -c "boundFolderName &&"` returned **1**. Both extra hits were **prose in the
  docblock I had just written** — *"the same `project-folder-picker` select the describe
  screen renders"* and *"the old `boundFolderName &&` gate hid it entirely"*.
- **Fix:** the 186-04 remedy, applied deliberately: state the facts by **description**
  rather than by identifier — *"the same select the describe screen renders, under the same
  test id"* and *"the shipped bound-name gate"*. No information was lost and no code moved;
  only two prose phrases changed, and the counts became 2 and 0 **honestly** rather than by
  hiding anything. Exactly one control was authored, at exactly two mount points.

### 5. [Plan-internal] The plan's severity-token source could not supply the tokens

- **Found during:** Task 2, first RED run — `severityWords.length` was **0**.
- **Issue:** The natural read of *"read the actual tokens from the shipped source"* is
  `verdictModel.ts`, but that module compares against a **constant** (`SOFT_SEVERITY`), not
  a literal, and `ProblemsTray.tsx` contains no severity tone at all (it imports
  `VERDICT_MARK`). A fence built on an empty extraction passes vacuously — the exact shape
  this phase keeps catching.
- **Fix:** the words are extracted from the `Verdict` **wire union** in `lib/api.ts` (the
  vocabulary's actual owner) and the tones from `VERDICT_MARK.error.className` in
  `nodePresentation.ts`, hard mark only. An emptiness assertion was added **first**, so the
  extraction itself is controlled. That assertion is why the miss surfaced at all instead of
  shipping a green test that checked nothing.
- **Committed in:** `2cf67334`.

**Total deviations:** 5 — 1 inherited-decision conflict, 1 Rule 2, 1 Rule 1, 1
criterion-scope, 1 plan-internal. **No Rule 4.** No package installed, no backend file, no
migration, no read-only fence opened.

## Issues encountered

- **The full frontend suite has 21 failures across 8 files**, every one of them in
  `src/__tests__/` (streamsProvider ×3, MessageItem, IngestionPage, useMessages, Plan04,
  model-info). None is in `src/pages/` or `src/components/workflows/`, none imports the file
  this plan touched, and the same band is recorded in `project_frontend_vitest_rot` /
  SEED-056. Not chased, per the scope-boundary rule.
- **The `mockUpdate` wait in the F14 page-level case runs on REAL timers** with a 5 s
  `waitFor` budget, because the header suite composes the whole `WorkflowsPage` → Builder
  stack and switching it to fake timers would change the behaviour of every case above it.
  It is a real end-to-end assertion — picker → `setProjectFolder` → `dirty` → the debounced
  PATCH carrying `project_folder_id` — and it fails by timing out if any link breaks.

## Known Stubs

None. Every branch is wired end to end: the picker offers real folders, the unbound state
renders, an unnameable binding names itself honestly, the binding reaches the wire through
the shipped save path, and the flag-off surface keeps exactly what it shipped. Nothing
renders placeholder data and nothing is gated on work a later plan owes — the `/validate`
verdict is a *deliberate omission* recorded in `deferred-items.md`, not a stub left behind.

## Threat surface

No new network endpoint, auth path, file access or schema surface. This plan adds no API
function and issues no request the page did not already make.

| Threat | Where it is enforced | Where it is asserted |
|---|---|---|
| T-186-08-01 spoofing a verdict | the invitation renders on the chip and is referenced nowhere else; it never reaches `blockedReason`, `verdicts` or `groupVerdicts` | *"renders in exactly ONE place on the whole surface"*, the bound-control publish-seam comparison + its sensitivity control, the comment-stripped source fence with both controls, and the extracted severity-vocabulary case |
| T-186-08-02 self-inflicted DoS via unbind | not guarded client-side, by design (D-182-06); proven unreachable | *"PhaseFormPanel renders folder_scope, and writes it nowhere"* — a comment-stripped source assertion over the three write shapes, plus the `deferred-items.md` carry-forward |
| T-186-08-03 EoP via the folder id | unchanged — retrieval scope is resolved server-side against the caller's own access | n/a (accepted in the plan) |
| T-186-08-04 a binding silently lost | `setProjectFolder` arms `dirty` (186-04) and the call site flips `hasEdited` | the F14 page-level case: the PATCH carries `project_folder_id`, which cannot happen unless `dirty` armed |
| T-186-08-SC package installs | zero packages installed | `git diff --stat` lists only source and planning files |

No file this plan created or modified introduces network, auth, file-access or schema
surface, so there is nothing to flag beyond the register above.

## User setup required

None — no environment variable, no migration, no cloud-parity step, no package.
`scripts/check-deploy-drift.sh` is unaffected.

## Self-Check: PASSED

- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.header.test.tsx` — FOUND
- `.planning/phases/186-concurrency-autosave/deferred-items.md` — FOUND
- `.planning/reported-bugs/BUG-260731-03-no-ui-to-rebind-workflow-knowledge-base.md` — FOUND
- commit `99aa0c7e` — FOUND in `git log`
- commit `2cf67334` — FOUND in `git log`

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*
