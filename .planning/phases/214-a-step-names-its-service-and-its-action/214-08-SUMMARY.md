---
phase: 214-a-step-names-its-service-and-its-action
plan: 08
subsystem: ui
tags: [react, tailwind, iconify, unplugin-icons, lucide, vitest, step-identity, connection-mark]

requires:
  - phase: 214-03
    provides: "`stepIdentityVocabulary.ts` — `STEP_IDENTITY`, `STEP_IDENTITY_SERVICE_UNKNOWN`, and the six flat ids"
  - phase: 206.1-01
    provides: "`connectionMark.tsx` — the ONE service-to-mark map, slugs verified against `@iconify-json/logos@1.2.13`"
provides:
  - "`frontend/src/lib/connectionMark.tsx` — the service-to-mark map at the shipped `lib/` home for a cross-surface resolver"
  - "`ConnectionMarkSize` — the four-token size union (`row` | `chip` | `canvas` | `spine`), exported so consumers alias rather than re-declare"
  - "`frontend/src/components/workflows/StepIdentity.tsx` — the shared step-identity element five run surfaces mount in 214-11"
  - "`StepIdentity.test.tsx` — 41 cases, incl. the ported resolved-but-EMPTY/-IDENTICAL/-INVISIBLE block"
  - "count-gate knobs: `TARGETS` repointed to `src/lib/__tests__/connectionMark.test.tsx`; `BASELINE` gains `StepIdentity.test.tsx: 41`"
affects: [214-11, 214-15, SEED-206, PhaseCard, PhaseTimeline, RunCard, RunSpine, RunStepList, PendingAskCard]

tech-stack:
  added: []
  patterns:
    - "A cross-surface mark resolver lives in `lib/`, beside `phaseGlyph.tsx` and `providerLogo.tsx` — never under `components/<one-surface>/`"
    - "Size is a modifier: two Records keyed by ONE exported union, widened rather than branched"
    - "A governed separator is EXTRACTED from its composed vocabulary id via sentinel codepoints, never retyped"
    - "A `?raw` source fence runs over COMMENT-STRIPPED text with a stripper-did-something positive control (the 187-24 handling pattern)"

key-files:
  created:
    - frontend/src/components/workflows/StepIdentity.tsx
    - frontend/src/components/workflows/StepIdentity.test.tsx
  modified:
    - frontend/src/lib/connectionMark.tsx
    - frontend/src/lib/__tests__/connectionMark.test.tsx
    - frontend/src/components/settings/ConnectionsTab.tsx
    - frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx
    - frontend/src/components/workflows/nodePresentation.ts
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "KEEP the local `PhaseMark` alias — `lib/phaseGlyph.tsx` still has other consumers, so the move changed this module's location, not its consumer set"
  - "`spine` = `h-5 w-5` (20px), the sketch's `md`, filling the one gap the shipped 12 / 16 / 32 leave; `canvas` stays `h-8` because this is a move, not a re-skin"
  - "`StepIdentitySize` is an ALIAS of `ConnectionMarkSize`, not a copy — two hand-written unions can drift by one token invisibly"
  - "A blank or whitespace `service` is treated as unresolved, same as `null`"
  - "`StepIdentity` renders `STEP_IDENTITY_SERVICE_UNKNOWN({ action })` explicitly on the null arm so the honest choice is visible in the source"

patterns-established:
  - "Move-not-fork for a shared resolver: `git mv`, zero map rows changed, every importer swept (four, not the plan's two)"
  - "Plant-and-restore RED drives: four defects planted, each fence observed failing, source restored md5-identical"

requirements-completed: [STEP-04]

duration: 42min
completed: 2026-08-28
---

# Phase 214 Plan 08: The shared step-identity element Summary

**`connectionMark.tsx` moved to `lib/` with its history and zero map rows changed, its `SIZE_CLASS` widened to a fourth key, and `StepIdentity` built on top — one element, four sizes selected by a Record, both names taken as props, 41 cases with four fences driven RED against planted defects.**

## Performance

- **Duration:** ~42 min
- **Tasks:** 2 of 2
- **Files created:** 2 · **Files modified:** 6 (2 of them renames)

## Accomplishments

