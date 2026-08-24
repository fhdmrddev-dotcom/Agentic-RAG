---
phase: 197-guided-authoring
plan: 06
subsystem: frontend
tags: [d-13, absent-field-rule, wire-type, callback-boundary, g-5-declined, d-05-red-line]

# Dependency graph
requires:
  - phase: 197
    plan: 01
    provides: "The phase base SHA as a literal, the three green pre-draft baseline verdicts, and the four runnable numstat criteria"
  - phase: 193.1
    provides: "useTemplateFirstDraft.ts — the extracted pre-draft describe→generate concern whose OUTPUT boundary this plan widens"
  - phase: 187
    provides: "SeedReceiptProps.phases — the SNAPSHOT contract the new second argument inherits"
provides:
  - "GenerateReadiness — the wire type with THREE representable states, the third being the absence of the whole object"
  - "GenerateResult's ok:true arm widened with an OPTIONAL readiness member; the ok:false arm byte-unchanged"
  - "onDrafted carrying the server's verdict as a REQUIRED second parameter whose value may be undefined"
  - "Seven cases pinning arity, identity, both arms, the absent case, its positive control, the failure zero-call and the auto-draft funnel"
  - "A NAMED G-5 decision declining the api.ts seam, with a re-open trigger"
affects: [197-07, 197-08, 197-09, 197-10, 197-11, wave-merge, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A type-only touch on the repository's hottest file: zero runtime exports, so 196-08's mock-factory failure mode is structurally unarmed"
    - "REQUIRED parameter / optional VALUE — the typechecker enumerates the call sites while `undefined` stays a legal answer"
    - "A source fence RE-SPELLED over a widened declaration and proved to DISCRIMINATE against the shape it replaced, rather than loosened"

key-files:
  created:
    - ".planning/phases/197-guided-authoring/197-06-SUMMARY.md"
  modified:
    - "frontend/src/lib/api.ts"
    - "frontend/src/components/workflows/useTemplateFirstDraft.ts"
    - "frontend/src/components/workflows/useTemplateFirstDraft.test.tsx"

key-decisions:
  - "The G-5 seam on frontend/src/lib/api.ts is DECLINED for this phase, as a named decision with a re-open trigger — not left silent"
  - "The type gained no runtime export of any kind, including no type-guard helper — narrowing happens inline on `status` at the call site"
  - "The D-24(b) source fence was re-spelled over the widened declaration and given a DISCRIMINATION control, rather than relaxed to `/onDrafted:/`"
  - "The count gate was NOT run: 14 GB free (98% used) with four sibling agents live is wave 1's measured ENOSPC condition, and ≥3 concurrent test-running agents makes the gate non-deterministic regardless of cap"
  - "The page's onDrafted handler is NOT wired in this plan — it is not in files_modified, and a 1-arg inline callback assigns to a 2-param signature without error"

patterns-established:
  - "Assert the ARITY from the mock's recorded arguments array, not from the callback's declared parameter list — a one-argument call and an honestly-absent verdict are indistinguishable at the consumer"
  - "State a numstat criterion's verdict verbatim including the empty-output case, so a later reader knows it was run rather than assumed"

requirements-completed: [AUTH-02]

# Metrics
duration: 51min
completed: 2026-08-18
---

# Phase 197 Plan 06: D-13's Verdict Crosses the Hook Boundary Summary

**One type arm on the hottest file in the repository, one widened callback on the one hop that could drop the verdict, and seven cases proving that a response which says nothing hands out `undefined` rather than a green tick.**

## Performance

- **Duration:** 51 min
- **Tasks:** 3 (two source, one measurement)
- **Source files modified:** 3 — exactly the three declared in `files_modified`, proved below

---

## ⚠ THE WAVE-2 BASE-SHA DEFECT REPRODUCED, AND THE ASSERTION IS WHAT CAUGHT IT

The dispatched base for this wave is `7cf919f1438ad92d597f9749acba22bb1e8fab43`. This worktree was
created at **`fda792141b0129de7b15dd40ddc1082e76f95a2a`** — the *same wrong SHA wave 1 measured*,
which makes this the second observation of the defect rather than a first sighting:

```
$ git rev-parse HEAD
fda792141b0129de7b15dd40ddc1082e76f95a2a
$ git merge-base HEAD 7cf919f1438ad92d597f9749acba22bb1e8fab43
3781a3fe4690a9619e619f4cc412bd37a7dafc52          # ≠ the dispatched base
$ git reset --hard 7cf919f1438ad92d597f9749acba22bb1e8fab43
HEAD is now at 7cf919f1 docs(phase-197): update tracking after wave 1
```

Without the assertion this plan would have been authored against a tree missing wave 1's merge —
including `197-01-SUMMARY.md`, i.e. **the very document carrying the four criteria this plan is
required to run**. Recorded because a defect seen twice on consecutive waves is a standing
condition, not an incident.

---

## Task 1 — `GenerateReadiness`: three representable states, zero runtime exports

**Commit `b5063fcd`** · `frontend/src/lib/api.ts`

The type as it landed, beside `GenerateResult`:

```ts
export type GenerateReadiness = {
  business_requirement:
    | { status: "present" }
    | { status: "missing"; message: string }
}

export type GenerateResult =
  | { ok: true; definition: WorkflowDefinitionJSON; readiness?: GenerateReadiness }
  | { ok: false; error: string; detail?: string }
```

### THREE arms, and the third is the optionality itself

The docblock states this by identifier rather than leaving it to be inferred: the states are
`{status:"present"}`, `{status:"missing", message}`, and **the field not being there at all**. It
names the two defaulting mistakes that collapse the third into the first — a `readiness ?? {}`
default, and a `=== "missing"` read whose `false` branch renders a green tick — and cites the two
shipped floors that make this a rule rather than a preference: `useModelRegistry`'s (*a failed read
is `status:"failed"`, never an empty success*) and `model_registry`'s (*an ABSENT override row means
ENABLED*).

