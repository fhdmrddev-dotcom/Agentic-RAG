---
phase: 214-a-step-names-its-service-and-its-action
plan: 03
subsystem: workflows-authoring-vocabulary
tags: [vocabulary, governed-copy, contract-bound, leaf-module, sketch-214, sketch-215, sketch-216, sketch-217]
requires: []
provides:
  - "frontend/src/components/workflows/argumentVocabulary.ts — sketch 214 §1's 20 flat + 5 composed"
  - "frontend/src/components/workflows/publishRefusalVocabulary.ts — sketch 215 §1's 11 flat + 7 composed, plus the TS declaring home of ArgumentGapKind and two Record pairings"
  - "frontend/src/components/workflows/stepIdentityVocabulary.ts — sketch 216 §1's 8 flat + 5 composed"
  - "frontend/src/components/workflows/doorVocabulary.ts — sketch 217 §1's 9 new flat + 3 aliases + 3 composed, as ADDITIONS"
affects:
  - "214-05 (imports REFUSAL_FOR_KIND / REFUSAL_NEXT_FOR_KIND)"
  - "214-07 (imports argumentVocabulary; owns the MCP_TOOL_ARGS_LABEL deletion this plan's sweep is waiting for)"
  - "214-10 (imports publishRefusalVocabulary + ArgumentGapKind)"
  - "214-11 (imports stepIdentityVocabulary; narrows FAILED_REASON_UNKNOWN's condition, never its words)"
  - "214-13 (imports the doorVocabulary additions; owns the WorkflowDoorSwitch.baseline.test.tsx re-baseline this plan's colour ruling forces)"
  - "214-14 (S-4 parses ArgumentGapKind out of publishRefusalVocabulary.ts)"
  - "214-15 (pins the three new BASELINE entries + re-derives four hot-file ledger rows)"
tech-stack:
  added: []
  patterns:
    - "governed vocabulary leaf, zero imports, character-asserted (doorVocabulary.ts habit)"
    - "generated BUILD-CONTRACT re-parsed at test time and compared to the suite's own literal table"
    - "composed ids are functions taking ONE named-field object, never positional parameters"
    - "forbidden needles assembled at runtime (the 187-24 trap remedy)"
    - "declared-exemption list that asserts each exemption STILL offends, so it self-retires"
key-files:
  created:
    - frontend/src/components/workflows/argumentVocabulary.ts
    - frontend/src/components/workflows/publishRefusalVocabulary.ts
    - frontend/src/components/workflows/stepIdentityVocabulary.ts
    - frontend/src/components/workflows/argumentVocabulary.test.ts
    - frontend/src/components/workflows/publishRefusalVocabulary.test.ts
    - frontend/src/components/workflows/stepIdentityVocabulary.test.ts
  modified:
    - frontend/src/components/workflows/doorVocabulary.ts
    - frontend/src/components/workflows/doorVocabulary.test.ts
decisions:
  - "ArgumentGapKind is DECLARED in publishRefusalVocabulary.ts and imported from nowhere — all three new modules stay zero-import leaves with no exception"
  - "REFUSAL_FOR_KIND's value type is (facts: ArgumentGapFacts) => string with all three fact fields REQUIRED; shape_unknown provably drops arg and upstream, proved by a driven case rather than by a type"
  - "the door's refusal tone token unifies on WARNING for BOTH arms — one mechanism must not read as two severities (214-13 owns the baseline re-capture)"
  - "the raw-HTML fence anchors on the `=` of the prop assignment, not the bare identifier — measured: eight workflow files name it in a docblock PROMISING never to use it"
  - "the escape-hatch sweep declares McpToolPicker.tsx as its one offender and asserts it still offends, so 214-07's deletion reds the exemption instead of leaving a fiction"
metrics:
  duration: ~55 min
  completed: 2026-08-28
  tasks: 3
  commits: 3
  files: 8
---

# Phase 214 Plan 03: The Contracts-First Vocabulary Wave — Summary

Four governed vocabulary modules whose every sentence is bound to the generated sketch
BUILD-CONTRACT it came from, by re-parsing that contract at test time — plus the TypeScript
declaring home of `ArgumentGapKind`, so plan `214-14`'s cross-language check compares two
real lists rather than a list against a copy of itself.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `45980546d` | the three new leaf modules |
| 2 | `42f5619e4` | the door's second arm — sketch 217's twelve ids as additions |
| 3 | `e922cba20` | four suites that falsify their tables and re-parse their contracts |