- **The mark map is now a `lib/` leaf.** `git mv` on both module and suite; `git log --follow` reads **7** commits, so the history followed rather than restarting at 1.
- **Zero changed lines inside `MARKS` / `MCP_MARK` / `NEUTRAL_MARK` / `SERVICE_MARKS`** — verified from the rename diff itself, not asserted. `grep -cE "SERVICE_MARKS|MARKS\s*="` reads **5** before and **5** after.
- **`SIZE_CLASS` has four keys and `ConnectionMarkGlyph` has no branch** — the Record was widened and the union was EXPORTED (`ConnectionMarkSize`) so the new element could alias it.
- **`StepIdentity` exists and resolves nothing**, which is the whole of D-214-16's "coverage is a consequence of one component existing".
- **Every fence that matters was seen to fire.** Four defects planted, four RED runs captured, source restored **md5-identical** (`2700ae6f289b9c133651ad0c686e3f8d`).

## Task Commits

1. **Task 1: the move — one module, its importers, and the gate's path knob** — `b89ddb5da` (refactor)
2. **Task 2: the element — mark plus two names, resolved by nobody but the caller** — `cb700cd3f` (feat)

## The `StepIdentity` prop signature, verbatim — plan `214-11` mounts against this

```tsx
export type StepIdentitySize = ConnectionMarkSize   // "row" | "chip" | "canvas" | "spine"

export interface StepIdentityProps {
  shape: ConnectionMarkShape   // { service_id?, capability?, mcp_server_url?, tool_name? }
  action: string               // the tool's HUMAN name — RESOLVED BY THE CALLER
  service: string | null       // the connection's display name — RESOLVED BY THE CALLER
  size: StepIdentitySize
  className?: string
}

export function StepIdentity(props: StepIdentityProps): JSX.Element
```

⚠ **`StepIdentitySize` is an ALIAS of `ConnectionMarkSize`, not a re-declaration.** A fifth size is added in `lib/connectionMark.tsx` and both Records widen together; adding it here alone would not typecheck.

⚠ **`className` is the only optional prop, and it is a passthrough.** Both names are REQUIRED at the type level, asserted at compile time inside the suite (`tsconfig.app.json` includes `src`, so a regression that made either optional fails `tsc`, not merely vitest).

**DOM contract the mounting plan can query:**

| selector | meaning |
|---|---|
| `[data-step-identity]` | the root; carries `data-size` and `data-service-resolved` |
| `[data-step-identity-action]` | the action's own node |
| `[data-step-identity-separator]` | the house middle dot, **its own node** — absent entirely when the service is unresolved |
| `[data-step-identity-service]` | the service's own node |

`rootOf(container).textContent` is **character-for-character** `STEP_IDENTITY({ action, service })` in the two-name arm and `STEP_IDENTITY_SERVICE_UNKNOWN({ action })` in the null arm.

## The `PhaseMark`-alias decision, taken

**KEEP THE LOCAL ALIAS. The two declarations stay deliberately separate.**

The module's own docblock recorded the reason for not importing `lib/phaseGlyph.tsx:66`'s `PhaseMark`: *"`lib/phaseGlyph.tsx` is a `lib/` leaf with other consumers and must not be widened to accommodate a `components/settings/` need."* Moving into `lib/` makes that sentence read oddly, and the temptation is to converge the two types now that they are neighbours.

**They are not converged, because the reason survives the move intact.** `phaseGlyph.tsx` still has other consumers; what changed is this module's LOCATION, not phaseGlyph's consumer set. And the two maps answer different questions — a phase TYPE versus a SERVICE identity — so coupling their component types would couple two things that have no reason to move together. The original sentence is **kept verbatim** in the source rather than rewritten, because its wording is what a `git log -S` search finds; a note beside it records the move and the decision.

## The count-gate numbers, as derived

⚠ **THE FULL GATE WAS NOT RUN, AND THAT IS A DECISION RATHER THAN AN OMISSION.** The wave-2 orchestrator brief forbids it — two sibling executors (`214-07`, `214-09`) were active, and `count gate OK` is not reliably reachable on demand under concurrency (SEED-171). So the figures below are **derived from the gate's own source and from scoped runs**, and `214-15` re-derives them at the phase close.

| | base `e08f4367f` (carry-forward) | after this plan |
|---|---|---|
| pinned files | 119 | **120** |
| pinned total | 5225 | **5266** (`+41`, all of it `StepIdentity.test.tsx`) |
| `connectionMark.test.tsx` pin | 39 | 39 (untouched) |
| `connectionMark.test.tsx` actual | — | **74** (≥ its pin) |
| duplicate `BASELINE` keys | — | **0** |

**`N/N pinned files present` is therefore expected to read `120/120`** — the count is DERIVED by the gate (`pinnedNames.length`), so the line follows the key count rather than a literal. It is an expectation, **not a reading**: no verdict line was printed by this plan.

**Why the move could not silently unpin the suite, checked rather than believed:**

