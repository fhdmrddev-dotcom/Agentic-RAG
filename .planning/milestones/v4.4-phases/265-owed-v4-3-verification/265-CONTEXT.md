# Phase 265: Owed v4.3 Verification - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Verification only. Every piece of v4.3 that closed on self-verification or with owed UAT is **driven live
or independently reviewed**, and every finding carries a written verdict (fix / defer / accept).
No new capability is built. Code changes happen only when a review finding forces a fix, and only
within the G-7 / G-3 limits below.

Requirements: VERIFY-01..05 (`.planning/REQUIREMENTS.md`), plus the two folded items in D-08 / D-09.

</domain>

<decisions>
## Implementation Decisions

### Independent review (VERIFY-05)
- **D-01:** Reviews are done by **fresh Claude subagents with no build context** — one per review
  target (255, 256, 262, 264, and the audit fix commits `c28853142`..`cdf3a308a`). **Operator
  decision 2026-09-23**, chosen over waiting on Gemini (22 unanswered `to:gemini` bus items).
- **D-02:** ⚠ This is **partial independence** and must be recorded as such, never as a §6.3
  independent review. Claude (this session family) built 256, 262, 264, plans 02-03 of 255, and every
  audit fix commit. Each review file's frontmatter reads
  `independent_review: partial — fresh-context claude subagent (operator decision D-265-01)`, and the
  owed flag in each v4.3 `VERIFICATION.md` is updated to say the same — it is **not** flipped to `done`.
  Record the override in `STATE.md → Guardrail overrides` (the independent-review rule in CLAUDE.md /
  AGENTS.md).
- **D-03:** Reviewer subagents get the phase's plans, the diff and the verification file — **never**
  the builder's conversation, SUMMARY rationale-as-instruction, or this CONTEXT's opinions on the
  code. The reviewer **drives each finding** (a failing test, a query, a live call) before reporting it
  OPEN; an undriven finding is reported `PLAUSIBLE`, not `CONFIRMED`.
- **D-04 (fix handling — Claude's default, not separately asked):** the **builder fixes its own work,
  not the reviewer** (the 257.1 lesson). Fixes ≤ 1 file / ≤ 10 lines with no schema or API surface
  run as `/gsd:fast` inside 265, and the reviewer re-drives the finding afterwards. Anything larger,
  or anything that turns out to be a missing capability, becomes a seed or a later phase — never a
  fix round inside 265 (G-7). Every finding ends with a written verdict; none are left silent.

### Live UAT driving (VERIFY-01..04)
- **D-05:** **Claude drives every browser row over Chrome MCP** and records, per row, a screenshot
  **plus the backing evidence** it claims to show (DB rows, `workflow_runs`/usage rows, backend log
  lines). A screenshot alone never ticks a row.
- **D-06:** The **operator spot-checks** rows where human judgement is the test — the 261 G-4
  authoring "feel" row and the 263 approval round trip. Claude presents those rows for confirmation
  and does not self-pass them.
- **D-07 (VERIFY-02 org):** Create a **dedicated standard-tier test org + member user** in the local
  DB, and keep them for re-runs. Do not flip the operator's real dev org. Before driving any refusal,
  prove the standard-tier org is the **active** org (org switcher + the `X-Org-Id` the request
  actually sent). The dev account is in two orgs, and a refusal driven in the enterprise org passes
  vacuously. All three refusals — run a published workflow from chat, create a workflow draft, "Run
  now" on a schedule — must name the plan.

### Folded extras
- **D-08:** Fold **256's two remaining owed rows** into 265: the paused-harness-run row (confirm it
  still holds, since row 1 superseded it) and the publish-gauntlet QUAL-01 judge row, which compares
  the provider's reported usage for that shot with the delta persisted to the golden run. Drive the
  judge row against a **real provider**, with no `forced_emit` patch.
- **D-09:** Fold **BUG-260923-02** (pagination: Spend ledger, Library Health, Ingestion History).
  It was deployed at `805360fef` and the operator's browser check passed 3/3. Re-check the Spend
  ledger pagination during the VERIFY-01 drive, then flip the report to `closed` citing that drive.

