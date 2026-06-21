# v3.1 Advisory — Workflow + Skill Eval Studio

*Synthesis of 6 dimension findings (R1–R3 docs research, C1–C3 codebase), reconciled against 3 adversarial verdicts. All file:line and URLs carried from findings; nothing invented. Where findings conflict, I say so explicitly. Conclusions the verifiers rated low-confidence are marked **needs live confirmation (DB/logs)**.*

---

## 1. SKILLS MODEL — Anthropic-first, the common abstraction, and the provider boundary

**The unit converged into an open standard.** Anthropic's Agent Skills (a `SKILL.md` folder = YAML frontmatter + Markdown body + optional `scripts/`/`references/`/`assets/`) became the vendor-neutral **`agentskills.io` open spec** in Dec 2025, with a reference validator (`skills-ref`). Within ~48h OpenAI (Codex/ChatGPT), Microsoft (VS Code), and by March 2026 ~32 tools incl. Google's Gemini CLI read the *same* `SKILL.md` ([agentskills.io/specification](https://agentskills.io/specification), [OpenAI Codex Skills](https://developers.openai.com/codex/skills), [byteiota 48hr adoption](https://byteiota.com/agent-skills-standard-microsoft-openai-adopt-in-48-hours/)). OpenAI is simultaneously **deprecating** its managed prompt objects (shutdown Nov 30 2026) and telling developers to move prompts into git-versioned files ([migrate-from-prompt-object](https://developers.openai.com/api/docs/guides/prompting/migrate-from-prompt-object)) — an external endorsement of exactly the file-based-skill model.

**The common abstraction (keep this provider-NEUTRAL):**
A named, described, triggerable, testable unit = `{name, description, instructions, optional bundled resources}`, surfaced cheaply (name+description ≈ 100 tokens), selected at runtime **by its description matched against the task**, expanded **progressively** (metadata → body <5k tok → bundled files on demand). Anthropic, OpenAI, and Google have all converged here. **Our `skills` table (name/description/instructions/is_global/is_enabled) + `skill_files` bucket + catalog-into-system-prompt + `load_skill` tool is a faithful re-implementation of this** — we built the standard before it was standardized.

**The frontmatter contract to adopt as canonical** ([agentskills.io/specification](https://agentskills.io/specification)): `name` (required, ≤64 chars, `[a-z0-9-]`, must match dir name, no leading/trailing/double hyphen), `description` (required, ≤1024 chars, "what + when to use", trigger keywords), and optional `license`, `compatibility` (≤500 chars), `metadata` (arbitrary k/v — the natural home for `version`), `allowed-tools` (experimental). There is **no `version` frontmatter field** in the standard — versioning is a `metadata.version` convention.

**The provider-SPECIFIC boundary (must branch at the gateway, never on the shared path):**

| Concern | Neutral / shared | Branch per provider |
|---|---|---|
| Skill *content* | `name`/`description`/`instructions`/files — one shared schema | — |
| Trigger mechanism | catalog injection + a single `load_skill` tool call (works on every provider) | — |
| **Tool/function schema dialect** | — | **Gemini: OpenAPI subset, NO `anyOf`/`oneOf`/`allOf`/`default`, no multi-type `type:[...]` arrays, watch nesting/size; OpenAI `strict`: all fields required + `additionalProperties:false`; Anthropic: native** ([Firebase AI Logic](https://firebase.google.com/docs/ai-logic/function-calling), [gemini-cli #13326](https://github.com/google-gemini/gemini-cli/issues/13326)) |
| Tool-forcing primitive | — | Gemini `mode` AUTO/ANY + `allowed_function_names`; OpenAI `tool_choice`; Anthropic `tool_choice` |
| Skill delivery/runtime | our Docker `llm_sandbox` + our `read_skill_file`/`execute_code` (provider-neutral) | Anthropic-API-only: `container.skills[]`, `/v1/skills`, `skill_id`/`version`, beta headers, Files-API returns — **never let these leak into the shared path** |

**The single most important architectural validation:** routing skill activation through a normal tool call (not a provider-native skill loader, which only Claude Code/Codex/Gemini CLI filesystem harnesses have) is the **only** mechanism that works identically across OpenAI, Gemini, Anthropic-native, and OpenRouter inference APIs. R3 confirms our design is correct — do not chase provider-native loaders. The **only** unavoidable divergence is the JSON-Schema dialect + tool-forcing primitive, which already lives in our gateway (the documented Gemini multi-type-array trap is our own scar tissue, ref MEMORY `reference_gemini_schema_type_array_trap`).

---

## 2. WHERE OUR SKILLS SYSTEM STANDS vs that model — the concrete gaps

Our substrate is ~70% there. The catalog injection (`agent_loop.py:1054-1075`) is exactly Anthropic's L1 surface; `load_skill` ≈ L2; `read_skill_file`/sandbox-exec ≈ L3. The agentskills.io ZIP import/export already exists (`skills.py:148-257, 506-562`, `_parse_skill_md` at `:48-61`). The gaps (all from C1 §"Gaps for v3.1", cross-checked against R1/R2):

| # | Gap | Evidence | Standard says |
|---|---|---|---|
| **G1** | **No relevance / "smart dispatch" pre-filter.** The FULL enabled own+global skill set is dumped verbatim each General-mode turn; token cost grows linearly with skill count. No toggle, no embedding filter, nothing named `skill_dispatch` in the live path. | `agent_loop.py:1056-1075` | L1 metadata should be ~100 tok/skill and budget-bounded; Claude Code drops least-used descriptions first (`skillListingBudgetFraction`, 1,536-char cap) (R1 §3) |
| **G2** | **No progressive disclosure beyond instructions.** `load_skill` returns full `instructions` + a filename *manifest only* — no metadata→body→resource staging, no token-budgeted reveal. | `tool_dispatcher.py:698-702` | 3-level disclosure; bundled content has "no context penalty if unused" (R1 §2) |
| **G3** | **No executable skill bundle.** Anthropic's runnable `scripts/` is absent. Files are read as TEXT (`read_skill_file`) and the model must **re-type them into `execute_code`**; assets only reach the sandbox if the model explicitly passes `execute_code.skill_files` or `render_template.asset`. No "run skill script" primitive. | `tool_dispatcher.py:786-842, 891-937`; schema `openai_service.py:619-629` | "scripts execute without entering context" — the core progressive-disclosure benefit (R1 §2). **NOTE: our text-retype path forfeits this benefit** |
| **G4** | **No description-quality / triggering eval.** Nothing scores whether a `description` actually triggers `load_skill`. `save_skill` and the skill-creator seed accept ANY description. No golden prompts, no judge, no trigger-rate measurement. (The *workflow* side has the publish gauntlet + `llm_judge`; skills have nothing analogous.) | `tool_dispatcher.py:705-739`; `018_skill_creator_seed.sql` | description IS the entire trigger surface; eval-driven development, should/should-not-trigger tuning (R1 §3,§6; R2 §A.2) |
| **G5** | **No versioning surface in Deep mode.** `skills` has no `version` column; `save_skill` mutates in place — no history, no rollback, no draft/published. The ONLY version machinery is workflow-side (`skill_snapshot.py` snapshots a skill INTO a locked WorkflowDefinition). | `017_skills.sql:8-18`; `skill_snapshot.py` | `metadata.version` convention; immutable snapshot for baseline compare (R1 §6, R2 §A.4) |
| **G6** | **No global-publish governance for skills.** `toggle_global` is a raw owner flag with no review/judge gate (contrast workflow publish). `skill_snapshot.py:31-37` explicitly defers self-serve global skill publish to "Phase 109." | `skills.py:349-382` | publish gate analog to workflow gauntlet (R2 §C) |
| **G7** | **Skill-creator is interview-only.** It guides `save_skill` via a 3-question interview but never validates the produced skill — no test-trigger, no example run, no description lint. Authored skills ship unverified. | `018_skill_creator_seed.sql` | the canonical `skill-creator` runs a full eval+benchmark+description-optimization loop (R2 §A) |

**Honest caveat on G2/G3:** R1 frames progressive disclosure as the headline benefit, but our `read_skill_file` partly mirrors it (catalog → load instructions → read files on demand). The real deficit is **G3** — without a "run script" primitive, the "code never enters context" economy is forfeited; the model re-types script bytes into `execute_code`. This is a genuine architectural gap, not just polish.

**Versioning red-herring note (for planners, per V3):** grepping `version` in skills code WILL hit decoys — the ZIP export-format literal `"version": "1.0"` (`skills.py:543`) and SDK "client version" comments (`skills.py:336/372`). None is a skill-record version column; `017_skills.sql` has no `version` field and `save_skill` mutates in place. **VER-01 (G5) is genuinely net-new** — do not mistake the export literal for an existing version surface.

---

## 3. THE COLLISION — ranked root cause, why two files, recommended fix

**Symptom (operator-observed, real):** ran the "weekly report" WORKFLOW (produced its template — expected); same thread reverted to Deep chat; re-asked "generate weekly report" → triggered the SKILL "Weekly Report generator" → produced **TWO** files: the skill's intended template AND a template from the WORKFLOW.

**First, what it is NOT (all four findings agree, V1 verified each elimination against source):** NOT a system-prompt fragment, NOT retained harness phase context, NOT the snapshotted `skill_ref`. The harness lock releases on terminal (anchor `active_workflow_run_id` cleared → `threads.py:1891` flips mode to "deep"), the locked `WorkflowDefinition`/`skill_snapshot` JSONB does not leak into Deep, and the harness final answer is persisted as a plain assistant `messages` row with NO tool_calls (`harness_engine.py:439-448`), so history reconstruction never re-harvests it — it only re-emits tool_calls for LLM context, never re-harvests files (`agent_loop.py:743-808`). The bleed is **shared thread-scoped state** — everything is keyed to `thread_id`, never `run_id`.

**The findings split on WHICH shared state. V1 confirms these are two independent, both-real retention surfaces — not competing theories. Per V1's correction, I have DROPPED the over-precise "~85%" confidence number C2 attached to Mechanism A; the code cannot support a hard percentage, and which mechanism fired is undetermined from code alone (it depends on what the skill actually did). Both must be fixed; COLL-03 runtime probes decide which one(s) fired.**

### Mechanism A (the more general defect) — shared sandbox `/sandbox/output/` + directory-wide harvest

The sandbox container is keyed by `thread_id` (`sandbox-{thread_id[:12]}`), reused across both modes and even across worker bounces (`sandbox_service.py:25-85`). The workflow's template-fill writes its deliverable to `/sandbox/output/{out_filename}` (`tool_dispatcher.py:2013`, render driver `doc.save` `:1586`/`:1637`) and **nothing ever clears that directory** (grep finds only `mkdir -p` + `copy_from_runtime`, never `rm`/`rmtree` in any service — `tool_dispatcher.py:887, 2019`, `sandbox_service.py:257`). When the later Deep skill runs `execute_code`, `harvest_output_files` does `copy_from_runtime("/sandbox/output", …)` + `os.walk` over **every file with no filename filter** (`sandbox_service.py:264-273`); the fresh run's dedup baseline `_previous_files_in_run` starts **empty** (`agent_loop.py:1316`, consumed at `tool_dispatcher.py:865,1139-1145`), so every on-disk file is emitted as new (`sandbox_service.py:331-350`). **Why two files:** the skill produces ONE new file; the harvest walks the dir, finds it PLUS the leftover workflow deliverable, emits both (re-uploaded with a NEW Deep `execution_id` at `sandbox_service.py:297-310`). (Run the workflow twice → three files.)

### Mechanism B (the more specific defect) — `template_input` resolver "newest-wins" Branch 2

The ephemeral uploaded template is a `workspace_files` row `kind='template_input'` scoped to `(thread_id, created_by)` with a 24h TTL, **never deleted at run end** (`api/workspace.py:159-203`; `pin_templates_for_run` only *extends* expiry, never deletes — `template_service.py:90-112, 102-107`). `resolve_template_source(asset_ref=None)` Branch 2 runs `… WHERE thread_id=$1 AND created_by=$2 AND kind='template_input' … ORDER BY created_at DESC LIMIT 1` — **newest non-expired upload on the thread wins, no run/workflow scope** (`template_asset_service.py:136-210, 141-155`). A workflow emit phase with no library AssetRef bound *falls through to this same ephemeral branch* (`emitters.py:138,154`; `phase_types.py:730, 1067-1111`). The Deep skill's `render_template` (`tool_dispatcher.py:1829`, resolver call `:1955`) with `asset=None` → Branch 2 → picks up the workflow's leftover upload. **Why two files:** `emitters.py:138-148` deliberately writes a *distinct* stem `deliverable-filled.<ext>` (a 101.1-08 fix to avoid clobbering the uploaded template), so the skill's intended output and the workflow-template render persist side-by-side instead of one overwriting the other.

**Important asymmetry (per V1):** the `render_template` harvest path is **materially different** from the `execute_code` path — it filters by exact `out_filename` (`tool_dispatcher.py:2084`), whereas `harvest_output_files` takes *everything* unfiltered. So a skill that uses `render_template` is **immune to Mechanism A's directory-wide re-emit** and can only be hit by Mechanism B; a skill that uses `execute_code` is exposed to A. This is precisely why the A/B split tracks "what the skill did."

**The simpler reading, named and dismissed (per V1):** one might explain "two files" as the workflow's OWN already-persisted `workspace_file` (render success persists via `ws_write_file` + emits `workspace_file_written`, `tool_dispatcher.py:2176/2194`) merely *still visible* in the thread, with the skill turn adding only the second. The operator attributed **both** files to the skill turn, and Mechanism A's harvest re-insert (a NEW `sandbox_files` row carrying the Deep `execution_id`, re-upload at `sandbox_service.py:297-310`) genuinely predicts a *re-appearance* in that turn — so A still fits the report. The "already-visible" reading is not the leading explanation but is the cheapest one to rule in/out via COLL-03.

**Reconciling the conflict (my honest read):** Mechanism A and Mechanism B are **two independent retention surfaces in the same thread**, and which one fired depends on what the skill actually did. `execute_code`-built `.docx` → Mechanism A. `render_template` with no explicit asset → Mechanism B. C2 itself flagged this ambiguity. **Both must be fixed; neither alone is sufficient.** A is the more general defect (any two render-producing ops sharing a thread); B is the more specific template-resolver leak.

**Recommended fix (layered, ranked by leverage):**
1. **Scope the sandbox harvest to THIS execution** (kills Mechanism A, smallest blast radius): snapshot the `/sandbox/output/` listing before user code and harvest only the diff, OR filter by mtime against an execution-start timestamp (`sandbox_service.py:264-273`). Equivalent: seed `harvest_output_files`' `previous_files` baseline from the existing thread workspace at turn start (`sandbox_service.py:331`) so a new turn never re-emits stale files. **Caution:** clear/scope per *run*, not per `execute_code` cell — a single run with multiple cells must not lose its own intermediate files.
2. **Run-scope the ephemeral template** (kills Mechanism B): tag `template_input` rows with `run_id` (or a `source='workflow'|'chat'` discriminator) and make Branch 2 resolve only uploads from the *current* execution context; AND retire/expire the workflow's template at run terminal instead of relying on 24h TTL (the pin already knows the run boundary — `template_service.py:90`). (R2's option A is the highest-leverage smallest-blast-radius variant.)
3. **Defensive:** require an explicit `asset`/template reference for Deep-mode `render_template` when >1 resident `template_input` exists, rather than silent newest-wins.

**Runtime evidence that would confirm — needs live confirmation (DB/logs); NOT yet run (from C2):**
- `docker exec sandbox-{thread_id[:12]} ls -la /sandbox/output/` after the workflow run AND after the skill turn — both files present *before* the skill's `execute_code` ⇒ Mechanism A confirmed.
- Query `sandbox_files` (`tool_dispatcher.py:304-310`) for the thread: workflow deliverable filename re-inserted with a NEW `execution_id` belonging to the Deep `code_executions` row ⇒ harvester re-uploaded the stale file (A).
- `workspace_files` rows for the thread with `kind='template_input'` non-expired at skill-turn time, and a `deliverable-filled.<ext>` output ⇒ Mechanism B fired.
- Backend log `"Uploaded sandbox file %s (%d bytes) to %s"` (`sandbox_service.py:301`) firing **twice** in the Deep turn ⇒ two files harvested.

This is the disambiguator the operator should run before planning the fix — it decides whether v3.1 needs fix #1, fix #2, or (most likely) both.

---

## 4. THE IA CALL — should workflows launch ONLY from the Workflows page?

**Recommendation: YES — remove workflow *selection* from the composer mode-pill; keep "run-from-thread" as an explicit object/action, not a persistent composer mode.** All three relevant findings (R2 §D, C1, C3) independently agree, and V2 verified the load-bearing claims against source. This is the right product call and aligns with v2.9's own stated "three-homes" IA + "mode clarity" intent.

**What exists today (enumerated, C3 §4; V2-confirmed):** four entry points, all converging on one server kickoff (`POST /threads/{id}/messages {workflow_definition_id}`, `threads.py:926`):

| # | Entry | Effect |
|---|---|---|
| 1 | **Composer Harness pill** (`MessageInput.tsx:379-477` → `ChatArea.tsx:331-348`) | kicks off in the **current** thread |
| 2 | Workflows page Run modal (`WorkflowsPage.tsx:704-832` → `doRun` `ChatLayout.tsx:83-92`) | creates a **NEW** thread (`createThread` first, `ChatLayout.tsx:85`), redirects to chat |
| 3 | Post-publish "Run now" CTA | same as #2 |
| 4 | NL-author → publish → run | funnel terminating in #2/#3 |

**#1 is the only one that starts a workflow inside an existing chat thread — and the only one the operator wants removed.** V2 confirmed #2/#3/#4 always create a fresh thread (the RunModal even renders the literal copy "Run opens a new chat thread and streams there", `WorkflowsPage.tsx:805`), so "workflow then same-name skill in one thread" is structurally impossible from them.

**Why it's right:**
1. **It is the structural enabler of the collision class.** #1 puts workflow launch and free chat in the *same* thread, so workflow ephemeral/template/sandbox state and Deep tool calls co-tenant and resolve against each other (§3). #2/#3/#4 always foist a fresh thread, making the collision structurally impossible.
2. **Mode clarity.** The composer collapses from 3-pill cognitive load (General/Explorer × Deep/Harness × workflow-picker) to a clean 2-pill General/Explorer. The amber-Harness affordance, the picker, the `workflowLocked`-disables-everything tooltip dance (`MessageInput.tsx:331-394`), and the displayed-mode badge all disappear from the composer.
3. **Discoverability / three-homes.** v2.9's IA already wants Workflows to be a browsable library you launch from, per the sketch-findings contract and the page's own docstring ("Workflows are a MODE of a thread, never page-resident… Run creates a NEW chat thread").
4. **Low real value lost — with one nuance (V2 correction).** For **bound** workflows (project_folder_id set), scope = the project subtree baked into the definition (`threads.py:1340-1341`), NOT the thread's chat content — so #1's only genuine value is "I'm already here." **HOWEVER, for UNBOUND/legacy workflows there IS a real thread-derived scope:** `threads.py:1342-1352` falls back to the *launching thread's* `folder_id` subtree. So an in-thread composer launch of an unbound workflow did inherit the thread's *folder binding* (not chat content). The "never inherited chat context as KB" claim is correct in spirit, but unbound workflows lose a marginal folder-scope convenience when forced to a fresh thread. This strengthens, not weakens, the case for IA-02 either defaulting to new-thread launch OR carrying the launching thread's `folder_id` into the new thread.

**What it COSTS / migration (small, frontend-only, backend-zero — V2 verified):**
- Delete `workflowMode`/`publishedWorkflows`/`selectedWorkflowId` plumbing from `MessageInput.tsx:374-477` (props `:54-67`) and the Harness send branch from `ChatArea.tsx:70-72, 328-355, 409-420`. The plumbing is confined to exactly 3 frontend files (`ChatArea.tsx`, `MessageInput.tsx`, one test `ChatAreaMode.test.tsx`) — Grep confirms no other consumers.
- **KEEP** the lock machinery: `active_workflow_run_id` (set by `create_workflow_run`, `backend/app/db/workflows.py:152`, called from the SHARED kickoff at `threads.py:1146` — **NOT by the composer**), the 409 lock (`threads.py:891-924`), `GET /threads/{id}/workflow` mode reconcile (`:1823-2008`, approx), `useWorkflowLockForThread`, and the read-only displayed-mode badge ("Workflow running" + Cancel) — a page-launched workflow STILL runs in a thread and STILL must lock it. The composer mode is purely a second *caller* of a shared transport; deleting it leaves the lock/reconcile path intact. **This is a composer-UI deletion, not an engine change.** The panel-owns-phase-spine + chat-carries-thin-receipt design holds fully (downstream of kickoff, agnostic to trigger).
- **Citation fix (V2):** the server-truth reconcile is the `getThreadWorkflow` effect at `ChatArea.tsx:178-204`, NOT line `:417` — `:417` is a simple `workflowLocked ? 'harness' : 'deep'` ternary. (Does not change the recommendation.)
- **Backend: zero changes.** `POST /threads/{id}/messages {workflow_definition_id}` stays — it's what `doRun` calls (and the shared transport `api.ts:443-457` postMessage / streamsStore / StreamsProvider / `useMessages.sendMessage` is retained anyway). The composer just stops being a second caller.
- **Optionally** add a "Run a workflow" affordance (slash command / + menu) that opens the Workflows picker and launches into the current thread *as an explicit object* — preserves genuine run-from-thread value without making "Harness" a composer mode (R2 §D). **(Open question: does this re-introduce the same-thread collision? Only safely if combined with the §3 run-scoping fixes. Default to NEW-thread launch until those ship.)**
- **G-2 (sketch-first) FIRES** — this is live composer/IA, so an operator-approved mock is the acceptance bar before planning.

**Honest caveat (C3, V2-confirmed):** removing #1 makes the *observed* scenario impossible but is a **band-aid, not the fix** — the underlying `thread_id`-co-tenancy defect (§3) re-surfaces anywhere two render-producing ops share a thread (two skills, a skill run twice), because the sandbox container and `template_input` rows are `thread_id`-keyed independent of how the run was launched. **Ship the IA change for clarity; ship the §3 run-scoping as the actual collision remediation. They are independent.**

---

## 5. LEVERAGING THE SKILL-CREATOR — productizing the authoring + eval + description loop on our v2.9 primitives

The canonical `skill-creator` (read in full at `screenshots/skill-creator-extracted/SKILL.md` + `agents/{grader,comparator,analyzer}.md`, R2 §A) is an eval-driven authoring loop. **We already own ~70% of the substrate** (R2 §C):

| skill-creator concept | Our existing primitive | Mapping |
|---|---|---|
| grader / comparator / analyzer sub-agents | Deep-mode **`task` tool** (sub-agents) | each role = a sub-agent prompt; we already fan out paired/parallel sub-agents |
| baseline = old skill version | **`skill_snapshot.py`** immutable snapshot (name/desc/instructions + Storage files) | **biggest reuse** — comparator's old-vs-new IS snapshot-vs-live; reuse as the versioned baseline |
| grader assertions / pass-fail-evidence | **Phase-102 `llm_judge`** + golden-run + the `llm_emit` **citation/coverage gate** (`tool_dispatcher.py:1907-1939` `check_coverage`) | the judge IS a grader; the citation gate IS an objective assertion engine — reuse, don't reinvent |
| benchmark / quantitative gate | the **publish gauntlet** + judge-as-publish-blocker | a skill "publish" can carry the same shape: trigger-rate + held-out pass-rate as a hard gate |
| with-skill vs baseline paired runs | `task` fan-out OR a harness `llm_batch_agents` phase | a dedicated "Skill Eval" *workflow* whose phases ARE the loop |
| review viewer (2-tab HTML) | document-detail right-side panel + OutputFileCard + diff viewer (`workspace.py` versions/diff) | reuse the panel for the Outputs tab + a new Benchmark tab |
| eval workspace files | `workspace_files` (thread-scoped, versioned, TTL) | iteration dirs = workspace prefixes — **but scope by run, not thread (the §3 collision risk!)** |

**The highest-value, most mechanical piece to build FIRST (R2 §E):** the **description-optimization loop** as a standalone **"Skill Trigger Tuner"**, wired to G1's smart-dispatch pre-filter. From the canonical artifact (`SKILL.md:333-404`): ~20 should/should-not-trigger queries (8-10 each), **near-misses are the valuable negatives** (share keywords, need a different tool), **60/40 train/held-out split, 3 runs/query, ≤5 iterations, `best_description` selected by HELD-OUT score** (avoids overfit). It is the most mechanical part (no human viewer, no subjective grading), directly attacks our known under-triggering (G1/G4), reuses primitives we have (`task` sub-agents, session model-id so triggering matches production), and yields an **objective publish gate** ("≥X% on held-out should-trigger, ≤Y% on near-miss negatives") that slots into our gauntlet pattern. **Critically, it would have caught the operator's collision class earlier:** a skill named "Weekly Report generator" competing with a "weekly report" workflow is a textbook should-not-over-trigger near-miss — exactly the tricky negative the loop is designed to surface.

**Data schemas to implement (exact field names the viewer depends on, R2 §B-schemas):** `evals.json` `{skill_name, evals[]{id, prompt, expected_output, files, expectations[]}}`; `grading.json` top-level `expectations[]{text, passed, evidence}` (NOT name/met/details) + `summary{passed,failed,total,pass_rate}` + `claims[]{claim, type∈factual|process|quality, verified, evidence}`; `benchmark.json` per-config mean±stddev+delta; `comparison.json` `{winner∈A|B|TIE, reasoning, rubric…}`; `feedback.json`; trigger-eval set `[{query, should_trigger}]`. The three sub-agent contracts: **Grader** (PASS only on genuine completion + critiques the evals themselves), **Comparator** (BLIND A/B, 2-dimension rubric, decisive), **Analyzer** (post-hoc unblind improvement_suggestions OR benchmark anomaly notes — observations only).

**Authoring wisdom to encode as product affordances:** pushy descriptions (fight under-triggering); explain WHY not heavy-handed MUSTs (all-caps ALWAYS/NEVER is a yellow flag); bundle a script when all runs reinvent the same helper; SKILL.md <500 lines; generalize from feedback, don't overfit to the 3 examples.

**Cross-provider honesty:** R1/R3 confirm the eval *format* is provider-agnostic and portable, but **trigger-rate measurement must run on the production model-id** (Gemini/OpenAI/Anthropic trigger differently), so the tuner must test across providers — and the schema it emits flows through the same per-provider normalization (§1 boundary).

---

## 6. PROPOSED v3.1 MILESTONE SHAPE — "Workflow + Skill Eval Studio"

**Already shipped in v2.8/v2.9 — DO NOT re-scope (reuse as substrate; V3 verified each is in fact built):** harness engine + locked workflows + per-phase whitelists; the publish gauntlet + `llm_judge` hard-wall; `llm_emit` guaranteed-cited emission + `check_coverage`; deterministic `render_template` (docxtpl); `skill_snapshot.py` immutable snapshots (with the explicit Phase-109 global-publish deferral at `:31-37`); the Workflows page + `doRun` launcher + run-from-thread kickoff; the `task` sub-agent tool (`tool_dispatcher.py:2692`); agentskills.io ZIP import/export; the catalog injection (`agent_loop.py:1054-1075`) + `load_skill`/`read_skill_file`/`save_skill` tools; NL authoring; `skill_ref` composition; the panel-owns-phase-spine run surface.

> **Label precision (V3):** this advisory and the sketch/UI framing call it the **"8-stage publish gauntlet"**, but the SHIPPED backend `publish_service.py` module docstring describes a **6-stage flow** (branches stage-0/1/2 + golden run = stage 3). The *capability* (judge + golden-run as a hard publish blocker) is genuinely shipped and is correctly classified do-not-rebuild; "8-stage" is the UI/sketch label, "6-stage" is the code. Use **6-stage** when referencing the backend.

**NET-NEW themes + candidate requirements** (ID + one-liner), ranked by leverage. (Per V3: COLL-* and IA-* are bug-fixes / a UI deletion classified as in-scope remediation, NOT greenfield capability — the milestone's true greenfield surface is Themes C/D/E.)

**Theme A — Collision remediation (in-scope bug-fix, do FIRST, highest leverage):**
- **COLL-01** — Run-scope the sandbox harvest: snapshot `/sandbox/output/` listing (or mtime-filter) so a turn never re-emits stale files (`sandbox_service.py:264-273, 331`). *(Mechanism A)*
- **COLL-02** — Run-scope the ephemeral template: tag `template_input` with `run_id`/`source`, Branch-2 resolves current-context only, retire-on-terminal (`template_asset_service.py:136-210`, `template_service.py:90`). *(Mechanism B)*
- **COLL-03** — Disambiguate before fixing: run the C2 runtime probes (`ls /sandbox/output/`, `sandbox_files` re-insert check) to confirm which mechanism(s) fired. **needs live confirmation (DB/logs).** *(Gates whether COLL-01, COLL-02, or both are needed.)*

**Theme B — IA cleanup (in-scope UI deletion, cheap, frontend-only):**
- **IA-01** — Remove the composer Harness pill + workflow picker; collapse to 2-pill General/Explorer; keep the read-only lock badge + 409 lock + mode reconcile (`MessageInput.tsx:374-477`, `ChatArea.tsx:328-356`). G-2 sketch fires.
- **IA-02** *(optional)* — "Run a workflow" explicit-object affordance (new-thread default until COLL-01/02 ship; if launched in-thread, carry the launching thread's `folder_id` to preserve unbound-workflow folder scope per §4).

**Theme C — Skill triggering quality (net-new, highest *product* leverage):**
- **TRIG-01** — Skill Trigger Tuner: 20-query should/should-not held-out trigger benchmark (60/40 split, 3 runs, ≤5 iter, held-out `best_description`), cross-provider on production model-ids.
- **TRIG-02** — Smart-skill-dispatch relevance pre-filter (G1) + catalog token budget (least-used-dropped-first), opt-in.
- **TRIG-03** — Description-quality lint at `save_skill`/skill-creator time (third-person + "Use when" + keywords; pushy; <1024 chars).

**Theme D — Skill eval + governance (net-new, larger):**
- **EVAL-01** — Skill eval harness: `evals.json` authoring + grader/comparator/analyzer sub-agent roles (reuse `task` + Phase-102 judge + `check_coverage`).
- **EVAL-02** — with-skill-vs-snapshot-baseline paired runs + `benchmark.json` (reuse `skill_snapshot.py`).
- **EVAL-03** — Skill review viewer (Outputs + Benchmark tabs, reuse document-detail panel + diff viewer).
- **PUB-01** — Skill publish gate (trigger-rate + held-out pass-rate hard gate, mirroring the gauntlet) + global-publish governance (closes the G6 / explicit "Phase 109" deferral in `skill_snapshot.py:31-37` — V3 notes this is the single strongest evidence the surface is unbuilt).

**Theme E — Skills-standard alignment (net-new, smaller, schema work):**
- **STD-01** — Adopt agentskills.io frontmatter as canonical: enforce `name` rules + `description` ≤1024; add optional `metadata.version`/`compatibility`/`license`/`allowed-tools`. (`_parse_skill_md` currently requires only `name` — confirmed net-new.)
- **VER-01** — Standalone skill versioning surface (G5): a `version` lineage + draft/published + rollback (reuse the snapshot machinery, not in-place `save_skill` mutation). Ignore the `version` red-herrings in `skills.py:543/336/372`.
- **DISC-01** *(stretch)* — Executable skill bundle / "run skill script" primitive (G3) — closes the "code never enters context" gap. **Flagged as the riskiest** (touches the sandbox-injection seam that §3 is already fixing; sequence AFTER COLL-01).

**Leverage ranking (do in this order):** **COLL-03 → COLL-01/02 → IA-01 → TRIG-01 → TRIG-02/03 → EVAL-01/02/03 → PUB-01 → STD-01/VER-01 → DISC-01.** Collision + IA are small, cheap, and unblock trust; the Trigger Tuner is the highest-value net-new and the most mechanical; the full eval+viewer+publish suite is the milestone's bulk.

**Biggest risks (honest):**
1. **Scope inflation.** Themes C+D+E together are a *large* milestone (a real "Studio" rivaling v2.9's Workflow Studio in size). Recommend v3.1 = **Themes A+B+C** (collision + IA + Trigger Tuner) as the committable core, with D/E as stretch or v3.2. Do not pretend the full suite fits one milestone.
2. **The collision mechanism is undetermined from code alone — needs live confirmation (DB/logs).** COLL-03 must run first or COLL-01/02 may fix the wrong surface. (Both are likely needed; A is the more general defect, B the more specific.)
3. **Cross-provider trigger measurement** (TRIG-01) must test on production model-ids and route schemas through per-provider normalization, or it'll false-green on one provider and break Gemini (our documented multi-type-array trap).
4. **DISC-01 (executable bundles)** touches the exact sandbox seam the collision lives in — sequence it strictly after COLL-01, never before.
5. **G-5 hot-file pressure:** `backend/app/api/threads.py` is already flagged G-5-firing (9+ phases). IA-01 is frontend-only (safe), but any COLL-02 work near kickoff/template-pin should audit for an extraction-first refactor per the workflow guardrails.

---

## RECOMMENDED v3.1 SCOPE — operator decision summary

**One paragraph.** Ship v3.1 as **"Workflow + Skill Eval Studio"** with a committable core of three themes: (A) fix the workflow↔skill file-collision by run-scoping the two thread-keyed retention surfaces — the unfiltered sandbox `/sandbox/output/` harvest and the newest-wins `template_input` resolver — but FIRST run the live runtime probes to confirm which fired; (B) clean up IA by deleting the composer Harness mode-pill so workflows launch only from the Workflows page (frontend-only, backend-zero, keep the lock/409/reconcile machinery) — a clarity win and the structural removal of the collision's only in-existing-thread trigger, though NOT the underlying fix; and (C) build the **Skill Trigger Tuner** — the most mechanical, highest-value net-new piece (held-out should/should-not-trigger benchmark on production model-ids, reusing `task` sub-agents + the snapshot baseline + the judge/coverage gate). Defer the full eval-harness + review-viewer + publish-gate + standard-alignment suite (Themes D/E) to stretch or v3.2 to avoid scope inflation. Reuse — do not rebuild — the harness engine, the (6-stage) publish gauntlet, `llm_judge`, `check_coverage`, `render_template`, `skill_snapshot.py`, the Workflows page, the `task` tool, and the agentskills.io ZIP I/O.

**Ranked requirements (do in this order):**
1. **COLL-03** — live runtime probes to disambiguate Mechanism A vs B *(needs live confirmation — DB/logs)*
2. **COLL-01** — run-scope the sandbox harvest (Mechanism A; the more general defect)
3. **COLL-02** — run-scope the ephemeral `template_input` (Mechanism B; the more specific defect)
4. **IA-01** — remove composer Harness pill → 2-pill General/Explorer (G-2 sketch fires; keep the lock)
5. **TRIG-01** — Skill Trigger Tuner (held-out trigger benchmark, cross-provider on production model-ids)
6. **TRIG-02 / TRIG-03** — smart-dispatch pre-filter + token budget; description-quality lint
7. **EVAL-01 / EVAL-02 / EVAL-03** — skill eval harness + paired baseline runs + review viewer *(stretch / v3.2)*
8. **PUB-01** — skill publish + global-publish governance gate (closes the Phase-109 deferral) *(stretch / v3.2)*
9. **STD-01 / VER-01** — agentskills.io frontmatter enforcement + standalone skill versioning *(stretch / v3.2)*
10. **DISC-01** — executable skill bundle / "run skill script" *(stretch; sequence strictly after COLL-01)*

**Top 3 risks:**
1. **Scope inflation** — Themes C+D+E are a full "Studio." Commit only A+B+C for v3.1; let D/E be stretch/v3.2.
2. **Collision mechanism is undetermined from code alone — needs live confirmation (DB/logs)** — run COLL-03 before COLL-01/02 or you may fix the wrong surface; both are likely required.
3. **Cross-provider trigger measurement** — TRIG-01 must run on production model-ids and route schemas through per-provider normalization, or it false-greens on one provider and breaks Gemini (the documented multi-type-`type:[...]`-array trap).
