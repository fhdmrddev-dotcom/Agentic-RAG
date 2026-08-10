---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 23
subsystem: workflow-studio-frontend
tags: [governance, seed-receipt, WR-11, WR-15, exhaustiveness, falsification]
requires:
  - "187-13 (SeedReceipt component + its suite)"
  - "187-16/187-20 (the CR-01 copy split that relocated the actor claim into the row)"
  - "187-22 (the CR-04 snapshot — which is what made the row's sentence unconditionally wrong)"
provides:
  - "an actor-free escalated reason: `it was set to must prove it by hand`, composed from GOVERNANCE_SEAL_LABEL"
  - "a `never` exhaustiveness guard on `seedReceiptStepReason` — a 4th GroundingCause is now a typecheck error"
  - "a no-second-person PROPERTY fence with two positive controls and three negative controls"
  - "a two-half WR-15 pin (runtime + `?raw` source) and the DOM no-empty-reason invariant"
affects:
  - frontend/src/components/workflows/definitionOps.ts
tech-stack:
  added: []
  patterns:
    - "prefer type-system exhaustiveness (`never`) over enumerating known members (Phase 185 lesson)"
    - "a property fence gets its positive control from a string the module GENUINELY still produces"
    - "a type guard is fenced twice — at runtime for totality, at source for the compile-time claim the runtime cannot see"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/definitionOps.ts
    - frontend/src/components/workflows/definitionOps.test.ts
    - frontend/src/components/workflows/SeedReceipt.test.tsx
    - .planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
decisions:
  - "WR-11's reachability hypothesis is RESOLVED as OBSERVED at the schema/validation layer — measured by executing the model, not by reading it"
  - "The sentence composes GOVERNANCE_SEAL_LABEL rather than avoiding the governance words: Req 7's vocabulary has one home"
  - "The plan's literal `npx tsc --noEmit` is a VACUOUS check in `frontend/` — the root tsconfig is a solution file with `files: []` (see Deviations)"
  - "`GROUNDING_WHY_ESCALATED` carries the same second-person claim on the PANEL surface — deferred, not swept in (D-ITEM-187-23-01)"
metrics:
  duration: ~35 min
  tasks: 2
  commits: 2
  completed: 2026-08-03
---

# Phase 187 Plan 23: the escalated row says what its bit knows — WR-11 + WR-15 Summary

The seed receipt's escalated row now states that the lock **was set by hand** instead of telling the reader **"you turned this on by hand"** — because the bit it is handed is a boolean that records *authored rather than derived*, never *who* — and a fourth `GroundingCause` member is a typecheck error at the formatter rather than a seal rendered with a dangling em-dash and no reason.

## Task-by-task

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | The actor-free sentence + the file's own `never` guard | `f59af16a` | `definitionOps.ts` (+99/−10), `deferred-items.md` (+10 net new) |
| 2 | Character identity, the no-actor property, the two-half exhaustiveness pin, the DOM invariant | `7b1356c3` | `definitionOps.test.ts` (+112/−1), `SeedReceipt.test.tsx` (+58) |

---

## 1. The reachability finding — OBSERVED, not inherited

The review recorded the model-emission path as *"reachable by construction, not observed"* and said so deliberately. The plan made resolving it a deliverable. **It is now observed at the schema and validation layer** — not by reading the source, but by executing the shipped model in the project venv.

### The source lines read

| Fact | File:line read at live HEAD |
|---|---|
| `grounding_escalated` is an ordinary `PhaseSpec` field, a plain `bool = False` | `backend/app/models/harness.py:234` |
| The emit tool's schema is the **whole** `WorkflowDefinition` | `backend/app/services/workflow_authoring.py:140` (`WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))`), advertised at `:143-150` as `EMIT_TOOL.function.parameters` |
| The emission is validated by that model (`schema_model=WorkflowDefinition`) | `backend/app/services/workflow_authoring.py:297-307` |
| **Nothing on the success path resets the bit.** Only `name_seeded_by_ai` and `slug` are re-stamped server-side | `backend/app/services/workflow_authoring.py:341-375` |
| The response is the validated model dumped verbatim | `backend/app/services/workflow_authoring.py:377` — `return {"ok": True, "definition": wd.model_dump(mode="json")}` |

### The measurement

```
$ cd backend && ./venv/Scripts/python.exe -c "..."
grounding_escalated in PhaseSpec schema properties: True
schema entry: {'default': False, 'title': 'Grounding Escalated', 'type': 'boolean'}
validate w/ grounding_escalated=True -> True
model_dump carries it -> True
```

