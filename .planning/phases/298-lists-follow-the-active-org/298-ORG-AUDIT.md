# Phase 298 — read-only org-stamp audit (SC#1 / ORG-06)

**Measured:** 2026-10-28, before any filter code exists. Read-only on both databases
(local through a `readonly=True` asyncpg transaction on `127.0.0.1:54322`; cloud through Supabase MCP
`execute_sql` SELECTs). No row was written.

Tables in scope: `folders`, `documents`, `workflow_definitions` (owner column `created_by`),
`threads`, `workflow_runs` (`definition_id`, `thread_id`).

## Cloud (production)

| Measure | Value |
|---|---|
| Distinct members / orgs | 2 / 2 |
| **Users in 2+ orgs** | **0** |
| Null `org_id` — folders / documents / definitions / threads / runs | 0 / 0 / 0 / 0 / 0 |
| Folder owner not a member of the folder's org | 0 |
| Definition owner not a member / thread owner not a member | 0 / 0 |
| Child folder org ≠ parent org | 0 |
| Document org ≠ its folder's org | 0 |
| Run org ≠ its thread's org | 0 |
| Run org ≠ its definition's org | 1 (a run of another org's published workflow — expected: a run lives in the runner's org) |
| Root documents (`folder_id IS NULL`) | 122 |
| Org-shared folders | 1 |

**Verdict:** production has **no item that can be mis-stamped by the mig-106 `LIMIT 1` guess**, because no
production user has ever had two memberships. Totals: 17 folders, 206 documents, 29 definitions, 219 threads,
20 runs.

## Local (dev)

| Measure | Value |
|---|---|
| Distinct members | 43 |
| **Users in 2+ orgs** | **5** (dev account `e6dc45ca`, test user `4ec41a82`, three `uat26x` fixtures) |
| Null `org_id` — all five tables | 0 |
| Child folder org ≠ parent / document org ≠ folder / run org ≠ thread | 0 / 0 / 0 |
| Run org ≠ definition org | 54 — all runs of a **published** workflow by a single-org runner outside the definition's org (2026-06-01 → 2026-08-14). Correct placement, not a mis-stamp. |
| Owner not a member of the row's org | 1 folder + 1 definition, both the synthetic 296 G-4 fixture org `29600000-…-0001` (owner `d8a54002`). Fixture, not a mis-stamp. |
| Root documents | 208 |

Rows a multi-org user owns, per org:

| Table | User | Org | Is user's own org | Rows |
|---|---|---|---|---|
| folders | dev `e6dc45ca` | `c1f18150` (own) | yes | 2 |
| folders | dev `e6dc45ca` | `22f9c615` | no | 1 |
| workflow_definitions | dev | `c1f18150` / `22f9c615` | yes / no | 1 / 1 |
| threads | dev | `c1f18150` / `22f9c615` | yes / no | 6 / 2 |
| workflow_runs | dev | `c1f18150` / `22f9c615` | yes / no | 3 / 2 |
| threads | `1b6dd214` (uat267) | `e8c567c2` | no | 3 |

The dev account's split rows were all created within seconds on 2026-10-21 (the 295 two-org fixtures), one per
org on purpose. **No local row is identifiably mis-stamped either.** A `LIMIT 1` mis-stamp is not detectable
from data: it always lands in a real membership, so only the owner can say "this belongs in my other org".

## Workflows bound to another org's folder (ORG-05)

`definition->>'project_folder_id'` (decoding the 325 local / double-encoded string rows, SEED-154) joined to
`folders.org_id`:

| DB | Bound drafts / cross-org | Bound published / cross-org | Bound folder missing |
|---|---|---|---|
| Cloud | 6 / **0** | 5 / **0** | 0 |
| Local | 34 / 0 | 42 / **1** (a 295 two-org fixture) | 0 |

So a launch-time refusal changes the outcome of **no production workflow**, attended or unattended.

## What the 296 G-4 observation actually was

SEED-389 recorded "after switching to a second org, the Library listed 32 first-org folders". The user then
(`4ec41a82`) owns **zero** folders; org `22f9c615` holds 33 folders. So what leaked across the switch was the
**other org's org-shared folders**, reached through `fetch_visible_folders`'s shared-subtree arm — not
mis-stamped items. ORG-01 narrowing must therefore cover the shared arm, not only owned rows.

## What the counts decide (ORG-06 shape)

1. No migration and no bulk repair: there is nothing to bulk-repair on cloud, and nothing identifiable locally.
2. The honest count ("N items in <org>") is the primary ORG-06 surface; the move is a rarely-used owner repair.
3. The move stays per item, owner-initiated, membership-checked on both orgs, and audited, and is scoped to
   row types whose move is a bounded write (see CONTEXT D-18..D-21).
