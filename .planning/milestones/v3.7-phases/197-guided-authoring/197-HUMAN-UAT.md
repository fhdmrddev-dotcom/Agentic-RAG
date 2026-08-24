---
status: partial
phase: 197-guided-authoring
source: [197-VERIFICATION.md, 197-REVIEW.md]
started: 2026-08-18T15:15:00Z
updated: 2026-08-18T16:40:00Z
---

## ⚠ CLOSED AS A DECISION 2026-08-21 — the rows below are OWED, not passed

**Phase 197 was closed with these rows outstanding. That is a decision, not a claim that they ran.**
CLAUDE.md § G-7 permits it explicitly and requires it be stated this way.

**What justified the close, stated so it can be argued with:**
- Verification: **3/3 ROADMAP success criteria verified IN CODE**, 11/11 plan must-haves, **0 code
  gaps** — and the verifier re-ran the suites and gates independently rather than trusting a SUMMARY.
- The review's one **Critical (CR-01) is FIXED**, RED-first (`96a43ebd` → `f017f08b`).
- Standing, quoted from this file's own header rather than recounted: **4 PASS · 2 PARTIAL ·
  5 NOT DRIVEN.** ⚠ A recount on close made it 5 PASS, and the difference is **U-WR01**, whose
  result reads *"PASS on the population; the empty case is UNREACHABLE through the UI"* — half a
  row. The lower number is kept; a row with an unreachable arm is not a clean pass.

**Why the remainder was NOT driven by the agent rather than left silent:** every outstanding row is
an *eye* judgement — *"the appearance judgement"* (U1), *"the feel"* (U2), *"the 11px controls are
actually legible"* (U9) — or needs a second live provider (U4) or a workflow that emits a file (U8).
⚠ Driving those from the DOM would repeat **Phase 192's recorded mistake**: its post-fix re-drive
located rows by `getElementById`, so it proved the code and could not prove the row was findable.
A machine check that bypasses the human's task does not verify it.

**RUN U4 FIRST** when you pick this up — the requirement row on **anthropic + openai**. That is what
`ROADMAP.md`'s own 197 checklist entry already names, and cross-provider coverage is a standing
project rule, so it outranks a judgement call. ⚠ An earlier draft of this note said "U1 first"; it is
corrected here rather than left to contradict the ROADMAP, because two planning documents disagreeing
about what to do next is the drift this project keeps paying for. Then **U1** (the arrival moment —
its mechanical half already passes, so only the judgement is left), then **U2**, then **U9**.

⚠ `status:` stays `partial` on purpose. A row that reads `[pending]` below is still pending, and this
file remains the register for it — it will keep surfacing in `/gsd:progress` and `/gsd:audit-uat`.

## Current Test

**Driven 2026-08-18 against the live local stack** (backend :8000, frontend :5173, Supabase :54322),
on ONE real generation — described a weekly vendor-renewal brief, left the KB deliberately unbound.

**4 PASS · 2 PARTIAL (mechanical half passes, the eye is owed) · 5 NOT DRIVEN.**
Assertions were made by reading DOM state and geometry, never by looking at a picture — so every row
below that says PASS says it about a measurable property, and every judgement row is marked owed.

## Tests

### 1. U1 — the arrival moment is ONE card, and the graph still wins the screen
result: **PARTIAL — geometry PASSES, the appearance judgement is still owed.** Driven 2026-08-18 on a
real generation at 1718x1214. The graph column held **exactly 3 children** (view toggle 49 px, card,
graph). The card measured **147 px** collapsed — sketch 174 predicted 149 px, so the built surface
matches the sketch to 2 px — against **933 px** for the graph, i.e. the graph keeps **86%** of the
column. Card text was four lines. NOT driven: the sub-900 px width check, and whether it READS as one
card rather than a card-in-a-card. Those need an eye.
expected: Describe a workflow, press the CTA. What lands is ONE card of about four lines — not two
stacked cards, not a wall of text — and the workflow graph is still the biggest thing on screen.
Also check below ~900 px viewport width: the layout must not collapse the graph to near-zero.
why_human: jsdom applies no CSS. Every assertion in the phase sees the composed receipt's nodes;
none can see whether it *reads* as one card. Sketch 172 measured that a fourth child in the graph
column strands the graph at **0 px**, and sketch 174 measured 662 px of chrome as unworkable below
~900 px. Geometry proves composition; only looking proves appearance.
result: [pending]

