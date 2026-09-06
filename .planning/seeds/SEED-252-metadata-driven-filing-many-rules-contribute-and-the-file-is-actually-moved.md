---
seed_id: SEED-252
title: "Metadata-driven filing — many rules contribute instead of first-match-wins, and a matched file is actually MOVED instead of merely suggested. Both are deliberate reversals of recorded decisions (D-118-3, D-118-2), not omissions."
created: 2026-09-06
planted_during: "2026-09-06 — operator G-4 session on Phase 234; asked for M-Files-style metadata-driven routing into folders and subfolders, and for multiple classification rules rather than one"
status: deferred          # OPERATOR-DEFERRED at Phase 237 (2026-09-06) -- stays for its own phase
surface: Agentic-RAG
severity: medium
category: dms / classification / automation
priority: high
relates_to:
  - backend/app/api/documents.py:2390 — the `break` that makes it first-match-wins (D-118-3)
  - backend/app/services/classification_matcher.py — `build_suggestion`, the "D-118-5 single suggestion object"
  - backend/app/services/classification_rule_service.py — rule CRUD; `suggest_folder_id` is already any folder in the tree
  - BUG-260906-01 — classification never runs on the queue path; the plumbing half, true regardless of how this seed is decided
  - SEED-250 — retention/archival; the other half of "the system decides what happens to your documents"
  - Phase 118 — where the suggestion model was built and the two decisions were recorded
trigger_when: >
  The next phase touching classification, document routing, or connector-sourced filing. Also fires
  on any enterprise DMS conversation where "the system files it for you" is the expected behaviour
  rather than a feature — which, for an M-Files/OpenText-shaped buyer, is the first meeting.
  ⚠ BUG-260906-01 must be fixed FIRST or this seed is unimplementable: rules do not run on the
  path that synced files take.
---

## What the operator asked for

> *"for the classification and M-Files, that it will ingest or classify the file in a specific folder
> or a specific subfolder … and also to enable multi classification, not necessarily one
> classification rule but maybe multiple classification rules"*

Two asks, and they are further apart than they look.

## What exists today — measured 2026-09-06, not recalled

| Capability | Status |
|---|---|
| Route into a **specific folder or subfolder** from metadata | ✅ **Already built.** `classification_rules.suggest_folder_id` points at any folder, and folders are a tree — a subfolder is just a folder. Nothing new is needed for this half. |
| **Multiple rules** exist and are evaluated | ✅ Built. Rules are a table with full CRUD; all enabled own+global rules are read and evaluated per document. |
| Multiple rules **contribute** | ⛔ **No.** `documents.py:2390`: `for rule in rules: … break`, commented **`first-match-wins (D-118-3): ONE object, never an array`**. Rule #2 cannot contribute once rule #1 matches. |
| A matched file is **filed** | ⛔ **No, by decision.** `classification_rule_service.py`: *"The rule NEVER moves a document at create — the move happens only when the user accepts the suggestion"* (D-118-2). |
| Any of it on **synced/watched** files | ⛔ **Never runs.** See `BUG-260906-01`. |

⭐ **So the operator's first ask is already shipped and the second is one `break` away — but the
thing they actually mean by "M-Files" is the third row, and that one is a real decision.**

## The two reversals, and why only one of them is small

### 1. Many rules contribute (reversing D-118-3) — small, but not free

Removing the `break` turns `_classification` from an object into an array, and **every consumer of
that key becomes a decision**: the accept endpoint (`documents.py:1892`), the dismiss endpoint, the
preview panel (`preview_service.py:475`), and the frontend chip. The interesting question is not
"can two rules match" but **"what happens when two rules suggest different folders"** — a document
belongs to exactly one folder today.

Three shapes worth costing before choosing:
- **Ordered/priority** — rules carry a rank; the highest-ranked match files it, the rest are recorded
  as also-matched. Cheapest; keeps one folder; makes the ordering visible instead of accidental
  (today "first" means whatever order the DB returned, which is itself a latent bug).
- **All contribute, one folder + many tags** — the folder comes from the top match; every other match
  contributes metadata/labels. This is closest to how M-Files actually behaves (an object has many
  classes and properties; "where it lives" is a view, not a location).
- **Multi-file / linked** — a document appears in several folders. ⚠ Requires a
  document↔folder join table; `documents.folder_id` is a single FK today. **This is the expensive
  one and should not be chosen by accident.**

### 2. The file is actually moved (reversing D-118-2) — the serious one

**This is the first time the product would move a user's document without being asked.** D-118-2 is
not timidity; a suggestion is reversible by ignoring it, and a move is not. Before it flips:

- **Who is accountable when it files wrongly**, and how is that visible? The `audit_log` and the
  `prior_folder_id` Undo stamp (D-118-6) already exist and are the substrate.
- **Does it apply retroactively** to the corpus, or only to arrivals? Retroactive filing of 123
  existing documents is a different and much louder operation.
- **Can a person turn it off per rule**, so "suggest" and "file" coexist? Almost certainly yes — and
  that likely makes this a per-rule `mode` column rather than a global reversal, which is far cheaper
  and far less frightening than flipping D-118-2 wholesale.

⭐ **Recommendation: a per-rule `action` (`suggest` | `file`), defaulting to `suggest`.** It reverses
nothing by default, it makes the powerful behaviour opt-in per rule, and it leaves D-118-2 standing
as the default posture rather than deleting a decision that was made for good reasons.

## Why this is worth real money, and why it is close

`docs/PRODUCT-PACKAGING.md` scores classification as ⚠ partial against the enterprise DMS list.
**The gap between ⚠ and ✅ here is one `break`, one column and a bug fix** — not a subsystem. And
combined with Phase 234's watched folders, "point it at your Drive and it files itself" is the
demo that distinguishes this from a chat product with a file upload.

⚠ It pairs with `SEED-250` (retention/archival). Both are the same promise — *the system decides
what happens to your documents over time* — and a buyer who asks about one asks about the other in
the same breath.

## The blocker, stated plainly

⛔ **`BUG-260906-01` first.** Classification rules do not execute on the queue ingest path, which is
the path every watched and synced file takes. Until that is fixed, every design above would ship as
a feature that works only on hand-dragged uploads — the exact path automated watching exists to
replace.
