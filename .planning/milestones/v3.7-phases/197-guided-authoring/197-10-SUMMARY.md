---
phase: 197-guided-authoring
plan: 10
subsystem: frontend
tags: [auth-02, guided-authoring, d-19, d-15, identity-slot, byte-pin, scope-fence, seed-171]

# Dependency graph
requires:
  - phase: 197-05
    provides: "setName — the one write path onto `meta.name`, which this plan finally DISPLAYS"
  - phase: 197-09
    provides: "the arrival card mounted on this page, whose row 4 is the control this header now agrees with"
provides:
  - "`identityLabel` — the ONE identity expression: `meta.name` when non-empty, else `meta.slug`, else the shipped fallback"
  - "The recorded disposition of `FLAG_OFF_HEADER_MARKUP` band 3: NO third re-capture was forced, dated and reasoned"
  - "+4 header-suite cases pinning name / no-name / empty-name precedence and D-15's untouched slug"
  - "197-09's D-19 scope fence retired and replaced by a strictly stronger live-agreement assertion"
affects: [197-11, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A byte-pin disposition is DECLARED in both directions — 'the pin did not move' is written up with the same per-band delta table a re-capture would carry, plus a positive control proving the green is not vacuous"
    - "A scope fence planted by plan N is RETIRED by plan N+1 rather than deleted: the superseded assertion and its note are preserved verbatim inside the replacement comment"

key-files:
  created: []
  modified:
    - "frontend/src/pages/WorkflowBuilderPage.tsx (+30 / -1)"
    - "frontend/src/pages/WorkflowBuilderPage.header.test.tsx (+156 / -0)"
    - "frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx (+26 / -4) — DEVIATION, declared"

key-decisions:
  - "BRANCH A: no third re-capture of FLAG_OFF_HEADER_MARKUP was forced. The suite's fixture `definition` binds no `name`, so the slot still resolves to `meta.slug` and band 3 is byte-identical. `git diff --numstat` on that file: 0 deletions"
  - "A NAMED DEVIATION from D-19's literal `meta.name ?? meta.slug`: the non-empty check is a DISPLAY fallback, never a validation rule, because row 4's write neither trims nor rejects the empty string"
  - "D-15's 'the slug is untouched' is proved off the STORE, not the DOM — once the slot prefers the name, the slug's absence from the screen is what this change is supposed to cause"
  - "197-09's D-19 scope fence in canvas.test.tsx is retired, not deleted, and its replacement is strictly stronger: it proves the header shows the name the author just typed, live"

patterns-established:
  - "An inherited test-count pin is re-derived, never trusted: this plan's was written as 27 and measured 32"

requirements-completed: [AUTH-02]

# Metrics
completed: 2026-08-18
---

# Phase 197 Plan 10: The Drafted Header's Identity Slot Summary

**The workflow's name is now displayed on the screen the author edits it on — the drafted
header's identity slot renders `meta.name` when there is one and `meta.slug` when there is not
— and the byte pin everyone expected this to break was measured, found unmoved, and written up
with the same rigour a re-capture would have received.**

---

## The headline: the name was displayed NOWHERE, and now it is displayed in exactly one place

Before this plan, `WorkflowBuilderPage.tsx` rendered `{meta.slug ?? "Untitled workflow"}` in the
header and `meta.name` appeared in **no render position anywhere on the page**. D-15 accepted in
words that *"name and slug can disagree"*, but it was written before anyone had measured that
absence — so what D-15 accepted was a **latent** disagreement. Shipping `197-09`'s arrival card
(whose row 4 edits the name) without this would have shipped a **rendered** one:
`northwind-qbr-fa65a43c` in the header against `Northwind QBR` in the card, on one screen.

The fix is one expression:

```tsx
const identityLabel =
  typeof meta.name === "string" && meta.name.length > 0 ? meta.name : (meta.slug ?? "Untitled workflow")
```

Row 4 and the identity slot read the **same live store value**, so they agree by construction
rather than by synchronisation. That is now the thing a test fails on, not a thing a comment
asserts.

---

## The band-3 disposition, declared: **BRANCH A — no third re-capture was forced**

This is the plan's headline uncertainty and the phase's stated success criterion, so it is
answered plainly and with its evidence.

`197-CONTEXT.md` D-19 priced a third re-capture. The plan priced one. `197-09` deliberately
declined to touch the identity span *specifically so this plan could pay for it in isolation*.
**It was not owed.**

| evidence | value |
|---|---|
| `git diff --numstat <base> HEAD -- WorkflowBuilderPage.header.test.tsx` | **`156  0`** — **ZERO deletions**, branch A's stated evidence |
| `FLAG_OFF_HEADER_MARKUP` literal | **untouched**, byte-identical |
| band 1 / 2 / 3 tag deltas | **NONE** in all three |
| band 1 / 2 / 3 non-empty text nodes | **3→3, 4→4, 4→4**, identical |
| both byte-pin cases (`OFF_VARIANTS[0]` and the operator-like map) | **green, unedited** |

**Why, and it is a fact about the FIXTURE rather than about the change.** `openDraftBuilder`
drives the suite's hand-authored `definition`, which binds **no `name`** — so the slot still
resolves to `meta.slug`, still renders `vendor-brief`, and the captured literal is still exactly
the bytes a flag-off user receives.

⚠ **The trap that would have predicted the opposite:** `draftRow.name` **is** `"Vendor brief"`.
But that is the **ROW's** name and it feeds band 1's breadcrumb (`Edit · Vendor brief v1`); only
the **DEFINITION** reaches `meta`. Conflating the two predicts a moved band 3 and is wrong.

**⚠ And the green is not vacuous — this is the only thing that makes the entry worth anything.**
A pin over a **dead** expression stays green too and proves nothing. The new case *"renders the
NAME, not the slug, when the definition binds one (flag OFF)"* drives the **same flag-off
surface** with a definition that **does** bind a name and reads the name back out of the slot. It
**fails against the pre-change page** — `AssertionError: expected 'vendor-brief' to be 'Northwind
QBR'` — and passes after. So the slot is provably live, and the entry says *"the fixture binds no
name"*, never *"the change did nothing"*.

**The `TWO OF TWO` note at `:378-382` is VINDICATED, not superseded.** It predicted no third and
there was none; the literal now stands into a **tenth** phase. A dated 2026-08-18 entry was
appended to the note block recording all of the above — including **what would** force a third
(anyone who gives this fixture a `name`), and that it must be paid under the file's own four-part
procedure rather than as a paste. The disposition is written up in a re-capture's full detail
because *"nothing happened"* is a measurement, and because the next author must be able to tell a
pin that was **TESTED** against a change from one that was merely **left alone**.

---

## Deviations from Plan

### 1. `[Rule 3 - Blocking]` `WorkflowBuilderPage.canvas.test.tsx` — 197-09's D-19 scope fence, retired

**Found during:** Task 2's full verification run.
**Not in `files_modified`.** Declared here rather than absorbed.

`197-09` planted, at `canvas.test.tsx:4146`:

```tsx
// ⚠ D-19 IS PLAN 197-10'S, NOT THIS ONE'S, and this line pins the boundary so a header
// change cannot be smuggled in here. The drafted header still renders `meta.slug`.
expect(screen.getAllByText("vendor-brief").length).toBeGreaterThan(0)
```

That was a **scope boundary**, never a claim about the product, and it went red the moment Task 1
landed — which is **how a scope boundary is supposed to end its life**. Retired, not deleted: the
case it lives in *is* row 4's write, the very thing D-19 makes visible.

**⚠ The procedure separated "real" from "flake", not the colour.** `canvas.test.tsx` is one of
SEED-171's five named suites, so the red was checked against the diff before anything was
re-run: the assertion's own comment names `197-10` and D-19 **by number**, and it was the only
case of 153 in that file that moved. Real, and predicted a wave earlier.

**What replaces it is strictly stronger.** The old line proved the header was **not** showing the
name. The new one proves the header **is** showing the name the author just typed, live, after
one edit — and asserts it in **both directions** (`vendor-brief` must be **gone**, via
`queryAllByText(...)` → length `0`), because a containment-only check passes on a header that
renders both, which is precisely the drift D-19 exists to prevent. The superseded assertion and
its full note are preserved verbatim inside the replacement comment.

- **Commit:** `62f38ac0`

### 2. `[Named deviation from D-19, by the plan's own instruction]` the non-empty check

D-19's literal text is `meta.name ?? meta.slug`. Shipped is `typeof meta.name === "string" &&
meta.name.length > 0`. Reason: `setName` deliberately does **not** trim and does **not** reject
the empty string (the server owns emptiness — `197-05`), so an author who *clears* the field
would otherwise be shown a **blank identity slot**.

It is a **display fallback, not a validation rule**: no store action, no request and no predicate
learns anything from it, and nothing downstream reads it. It is pinned by its own case so a later
author cannot "tidy" it back into a coalesce.

### 3. `[Rule 3 - Blocking]` one new tsc error, introduced and fixed inside Task 2

The new `openDraftWithDefinition` helper's default argument is `OFF_VARIANTS[0].value`, whose
declared type is nullable (the *"no provider at all"* variant). Narrowing the parameter to
non-null made the function reject **its own default**. tsc went `33 → 34`; widening the parameter
to `| null` — mirroring `openDraftBuilder`'s own signature — returned it to **33**. Caught by the
typecheck, not shipped.

---

## Verification

| check | result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **33 errors** — the standing baseline, unmoved. **0** in any file this plan touched |
| header + canvas + describe + both baselines | **258 passed / 0 failed** (5 files) |
| `WorkflowBuilderPage.header.test.tsx` alone | **32 → 36** (+4) |
| `vitest-count-gate.cjs` | **`count gate OK` · total 4447 · failed 0 · pinned total 4217 · 89/89** |
| `grep -c "meta.name" WorkflowBuilderPage.tsx` | **5** (≥ 1 required) |
| forbidden writes in the changed block (`setName\(`, `meta\.slug *=`) | **0** |
| identity `<span>` class list + `draft` badge | **byte-unchanged** — neither appears as a `+`/`-` line |
| new element node inside the identity `<span>` | **none** — still a single text child |
| `preDraft.baseline.test.tsx` · `WorkflowDoorSwitch.baseline.test.tsx` | **no numstat entry at all** — untouched. Two different literals, two different dispositions, both stated |
| `SeedReceipt.tsx` · `publish_service.py` | **no numstat entry** — untouched |

**⚠ The inherited test-count pin was stale and was re-derived rather than trusted.** The plan's
acceptance criterion quoted **27** at 196's close; the suite measured **32** at the phase base.
The bar applied was therefore ≥ **36**, and 36 is what shipped.

### Full plan numstat

```
26      4       frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
156     0       frontend/src/pages/WorkflowBuilderPage.header.test.tsx
30      1       frontend/src/pages/WorkflowBuilderPage.tsx
```

### RED-first evidence, stated honestly

**2 of the 4 new cases** were driven against the pre-change page (restored via `git checkout
HEAD~1 -- <file>`, then restored forward) and **failed**:

- *"renders the NAME, not the slug"* → `expected 'vendor-brief' to be 'Northwind QBR'`
- *"D-15 — the slug is STILL in the definition…"* → the flag-ON header bar read
  `…net-newvendor-briefdraft📁No knowledge base…`, containing no name at all

**The other two are regression fences, not RED-first proofs, and are not claimed as such** — they
pin the *unchanged* arm of the expression (no name → slug; empty name → slug) and pass on both
sides of the change. Recording that distinction rather than reporting "4 cases went red" is the
point.

---

## Threat register outcome

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-197-19 (XSS via the name) | **mitigated** | The name renders as a plain React text child in the existing `<span>`; no raw-HTML prop introduced, no new element node. React escapes text children |
| T-197-14 (the slug written) | **mitigated** | `grep -Ec "setName\(\|meta\.slug *="` over the changed block → `0`; the D-15 case reads `slug: "vendor-brief"` back off the persisted definition **after** the header switched to the name |
| T-197-29 (a byte pin re-captured to make red green) | **mitigated — and no re-capture occurred at all** | 0 deletions on the pinned file; the disposition is declared with a per-band delta table and a positive control |
| T-197-30 (the pre-draft D-05 fence confused with the header pin) | **mitigated** | Both baseline files have no numstat entry, asserted in the same run that permitted a deletion on the header file |
| T-197-21 (card and header giving two answers) | **mitigated** | Both read `meta.name` off the same live store; `canvas.test.tsx` now fails if they disagree after one edit. G-4 rows **U5**/**U6** owed |
| T-197-SC (npm installs) | **accept** | No package installed |

---

## Owed, and named rather than implied

- **G-4 UAT rows `U5` and `U6` are OWED** — the appearance proof. They are to be driven **after**
  this plan, never before. `U5` is the exact defect sketch 174 shipped and that was caught only
  by looking: header and card giving two answers on one screen. jsdom proves the strings agree;
  only an eye proves the screen reads right.
- **Hot-file ledger, flagged not edited.** `frontend/src/pages/WorkflowBuilderPage.tsx` is a
  G-5-**FIRING** row (`42 / 13 / 2398`, *honoured by construction (193.1 / 193.2)*) and Phase 197
  has now touched it across several plans, so its triple is stale. The ledger lives in `CLAUDE.md`
  + `docs/HOT-FILE-LEDGER.md` — **shared artifacts this worktree must not write** during a
  parallel wave. Re-derive and update at phase close.

---

## Commits

| Task | Commit | Files |
|---|---|---|
| 1 — the one identity expression | `9808ea26` | `WorkflowBuilderPage.tsx` |
| 2 — branch A, declared, +4 cases | `64e699bf` | `WorkflowBuilderPage.header.test.tsx` |
| Deviation — 197-09's scope fence retired | `62f38ac0` | `WorkflowBuilderPage.canvas.test.tsx` |

## Self-Check: PASSED

- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.header.test.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — FOUND
- `.planning/phases/197-guided-authoring/197-10-SUMMARY.md` — FOUND
- commits `9808ea26`, `64e699bf`, `62f38ac0` — all FOUND in `git log`
