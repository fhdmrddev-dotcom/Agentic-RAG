# Phase 193: Authoring Doors + Template Placement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 193-Authoring Doors + Template Placement
**Areas discussed:** The strip restack (G-5 refactor first), Where the door copy lives, The AUTH-03 card mark, Run-modal gating

---

## ⚠ Context this discussion opened under

This discussion is the **second** attempt. The first ran on 2026-08-13 at ~10:59 local under the
operator instruction *"/gsd:discuss-phase 193 please proceed autonomously discuss then plan do
research if needed then execute"* and was lost entirely to a laptop restart — **nothing reached
disk**: no commit, no file, no transcript message, no subagent directory. Nine recovery angles were
searched (repo-wide mtime scan of the 07:24–11:00 window, transcript timestamps, `.claude/file-history`,
shell snapshots, `.claude.json` backups, git stash, reflog, Recycle Bin, VSS/File-History service)
and the work was found to have been **never written rather than deleted**.

Two consequences shaped how this session ran:

1. The operator's two sketch-gate answers were re-collected and **committed to disk before any
   discussion began** (`20ca7cf7`), rather than held in context.
2. A checkpoint was written after the first area completed, per the workflow's incremental-save rule.

---

## Pre-locked at the G-2 sketch gate (before this discussion)

These were the operator's answers to the question the lost session died on. Recorded here because
they are inputs to the phase, not open questions inside it.

| Option | Description | Selected |
|--------|-------------|----------|
| A · Keep today's wording | `Describe & run` / `Author & govern` unchanged | |
| B · Plain verbs | `Draft it for me` / `Build it myself`; return control becomes an escape | |
| C · Name the cost | `Describe it` / `Set it up yourself`; leads with what you supply | |
| **Mix B and C** | B's door names + C's tier labels | **✓** |

**User's choice:** the mix → shipped as **variant D**, derived in `build.cjs` (`D_FROM_C`), audit 18
matched / 0 missed.
**Notes:** Recommended on the grounds that B's names answer *who does the work* while C's tiers state
*what it costs you*, and that the sketch had measured SEED-147's suspect #3 ("nothing states the
consequence") to be **false** — so the problem was vocabulary, not a missing explanation.

| Option | Description | Selected |
|--------|-------------|----------|
| **Yes — demote the return + badge** | The half of SEED-147 copy cannot fix | **✓** |
| No — copy only, defer the strip | Ship naming + AUTH-03, defer with a re-open trigger | |

---

## The strip restack (G-5 refactor first)

### Q1 — What does demoting the return control actually look like?

| Option | Description | Selected |
|--------|-------------|----------|
| **Quiet escape + divider** | Return drops its border/box, becomes muted text, divider before the door label; judge badge unchanged at far edge | **✓** |
| Return leaves the strip entirely | Folds into the `← Workflows` breadcrumb (`headerLead`) | |
| Weight only — same structure | Type weight and colour change, same three boxes in a row | |

**User's choice:** Quiet escape + divider.
**Notes:** Smallest change that breaks the three-peers reading, and it survives both the standalone
band and the Builder's merged row unchanged. Option 2 was flagged at ask-time as higher risk because
`headerLead` renders **only when `inline` is true** — the standalone band would lose its return
control. Option 3 was flagged as possibly not fixing what the operator actually saw, since the three
boxes still sit in a row.

### Q2 — G-5 sequencing: how should refactor and feature be ordered?

| Option | Description | Selected |
|--------|-------------|----------|
| **Extraction ships first, in its own wave** | Wave 1 a pure move with baselines captured on the unmoved tree; wave 2+ applies variant D and the restack | **✓** |
| One wave — extract and change together | Faster; but no characterization baseline can hold | |
| Record a G-5 override, feature only | Edit in place, log the waiver under STATE.md | |

