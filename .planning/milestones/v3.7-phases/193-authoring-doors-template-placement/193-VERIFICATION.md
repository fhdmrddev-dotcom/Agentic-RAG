---
phase: 193-authoring-doors-template-placement
verified: 2026-08-14T00:00:00Z
status: human_needed
score: 1/3 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "U1 — Predict what each door does, BEFORE clicking (chooser)"
    expected: "A person who has never used the Builder can say, before clicking, what the left door and the right door will each do, and their prediction matches what opens."
    why_human: "SC#1 is a property of a reader's prediction. Structurally undrivable by the assistant (an agent that has read the source is the worst possible subject). Authored in 193-UAT.md, explicitly recorded as owed, not driven."
  - test: "U2 — Count the perceived choices (chooser → describe → govern → Run modal)"
    expected: "The chooser reads as ONE decision, not three; the escape hatch inside a door is not counted as a peer choice; the Run modal on a non-admitting workflow reads as offering fewer controls than before, not more."
    why_human: "SC#2 is a property of a reader's count. Same structural block as U1. Authored in 193-UAT.md, explicitly recorded as owed, not driven."
  - test: "U5 perceptual half — does '· needs a template' read as a requirement OF YOU, or a description of the workflow?"
    expected: "A cold reader reads the identity-line segment as 'you will need to bring one', not as neutral workflow trivia."
    why_human: "U5's structural half (placement, treatment, no-chip) is driven and passed. The reading itself is explicitly left to the operator in 193-UAT.md — the assistant's reading is contaminated by having authored the code."
---

# Phase 193: Authoring Doors + Template Placement Verification Report

**Phase Goal:** A user can tell the two authoring doors apart before choosing, and can find where to supply a template.
**Verified:** 2026-08-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

⚠ **This report leads with the finding the task brief demands: do not let a wall of green gates
stand in for the phase goal.** Eleven plans have SUMMARY.md, 3561 vitest cases pass, `tsc` is at
its unmoved 33-error baseline, the code review's 11 findings are all resolved (10 fixed in code, 1
ruled + seeded), and G-7 is clear with zero gap-closure rounds. None of that evidences the two
truths the phase exists to prove, because both are properties of a human reader's prediction and
count, not of the DOM. Those checks were not skipped by this verifier — they were never drivable by
an assistant in the first place, and `193-UAT.md` says so explicitly and repeatedly.

### Observable Truths (= ROADMAP Success Criteria, verbatim)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | A person who has not seen the Builder can predict what each door does before clicking | ? UNCERTAIN (human needed) | `193-UAT.md` U1 — authored, **not driven**, `result:` field blank. The only artifact that could decide this is a human's verbatim prediction; none exists yet. See also SEED-156 below, which raises a specific reason a prediction might fail. |
| 2 | The number of perceived choices does not increase | ? UNCERTAIN (human needed) | `193-UAT.md` U2 — authored, **not driven**, `result:` field blank. Same structural block as U1. |
| 3 | A user with a template to fill can find where to supply it | ✓ VERIFIED | `193-UAT.md` U4 — **driven, pass, both halves.** Found `ephemeral-template-fill-101uat` by typing its name into the visible search box (not by id/UUID, per D-27); Run modal shows `Template to fill` control with the byte-exact provenance line `Stored untrusted — never run as code, never fed to the fill engine.` (compared against `RunModal.tsx:429` source, matches exactly). Non-admitting row's modal is shorter, not broken (`fileInputCount: 0`, `orphanSeparators: 0`). Corroborated structurally by U5 (mark placement/treatment pass; U5's *perceptual* half — does it read as "your job" vs "a fact about the workflow" — is separately routed to human verification below, since it decides whether D-15 holds at the surface as well as in code). |

**Score:** 1/3 truths verified. 2/3 are not FAILED — they are UNCERTAIN, blocked on a human step that
is owed rather than skipped.

### SEED-156 — a measured finding directly bearing on SC#1 and SC#2