**The verdict, labelled precisely.** The bit is **advertised** to the model in the emit tool's schema (observed), an emission carrying it **validates** (observed), and it **survives to the client verbatim** (observed — the model dump carries it and no line between `model_validate` and `return` touches it). What remains **un-observed** is a real provider actually choosing to emit `true` on a live generation — that is a behavioural question about model output, not a question about whether the path exists, and it cannot be settled without driving generations across the roster.

So: the *path* is **observed end-to-end**; the *traversal* is **reachable-by-schema**. The review's own framing was one notch too weak on the first half and correct on the second. Either way the fix stands on its own second leg, which the plan asked to be stated plainly: **a sentence must not claim more than its input knows.** `seedReceiptStepReason` is handed a `GroundingCause`. It is never handed an actor. Under 187-22's snapshot the CR-04 path (where the author genuinely did the act) no longer reaches this card at all, so the old sentence had lost even its accidental truth.

---

## 2. The sentence

```ts
case "escalated": {
  const words = GOVERNANCE_SEAL_LABEL.toLowerCase()
  return `it was set to ${words} by hand`
}
```

**It composes `GOVERNANCE_SEAL_LABEL`** — the third composition in the module, joining `seedReceiptGroundingLead` and `seedReceiptCarriedLead`. The alternative the plan permitted (wording that avoids the governance words entirely) was rejected: the row's job is to say *what* the step is now held to and *how it got there*, and dropping the vocabulary would have made the row the only sealed-step sentence on the card that does not speak the locked words. Composing costs one line and removes the drift risk entirely.

Properties, each asserted rather than asserted-about:

| Property | How it holds |
|---|---|
| Names no actor | no second-person pronoun; fenced as a property on whole words |
| Same register as its siblings | starts with `it `, a clause about the STEP (`it reads your documents`, `it already has to cite its sources`) |
| States what the bit carries | "set … by hand" = authored rather than derived; no principal |
| One home | still pinned by exactly one character-identity assertion — which is why exactly one case went red |
| Not a substring of the carried lead | verified: the carried-lead needle fences (`not.toContain(seedReceiptStepReason("escalated"))`) stayed green through Task 1's red |

---

## 3. The exhaustiveness guard

`case null:` became its own arm and `default:` became the file's own idiom — copied from `requiredConfigFor` (`definitionOps.ts:886-887`), itself documented as *"the `deriveTier.ts:119-127` runtime-safe exhaustiveness guard"*:

```ts
case null:
  return ""
default: {
  const _never: never = cause
  void _never
  return ""
}
```

This is the Phase 185 lesson applied directly: **a deny-list cannot be made fail-closed by extension.** Enumerating the three known causes and hoping the fourth gets noticed is the deny-list; binding the residual to `never` puts the obligation in the type system, where a fourth member cannot be added without the compiler naming this function.

```
$ grep -n "_never" frontend/src/components/workflows/definitionOps.ts
717:      const _never: never = cause     ← new
718:      void _never
886:      const _never: never = type      ← the shipped requiredConfigFor guard
887:      void _never
```

---

## 4. Re-measured baselines (never inherited)

Every figure below was produced at HEAD **before** any edit in this plan. The plan explicitly warned not to inherit `228` and `60`; `60` was indeed stale — 187-22 moved it to 63.

```
$ cd frontend && npx vitest run src/components/workflows/definitionOps.test.ts
      Tests  228 passed (228)

$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx
      Tests  63 passed (63)

$ cd frontend && npx vitest run <both>
      Tests  291 passed (291)
```

| File | Before | After | Δ |
|---|---|---|---|
| `definitionOps.test.ts` | 228 | **231** | +3 |
| `SeedReceipt.test.tsx` | 63 | **66** | +3 |
| **both** | **291** | **297** | **+6** |

Both counts strictly greater. Nothing was replaced or absorbed (the Phase-177 coverage-loss class): the only pre-existing case edited is the one character-identity assertion whose literal moved.

### Typecheck

```
$ npx tsc --noEmit -p tsconfig.app.json   (BEFORE)  → exit 2, 33 error lines, 0 in definitionOps
$ npx tsc --noEmit -p tsconfig.app.json   (AFTER)   → exit 2, 33 error lines, 0 in definitionOps or SeedReceipt
$ diff <before> <after>                              → BYTE-IDENTICAL
```

33 → 33 against the recorded `D-ITEM-01` baseline, and the two outputs are byte-identical, so not one error moved, changed shape or changed file.

---

## 5. Task 1 — the expected RED, transcribed verbatim

