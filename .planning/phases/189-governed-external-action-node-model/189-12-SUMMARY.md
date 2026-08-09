---
phase: 189
plan: 12
subsystem: frontend-canvas-definition-ops
tags: [wave-5, compiler-forced, silent-count-debt, derived-not-repinned, cross-language-fence, falsification-plants, prose-correction]
requires:
  - "189-07 — ExternalActionPhaseConfig, the 7th PhaseConfig union member (the thing this plan mirrors)"
  - "189-10 — the derive-don't-re-pin lesson (five literal 7s replaced by ALL_READINGS.length)"
  - "frontend/src/components/workflows/definitionOps.ts — PhaseTypeId / PHASE_TYPE_ORDER / SLUG_BASE / requiredConfigFor (184)"
  - "scripts/vitest-count-gate.cjs — both changed suites were already in TARGETS; only BASELINE moved"
provides:
  - "PhaseTypeId's 7th member — external_action, APPENDED LAST"
  - "PHASE_TYPE_ORDER's 7th entry — so the step-type picker actually offers it (SC#1)"
  - "SLUG_BASE.external_action = `act` (TYPECHECK-FORCED site 1)"
  - "requiredConfigFor's external_action arm, returning `capability` ONLY (TYPECHECK-FORCED site 2)"
  - "the D-23 CROSS-LANGUAGE agreement fence — the client mirror asserted equal to the backend union, read from harness.py through ?raw"
  - "12 hard-coded count assertions DERIVED from PHASE_TYPE_ORDER.length rather than re-pinned at 7"
  - "two FALSIFIABLE placeholder pins that go RED the day 189-13 and 189-14 land their vocabulary"
affects:
  - "189-13 (the ExternalActionSection picker + the outbox-tray mark + the ICON_TINT pin — TYPES_AWAITING_A_3D_MARK is its tripwire)"
  - "189-14 (PHASE_TYPE_SENTENCES / _SUBTITLES / _LABELS + the capability sentences — TYPES_AWAITING_A_VOCABULARY_ENTRY is its tripwire)"
  - "the tree's tsc baseline: 33 → 37 → 33. Nothing is left armed for a later plan."
tech-stack:
  added: []
  patterns:
    - "the cross-language ?raw source fence, frontend→backend (PublishGauntlet.test.tsx:46's shipped idiom, applied to harness.py)"
    - "counts DERIVED from the order tuple, so the NEXT phase type inherits every guard without a pin being remembered"
    - "a FALSIFIABLE exclusion list: the case that excludes a type also asserts the entry is genuinely missing, so the owing plan's arrival is a RED test"
    - "three wrong fixes planted into production source, each observed RED, restored by md5"
decisions:
  - "SLUG_BASE is `act`, not `send`. The base token is keyed by PHASE TYPE — ONE token for all three capabilities — so `send-` would be false on a create_ticket or post_message step (the same argument UI-SPEC §5a used to reject an envelope glyph). It also claims no send, in a phase whose entire point is that nothing is sent (D-05/D-16), and it echoes the type's own shipped subtitle verb (\"…before it acts outside\")."
  - "⚠ requiredConfigFor emits a REAL capability (`send_email`), not the empty-string placeholder the other six arms use. `prompt`/`fn` are plain `str`, so an empty one PARSES and only the server decides whether it publishes; `capability` is a closed Literal of exactly three (D-15), so `\"\"` is a ValidationError that 422s the WHOLE definition on the first save — the step would be placeable and then unstorable, falsifying SC#1 in the same breath as satisfying it. See Deviations #1 for the UI-SPEC §7b tension this creates and who owns it."
  - "The D-23 fence was built HERE for the PHASE-TYPE mirror rather than deferred whole to 189-14. The plan assigns the CAPABILITY mirror's fence to 189-14 and this plan owns no capability constant — but it does own the union mirror T-189-36 names, whose only planned mitigation was a docblock. `EXTERNAL_CAPABILITY_SENTENCES` was deliberately NOT created here, so 189-14 still has exactly one home to create."
  - "Tasks 1 and 2 landed in ONE commit. Task 2's own <action> says 'in the SAME COMMIT as Task 1', and it has to: the 7th type turns five suites red the instant it lands, so a split would leave HEAD red between the two commits."
  - "phaseVocabulary.corpus.test.ts is in files_modified and needed NO edit — measured, not assumed. Its RAW_PHASE_TYPE_TOKENS is Object.keys(PHASE_TYPE_SENTENCES), which 189-14 owns; it stays at 6 until then. Editing a file to satisfy a manifest, with no defect to fix, is 189-10 Deviation #3's shape."
metrics:
  duration: "~95 min"
  completed: 2026-08-07
  tasks: 2
  commits: 1
  files_created: 0
  files_modified: 7
  tests_added: 14
---

# Phase 189 Plan 12: The Seventh Type Is Placeable Summary

**A user can now place a governed external-action node: the picker offers seven choices with
the shipped six unmoved, and the bookkeeping debt that arrives with a 7th `phase_type` was
paid in the same commit rather than discovered later.** The compiler-forced sites were
measured forcing (`tsc` 33 → 37 → 33), the client mirror is now fenced against
`harness.py` MECHANICALLY rather than by docblock, and three wrong fixes were planted into
production source and each observed RED.