- `TARGETS` holds a **PATH**, does not follow a `git mv`, and was repointed in the same commit. `"src/components/settings/__tests__/connectionMark.test.tsx"` is gone; `"src/lib/__tests__/connectionMark.test.tsx"` is present (both read out of the script by `node`, not by eye).
- ⚠ **`src/lib` has NO directory entry anywhere in `TARGETS`** — the only directory-level entry in the whole array is `src/components/workflows`. Had the line been deleted instead of repointed, the suite would have gone **unrun**, not merely unpinned.
- `BASELINE` keys are **BASENAMES**, matched against the report's file names, so `connectionMark.test.tsx: 39` resolved untouched.
- `StepIdentity.test.tsx` sits under `src/components/workflows`, the one directory entry, so it needed **only** a `BASELINE` key. **Same commit, two files, two different answers** — which is the asymmetry the script's existing blocks describe from the other side.

## Files Created/Modified

- `frontend/src/lib/connectionMark.tsx` — **moved** from `components/settings/`. Header records the move, the relocation-only scope, and the alias decision; `SIZE_CLASS` gains `spine`; `ConnectionMarkSize` exported. **25 changed lines** on the rename (22 insertions / 3 deletions), inside the plan's ≤ 25 cap.
- `frontend/src/lib/__tests__/connectionMark.test.tsx` — **moved**; `../connectionMark` still resolves (same relative depth). Header records why only one of the two gate knobs moved. 74 cases, green.
- `frontend/src/components/settings/ConnectionsTab.tsx` — one import line.
- `frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx` — relative import → `@/lib/connectionMark`.
- `frontend/src/components/workflows/nodePresentation.ts` — one import line. ⚠ **Not in the plan's importer list; see deviations.**
- `frontend/src/components/workflows/StepIdentity.tsx` — **new**, 161 lines.
- `frontend/src/components/workflows/StepIdentity.test.tsx` — **new**, 41 cases.
- `scripts/vitest-count-gate.cjs` — `TARGETS` repointed, `BASELINE` pin added.

## Decisions Made

