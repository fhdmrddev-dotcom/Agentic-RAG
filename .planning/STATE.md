---
gsd_state_version: 1.0
milestone: v3.9
milestone_name: "Connections: Any Service, Any Tool"
status: executing
last_updated: "2026-08-26T17:02:47.310Z"
last_activity: 2026-08-26 -- Phase 211 execution started
progress:
  total_phases: 14
  completed_phases: 1
  total_plans: 8
  completed_plans: 3
  percent: 7
---

# Project State

> ⚠ **This file was RESET at the v3.8 close (2026-08-26).** The previous STATE.md had reached
> **4,364 lines / 361 KB** — the same balloon that forced the v3.6 reset, and most of its tail was
> v3.6-era prose that had outlived two milestones. **Nothing was deleted:** the full file is
> archived verbatim at `.planning/milestones/v3.8-STATE-at-close.md`, including every per-phase
> position entry, the v3.6 *Open at close* list, the 46-row Deferred Items table and the Quick Tasks
> table.
>
> **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records
> and corrupted this file five times during Phase 190 alone while reporting success.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-08-26)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** Phase 212 — the-catalog-and-its-doors
Phase numbering continues at **210**.

## Current Position

Phase: 212 (the-catalog-and-its-doors) — IN PROGRESS (discuss-phase complete)
Plan: —
Status: Phase 212 context gathered & decisions locked in `212-CONTEXT.md` (D-212-01..16). Ready for plan-phase.
Last activity: 2026-08-27 — Phase 212 discuss-phase completed; BUG-260810-01 folded, SEED-207 marked answered.

## ⚠ Owed before 212 — all three are OPERATOR-ONLY

1. ✅ **`bash scripts/regenerate-full-schema.sh` — DISCHARGED 2026-08-27, and it was already
   done.** Re-run by the reviewer: **zero diff**. `0396aea2` had already regenerated the artifact,
   so a greenfield deploy DOES carry migration 127. Verified in `full-schema.sql`: `service_id` ×7,
   `has_a_service_identity` + `shape_is_not_ambiguous` present, migration 126's `shape_is_one_of_two`
   gone. ⚠ `211-05-SUMMARY.md` claimed this was owed AND that `docker` is denied to the agent —
   **both were wrong**, and the summary is corrected in place.
2. ⭐ **`/code-review ultra review-210-211-base`** — 46 files / 5,784 lines, both phases' source
   in one pass. It is the ONLY independent gate on **two reviewer-authored fixes that have no
   verifier** (`7bd77065` W-1, `ca015df9` SC#10). Branch built in `.claude/worktrees/revbase`;
   tear down with `scripts/teardown-worktree.sh` afterwards, and **never `rm -rf`** it.
3. **211's five per-shape UAT rows + four G-4 lived-experience checks.** Row 5 is named as the one
   to run first; **row 3 (SMTP · `send_email`) is ⛔ BLOCKED** — no such connection exists here
   (the table holds `slack`, `jira`, `mcp.deepwiki.com`).

✅ **`BUG-260827-01` — CLOSED 2026-08-27 by `/gsd:fast` (`8487ec99`), arm 2 only.** The paragraph
this replaces asked 212 to *"name its owner or three phases will each assume another has it"*; the
owner turned out to be the `/gsd:fast` the report itself prescribed, and **212 no longer needs to
route it.** The guard is split into two arms, the service-only row gets the honest *"names a service
but no way to reach it yet"*, the `getattr` DEFAULT is KEPT (a connection with no `capability`
attribute at all still passes) and the guard was NOT widened (a genuinely mismatched row is still
refused). **The RED was observed firing** — `test_211_service_shape_seam.py` §7 was authored to pin
today's wrong behaviour on purpose, failed on its source assertion against the fixed source, and was
rewritten in the same commit → 14 passed. Baseline held: `tests/unit` 68 failed / 2778 passed.

⚠ **TWO THINGS THE `✅` DOES NOT DISCHARGE, and both are live for 212 / 214 / 215:**