### Claude's Discretion
- Order of the rows, grouping into 3-5 plans (G-8), and which provider drives each LLM-dependent row.
- Whether the review subagents run in parallel. Reviews are read-only, so parallel is expected.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md`: matched on keywords only ("authoring", "first", score 0.6). It is
  a workflow-authoring spike and has nothing to do with verification. Left in `todos/pending/`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope
- `.planning/ROADMAP.md` §"Phase 265: Owed v4.3 Verification" — goal, success criteria, failure conditions, flags
- `.planning/REQUIREMENTS.md` — VERIFY-01..05 and the measured-scoping table
- `.planning/milestones/v4.3-MILESTONE-AUDIT.md` — what was accepted at close and why

### Owed rows (source of each UAT row, the `human_verification:` frontmatter)
- `.planning/milestones/v4.3-phases/256-every-token-is-counted-and-kept/256-VERIFICATION.md` — rows 2-3 (D-08)
- `.planning/milestones/v4.3-phases/257-cost-in-dollars-and-what-it-cannot-see/257-VERIFICATION.md` — 3 rows (VERIFY-01)
- `.planning/milestones/v4.3-phases/258-a-tier-becomes-enforceable/258-VERIFICATION.md` — refusal row (VERIFY-02)
- `.planning/milestones/v4.3-phases/261-an-expert-you-can-author/261-VERIFICATION.md` — 3 rows (VERIFY-03)
- `.planning/milestones/v4.3-phases/263-an-expert-can-be-given-its-capabilities/263-VERIFICATION.md` + `263-UAT.md` + `263-04-SUMMARY.md` (R-1..R-9) (VERIFY-04)

### Review targets (VERIFY-05)
- `.planning/milestones/v4.3-phases/255-the-extension-contract/` · `256-…/` · `262-an-expert-you-can-discover/` · `264-born-for-skills-must-load-not-just-resolve/` — plans + VERIFICATION
- Commits `c28853142`..`cdf3a308a` — the audit fixes; hot-file overrides OV-v43-G5-01..05 are listed in `.planning/STATE.md`
- `docs/EXTENSION-CONTRACT.md` — the law 255 must be reviewed against

### Bugs
- `.planning/reported-bugs/expert-description-cap-1000-blocks-save-and-skill-body-draft.md` (BUG-260921-02) — fixed at `7a04e944e`; closed by VERIFY-04
- `.planning/reported-bugs/BUG-260923-02-long-lists-need-pagination.md` — closed by D-09

### Rules
- `CLAUDE.md` §"More than one agent works this repo", §"UAT scoreboard recipe", §"Workflow guardrails" (G-3, G-4, G-7, G-8)
- `AGENTS.md` — the independent-review protocol that D-02 records a departure from

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/agent-bus.sh`: operator decisions go `--to operator` if a finding needs a ruling.
- Chrome MCP (`mcp__claude-in-chrome__*`): drives browser rows. See memory: `:hover` hit-testing and the dropdown wedge.
- Supabase MCP: reads production for free. **Every write needs per-action approval.** 265 needs **no production writes**; all driving happens on the local stack.
- `node scripts/check-backend-unit-baseline.cjs` and `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`: run these gates after any `/gsd:fast` fix.

### Established Patterns
- Evidence per UAT row: each row carries its own evidence, and a shared screenshot does not cover two rows.
- To tell a new red from an inherited one, check out the base commit and re-run. Never compare against a figure written in CLAUDE.md.
- The v4.3 `VERIFICATION.md` files are **archived**. Update their owed flags in place under `milestones/v4.3-phases/` and don't move them back.

### Integration Points
- Local stack: backend `:8000` (the user starts it), vite on `localhost` (it binds IPv6 only), local Supabase `:54322`.
- Tier source: `organizations.subscription_tier` + `tier_capabilities` (migs 186/192); `entitlement_service.py` is the single boundary.

</code_context>

<specifics>
## Specific Ideas

- The operator wants v4.4 to build on measured ground. A VERIFY row counts as passed only when the thing is observed working live. A mocked test does not count.
- 262's catalog passed its lived UAT 29/29 at close. Its review is code review only. Don't re-drive its UAT unless a finding calls for it.

</specifics>

<deferred>
## Deferred Ideas

- **A true §6.3 independent review by Gemini** for 255/256/262/264 stays available. If Gemini clears its bus backlog, a later review can upgrade D-02's `partial` to `done`. It isn't blocking.
- **Findings that are capabilities** go to a seed or a later v4.4 phase (D-04).

</deferred>

---

*Phase: 265-owed-v4-3-verification*
*Context gathered: 2026-09-23*