## The exported identifier surface (what 214-05 / 07 / 10 / 11 / 13 import)

### `argumentVocabulary.ts` — 20 flat + 5 composed, **zero imports**

Flat: `ARG_SOURCE_FIXED` · `ARG_SOURCE_ASK` · `ARG_SOURCE_UPSTREAM` · `ARG_SOURCE_GROUP_LABEL` ·
`ARG_READING_FIXED` · `ARG_NO_SOURCE` · `ARG_REQUIRED_MARK` · `ARG_OPTIONAL_MARK` ·
`ARG_PRESET_NOTE` · `ARG_UNRENDERABLE_REQUIRED` · `ARG_UNRENDERABLE_OPTIONAL` ·
`ARG_SCHEMA_UNKNOWN` · `ARG_SCHEMA_UNKNOWN_NEXT` · `ARG_LEFTOVER_NEXT` · `ARG_SECTION_HEADING` ·
`ARG_UPSTREAM_PICK_LABEL` · `ARG_UPSTREAM_NONE_OPTION` · `ARG_UPSTREAM_EMPTY` ·
`ARG_ASK_KEY_LABEL` · `ARG_ASK_KEY_HINT`

Composed — **every one takes ONE object with named fields**:

| id | signature |
|---|---|
| `ARG_READING_ASK` | `({ key }: { key: string }) => string` |
| `ARG_READING_UPSTREAM` | `({ step }: { step: string }) => string` |
| `ARG_UNRENDERABLE` | `({ arg }: { arg: string }) => string` |
| `ARG_LEFTOVER` | `({ arg }: { arg: string }) => string` |
| `ARG_STEP_IDENTITY` | `({ action, service }: { action: string; service: string }) => string` |

### `publishRefusalVocabulary.ts` — 11 flat + 7 composed + 2 maps + 2 types, **zero imports**

```ts
export type ArgumentGapKind =
  | "no_source" | "ask_undeclared" | "upstream_unreachable" | "shape_unknown" | "unrenderable"

export type ArgumentGapFacts = {
  readonly step: string      // the author's own name for the step, never a slug
  readonly arg: string       // ignored by shape_unknown, by construction
  readonly upstream: string  // used only by upstream_unreachable
}
```

Flat: `REFUSE_NEXT` · `REFUSE_NEXT_REDISCOVER` · `REFUSE_TITLE` · `REFUSE_COUNT_ONE` ·
`STAGE_STRUCTURE` · `STAGE_STRUCTURE_WHAT` · `STAGE_PASSED` · `STAGE_BLOCKED` ·
`STAGE_NOT_REACHED` · `GOLDEN_NO_SEND` · `ALREADY_PUBLISHED_NOTE`

| id | signature |
|---|---|
| `REFUSE_NO_SOURCE` | `({ arg, step }) => string` |
| `REFUSE_ASK_UNDECLARED` | `({ step, arg }) => string` |
| `REFUSE_UPSTREAM_UNREACHABLE` | `({ step, arg, upstream }) => string` |
| `REFUSE_SHAPE_UNKNOWN` | `({ step }) => string` — **takes no `arg`** |
| `REFUSE_UNRENDERABLE` | `({ arg, step }) => string` |
| `REFUSE_COUNT_MANY` | `({ count }: { count: number }) => string` |
| `REFUSE_REST_OK` | `({ count }: { count: number }) => string` |

```ts
export const REFUSAL_FOR_KIND: Record<ArgumentGapKind, (facts: ArgumentGapFacts) => string>
export const REFUSAL_NEXT_FOR_KIND: Record<ArgumentGapKind, string>
```

### `stepIdentityVocabulary.ts` — 8 flat + 5 composed, **zero imports**

Flat: `FAILED_REASON_LABEL` · `FAILED_REASON_UNKNOWN` · `ASK_PAUSED` · `ASK_NOTHING_SENT` ·
`ASK_WILL_SEND` · `ASK_APPROVE` · `ASK_DECLINE` · `ASK_NOT_RECORDED`

