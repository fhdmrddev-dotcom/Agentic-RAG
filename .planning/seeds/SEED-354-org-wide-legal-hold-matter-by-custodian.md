---
seed_id: SEED-354
title: "Org-wide legal hold by custodian — a matter that holds a named person's documents, including their private ones"
created: 2026-10-12
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "SEED-345's remainder (chat/message retention, per-org rate limits) gets a phase number; OR a customer, contract or counsel asks to hold a named person's documents (a custodian hold); OR any phase changes who an org admin can see in the Library (private-document visibility, D-34)."
trigger_paths: ["backend/app/services/retention/**", "backend/app/api/retention.py", "backend/app/db/retention.py", "supabase/migrations/*retention*", "frontend/src/components/retention/LegalHoldDialog.tsx"]
trigger_surfaces: ["admin", "library"]
migration_note:
relates_to: ["Phase 275 D-34 / D-35 (275-CONTEXT.md)", "SEED-345 (remainder: chat/message retention, rate limits)", "SEED-072 (data-subject rights)", "SEED-250 (answered by 275)", "supabase/migrations/204_retention_and_legal_hold.sql (legal_holds / legal_hold_folders / legal_hold_documents)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-354: Org-wide legal hold by custodian

## The finding

Phase 275 shipped legal holds as **named matters covering folders and documents an org admin can pick**
(D-35). An org admin can only pick what they can see, and private documents are not visible to them
(D-34), so **a member's private documents cannot be held**. The database refusal (mig 204 BEFORE DELETE /
TRUNCATE triggers) applies to every covered document on every path, but coverage itself stops at the
org-visible set.

Real legal holds are usually written **by custodian**: "preserve everything belonging to these people
from date X". Today there is no way to express "everything owned by user U, including what only U can
see", and no way to hold a document nobody with `org:manage` can see.

Recorded as a known limit in `275-G4-EVIDENCE.md` §6 and the public Retention guide
(`docs/public/administer/org/retention.md`, "Known limits").

## Why it matters

A regulated buyer's counsel will ask whether a hold reaches a departing employee's private files. Today
the honest answer is no, so a person could delete their own private documents while a matter about them
is open. Nobody has asked yet: this is speculative until a customer or contract does.

## When to surface

- SEED-345's remainder (chat/message retention, per-org rate limits) gets a phase number: the same
  "what does an org admin govern that they cannot see" question lands there.
- A customer, contract or counsel asks to hold a named person's documents.
- Any phase changes who an org admin can see in the Library (D-34's visibility rule).

## Scope estimate

**Medium-Large.** A custodian coverage table (`legal_hold_custodians`) is small, and the sticky-coverage
trigger pattern (mig 204) extends to it. The hard part is the privacy decision, not the code: a hold that
reaches private documents must not reveal their names or count to the admin who placed it (T-275-25 is the
rule today: preview shows a private COUNT only). That needs an operator decision on what an admin may
learn about content they cannot see, and possibly a separate "legal" role.

## Breadcrumbs

- `275-CONTEXT.md` D-34, D-35; `275-G4-EVIDENCE.md` §6 known limits.
- `backend/app/services/retention/load.py:21-24` (org-visible only), `hold_guard.py` (refusal per document).
- Phase 275 threat T-275-25 (admin learns private-document names via preview/hold): mitigated by counting,
  never listing, private documents.
