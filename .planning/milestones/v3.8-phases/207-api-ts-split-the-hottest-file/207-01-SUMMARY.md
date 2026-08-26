---
phase: 207-api-ts-split-the-hottest-file
plan: 01
subsystem: frontend / api-client
tags: [refactor, guardrail-debt, g-5, re-export-barrel, vi-mock-census, source-fences, driven-red]
authored: after-execution
requires:
  - "Phase 206 landing first — it added the last two runtime exports before the split"
  - "docs/HOT-FILE-LEDGER.md → frontend/src/lib/api.ts (the 204-03 trigger)"
provides:
  - "frontend/src/lib/api.ts as a 412-line re-export barrel at its ORIGINAL path"
  - "12 domain modules under frontend/src/lib/api/"
  - "An export surface identical in BOTH directions — 325 before, 325 after"
  - "frontend/src/lib/apiSource.testutil.ts — the ONE home for the source-sweep concatenation"
  - "The api.ts ledger trigger RETIRED, not re-declined"
affects:
  - "frontend/src/lib/api.ts"
  - "frontend/src/lib/api/{_core,threads,documents,skills,settings,knowledge,workflows,tuner,admin,org,connectors,schedules}.ts"
  - "frontend/src/lib/apiSource.testutil.ts"
  - "frontend/src/lib/apiRunFields.fences.test.ts"
  - "frontend/src/pages/WorkflowBuilderPage.header.test.tsx"
  - "frontend/src/components/workflows/TemplateNameCheck.test.tsx"
  - "CLAUDE.md"
  - "docs/HOT-FILE-LEDGER.md"
commits:
  - "48ca158b — refactor(207): api.ts split — 6,815 → 412 lines, 12 modules behind a barrel"
---

# Phase 207 plan 01 — SUMMARY

⚠ **Authored AFTER execution.** No `discuss-phase`, no `plan-phase`, no plan-checker — see
`207-CONTEXT.md` → *Process deviation*. Every figure below was measured at the time.

## What shipped

| | before | after |
|---|---|---|
| `lib/api.ts` | 6,815 lines | **412** (re-exports only, 0 logic lines) |
| modules | 1 | **12** under `lib/api/` |
| exported symbols | 325 | **325** — identical in BOTH directions |
| ledger triple | `180 / 103 / 6728` | **`182 / 105 / 412`** |
| `tsc -p tsconfig.app.json` | 34 | **34** (0 inside `lib/api/`) |
| count gate | — | **OK · 114/114 · failed 0 · total 5755** |
| `vi.mock` census | 108 files / 118 sites | **108 / 118, all still `@/lib/api`** |

Module sizes: `_core` 150 · `threads` 1,549 · `documents` 278 · `skills` 685 · `settings` 387 ·
`knowledge` 723 · `workflows` 1,021 · `tuner` 280 · `admin` 969 · `org` 488 · `connectors` 278 ·
`schedules` 124.

## The structure that made this tractable

**Only 13 of 6,815 lines' worth of declarations are module-private**, and their reference counts
decided the seams: `API_BASE` (used by ~198 blocks), `getAuthHeaders` (199) and `getAuthToken` (11)
went to `_core`; the rest (`proposalError`, `platformAuditParams`, `errorDetail`, `orgAuditParams`,
`ssoErrorDetail`, `readConnectorReasonCode`, `readScheduleFailure`, `_mapMessageResponse`,
`MessageResponseDTO`, `_activeOrgId`) sit adjacent to their only callers and travelled with them
under D-207-02's contiguous cut.

## ⚠ Three things this phase MEASURED rather than assumed

### 1 — a scanner that strips template literals destroys the main dependency

The first generated modules were missing their `API_BASE` import and `tsc` reported **196 ×
`Cannot find name 'API_BASE'`**. Cause: `${API_BASE}/…` is how ~200 blocks reference it, and the
comment/string stripper was eating the whole template **including its interpolations**. Fix: keep
`${…}`, strip only the literal text. ⚠ **Without a project-scoped typecheck this ships silently** —
the modules parse fine.

### 2 — `supabase` must be matched as a VALUE USE, not a bare token

`tuner.ts` carries an interface field literally named `supabase`, so a token test imported the client
into a module that never calls it (TS6133). The test is `\bsupabase\s*\.`.

### 3 — three shipped fences went RED, and the obvious fix was the wrong one

`apiRunFields.fences.test.ts`, `WorkflowBuilderPage.header.test.tsx` and `TemplateNameCheck.test.tsx`
each imported `@/lib/api?raw` and assert on the client's source text — **8 assertions failed** once
that returned a 412-line barrel.

⚠ **Two of the three open with a non-vacuity control** (`expect(src.length).toBeGreaterThan(100000)`)
whose entire job is to prove the sweep read something. **Lowering that threshold would have left them
GREEN AND BLIND** — strictly worse than the red they were showing. Instead `lib/apiSource.testutil.ts`
became the one home for "the api client's source as one string", and each fence changed by exactly
one line. All three suites: **117 / 117 pass.**

## ⚠ A fourth thing, caught by the acceptance check rather than by a test

The generated module docblocks originally spelled `vi.mock("@/lib/api")` literally, and the mock
census greps for that literal — so **the census read 122 files / 133 sites instead of 110 / 120,
inflated by the modules' own prose.** That is the 187-24 trap in its counting form. The docblocks were
reworded, and the census was scoped to test files, where it means something.

⚠ One genuine `vi.mock` mention remains in the api source — a pre-existing comment at
`api.ts:1401` that moved verbatim to `api/threads.ts:1266`. It is prose, it moved with its block, and
it is why the raw census and the test-scoped census differ by one.

## Declared deviation from SC#3

SC#3: *"zero lines changed in any file that imports from `@/lib/api`"*. Two of the three fences live
outside `lib/`, and `WorkflowBuilderPage.header.test.tsx:136` also carries a **type** import from
`@/lib/api` — untouched, still resolving through the barrel.

**So the literal criterion is missed by one line in one file, and the property it protects is fully
met: not one API CALL SITE changed.** Both diffs are `+1 / −1`, and both changed lines are the `?raw`
sweep — asserted mechanically in the acceptance run, not claimed.

## SC#5 — the trigger is retired

The ledger row now reads **`✅ SPLIT TAKEN (207)`**, with the narrative in
`docs/HOT-FILE-LEDGER.md` under the same-commit sync rule. ⚠ **This dogfooded Phase 208's new
guard**: the new cell is 174 chars, under the 200-char cap, and the gate passed.

## The new obligation this creates

⚠ **Adding an export now costs TWO edits — the module AND the barrel, same commit.** A symbol
exported from a module but absent from the barrel is invisible to every consumer while typechecking
perfectly inside `lib/api/`. Nothing enforces this yet; it is deferred with a re-open trigger.
