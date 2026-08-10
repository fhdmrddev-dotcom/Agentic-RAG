---
phase: 190-live-connector-slice-connector-security-stretch
plan: 12
subsystem: frontend-workflows
tags: [react, context, zustand, author-surface, client-gate, copy-contract, a11y, red-first, wave-4, conn-02, conn-03]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 09
    provides: "listConnectorConnections + the ConnectorConnection / config types in frontend/src/lib/api.ts"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "connection_id as an additive-optional field on ExternalActionPhaseConfig (D-13)"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 05
    provides: "notConnectedOf retiring by DATA at phaseVocabulary.ts:812 — this plan is what makes the bound branch reachable in the running app"
provides:
  - "frontend/src/components/workflows/ConnectionPicker.tsx — the author-side picker; owns the effect, the API read AND the store write"
  - "frontend/src/components/workflows/SelectedPhaseSlugContext.tsx — the slug seam that keeps PhaseFormPanel.tsx at 0 0"
  - "Gate 1 (UI-SPEC §5a) — client-only: a last_check_verdict=failed connection is announced aria-disabled and the write is declined with an inline reason"
  - "eleven exported copy identifiers asserted by character-identity, so a reworded sentence is a red test"
  - "ConnectionPicker.test.tsx — 20 cases, four driven RED against real plants, pinned in the same commit"
