# Phase 296: Close v4.7 Debt - Context

**Gathered:** 2026-10-26 (`--auto`; scope set by the operator in chat: "all defects, one phase", "deploy after the fixes")
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix every open DEFECT that v4.7 (phases 286-295) found and deferred, so the milestone closes with no
bug carried silently. The full, checked list is **`296-INVENTORY.md`**, which is the scope. Every row
ends **fixed / accepted (reason) / seeded to v4.8 / operator / close-only**.

**Not in this phase:** any new capability. Feature-shaped rows are planted or updated as v4.8 seeds,
not built. The production deploy of 292.1 + 293 + 296 follows the phase as a separate operator-gated step.

</domain>

<decisions>
## Implementation Decisions

### Scope and dispositions
- **D-01:** The scope is `296-INVENTORY.md`, not the shorter audit summary. Every FIX and TEST row is delivered; every SEED row is planted or updated in `.planning/seeds/` (status + trigger) in this phase; every ACCEPT row keeps its written reason; every CLOSE row is flipped with the fixing commit. A row cannot leave the phase undisposed (ROADMAP SC#1).
- **D-02:** A FIX row whose defect does not reproduce on a RED drive is closed as **"did not reproduce"**, with the RED attempt as evidence. This applies especially to DEBT-3, 293-F-4, BUG-261025-02 and BUG-261025-03. It is never fixed blind.
- **D-03:** No gap round may add capability (G-7). A fix that turns out to need a new capability stops and becomes a seed.

### Rulings auto-picked in --auto (the operator may reverse any of them)
- **D-04 (BUG-261021-05) — AMENDED 2026-10-26 after research (original auto-pick was "the engine enforces the check").** Research measured that enforcement is impossible as written: a step reads `escalated` only when it has NO knowledge-base tool (`grounding.py:1203-1209`), `retrieved_and_cited` fails at once on empty `citations` (`validator_kinds.py:413-418`), and an escalated step is locked so "continue without sources" is gone (`engine_ask.py:787`) — every escalated step would fail every run and every publish trial. **Ruling now: option (b)** — the builder seal and gate row stop claiming a check for `escalated` (W3, frontend: `gatesFor`, `NodeCornerMarks.tsx`, `GovernanceSection.tsx`). Giving an escalated step a real search tool is a new capability → **SEED** (v4.8). Local DB has 0 escalated steps, so no saved workflow changes.
- **D-05 (BUG-261020-02):** For a **non-owner** viewer of the evidence page, once an upstream step's output is withheld, every later step's output is withheld too, with the same worded reason. Owners are unchanged. Reason: the only reliable bound; per-step citation tracing cannot see substance restated without a citation.
- **D-06 (SEED-364):** **New** orgs get a neutral default name (no email). Existing org names are not renamed: no migration touches user data, and the owner can rename.
- **D-07 (295-IN-08):** The judge's "not sending is by design" note applies only when the step's send grant was present and recording was the designed path. A missing grant reads as a missing grant.
- **D-08 (291-S6-F7) — AMENDED after research** (`InputFieldSpec` has no example/default field): the golden run uses **typed stand-in values** (a date for a date field, a number for a number, an enum's first option, a short realistic string for text) instead of "golden run placeholder for <key>", and the gauntlet says in words that the values were stand-ins. Deriving inputs from the author's test instruction → **SEED** (v4.8).
- **D-09 (290-WR-02):** Include it, reversing the 2026-10-24 "accept until refactor". Lift `view` into the builder and gate undo/redo and the side panel while the Team view shows. One prop and one condition (G-5 one-touch); the full WorkflowCanvas refactor stays out.
- **D-10 (BUG-261024-04):** Split it. The **defect** (a follow-up turn re-shows every prior-turn file) is fixed in 296: a turn shows only files produced in that turn. The **policy** (intermediate PNGs beside the final document) becomes a seed.
- **D-11 (291 network_mode):** Seed it, as a security capability decision for v4.8, with the trigger "before any non-author or API caller can reach a workflow with `execute_code`". Not changed in 296, because changing sandbox egress breaks workflows that fetch at run time.
- **D-12 (287 SC#4 "one click"):** Accept the shipped menu + name dialog as "one action". Record it in the 287 verification note.
- **D-13 (SEED-365):** The per-user citation-check rate limit is in 296, reusing the 293 Redis limiter shape. The concurrency cap and spend ledger stay in the seed.

### How the work is cut (G-8)
- **D-14:** Plans follow the inventory's workstreams, in **4-5 plans**:
  - W1, tenancy/governance (backend, DB-touching tests)
  - W2, run lifecycle / inbound / providers / tracing (backend)
  - W3, describe-it authoring + builder (291/290/288, mixed)
  - W4, run surfaces / chat / settings (frontend)
  - W5, tests, gates, record flips, seeds, the live G-4 drive and ledger rows. W5 is last and serial.

  W2 or W3 may split if one context budget cannot hold it. Justify any split above 6 in the plan. Executors run TARGETED suites per task and FULL gates once per wave.
- **D-15:** **DB-mutating plans run serially** (CLAUDE.md worktree rule 4). W1 and W5 mutate the local DB. W2 does too where it drives runs.
- **D-16:** **G-5 one-touch:** many targets FIRE on the ledger (`harness_engine.py`, `api/runs.py`, `api/threads.py`, `StreamsProvider.tsx`, `WorkflowRunPage.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowCanvas.tsx`, `useTemplateFirstDraft.ts`, `PhaseFormPanel.tsx`, `publish_service.py`, `agent_loop.py`). Each fix is the smallest shape (one helper, prop, field, guard or branch), recorded in that file's `docs/HOT-FILE-LEDGER.md` section in the same commit. A fix that cannot be one-touch is recorded as a guardrail override in STATE.md, never hidden.
- **D-17:** **Migrations:** 293-IN-05 edits `215_*.sql` in place. It has run locally only, its backfill already ran here, and cloud has 0 `_schedule_id` rows. Any new schema need takes `216`, applied by the SQL editor, then `scripts/regenerate-full-schema.sh` (no reset).
- **D-18:** **Security review:** `/gsd:secure-phase 296` runs before close (W1 touches tenancy and the evidence privacy boundary).

### Verification
- **D-19:** Every FIX row has a test driven RED before the fix, except copy-only and CSS-only rows. Those are checked in the G-4 drive.
- **D-20:** The G-4 lived scenarios, written now (G-4 / G-6):
  1. A two-org user creates a folder and a workflow with the second org active, and both land in it.
  2. A colleague opens a run whose step 1 is withheld, and step 2 is withheld too, with words.
  3. A followed run shows its final answer and its Unsourced mark without a reopen.
  4. A waiting run shows one live ask card, not several expired ones.
  5. Schedule "Run now" says what happened.
  6. The Team view cannot be edited by undo/redo or the side panel.
  7. The evidence report title reads normally at 1536px with four buttons.
  8. Follow-up chat turns show only that turn's files.
- **D-21:** **Cross-provider (SC#10 rule):** W2's provider-touching fixes need the full native roster plus OpenRouter. These are BUG-261024-01, 292.1-IN-01/02, the 291-S6-F8 first-step turn and 293-F-4. Rows blocked by billing or account state are recorded ⛔ with the reason (OpenRouter 402; Moonshot suspended), never dropped.
- **D-22:** Gates at close: backend unit failures ≤ 71 (only `test_075_4` is inside `tests/unit`, so expect ≤ 70; 288-T-2 and 289-T-1 live outside the gated set and are fixed on their own), vitest count gate OK with `GSD_VITEST_MAX_WORKERS=2`, `tsc -p tsconfig.app.json` set-diff no new errors, ledger / seeds / CLAUDE.md-size gates clear.

### Claude's Discretion
- Exact wording of every new user-visible sentence, following each surface's vocabulary file.
- Whether a given S row is folded into the plan whose files it shares.
- Ordering inside a plan.

### Research corrections (2026-10-26, `296-RESEARCH.md`)
- **D-23:** DEBT-3 most likely does not reproduce (nothing writes `workflow_runs.status='cap_paused'`; `run_is_cap_paused` reads `runs`, the wrong table for this guard). RED-drive it; close as "did not reproduce" under D-02 if it stays green.
- **D-24:** BUG-261025-03's measured cause is the boot resume sweep re-driving a waiting human-input step (each start inserts a new prompt row). The fix copies 295's engine-ask arm 2a, in W2 (backend). The panel half stays in W4.
- **D-25:** SEED-364 needs migration **216** (default org name) plus the matching `scripts/full-schema-supplement.sql:205` edit in the same commit, applied by SQL editor, then `regenerate-full-schema.sh`.
- **D-26:** Six touched files have no ledger row (`api/schedules.py`, `tools/render_template.py`, `sub_agent_models.py`, `definitionOps.ts`, `GovernanceSection.tsx`, `NodeCornerMarks.tsx`). The plan that first touches each adds its row + section in the same commit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope
- `.planning/phases/296-close-v4-7-debt/296-INVENTORY.md` — the item list, locations and dispositions (the scope).
- `.planning/v4.7-MILESTONE-AUDIT.md` — audit result, DEBT-1/DEBT-3, deploy order.

### Sources the inventory cites
- `.planning/phases/287-start-from-a-thread-fork-a-starter/287-REVIEW.md`, `287-VERIFICATION.md`
- `.planning/phases/288-drafts-that-survive-pauses-that-publish/288-REVIEW.md`, `288-04-SUMMARY.md`
- `.planning/phases/289-the-run-page-and-its-evidence/289-REVIEW.md`, `289-REVIEW-FIX.md`, `289-04-SUMMARY.md`
- `.planning/phases/290-the-card-and-the-team-picture/290-REVIEW.md`
- `.planning/phases/291-describe-it-from-your-own-files/deferred-items.md`, `291-HUMAN-UAT.md`, `291-S5-ROSTER.md`
- `.planning/phases/292-more-ways-to-show-it/292-REVIEW.md`
- `.planning/phases/292.1-tool-limit-continue-that-always-fires-bug-261024-03/292.1-REVIEW.md`, `292.1-REVIEW-FIX.md`
- `.planning/phases/293-start-from-outside-and-close-out/deferred-items.md`, `293-SECURITY.md`, `293-VALIDATION.md`
- `.planning/phases/294-decision-engine-rerank-and-citation-check/294-REVIEW.md`, `294-VERIFICATION.md`
- `.planning/phases/295-runs-that-don-t-dead-end/295-REVIEW.md`, `295-HUMAN-UAT.md`, `295-04-SUMMARY.md`
- `.planning/reported-bugs/` — BUG-261021-02/-03/-04/-05, BUG-261024-01/-02/-04, BUG-261025-01/-02/-03, `evidence-page-later-step-carries-withheld-document-substance.md`, plus the folded 295 set for close-only flips
- `.planning/seeds/SEED-360..374`

### Project rules that bind this phase
- `CLAUDE.md` — G-5 (hot-file ledger), G-7, G-8, worktree rules 1-4, Supabase MCP write gate, migration discipline, the SC#10 cross-provider roster rule
- `docs/HOT-FILE-LEDGER.md` — the section of every FIRING file a plan touches
- `docs/EXTENSION-CONTRACT.md` — closed core: 7 phase types / 1 emitter / 30 tools; no fix may add one
- `.planning/seeds/TEMPLATE.md` — the seed frontmatter contract for every seed planted here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dependencies.resolve_active_org_or_none` (`backend/app/dependencies.py:1020`): the org-resolution pattern `create_thread` (`api/threads.py:794`) and `api/sources.py:196` already use; W1 reuses it.
- The 293 Redis limiter (`security/api_key_auth.py` / `inbound.py` `_limit`): shape for the citation-check rate limit.
- `soulData.missingRequiredFields`: the client predicate the server-side required-input check mirrors (287-T01) and the Schedule form reuses (287-SCHED).
- `app.db.runs.run_is_cap_paused`: the ONE cap-pause predicate (292.1). DEBT-3 must use it, never `status == 'cap_paused'`.
- The shared sanitised markdown renderer used by chat (`CitedMarkdown` family) for 289-F-B.
- `rerank_engines/tracing.redact_inputs` + `tests/unit/test_trace_key_redaction.py`: the trace-redaction guard (BUG-261020-03 is already closed by it).

### Established Patterns
- One refusal = one worded sentence from a vocabulary file; raw codes never render (293 UAT lesson; `apiKeyFacts.test.ts` reads backend reasons).
- Bug reports are closed by editing frontmatter (`status: closed`, the fixing commit); seeds by editing `status` + `status_note`.
- ⚠ `-p no_run_sweeps` does NOT exist in the repo (research, 2026-10-26); SEED-363's guard is the fix, and it is what BUG-261025-03's repeat prompts come from.

### Integration Points
- Run lifecycle: `api/runs.py` (re-drive), `run_lifecycle.py`, `run_reconciler.py`, `run_handoff.py`, `harness_engine.py`.
- Evidence: `services/run_evidence.py` → `RunEvidenceReport.tsx`.
- Describe door: `describe_files.py`, `describe_draft_guards.py`, `useTemplateFirstDraft.ts`, `publish_service.py`.

</code_context>

<specifics>
## Specific Ideas

- The operator chose this scope after the v4.7 audit: "close all the items", then "All defects, one phase" and "Deploy after the fixes".
- `[auto]` Seeds sweep: `check-seeds-register.cjs --phase 296` matched 0. The phase has no plans yet, so it declares no surfaces. **Re-run it at plan-phase once `files_modified` exist.** SEED-360..374 were routed by hand in the inventory.
- `[auto]` Todos: `todo.match-phase 296` found 0.

</specifics>

<deferred>
## Deferred Ideas

All feature-shaped rows are in `296-INVENTORY.md` § SEED and are planted or updated in this phase:
- DEBT-1 / 293-F-2 (SEED-367)
- SEED-365 (spend ledger)
- kb_auto engine lookup
- sandbox network_mode
- `api/workflows.py` split
- starter-card wording
- deliverable size/path
- inbound `task` field
- F2 lock agreement
- schedule backoff
- intermediates policy

SEED-366 and 368-374 stay planted for v4.8.

</deferred>

---

*Phase: 296-close-v4-7-debt*
*Context gathered: 2026-10-26*