```
$ cd frontend && npx vitest run src/components/workflows/definitionOps.test.ts src/components/workflows/SeedReceipt.test.tsx

 ❯ src/components/workflows/definitionOps.test.ts (228 tests | 1 failed) 45ms
     × the reason formatter CLASSIFIES nothing — it renders the cause it is handed 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/workflows/definitionOps.test.ts > definitionOps — the seed-receipt copy is a lock (sketch 150-B) > the reason formatter CLASSIFIES nothing — it renders the cause it is handed
AssertionError: expected 'it was set to must prove it by hand' to be 'you turned this on by hand' // Object.is equality

Expected: "you turned this on by hand"
Received: "it was set to must prove it by hand"

 ❯ src/components/workflows/definitionOps.test.ts:896:48

 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 290 passed (291)
```

**Read against the acceptance bar:**

- **Exactly one** case failed, and it is the character-identity pin. That is the proof the sentence had exactly one home and that changing it is visible.
- **No other case failed** — in particular the carried-lead fences that use `seedReceiptStepReason("escalated")` as a *needle* stayed green, because they compare by identity, not by literal. The new sentence did not become a substring of the carried lead, so no fence had to be relaxed.
- All **63** `SeedReceipt.test.tsx` cases stayed green, including the escalated row's POSITIVE CONTROL — it asserts by identity against the export, exactly as the plan predicted it would.

### Task 1 acceptance greps

```
$ grep -rn "you turned this on by hand" frontend/src/
definitionOps.test.ts:896   ← the pinned assertion (Task 2 retires this literal entirely)
definitionOps.ts:475        ← GROUNDING_WHY_ESCALATED — a DIFFERENT export, a different surface
SeedReceipt.test.tsx:547    ← historical prose in a comment

$ grep -n "_never" frontend/src/components/workflows/definitionOps.ts   → 2 hits (717, 886)
$ git diff --name-only -- backend/ supabase/migrations                   → (empty)
```

**Zero hits inside `seedReceiptStepReason`'s return expressions**, which is the property the criterion is about. The `definitionOps.ts:475` hit is `GROUNDING_WHY_ESCALATED = "Because you turned this on by hand."` — the *panel's* dial why-line, not the receipt row. The plan's action says "Change nothing else in this file", so it was logged rather than swept in: **`D-ITEM-187-23-01`**.

---

## 6. Task 2 — the GREEN, transcribed verbatim

```
$ cd frontend && npx vitest run src/components/workflows/definitionOps.test.ts
      Tests  231 passed (231)

$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx
      Tests  66 passed (66)

$ cd frontend && npx vitest run <both>
 Test Files  2 passed (2)
      Tests  297 passed (297)

$ cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx
 Test Files  1 passed (1)
      Tests  117 passed (117)      ← 187-22's three CR-04 cases + its source pin, all still green
```

### What each new fence actually asserts

| Fence | File | Property | Its positive control |
|---|---|---|---|
| character identity | `definitionOps.test.ts` | the sentence has exactly one home | (it IS the lock) |
| no second person | `definitionOps.test.ts` | `/\b(you\|your\|yours\|yourself)\b/i` does not match, on the bare and tool-qualified calls | (a) `seedReceiptStepReason("detected")` — a sentence the module **genuinely still produces** — DOES match; (b) the retired literal, assembled from parts, DOES match. Plus three NEGATIVE controls ("youthful", "young", "beyond") proving word-boundary anchoring |
| meaning retained | `definitionOps.test.ts` | still contains the governance words and "by hand", still starts with `it ` | — (this IS the control against satisfying "no actor" by deleting the meaning) |
| WR-15 runtime | `definitionOps.test.ts` | an unmodelled cause returns `""` and does not throw; `null` still returns `""` | the three modelled members all return non-empty |
| WR-15 source | `definitionOps.test.ts` (`?raw` purity block) | the `never` binding appears **inside `seedReceiptStepReason` specifically** (extracted, with vacuity guards excluding `requiredConfigFor` and `seedReceiptCarriedLead`), and `case null:` is its own arm | a planted bare-`default: return ""` literal in the exact pre-187-23 shape, which the pattern must NOT match |
| DOM no-empty-reason | `SeedReceipt.test.tsx` | over all three sealed fixtures, every `seed-receipt-step-reason` node has non-empty trimmed `textContent`; and no row's text ends at the em-dash | the formatter really returns `""` for `null`, and a row assembled face-dash-reason with that empty reason DOES match `/—\s*$/`, while one with a real reason does not |

The `escalated` row's shipped POSITIVE CONTROL case (`the ROW still names the cause the paragraph withholds`) needed **no edit** — it compares by identity against the export. Nothing crept in as a literal.