affects: [190-13, 190-15, 190-16, 190-17, 190-18, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore with a null-tolerant subscribe/getSnapshot pair — reading a zustand store REACTIVELY from a leaf that may have no store at all, which useStore(api, selector) cannot do because a hook may not be called conditionally"
    - "Gate the EFFECT on the same nulls the write is gated on — a degrade that only covers the write still opens an unmocked request inside a shipped suite"
    - "aria-disabled WITHOUT the hard disabled attribute, when the spec mandates BOTH an unavailable announcement AND a reachable inline refusal — a hard-disabled control makes the mandated sentence dead copy"
    - "Carry the REQUEST KEY in the settled state and derive `loading` — removes the synchronous setState from the effect body (react-hooks/set-state-in-effect) without an extra render pass"

key-files:
  created:
    - frontend/src/components/workflows/SelectedPhaseSlugContext.tsx
    - frontend/src/components/workflows/ConnectionPicker.tsx
    - frontend/src/components/workflows/ConnectionPicker.test.tsx
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/workflows/ExternalActionSection.tsx
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "CORRECTION #3 RE-CONFIRMED AT HEAD: ExternalActionSection has THREE props (:88-98), not six. The six are source-purity FENCES, and they were RE-RUN after the mount rather than trusted — all green, recorded verbatim"
  - "The control is a NATIVE <select> + the shadcn <Label>, matching the plan's own named analog ProviderPicker.tsx:184-195 — and NOT a Radix ui/select, because a Radix disabled SelectItem is unselectable, which would make UI-SPEC §5a's mandated inline refusal unrenderable dead copy. U-09's substance is *a select, not a typeahead*, and that is satisfied"
  - "aria-disabled is set WITHOUT the hard `disabled` attribute, deliberately: the option is announced unavailable, the handler declines the write, and the refusal sentence is reachable and driven"
  - "SelectedPhaseSlugContext ships NO throwing accessor, unlike its BuilderStoreProvider analog — null here means 'no step selected', a legitimate value a throwing accessor could not tell from 'no provider'"
  - "The effect is gated on (store === null || slug === null), not merely the write — so the provider-less renders in ExternalActionSection.test.tsx and PhaseFormPanel.rails.test.tsx open no request at all"
  - "eslint src/components/workflows/ went 5 -> 10, ALL FIVE being react-refresh/only-export-components on the copy identifiers the plan explicitly requires — the same trade-off BuilderStoreProvider.tsx already ships three times in this directory. Stated with its one-line alternative rather than smoothed"

patterns-established:
  - "Re-run an inherited fence claim rather than quoting the sentence that predicts it will pass — research flagged this as assumption A3 and the plan made it a task"
  - "Check the fenced paths EXIST before reading an empty --numstat as a pass; an empty diff and a typo are indistinguishable (190-05's lesson), and verify against the phase base AND HEAD"
  - "Prove a pre-existing suite failure by ROLLING THE PLAN'S OWN CHANGES OUT and re-running the identical file set — a count quoted from a prior plan's deferral is a claim, not a measurement"

requirements-completed: []

# Metrics
duration: 78min
completed: 2026-08-09
---

# Phase 190 Plan 12: `ConnectionPicker` + the slug seam Summary

**The picker ships as a net-new SIBLING CHILD owning the effect, the read and the write, so `ExternalActionSection` keeps its THREE props and `PhaseFormPanel.tsx` stays measurably `0 0`; the six source-purity fences were RE-RUN after the mount rather than trusted, and Gate 1's refusal is REACHABLE — because `aria-disabled` without the hard `disabled` attribute is the difference between a rule and a rule whose mandated sentence no user could ever see.**

## Performance

- **Duration:** ~78 min
- **Completed:** 2026-08-09
- **Tasks:** 3, each committed individually
- **Files:** 6 (3 created, 3 modified) — **905 insertions, 1 deletion, ZERO file deletions across all three commits** (`git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty; the single deletion is the count gate's trailing marker line being replaced)

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | `SelectedPhaseSlugContext` — the write seam that keeps `PhaseFormPanel` at `0 0` | `b06df317` |
| 2 | `ConnectionPicker.tsx` — seven states, Gate 1, one key written | `e12f05eb` |
| 3 | The 2-line mount, the six fences re-run, the suite pinned | `04764bdf` |

---

# ⭐ THE SIX PURITY FENCES, RE-RUN AFTER THE MOUNT — NOT TRUSTED

Research flagged this as **assumption A3** (*"the route-string regex requires a leading slash, so a relative sibling import cannot match"*) and both the plan and UI-SPEC §1b said, verbatim, **run the fence, do not trust this sentence.** It was run. Post-mount output, verbatim:

```
✓ ExternalActionSection.test.tsx > ExternalActionSection — source purity > imports nothing from the API client and opens no request 0ms
✓ ExternalActionSection.test.tsx > ExternalActionSection — source purity > is a LEAF — no context, no store, no effect 0ms
✓ ExternalActionSection.test.tsx > ExternalActionSection — source purity > carries NO title attribute — guidance cannot regress into a tooltip 0ms
✓ ExternalActionSection.test.tsx > ExternalActionSection — source purity > those fences are real — each pattern matches its planted literal 0ms

 Test Files  1 passed (1)
      Tests  34 passed (34)
```

⚠ **A precision the plan's own wording invites getting wrong, stated rather than glossed:** the **six fences are six `expect(...).not.toMatch(...)` calls spread across THREE `it()` blocks**, not six `it()` blocks. They are `@/lib/api` import · `fetch(` · `XMLHttpRequest|EventSource|navigator.sendBeacon` · the leading-slash route string (all four inside *"imports nothing from the API client"*), `useContext|useStore|useEffect|zustand` (*"is a LEAF"*), and `title=` (*"carries NO title attribute"*). The fourth `it()` is their shared positive control. All six expectations are green after the mount, and the whole file is unmoved at **34 tests**.

**Why they survive, measured rather than argued:** the mount adds `import { ConnectionPicker } from "./ConnectionPicker"` — a relative sibling with no leading slash — and `{selected !== null && <ConnectionPicker capability={selected} />}`. Neither line contains `useEffect`, `useContext`, `useStore`, `zustand`, `fetch(`, `title=` or `"/workflows/`. The effect, the store read and the API call all live in the child, which is the entire structural point of CORRECTION #3.

---

# ⭐ CORRECTION #3, RE-CONFIRMED AT HEAD

CONTEXT D-23 says the picker *"extends the EXISTING `ExternalActionSection.tsx`"*, describing six props. Re-measured this session at `ExternalActionSection.tsx:88-98`:

```ts
export interface ExternalActionSectionProps {
  capability: string
  onChange: (value: string) => void
  onPersist: () => void
}
```

**THREE.** And the collision the plan predicted is real: `PhaseFormPanel.tsx:730`'s `set` is key-bound, so writing `connection_id` through `onChange` needs a fourth prop on the section, hence a fourth argument out of the panel — which is exactly the `0 0` D-23 forbids. The resolution taken is the plan's: a child, plus a context seam.

---

## The four plant → RED → restore cycles

Each plant was applied to **real production source** and restored with an **empty `git diff`**; `grep -c PLANT` on the shipped file is **0**.

| # | Case | Plant | Verbatim RED |
|---|---|---|---|
| 1 | **T6 — only `connection_id` crosses** | `patchConfig(slug, { connection_id: id, smtp_password: "hunter2" })` | `AssertionError: expected [ 'connection_id', 'smtp_password' ] to deeply equal [ 'connection_id' ]` |
| 2 | **Gate 1 really refuses** | `if (isFailing(chosen)) {` → `if (false && isFailing(chosen)) {` | `AssertionError: expected "patchConfig" to not be called at all, but actually been called 1 times` |
| 3 | **the disconnected guard** | the effect's `if (store === null \|\| slug === null) return` deleted | `AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot read properties of …' was thrown` |
| 4 | **Gate 1's announced half** | the `aria-disabled` spread removed from the option | `a FAILING option is aria-disabled and choosing it writes NOTHING` — FAIL |

**Plant 1 is the one the threat model asks for**, and it is worth reading with plant 2: together they prove the two halves separately. Plant 1 says *the patch object is exactly one key*; plant 2 says *the gate is what stops the write, not an accident of the fixture*. Neither implies the other.

**Plant 3 is the one that was not in the plan's list and earned its place.** The obvious degrade is to guard only the *write*. That version still renders — and still calls `listConnectorConnections` on mount inside `ExternalActionSection.test.tsx`, a suite that mocks no network. Guarding the *effect* is what makes the disconnected render genuinely inert, and the RED above is that difference being observed.

⚠ **The md5 restore needs one honest note.** After plants 1–3 the file's md5 returned to `5a57845b088c6c55412653ef60a57326` exactly. Plant 4's textual restore left one stray blank line, so it was restored with `git checkout -- <file>` instead; that path applies the repo's CRLF normalisation, so the md5 reads `ab3d0c5b…` while **`git diff --stat` on the file is empty** — which is the authoritative check, and is the same distinction plan 190-02 recorded and 190-07 refined.

---

## The eight empty-diff fences (D-23 / D-24)

**Paths confirmed to exist FIRST** — an empty `--numstat` and a mistyped path are indistinguishable, which is 190-05's recorded lesson:

```
EXISTS PhaseFormPanel.tsx · PhaseNode.tsx · PhaseNodeCard.tsx · phaseNodeCardContract.ts
EXISTS ownProperty.ts · NodeCornerMarks.tsx · NodeRunOverlay.tsx · NodeIconWell.tsx
```

`git diff --numstat HEAD -- <the eight>` → **empty.**
`git diff --numstat de122b9a -- <the eight>` → **empty.**

Both directions, on the finished tree. `PhaseFormPanel.tsx` was never opened.

---

## Files Created/Modified

- **`SelectedPhaseSlugContext.tsx`** *(created, 60 L)* — `BuilderStoreProvider.tsx`'s whole shape: `createContext<string | null>(null)`, a children-only provider, a non-throwing accessor. Measured: `grep -cE "<div|<span|<section"` → **0** (emits no DOM node, so the Builder grid's first child is unmoved — the D-183-03 flag-off contract); `grep -c "export function useSelectedPhaseSlug"` → **1**.
- **`ConnectionPicker.tsx`** *(created, 384 L)* — the seven UI-SPEC §6d states plus a disconnected state 0. Measured: `title=` → **0**; `aria-disabled` → **2**; `role="alert"` → **1**; absolute verbs (`\bcannot\b|no step will be allowed|never bound`, case-insensitive) → **0**; `patchConfig` → **1**; optional readers → **4**; `export const` → **13**.
- **`ConnectionPicker.test.tsx`** *(created, 422 L)* — 20 cases.
- **`WorkflowBuilderPage.tsx`** *(+8 / −0)* — one import, the provider wrap and its reasoning comment. **Only the `:1808` mount is wrapped**; the pre-draft describe mount at `:1530` carries no `PhaseFormPanel` and is untouched.
- **`ExternalActionSection.tsx`** *(+2 / −0, exactly as specified)* — one relative sibling import, one gated JSX line. The `:222-231` nothing-chosen note is **not touched**; its docblock already anticipated this phase.
- **`scripts/vitest-count-gate.cjs`** *(+16 / −1)* — the pin, plus a correction (below).

## Decisions Made

1. **A native `<select>` + the shadcn `<Label>`, not `@/components/ui/select`.** The plan's own named analog — `ProviderPicker.tsx:184-195`, the file it points at for the 🔒 footer — uses a native `<select>` with `<Label>`, and only two files in the whole tree import the Radix select. The decisive reason is not convention but reachability: **a Radix `SelectItem disabled` is unselectable, so §5a's mandated inline refusal could never render.** UI-SPEC U-09's recorded decision is *a `Select`, not a typeahead* (reversal trigger: >~30 connections per capability), and that substance is satisfied. Recorded here as a deviation from the literal words *"a shadcn `Select`"* so it can be reversed on purpose rather than discovered.
2. **`aria-disabled` without the hard `disabled` attribute.** §5a asks for two things that a hard-disabled option makes contradictory: *"is `aria-disabled="true"` and not selectable"* **and** *"choosing it is refused inline"*. The option is announced unavailable and the handler declines the write, so the option is not selectable **in effect** and the refusal is reachable, rendered and driven RED.
3. **The refusal renders PERSISTENTLY for a bound-failing connection**, not only after a click — §6d state 5 is reachable by design (Gate 2 accepts such a write, U-07a door (b)) and a binding that predates the failure is kept, so the reason belongs on screen whenever the field is.
4. **The effect is gated, not just the write.** See plant 3.
5. **No throwing accessor on the slug context**, unlike its analog. `string | null`'s null is a legitimate state.
6. **The copy strings live in the picker**, per the plan's explicit `export const >= 5` criterion, at a measured lint cost stated below rather than smoothed.

---

## Deviations from Plan

### 1. [RECORDED — a control choice that departs from the UI-SPEC's literal words to keep its own mandated behaviour reachable]

UI-SPEC §6d/§12 say *"a shadcn `Select`"*. The shipped control is a **native `<select>` with the shadcn `<Label>`** — the exact shape of the analog the plan sends the executor to read. Full reasoning in Decision 1. **Nothing else in §6d/§12 is departed from:** one control, a real associated `<label>`, `aria-disabled` on the failing option with its reason as adjacent DOM text, `role="alert"` on the read failure, no `title` anywhere.

**One-line reversal, if the operator prefers Radix:** swap to `@/components/ui/select` with `<SelectItem aria-disabled="true">` (NOT `disabled`), and add the `hasPointerCapture` / `scrollIntoView` jsdom shims the four existing Radix suites carry.

### 2. [Rule 1 — auto-fixed] `react-hooks/set-state-in-effect` on the loading reset

- **Found during:** Task 2, running eslint on the new files.
- **Issue:** `setRead({ kind: "loading" })` synchronously in the effect body is an eslint **error** under the shipped config, and causes a cascading render.
- **Fix:** the settled state carries the request key it answered, and `loading` is **derived** (`settled.key === requestKey ? settled : loading`). No synchronous `setState`, no extra render, and a stale answer for a previous capability is now structurally not an answer.

### 3. [MEASURED AND STATED — the eslint count in this directory rose 5 → 10]

All five new errors are `react-refresh/only-export-components`: four in `ConnectionPicker.tsx` (`CONNECTION_CAPABILITY_WORDS`, `noConnectionYetNote`, `destinationPartsOf`, `optionLabelOf`) and one in `SelectedPhaseSlugContext.tsx` (`useSelectedPhaseSlug`). **The all-caps string constants cost nothing** — the rule tolerates them, which is why 13 `export const` produce four errors and not thirteen.

- **This is the trade-off the directory already ships:** three of the five BASELINE errors are this same rule on `BuilderStoreProvider.tsx:45/53/78`, the file this plan was told to copy whole.
- **It is required by the plan**, whose Task-2 acceptance is `grep -c "export const" >= 5`, and by the copy discipline that makes character-identity assertions possible.
- **The one-line alternative, named rather than left implicit:** move the four object/function exports into a sibling `connectionPickerCopy.ts` — the literal `definitionOps` idiom `GovernanceSection.tsx:10-17` cites — which would take the directory back to 6. It is not taken here because it contradicts an explicit acceptance criterion of this plan.
- eslint is **not** in this plan's verification block; `tsc` and the count gate are, and both are green.

### 4. [RECORDED — Task 3's `npm test` acceptance is unsatisfiable as written, and the rot was RE-MEASURED rather than quoted]

Task 3 asks for `cd frontend && npm test` → `0 failed`. Measured on the finished tree: **23 failed | 4585 passed (4608), 10 failing files.** D-190-DEF-05 recorded 21/8; D-190-DEF-06 recorded 26/9. **Three different numbers across three plans is exactly why a quoted count is not evidence**, so this plan drove it:

| Run (the identical 10-file set) | Result |
|---|---|
| **WITH** the 190-12 changes | `Test Files 8 failed \| 2 passed (10)` · `Tests 21 failed \| 197 passed (218)` |
| **WITHOUT** them (`git checkout 4db5d4db -- <the two modified>`, the three new files moved aside) | `Test Files 8 failed \| 2 passed (10)` · `Tests 21 failed \| 197 passed (218)` |

**Identical. Zero new failures.** (Two of the ten pass in isolation — the ordering dependence D-190-DEF-06 already recorded.) The tree was then restored and `git status --short` over all six of this plan's files prints **nothing**.

### 5. [Rule 2 — auto-added] A residual correction to the count gate's own trailing marker

The `BASELINE_TOTAL` note read `⚠ 2712` while the `reduce` computed **2719** on an unmodified tree. That is the eighth time that comment has gone stale, and the file's own header says so. Corrected to the measured **2739** and the drift recorded in the same block, with the pre-existing +13 under-pin (`ExternalActionSection.test.tsx` 25/34, `PhaseTimeline.test.tsx` 17/21) explicitly **left alone** — `ExternalActionSection.test.tsx` is in this plan's blast radius but its count is unmoved at 34, so re-pinning it here would fold an unrelated drift into a commit that did not cause it.

### 6. [Rule 1 — auto-fixed] An inherited ROADMAP checkbox disagreed with the ledger by one

Flipping `190-12` to `[x]` made the tally read **11 done + 8 open**, not 12 + 7. Re-derived: **`190-11` was still `[ ]`** while its summary exists, both its commits (`b336e047`, `6473603d`) are in the log, and the progress cell already read `11/19`. The checkbox was never flipped by 190-11 itself.

Corrected here — `190-11` marked `[x]` with the correction stated **in the row**, so it reads as a measurement rather than as a silent tidy-up. Tally now **12 done + 7 open = 19**, agreeing with the `12/19` cell.

---

**Total deviations:** 1 recorded control-choice departure (with its reversal), 1 auto-fixed lint/render defect, 1 measured lint regression stated with its alternative, 1 unsatisfiable criterion driven rather than argued, 1 auto-added stale-marker correction, 1 inherited checkbox corrected on measurement. **Zero packages installed** — `git diff --numstat de122b9a -- frontend/package.json frontend/package-lock.json` prints nothing (T-190-SC).

## Issues Encountered

- **A textual plant restore left a stray blank line and the md5 caught it.** Plant 4's anchor was replaced with `''`, leaving an empty line the re-insertion then doubled. `git diff` showed `1 insertion`, and the file was restored with `git checkout -- <file>`. **Recorded because the failure mode is quiet**: had only `grep -c PLANT` been run, the residue would have shipped.
- **`ConnectorConnectionConfig` refuses a direct cast to `Record<string, unknown>`** (`TS2352` — a three-member union with no index signature). Read through `unknown`, with the reason inline: the destination reader is deliberately total over the union so a fourth member later degrades to an empty footer rather than to a compile error somewhere else.
- **`vi.mock`'s factory needed `vi.hoisted`** — the mock is lifted above the imports, so a `const` mock fn declared below it is in its temporal dead zone at factory time.

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `npx vitest run src/components/workflows/ConnectionPicker.test.tsx` | **20 passed / 0 failed** (plan asks ≥ 10) |
| `npx vitest run src/components/workflows/ExternalActionSection.test.tsx` | **34 passed / 0 failed**, all six purity fences green after the mount |
| `npx vitest run src/components/workflows src/pages/WorkflowBuilderPage` | **43 files / 2541 passed / 0 failed** |
| `node scripts/vitest-count-gate.cjs` | **`count gate OK`**, exit **0** — 49/49 pinned files, no per-file decrease, **0 failing**, running 2752, pinned total **2719 → 2739** |
| `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33 → 33**, unmoved (baseline RE-MEASURED at the start, not quoted) |
| `git diff --numstat` on `ExternalActionSection.tsx` | **`2 0`** — exactly as specified |
| `git diff --numstat` on `WorkflowBuilderPage.tsx` | **`8 0`** (plan allows < 10) |
| `git diff --numstat HEAD` **and** `de122b9a` on the eight fenced files | **empty for both**, after confirming all eight paths exist |
| `grep -c "ConnectionPicker.test.tsx" scripts/vitest-count-gate.cjs` | **2** (plan asks ≥ 1) |
| `grep -c PLANT` on `ConnectionPicker.tsx` | **0** |
| `git diff --diff-filter=D --name-only HEAD~3 HEAD` | **empty** — no file deleted by any commit |
| `npm test` regression drive (roll-out / roll-back, identical 10-file set) | **21 failed both ways — zero new failures** |
| `git diff --numstat de122b9a -- frontend/package.json frontend/package-lock.json` | **empty** — zero installs |
| `npx eslint src/components/workflows/` | 5 → **10**, all five new = `react-refresh/only-export-components` (see Deviation 3) |

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| **T-190-12-T6** | The patch object literal is `{ connection_id: id }` and nothing else (`grep -c patchConfig` → 1, call site printed). The suite sweeps **every** recorded call for `Object.keys === ["connection_id"]`, for any key matching `secret\|token\|password\|host\|base_url`, and for a VALUE smuggling a host — with its own inline positive control proving the sweep fires on three distinct leak shapes. Plant = `smtp_password` in the real write; observed RED verbatim |
| **T-190-12-U07a** | Copy rule 5 asserted by a `?raw` source fence (`\bcannot\b`, `no step will be allowed`, `never bound` → 0) **with a positive control** proving each pattern matches its planted literal. The refusal names *the picker* and its fix, and claims nothing about what any server accepts. Gate 1 itself is driven by plants 2 and 4 |
| **T-190-12-FENCE** | The six fences RE-RUN after the mount, their names and pass output recorded verbatim above — not trusted from research assumption A3. The import is the relative sibling form |
| **T-190-12-D23** | `PhaseFormPanel.tsx` numstat asserted EMPTY against HEAD **and** the phase base, with the path's existence confirmed first. The file was never opened. The seam is a context, not a fourth prop |
| **T-190-12-A11Y** | A real `<label>` whose `for` is asserted equal to the select's `id`; the failing option's reason resolved through `aria-describedby` to a real element and compared character-identically; `role="alert"` on the read failure; `title=` → 0 in source, and `hasAttribute("title")` → false on the live control |
| **T-190-12-CRASH** | The provider-less render asserted not to throw AND asserted to open **no request**. Plant 3 drove the second half specifically, because the first half passes without it |
| **T-190-SC** | Zero installs; only already-vendored primitives used. `package.json` / `package-lock.json` numstat empty against the phase base |

## Known Stubs

**None.** Every state renders from real data or a real error; the read calls a real registered endpoint through 190-09's client; the write reaches the real `builderStore.patchConfig` (asserted by reading the store back: `store.getState().phases[0].config.connection_id` is `"conn-ok"` after a bind and `null` after an unbind).

Two things are **deliberately absent** rather than stubbed, both with a named owner: **Gate 2** (the server half — 190-15, and it validates org + `is_enabled` **only**, by design), and the **Settings → Connections** surface the picker's copy names in text (190-16 / 190-17). The empty-state note is deliberately **text with no link** — a leaf inside the Builder has no way to switch `ActiveView`, so an anchor would be a dead one (UI-SPEC §6d).

## Threat Flags

**None.** This plan opens no new network endpoint, adds no auth path, touches no schema and reads no new file. Its single outbound call is `listConnectorConnections`, an endpoint 190-09 already shipped and already dispositioned.

## Cloud parity (D-22)

**Nothing new is owed.** Frontend-only; no env var, no migration, no seed row, no bundled service, no sandbox tag. The standing queue is unchanged at **`104 → 117` + `SECRETS_ENCRYPTION_KEY`**.

## Next Phase Readiness

**Ready.** What downstream plans may now assume, and what they still owe:

| Owed by | What |
|---|---|
| **190-15** | **Gate 2, and ONLY Gate 2's stated reach** — validate the `connection_id` write against the row's **org** and **`is_enabled`**, and deliberately NOT `last_check_verdict` (U-07a door (b)). Plus `checkConnectorConnection` in `api.ts` with its endpoint, in one commit |
| **190-16 / 190-17** | The Settings → Connections tab and panel this picker's copy names in text. **They must still resolve D-190-DEF-07 first** (the §2h banner vs the write gate), copy and gate in the SAME commit |
| **190-18** | The refusal copy surface. `CONNECTION_PICKER_FAILING_REFUSAL` is already exported and asserted here — **reuse it, do not author a second wording** |
| **`/gsd:verify-work 190`** | Do **not** read `npm test` as this phase's regression signal (D-190-DEF-05 / -06, and Deviation 4 above re-measures it a third time). Use the count gate + the per-suite runs |

**Two things not to re-litigate.** The control: a Radix `SelectItem disabled` makes §5a's refusal unrenderable, and that is measured behaviour, not taste. And the six "props": they are fences, they were re-run, and they are green.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `frontend/src/components/workflows/ConnectionPicker.tsx` | FOUND (384 L) |
| `frontend/src/components/workflows/SelectedPhaseSlugContext.tsx` | FOUND (60 L) |
| `frontend/src/components/workflows/ConnectionPicker.test.tsx` | FOUND (422 L) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` modified | FOUND (+8 / −0) |
| `frontend/src/components/workflows/ExternalActionSection.tsx` modified | FOUND (+2 / −0) |
| `scripts/vitest-count-gate.cjs` modified | FOUND (+16 / −1) |
| commit `b06df317` (Task 1) | FOUND |
| commit `e12f05eb` (Task 2) | FOUND |
| commit `04764bdf` (Task 3) | FOUND |
| No file deletions in any commit | CONFIRMED (`--diff-filter=D` empty over `HEAD~3..HEAD`) |
| The eight D-23/D-24 fences | CONFIRMED empty vs HEAD **and** vs `de122b9a`, paths verified to exist |

**CONN-02 and CONN-03 are NOT marked complete here, on purpose** — the phase convention set by 190-01 (D-190-DEF-02) and followed by every plan since. CONN-02's author surface is not whole until the Settings tab lands (190-16/17) and CONN-03's SC#2 needs the real send (190-13). Marking either now would assert a capability that does not exist, in the one phase whose whole discipline is not over-claiming.

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*
