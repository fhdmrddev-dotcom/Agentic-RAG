---
status: partial
phase: 197-guided-authoring
source: [197-VERIFICATION.md, 197-REVIEW.md]
started: 2026-08-18T15:15:00Z
updated: 2026-08-18T15:15:00Z
---

## Current Test

[awaiting human testing — recommended first row: **U5**, then **U1**]

## Tests

### 1. U1 — the arrival moment is ONE card, and the graph still wins the screen
expected: Describe a workflow, press the CTA. What lands is ONE card of about four lines — not two
stacked cards, not a wall of text — and the workflow graph is still the biggest thing on screen.
Also check below ~900 px viewport width: the layout must not collapse the graph to near-zero.
why_human: jsdom applies no CSS. Every assertion in the phase sees the composed receipt's nodes;
none can see whether it *reads* as one card. Sketch 172 measured that a fourth child in the graph
column strands the graph at **0 px**, and sketch 174 measured 662 px of chrome as unworkable below
~900 px. Geometry proves composition; only looking proves appearance.
result: [pending]

### 2. U2 — the fast door still feels fast
expected: Run the pre-draft describe screen on BOTH doors — the LOOSE door (`WorkflowDoorSwitch`)
and the GOVERN door (`WorkflowBuilderPage`). Neither asks for anything new: no extra control, no
extra required field, no new gate.
why_human: SC#2's four numstat criteria all passed mechanically (both baseline suites byte-unchanged,
`SeedReceipt.tsx` and `publish_service.py` never touched), but "does this still feel fast" is a
lived-experience judgement those criteria cannot make.
result: [pending]

### 3. U3 — a decision is answerable and the answer sticks
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
"durable". Per CLAUDE.md's roster rule, a provider that cannot be driven is recorded ⛔ with its
reason, never silently omitted.
result: [pending]

### 5. U5 — the row and the header must never give two answers ⭐ DRIVE THIS FIRST
expected: The arrival card's name row (row 4) and the header identity strip show the SAME workflow
name, always. Never `northwind-qbr-fa65a43c` in the header against `Northwind QBR` in the row.
why_human: This is the exact defect sketch 174 shipped, and it was caught **only by looking** — the
sketch's header and card disagreed because a `<select>`'s value is a DOM property lost on
serialisation. Both `197-09` and `197-10` named this row explicitly owed. It is the cheapest row and
the one most likely to fail.
result: [pending]

### 6. U6 — the name row is the name's first honest display
expected: Edit the name through row 4's inline field. What was typed is what subsequently displays —
the name, not the slug.
why_human: `197-10` shipped the identity expression that makes this possible; before it, `meta.name`
appeared in no render position anywhere on the page. Requires driving the real inline-edit
interaction and observing the rendered result.
⚠ **See WR-01 below — clearing this field to empty is a KNOWN OPEN DEFECT.** Test the empty case
deliberately; do not treat a blank library title as a UAT surprise.
result: [pending]

### 7. U7 — dismissal is an offer, not a wall
expected: Press the dismiss (✕). The card disappears, the graph takes the freed space, nothing is
lost and nothing is silently saved.
why_human: Visual/layout confirmation. The suites assert the child count drops from 3 to 2 with the
graph still last; they cannot see whether the space is actually reclaimed on screen.
result: [pending]

### 8. U8 — the deliverable row leads somewhere real
expected: Click the deliverable row's action. It opens the step that actually produces the file, and
lands on the field that decides what it says.
why_human: Requires driving real navigation and focus in a live canvas.
result: [pending]

### 9. U9 — the 11 px controls are actually legible
expected: The rows route to header controls that can be read, and the "AI-proposed" mark reads
beside a real sentence rather than orphaned.
why_human: Visual legibility judgement. Inherits `193.2-09`'s owed sliver, which has never been
browser-UAT'd.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

⚠ **Two code-review findings are OPEN and were found AFTER the plans closed** (`197-REVIEW.md`,
commit `d0ef74fb`). They are recorded here so a UAT session does not rediscover them as surprises,
and so neither can go quiet:

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
status: open — routing not yet decided

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
status: open — routing not yet decided