**User's choice:** Extraction first, own wave.
**Notes:** This is the 192.1 order. The deciding argument was the 188.1 lesson — *a characterization
baseline only proves something if it PREDATES the change* — so extracting and rewording in one
commit would leave the move unprovable. **No G-5 override is recorded for this phase.**

### Q3 — Does the restack apply to both header variants?

| Option | Description | Selected |
|--------|-------------|----------|
| **Both — one component, one shape** | One extracted component serves the standalone band and the inline `headerTrail` | **✓** |
| Standalone only | Leave the Builder's merged row (tuned in 184.1) alone | |

**User's choice:** Both.
**Notes:** Flagged at ask-time: requires care with the `ml-auto` class already conditional on
`inline` — in the standalone band it pushes the judge badge to the far edge; inside the merged row's
right-aligned trailing group it would open a gap.

---

## Where the door copy lives

### Q1 — Module home and name

| Option | Description | Selected |
|--------|-------------|----------|
| **`components/workflows/doorVocabulary.ts`** | Beside its only consumer; mirrors `libraryVocabulary.ts` naming | **✓** |
| `components/workflows/library/doorVocabulary.ts` | With the existing vocabulary module | |
| One shared `workflowVocabulary.ts` | Doors + library merged | |

**User's choice:** `components/workflows/doorVocabulary.ts`.
**Notes:** Option 2 was flagged because `library/` carries the Phase 192 fences and the doors are an
authoring surface, not a library one. Option 3 would mean moving a fence-pinned module consumed
across the whole library subtree — far outside 193's blast radius.

### Q2 — How much of the COPY table moves?

| Option | Description | Selected |
|--------|-------------|----------|
| **All 20 ids** | Both door cards, chooser, strip labels, describe CTA, three hint fragments, switch strip, soul label | **✓** |
| Only what variant D changes | 18 of 20; the two inherited strings stay in JSX | |
| Only the two door cards | 8 ids — the minimum AUTH-01 needs | |

**User's choice:** All 20.
**Notes:** The contract's audit is defined over the whole table; a partial port would leave the
module and the contract describing different things. Option 3 was additionally flagged as
self-defeating — the wave-3 strip restack would have to re-open the same file to extract the rest.

### Q3 — How does the module express the three-fragment describe-hint?

| Option | Description | Selected |
|--------|-------------|----------|
| **Three named fragments, composed in JSX** | Module exports plain strings; the component owns the `<b>` markup | **✓** |
| One template string with markers | Whole sentence with `{1}`/`{2}`/`{3}` placeholders | |

**User's choice:** Three named fragments.
**Notes:** Matches the contract's worked examples exactly; keeps markup semantics out of the data
and needs no parser.

---

## The AUTH-03 card mark

### Q1 — What form does the mark take?

| Option | Description | Selected |
|--------|-------------|----------|
| **Plain text segment in the identity line** | Muted, `·`-separated, no new component or colour | **✓** |
| A bordered chip | Louder and more scannable | |
| An icon only | Compact glyph in the provenance region | |

**User's choice:** Plain text segment.
**Notes:** The chip option was flagged at ask-time against two hard constraints: the card
**structurally forbids a third badge** (an `@ts-expect-error` control pins it, 188.2), and
**SEED-155 exists because sketch 163 drew a chip the card could not render** (UAT U8). The icon
option was flagged as reproducing the very failure AUTH-03 fixes — the shipped upload button is
already "quiet and unlabelled".

### Q2 — Where in the identity line?

| Option | Description | Selected |
|--------|-------------|----------|
| **After provenance, before recency** | *whose it is · what it needs · when it changed* | **✓** |
| At the end of the line | After recency; leaves the shipped line untouched up to its end | |
| First, before provenance | Most prominent | |

**User's choice:** After provenance, before recency.
**Notes:** Option 3 was flagged as breaking 192.1's DOM-position-2 child-order assertion — the whole
point of which was that it does not move.

### Q3 — What renders when the wire doesn't say?