---

## 7. The three falsification probes — each observed red, each reverted clean

### Probe 1 — revert the sentence to the second-person wording

Applied: `return "you turned this on by hand"` in the `escalated` arm.

```
     × the reason formatter CLASSIFIES nothing — it renders the cause it is handed 6ms
     × the escalated reason NAMES NO ACTOR — a property, with a positive control (WR-11) 1ms

AssertionError: expected 'you turned this on by hand' to be 'it was set to must prove it by hand'
AssertionError: expected 'you turned this on by hand' not to match /\b(you|your|yours|yourself)\b/i

 Tests  2 failed | 295 passed (297)
```

**Both** required cases bit — the identity pin AND the property fence, which is the point: the property would have caught *any* second-person rewording, not only this one.

```
$ git checkout -- frontend/src/components/workflows/definitionOps.ts
$ git diff --stat -- frontend/src/components/workflows/definitionOps.ts
(clean revert — no diff)
$ grep -n 'it was set to ${words} by hand' frontend/src/components/workflows/definitionOps.ts
710:      return `it was set to ${words} by hand`
```

### Probe 2 — replace the `never` guard with a bare `default: return ""`

```
     × guards `seedReceiptStepReason` with a `never` binding, not a bare default (WR-15) 6ms

AssertionError: expected 'export function seedReceiptStepReason…' to match /const\s+_never\s*:\s*never\s*=\s*caus…/

 Tests  1 failed | 296 passed (297)
```

Exactly the **source half** failed — and the runtime half stayed green, which is the empirical proof of the plan's claim that *"the runtime half alone cannot see the typecheck guard"*. One half without the other would have shipped this mutation silently.

```
$ git checkout -- frontend/src/components/workflows/definitionOps.ts
$ git diff --stat -- frontend/src/components/workflows/definitionOps.ts
(clean revert — no diff)
$ grep -n "_never" frontend/src/components/workflows/definitionOps.ts
717:      const _never: never = cause
718:      void _never
886:      const _never: never = type
887:      void _never
```

### Probe 3 — make `seedReceiptStepReason` return `""` for `escalated`

```
     × no rendered reason is empty or blank, across every sealed fixture 9ms
     × no row's text ends at the em-dash — the consequence, in what a reader sees 6ms
     × POSITIVE CONTROL — the formatter really can return the empty string, and that row WOULD dangle 0ms

AssertionError: the escalated-only draft: expected '' not to be ''
AssertionError: the escalated-only draft / judgement: expected '⛨Must prove itWeigh the supplier opti…' not to match /—\s*$/

 Tests  3 failed | 63 passed (66)
```

The second failure message is the defect **in the words a reader would see**: `⛨ Must prove it — Weigh the supplier options — ` ending at the dash, on the one surface whose entire job is that a seal never arrives unexplained. The per-fixture label in the assertion named *which* draft broke it without any extra debugging.

```
$ git checkout -- frontend/src/components/workflows/definitionOps.ts
$ git diff --stat -- frontend/src/components/workflows/definitionOps.ts
(clean revert — no diff)
$ git status --porcelain -- frontend/
 M frontend/src/components/workflows/SeedReceipt.test.tsx
 M frontend/src/components/workflows/definitionOps.test.ts    ← only the Task-2 test files remained
```

---

## Deviations from Plan

### 1. [Rule 1 — inherited claim falsified] bare `npx tsc --noEmit` in `frontend/` checks NOTHING

**Found during:** Task 1 acceptance.
**Claim:** the plan says *"`npx tsc --noEmit` (from `frontend/`) reports no NEW error … against the 33 pre-existing project errors recorded as `D-ITEM-01`"*.
**Measured at HEAD before any edit:**

```
$ cd frontend && npx tsc --noEmit                       → exit 0, ZERO output, 0 error lines
$ cat frontend/tsconfig.json
{ "files": [], "references": [ {"path": "./tsconfig.app.json"}, {"path": "./tsconfig.node.json"} ] }
```

The root `tsconfig.json` is a **solution file** with `files: []`, so the bare command type-checks zero files. It cannot reproduce the 33-error baseline and — the part that matters — **it cannot detect a new error either.** Running it and reporting "0 errors, no regression" would have been a green light that measured nothing.

**Re-derived command:** `npx tsc --noEmit -p tsconfig.app.json` (the form plan 187-22 already used) → **33 before, 33 after, byte-identical output, 0 in the touched files.** The criterion's intent is satisfied; its literal spelling is not usable. Logged as `D-ITEM-187-23-02`. The recorded project lesson (`tsc -b` ≠ `--noEmit`) still holds — this is a **second, separate** trap in the same area.