### 2. U2 — the fast door still feels fast
result: **PARTIAL — the control inventory PASSES, the feel is still owed.** The describe screen
carries exactly **three author-facing inputs** — describe-box, project-folder-picker,
describe-template-input — plus the CTA, and both the KB and the template are marked **Optional** in
their own copy. Nothing new is asked, which agrees with SC#2's numstat proof. NOT driven: the LOOSE
door (WorkflowDoorSwitch), and whether it feels fast.
expected: Run the pre-draft describe screen on BOTH doors — the LOOSE door (`WorkflowDoorSwitch`)
and the GOVERN door (`WorkflowBuilderPage`). Neither asks for anything new: no extra control, no
extra required field, no new gate.
why_human: SC#2's four numstat criteria all passed mechanically (both baseline suites byte-unchanged,
`SeedReceipt.tsx` and `publish_service.py` never touched), but "does this still feel fast" is a
lived-experience judgement those criteria cannot make.
result: [pending]

### 3. U3 — a decision is answerable and the answer sticks
result: **PASS — both halves, end to end.** Row 1's Change moved focus to the SHIPPED
project-folder-picker (document.activeElement carried that testid) and there was **exactly ONE** such
control on screen — no duplicate. Selecting **DBA** flipped row 1's answer from *No documents — this
workflow reads nothing of yours.* to **DBA** in the same beat, and the draft auto-saved (*Saved just
now*). Re-opened from the library afterwards: **the binding was still DBA.** The write reached
Postgres and came back.
expected: Change the knowledge base from the arrival card's row 1. The header agrees instantly.
Reload the draft: the answer persisted.
why_human: Needs a live browser session plus a DB read to confirm end-to-end persistence and instant
reactivity. The suites prove the two read the same store value; they cannot prove the write reached
Postgres and came back.
result: [pending]

### 4. U4 — the requirement row on ≥ 2 providers
expected: Drive the requirement row on **anthropic + openai** minimum. On one provider the row shows
something durable; on another it may show a one-run parameter the author can see and fix in the row.
why_human: Generation quality is provider-dependent — `193.2-FREQUENCY.md` measured a 0/5 vs 5/5
contrast between providers on this very surface. No automated check can assess whether free text is
"durable". Per CLAUDE.md's roster rule, a provider that cannot be driven is recorded with its
reason, never silently omitted.
result: **NOT DRIVEN — needs the operator.** One provider was exercised (the composer's configured
deepseek / deepseek-v4-flash), and it produced a requirement that reads as durable: *Deliver a
plain-text renewal brief covering vendor contracts renewing within the next 90 days...* — no one-run
parameter visible. **That is ONE row of a required TWO, and durability is a judgement, so it is not
scored.** anthropic + openai are owed.

### 5. U5 — the row and the header must never give two answers ⭐ DRIVEN FIRST, AS RECOMMENDED
result: **PASS.** On arrival the header identity span and row 4 both read **Weekly Vendor Renewal
Brief** — asserted by set membership, not by eye. No slug-shaped string appeared anywhere in the
header. **This is the row the sketch shipped broken, and it is the one that now agrees.**
expected: The arrival card's name row (row 4) and the header identity strip show the SAME workflow
name, always. Never `northwind-qbr-fa65a43c` in the header against `Northwind QBR` in the row.
why_human: This is the exact defect sketch 174 shipped, and it was caught **only by looking** — the
sketch's header and card disagreed because a `<select>`'s value is a DOM property lost on
serialisation. Both `197-09` and `197-10` named this row explicitly owed. It is the cheapest row and
the one most likely to fail.
result: [pending]

### 6. U6 — the name row is the name's first honest display
result: **PASS.** Typed **Northwind QBR** into row 4; the header followed **live** — the typed name
present, the previous name gone, and zero slug-shaped strings. The fixture name is the point: the
defect this replaces put `northwind-qbr-<hash>` in the header against `Northwind QBR` in the row, on
one screen. It no longer can.
expected: Edit the name through row 4's inline field. What was typed is what subsequently displays —
the name, not the slug.
why_human: `197-10` shipped the identity expression that makes this possible; before it, `meta.name`
appeared in no render position anywhere on the page. Requires driving the real inline-edit
interaction and observing the rendered result.
⚠ **Test the EMPTY case deliberately — it was a real defect (WR-01) and is now fixed.** Clearing
the field must fall back to the slug in the library, never render a blank title. Row 11 covers it.
result: [pending]

