# Phase 104: PM Flagship Content Pack - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 104-pm-flagship-content-pack
**Areas discussed:** How the pack ships + author proof; Pack depth vs breadth; Out-of-box demo KB; Status-report content + registers

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| How the pack ships + author proof | Seed migration vs author-live vs hybrid; the "domain-author-driven" proof | ✓ |
| Pack depth vs breadth | All 3 full workflows vs headline-deep + starters | ✓ |
| Out-of-box demo KB | Ship sample project + docs vs bring-your-own | ✓ |
| Status-report content + registers | Sections/fields + which register schemas ship | ✓ |

**User's choice:** All four. Then: "proceed with your recommendations."

---

## How the pack ships + author proof

| Option | Description | Selected |
|--------|-------------|----------|
| SQL seed migration (global) | Ship defs as global published rows like 061 | partial |
| Author live through the page | Author the whole pack via the Workflows page | partial |
| Hybrid: opt-in seed script + page-authored proof | Self-contained script (folder+docs+templates+defs); prove author-driven via one page-authored workflow + Tweak→v2 | ✓ |

**User's choice:** the hybrid recommendation, **refined by verification** to: opt-in self-contained
seed script, **per-account (`is_global=false`)**, with the author-driven proof = Charter authored
through the page (text deliverable) + Tweak→v(N+1) on a seeded workflow.
**Notes:** Verification CONFIRMED (A1/A2/A3) there is no library-template upload route and the
Builder has no template-attach UI, so template-fill defs must be seed-authored; the page CAN fully
author a text deliverable (C1) and Tweak→v(N+1) is an INSERT fork with DB-enforced immutability (C2).
A global pack hits an untested `is_global=true` asset path → per-account chosen.

## Pack depth vs breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Three full publishable workflows | Charter + Status + Risk, each full + scoreboard | |
| Depth on headline + two lighter | Status = full + SC#10 scoreboard; Risk = full publishable; Charter = page-authored text proof | ✓ |

**User's choice:** depth on the headline.
**Notes:** Weekly Status Report = the SC#2 headline + the full SC#10 4-axis scoreboard; Risk Register
= second full publishable (judge-passing, no full scoreboard); Project Charter = the page-authored
TEXT-deliverable proof. Three full cross-provider scoreboards rejected as redundant/expensive.

## Out-of-box demo KB

| Option | Description | Selected |
|--------|-------------|----------|
| Ship a sample project KB | Synthetic "PM Demo Project" folder + source docs, seeded | ✓ |
| Bring-your-own project | Operator binds the pack to their own folder; no sample data | |

**User's choice:** ship the sample KB (opt-in script).
**Notes:** Verification (D1) surfaced that a GLOBAL sample folder pollutes every tenant's
`search_documents`/`list_documents` (no exclusion mechanism) → decision refined to seed
**per-account (`is_global=false`)**. Ingest via `POST /documents/upload`; budget one live
embeddings call per doc at seed time.

## Status-report content + registers

| Option | Description | Selected |
|--------|-------------|----------|
| Standard PM status sections + spike risk-register schema | RAG status/accomplishments/upcoming/risks/metrics + 9-col risk register | ✓ |
| Add RAID / stakeholder grids now | Broader register set as grids | (→ Phase 106) |

**User's choice:** standard sections + the spike's risk-register schema.
**Notes:** Verification (B3) established the template-fill workflow must be 2-phase (retrieve→emit)
because the citation gate validates against upstream source_refs. Worded→numeric Score mapping
(spike Condition 3) carried. RAID/stakeholder grids → Phase 106 (GRID-01). CPM/EVM → deferred.

## Claude's Discretion

- Synthetic corpus content/size; template `.docx` visual design + tag layout; exact section copy;
  whether the seed script drives the live publish gauntlet per workflow at provision time.

## Deferred Ideas

- Run-surface DEEP refinement + 3 render bugs (→ 103.1, D-103-A); globally-shared (`is_global=true`)
  pack variant (KB pollution + untested path; pairs with ROLE-01/109); Builder template-attach
  affordance (SEED-084-adjacent); the `/workflows/generate` `template_asset_id` UUID-vs-path seam
  (follow-up fix); SEED-069 living-document re-ingestion for the recurring status report; grids
  (Phase 106); CPM/EVM (deferred); starter library (SEED-084).

---

*All load-bearing code claims adversarially verified during discuss-phase (workflow wf_9c59dcb9-7db, 13 claims, all CONFIRMED).*