**ONE entry, deliberately**, is likewise stated in the source and not only here: measured across the
whole publish gauntlet, stage 1's `business_requirement` is the only definition-level predicate, so
a second key would be a claim no gate makes (D-20).

### Every acceptance criterion, run

| Criterion | Command | Result |
|---|---|---|
| `GenerateReadiness` present ≥ 2× | `grep -c "GenerateReadiness" frontend/src/lib/api.ts` | **2** ✅ |
| **No runtime export added** | `git diff -- …/api.ts \| grep -cE '^\+\s*export (const\|function\|class\|let\|var) '` | **0** ✅ |
| < 25 insertions | `git diff --numstat` | **21** ✅ |
| ≤ 1 deletion | `git diff --numstat` | **1** ✅ |
| …and it is the union line | `git diff \| grep '^-'` | `-  \| { ok: true; definition: WorkflowDefinitionJSON }` — the single edited arm ✅ |
| `ok:false` arm unchanged | same diff | absent from the diff entirely ✅ |
| typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **33 errors — exactly 197-01's baseline**, none in `api.ts` ✅ |

⚠ **The ≤ 1-deletion criterion caught a real second deletion and the fix was to MOVE the prose, not
to waive the number.** The first attempt appended the `ok:true`-arm-only note to `GenerateResult`'s
existing docblock, which edited that block's closing line → `22 / 2`. The note was relocated into
`GenerateReadiness`'s own docblock, leaving `GenerateResult`'s docblock byte-identical → **`21 / 1`**.
The criterion did exactly what a red line is for.

### ⚠ THE G-5 SEAM ON `api.ts` IS **DECLINED**, AS A NAMED DECISION

`frontend/src/lib/api.ts` is the hottest file in the repository and **G-5 fires hardest on it**. The
recommendation was produced first, per the protocol, and then declined:

- **Reason:** this plan's entire touch on that file is **one type-union arm plus its docblock —
  21 insertions, 1 deletion, 0 runtime exports.** Opening a 6,174-line module for an extraction the
  phase does not need would be a change strictly larger than the feature it serves, and would put a
  refactor of the app's single most-imported module inside a wave running four sibling agents.
  **G-5 is honoured by MINIMALITY here**, and the decision is written down precisely because
  "minimal, so it doesn't count" is the reasoning that let this file sit outside the ledger for 97
  phases.
- **Re-open trigger — worded, not a count:** *the next phase that adds a **runtime** export to
  `frontend/src/lib/api.ts`, or a genuinely second concern to it.* A runtime export is also the
  measured trigger for `196-08`'s 249 mock-factory failures, so that phase pays two costs at once
  and is the right place to take the seam.

**⚠ The ledger row for this file WENT STALE ON THIS PLAN'S OWN FIRST COMMIT** — re-derived here with
the ledger's own three commands rather than copied from wave 1:

| | `CLAUDE.md` / `197-01` say | **measured after `b5063fcd`** |
|---|---|---|
| commits | 170 | **171** |
| phases | 97 | **98** (raw 100 − the two dated buckets `260405` `260814`) |
| lines | 6154 | **6174** |

Wave 1's closing instruction — *"most of these six will be touched during wave 2, so today's zero is
not tomorrow's"* — is confirmed by measurement on the same day it was written.

---

## Task 2 — `onDrafted` widened: the verdict survives the one hop that could drop it

**Commit `c6b64f17`** · `useTemplateFirstDraft.ts` + `useTemplateFirstDraft.test.tsx`

```ts
  onDrafted: (
    definition: TemplateFirstDefinition,
    readiness: GenerateReadiness | undefined,
  ) => void
```

…and at the single success transition:

```ts
        onDraftedRef.current(def, result.readiness)
```

Read off the **same `result`** the definition came from, handed out **untouched**. No `?? {}`, no
coercion, no synthesised `"present"`.

### The three rules the plan is built on, each discharged

1. **REQUIRED parameter, optional VALUE.** The parameter is declared; `undefined` is a legal value.
   This is the args interface's own 192.1 rule (`onTemplateBound`'s docblock states it): a required
   member makes the typechecker enumerate the call sites, so a host that forgets the verdict is a
   compile error rather than a silently green screen.
2. **A type import, not a runtime one.** `import type { GenerateReadiness } from "@/lib/api"` —
   this module already imports three functions from that client, so no fence is crossed, and the
   import carries a note on why declaring a structurally-similar local shape would be the
   two-homes-for-one-server-answer mistake this file already refuses once for `TemplateReadAnswer`.
3. **Snapshot, not live state.** The docblock binds the consumer's obligation **at the producer**,
   citing `SeedReceiptProps.phases` (`SeedReceipt.tsx:147-172`) — *an immutable SNAPSHOT of one
   `POST /generate` result, NEVER a live store selector* — and says why: this verdict is what the
   server said about **the generation**, so a consumer re-deriving it from the author's later edits
   answers a different question with this value's authority.

### ⚠ THE SOURCE FENCE HAD TO BE RE-SPELLED, AND IT WAS PROVED TO DISCRIMINATE

`useTemplateFirstDraft.test.tsx`'s D-24(b) fence pinned the declaration as an exact string:

```ts
expect(templateFirstDraftSource).toMatch(/onDrafted: \(definition: TemplateFirstDefinition\) => void/)
```

Widening the declaration necessarily reds it. **The fence was re-spelled over the new multi-line
shape and NOT loosened to `/onDrafted:/`** — the property it defends is *"the args interface is the
whole surface"*, and a loosened matcher would pass against a callback that had quietly grown a store
setter. A **discrimination control** was added beside it, asserting the new matcher does **not**
match the shipped single-parameter spelling, so "the verdict crosses this boundary" is a claim the
fence actually checks rather than one it passes vacuously. That is this suite's own header rule
(*"a matcher that cannot match passes vacuously and looks exactly like a fence that holds"*).