| id | signature |
|---|---|
| `STEP_IDENTITY` | `({ action, service }) => string` |
| `STEP_IDENTITY_SERVICE_UNKNOWN` | `({ action }) => string` |
| `ASK_WILL_RUN` | `({ action, service }) => string` |
| `RECEIPT_SENT` | `({ action, service }) => string` |
| `RECEIPT_REFUSED` | `({ action, service }) => string` |

### `doorVocabulary.ts` — **additions**, 9 new flat + 3 aliases + 3 composed

New: `SERVICES_LABEL` · `SERVICES_HINT` · `SERVICE_NO_GRANTS` · `SERVICE_NO_GRANTS_NEXT` ·
`SERVICES_EMPTY` · `SERVICES_EMPTY_NEXT` · `DOOR_REFUSAL_REVISE` · `DOOR_CTA_REFUSED_SERVICE` ·
`DOOR_REFUSAL_ANCHOR`

Aliases (⚠ **not second literals** — `= DESCRIBE_CTA`, `= DESCRIBE_CTA_REFUSED`,
`= DESCRIBE_REFUSAL`): `SHIPPED_DESCRIBE_CTA` · `SHIPPED_DESCRIBE_CTA_REFUSED` ·
`SHIPPED_DESCRIBE_REFUSAL`

| id | signature |
|---|---|
| `SERVICE_ACTIONS` | `({ service }) => string` |
| `DOOR_REFUSAL` | `({ service }) => string` |
| `DOOR_REFUSAL_CONNECT` | `({ service }) => string` |

The module's string export count rose **24 → 36**, and it gained its first three
function-valued exports.

## ⚠ The BASELINE figures for plan 214-15 — and their PROVENANCE, which is not the gate

**The gate was NOT run, deliberately.** The orchestrator's dispatch instruction for this
worktree is explicit: *"Do NOT run the full `scripts/vitest-count-gate.cjs` — the orchestrator
owns that at the post-merge gate"*, and three sibling agents were active. CLAUDE.md's own
measurement is that at three concurrent test-running agents the gate goes non-deterministic
regardless of cap, so a figure read here would have been worth less than one read at the merge.

The figures below are therefore from **scoped `GSD_VITEST_MAX_WORKERS=2 npx vitest run <path>`
invocations**, which count the same thing a `BASELINE` pin does — a file's test-case count.
Every one was read from vitest's own `Tests N passed` line, and the four agree with the
combined run (`44 + 41 + 34 + 60 = 179`).

| file | figure | status |
|---|---|---|
| `argumentVocabulary.test.ts` | **44** | NEW — needs a `BASELINE` pin in `214-15` |
| `publishRefusalVocabulary.test.ts` | **41** | NEW — needs a `BASELINE` pin in `214-15` |
| `stepIdentityVocabulary.test.ts` | **34** | NEW — needs a `BASELINE` pin in `214-15` |
| `doorVocabulary.test.ts` | **60** | EXISTING pin reads `41` (`vitest-count-gate.cjs:850`) → **+19**, needs re-pinning |

⚠ `214-15` should re-read these from the gate's own printed `— N new` column at merge and
prefer that reading to this table if the two disagree. **These are not hand-derived numbers,
but they are not the gate's own output either, and that difference is the thing to check.**

⚠ This plan **did not edit `scripts/vitest-count-gate.cjs`**, as instructed — a `BASELINE` key
naming a path that does not yet exist makes the gate ERROR, and distributing pins across
parallel worktrees is exactly what would create that. All three new suites live under
`src/components/workflows`, already a **directory** entry in `TARGETS`, so they RUN the moment
they exist.

## Verification

| check | result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | **34 errors** — the measured baseline, unchanged across all three tasks |
| four suites, scoped, cap 2 | **179 passed, 0 failed, 4 files** |
| `grep -c "^import"` × 3 new modules | **0** each — the zero-import leaf claim, including `publishRefusalVocabulary.ts` |
| `grep -c "export type ArgumentGapKind"` | **1**, with all five literals in the declaration |
| sentinel byte-identity | `diff` of the extracted sentence in `stepIdentityVocabulary.ts` vs `PhaseCard.tsx` — **identical** |
| `grep -riEc` forbidden words in `argumentVocabulary.ts` | **0** |
| `grep -c "There is nothing here to draft from yet"` in `doorVocabulary.ts` | **1** — the alias did not duplicate the literal |
| `grep -lc "BUILD-CONTRACT"` across the four suites | **4/4** |
| `grep -c "toContain("` in `argumentVocabulary.test.ts` | **0** |
| `grep -c "MCP_TOOL_ARGS_LABEL"` in `argumentVocabulary.test.ts` | **0** — assembled at runtime |
| non-vacuity control position | `> 200` at line 480, absence assertions at 512 — **control first** |