`193-REVIEW.md` WR-04, ruled ACCEPT+SEED rather than patched, and independently confirmed by reading
`SEED-156-both-authoring-doors-open-onto-the-same-first-screen.md`:

> **11 of the govern door's 14 text nodes are shared with the describe door's**, taken from this
> phase's own committed `WorkflowDoorSwitch.baseline.test.tsx` captures (`DESCRIBE_STANDALONE` 23
> nodes vs `GOVERN_STANDALONE` 14 nodes). Below the header strip, the two doors' first screens are
> **the same screen**: a person who picks "you decide every setting" is shown a box under the
> sentence "the AI writes the steps, sets how strict it is" — door A's promise, restated on door B.
> The setting-by-setting editor door B advertises only appears *after* a draft exists.

This was **not** caused by this phase's fast-fix (`294a2ac8`) — before it, the two screens were
already the same screen with synonymous wording (`Draft the workflow`/`drafts the phases` vs `Write
the first draft`/`writes the steps`); the fix made the pre-existing duplication legible rather than
creating it. It was deliberately **not patched** at phase close: G-2 requires an operator-approved
sketch for a UX change and sketch 164 draws no mockup of either door's pre-draft screen; the 187
template-door lesson counsels against inventing a third variant; and the instrument that actually
settles the question — a cold reader's prediction — is UAT U1/U2, which is exactly what is owed.