### 2. [Scope boundary — logged, not fixed] `GROUNDING_WHY_ESCALATED` carries the same claim

`definitionOps.ts:475` — `"Because you turned this on by hand."` — is the same second-person claim over the same bit, on the grounding dial's why-line in `PhaseFormPanel`. The plan's action says *"Change nothing else in this file"*, and the case is genuinely weaker (the panel line renders beside the dial the author is operating, so on the ordinary path the reader has just performed the act). Logged as `D-ITEM-187-23-01` with a concrete re-open trigger. **Not fixed, not silently swept in.**

### 3. [Rule 1 — the review's suggested wording verified, then adopted] the fix text

The review proposed `"it was set to must prove it by hand"` as a literal. A review's suggestion is a claim, not an artifact — so before adopting it the properties were checked independently: no second person; starts with `it `; not a substring of the carried lead (which would have broken the shipped `not.toContain` needle fences); passes the overclaim sweep (`prove` ≠ `proven` under `\b`); distinct from both siblings. It passed all of them, and the governance words were then **composed from `GOVERNANCE_SEAL_LABEL`** rather than typed as a literal — which is the one place the review's snippet, taken verbatim, would have introduced a third hand-typed copy of Req 7's locked vocabulary.

### 4. [No deviation — recorded because it was checked] the review's suggested TEST was NOT copied

WR-15's review text suggests, "cheaply, assert the invariant in the DOM: every `seed-receipt-step-reason` node has non-empty `textContent`". That is exactly one assertion over one fixture and it would have passed **before and after** the fix if written against the default fixture only. What shipped is the property over **all three sealed fixtures**, plus the consequence (`no row ends at the em-dash`), plus a positive control proving the invariant is capable of failing — and probe 3 observed all three biting.

---

## Known Stubs

None. No placeholder values, no hardcoded empty data reaching the UI, no TODO/FIXME added. The one deliberate empty-string return (`case null`) is the shipped D-187-10 arrival shape — the caller renders no row for it — and it is now fenced in the DOM so it can never reach a rendered row.

## Threat Flags

None new. This plan adds no endpoint, no request, no auth path, no file access, no persisted field and no schema change; `definitionOps.ts` remains import-pure (the purity fences ran green). The register's four dispositions are discharged as follows:

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-187-R4-06 | mitigate | **CLOSED** — the sentence names no principal; property-fenced with two positive controls |
| T-187-R4-07 | accept | **ACCEPTED as recorded** — an author who really did escalate now sees *that* the lock was set by hand, not *by whom*. Re-opening second-person phrasing requires a governance provenance bit of the `name_seeded_by_ai` shape, which this round does not add; the requirement is written into the function's docblock so the next author finds it |
| T-187-R4-08 | mitigate | **CLOSED** — `never` guard + the DOM invariant, the latter observed red under probe 3 |
| T-187-R4-09 | mitigate | **CLOSED** — the reachability claim was measured by executing the model, and the finding is labelled observed-vs-reachable rather than left ambiguous |
| T-187-R4-SC | accept | Not engaged — zero package-manager installs, zero new dependencies |

## Requirements

`VOCAB-02` is exercised by this plan but is **NOT** marked complete here. Per the project's standing rule, `requirements.mark-complete`, `state.advance-plan` and `roadmap.update-plan-progress` write false completion records and were **not called by any task in this plan**. The orchestrator owns those writes.

## Self-Check: PASSED

```
$ [ -f frontend/src/components/workflows/definitionOps.ts ]        → FOUND
$ [ -f frontend/src/components/workflows/definitionOps.test.ts ]   → FOUND
$ [ -f frontend/src/components/workflows/SeedReceipt.test.tsx ]    → FOUND
$ [ -f .planning/phases/187-.../deferred-items.md ]                → FOUND

$ git log --oneline -3
7b1356c3 test(187-23): fence the no-actor property and the exhaustiveness guard, each with a positive control
f59af16a fix(187-23): the escalated reason names no actor, and a 4th cause is a typecheck error
5e0db585 docs(187-22): record the CR-04 close in STATE.md
```

Both commit hashes exist. All three declared artifacts carry their required `contains` tokens: `definitionOps.ts` → `_never` (2 hits); `definitionOps.test.ts` → `WR-11`; `SeedReceipt.test.tsx` → `seed-receipt-step-reason`. `git diff --name-only -- backend/ supabase/migrations` is empty and `git status --porcelain supabase/migrations` is empty.