- **ARM 1 IS STILL OPEN and is a DIFFERENT failure.** The report measured two reachable paths. Only
  the definition/API-reachable one (the words) is fixed. **The UI-reachable path —
  `ConnectionPicker.bind` clears the step's `capability`, a service-only row advertises no action,
  and the closed-set guard raises a bare `KeyError` at `phase_types.py:~2323`** — is untouched and
  still stack-trace-shaped on the surface whose whole discipline is not over-claiming. Kept asserted
  in §7 so it cannot quietly vanish; it is now the report's `re_open_trigger` (OAuth / Phase 215, or
  the next touch of the closed-set guard). **A phase that reads only the `✅` will ship over it.**
- **G-5 ON `phase_types.py` IS NOW OWED, NOT HONOURED.** Its ledger row read *honoured by
  construction (211)* purely because the phase's diff was EMPTY. It is no longer empty, and this was
  a G-3 fast fix with **no review cycle** — the right instrument for four lines, the wrong one for a
  2,664-line hot file. Re-derived at the fix's commit: **47 commits / 21 phases / 2664 L, G-5 still
  FIRES.** The next phase whose `files_modified` names this file owes a refactor recommendation as
  its FIRST option.

---

**Phase: 211 — The Connection Is a Service, Not a Verb — EXECUTING (5 plans, 4 waves; plan-checker
PASSED at iteration 2 — 0 blockers / 2 warnings, both applied inline).** Wave 1 landed
(`4bf1142f` sanitizer widened by exactly two keys, `bf06a2b1` the seven closed-set spellings pinned).
⭐ **211 is CLAUDE-BUILT** (AGENTS.md §3.1 — migration 127 commits a table shape and drops mig 126's
`CHECK`). **Gemini reviews it; the operator runs `/code-review ultra`** — that is the real gate.

**Phase: 210 — Ground Truth — Operability & Failure Honesty — ✅ COMPLETE (3/3 plans), closed
2026-08-26 WITH OWED ROWS.** Closed as a DECISION, not as a claim everything passed —
`210-VERIFICATION.md` carries the full record.
- **SC#1 DRIVEN and passing** (kill-switch both ways, DB-verified, refusal observed, install restored).
- **SC#2 / #3 / #4 shipped but NOT DRIVEN** — blocked on absent test data, not on defects: the schedule
  door needs a `provenance === "published"` row and this install has none (`Yours 0`), and
  `workflow_schedules` holds 0 rows. ⚠ **SC#3 is structurally unreachable through the UI** — the lift
  fires only on an exact `50_000` while the modal now defaults to `500_000`.
- **SC#5 code-complete, never observed** against a real embedding outage.
- ⚠ **SC#10 was NEVER RUN.** The ROADMAP binds 210 to SC#10 with the **embedding** roster
  (OpenAI / Google / Ollama / LM Studio / OpenAI-compatible), and no row was executed. That is the axis
  where W-1's residual weakness lives — the provider name falls back to substring-matching base URLs.

⚠ **GUARDRAIL / SEPARATION OVERRIDES — audited, per AGENTS.md §6.3:**
1. **No independent verifier exists for SC#5's W-1 fix.** Gemini authored it, ran out of quota, and the
   **reviewer committed it** (`7bd77065`, disclosed in that commit message). `/code-review ultra` —
   operator-only — is the outstanding gate.
2. **The reviewer drove the UAT** because the builder was out of quota and the operator authorised it.
   Correct seat under §3.1; the before-state was captured before any browser touched the install.
3. **W-2 has NO OPERATOR RULING.** `705a7412` modified `phase_types.py`, which BUS-006 ruled 210 would
   leave inside 211's fence — and 211 has since committed into that same file.
4. **A reviewer claim was WRONG and is corrected in `210-REVIEW.md`, not edited away** — the W-1
   "names the wrong provider on this install" assertion. `_val()` falls back to the env var, so a
   dedicated embedding key is set and the client really points at OpenAI.

