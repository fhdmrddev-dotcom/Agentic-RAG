---
sketch: 275
name: retention-legal-hold
question: "How do retention policies, named legal holds and the human-approved delete queue compose inside Org admin → Retention, and how does the Library show a member what will happen to a document?"
winner: "1B (sub-tabs) · 2B (form + Preview gate) · 3A (batch + type-the-count) · 4B (chips + folder line + panel) — operator, 2026-10-12"
tags: [phase-275, retention, legal-hold, disposition, dry-run, audit-receipt, org-admin, library, g2-sketch-gate]
---

# Sketch 275: Retention & Legal Hold

G-2 sketch for Phase 275 (RET-01..04, `SEED-250`). Operator intake (2026-10-12):

- **Policy home:** Org admin → Retention (unlocks the existing locked tab in `OrgAdminShell.tsx`). The Library shows the rule read-only.
- **Legal hold:** a NAMED hold (a "matter") with a reason, covering documents and/or whole folders (and anything added to them later).
- **Delete gate:** archive runs on its own. **Delete always waits for a person to confirm each document by name.** ⚠ This is stricter than ROADMAP SC#3's wording ("a scheduled sweep then disposes exactly that set"). Record it in CONTEXT at discuss-phase.

Built on 080-A (org-indigo band + tabs, "every action recorded"), 062-A (the ledger IS the receipt, ✎ write mark), 066 graded action guards (target-specific destructive → victim-naming confirm), 270 (labelled dates in the detail panel), 271 (Library + "Include archived" sits beside the version filter).

## How to View

open .planning/sketches/275-retention-legal-hold/index.html

Top bar: **Screen** (1-4) × **Variant** (A / B) × **View as** (Org admin / Member).
A 24-document org (Halden & Co., today = 12 Oct 2026) drives every count. Dry runs are computed, not faked.

## Variants

| Screen | A | B |
|---|---|---|
| 1 Retention tab | one page: posture line → approval banner (only when non-empty) → Policies → Legal holds → recent actions | sub-tabs with counts: Policies · Legal holds · Waiting for you · History |
| 2 Policy + dry run | sentence builder; the live dry run beside it IS the preview | plain form; Save locked until Preview; any edit marks the preview stale |
| 3 Delete approval | one batch per policy, untick to keep, type the count to confirm | one document at a time, Keep / Delete, then one final confirm |
| 4 Library view | quiet: only the document panel says it | chips in rows + a folder line + the panel |

## Fail-closed states shown (all screens)

- **No date** → "can't be decided — nothing will happen" (Invoice INV-0902, Fjord Logistics MSA).
- **Two policies that disagree** on one document → nothing happens until one changes (screen 2 collision).
- **Held** → skipped by the sweep, refused by Delete with the reason (screen 4, Halvorsen contracts).
- **Hold placed after the sweep** → dropped at confirm, recorded as "did not delete" (screen 3, "Simulate a late hold").
- **Every action** → one receipt row naming document, policy, action, approver, time.

## What to Look For

- **Screen 1:** can you tell in 3 seconds whether anything needs you? Is the red approval banner too loud for a page the admin opens rarely?
- **Screen 2:** does the dry run feel like proof, or like noise? A makes the preview unavoidable; B makes it a gate. Which is harder to misuse?
- **Screen 3:** type-the-count vs one-by-one. With 4 documents both are fine; picture 400.
- **Screen 4:** **open question:** should a MEMBER see the hold's case name? The sketch hides it ("On legal hold. Ask an org admin"), because a matter name can itself be confidential.
- **Screen 4:** archived documents are hidden by default with "1 archived document hidden · Show". Is that enough for RET-04's "stays findable"?

## Winners (operator, 2026-10-12)

- **Screen 1: B** — Retention tab uses sub-tabs with counts: Policies · Legal holds · Waiting for you · History. The red count on "Waiting for you" is the signal; no banner on the landing tab.
- **Screen 2: B** — plain form. **Save is locked until Preview has run**, and any edit after the preview marks it stale and re-locks Save. The dry run is a gate, not a side panel.
- **Screen 3: A** — one batch per policy, untick to keep, type the count to confirm. Every document re-checked at confirm; a hold placed after the sweep drops the document and writes a "did not delete" receipt.
- **Screen 4: B** — retention is visible in the Library: chips on rows (On hold · Archived · Archives tonight · Delete pending · No date), a folder line naming the folder's policy/hold, and the panel's Retention section. Archived documents hidden by default with "N archived hidden · Show" + "Include archived".

### Still open (for discuss-phase 275)

1. **Delete gate vs ROADMAP SC#3** — the operator chose human approval for every delete; SC#3 says the scheduled sweep disposes the set. Reconcile the wording in CONTEXT.
2. **Hold case name for members** — not answered. The sketch's default hides it from members ("On legal hold. Ask an org admin"); confirm at discuss-phase.