| Option | Description | Selected |
|--------|-------------|----------|
| **Nothing — silence, never a guess** | Absent/null/unparseable renders identically to "does not admit" | **✓** |
| Nothing, but log it | Same rendering plus a console warning | |

**User's choice:** Nothing.
**Notes:** Mirrors the shipped `updated_at` rule — `undefined` means *the wire did not say*. The
logging variant was flagged as firing once per row against an older backend, and as putting a
wire-shape question into runtime logging rather than a test.

---

## Run-modal gating (changes shipped behavior)

### Q1 — What happens to the upload for a workflow that does NOT fill a template?

| Option | Description | Selected |
|--------|-------------|----------|
| **Render nothing** | Absent — not greyed, not disabled | **✓** |
| Keep it behind a disclosure | Collapse under "Advanced" | |
| Leave it everywhere, just label it | Naming half only, no visibility change | |

**User's choice:** Render nothing.
**Notes:** ~100 rows currently carry a control they cannot use. Option 2 was flagged as the same
discoverability problem one click deeper — and as **adding** a perceived choice where SC#2 asks for
fewer. Option 3 was flagged as making the new label unreliable: it would name a template slot on
workflows that have none.

### Q2 — Where does the security provenance line go?

| Option | Description | Selected |
|--------|-------------|----------|
| **Stays verbatim, moves with the control** | Character-for-character; hidden where the control is hidden | **✓** |
| Stays, but reworded to match the new label | Reads better under "Template to fill" | |

**User's choice:** Verbatim.
**Notes:** The sentence is Phase 152's threat-modelled SSTI claim (`template_input` is never routed
to the Jinja engine) and the build contract marks it `SHIPPED · keep verbatim`. Rewording a security
claim to improve its cadence is how such claims quietly weaken.

### Q3 — Modal fallback when the wire doesn't say?

| Option | Description | Selected |
|--------|-------------|----------|
| **Render the control (fail toward capability)** | Hide only on a POSITIVE reading that no template is filled | **✓** |
| Hide it (consistent with the card) | One rule everywhere | |

**User's choice:** Render the control.
**Notes:** Deliberately the **opposite** of the card's fallback. On the card, silence costs nothing;
in the modal, hiding on unknown removes a shipped capability (WFIN-01) with no way for the user to
know it existed. Recorded in CONTEXT.md as **D-20**, explicitly flagged as a decision rather than an
inconsistency to be "fixed".

---

## Claude's Discretion

- Exact Tailwind classes for the demoted return control and the divider, within the shipped token
  vocabulary (the sketch draws no restack, so pixel choices are a human comparison at UAT).
- Internal shape of `doorVocabulary.ts` (nested vs flat), provided all 20 contract ids are present
  and the hint fragments stay separate strings.
- Whether `DoorHeaderStrip.tsx` absorbs the door-label span or only the return control and badge —
  the constraint is "one component, both variants", not a specific boundary.
- Test-file placement and naming, following the shipped `WorkflowDoorSwitch.test.tsx` convention.

## Deferred Ideas

- **BUG-260813-01** (canvas hardcodes `colorMode`, stays dark in light mode) — adjacent via the
  Builder, different concern. Left `open`, recommended as a one-line `/gsd:fast` under G-3.
- **Return control into the breadcrumb** — rejected by D-06; re-open if a future phase makes the
  standalone breadcrumb unconditional.
- **A refactor phase for `WorkflowCard.tsx`** — 193 makes it the card's 3rd phase (7 commits,
  747 L); the next phase to touch it owes a refactor recommendation first.
- **One merged `workflowVocabulary.ts`** — rejected by D-10; re-open if a third vocabulary module
  appears on the workflow surface.
- **`spike-nl-workflow-authoring.md`** — matched at 0.6 but **stale**: its own routing note closes it
  on Phase 152, which shipped. Recommended for closure against 152; deliberately not edited here.
