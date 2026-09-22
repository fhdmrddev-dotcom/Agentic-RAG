# HANDOVER — 2026-09-20 · Experts (261 / 262)

Written by claude at the end of a session, for gemini and for whoever picks this up next.
Everything here is measured, not remembered. Re-derive rather than trust a figure.

## 1. THE ONE BLOCKING THING

**All of Phase 261 is uncommitted.** Five plans executed, `20` modified files and `10` new ones
sitting in a single working tree. `BUS-293` asked for atomic commits per plan and it did not
happen.

⛔ **Commit atomically per plan, oldest first, before any further work.** The reason is not
tidiness: this project's recurring lesson is that *inherited-vs-new red is established by checking
out the base and re-running*, and five plans in one diff makes that impossible. A finding raised
tomorrow cannot be attributed to a plan.

```bash
git status --short                      # 20 M + 10 ?? at the time of writing
git diff --numstat f3a1fe66f HEAD       # docs-only at HEAD; all source is UNSTAGED
```

## 2. Where the phase actually is

| Artifact | State |
|---|---|
| `261-CONTEXT.md`, `261-DISCUSSION-LOG.md` | written |
| `261-01` … `261-05-PLAN.md` | all 5 written (G-8 ceiling — do **not** add a sixth without a CONTEXT.md justification) |
| `261-01` … `261-05-SUMMARY.md` | all 5 executed |
| migration `189_expert_presentation_and_grants.sql` | written, **applied to LOCAL Postgres by gemini**, uncommitted |
| `supabase/full-schema.sql`, `scripts/full-schema-supplement.sql` | regenerated (no `--reset`), uncommitted |

**Frozen gate baseline: `f3a1fe66f`** (`.planning/STATE.md` § FROZEN BASELINE). Verified still
valid — the 4 commits after it are `.planning/` + `.agent-bus/` only, zero source.

## 3. What was verified, by measurement

`BUS-293`'s rename **landed clean**. Grant-axis `restricted` → `granted` across all 6 backend
sites plus `migration 189:17/19`; zero leftovers; `scope_mode` keeps `restricted` for the
knowledge axis. That collision is closed.

Both operator-ratified arms are implemented:

- **`D-v4.3-01` union** — `run_producer._resolve_thread_scoping` now reads `threads.folder_id`,
  and under the default (`biased`) composes `thread_subtree ∪ expert_folders`. `restricted` keeps
  expert folders only.
- **`BUG-260920-01` desync** — `scoped_folder_path` is threaded through `RunContext` and set from
  the same list retrieval uses, so the prompt can no longer name a folder retrieval is not reading.
- **`D-v4.3-02` tool floor** — new `EXPERT_DELIVERABLE_TOOLS = {execute_code, workspace_write,
  render_template, ask_user}`, unioned onto `EXPERT_CORE_TOOLS` when `tool_floor_enabled`.
- **PACK-07 / PACK-08** — `OrgExpertsTab` mounted in `OrgAdminShell`; `experts:manage` read from
  `role_permissions`; 9 write verbs added to the **existing** `/experts` router, no second router.

## 4. TWO OPEN FINDINGS — and they are the OPERATOR's, not the reviewer's

Both sit inside the arms `D-v4.3-03` excludes claude from reviewing, so they are reported as
observations and routed to the operator. **Do not close them on a reviewer's say-so.**

1. **Multi-folder `restricted` still names one folder.** `run_producer.py` sets
   `scoped_folder_path = _get_path(expert_folder_ids[0])`. An Expert with several knowledge
   folders gets only the **first** named in the injected prompt while retrieval covers all of
   them — the original bug's class, narrowed rather than closed.
2. **Subtree asymmetry.** Union expands the thread folder's **subtree**; `restricted` uses the
   expert's folders **without** expansion. A child of an expert folder is therefore invisible
   under strict isolation. May be intentional; it is not written down as a choice.

## 5. OWED: claude's scoped review of 261

**`D-v4.3-03` (`PROJECT.md` → Key Decisions) assigns it and it has NOT been done.** The split:

- **claude reviews:** PACK-07 (existing endpoints, no second router) · PACK-08
  (`role_permissions`, a second hardcoded role check must fail a fence driven RED) · PACK-09
  (draft row never auto-publishes; brainstorm uploads are **not** Library ingestion — storage
  **and** deletion both driven) · PACK-10 (`expert_grants`, RLS, migration 189, a readable row
  with no grant is neither visible nor invitable) · closed-core inventory vs base `f3a1fe66f`,
  **counted, never substring-matched**.
- **operator verifies live:** `D-v4.3-01` union composition and `D-v4.3-02` tool floor. One chat —
  invite an Expert into a folder-scoped thread, confirm both folders are readable, confirm it can
  still write a file. Mark these **operator-verified**, not reviewer-verified, in VERIFICATION.

⚠ If claude is unavailable, the operator reassigns. **Do not let gemini review 261** — it built it.

## 6. How a regular (non-admin) user sees Experts — measured, for 262

Filtered server-side by `list_expert_bundles_for_caller` (`backend/app/db/experts.py:200`):

| visibility | regular member sees it |
|---|---|
| **system** | always |
| **`org`** / **`public`** | any member of the org |
| **`granted`** | only with a row in `expert_grants` matching their user id **or a role** |
| **`private`** | creator only |

The row is **absent**, not greyed out — the SQL never returns it, which is what `PACK-11`'s
honesty criterion demands. Today's only door is composer `+` → `✨ Invite Expert…`; Phase 262 adds
the catalog + detail modal.

⚠ **Tier gating is ORG-WIDE while grants are PER-USER.** `require_capability("experts")` refuses
the whole org, so a member in a tier without Experts sees none regardless of grants. 262's
"available TO THEM" must honour both.

## 7. Registers — current, with what is still open

- **`BUG-260920-01`** → `status: folded`, `folded_into: "261"`. `/gsd:plan-phase` checks coverage.
- **`SEED-303`** → `partially-answered` / `partial: true`. **Still open and NOT ratified:** S3
  (two Experts at once — proposal is one active, second as a handoff thread), S8's
  clone-on-customise semantics for the pack business, and per-Expert usage/spend attribution
  (`threads.active_expert_id` exists, 256/257 persist tokens and dollars — a join, not a build).
- **`PROJECT.md` → Key Decisions:** `D-v4.3-01`, `D-v4.3-02`, `D-v4.3-03`.
- **Bus:** nothing open to claude. `BUS-293` (rename — done, close it) and `BUS-294` (review
  split) are open to gemini.

## 8. Gates, run from the repo root

```bash
node scripts/check-seeds-register.cjs            # was OK: 310/310, 0 dupes
node scripts/check-claude-md-size.cjs            # was OK: 108,921 / 120,000
node scripts/check-hot-file-ledger.cjs 261
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs
cd backend && pytest tests/unit -q --continue-on-collection-errors   # ceiling 71, ZERO headroom
```

⚠ Migration 189 is **local only**. It rides the v4.3 batch at deploy, pasted into the cloud SQL
editor by the operator — migration-then-backend, never the reverse. Both production orgs still
measure `subscription_tier IS NULL` and need a tier **before** the backend ships, or
`require_capability("experts")` refuses live.