**Review history:** pre-flight (7 findings) → round 1 **BLOCKER** (`KeyError: 'document_id'` driven at
3 reachable sites) → round 2 (V-1/V-3 fixed, SC#5 unmet, fence crossed) → W-1 fix reviewed + committed.

**Bugs:** `BUG-260826-04` → `closed` (`verified_closed_by: "210"`). `BUG-260815-05`, `BUG-260826-03`,
`-06`, `-07` → `folded`, each carrying its own reason for not closing.

⚠ **210 and 211 run alongside and share the `live_connectors` flag.** File fence, agreed with the
operator (`211-CONTEXT.md` § Integration Points): **211 owns** `models/connector.py`,
`api/connectors.py`, `connector_service.py`, `mcp_client.py`, `harness/grounding.py`,
`phase_types.py`, migration 127, all of `components/settings/`. **210 owns** `api/admin.py`,
`components/admin/`, `scheduler_service.py`, `retrieval_service.py`, `embedding_service.py`.
A file needed from the other side goes on the bus.
⚠ **`BUS-009` is ANSWERED and closed** — Phase 210's re-review is delivered (`210-REVIEW.md` Round 2).
⚠ **`BUS-005` / `BUS-006` / `BUS-007` are answered and closed.** (`AGENTS.md §3.1`:
the reviewer must not have shaped the build).

### Phase 211 — wave structure

| Wave | Plan | Files | Autonomous |
|---|---|---|---|
| 1 | `211-01` descriptors + sanitizer + the seven closed-set spellings | 5 | yes |
| 2 | `211-02` migration 127 + the column lockstep + the wire contract | 10 | **no** — operator pastes the SQL |
| 3 | `211-03` settings ∥ `211-04` workflows | 5 / 8 | yes / yes |
| 4 | `211-05` fences, both seam halves, gate knobs, ledger, G-4 | 7 | **no** — G-4 human-verify |

⚠ **No file appears in two plans** — verified mechanically, not asserted.
⚠ **Migration 127 is applied by PASTING INTO THE SUPABASE SQL EDITOR**, never `supabase db push` /
`db reset`, then `bash scripts/regenerate-full-schema.sh` (no `--reset`). `full-schema.sql` is
REGENERATED, never hand-edited. It also carries `GRANT SELECT (service_id)` **in the same migration**
— its omission is a total 503 on every read of the table, measured 2026-08-25.

### The defect plan-checking caught — recorded because it is this project's signature failure

Revision iteration 1 found the first-draft D-211-12 picker fix created a **closed loop**: migration 127
backfilled `service_id` but **not** `discovered_tools`; the new gate rendered the picker only when
`discovered_tools.length > 0`; and that `null` short-circuited the **whole component, including the
Discover button** — so a legacy row with an empty list could never be populated and became unusable in
a workflow step. It also regressed the MCP path (a fresh MCP connection with zero tools lost its
Discover affordance) in a test file the plan had not declared.
⚠ **No planned test could have caught it:** the new legacy fixture was pre-populated, the seam test was
backend-only, and `reachability.test.tsx`'s POSITIVE CONTROL 2 asserts the *defect* — it would have
stayed **green** while SC#2 was false. **A control that stays green while the criterion is false is
worse than no control.** Remedy shipped is **both** arms: the migration backfills existing rows
(today's data) **and** the gate splits into card-boundness / list-length / un-gated Refresh (the shape).

---

## Milestone v3.9 — scope as agreed with the operator (2026-08-26)

**Goal:** A person connects a *service* — not a protocol — sees every tool it offers, grants each
one individually, and then uses it by name in chat and as a specific step on the canvas.

⭐ **NOTHING IS PER-VENDOR.** A connection is `{service identity, auth, discovered tools, per-tool
grants}`. Adding a service adds ROWS, not code. Three doors in, in cost order: **custom MCP URL**
(zero engineering — this is what makes the menu unbounded) → **Popular catalog entry** (a few
strings) → **BYO OAuth** (only for first-party APIs with no MCP server; cost is per AUTH FAMILY, not
per product — one Google connection serves Gmail, Drive, Calendar and Sheets).

### The four decisions taken at scoping

| # | Decision | Consequence |
|---|---|---|
| D-v3.9-01 | **OAuth: BYO first, we-own-the-app later** | A customer-registered client_id/secret works on EVERY deployment including self-hosted. ⚠ Claude.ai's 2-step Connect is explicitly NOT day one — our redirect URI would point at our cloud and exclude on-prem. Do not let a sketch promise it. |
| D-v3.9-02 | **The chat surface IS in scope** | The per-tool approval model is its HARD PREREQUISITE. The standing rule holds: never an outbound capability in `_TOOL_REGISTRY` before the approval model exists. |
| D-v3.9-03 | **Inbound is its own later milestone** | Public REST API / webhooks / service accounts / us-as-an-MCP-server (`SEED-013`, `SEED-195`) are OUT. The milestone name deliberately drops "& Open Platform" so it does not over-promise. |
| D-v3.9-04 | **Nine open bugs fold in; the rest are swept separately** | The seven v3.8 connector/scheduler reports + `BUG-260810-01` + `BUG-260815-05`. Two are BLOCKING. |

### Seeds folded (12)

`SEED-202` `204` `205` `206` `207` `208` — the recorded scope order, and **`207` is a PREREQUISITE**:
while two connection models coexist, every surface (node face, mark, filter, chat mention, catalog)
must branch, and each new surface pays the branch again.
Plus the foundation: `SEED-142` `144` `145` `146` `177`. Plus `SEED-213` (human-initiated attach).

### ⚠ Deferred WITH A BINDING RE-OPEN TRIGGER — the connector→KB ingestion axis

`SEED-209` / `210` / `211` / `212`. **`SEED-210` measures that synced documents flatten source ACLs
and that source deletions never propagate**; `SEED-211` is the M-Files metadata-permissions fork.
Shipping auto-ingest without them is **not a gap, it is a security defect**. → a **Connected
Knowledge** milestone.

> **RE-OPEN TRIGGER: the first AUTOMATIC or BACKGROUND sync from a connected source.**

`SEED-213` is deliberately kept IN scope because a human picking one file dodges every one of those
problems — no ACL mirroring, no deletion propagation, no sync loop.

### Measured facts that must not be re-derived from stale prose

- ✅ **MCP-first is already HALF-BUILT.** `backend/app/services/mcp_client.py` (367 L) and Phase
  206.2's per-tool grants both ship at HEAD. **`CONNECTIONS-MILESTONE-CANDIDATE.md`'s claim that
  "no MCP client exists in the backend today" is STALE** — do not plan against it.

- ⚠ **OAuth genuinely is zero.** Exactly ONE occurrence of the string in all of `backend/app`, and
  it is a comment in `models/connector.py` stating there is no authorization-code flow, no redirect
  URI, no callback, no refresh token and no consent surface.

- ⚠ **A migration is owed before OAuth can store one row.** Migration 126 leaves
  `CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)`; an OAuth service has neither and
  is refused by the database.

- ⚠ **The three fixed verbs must NOT be deleted.** `send_email` / `create_ticket` / `post_message`
  are the only external path that works with **no MCP server** (`phase_types.py:2311-2322` — two
  shapes reach the executor, each closed by a different set). They become an ATTRIBUTE, never the
  organising axis.

- **Reference designs are `screenshots/` and they are Claude.ai** — verified 2026-08-26 by reading
  the images. (An earlier conversation attributed them to "Plot AI"; that is wrong.) The sixth file
  is a `.webp` whose hex filename decodes to
  `https://pixlcore.com/images/blog/xyops/workflow-edit.webp` — **xyOps**, the canvas reference.
  ⚠ The Claude.ai shots show a product where the vendor owns every OAuth app — so the **catalog IA
  and the per-tool grant grain** are the acceptance bar, NOT the two-click Connect moment.

## ⚠ Open at close of v3.8 — read before scoping anything

Full evidence: `.planning/milestones/v3.8-MILESTONE-AUDIT.md` (`status: gaps_closed_partial`).

1. **Three requirements are narrower than their wording**, all carried with re-open triggers:
   `{{prior_run.*}}` reaches 3 of 7 executors and **misses `llm_emit`** — the only path producing a
   typed deliverable; email thread dedup is **parsed at four sites, stored at three, read by none**;
   `TAB-02` covers **newly ingested** documents only (`backfill_document_table_chunks()` has zero
   production callers).

2. ⛔ **Seven of twelve v3.8 phases had no `VERIFICATION.md`** and `REQUIREMENTS.md` was stale from
   day one. Both repaired at the close audit. **This is the SECOND consecutive milestone to close
   this way** — v3.6's own retrospective reads *"the paperwork was the problem, never the code."*

3. ⚠ **Phase 209 is gated behind `visual_workflow_canvas`, whose cold default is `off`.** Its 16/16
   browser drive ran against a flag-flipped database. **A launch decision is owed.**

4. ⚠ **209's node face is absent from the RUN surface** (`SEED-206`) and **209's final fix was
   authored by the reviewer** — self-assessed, no independent review, **owed**.

5. ⚠ **207 and 208 ran with no GSD ceremony and no independent verification** (audited under
   *Guardrail overrides*). **`D-207-06` has no guard**: a symbol exported from a `lib/api` module
   but forgotten in the barrel typechecks perfectly and is invisible to every consumer.

6. ⚠ **Blocking DNS inside an async handler** at `mcp_client.py:220` — violates D-v2.5-01 while the
   sibling capability path IS threadpooled. **Directly in this milestone's blast radius.**

7. ⚠ **`SEED-203`**: the publish judge passed a golden run whose deliverable REFUSES the work, at
   score 100.

8. ⚠ **`outputSchema` is still discarded by the MCP sanitizer** — the competitor study's *"single
   cheapest actionable finding"*. `annotations` was recovered in 209; its sibling was left
   deliberately, as it was outside that phase's ruling.

9. ⚠ **Two ingestion bugs closed on LOCAL-only evidence** await cloud verification.

## Deferred Items

The 46-row table from the v3.6 close (25 legacy quick-task stubs, 11 dormant seeds, 1 todo, 4 UAT
gaps, 5 verification gaps) is preserved verbatim in
`.planning/milestones/v3.8-STATE-at-close.md` → *Deferred Items*. Nothing was resolved by the reset.

⚠ **The seeds register is swept by NOTHING executable** — `grep -rln "SEED" .claude/commands/gsd/`
returns `capture.md` only, the command that WRITES seeds. **214 seeds** exist, ~140 still `planted`.
CLAUDE.md carries a MANDATORY sweep rule; it is honoured by the orchestrator, not by code.

## Guardrail overrides

**Phase 211 — G-2 / UI-SPEC gate, OVERRIDDEN 2026-08-26 at `/gsd:plan-phase 211`.** The gate fired
correctly: `ROADMAP.md` marks Phase 211 `**UI hint**: yes` and no `211-UI-SPEC.md` exists. Resolved
`--skip-ui` **on the operator's explicit call**, on the basis of the phase's own locked
**D-211-08**: *211 owes NO Stitch pass and NO sketch — it removes an organising axis, it does not
design a surface; **Phase 212 owes both***. The UI work in 211 is confined to de-organising the verb
(filters, pickers, form categories) and swapping the data source; **it changes no layout**.
⚠ **The re-open trigger is Phase 212** — if 212 plans the catalog without a Stitch pass and a sketch,
this override has been silently inherited rather than honoured. ⚠ And when 212 does run them, the
design bar is the **shipped** `Aether Intelligence` tokens in `frontend/src/index.css`, **not** the
Stitch project's design-md — the two disagree, and the shipped side carries the measured WCAG AA work
(211-CONTEXT.md *Risks* §4).

**Phase 211 — pattern-mapper agent SKIPPED 2026-08-26** (`workflow.pattern_mapper` is `true`, so this
is a deviation, not a config). `211-RESEARCH.md` §I *"Don't hand-roll"* already delivers a file:line
analog per problem, plus an Architectural Responsibility Map (§ pre-A) and §K.4's test-file list.
Spawning it would have re-derived what was already on disk. **No `211-PATTERNS.md` exists** — a plan
or executor looking for one should read `211-RESEARCH.md` §I instead.

**Carried forward from v3.8:** Phases **207 and 208 ran with no GSD ceremony and no independent
verification** — recorded as an override at the time, not discovered afterwards. The full v3.6/v3.7
override log (including Phase 194.1's *offered-and-declined* G-5 entry and its measured correction
from FIVE files to SEVEN) is preserved in `.planning/milestones/v3.8-STATE-at-close.md`.

## Accumulated Context

Cleared at the v3.8 close. The decision log lives in `.planning/PROJECT.md` (`## Key Decisions`);
the pre-reset snapshot is `.planning/milestones/v3.8-STATE-at-close.md`. Open blockers carried
forward are the nine items under *Open at close of v3.8* above.

### Chat run-lifecycle findings — still open, still unrouted

Filed 2026-08-18 out of Phase 197 and **never folded into any phase**. Carried because they are one
control in one moment and must be triaged together:

| id | finding | status |
|---|---|---|
| `BUG-260818-01` | **Resume replays the original prompt** instead of continuing. ⚠ The thread CONTEXT is not lost — the label and the mechanism disagree. | open · major |
| `BUG-260818-02` | **Resume drops the thread's selected model** — `sendMessage` forwards `opts.model`/`opts.provider`; `resumeFromFailed` passes neither. | open · major |
| `BUG-260818-03` | At the 15-iteration cap the chat shows a stop. ⚠ **The Continue feature ALREADY EXISTS and did not render** — a live-SSE gate with no fetch reconcile, which is D-v2.5-03 exactly. | open · major |

⚠ **TRIAGE 01/02/03 TOGETHER** — a user today cannot tell Resume from Continue, and fixing one
leaves the moment still lying.

## v3.9 roadmap shape — APPENDED 2026-08-26 by the roadmapper

Written to `.planning/ROADMAP.md` (§ *v3.9 Connections: Any Service, Any Tool*). **Nothing above
this line was rewritten.** Seven phases, **32/32 requirements mapped to exactly one phase each**.

⚠ **The scoping brief said 31 requirements; `REQUIREMENTS.md` contains 32**
(`grep -c "^- \[ \] \*\*" .planning/REQUIREMENTS.md` → `32`). Coverage was validated against the
file, not the brief.

| Phase | Name | Reqs | Why it sits here |
|---|---|---|---|
| **210** | Ground Truth — Operability & Failure Honesty | CONN-09/10/11, RAG-09 (4) | Independent of the schema change, so the two ⛔ blocking-class defects are not gated behind it |
| **211** | The Connection Is a Service, Not a Verb | CONN-04/05/08 (3) | ⭐ **PREREQUISITE (`SEED-207`)** — two coexisting models make every downstream surface branch, and each new surface pays the branch again |
| **212** | The Catalog and Its Doors | CAT-01/02/03/05, CONN-06/07 (6) | The catalog cannot be built on `capability`; needs 211 |
| **213** | Per-Tool Grants and the Approval Moment | GRANT-01..05 (5) | ⭐ **HARD PREREQUISITE for 216** — never an outbound capability in `_TOOL_REGISTRY` before the approval model |
| **214** | A Step Names Its Service and Its Action | STEP-01..06 (6) | Proves the model + grants on the **governed** canvas (D-19 armed checkpoint, egress guard) before outbound reaches chat, which carries neither. Closes ⛔ `BUG-260826-01` |
| **215** | BYO OAuth | OAUTH-01/02/03 (3) | Blocked by **CONN-08** (mig 126's `CHECK` refuses the row); MCP-first precedes OAuth |
| **216** | Connections in Chat, and One File In by Hand | CHAT-05/06/07, CAT-04, ATTACH-01 (5) | The headline, and it lands last on purpose — everything before it is its prerequisite |

**Two placements that are decisions, not defaults, and should be argued with rather than assumed:**

- **CAT-04 (starter prompts) is in 216, not in the catalog phase.** A starter prompt is only honest
  once the agent can act on it; chips shipped before the chat surface are suggestions that fail.

- **RAG-09 rides in 210 rather than owning a phase.** It is deliberately not connector work — it is
  folded because an embedding failure reported as *"your documents returned nothing"* poisons the
  trustworthiness of every deliverable this milestone produces.

**Guardrails recorded in the roadmap:** G-2 sketch owed on 212 / 213 / 214 / 215 / 216 (⚠ **215's bar
is NOT `screenshots/`** — those show a vendor-owned 2-click Connect that D-v3.9-01 declines) · G-5
fires in every phase's blast radius, with `ChatLayout.tsx` (21 phases) and `api/admin.py` (12 phases)
⚠ **absent from the ledger entirely** · G-1 risk at 213 (second consecutive phase on
`ConnectionFormPanel.tsx`) · threat models required on 212/213/214/215/216, with **prompt injection**
named as the class this tree has never faced · SC#10 full roster on 216, and on an **embedding**
roster for 210.

**Next action:** `/gsd:sketch` is NOT owed for Phase 210 (no "feels like" surface beyond a Control
Room tile). Start with **`/gsd:discuss-phase 210`** — and it opens with the G-5 re-derive on
`backend/app/api/admin.py`, which has never had a ledger row.