## ⚠ Measured surprises

### 1. A bare-identifier raw-HTML sweep reds on EIGHT files, and every one is a PROMISE

The threat model asked for *"a `?raw` fence asserting `dangerouslySetInnerHTML` appears zero
times under `src/components/workflows`"*. Driven as written it returned **eight offenders** —
`PhaseNode.tsx` · `PhaseNodeCard.tsx` · `PhaseSpine.tsx` · `TemplateAttachSection.tsx` ·
`WorkflowCanvas.tsx` · `WorkflowDoorSwitch.tsx` · `WorkflowSoul.tsx` · `doorVocabulary.ts`
itself.

**Not one of them uses it.** Every hit is a docblock saying some version of *"NEVER
`dangerouslySetInnerHTML`"* (`WorkflowDoorSwitch.tsx:36`, `PhaseNode.tsx:66`,
`WorkflowSoul.tsx:24`, and this plan's own new section). That is the **187-24 trap seen from
the other side**: the trap normally makes a fence count its own prose and pass; here it made a
fence count a PROMISE and fail. The remedy is the same shipped one — anchor on the `=` of the
prop assignment (`PhaseNodeCard.test.tsx:525` already does). Measured with that anchor:
**zero non-test offenders**, and the door's own render site is asserted to be in the swept set
so the zero is not vacuous.

### 2. Three `as Record<string, string>` casts stopped typechecking (Rule 3 auto-fix)

Adding function-valued exports to `doorVocabulary.ts` broke `doorVocabulary.test.ts`'s three
namespace casts with `TS2352` — the namespace type and `Record<string, string>` no longer
overlap. tsc went 34 → 37. Widened via `unknown` in Task 2's own commit, back to **34**. This
is a blocking issue caused directly by the task's change, so it was fixed inline (Rule 3)
rather than deferred to Task 3, which would have left one commit above baseline.

### 3. The `.planning/sketches/` `?raw` import WORKS — and the residual is named, not fixed

`doorVocabulary.test.ts` records (193 review WR-08) that reaching into `.planning/` from a
frontend suite was removed once already, and the remedy was a generator writing an in-package
copy. Sketches 214–217 have **no such generator**, and this plan's `key_links` name the
`.planning/` path explicitly, so the import was made there and driven: **it resolves and all
four contract cases pass.** The precedent for reaching out of the package is itself shipped
and green (`ExternalActionSection.test.tsx:59` reads a backend `.py` the same way).

⚠ **The archival hazard is real and is recorded rather than claimed fixed.** Each of the four
suites carries a named **re-open trigger: the first milestone close that archives
`.planning/sketches/<n>-…/`**, with the fix stated (emit an in-package copy beside the module,
never weaken the case). Naming it is the honest half; a future milestone close is the half
this plan cannot do.

## Deviations from Plan

### `[Rule 2 - Missing critical pairing] REFUSAL_NEXT_FOR_KIND added`

- **Found during:** Task 1
- **Issue:** The plan specifies `REFUSE_NEXT_REDISCOVER` as a flat id and `REFUSAL_FOR_KIND` as
  the sentence pairing — but nothing pairs the **next action** to a kind. Sketch 215's table
  makes `shape_unknown` the only kind whose fix is re-discovery rather than an edit. Left
  unpaired, plan `214-10` would have re-derived that with a conditional a sixth kind falls out
  of, which is the exact failure `REFUSAL_FOR_KIND` exists to prevent one field over.
- **Fix:** `export const REFUSAL_NEXT_FOR_KIND: Record<ArgumentGapKind, string>`, keyed by the
  same union so a sixth kind is a compile error here too.
- **Files modified:** `publishRefusalVocabulary.ts`
- **Commit:** `45980546d`
- ⚠ **This ADDS to the identifier surface the plan declared.** It is additive and safe, but
  `214-05` / `214-10` should know it exists rather than re-deriving the mapping.

### `[Rule 3 - Blocking] doorVocabulary.test.ts namespace casts widened`

See *Measured surprises* §2. Files: `doorVocabulary.test.ts`. Commit: `42f5619e4`.