1. **`spine` is `h-5 w-5` (20px).** Sketch 216's four sizes are 14 / 16 / 20 / 24; the shipped Record was 12 / 16 / 32, leaving exactly one gap. 20px is the sketch's `md` — the size it draws `PhaseCard` and the mark roster at. ⚠ **`canvas` was NOT retuned from 32px down to the sketch's 24px `lg`**: it is the shipped builder-canvas size and re-tuning it is a re-skin, which this plan is not.
2. **The separator is derived, not written.** `STEP_IDENTITY` is composed with two control-codepoint sentinels and the text between them IS the separator. Writing `·` in the component would be a second home for a governed string; the derivation makes the element's own text content provably equal to the governed value.
3. **A blank or whitespace `service` takes the unresolved arm.** The wire ships `null` and never `""`, so this is belt-and-braces — but a name that renders as nothing beside a live separator is the same lie as a fabricated one and is cheaper to prevent than to detect.
4. **No `title` tooltip.** It was drafted and removed: the sketch does not ask for one, and the house has an explicit finding (`ConnectionsTab`'s ledger section) that a tooltip is **not** available as a truncation fix here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's importer census was stale by two — `nodePresentation.ts` also imported the module**

- **Found during:** Task 1
- **Issue:** The plan and PATTERNS §4a both state *"Its ONE current consumer is `ConnectionsTab.tsx:94` … plus two test files. Move cost: one import line."* Measured at HEAD, there were **four** import sites: `ConnectionsTab.tsx:94`, **`frontend/src/components/workflows/nodePresentation.ts:77`** (`ConnectionMarkGlyph` + `type ConnectionMarkShape`, the canvas's `external_action` mark), `__tests__/ConnectionFormPanel.test.tsx:94` (a **relative** `../connectionMark` the move would have broken), and the moving suite itself. `nodePresentation.ts` almost certainly arrived at Phase 209 Item 1, after §4a's census was taken.
- **Why it matters more than a missed line:** this is exactly the failure the orchestrator's brief warned about — *"a move that leaves a shipped importer behind can kill a consumer suite at module scope, visible only as a count-gate DECREASE, never as a failure."* `nodePresentation.ts` is imported by eight suites including `WorkflowCanvas.test.tsx`.
- **Fix:** both non-plan import sites repointed to `@/lib/connectionMark` in the same commit.
- **Verification:** `grep -rn "components/settings/connectionMark" frontend/src scripts` → **0**. `PhaseNode.test.tsx` + `PhaseNodeCard.test.tsx` + `canvasModel.test.ts` + `ConnectionFormPanel.test.tsx` → **409 passed**.
- **Committed in:** `b89ddb5da`

**2. [Rule 1 - Bug] The 187-24 trap fired twice, on my own prose, in the turn it was authored**

- **Found during:** Task 1, then Task 2
- **Issue:** (a) The new header sentence *"It was `components/settings/connectionMark.tsx` …"* spelled the **exact string** the plan's acceptance criterion greps to zero — `wc -l` read **1**, not 0, and the only hit was the docblock forbidding it. (b) `StepIdentity.tsx`'s docblock names `if (size` and `size ===` in the sentence that forbids them, which a bare `toContain` fence would have read.
- **Fix:** (a) the sentence now anchors on the DIRECTORY (`components/settings/`) and says out loud why it does not spell the path. (b) the fence runs over **comment-stripped** source, with a positive control asserting the stripper both removed ≥ 1000 characters and left `export function StepIdentity` behind — because a stripper that ate the file would make the fence vacuous, and one that removed nothing would mean it never met the trap.
- **Verification:** `grep -rn "components/settings/connectionMark" frontend/src scripts | wc -l` → **0**; the `size` fence driven RED by planting `data-size={size === "chip" ? "chip" : size}`.
- **Committed in:** `b89ddb5da`, `cb700cd3f`

**3. [Rule 1 - Bug] The plan's `#7` wording is factually wrong about SMTP, and the suite asserts the true property instead**

- **Found during:** Task 2
- **Issue:** The plan asks for *"a vendorless shape (SMTP) and an **unmapped** service (ClickUp) both resolve to the **neutral mark**"*. Measured: `connectionMark({service_id:"smtp"}).key === "smtp"` (its **own** named entry, the lucide mail glyph) while `connectionMark({service_id:"clickup"}).key === "unknown"` (the `Plug` neutral). They do **not** resolve to the same entry, and a test asserting they did would have been wrong-and-green only if the map were broken.
- **Fix:** the case asserts the property the two actually share and that D-214-17 actually claims — **both are drawn in the interface's own ink** (`ink === "stroke"`, lucide), **neither borrows a vendor mark**, ClickUp's body is non-empty and differs from Slack's / Jira's / Intercom's, and SMTP's body differs from ClickUp's. The correction is recorded inline in the test rather than silently applied.
- **Verification:** the four assertions pass; a positive control (`slack` → key `slack`, ink `self`) keeps the block from being satisfied by a resolver that answered neutral to everything.
- **Committed in:** `cb700cd3f`

**4. [Rule 3 - Blocking] Three source files were written with mixed line endings and normalised to CRLF**

- **Found during:** Task 1
- **Issue:** `git add` warned *"LF will be replaced by CRLF"* on `connectionMark.tsx` — an edit script had inserted bare-LF lines into a CRLF file (3 of them). Files check out CRLF on this box; the orchestrator's brief flags this class of defect for fences, and it is equally a diff-noise hazard.
- **Fix:** all three touched files normalised to CRLF and re-verified (`bare LF = 0` on each).
- **Committed in:** `b89ddb5da`, `cb700cd3f`

### Scope reductions

**5. The first draft of the module header measured 48 changed lines against a ≤ 25 cap.** The acceptance criterion is a real bar and was met rather than argued with: the header compressed from 22 comment lines to 9, the alias note from 7 to 4, and the `SIZE_CLASS` comment from 6 to 2. **Final: 22 insertions / 3 deletions = 25.** Every decision the plan asked to be recorded is still recorded; the paragraphs are gone, the verdicts are not. One header line (a pointer to the alias decision) was dropped as a duplicate of the four-line note at the declaration itself.

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug) + 1 scope reduction
**Impact on plan:** No scope creep. Deviation 1 is the plan's stated failure mode caught before it could land; deviation 3 corrects a factual claim in the plan rather than encoding it.

## Verification

| check | result |
|---|---|
| `grep -rn "components/settings/connectionMark" frontend/src scripts \| wc -l` | **0** |
| `git log --follow --oneline -- frontend/src/lib/connectionMark.tsx \| wc -l` | **7** (≥ 6 — history followed) |
| rename size (`git diff -M --stat`) | **25 changed lines** (22 +, 3 −) — within the ≤ 25 cap |
| changed lines inside the four map literals | **0** |
| `grep -cE "SERVICE_MARKS\|MARKS\s*="` before / after | **5 / 5** |
| `SIZE_CLASS` keys | **4**; `ConnectionMarkGlyph` body has no `if`, no ternary on `size` |
| `grep -c "Unknown service" StepIdentity.tsx` | **0** |
| `npx eslint StepIdentity.tsx StepIdentity.test.tsx` | **clean** — 0 errors, incl. `react-refresh/only-export-components` |
| `npx tsc --noEmit -p tsconfig.app.json` | **34 errors** — held exactly at the carry-forward baseline |
| scoped vitest (6 suites, `GSD_VITEST_MAX_WORKERS=2`) | **464 passed, 0 failed** |
| `StepIdentity.test.tsx` alone | **41 passed** (4 invocations, identical) |
| `connectionMark.test.tsx` alone | **74 passed** (pin 39) |
| `node --check scripts/vitest-count-gate.cjs` | **OK**; 120 pinned keys, 0 duplicates |

**Suites run:** `lib/__tests__/connectionMark.test.tsx`, `workflows/StepIdentity.test.tsx`, `settings/__tests__/ConnectionsTab.test.tsx`, `settings/__tests__/ConnectionFormPanel.test.tsx`, `workflows/PhaseNode.test.tsx`, `workflows/PhaseNodeCard.test.tsx`, `workflows/canvasModel.test.ts`.
**Nothing red appeared at any point**, so SEED-171's triage procedure was never entered and the worker cap was never touched. Recorded as an observation, not as proof of innocence.

### RED drives — four planted defects, each fence observed failing

Source backed up, defect planted, suite run, source restored; final md5 `2700ae6f289b9c133651ad0c686e3f8d` identical to the pre-drive capture.

| # | planted defect | fences that went RED |
|---|---|---|
| 1 | `data-size={size === "chip" ? "chip" : size}` | **1** — *the source contains NO branch on `size`* (proves the comment-stripped fence is not vacuous) |
| 2 | the null arm renders `"Unknown service"` | **5** — the composed-value case, the substitute-string sweep, the source grep, the separator-count case, and the blank-service case |
| 3 | the separator span loses its `data-` attribute | **2** — *appears EXACTLY ONCE* and the U+00B7 case |
| 4 | `data-capability={shape.capability ?? ""}` added to the root | **3** — the `post_message` sweep, the substitute-string sweep, and the exact `data-` attribute list |

## Issues Encountered

- **`git merge-base` did not match the dispatched base.** The worktree forked from `f7cfa4a5`, not `e08f4367f`. Corrected with the sanctioned `git reset --hard` inside the startup branch check, and HEAD verified at `e08f4367f` before any work.
- **`bash scripts/bootstrap-worktree.sh "$(pwd)"` was refused by the harness** as too complex to path-verify. Re-run with the worktree root spelled literally; `BOOTSTRAP OK`, junctions and env copies in place.

## Known Stubs

None. `StepIdentity` has no unwired data source — it is a leaf that renders its props, and plan `214-11` is where it acquires callers. That is the plan's declared shape, not a stub.

## Threat Flags

None. No new network endpoint, auth path, file access or schema surface. The two shapes the threat register names are both mitigated and both asserted: an unmapped `service_id` takes the named neutral (T-214-08-01), and a display name is rendered as React text with `dangerouslySetInnerHTML` absent from the source and an injection string proven to render as text (T-214-08-02).

## Next Phase Readiness

**`214-11` can mount this on all five surfaces.** The props contract above is final and the DOM contract is queryable. Two things that plan must supply per surface:

1. **The `action` string.** `WorkflowRunPage` already holds `titleOf` (`nodeTitle(spec)`); `PhaseCard` / `PhaseTimeline` have **none** and read `Phase` from `StreamsProvider` — that asymmetry is why the element takes props, and it is `214-11`'s to resolve on each side.
2. **The `service` string**, from the connection row — never from `config.capability`, which is the tautology sketch 216 §3 exists to close. `null` is legitimate and renders honestly.

**Owed at the phase close (`214-15`):**
- A real `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` run from the repo root. The `120/120` above is derived, not read.
- The hot-file ledger re-key: `frontend/src/components/settings/connectionMark.tsx` **moves** to `frontend/src/lib/connectionMark.tsx` (row **and** `docs/HOT-FILE-LEDGER.md` section, same commit — a row whose path no longer exists is invisible to the audit scan). Its cell reads `4 / 2 / 217`; re-derive it, and note the move IS the G-5 seam, taken here. `StepIdentity.tsx` owes a young row.

---
*Phase: 214-a-step-names-its-service-and-its-action*
*Plan: 08*
*Completed: 2026-08-28*

## Self-Check: PASSED

All four created/moved source files exist on disk; both task commits (`b89ddb5da`, `cb700cd3f`) resolve in `git log`.
