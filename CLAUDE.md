# CLAUDE.md

Agentic RAG platform — AI agent that knows your knowledge base, runs code in a
sandbox, and can be taught new skills that persist. Chat is the default
interface; document ingestion is a manual file-upload flow.

## Stack
- Frontend: React + Vite + Tailwind + shadcn/ui (Aether Intelligence design system, Deep Midnight theme)
- Backend: Python + FastAPI
- Database: Supabase (Postgres, pgvector, Auth, Storage, Realtime)
- LLM providers: OpenAI, OpenRouter, Anthropic (native SDK), Google — routed via MODEL_CAPABILITIES registry
- Code execution: Docker (`llm-sandbox`), gated by `SANDBOX_ENABLED`
- Observability: LangSmith

## Rules
- Python backend must use a `venv` virtual environment
- No LangChain, no LangGraph — raw SDK calls only
- Use Pydantic for structured LLM outputs
- All tables need Row-Level Security — users only see their own data (global folders/skills are the only shared scope)
- Stream chat responses via SSE
- Stateless chat completions — store and send chat history yourself, no provider-side thread state
- Ingestion is manual file upload only — no connectors or automated pipelines
- Schema changes ship as numbered SQL migrations under `supabase/migrations/` at the repo root (the legacy `backend/supabase/migrations.archive/` is dead — see its README). Filenames must match `<digits>_name.sql` (e.g., `035_my_change.sql`); letter suffixes like `007b` are silently skipped by the Supabase CLI. **Apply each new migration to the live local DB by pasting it into the Supabase SQL editor — never `supabase db push`/`db reset`** (preserves dev data). Then regenerate the bootstrap artifact: `bash scripts/regenerate-full-schema.sh` — by default this dumps the live DB schema with no reset, rebuilding `supabase/full-schema.sql` (single-file deploy artifact for greenfield envs). Pass `--reset` only when you explicitly want to verify the migration sequence from a clean slate (CI / release verification — destructive: wipes local DB). Never hand-edit `full-schema.sql`. Full setup story: `supabase/SETUP.md`.
- Supabase Realtime is a best-effort hint, **not** a source of truth — always reconcile via fetch on (re)connect (see decision D-v2.5-03)
- Do not run blocking I/O (e.g. `supabase-py` calls) directly inside async handlers — wrap with `run_in_threadpool` (decision D-v2.5-01)
- Multi-worker uvicorn is the default (`WORKER_COUNT=2`); see D-PRD-12 in `.planning/prd-reset/DECISIONS.md` for the singleton audit checklist and scaling guidance
- Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only
- **Provider-docs-first (evidence-based):** whenever work touches a specific provider (prompting, orchestration, context management, skill use, tool calls/tool use, streaming, structured output), research that provider's OWN official documentation first, then cross-check against our app's actual behavior with comparative analysis and real evidence (Supabase/DB, backend logs, LangSmith, live cross-provider UAT). Conventions do NOT transfer 1:1 between providers; keep provider-specific handling at the service boundary, never break the shared path. See `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md`.

## Local dev infrastructure