## The commit

| SHA | Scope |
|---|---|
| `dcfdfb38` | Tasks 1 + 2 — the four `definitionOps` edits, the D-23 fence, 19 assertion sites across 5 suites, both gate pins |

```
$ git show --stat dcfdfb38
 frontend/src/components/workflows/PhaseFormPanel.rails.test.tsx |  16 +-
 frontend/src/components/workflows/PhaseFormPanel.test.tsx       |  17 +-
 frontend/src/components/workflows/StepTypePicker.test.tsx       | 141 +++++++-
 frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx| 15 +-
 frontend/src/components/workflows/definitionOps.test.ts         | 233 +++++++++++++-
 frontend/src/components/workflows/definitionOps.ts              |  98 ++++++-
 scripts/vitest-count-gate.cjs                                   |  24 +-
 7 files changed, 495 insertions(+), 49 deletions(-)

$ git diff --diff-filter=D --name-only dcfdfb38~1..dcfdfb38   →  (empty; no deletions)
```

**Why ONE commit and not two.** Task 2's `<action>` says the six-count assertions move *"in
the SAME COMMIT as Task 1"*, and that is not a preference: the 7th type reds five suites the
instant it lands, so committing Task 1 alone would leave HEAD with failing tests until Task
2. Task 1's own acceptance (*"`git show --stat` for it lists BOTH `definitionOps.test.ts`
and `scripts/vitest-count-gate.cjs`"*) is satisfied by the combined commit.

---

## ⚠ THE FORCING, MEASURED IN THREE STEPS

The plan asked for the count BEFORE the two forced edits, as proof the compiler forced them.

| Point | `npx tsc --noEmit -p tsconfig.app.json` |
|---|---|
| HEAD, before any edit | **33** — the inherited baseline, CONFIRMED |
| After the two SILENT edits only (`PhaseTypeId` + `PHASE_TYPE_ORDER`) | **37** |
| After filling both source-side forced sites | **34** |
| After the test-side forced table | **33 — THE BASELINE** |

**The four errors the widening raised, verbatim, each a real forced site:**

| # | Error | Site | Forced? |
|---|---|---|---|
| 1 | `TS1360` *does not satisfy `Record<PhaseTypeId, string>`* | `definitionOps.ts:867` `SLUG_BASE` | ✅ the plan's forced site 1 |
| 2 | `TS7053` *expression of type `PhaseTypeId` can't be used to index …* | `definitionOps.ts:881` `slugForType`'s `SLUG_BASE[type]` | ✅ **a KNOCK-ON no document lists** — it closes with #1 |
| 3 | `TS2322` *Type `"external_action"` is not assignable to type `never`* | `definitionOps.ts:918` `requiredConfigFor`'s guard | ✅ the plan's forced site 2 |
| 4 | `TS2741` *Property `external_action` is missing … in `Record<PhaseTypeId, string[]>`* | `definitionOps.test.ts:1590` `REQUIRED_CONFIG_KEYS` | ✅ forced, in a TEST file |

⚠ **`PHASE_TYPE_ORDER` raised NOTHING, exactly as predicted** — `satisfies` admits a subset,
so omitting the 7th would have compiled cleanly and the picker would simply never have
offered the type. That asymmetry was the plan's named execution risk and it is real.

---

## The corrected backend pointer — old and new

| | Pointer |
|---|---|
| **OLD** (shipped since Phase 184) | `PhaseTypeId` docblock: *"The 6 members of the backend's `PhaseConfig` discriminated union (**`harness.py:157-167`**)"* |
| **NEW** (re-derived by symbol) | *"The 7 members … (**`harness.py:288-299`**)"* |

It was stale **twice over**: `189-PATTERNS.md` measured the union at `:162-172` before this
phase opened, and 189-07's insertions then pushed it to `:288-299`. The module docblock's
second pointer was corrected the same way — `PhaseSpec` / `PhaseConfig` *"`harness.py:52-193`"*
became `PhaseSpec` `:328` and the union `:288-299`, and its *"6-member closed set"* clause now
states the RULE without a count, because that number has now rotted twice (5 → 6 at 101.1,
6 → 7 here).

**And the pointer is no longer the only thing holding the mirror together** — see the fence
below. A line number nothing typechecks is a claim; this one had already rotted.

---

## ⚠ D-23 — the mirror is now fenced MECHANICALLY, not editorially

`definitionOps.test.ts` reads `backend/app/models/harness.py` through Vite's `?raw` loader —
the **shipped** cross-language idiom at `PublishGauntlet.test.tsx:46`, which reads
`publish_service.py` the same way and whose docblock records why `node:fs` is the wrong
spelling here (`tsconfig.app.json` sets `types: ["vite/client"]` on purpose, and the
`new URL(…, import.meta.url)` pairing is statically rewritten by Vite into an asset
reference and throws before a test runs). Four cases:

| Case | Claim |
|---|---|
| *reads the server source at all* | non-vacuity FIRST — the import is a real string > 1000 chars containing `class ExternalActionPhaseConfig(_StrictBase):`. Without it every comparison below could pass by being empty on both sides |
| *carries exactly the backend union's `phase_type` literals, in the union's order* | the union's member classes are parsed out of `PhaseConfig = Annotated[Union[…]]` in order, each class's `phase_type: Literal["…"]` resolved, and the result asserted `toEqual([...PHASE_TYPE_ORDER])` |
| *its readers are falsifiable* | POSITIVE CONTROLS for all three extractors: each returns empty/null on a source without the thing, and finds the shipped thing in the real source — so "empty" means absent rather than broken |
| *emits a capability the server's closed Literal actually admits* | the `capability` Literal is parsed (asserted length **3**, D-15) and the emitted value asserted a member — by exact equality, never substring, because `send_email` and `send_emails` both pass a loose compare |

**Why a fence and not a fetch, restated because it is the decision:** `PhaseFormPanel.tsx`
says option sets are the server's, but D-20 deliberately keeps this phase's names out of
`GroundingBundle` — a route serving three constants is one refactor away from being reused as
an author-facing option source, which is the leak 189-04 closed. `PhaseTypeId` is the shipped
precedent for the trade.

**What this plan did NOT do:** it created no `EXTERNAL_CAPABILITY_SENTENCES` and no client
capability tuple. D-23's *"ONE constant read twice (picker + node face)"* still has exactly
one home to be created, and it is 189-14's. The one capability name this module spells is a
**default choice**, not an option list, and it is fenced individually by the fourth case above.

---

## ANTI-VACUITY: three plants, every one observed RED

All three driven into **production source** (`definitionOps.ts`), observed, removed.
Restoration verified by **md5 against a pre-plant backup** (`f8ed84c3c60c8c872608919dcfb5be35`,
identical before and after) with `grep -c "PLANT"` → **0** in the source and **1** in the
suite, that one being the pre-existing `PLANTED-GAP POSITIVE CONTROL` docblock (**1 at HEAD
too** — verified against `git show HEAD:…`).

### PLANT V — an EIGHTH member the server does not carry (the drift the fence exists for)

`"wire_transfer"` added to `PhaseTypeId`, `PHASE_TYPE_ORDER`, `SLUG_BASE` and the switch:

```
FAILED  the client mirror agrees with the backend union (D-23)
        > carries exactly the backend union's phase_type literals, in the union's order
AssertionError: expected [ 'programmatic', 'llm_single', …(5) ]
             to deeply equal [ 'programmatic', 'llm_single', …(6) ]

FAILED  the 7th phase type, external_action (Phase 189 / SC#1)
        > is APPENDED LAST — the shipped six keep their positions, byte for byte
AssertionError: expected 'wire_transfer' to be 'external_action'

FAILED  minimalPhaseFor > wire_transfer emits exactly the union-required config keys
3 failed
```

Note **which** test caught the cross-language half: only the D-23 fence can see a client
member the server lacks. Every other assertion in the tree is derived from the client's own
tuple and would have accepted it happily.

### PLANT W — a capability the server's `Literal` refuses

`return { capability: "wire_transfer" }` — the same name D-15 rejected and 189-07's PLANT A
used, one language layer up:

```
FAILED  emits a capability the server's closed Literal actually admits
AssertionError: expected [ 'send_email', 'create_ticket', …(1) ] to include 'wire_transfer'
1 failed
```

Exactly one failure, attributable to the one claim.

### PLANT X — the plausible wrong fix: `capability: ""`

The empty-string placeholder the other six arms use, which is precisely why it had to be
falsified rather than argued about:

```
FAILED  carries a capability that is REAL rather than an empty placeholder
AssertionError: expected '' not to be ''
FAILED  emits a capability the server's closed Literal actually admits
AssertionError: expected [ 'send_email', 'create_ticket', …(1) ] to include ''
2 failed
```

---

## THE PIN LIST, RE-DERIVED — and `189-RESEARCH.md` is wrong in BOTH directions

RESEARCH counted *"roughly sixteen hard-coded six-count assertions across five suites"*. The
list was re-derived by grep AND by running the suite after the 7th type landed — which is the
step that found the ones a grep for `toHaveLength(6)` cannot see.

**MOVED — 19 sites across 5 suites (12 of them hard-coded counts):**