### `[Plan-directed, narrowed] the raw-HTML fence anchors on the assignment`

The threat model's literal wording (`appears zero times`) is refuted by measurement — see
*Measured surprises* §1. The fence shipped is the shipped-precedent form. **The mitigation
T-214-03-01 asks for is delivered in full**: the escaped-literal round trip IS asserted (a
`<img onerror>`-shaped service name comes back as the literal characters), and the subtree
sweep IS tree-wide with a non-vacuity control. Only the needle changed.

## Threat register dispositions

| Threat ID | Disposition | How |
|---|---|---|
| T-214-03-01 | **mitigated** | `DOOR_REFUSAL` driven with `<img src=x onerror="alert(1)">`; return type asserted `string` and the value asserted byte-equal to the escaped literal. Tree-wide `?raw` sweep for the raw-HTML PROP assignment under `src/components/workflows` → 0 non-test offenders, non-vacuity control first. Plan `214-13` still owns the catalog whole-word cap. |
| T-214-03-02 | **mitigated** | Whole-table property over every FLAT value **and every COMPOSED value RENDERED**, in all four suites: no `send_email` / `create_ticket` / `post_message` / `ask_question` / `external_action`, and no id-shaped `\b[a-z0-9]+_[a-z0-9_]+\b` token. Needles assembled at runtime. |
| T-214-03-03 | **mitigated** | The contract re-parse case in every one of the four suites, each with a non-vacuity floor and a parser POSITIVE CONTROL. Without it the "generated contract" is decoration. |
| T-214-03-04 | **mitigated** | Tree-wide `?raw` sweep with runtime-assembled needles and the `> 200` control asserted FIRST, plus a self-retiring `DECLARED_OFFENDERS` list. |
| T-214-03-SC | **mitigated** | Nothing was installed. All four modules are string tables; `package.json` is untouched. |

## Known Stubs

None. Every export in all four modules carries its contract value; nothing is a placeholder
awaiting a later plan.

⚠ One **deliberate bridge**, which is not a stub but must not be forgotten:
`argumentVocabulary.test.ts`'s `DECLARED_OFFENDERS` list carries
`/src/components/workflows/McpToolPicker.tsx`, because that module still exports the label
sketch 214 #1 forbids. **Plan `214-07` owns its deletion.** The list is self-retiring: a case
asserts each declared offender STILL carries the identifier, so when `214-07` lands the
exemption reds and forces its own removal rather than surviving as a fiction.

## What this plan did NOT do

- **No `scripts/vitest-count-gate.cjs` edit** — `214-15` owns every pin for this phase, in one
  commit, once every new file exists.
- **No hot-file ledger row** — `214-15` owns the four rows (`doorVocabulary.ts` re-derive plus
  three new young rows) and their `docs/HOT-FILE-LEDGER.md` sections, under the same-commit
  sync rule.
- **No render site touched.** `WorkflowDoorSwitch.tsx`, `PhaseFormPanel.tsx`,
  `McpToolPicker.tsx` and `PhaseCard.tsx` are byte-unchanged; the colour ruling is STATED in
  `doorVocabulary.ts` and IMPLEMENTED by `214-13`, which also owns the
  `WorkflowDoorSwitch.baseline.test.tsx` re-baseline it forces.
- **No `STATE.md` / `ROADMAP.md` write** — the orchestrator owns those after the wave.

## G-5 disposition

`doorVocabulary.ts` fires G-5 (the plan re-derived `5 / 3 / 364` against a ledger row reading
`4 / 3 / 341` — **stale**). **No seam is proposed, and that is the argued verdict**: this module
is a vocabulary, a table doing one thing many times, and splitting a governed string table by
topic would create two homes for the property *"every sentence in this surface's vocabulary
obeys these five rules"* — which is exactly what `doorVocabulary.test.ts`'s whole-table
assertions rest on. Same verdict the ledger already carries for `connectionsCopy.ts` and
`connectionFormCopy.ts`, on identical reasoning. The row and its detail section are synced in
`214-15`.

The three new modules are young (0 phases). `214-15` adds their rows so they are never
invisible to G-5 the way `libraryFilter.ts` was for four phases and `ChatLayout.tsx` for
twenty-one.

## Self-Check: PASSED

All eight files present on disk; all three commits resolve in `git log`.