- **Supabase**: managed by Supabase CLI. `supabase start` boots Postgres + Auth + Storage + Realtime on Docker; configured to auto-start on Docker Desktop boot.
- **Redis** (v2.5+): runs via `docker-compose.dev.yml` at repo root. Start once with `docker compose -f docker-compose.dev.yml up -d`; auto-restarts on Docker Desktop boot. Optional Redis Insight web UI on port 5540: `docker compose -f docker-compose.dev.yml --profile insight up -d`. No migrations — Redis has no schema; streams/keys are created on first write.
- **Sandbox image** (v2.6+ / Phase 075.1): the agent's `execute_code` tool runs in a Docker container managed by `llm_sandbox`. By default it uses `llm_sandbox`'s bare-Python image, which forces the agent to `pip install matplotlib`/`pandas`/etc. on every new chat (~10-15s warm-up). The project ships a pre-built image at `backend/Dockerfile.sandbox` with the Claude.ai-analysis-tool package set (matplotlib + numpy + pandas + python-pptx + openpyxl + python-docx + pypdf + **reportlab** + seaborn + scipy + scikit-learn + plotly + **docxtpl**; reportlab added 2026-05-31 — pypdf only READS pdfs, reportlab WRITES them; docxtpl added in Phase 101 — the trusted-path template-fill Jinja render engine) — build once with `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/`, then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env`. **The `-t` tag and `SANDBOX_IMAGE` MUST be identical** — the tag after the colon is just a label (free text, not a version requirement); its only rules are (1) build-tag == `SANDBOX_IMAGE`, and (2) pick a NEW label whenever `Dockerfile.sandbox`'s package set changes, then rebuild + update `SANDBOX_IMAGE`, so old cached containers don't shadow the new image. (Tag history: `075.1` at Phase 075.1 → `075.1.1` when reportlab landed 2026-05-31 → `101.1` when docxtpl landed in Phase 101 — the current tag.) When `SANDBOX_IMAGE` is unset, `SandboxSessionManager.get_or_create` (`backend/app/services/sandbox_service.py:25`) falls back to the bare image. Sandbox sessions are cached per `thread_id` until idle eviction (default 30 min), so env-var changes only affect NEW chats — existing chats keep their original container until eviction. Full var reference: `backend/.env.example`. **Canonical package list + add-a-package / size-perf rules: `docs/SANDBOX-PACKAGES.md`** (keep it in sync with `Dockerfile.sandbox` in the same commit; skills/skill-creator must author against the installed set — mig 093).
- **Local-vs-cloud switch**: env vars only. `SUPABASE_URL` + `REDIS_URL` in `backend/.env` point at local containers by default; switch to cloud (Supabase project URL, Upstash `rediss://...`) without code changes. See `backend/.env.example` for the full var list.
- **Run-buffer key conventions** (Phase 061+): `run:{run_id}` (Redis Stream — per-run event buffer), `runs_by_thread:{thread_id}` (sorted set — active runs per thread), `runs:active` (sorted set — all currently-streaming run_ids for global cleanup). Defined in code, not in any migration script.
- **Setup guides**: `supabase/SETUP.md` for Supabase (local + cloud + migrations), `REDIS-SETUP.md` for Redis (local + cloud + key conventions). Read these when connecting a new environment or onboarding a contributor.

## Deployment (cloud) — operator-gated

Live deploys are **always operator-triggered**. The branch + promotion model and the local↔cloud parity rules live in `docs/DEPLOYMENT-WORKFLOW.md`; recurring failure modes + their fixes live in `docs/DEPLOYMENT-LESSONS.md` (read both before any cloud-touching work). Architecture/accounts: `docs/DEPLOYMENT-PIPELINE.md`.

- **Branches:** `develop` (dev trunk — commit freely here) → `master` (staging / release-candidate) → `production` (LIVE — Vercel frontend + Coolify backend both auto-build from it).
- **NEVER push to `master` or `production` without an explicit operator "deploy" instruction.** When work is ready, *propose* the deploy and wait for a clear yes. Committing to `develop` during normal work is fine; promoting to a deploy branch is not, until asked.
- **Promote surgically** (see workflow doc): fast-forward `git push origin <sha>:production` when the fix's parent == production tip, else a throwaway-worktree cherry-pick — never drag unfinished `develop` work into live, never develop directly on `master`/`production`.
- **Code deploying ≠ cloud configured.** Every cloud-touching change has a non-code half — env vars (Coolify/Vercel), migrations (paste into cloud Supabase SQL editor), seed/settings rows (`app_settings`), provider keys/models. Apply the parity checklist in the workflow doc; cloud config drifts from local and is the #1 gotcha.
- **The local setup must never break** — local vs cloud is a pure env-var switch; no hardcoded URLs/paths/keys/models/ports.
- **Deployment-artifact parity (same-commit rule).** Any change to an env var the app reads, a seed-bearing migration, a bundled service, or the sandbox image tag MUST update the Phase-157 artifacts (`deploy/onebox.env.example`, `docs/OPERATOR.md` Step-3 seed list, `docker-compose.prod.yml`, and the `SANDBOX_IMAGE` tag) **in the same commit**. `scripts/check-deploy-drift.sh` enforces this in CI (the `deploy-artifacts` workflow); a new intentionally-omitted var is registered in the script's `OMITTED_FROM_ONEBOX` list, never left to drift silently. (Phase 158 / D-16 — the deploy-artifact analog of the `Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md` same-commit sync rule above.)

## Planning workflow
Planning is managed by **GSD** under `.planning/`, not ad-hoc plan files.