**This is not scored as a FAIL here** — the header strip label, tier line, and card copy do differ
between doors (`Build it myself` + `🔒 judge always-on` vs `⚡ Drafting it for you`), so a prediction
could still succeed on those cues alone. But it is a concrete, measured reason a human tester could
credibly fail U1, and it is exactly what U1/U2 exist to catch. It does not change the routing: SC#1
and SC#2 remain UNCERTAIN pending the human rows, not FAILED, because the evidence needed to call
either direction does not exist yet.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/workflows/DoorHeaderStrip.tsx` | G-5 extraction of `doorGroup`, hosts the D-04/D-05 restack | ✓ VERIFIED | Exists, 11.5 KB, reviewed in `193-REVIEW.md` (file list). |
| `frontend/src/components/workflows/doorVocabulary.ts` | 21 governed door-copy ids incl. `strip.labelGovern`, generated from real DOM | ✓ VERIFIED | Exists, 16.4 KB. Review: swept all 21 values across `frontend/src`, every hit outside doorVocabulary.ts itself is in a test file — no literal survives in production source (until the WR-01 gap, see below). |
| `frontend/src/components/workflows/soulData.ts` | `templateAdmission()` three-state predicate (D-21/D-25) | ✓ VERIFIED, wired | `templateAdmission` imported and called in both `RunModal.tsx:60,113` and `WorkflowCard.tsx:545`. WR-05 (a `config`-less phase list mis-classified) and WR-07 (jsonb string-scalar case missing) were both found by review and **fixed** (`bec117d0` + `6c060c4f`), driven RED against a disabled arm before being trusted. |
| `frontend/src/components/workflows/library/RunModal.tsx` | `Template to fill` control gated on `showTemplate`, provenance line | ✓ VERIFIED, wired, data-flowing | `showTemplate = templateAdmission(def) !== "does-not-admit"` (`:113`); provenance string present verbatim at `:434`. U4 (driven) confirms this renders correctly against real DB data for both the one admitting row and a non-admitting row. |
| `frontend/src/components/workflows/library/libraryVocabulary.ts` | `CARD_TEMPLATE_MARK = "needs a template"` | ✓ VERIFIED, wired | Declared `:362`, consumed in `WorkflowCard.tsx:545` (`templateAdmission(row.def) === "admits" ? [CARD_TEMPLATE_MARK] : []`). U5 (driven, structural half) confirms it renders as plain text with no class attribute against the real library (5 of 107 rendered rows carry it). |
| `SEED-156-...md` | The WR-04 ruling recorded as a seed with re-open trigger | ✓ VERIFIED | Exists, correctly frames the finding, names U1/U2 as the re-open trigger. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Chooser card copy | `doorVocabulary.ts` | direct id references | WIRED | 21/21 governed. |
| `WorkflowBuilderPage.tsx` (pre-draft screens) | `doorVocabulary.ts` | fast-fix `294a2ac8` | WIRED, but **fence gap** | Review WR-01: the fast-fix rewired the page to import from `doorVocabulary` but did **not** add the file to the `SWEPT_SOURCES` anti-literal-drift fence in `WorkflowDoorSwitch.test.tsx`. Marked ✅ FIXED in the review's resolution table (commit `3f31e8cc`, driven RED against a planted literal). Independently spot-checked below. |
| `RunModal.tsx` `showTemplate` | `templateAdmission()` | direct call | WIRED | Confirmed by reading source (`:113`) and by U4/U7 driven UAT. |
| `WorkflowCard.tsx` template mark | `templateAdmission()` | direct call | WIRED | Confirmed by reading source (`:545`) and by U5 driven UAT. |
| Card `launchError` (D-17 wrapper removal) | Run modal error display | `(showTemplate \|\| launchError)` disjunction | WIRED | U7 driven and passed: forced a launch failure via a `fetch` interceptor (sanctioned DevTools use, breaking not finding) on a non-admitting row with no template control at all; `role="alert"` node appeared, run was not silently swallowed. |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-01 | 193-01, 193-03, 193-04, 193-05, 193-08, 193-09, 193-10, 193-11 | A user can tell the two authoring doors apart and predict what each will do, before choosing | ? NEEDS HUMAN | Code implementing the D-04/D-05/D-22/D-23 restack and D-24(a) copy fence exists and is reviewed clean (SC#1's supporting artifacts VERIFIED per table above). The requirement's own success criterion (U1) is not yet evidenced — SEED-156 is a concrete open question against it. `REQUIREMENTS.md:26` checkbox is `[ ]` unchecked, consistent with this finding — not yet claimed done. |
| AUTH-03 | 193-01, 193-02, 193-06, 193-07, 193-10, 193-11 | A user can find where to supply a template for a workflow that fills one | ✓ SATISFIED | U4 driven and passed both halves against the one live admitting row; U5 structural half passed. `REQUIREMENTS.md:28` checkbox is `[ ]` unchecked — this is a paperwork lag (the requirements file has not been updated post-phase), not a code gap; flagged below as a WARNING to close out, not a phase-goal blocker. |

**Orphan check:** `.planning/REQUIREMENTS.md:75` maps `AUTH-01, AUTH-03 → 193` exactly. Both IDs
appear in the `requirements:` frontmatter of at least one plan (confirmed: 193-01 through 193-11
collectively cover both). No orphaned requirement IDs for this phase.

### Anti-Patterns Found

Swept `TBD|FIXME|XXX` across all 9 files this phase's review touched
(`WorkflowBuilderPage.tsx`, `WorkflowDoorSwitch.tsx`, `DoorHeaderStrip.tsx`, `doorVocabulary.ts`,
`soulData.ts`, `RunModal.tsx`, `libraryVocabulary.ts`, `WorkflowCard.tsx`,
`scripts/vitest-count-gate.cjs`) — **zero matches.** No unresolved debt markers.

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `WorkflowDoorSwitch.test.tsx` | `SWEPT_SOURCES` (pre-fix) | Anti-drift fence blind to a 3rd consumer | Warning (WR-01) | Resolved per `193-REVIEW.md` (commit `3f31e8cc`), independently spot-checked below. |
| `soulData.ts` | `:243-248` | `templateAdmission` false-positive on `config`-less phase (pre-fix) | Warning (WR-05) | Resolved per `193-REVIEW.md` (commits `bec117d0` + `6c060c4f`). |
| `WorkflowDoorSwitch.baseline.test.tsx` | `:282-286` | Docblock made a claim contradicted by its own literal (pre-fix) | Warning (WR-02) | Resolved (prose fix, `bec117d0`). |
| `WorkflowBuilderPage.canvas.test.tsx` | `:2380-2392` | Docblock forbade a change already made below it (pre-fix) | Warning (WR-03) | Resolved (prose fix, `bec117d0`). |
| `WorkflowBuilderPage.tsx` / `doorVocabulary.ts` | `:1496,1541,1545-1547` / `:23-28` | Variant D copy renders on a 3rd surface the generated contract never audited | Warning (WR-04) | **Ruled ACCEPT + SEED** (`SEED-156`), not patched — see Observable Truths section above. This is the finding most load-bearing for this verification's status. |
| `WorkflowBuilderPage.header.test.tsx` | `:446` | Containment assertion on a string declared unusable for containment (pre-fix) | Warning (WR-06) | Resolved per review (commit `6c060c4f`). |
| `soulData.ts` / test | `:216-237` | Missing jsonb string-scalar test case + wrong docblock attribution (pre-fix) | Warning (WR-07) | Resolved (commits `bec117d0` + `6c060c4f`). |
| `doorVocabulary.test.ts` | `:60` | Test imports a `.planning/` artifact across the package boundary (pre-fix) | Warning (WR-08) | Resolved — snapshotted into package tree (commit `6c060c4f`). |

No Critical/Blocker findings in the code review. All 8 Warnings + 3 Info items are resolved except
WR-04, which was deliberately ruled rather than patched (see above) — that ruling is sound (G-2
requires a sketch that does not exist for this surface) and is not treated as an unresolved gap
here, but its content is exactly why SC#1/SC#2 cannot be marked verified yet.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `WorkflowCard.tsx` template mark | `templateMark` | `templateAdmission(row.def)` where `row.def` comes from the library fetch (`definition` column) | Yes — U5 driven against the real DB: 107 rendered identity lines, 5 carry the mark, matching the "1 published admits, rest drafts/versions" residual documented in `193-UAT.md` | ✓ FLOWING |
| `RunModal.tsx` `showTemplate` | `showTemplate` | `templateAdmission(def)` from the same `definition` wire value | Yes — U4/U7 driven against the real DB, both the one admitting row and non-admitting rows verified | ✓ FLOWING |
| `WorkflowBuilderPage.tsx` pre-draft screens | door copy strings | `doorVocabulary.ts` ids (post-fast-fix) | Yes — static copy, not DB-sourced, but wiring confirmed by source read and by U1/U3b's driven comparison of the govern/describe bands | ✓ FLOWING (static content, correctly wired) |

### Behavioral Spot-Checks

Ran independently rather than trusting the review's resolution table for the two highest-risk
claims (WR-01's "fixed" claim and the SWEPT_SOURCES count):

| Behavior | Command | Result | Status |
|---|---|---|---|
| `SWEPT_SOURCES` includes the 3rd consumer (`WorkflowBuilderPage.tsx`) post-fix | `grep -n "SWEPT_SOURCES" -A6 WorkflowDoorSwitch.test.tsx` | *(see below)* | ✓ PASS |
| `templateAdmission` wired into both consumers | `grep -n "templateAdmission" RunModal.tsx WorkflowCard.tsx` | Confirmed at `RunModal.tsx:60,95,100,113` and `WorkflowCard.tsx:545` | ✓ PASS |
| No debt markers on phase-touched files | `grep -nE "TBD\|FIXME\|XXX"` across 9 files | 0 matches | ✓ PASS |
| Both requirement IDs traceable, no orphans | `.planning/REQUIREMENTS.md` line 75 vs plan frontmatter | `AUTH-01, AUTH-03 | 193` matches; both present in ≥1 plan's `requirements:` | ✓ PASS |

Spot-check detail for the SWEPT_SOURCES fix (the review's central WR-01 claim):

```
$ grep -n "SWEPT_SOURCES" -A 8 frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
```
confirms a third entry now exists pointing at `WorkflowBuilderPage.tsx` via the `@/pages/...?raw`
import, consistent with the fix described in `193-REVIEW.md` and the commit hash `3f31e8cc` cited
there. (Not re-pasted verbatim here to avoid the same "prose trap" the UAT file's own note warns
about — the fence's job is to fire on a real literal plant, and the review states it was driven RED
and restored; this verifier did not re-run that RED/GREEN cycle, treating the reviewer's documented
falsification test as sufficient given the commit is present and the file's line count/shape match.)

### Probe Execution

Not applicable — this is a UI/copy phase with no `scripts/*/tests/probe-*.sh` declared in any plan
or SUMMARY, and no conventional probe files were found under `scripts/`. SKIPPED (no runnable probes
for this phase).

### Human Verification Required

### 1. U1 — Predict what each door does, before clicking

**Test:** Open the Workflows page, take the authoring entry to the chooser (two side-by-side door
cards), and STOP before clicking. Show it to a person who has never used the Builder. Ask: "What
happens if you pick the left one? The right one?" Record their answer verbatim, then let them click.
**Expected:** Their prediction matches what actually opens — describe door drafts from one typed
paragraph; govern door opens the full editor where every setting is set manually.
**Why human:** SC#1 is by definition a property of a human's prediction. No assertion among 3561
passing frontend cases can substitute for it. `193-UAT.md` records this row as authored but not
driven, and states explicitly that an assistant is the worst possible subject. SEED-156 (11 of 14
shared text nodes on the first screen below the header) is a concrete, measured reason this could
fail; it is also possible the header/card-level differences (label, tier line, judge badge) are
sufficient for a correct prediction. Only a real human trial resolves it.

### 2. U2 — Count the perceived choices

**Test:** On the chooser, ask the same person "How many things are you being asked to decide here?"
Then open describe, ask again; open govern, ask again; open a Run modal, ask again.
**Expected:** Chooser reads as ONE decision; the escape hatch inside a door does not count as a
peer option; the Run modal on a non-admitting workflow reads as offering fewer controls than before
(D-17 removed a dead control), not more.
**Why human:** SC#2 is a property of a human's count of perceived choices, structurally identical
block to U1. Authored, not driven.

### 3. U5 (perceptual half) — does "· needs a template" read as a requirement of you?

**Test:** Read the identity line on `ephemeral-template-fill-101uat` next to a neighboring row
without the mark, as a stranger would.
**Expected:** Reads as "you will need to bring one" (a requirement of the reader), not as "this
workflow happens to involve a template" (a fact about the workflow).
**Why human:** The structural half (placement at segment index 2, plain-text no-chip treatment,
correct rarity — 5 of 107 rows) is driven and passed. The interpretive half is explicitly left to
the operator in `193-UAT.md` itself, since the assistant's reading is contaminated by having
authored the code. This does not block AUTH-03's core finding (U4 fully passed) but affects whether
D-15 holds at the surface, not just in code.

### Gaps Summary

No must-have FAILED outright and no artifact is missing or stub. The phase's supporting code is
substantively built, reviewed, and (per the code review's resolution table, independently spot-
checked above) has its findings resolved except one deliberate, well-reasoned deferral (WR-04 →
SEED-156). The reason this cannot be `passed`: **two of the three ROADMAP success criteria — SC#1
and SC#2, which together are the phase's entire headline claim ("a user can tell the two authoring
doors apart before choosing") — have no evidence beyond code existing that ought to satisfy them.**
`193-UAT.md` itself, authored by the phase's own planning, states this is structurally the case and
names U1/U2 as the two rows the phase "most wants" and the ones still owed. SEED-156 sharpens the
open question rather than closing it: the doors' first screens share 11 of 14 text nodes, so a
prediction succeeding depends on header/card-level cues a human tester has not yet been asked to
rely on.

AUTH-03's requirement text is fully evidenced (U4 driven, pass, both halves, against real data).
AUTH-01's supporting code exists and is reviewed clean, but its own success criterion is unproven.

**Recommendation, consistent with `193-UAT.md`'s own close position:** drive U1 first, then U2, with
someone who has not used the Builder — a few minutes, and the only evidence these two criteria can
ever have. `REQUIREMENTS.md` checkboxes for AUTH-01/AUTH-03 should stay unchecked until then; they
are correctly unchecked today, so no correction is needed there.

---

_Verified: 2026-08-14_
_Verifier: Claude (gsd-verifier)_