| # | Site | What it was | Now | In RESEARCH's list? |
|---|---|---|---|---|
| 1-5 | `definitionOps.test.ts` `allowedTypesAt` ×5 | `toHaveLength(6)` | `PHASE_TYPE_ORDER.length` | ✅ |
| 6 | `definitionOps.test.ts` *"yields six distinct base slugs"* | `toBe(6)` + title | derived + retitled | ❌ **NO** |
| 7 | `definitionOps.test.ts:1590` `REQUIRED_CONFIG_KEYS` | 6 rows | 7 rows | ✅ (typecheck-forced) |
| 8 | `StepTypePicker.test.tsx` `describe("the six choices")` | title | *"the step-type choices"* | ✅ |
| 9 | `StepTypePicker.test.tsx` order length | `toHaveLength(6)` | derived | ✅ |
| 10 | `StepTypePicker.test.tsx` `unchangedTypes` | `toHaveLength(5)` | derived + falsifiable exclusion | ❌ **NO** |
| 11 | `StepTypePicker.test.tsx` *"title line then subtitle line"* | `${title}${SUBTITLES[type]}` | mirrors the shipped `?? ""` floor + the `•` mark | ❌ **NO** |
| 12 | `StepTypePicker.test.tsx` *"the subtitle line is untouched"* | loops the whole order | skips + re-asserts the absence | ❌ **NO** |
| 13 | `StepTypePicker.test.tsx` *"renders exactly six rows: %s"* ×7 params | `toHaveLength(6)` + title | derived + retitled | ✅ |
| 14 | `StepTypePicker.test.tsx` *"renders an SVG element per row"* | loops the whole order | skips + a new case pinning the `•` fallback | ❌ **NO** |
| 15-17 | `WorkflowCanvas.editing.test.tsx` ×3 | `toHaveLength(6)` | `PHASE_TYPE_ORDER.length` | ✅ |
| 18 | `PhaseFormPanel.test.tsx` `nonEmit` | hand-typed 5 | `PHASE_TYPE_ORDER.filter(≠ llm_emit)` → 6 | ✅ (*"likely 6"*) |
| 19 | `PhaseFormPanel.rails.test.tsx` `nonEmit` | hand-typed 5 | same | ✅ (*"likely 6"*) |

**FIVE sites RESEARCH does not list**, four of them invisible to a `toHaveLength(6)` grep
because they are shape assertions, not counts. ⚠ **The measured warning sign was exactly the
one the plan predicted: a green `tsc` and a red vitest.**

**NOT MOVED — every one checked by SUBJECT before being left alone:**

| Site | Subject | Verdict | RESEARCH said |
|---|---|---|---|
| `definitionOps.test.ts:247` | phases after inserting into a 5-phase fixture | **stays 6** | *"verify before changing"* ✅ correct |
| `definitionOps.test.ts:1650` | phases after `insertPhaseAt` on a 5-phase fixture | **stays 6** | *"⇒ 7"* ❌ **WRONG** |
| `phaseVocabulary.corpus.test.ts:221` | `RAW_PHASE_TYPE_TOKENS = Object.keys(PHASE_TYPE_SENTENCES)` | **stays 6** — 189-14 owns the sentence | *"⇒ 7"* ❌ **WRONG for this plan** |
| `phaseVocabulary.test.ts:138-145` | a hand-typed 6-type list | untouched, does not fail | *"⇒ 7"* — not this plan's |
| `phaseVocabulary.test.ts:658` | `waitsForYou`'s non-human-input list | untouched, does not fail | *"⇒ 7"* — not this plan's |
| `soulData.test.ts:135` | `PHASE_GLYPHS` slug map | **189-13's** (the `outbox-tray` mark) | *"⇒ 7"* — not this plan's |
| `PhaseNodeCard.test.tsx:800` | `Object.keys(ICON_TINT)` | **189-13's — explicitly forbidden here** | *"⇒ 7"* |
| `PhaseNodeCard.test.tsx:549` | `CARD_SUBTREE_PATHS` | **MUST stay 6** | *"stays 6"* ✅ |
| `PhaseNodeCard.test.tsx:731` | contract exports | **MUST stay 6** | *"stays 6"* ✅ |

**The three that must not move, verified by `git diff` rather than by intention:**

```
$ git diff --stat dcfdfb38~1..dcfdfb38 -- PhaseNodeCard.test.tsx phaseVocabulary.corpus.test.ts \
                                          soulData.test.ts phaseVocabulary.test.ts
(empty — none of these files is in the commit at all)

$ grep -n "CARD_SUBTREE_PATHS).toHaveLength(6)"        →  :549   UNMOVED
$ grep -n "Object.keys(ICON_TINT)).toHaveLength(6)"    →  :800   UNMOVED
$ grep -n "RAW_PHASE_TYPE_TOKENS).toHaveLength(6)"     →  :221   UNMOVED
```

The contract-export count (`:731`, `.toBe(6)`) is in the same untouched file and therefore
also unmoved.

---

## DERIVED, not re-pinned — 189-10's lesson applied

Every count that moved reads `PHASE_TYPE_ORDER.length`, never the literal `7`. The property
was never the number: it is *one row per type, none omitted* (R10b / 139-C — a refusal that
hides the option teaches nothing). A literal makes the **eighth** type read as a regression
until somebody remembers to move it, which is exactly what happened to the six.

A derived length is not a weakening, because the ORDER is still asserted element-by-element
beside it — a derived count cannot be satisfied by returning the wrong seven, and the
distinctness cases carry non-vacuity floors so an emptied tuple satisfies nothing.

---

## ⚠ TWO FALSIFIABLE PLACEHOLDERS — the honest intermediate state, pinned

`external_action` is PLACEABLE from this plan, while its **words** (189-14) and its **mark**
(189-13) belong to later plans in the same phase. The picker therefore renders a row that is
deliberately unfinished, and this is stated out loud rather than papered over:

| Owed by | List | What renders today |
|---|---|---|
| **189-14** | `TYPES_AWAITING_A_VOCABULARY_ENTRY` | title = `external_action` (the raw discriminator, `nodeTitle`'s honest echo), subtitle = empty |
| **189-13** | `TYPES_AWAITING_A_3D_MARK` | the `•` fallback mark on `DEFAULT_TINT` |

**Each exclusion ASSERTS that the entry is genuinely missing** (`PHASE_TYPE_SENTENCES[type]`
`toBeUndefined()`; the mark slot has no `<svg>` and reads `•`). So the day the owing plan
lands its vocabulary, these cases go **RED** and the exclusion has to be emptied. An exclusion
nothing re-checks is how a temporary gap becomes permanent — the same reason 189-08 pinned its
declined `PHASE_TYPE_LABEL` slot with a behavioural test instead of a comment.

**It is honest, and that was measured rather than argued.** Every resolver on the path is
total and floors: `PHASE_TYPE_SUBTITLES[type] ?? ""`, `ICON_TINT[type] ?? DEFAULT_TINT`,
`renderPhaseMark`'s own-property-guarded `"•"`, and `nodeTitle`'s `?? type`. The row says
nothing about the step that is not true — and a new case pins that it is NOT any of the three
capability sentences 189-14 will write.

---

## `requiredConfigFor`'s new arm — and the one field excluded, by measurement

```ts
case "external_action":
  return { capability: "send_email" }
```

**Read from `ExternalActionPhaseConfig` rather than from memory** (`harness.py:242-255`):

| Field | Backend declaration | In the minimal config? |
|---|---|---|
| `phase_type` | `Literal["external_action"]` | ✅ (added by `minimalPhaseFor`) |
| `capability` | `Literal["send_email","create_ticket","post_message"]` — **no default** | ✅ REQUIRED |
| `available_tools` | `list[str] = Field(default_factory=list)` — **has a default** | ❌ **EXCLUDED** |

`available_tools` is excluded **twice over**: the docblock rule (a field with a backend
default does not belong here — a re-materialised default is the drift R2's round-trip
property catches) and D-03 (the server DERIVES it from `capability` by total replacement, so
a client-written list would be both discarded and a claim the client may not make). The
member carries none of the five LLM shape-symmetry optionals at all, by 189-07's own decision.

⚠ **The capability value is REAL, and that is the one place this switch departs from its own
register.** `prompt: ""` and `fn: ""` are honest placeholders because those fields are plain
`str`: an empty one PARSES, and whether it publishes is a verdict the server owns.
`capability` is a closed `Literal`, so `""` is a `ValidationError` that 422s the whole
definition on the first save. See Deviations #1 for the consequence and its owner.

---

## Verification

**The plan's `<verification>` block, run:**

```
$ npx tsc --noEmit -p tsconfig.app.json | grep -c "error TS"
33                                    ← the baseline, and ZERO in any file this plan touched

$ npx vitest run src/components/workflows/definitionOps.test.ts
Tests  243 passed (243)

$ npx vitest run src/components/workflows/StepTypePicker.test.tsx
Tests  46 passed (46)

$ npx vitest run src/components/workflows src/pages src/lib
Test Files  1 failed | 72 passed (73)      ← the ONE failure is named below
```

**The one failure is PRE-EXISTING and outside this plan's blast radius:**
`src/lib/model-info.test.ts > MODEL_INFO > should have correct costTier values for known
models` (`expected 'mid' to be 'high'`). It fails alone (`1 failed | 7 passed`), it reads a
model registry this plan does not touch, and it is **not in the count gate's `TARGETS`** at
all (`grep -n "model-info" scripts/vitest-count-gate.cjs` → no match).

**The count gate — the COUNT columns, not the `failed` column (`D-188.2-DEF-01`):**

| Point | total | pinned | files |
|---|---|---|---|
| Baseline, re-derived before any edit | **2546** | 2546 | 46/46 |
| After the commit | **2560** | 2560 | 46/46 |

```
count gate OK — 46/46 pinned files present, no per-file decrease, 0 failing.
```

**Both pins moved in THIS commit, each read from the gate's own `actual` column:**

| File | Pin | Why |
|---|---|---|
| `definitionOps.test.ts` | 232 → **243** | +5 the 7th-type block (appended-last, the slug base, the required key, the real capability, the round trip) · +4 the D-23 fence · +2 from `it.each(PHASE_TYPE_ORDER)` gaining a 7th row in two loops |
| `StepTypePicker.test.tsx` | 43 → **46** | +1 the 7th row is LAST · +1 its title comes from the resolver · +1 the `•` fallback mark |

⚠ **No per-file DECREASE anywhere. `TARGETS` was NOT edited** — both files were already
inside it, so only `BASELINE` moved. ⚠ **`WorkflowCanvas.editing.test.tsx` (63),
`PhaseFormPanel.test.tsx` (19) and `PhaseFormPanel.rails.test.tsx` (27) changed ASSERTIONS
but not COUNTS, so their pins were deliberately NOT moved** — moving them would make the gate
disagree with reality.

⚠ **`BASELINE_TOTAL`'s prose note read `2546` and is now `2560`.** It is prose beside a
`reduce`, it has now drifted at least twice (189-08 → 189-10 recorded the last one), and it
is updated here for the reader while the gate keeps reading the derived value.

**Scope:**

```
$ git status --short -- frontend/ scripts/ backend/
 (7 modified files, all of them this plan's; the ~12 untracked entries are the
  pre-existing operator artifacts 189-08/189-10 both recorded — scripts/_uat111*,
  scripts/pm-pack/out/, backend/scripts/115_*.json, … NOT staged, NOT modified)

$ git diff --stat dcfdfb38~1..dcfdfb38 -- backend/                          → (empty)
$ git diff --stat … -- <the six fenced card-subtree modules>                → (empty)
$ git diff --stat … -- phaseVocabulary.ts phaseVocabulary.corpus.test.ts
                       soulData.ts PhaseNodeCard.test.tsx                   → (empty)
```

**`toolOptions` was NOT widened, and V22 is untouched.** The only place this plan names it is
a comment in `PhaseFormPanel.rails.test.tsx` recording that it is passed UNCHANGED and that
scoping the generic tool rail away from `external_action` is `D-189-DEF-02` / plan 189-13's
job. No capability name reaches any author-facing tool list:

```
$ grep -rc "send_email" frontend/src --include=*.ts --include=*.tsx | grep -v ":0"
frontend/src/components/workflows/definitionOps.ts:1        ← the requiredConfigFor arm
frontend/src/components/workflows/definitionOps.test.ts:2
```

**Exactly ONE occurrence in non-test frontend source** — the `requiredConfigFor` arm. Zero in
any rail, picker, tool list or API call. ⚠ The two in the suite were checked rather than
waved through: one is my own comment explaining why the capability compare is exact rather
than a substring, and the other (`:609`) is a **pre-existing fixture** — a `programmatic`
phase whose `fn` happens to be `send_email` — which `git show dcfdfb38~1` confirms was
already there (`grep -c` → **1** at the parent commit). Recorded because a count is only
evidence while somebody actually runs it (189-08's `⊘` lesson).

### Re-derived, not inherited

| Claim | How | Result |
|---|---|---|
| `tsc -p tsconfig.app.json` = 33 | run before any edit | ✅ **33** |
| count gate 2546 / 46 files | run before any edit | ✅ **2546 / 46** |
| `definitionOps.test.ts` pin = 232 | the gate's `pinned` column | ✅ **232** |
| `StepTypePicker.test.tsx` pin = 43 | same | ✅ **43** |
| `PhaseConfig` union at `harness.py:162-172` | symbol search | ⚠ **STALE — it is `:288-299`** (189-07's insertions). Corrected in the docblock |
| the `PhaseTypeId` docblock's own pointer (`:157-167`) | symbol search | ⚠ **STALE, twice over.** Corrected |
| `ExternalActionPhaseConfig`'s field defaults | read from source | ✅ `capability` required · `available_tools` defaulted |
| RESEARCH's "16 six-count pins" | grep **and** a suite run | ⚠ **WRONG BOTH WAYS** — 5 sites it omits, 6 it lists that do not move here |
| `definitionOps.test.ts:1650` ⇒ 7 | read the subject | ⚠ **FALSE** — it is a phase count, stays 6 |
| `phaseVocabulary.corpus.test.ts:221` ⇒ 7 | read the derivation | ⚠ **FALSE for this plan** — derives from `PHASE_TYPE_SENTENCES` (189-14's) |
| `PHASE_TYPE_ORDER` is a silent site | the 37-error tsc run | ✅ **CONFIRMED** — it raised nothing |
| a frontend test may read a backend `.py` via `?raw` | the shipped `PublishGauntlet.test.tsx:46` + a run | ✅ **WORKS** |
| the picker's 7th row renders without crashing | run | ✅ every resolver floors; `•` + raw token, never a fabrication |

---

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] `requiredConfigFor` emits a REAL capability, and UI-SPEC §7b's "nothing chosen yet" state is affected

- **Found during:** Task 1, reading `ExternalActionPhaseConfig` for the field defaults.
- **Issue:** the plan says *"return only the REQUIRED keys"* and the switch's register is
  empty-string placeholders. `capability` is REQUIRED **and** a closed `Literal`, so the
  register does not extend to it: `{ capability: "" }` — and equally `{}` — is a
  `ValidationError` against the union. `must_haves.truths` says `minimalPhaseFor` must
  *"produce a VALID phase"*, and a phase that cannot be stored is not one. The step would be
  placeable and then unstorable: SC#1 satisfied and falsified in one act.
- **Fix:** emit the FIRST member of the backend `Literal`, and fence the value against
  `harness.py` so a server-side rename is a red test rather than a 422 in the app.
- **⚠ The consequence, stated rather than smoothed:** `189-UI-SPEC.md` §7b describes a
  *"Nothing chosen yet"* picker state and §9's node table a *"Not configured (type chosen, no
  capability)"* face. **A node placed from the picker no longer reaches that state** — it
  arrives with `send_email`. The state remains reachable exactly where 189-07's SUMMARY said
  it lives: a stored value the client does not recognise, which falls through to the type
  sentence and shows no row selected. **This is 189-13's decision to finish** (it owns
  `ExternalActionSection`): either it accepts a pre-selected first option, or the *"nothing
  chosen"* state needs a representation that survives `model_validate` — which the D-15 fence
  in `test_189_external_action_model.py` forbids making optional. Nothing about that choice is
  blocked by this plan; it is named so it is not discovered.
- **Not dangerous in this milestone, and that is measured, not assumed:** SC#4 forbids egress,
  189-09's executor sends nothing and lands `recorded_not_sent`, and the node carries a
  *Not connected* badge until 190 wires a destination. A defaulted capability cannot cause a
  send here.
- **Commit:** `dcfdfb38`

### 2. [Rule 2, beyond the plan] The D-23 cross-language fence was built here, not deferred whole to 189-14

- **Found during:** Task 1, reading T-189-36 in the plan's own threat register.
- **Issue:** the register disposes T-189-36 (*the client type mirror drifting from the backend
  union*) as **mitigate**, and the only mitigation this plan owned was editorial — *"documented
  as a MIRROR"* and *"its stale pointer corrected"*. A docblock is a claim. The plan defers the
  **capability** half's fence to 189-14, which is correct and unchanged; the **union** half is
  this plan's own artifact and had nothing mechanical behind it.
- **Fix:** four cases reading `harness.py` through the shipped `?raw` idiom, observed RED under
  PLANT V. **No capability constant was created**, so 189-14 still owns exactly one home for
  D-23's *"ONE constant read twice"*.
- **Commit:** `dcfdfb38`

### 3. [Documented, not auto-fixed] `phaseVocabulary.corpus.test.ts` is in `files_modified` and needed NO edit

- **Found during:** the pin re-derivation.
- **Issue:** RESEARCH lists its `RAW_PHASE_TYPE_TOKENS` six-count as ⇒ 7. Measured, that
  constant is `Object.keys(PHASE_TYPE_SENTENCES)` — the **vocabulary** map, which this plan
  does not touch and 189-14 owns. It stays at 6 and the suite is green.
- **Resolution:** **not touched.** Its own docblock already says it is derived *"so a seventh
  phase type is covered the day it is added"* — the day the SENTENCE is added. Editing a file
  to satisfy a manifest, with no defect to fix and no guard to add, is 189-10 Deviation #3's
  shape. ⚠ **189-14 owes that pin move**, in the commit that writes the sentence.

### 4. [Rule 2, beyond the plan] Four assertion sites a `toHaveLength(6)` grep cannot see

The plan's re-derivation instruction was load-bearing in a way it did not predict: three
StepTypePicker cases and one slug case broke on SHAPE, not on a count — an `undefined`
subtitle concatenated into an expectation (`'external_actionundefined'`), a missing `<svg>`,
a sentence read straight from a map with no entry. **They were found by RUNNING the suite
after the source edit, not by grepping.** Each was repaired to mirror the shipped resolver's
own floor rather than to assume presence, and the two that hide a real gap were converted
into falsifiable placeholders (above) rather than silent skips.

### 5. [Rule 2, beyond the plan] The two `nonEmit` loops are DERIVED and now cover the 7th type

The plan required an explicit decision, recorded in the test's comment. The decision:
**`external_action` belongs in the subset.** The claim those cases make is *"the file-check
and sourcing-strictness controls belong to the DELIVERABLE and to nothing else"*, which
quantifies over every other type — a hand-typed five-element array had already stopped
covering the union. Both now read `PHASE_TYPE_ORDER.filter(≠ llm_emit)` and build each config
with `minimalPhaseFor`, so no `if` ladder has to be remembered. Neither suite's COUNT changed,
so neither pin moved.

### 6. [Documented, not auto-fixed] `STATE.md`'s `last_updated` holds a FUTURE timestamp and was deliberately left alone

- **Found during:** the hand-update of STATE.md.
- **Issue:** the frontmatter reads `last_updated: "2026-08-08T02:10:00.000Z"`, while the measured
  clock is `2026-08-07T15:43:08Z` — roughly **10.5 hours in the future**. It was already there.
- **Resolution:** **not changed.** Correcting it means winding the field BACKWARDS, which is the
  exact failure mode recorded against `state.record-session` in project memory (it reported
  `updated: ["Resume File"]` while reverting `last_activity` a day and winding `last_updated`
  backwards). A future timestamp is a visible anomaly; a backwards one looks like a regression and
  is what the known bug produces. Recorded here so the next writer decides deliberately rather than
  discovering it. Every other field was hand-edited — no GSD state verb was run, per the executor's
  standing instruction.

### 7. Out-of-scope, untouched

`scripts/_uat111*`, `scripts/_uat111_1/`, `scripts/pm-pack/out/`, `scripts/.sse_after_run1/`,
`backend/RUN-BACKEND.md`, `backend/scripts/115_*.json`, `backend/settings_override.json.migrated`
are pre-existing operator artifacts. **Not staged, not modified, not deleted.** Every file in
the commit was staged individually by path. `supabase/` was not touched, per the executor's
standing instruction, and `requirements.mark-complete` was NOT run — **CONN-01 stays
`Pending`**, with four plans still owed.

---

## Deferred Issues

None new. Four constraints carried forward, each with a named owner:

- **`TYPES_AWAITING_A_VOCABULARY_ENTRY` → 189-14.** Landing `PHASE_TYPE_SENTENCES.external_action`
  turns two `StepTypePicker` cases RED by design; the exclusion list must be emptied with it.
  The same commit owes `phaseVocabulary.corpus.test.ts:221`'s pin (6 → 7).
- **`TYPES_AWAITING_A_3D_MARK` → 189-13.** Landing the `outbox-tray` slug turns the fallback
  case RED by design. That plan also owns `PhaseNodeCard.test.tsx:800`'s `ICON_TINT` pin,
  deliberately unmoved here.
- **UI-SPEC §7b's *"nothing chosen yet"* state → 189-13** (Deviation #1).
- **`D-189-DEF-02`** — the author-facing rail rendering a capability struck through. Untouched
  and still 189-13's. This plan did not widen `toolOptions` and named no capability in any rail.

## Authentication Gates

None.

## Known Stubs

**One, and it is a deliberate wave-ordering state rather than a placeholder — declared here
because it IS user-visible.** Until 189-13/189-14 land, a placed `external_action` node and
its picker row read **`external_action`** (the raw discriminator) with the **`•`** fallback
mark. It is the shipped TOTALITY floor firing, not a hardcoded empty and not invented text:
`nodeTitle` echoes the type rather than fabricating a sentence, exactly as it would for any
type the vocabulary does not know. Both halves are PINNED by tests that go RED when the owing
plan arrives, so the gap cannot outlive its reason. This is the same shape 189-08 shipped when
`CanvasReading` grew a member the canvas vocabulary had not yet worded.

Nothing else: no `TODO`, no "coming soon", no component wired to empty data.

## Threat Flags

None. This plan widens a client-side union and edits test assertions. It opens no route,
reads no credential, makes no request and gains no privilege. Its own register is addressed
rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-36** — Tampering: the client mirror drifting from the backend union | **mitigated, and now MECHANICALLY** | The `?raw` fence asserts the client union equals `harness.py`'s union `phase_type` literals IN ORDER, with three falsifiable extractors and a non-vacuity check on the read itself. **PLANT V** (an 8th client-only member) observed RED. The stale docblock pointer was re-derived — and the fence is what survives the NEXT time that line number rots. |
| **T-189-37** — Spoofing: a client-assembled config bypassing server validation | **accept-and-inherit, and strengthened** | `minimalPhaseFor` produces a fragment, not an authority; every write goes through `WorkflowDefinition.model_validate`. Strengthened rather than merely inherited: `requiredConfigFor` emits `capability` ONLY, so the client cannot author `available_tools` (D-03) — asserted by `not.toHaveProperty("available_tools")` — and the emitted capability is asserted a member of the server's closed `Literal`. **PLANT W** and **PLANT X** each observed RED. |
| **T-189-38** — Repudiation: prose claiming the picker never offers fewer than six | **mitigated** | Corrected in the commit that falsified it, and re-stated WITHOUT a number, because that number has now rotted twice. Three further count-bearing docblocks were corrected the same way (the module's mirror block, `PhaseTypeId`'s, `requiredConfigFor`'s "a 7th member"). |
| **T-189-30** — Tampering: moving a six-count pin that must NOT move | **mitigated** | No blanket replace: every site was checked by SUBJECT, and the check found TWO that RESEARCH wrongly said should move. The card-subtree path list, the contract-export count and the icon-tint table are in files with a **zero-line diff** across the whole commit, verified by `git diff` and re-grepped at 6. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `frontend/src/components/workflows/definitionOps.ts` — 7th member, order, slug base, switch arm | FOUND |
| `frontend/src/components/workflows/definitionOps.test.ts` — 243 cases green, the D-23 fence | FOUND |
| `frontend/src/components/workflows/StepTypePicker.test.tsx` — 46 cases green | FOUND |
| `frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx` — 63 cases green, pin unmoved | FOUND |
| `frontend/src/components/workflows/PhaseFormPanel.test.tsx` / `.rails.test.tsx` — 19 / 27 green | FOUND |
| `scripts/vitest-count-gate.cjs` — both pins moved, total 2560 | FOUND |
| `.planning/phases/189-.../189-12-SUMMARY.md` | FOUND |
| commit `dcfdfb38` | FOUND in `git log` |
| `tsc --noEmit -p tsconfig.app.json` == 33 | **33** |
| no plant residue — `grep -c "PLANT" definitionOps.ts` | **0** (and **1** in the suite, pre-existing at HEAD) |
| md5 restore of the planted source | **f8ed84c3c60c8c872608919dcfb5be35** — identical before and after |
| `CARD_SUBTREE_PATHS` / contract exports / `ICON_TINT` still six | **CONFIRMED, zero-line diff** |
| CONN-01 still `Pending` in REQUIREMENTS.md | **CONFIRMED — `requirements.mark-complete` not run** |
</content>