- `.planning/PROJECT.md` — current milestone, validated requirements, key decisions, constraints
- `.planning/MILESTONES.md` — shipped milestone history
- `.planning/ROADMAP.md` — phases for the active milestone
- `.planning/STATE.md` — current phase, position, next action
- `.planning/<NNN>-<phase-name>/` — one folder per phase with PLAN.md, RESEARCH.md, VERIFICATION.md, etc.

For new work use the GSD slash commands (`/gsd:discuss-phase`, `/gsd:plan-phase`,
`/gsd:execute-phase`, `/gsd:verify-work`) rather than writing free-form plan
files. Run `/gsd:progress` to see where things stand.

The legacy `.agent/plans/` folder and `PROGRESS.md` module tracker are historical
artifacts from the masterclass build (Modules 1–8, shipped as v1.0 base) — do not
add new content there.

## Reported bugs cross-check (MANDATORY)

User-observed bugs from manual testing live in `.planning/reported-bugs/`. Each report has structured frontmatter (`surface`, `severity`, `status`, `affected_areas`, `folded_into`, `re_open_trigger`). Use `.planning/reported-bugs/TEMPLATE.md` when creating new reports.

**Cross-check these reports at four GSD touchpoints:**

| Touchpoint | What to do |
|---|---|
| `/gsd:discuss-phase NNN` | After loading prior CONTEXT, list `.planning/reported-bugs/*.md` with `status: open` AND `surface: Agentic-RAG`. For each, check whether `affected_areas` overlaps the phase's domain. Surface relevant ones to the user as: fold into this phase / defer to a named future phase / leave open. Update each report's frontmatter (`status` + `folded_into` or `re_open_trigger`) to reflect the routing. Capture folded ones in CONTEXT.md `<decisions>`; deferred ones in `<deferred>`. |
| `/gsd:plan-phase NNN` | Verify every report with `folded_into: NNN` is actually addressed by at least one plan task. If a folded report isn't covered, either add a task or revert its status. |
| `/gsd:new-milestone` | Sweep all open `surface: Agentic-RAG` reports; surface unaddressed bugs as candidate REQ-IDs for the new milestone, or plant as SEED-NNN with concrete `re_open_trigger`. |
| `/gsd:complete-milestone` | Audit open reports whose `folded_into` matches a phase shipped in the closing milestone — flip status to `closed` only if the bug no longer reproduces. Reports still observable roll forward (status stays `open`, with a note in the milestone retrospective). |

**Filter rule:** ONLY `surface: Agentic-RAG` reports are routing candidates. External reports (`Claude.ai`, `Anthropic-API`, `OpenAI`, `OpenRouter`, `Other`) are observability/feedback notes — never auto-folded into app phases; mention them at touchpoints only if the user explicitly asks.