### The seven cases, and which one is load-bearing

| # | Case | What only it can catch |
|---|---|---|
| 1 | raises `onDrafted` with **TWO** arguments | asserted on `mock.calls[0]`'s **recorded arguments array**, not on the declared parameter list — a one-argument call typechecks everywhere and reads as `undefined` at the consumer |
| 2 | hands out the **EXACT** object, by `toBe` | identity, not deep equality: a copy passes `toEqual` while having been through a hand that could have changed it |
| 3 | the **GREEN** arm survives unchanged | `present` is a verdict, not an absence |
| 4 | ⚠ **the ABSENT-FIELD RULE** | a response with **no** `readiness` key hands out `undefined` — and the case asserts the three things it must NOT be (`{}`, a synthesised `present`, and a one-argument call), because each of those reads as a pass at the consumer |
| 5 | **POSITIVE CONTROL** for case 4 | proves `toBeUndefined()` really would red against a defaulted verdict, rather than passing because nothing was checked |
| 6 | `ok:false` raises **zero** calls | the RUNTIME half of T-197-07 — the type-level half is the failure arm having no `readiness` member at all |
| 7 | the **auto-draft** path carries it too | one funnel, not two: a verdict surviving the manual entrance but not the handoff would be a silent asymmetry between the two authoring doors |

**Case 4 is the RED-first proof of the absent-field rule at the wire boundary**, and it is also the
case that describes **every generation today** — the server half (plan `197-02`) lands in a separate
worktree merged after this one, so until then the shipped response is exactly `{ok, definition}`.
It is likewise what a stale deploy answers with forever after.

### Every acceptance criterion, run

| Criterion | Result |
|---|---|
| both suites pass | `Test Files 2 passed (2) · Tests 109 passed (109)` ✅ |
| a test asserts arity **2** from the mock's call array | case 1 + the tail of case 4 ✅ |
| a test asserts the 2nd arg `toBeUndefined()` on a keyless response | case 4, named `⚠ THE ABSENT-FIELD RULE …` ✅ |
| `grep -Ec "readiness\s*(\?\?\|\|\|)\s*\{\}\|readiness\s*=\s*\{\}"` | **0** ✅ |
| `grep -c "template_asset_id"` | **0** ✅ |
| suite count ≥ base + 3 | **58 → 65 (+7)** ✅ |

The suite count was **re-derived, not inherited**, exactly as the plan instructed:

```bash
$ git show 52e6bcdb…:frontend/src/components/workflows/useTemplateFirstDraft.test.tsx | grep -cE '^\s+it\("'
58
$ grep -cE '^\s+it\("' frontend/src/components/workflows/useTemplateFirstDraft.test.tsx
65
```

The `58` agrees with `scripts/vitest-count-gate.cjs:679`'s pin — that agreement is a *finding of this
measurement*, not the reason it was skipped. ⚠ **The gate pin was NOT raised**: that file is not in
this plan's `files_modified`, four sibling agents are live on it, and the gate's contract is *no
per-file DECREASE*, which a growth of +7 satisfies.

### ⚠ Two things this plan deliberately did NOT do

- **No SEND was added.** Nothing new goes into the request body; `template_asset_id` stays at **0**
  occurrences, so plan `197-02`'s half-B fence cannot pass here for the wrong reason.
- **No `GenerateRequest` field name appears in any NEW comment in the swept file.** Verified
  mechanically over the added lines. One near-miss was corrected rather than accepted: a docblock
  sentence read *"this verdict **describes** what the server said"*, whose substring would read as a
  field mention to a source-scanning fence. It was reworded to *"this verdict **is** what the server
  said"*. Fields are named by role throughout.

---

## Task 3 — the D-05 red line, run against this plan's own diff

**This is the first plan in the phase to edit a file the pre-draft screen depends on**, so the
criterion is exercised here for the first time rather than at phase close.