### 7. U7 — dismissal is an offer, not a wall
result: **PASS, measured rather than eyeballed.** Pressing the dismiss control removed the card, took
the graph column from **3 children to 2**, and the graph grew by **exactly 398 px** — precisely the
height the expanded card had occupied, so the space is fully reclaimed rather than left as dead
padding. The graph remained the last child, and the save state did not change: nothing was silently
written.
expected: Press the dismiss (✕). The card disappears, the graph takes the freed space, nothing is
lost and nothing is silently saved.
why_human: Visual/layout confirmation. The suites assert the child count drops from 3 to 2 with the
graph still last; they cannot see whether the space is actually reclaimed on screen.
result: [pending]

### 8. U8 — the deliverable row leads somewhere real
expected: Click the deliverable row's action. It opens the step that actually produces the file, and
lands on the field that decides what it says.
why_human: Requires driving real navigation and focus in a live canvas.
result: **NOT DRIVEN — the generated workflow produces no file.** Row 5 read *It answers in the chat —
no file is produced* and correctly rendered **no action control at all**, which is D-18's absence rule
working. But that means the JUMP was never exercised. Needs a draft whose terminal step is an
llm_emit — e.g. describe something that must produce a document.

### 9. U9 — the 11 px controls are actually legible
expected: The rows route to header controls that can be read, and the "AI-proposed" mark reads
beside a real sentence rather than orphaned.
why_human: Visual legibility judgement. Inherits `193.2-09`'s owed sliver, which has never been
browser-UAT'd.
result: **NOT DRIVEN — a legibility judgement is exactly what a DOM read cannot make.** Owed.