**Status lifecycle:** `open` → `folded` (when a phase claims it) → `closed` (when the shipped phase verifiably closes it). Reports can also be `deferred` (with `re_open_trigger`) or `external-noted` (won't ever fold).

## UAT scoreboard recipe (MANDATORY)

Phase 075.4 Plan 05 (D-075.4-H1 Wave 0) — closes the assumption-driven-UAT gap that cost insert-phases 067.5, 075.1, 075.2, 075.3, 075.4. ROADMAP SC#10 verbatim:

> Any phase touching streaming, agent loop, provider routing, or UI state MUST include UAT rows for cross-provider × multi-tool × parallel-thread × long-message scenarios.

**The 4-axis bandwidth:**

| Axis | Required coverage |
|------|-------------------|
| Cross-provider | **The FULL native roster + OpenRouter — 8 rows, not 4.** See the roster rule below. |
| Multi-tool | At least 1 row exercising 2+ tools in one prompt (e.g., `search_documents` + `execute_code`) |
| Parallel-thread | At least 1 row with Thread A streaming while Thread B accepts a new prompt |
| Long-message | At least 1 row with ≥ 50 prior messages OR a ≥ 5 KB user prompt |

**The cross-provider roster rule (amended 2026-07-31 — operator, during Phase 185 UAT).** This table
previously said *"OpenAI, Anthropic, Google, OpenRouter (4 providers)"*, and that under-specification
is why every scoreboard in this project has silently skipped half the product. The app ships **seven
native providers** plus OpenRouter; testing four and calling it "cross-provider" tests the four we
happen to think of first. The operator's standing direction is the **full native roster** — so the
required set is:

| | Provider | Note |
|---|---|---|
| 1 | OpenAI | |
| 2 | Anthropic | native SDK |
| 3 | Google | historically the highest-risk row for tool-call emission |
| 4 | DeepSeek | `strict_json_schema` is **inert** (DEMOTED — no `/beta` base_url, D-122-04) |
| 5 | Zhipu / GLM | |
| 6 | MiniMax | |
| 7 | Moonshot / Kimi | **the only `emit_tier: coerce` native rows** — the weakest emission guarantee in the registry |
| 8 | OpenRouter | every OpenRouter row is `native_tools: False` — it is the non-native tool path, not a fifth flavour of the native one |

**Derive the roster, never re-type it.** `MODEL_CAPABILITIES` is the source of truth — group by
`provider` and take one representative per group, rather than transcribing the list above (which will
rot the moment a provider is added). Prefer the **newest** model per provider, and prefer a
**registry-backed** id: an id absent from `MODEL_CAPABILITIES` resolves `capability_source=inferred`
and silently loses `emit_tier`, so the row would measure a weaker configuration than the one that
ships (see SEED-040 §2026-07-31, and SEED-135).

**Rows may be blocked, but never silently omitted.** A provider with no key configured, or one blocked
by a known defect, is recorded as ⛔ with the reason and the blocking issue id — never dropped from the
table. A scoreboard that lists only what passed is not a scoreboard.

**Cheapest honest method** (proven in Phase 185): drive each row as a real run with a **per-request**
`model` + `provider` on `POST /threads/{id}/messages`, and read verdicts from `workflow_runs` /
`workflow_phases` / `harness_audit`. That scores the whole board **without mutating any global
setting**, so the operator's environment is untouched and rows cannot contaminate each other.

UAT rows MUST be authored under VALIDATION.md, NOT in PLAN.md tasks. Phase verification only passes when all 4 axes are exercised — Plan 05 E2E backstop covers 1-3 automated; long-message stays manual per provider.

## Workflow guardrails (MANDATORY)

These rules exist because the v2.6 075.x cascade (8 phases on the same streaming/UI surface) showed that structural UAT misses lived-experience defects, and the full discuss→plan→execute ceremony is overkill for small work. At every phase-touching conversation, the orchestrator MUST apply these BEFORE proposing the next command.

| Rule | Trigger | Action |
|---|---|---|
| **G-1 Phase chain cap** | About to insert `<base>.N` where ≥ 2 prior `<base>.x` phases already exist on the same hot file(s) | Propose a refactor phase on those file(s) FIRST. Block another feature insert until refactor ships. |
| **G-2 Sketch before plan for UX** | Phase scope mentions live UI, panel render, badge, label, animation, "feels like", visual, or gold-standard comparison | Propose `/gsd:sketch` BEFORE `/gsd:spec-phase` or `/gsd:discuss-phase`. Operator-approved mockup is the acceptance bar. |
| **G-3 Lightweight commands for small work** | Task scope ≤ 1 file, ≤ 10 lines of source change, no schema/API surface | Propose `/gsd:fast` (inline, no agents) or `/gsd:quick` (commit + state, skip optional agents). NEVER full discuss→plan→execute for 5-line fixes. |
| **G-4 Lived-experience UAT gate** | Phase touches user-visible UI | Operator-defined "I'd recognize failure here" scenarios at scope-time (not post-hoc). Chrome MCP drives all 3 at phase verification — wire format + screenshot are insufficient. |
| **G-5 Refactor between feature waves** | ≥ 3 prior phases on the same hot file (see ledger below) | Insert a dedicated refactor phase BEFORE the next feature phase on that file. Audit during discuss-phase. |
| **G-6 Failure criteria upfront** | Writing SPEC.md or scoping a phase | Include `## How we'd know this failed` section with concrete observable conditions. If failure modes can't be enumerated, scope is not ready to plan. |
| **G-7 Gap-closure round cap** | Verification returns `gaps_found` on a phase that has already run **2** gap-closure rounds | Do NOT route to `/gsd:plan-phase --gaps`. Triage every remaining finding as **fast-fix / defer-to-next-phase / accept** — unless a ROADMAP **success criterion** is actually unmet, which is the only thing that justifies a further round. A closure round may NEVER introduce a new user-facing capability: that is a phase, not a gap. |

**G-7 in detail (ratified 2026-08-04 — operator, at Phase 187 close).**

Phase 187 went from **15 plans on 2026-08-02 to 29 on 2026-08-04** across five gap-closure rounds. The tell at round 5: **both** remaining gaps lived in code round 5 had authored that same day (`DescribeKbPicker.tsx` created `f5a28e7e`; the count-gate pin block edited `51c44f37`) — a round 6 would have been 100% cleanup of round 5, while every ROADMAP success criterion was already verified. G-1 caps repeated phase INSERTS on a hot file; nothing capped repeated ROUNDS on a phase. This is that cap.

Three structural mechanisms drive the runaway — none is anyone's mistake, which is why a rule is needed rather than more care:

1. **The gate manufactures findings.** Every `execute-phase` ends with a standard-depth code review of code written that morning; such a review essentially always returns something → a must_have scores failed → `gaps_found` → straight back into `plan-phase --gaps`. Nothing in the loop asks *"is the phase GOAL met?"* as the terminating question — must_have bookkeeping outvotes it.
2. **Each round adds must_haves, which are themselves new failure surface.** Phase 187's plan `187-29` existed ONLY to pin round 5's guards; its own headline must_have then failed. A pure-bookkeeping plan manufactured a gap.
3. **Closure rounds smuggle in features.** "The loose door has no KB picker" is a MISSING CAPABILITY, not a defect in shipped code. Building it inside a closure round is both how 15 became 29 and why that round shipped a blocker — new surface, zero prior review cycles.

**The mechanical check (run it — do not eyeball the round count):**

```bash
node scripts/check-gap-closure-rounds.cjs <phase>
```

Exit `0` = G-7 clear · `1` = G-7 fires · `2` = harness error. It derives the round count from the repository itself — `gap_closure_round:` frontmatter where present, falling back to the number of distinct commits that ADDED gap-closure plan files (that fallback is load-bearing: Phase 186's twelve gap plans carry no round field at all, and it still reads 3 correctly) — and prints the derivation so the number is auditable rather than asserted. It also fails `[new-capability-in-closure]` when a gap-closure plan's `files_modified` contains a non-test source file that did not exist when that plan was written; run against Phase 187 it names `DescribeKbPicker.tsx` unprompted, which is precisely the file that shipped CR-R5-01.

Both failures have a WORDED escape hatch, never a boolean — `--unmet-criterion "SC#N: <what is not true>"` and `--capability-approved "<why this belongs here>"`. An override prints `G-7 passed WITH OVERRIDES` rather than `clear`, so a waved-through finding can never read as an absent one, and it must still be recorded under `STATE.md → Guardrail overrides` per the protocol below.

**Run it at three points:** when `verify-work`/`execute-phase` returns `gaps_found`; before emitting any `--gaps` routing; and at the top of `/gsd:plan-phase {X} --gaps`.

**Before emitting ANY `/gsd:plan-phase {X} --gaps` routing, the orchestrator MUST:**

- **Report success-criteria status first.** If every ROADMAP success criterion is verified, say so plainly and present *stopping* as a real option — never route to the next round as though it were the only door.
- **Date the offending code** (`git log --diff-filter=A -- <file>`). Gaps in the current round's own output are a signal to STOP, not to iterate.
- **Size each fix.** ≤ 1 file / ≤ 10 lines with no schema or API surface is `/gsd:fast` under G-3 — never a round.

**Closing a phase with owed manual UAT rows is legitimate**, and is often the right call — but state it as a DECISION, never as a claim that everything ran. Record the owed rows in the ROADMAP progress row and `STATE.md`, and name which row to run first.

**Orchestrator protocol when a guardrail fires:**

1. Surface the violation BEFORE running the requested command — name the rule, name the proposed alternative
2. If user overrides ("proceed anyway"), proceed but record the override under `STATE.md → Recent Completed Phases → Guardrail overrides` so it's auditable
3. Never silently apply OR silently skip — every fire is either honored or audited

**Hot-file ledger (update as phases ship):**

| File | Phases touched | G-5 status |
|---|---|---|
| `frontend/src/components/chat/ToolCallPanel.tsx` | 067 / 067.5 / 075 / 075.4 / 075.6 / 075.7 (6+) | satisfied (075.7 — 2026-05-24) |
| `frontend/src/components/chat/MessageItem.tsx` | 075 / 075.1 / 075.4 / 075.6 / 075.7 (5+) | satisfied (075.7 — 2026-05-24) |
| `backend/app/api/threads.py` | 056 / 058 / 061 / 067 / 073 / 075 / 075.3 / 075.4 / 075.6 (9+) | G-5 fires — extraction due |
| `frontend/src/providers/StreamsProvider.tsx` | 068 / 075 / 075.4 / 075.6 / 075.7 (5+) | satisfied (075.7 — 2026-05-24) |
| `frontend/src/hooks/useMessages.ts` | 063 / 063.1 / 067 / 067.5 / 075.7 (5+) | satisfied (075.7 — 2026-05-24) |
| `backend/app/services/anthropic_service.py` | 074 / 075 / 075.4 / 075.6 (4+) | G-5 fires — adapter pattern audit due |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 183 (×3 plans) / 184 (×3) / 185 (185-01, 185-08, 185-10) — 9 plans across 3 phases, **1574 L**, now the largest workflow file | **G-5 fires — extraction due in Phase 188.** `185-10` named the seam: lift `PlaneEditingLayer` + the exported `EDIT_AFFORDANCE` table out. Note the live ESM-cycle constraint it discovered — `WorkflowCanvas` imports `FlowEdge`'s VALUE at module scope for the `edgeTypes` map, so the extracted module must not import back. |
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | 184 (184-03, 184-08) / 185 (185-01 the 137-B rebuild, 185-08 docblocks, 185-09 the corner seal) — 5 plans across 2 phases, 478 L | Watch — under the 3-phase threshold. 185 spent its budget deliberately: 185-01 rebuilt the geometry to 137-B (D-185-17) and 185-09 added the governance corner seal. Two invariants are now type/test-enforced and must be read before any new mark is proposed: **a third badge is a typecheck error**, and **no focusable control may live inside the card** (the ✕ and ＋ live on the lane). Badge slot 1 is empty and reserved for 188/189. |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 140 / 183 / 184 / 185 (185-07 mount point only) — 1095 L | **G-5 fired at 185 and was HONOURED BY CONSTRUCTION.** 185 added a mount point, not a feature: measured `git diff --stat` over the whole phase is 23 ins / 6 del, of which 16 ins / 6 del are docblock prose and only **4 insertions reach the render body**. The dial, its refusal and the arming switch all live in `GovernanceSection.tsx`, their own file. Keep this shape — the next surface that needs the panel gets its own component and one gated line. |

When a new phase enters discuss-phase, the orchestrator must scan PLAN.md `files_modified` against this ledger. Any match against a G-5-firing row means the discuss-phase produces a refactor recommendation as the first option, not the planned feature.

## Project skills

- **Sketch findings for Agentic RAG** (design decisions, CSS patterns, visual direction for the live-execution UX — run-card frame, tool-call panel shape, long-run composition; the Phase 087 workspace panel — panel shell/collapse/mobile, file+diff viewer, ask_user interrupt, chat↔panel seam; the Phase 094 workflow-mode surfaces — harness phase timeline, unified Deep/Harness execution surface, run honesty, 2-pill composer + mode clarity, Workflows page, NL workflow builder; the Phase 095 chat tool-card unification — the unified status-node rail frame, the never-vanishes run-status strip + follow-but-release scroll, the output-files hero/working split + per-extension file icons, and the build-once component inventory; AND the Phase 103 Workflow Studio — the requirement-first workflow Builder/authoring + read-only vertical phase-spine graph + side-panel forms, the 8-stage publish gauntlet with the judge hard-wall, the built Workflows page library+launch, the workflow run surface where the panel owns the meaningful phase spine + chat carries a thin run receipt, and the three-homes app navigation/IA contract; AND the Phase 112 document detail panel — the right-side push/split document-detail shell (the shared shell that Phase 117 relationships + Phase 118 classification also inhabit), the per-field ConfidenceChip, and honest inline metadata editing; AND the Phase 114 virtual-folders surfaces — the no-DSL filter/view builder + relative-date control, the saved-Views sidebar group + shared Folders+Views NavRow / folder-tree polish, and the Documents-page composition/layout; AND the Phase 117 document relationships — the chip-led grouped-by-direction relationships accordion added to the existing detail panel (outgoing/incoming inverse labels, masked "no access" row, re-fetch-not-optimistic remove) + the type-first searchable-typeahead create-link picker on the MoveToFolderDialog shell; AND the Phase 127 energized Workflow Studio re-skin — the publish-gauntlet pip/energy-spine + worded verdict + raw-on-demand, the quiet-idle/alive-active live step-flow, and the cross-cutting ICON CONVENTION (provider/model icons = single-source @lobehub/icons everywhere; phase-type icons = the shared 3D PHASE_GLYPHS map); AND the Phase 111.1 Settings surfaces — the reusable provider picker with the always-on 🔒 endpoint footer, the weight-not-friction re-embed confirm, the re-embed progress card; AND the Phase 118 auto-classification — suggested-never-moved chips + the dedicated rules surface; AND the Phase 119 governance-health home — signal cards + inline verb fix-rows, page writes nothing; AND the Phase 123/123.1 Trigger Tuner — held-out picks, N-column-configured-targets scoreboards, never-block lint, the real-scale editor lesson; AND the Phase 124 workflow soul + strict/loose two doors; AND the Phase 128 cross-provider chat polish — single-source provider logos, two elapsed-status homes, the user-prompt clamp; AND the Phase 137 Skill Studio — the focused Evals·Triggering·Versions surface, the lifecycle stepper, the expandable honest run rows, the immutable version table + compare; AND the Phase 137.1 eval production-clean — the grouped matrix card with one gate-feeder + history aggregation + deterministic analyst notes, the thin determinate unit bar + inline advisory case feedback, and the Settings engine-health tile board + judge-model knob; AND the Phase 146–148 Operator Control Room — the operator band+tabs shell with honest locks + the ⌥ Technical-names two-audience reveal, the always-on audit-ledger receipt vocabulary (✎ writes, consequence ≠ receipt) + the graded action-guards rule (victim-naming sheet / arm-to-confirm / direct flip), the pinned-vitals Control Plane (dependency health, active-runs-with-Kill, kill-switch grid + spatially-separated maintenance), the two-ledger audit browser (chip filters + recorded CSV), the users roster (last-active honesty, victim-naming disable, flagged operator grant), and the API-enforced feature-visibility audience map with the extensible-audience forward-compat contract; AND the Phase 185 Graded Governance surfaces — the detected-and-one-way grounding dial (the switch that visibly refuses + the “you can only undo a lock you created” rule), the shape-only canvas seal whose CORNER MARK is load-bearing (top-right of the card is claimed; governance spends no colour and no third badge), the binding “must prove it” vocabulary, the armed-on-by-default action-risk checkpoint, the review moment where the document IS the surface with backing marked inside it, and the one-place canvas↔review↔canvas round trip; AND the Phase 187 node-vocabulary + AI-seed surfaces — the layered node-face ladder (author name → config-derived → type sentence, computed never stored), the ⌥ Technical-names reveal that swaps the SUBTITLE not the title, the single-shot AI-seed arrival + its seed receipt that makes auto-applied grounding legible, and the template door that seeds the describe box rather than opening a second forward path; PLUS the canvas glyph vocabulary in `references/icon-convention.md` §4 — read it before drawing any canvas mark) → `Skill("sketch-findings-agentic-rag")`. Auto-load when building or refactoring ToolCallPanel, RunCard, StreamsProvider, MessageItem, MessageList, OutputFileCard, useMessages, the workspace panel, the harness/workflow run UI or its phase timeline, the workflow Builder/authoring, the publish gauntlet (its energized pip-strip + worded verdict), the live phase spine (PhaseCard/PhaseTimeline), provider/model logos anywhere or the icon convention, the Workflows page, the workflow run surface + its meaningful steps, the app navigation/IA, the composer, the document detail panel / ConfidenceChip / inline metadata editing, the documents-page right-side panel, the metadata filter/view builder, the saved-Views sidebar + folder tree (FolderNode/FolderTree NavRow), the document relationships panel section + create-link typeahead picker, any Settings model picker / the engine-health card / the re-embed lifecycle, the classification suggestion or rules surfaces, the governance-health page, the Skill Studio (EvalsTab/TriggeringTab/VersionsTab, LifecycleStepper, RunBar, RunHistory, RunCaseDetail), the Trigger Tuner internals or any per-provider scoreboard, matrix runs / eval progress / judge case_feedback, any `/admin` Control-Room surface (OperatorBand, ControlRoomPage, HealthSignals, ActiveRunsSection, CapabilityGrid, MaintenancePanel, AuditTab, the users roster, the feature-visibility map) or any operator confirm-sheet / audit receipt / kill-switch / destructive-action guard, any per-node grounding/governance surface or refusal copy, any approval / human-review checkpoint or the artefact-preview matrix, the workflow run surface and how a run relates to chat, or any chat-surface component touching the agent's mid-execution moment.

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