### The three shipped baselines — GREEN, verdicts verbatim

```
 RUN  v4.1.0 C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-aad7b9abc90dbca1e/frontend

 Test Files  2 passed (2)
      Tests  39 passed (39)
```
(`WorkflowBuilderPage.preDraft.baseline.test.tsx` + `WorkflowDoorSwitch.baseline.test.tsx`)

```
 Test Files  1 passed (1)
      Tests  30 passed (30)
```
(`WorkflowBuilderPage.describe.test.tsx` — the `FLAG_OFF_DESCRIBE_MARKUP` byte pin)

**39 + 30 = 69**, which reproduces wave 1's pre-change reading of `Test Files 3 passed (3) · Tests
69 passed (69)` **exactly**. Not one captured string moved.

### THE FOUR NUMSTAT CRITERIA — verdicts verbatim

```bash
$ git diff --numstat 52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07 HEAD \
    -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
       frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
       frontend/src/components/workflows/SeedReceipt.tsx \
       backend/app/services/harness/publish_service.py
                                                                   [no output — exit 0]
```

| # | Path | Decision | Required | **Measured** |
|---|---|---|---|---|
| 1 | `WorkflowBuilderPage.preDraft.baseline.test.tsx` | D-05 · SC#2 · SC#3 | deletions = 0 | **absent from the diff — `0 0`** ✅ |
| 2 | `WorkflowDoorSwitch.baseline.test.tsx` | D-05 · SC#2 · SC#3 | deletions = 0 | **absent from the diff — `0 0`** ✅ |
| 3 | `SeedReceipt.tsx` | D-02 | `0 0`, must not appear | **absent from the diff** ✅ |
| 4 | `publish_service.py` | D-11 · D-20 | `0 0`, must not appear | **absent from the diff** ✅ |

**The empty output is the verdict**, and it is quoted rather than paraphrased for wave 1's stated
reason: a later reader must be able to tell "run and clean" from "assumed clean".

### The whole diff, so the red line is checkable rather than asserted

```bash
$ git diff --numstat 7cf919f1438ad92d597f9749acba22bb1e8fab43 HEAD     # the dispatched base
176     3       frontend/src/components/workflows/useTemplateFirstDraft.test.tsx
37      2       frontend/src/components/workflows/useTemplateFirstDraft.ts
21      1       frontend/src/lib/api.ts
```

**Three paths, and they are exactly the three in `files_modified`.** No `STATE.md`, no `ROADMAP.md`,
nothing owned by a sibling (`decisionsVocabulary.ts`, `soulData.ts`, `builderStore.ts`,
`workflow_authoring.py` are all absent).

**D-05's third must-have truth holds by construction and by measurement:** every edit is on the
hook's **output** boundary — the callback declaration and the success block — plus a type in the API
client. No control, no required input and no gate reached the screen, and the six whole-container
captures prove it at the DOM level rather than by reading the diff.

---

## Task Commits

1. **Task 1: the readiness verdict becomes representable** — `b5063fcd` (feat)
2. **Task 2: the verdict survives the one hop that could drop it** — `c6b64f17` (feat)
3. **Task 3: the D-05 baselines + four numstat criteria** — no source change by design
   (`files: none`); its evidence is this document, committed with it.

## Files Created/Modified

- `frontend/src/lib/api.ts` — modified (+21 / −1): `GenerateReadiness` + the widened `ok:true` arm
- `frontend/src/components/workflows/useTemplateFirstDraft.ts` — modified (+37 / −2): the type
  import, the widened `onDrafted` declaration, the second argument at the success transition
- `frontend/src/components/workflows/useTemplateFirstDraft.test.tsx` — modified (+176 / −3): the
  `vi.fn` spy beside the shipped recorder, seven cases, the re-spelled fence + its control
- `.planning/phases/197-guided-authoring/197-06-SUMMARY.md` — created

## Accomplishments

- D-13's verdict now crosses **the only hop in its five-hop chain that could drop it**, and absence
  crosses it as absence.
- The repository's hottest file gained a type and **nothing else** — 0 runtime exports, so
  `196-08`'s 249-failure mock-factory trigger is structurally unarmed rather than merely avoided.
- The D-05 red line was exercised for the first time in this phase and came back clean on all four
  rows plus all three shipped baselines, **69/69**, byte-for-byte with wave 1's pre-change reading.
- A source fence that had to change was **re-spelled and proved to discriminate**, which is the
  narrow path between "updated a test to make a red run green" and "deleted a guarantee".

## Decisions Made

- **The `api.ts` G-5 seam is DECLINED**, with the reason and a worded re-open trigger (above). Named,
  not silent.
- **No type-guard helper was added.** It would be a runtime export. Consumers narrow inline on
  `status`.
- **The page's `onDrafted` handler was not wired.** `WorkflowBuilderPage.tsx` is not in this plan's
  `files_modified`, and a 1-argument inline callback assigns to a 2-parameter signature without
  error, so the page compiles unchanged and simply ignores the new argument until a later plan
  spends it. ⚠ **This is the honest reading of must-have truth #1**: the verdict now survives *the
  hook boundary*, which is this plan's declared scope; the last hop into page state is owed by the
  plan that owns that file.
- **The count gate was not run.** Volume `C:` measured **14 GB free / 98 % used** with four sibling
  agents live — wave 1's measured `ENOSPC`-in-the-reporter condition, whose signature *reads as a
  gate failure while carrying no test verdict at all*. CLAUDE.md separately records that ≥ 3
  concurrent test-running agents make the gate non-deterministic regardless of cap. The plan's own
  `<verification>` names four suites and `tsc`, all of which are deterministic and all of which were
  run; the gate is a wave-merge / phase-close instrument and is left to the orchestrator on a quiet
  tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] The worktree forked from the wrong base SHA**

- **Found during:** setup, before Task 1
- **Issue:** `git rev-parse HEAD` read `fda79214…`, not the dispatched `7cf919f1…`; the merge-base
  was `3781a3fe…`. This is the *same* wrong SHA wave 1 measured — a reproducing defect, not a
  one-off. The tree was missing wave 1's merge, i.e. `197-01-SUMMARY.md`, i.e. **the four criteria
  this plan is required to run**.
- **Fix:** `git reset --hard 7cf919f1…` inside the branch-check step, per the executor contract.
  HEAD was verified to be on `worktree-agent-aad7b9abc90dbca1e` (in-namespace, not protected) both
  before and after; no protected ref was touched.
- **Verification:** `git rev-parse HEAD` → `7cf919f1…`; `git status --short` → empty
- **Committed in:** n/a (setup)

**2. [Rule 1 — Bug] The first `api.ts` edit produced TWO deletions where the criterion allows one**

- **Found during:** Task 1
- **Issue:** The `ok:true`-arm-only note was appended to `GenerateResult`'s existing docblock, which
  rewrote that block's closing line. `git diff --numstat` read **`22 / 2`** against a criterion of
  *fewer than 25 insertions and **zero or one** deletions (the single edited union line)*.
- **Fix:** The prose was **moved**, not the number waived — the note now lives in
  `GenerateReadiness`'s own docblock and `GenerateResult`'s docblock is byte-identical to the
  shipped one. This is the same posture the D-05 criterion mandates one level up: a red line is
  answered by moving the change, never by moving the line.
- **Files modified:** `frontend/src/lib/api.ts`
- **Verification:** `git diff --numstat` → **`21 / 1`**; the sole deleted line is
  `-  | { ok: true; definition: WorkflowDefinitionJSON }`
- **Committed in:** `b5063fcd`

**3. [Rule 2 — Missing Critical] The D-24(b) source fence pinned the exact declaration this plan widens**

- **Found during:** Task 2
- **Issue:** `useTemplateFirstDraft.test.tsx` asserts
  `/onDrafted: \(definition: TemplateFirstDefinition\) => void/` over the module's `?raw` source. The
  plan's `<action>` does not mention it. Widening the declaration reds it, and the tempting repair —
  loosening the matcher to `/onDrafted:/` — would silently retire the property the fence exists for
  (*"the args interface is the whole surface"*), letting a future store setter through.
- **Fix:** Re-spelled the matcher over the full new two-parameter, multi-line shape — pinning **both
  ends**, the definition parameter and the readiness parameter — and added a **discrimination
  control** asserting it does not match the old single-parameter spelling. Without that control the
  re-spelled fence would be a `toMatch` nobody had proved could fail.
- **Files modified:** `frontend/src/components/workflows/useTemplateFirstDraft.test.tsx`
- **Verification:** suite green at 65/65; the control is one of the 65
- **Committed in:** `c6b64f17`

**4. [Rule 2 — Missing Critical] `drafted` is structurally blind to the second argument**

- **Found during:** Task 2
- **Issue:** The shipped harness records `onDrafted` as `(def) => drafted.push(def)`. That array
  cannot express argument two **at all**, and in particular cannot distinguish a **one-argument
  call** from a two-argument call carrying `undefined` — which is precisely the distinction D-13
  turns on. Writing the new cases against `drafted` would have produced assertions that pass whether
  or not the plan's work was done.
- **Fix:** Added a `vi.fn` **beside** the shipped recorder (never instead of it, so every existing
  case keeps its spelling and its meaning), because `mock.calls[i]` is the **real** arguments array.
  The two new arity assertions read from it.
- **Files modified:** `frontend/src/components/workflows/useTemplateFirstDraft.test.tsx`
- **Verification:** `expect(onDraftedSpy.mock.calls[0]).toHaveLength(2)` in cases 1 and 4
- **Committed in:** `c6b64f17`

**5. [Rule 1 — Bug] A new docblock sentence contained a request-field name as a substring**

- **Found during:** Task 2
- **Issue:** A sweep of the added lines for the four accepted request-field names hit
  *"this verdict **describes** what the server said"*. Plan `197-02`'s half-B fence reads this
  file's **source** to decide which accepted fields are sent; a substring match would read as a
  mention, and the plan's own instruction is to name fields by role in any comment added here.
- **Fix:** Reworded to *"this verdict **is** what the server said"*. Fields are named by role
  throughout the new prose.
- **Files modified:** `frontend/src/components/workflows/useTemplateFirstDraft.ts`
- **Verification:** `git diff … | grep '^+' | grep -E 'describe|project_folder_id|template_asset_id|template_placeholders'` → **no matches**
- **Committed in:** `c6b64f17`

---

**Total deviations:** 5 auto-fixed (2 bugs, 2 missing-critical, 1 blocking). **No Rule 4 escalation.**
**Impact:** none on scope — no file outside `files_modified` was touched and no capability was added.
Three of the five (2, 3, 5) are cases where a shipped guardrail fired on this plan's own work and was
answered by changing the work rather than the guardrail.

## Issues Encountered

None beyond the deviations. All four in-scope suites and all three shipped baselines were green on
first run.

⚠ **One thing a later reader must not mis-read:** case 4 (`⚠ THE ABSENT-FIELD RULE`) is not a
hypothetical. Until plan `197-02`'s server half merges, **every** generation answers `{ok,
definition}` with no `readiness` key, so case 4 describes the live behaviour and cases 1-3 describe
the contract. That is by design (D-13 is additive and the field is optional), and it is exactly why
the absent case is the load-bearing one rather than a defensive extra.

## Contract vs shipped server — stated, per the wave-2 instruction

This plan was built against the contract as `197-06-PLAN.md`'s `<interfaces>` and `197-CONTEXT.md`'s
D-13 declare it, **not** against the currently-shipped server response, which carries no `readiness`
key. The sibling widening the server side (`197-02`) lands in a separate worktree merged after this
one and could not be observed from here. **The two are compatible by construction:** the field is
optional on the type, the hook passes it through without inspecting it, and the absent case is
pinned by a named test — so a merge order in either direction leaves the client honest. If the
merged server payload's key or arm names differ from `business_requirement` /
`present` / `missing`, the mismatch surfaces as a **typecheck error at the first consumer**, not as
a silent green tick, which is the property the three-state type was chosen for.

## Next Phase Readiness

**Ready.** What this plan hands forward:

1. **The last hop is owed.** `onDrafted`'s second argument is now available at the page's handler and
   is currently **ignored** — the page is not in this plan's `files_modified`. The plan that owns
   `WorkflowBuilderPage.tsx` spends it into page state. ⚠ It must NOT default it: `readiness ?? {}`
   and `readiness?.business_requirement.status === "missing"` with a green `false` branch are the two
   named failure modes, and both typecheck.
2. **The re-open trigger for the `api.ts` seam is live:** the next phase adding a **runtime** export
   there owes the G-5 refactor recommendation first, and separately owes one mock-factory line per
   `@/lib/api`-mocking suite (`196-08`'s measured cost: 249 failures across nine suites).
3. **The ledger row for `api.ts` is now `171 / 98 / 6174`** — re-derive at phase close; it moved on
   this plan's first commit.
4. **`useTemplateFirstDraft.ts` is at `5 commits / 2 phases / 630 lines`** (193.1, 197). Below G-5's
   threshold and correctly absent from the ledger — but **it owes a row and a detail section the
   moment a third phase touches it**, which on current trajectory is the next one.
5. **The four numstat criteria still owe a run at wave merge and at phase close.** They are clean as
   of `c6b64f17`; a later wave's edit is what they exist to catch.
6. **The count gate is owed on a quiet tree** (see Decisions). The per-file delta this plan
   contributes is `useTemplateFirstDraft.test.tsx` **58 → 65**, an INCREASE, which satisfies the
   gate's no-decrease contract without a pin change.

## Threat Flags

None new. The plan's register is discharged as written:

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-197-03 | **mitigated** | field optional on the type; hook passes `undefined` through unchanged; `grep` for any `?? {}` default → **0**; named case asserts `toBeUndefined()` + the three things it must not be, with a positive control |
| T-197-07 | **mitigated** | the `ok:false` arm gained nothing — absent from the diff; case 6 pins zero calls at runtime |
| T-197-16 | **mitigated** | `git diff \| grep -cE '^\+\s*export (const\|function\|class\|let\|var) '` → **0** |
| T-197-17 | **mitigated** | no send added; `template_asset_id` → **0**; no request-field name in any new comment (one near-miss corrected, deviation 5) |
| T-197-18 | **mitigated** | both characterization baselines green (39/39) plus the third (30/30); all four numstat rows absent from the diff |
| T-197-SC | **vacuous-with-reason** | no package installed, none proposed |

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| `api.ts` carries the type | `grep -c "GenerateReadiness" frontend/src/lib/api.ts` | **2** |
| hook carries the widened call | `grep -c "onDraftedRef.current(def, result.readiness)" …/useTemplateFirstDraft.ts` | **1** |
| Task 1 commit exists | `git log --oneline` | FOUND `b5063fcd` |
| Task 2 commit exists | `git log --oneline` | FOUND `c6b64f17` |
| only the 3 declared files changed | `git diff --numstat 7cf919f1… HEAD` | 3 paths, all declared |
| no STATE.md / ROADMAP.md write | same | absent |
| four D-05 criteria | `git diff --numstat 52e6bcdb… HEAD -- <4 paths>` | **empty output** |
| suites green | one `vitest run` over all four | `4 passed (4) · 148 passed (148)` |
| typecheck at baseline | `tsc --noEmit -p tsconfig.app.json` | **33**, none in this plan's files |

---
*Phase: 197-guided-authoring*
*Completed: 2026-08-18*
