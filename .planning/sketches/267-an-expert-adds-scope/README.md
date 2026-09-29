---
sketch: 267
name: an-expert-adds-scope
question: "How does an Expert state what it costs or changes (a missing connection, a restricted scope, a swap or removal, a second-Expert handoff) visibly and at rest, before or as it happens?"
winner: "B — Will / won't ledger (operator, 2026-09-25)"
tags: [experts, chat, invite, transcript-event, handoff, pack-22, pack-23, pack-24, pack-25, g2-sketch-gate, phase-267]
---

# Sketch 267: An Expert adds scope

G-2 sketch for Phase 267 (`267-CONTEXT.md` D-267-22). It renders the four new states on the **shipped**
`InviteExpertDialog` row, `ActiveExpertChip` and catalog card styling, using realistic data: an `/Client ACME` thread
holding 4 documents, and Financial Analyzer, HR Advisor, Sales Pipeline Coach and Contract Reviewer.

## What both variants share (locked by CONTEXT, not by this sketch)

- Every consequence is **visible at rest**. None is hover-only or behind a disclosure (266 UI-3).
- A member never sees a button that does nothing. Admins see "Connect HubSpot →", members see "ask an org admin".
- A swap or removal is a persisted transcript row that survives reload and is **never** sent to the model.
- The second Expert opens a **new** thread carrying a handoff card. The original thread keeps its Expert and gets an
  event linking to the new one.

## The choice

- **A · One line:** each consequence is one sentence. The event is a slim centred pill plus one line of consequence.
  The dialog buttons read "Swap here / Ask in a new chat →".
- **B · Will / won't ledger:** each consequence is shown as labelled *Will use / Won't use* lists. The event is a
  small timestamped card with *Now / Dropped* lines. The dialog buttons read "Replace X / New chat with Y →".

Toggles: the variant tabs (A/B) and "Viewing as" (Org admin / Member).

## Winner — B (operator, 2026-09-25)

**B · Will / won't ledger** is the acceptance bar for 267:

- **Invite row and catalog card:** `Brings` / `Missing` lists for connections, and `Will use` / `Won't use · N` lists for a
  restricted Expert. The excluded files are named, and "Chat attachments" is listed under *Will use*.
- **Transcript event:** a small card with a timestamp and two lines, `Now` / `Dropped`. It is the same shape for a swap
  and for a removal.
- **Second-Expert dialog:** "Replace <active>" and "New chat with <Expert> →", plus an "<active> is active here" line.
  Neither is a bare verb.
- **Original thread after a handoff:** an event card, `Here: <active> stays` / `Open: <new thread> →`.
- **The ⛔ build obligation the ledger creates:** the two lists render from ONE structured payload (D-267-11 / D-267-17).
  They are never two independently computed strings that could disagree.