### 10. U-CR01 — the verdict must not tell you to add what you just added
expected: Draft a workflow that arrives with the requirement verdict showing (*"This workflow has
no business requirement…"*). Press row 3's own **Change**, type a requirement. The answer updates
**and the verdict sentence disappears** — it does not sit underneath the requirement you just wrote.
why_human: Fixed and pinned at both component and page scope, but this is the one a person would
have caught in a minute and three test suites did not. Worth ten seconds of confirmation.
result: **NOT REPRODUCIBLE ON DEMAND, and the reason is itself a finding.** The draft arrived with a
requirement already written, so readiness came back **not-missing** and no verdict node rendered at
all — there was nothing stale to observe. That is 193.2-07's durable AI-proposed requirement working
as designed. **CONSEQUENCE, recorded honestly: CR-01's user-visible blast radius is smaller than the
review implied** — the stale imperative can only appear on a draft that arrives WITHOUT a requirement,
which this generator reliably does not produce. The defect and the fix are both real and pinned
RED-first at component and page scope; what is unproven is how often a person would ever meet it. To
drive it on screen, a draft must arrive with an empty business_requirement.

### 11. U-WR01 — clearing the name must not blank the library
expected: Clear row 4's name field entirely, save, then open the Workflows library. The card shows
the **slug**, never an empty title, and the builder's edit label reads `Edit · <slug> v<n>` rather
than `Edit ·  v<n>`.
why_human: The fix is a display fallback; only looking at the library confirms the card reads right.
result: **PASS on the population; the empty case is UNREACHABLE through the UI.** Scanned **all 111
real library cards**: **zero blank titles**, and the builder's edit label rendered `Edit · Northwind
QBR v1` — the libraryDisplayName positive control firing on real data. **The blank case could not be
created through the interface at all**, which is the finding: the ONLY rename control is row 4 of the
arrival card, so a name can only be emptied during the one arrival moment. WR-01 is real but **rare by
construction**, and no pre-existing row was ever affected.

## Summary

total: 11
passed: 4
partial: 2
issues: 0
pending: 5
skipped: 0
blocked: 0

driven_by: claude (DOM state + geometry, 2026-08-18)
owed_to_operator: U1 (appearance + narrow width) - U2 (loose door + feel) - U4 (2nd provider) -
  U8 (needs a file-producing draft) - U9 (legibility) - U-CR01 (needs a requirement-less draft)

## Gaps

⚠ **Two code-review findings were found AFTER all eleven plans closed** (`197-REVIEW.md`, commit
`d0ef74fb`). **BOTH ARE NOW FIXED**, each RED-first, with the reasoning and the accepted limitations
recorded beside the code. They are kept here in full — with what was actually wrong, not just that
something was — because rows 10 and 11 exist to confirm them on screen, and because how each was
missed is more useful than the patch:

### CR-01 (Critical) — the readiness verdict goes stale on the one edit the card invites
`DecisionsList.tsx:180-184` derives the requirement verdict purely from the SNAPSHOT, while the
answer rendered directly above it in the same `<li>` is LIVE. Confirmed independently: `setReadiness`
is written at exactly one site (`WorkflowBuilderPage.tsx:886`, inside `onDrafted`) and never
recomputed. **Three clicks to reproduce:** arrive with a `missing` verdict → press row 3's own
*Change* → type a requirement. The row then shows the new requirement as its answer with *"Add the
Business requirement … before publishing"* underneath it, while the Publish control beside it
un-blocks live. The inverse arm is worse: a `present` snapshot survives the author *clearing* the
requirement, so the card says nothing about a gate that is now about to refuse.
⚠ This is the CR-01 snapshot/live shape for the **fifth** time in this project. The phase fenced
absence-is-not-a-pass on the WIRE (three good cases) and left it unfenced on the EDIT — the LIVE
fence and the verdict cases never overlap, because the LIVE case's mock carries no `readiness` key
at all.
status: **FIXED 2026-08-18** — `96a43ebd` (RED) → `f017f08b` (fix). A staleness guard, not a
second predicate: the verdict is withheld once the live requirement is non-empty.
⚠ **The inverse arm stays SILENT by decision** with a written re-open trigger — a `present`
snapshot survives the author *clearing* the requirement, and the card falls silent rather than
manufacturing a warning it would have to derive. Re-open when a surface needs the card to WARN;
then re-fetch or recompute server-side.
⚠ **FOUR SHIPPED CASES WERE RE-SCOPED, and that is the real finding** — three in
`DecisionsList.test.tsx` and one in `WorkflowBuilderPage.canvas.test.tsx` drove a `missing`
verdict against a fixture whose requirement was NON-EMPTY, pinning the incoherent state as
correct. The incoherence propagated from the component fixture to the page fixture, which is how
the same blind spot came to exist at both levels. Nothing any of them proved was dropped.
**U-CR01 below is the row that confirms it on screen.**

### WR-01 (Warning) — clearing the name persists a blank title
`setName` (`builderStore.ts:823`) writes whatever string it is given, including `""` — no trim, no
rejection, confirmed by reading the implementation. The docblocks justify this with *"the server
owns emptiness"*, and **that is false for this field**: `grounding.py`'s rule is
`business_requirement_missing`; nothing refuses an empty workflow **name**, and
`db/workflows.py:764` does `SET name = $3` straight from the definition. The Builder header hides it
behind `identityLabel`'s slug fallback, but `WorkflowCard.tsx:592` renders `{row.name}` with no
fallback and `WorkflowsPage.tsx:574`'s `??` misses `""` → `Edit ·  v1`.
⚠ **This is a regression this phase introduced** — the write path that can empty the name is new
(`197-05`). The fix is a display fallback at those two sites, not a client-side trim.
status: **FIXED 2026-08-18** — `f0cc6bb4` (RED) → `4e7326c7` (fix). One rule,
`libraryDisplayName(name, slug)`, consumed by both row constructors and the builder's edit label.
Fixed where the value is READ, deliberately not by a client-side trim. The false *"the server owns
emptiness"* docblock is corrected in place with the original named. **U6 covers this on screen.**

## Observations not covered by any row

Both were found while driving the rows above, and neither is a defect in what the phase set out to
build. They are recorded because nothing else would catch them.

### O-1 — dismissing the arrival card removes the ONLY way to rename a workflow
Measured twice: after pressing the card's dismiss control, `decision-name-input` count is **0**, and
on a **re-opened** draft it is **0** as well (the card is correctly gone per D-06). The only other
text input anywhere in the builder is `business-requirement-input`. So the workflow name is editable
during exactly one moment — the arrival — and never again through the interface.

This follows directly from D-17's own premise, quoted from `197-09`: *"the name has NO existing
control anywhere, so the row's inline field is not a second answer but the first."* Row 4 is the
first control; it is also the **only** one, and it lives on a dismissible card. Two consequences:
an author who dismisses before renaming cannot rename at all, and **it is what makes WR-01 rare** —
a name can only be emptied inside that same one moment.
Re-open trigger: the first report of a person unable to rename a workflow, or any phase adding a
rename affordance outside the arrival card.

### O-2 — the builder does not survive a page reload
`F5` on the builder returns the chat surface, not the draft; the `/workflows` URL renders chat on a
cold load and the builder is in-app state only. Work was NOT lost — the draft had auto-saved and was
recoverable from the library with its binding intact — so this is a navigation limitation, not data
loss. Consistent with `SEED-178`. Recorded because a UAT session will hit it immediately and should
not read it as a phase-197 regression.
