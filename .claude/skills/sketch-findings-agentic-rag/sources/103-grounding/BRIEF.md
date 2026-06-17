# Phase 103 Sketch-Grounding BRIEF — Workflows Page + NL Authoring

**Project:** Agentic RAG · **Phase:** 103 "Workflows Page + NL Authoring"
**Purpose:** Single authoritative grounding document so a designer can build the next HTML sketches (018+) FAITHFUL to the real system — the real `WorkflowDefinition` schema (6 phase types, 5 validator kinds, the strictness-policy enums), the REAL 8-stage publish gauntlet + `PublishVerdict` ABI, the proven NL-gen + auto-retry shape, and the reuse map against the already-built sketches 012/013 + shared theme. **Mirrors `094-grounding/BRIEF.md`.**

**Honesty flag up front (load-bearing):** the entire authoring/builder surface is **NET-NEW**. There is NO Workflows page, NO builder component, NO read-only graph in `frontend/src` (Glob `frontend/src/**/*orkflow*` → zero files); the only `workflow`-named frontend components are RUN-time (`PhaseTimeline`, `PhaseCard`, `WorkspacePanel`). Backend has NO `create_definition`/`list_definitions`/`update_definition`/draft-CRUD and no NL-gen endpoint — the ONLY live writes are `publish_definition` (status flip) and `create_workflow_run`. The only live HTTP surface is `GET /workflows/published` + `POST /workflows/{id}/publish`. Sketches must be explicit they are proposing the FIRST builder, not re-skinning one.

**The sketches this grounds (018+):**
- **018 requirement-first authoring** — describe the business requirement → AI drafts the workflow AND sets a strictness dial; the grey-area "I read X as Y — confirm?" checkpoint (operator acceptance bar #1)
- **019 draft refine + read-only live graph** — refine-by-FORM (talk available); the read-only phase graph (linear spine + skip branches, NO drag-canvas)
- **020 publish gauntlet honesty** — the 8-stage gate run → judge block as a first-class surface; `PublishVerdict` rendered, never re-derived
- **021 Workflows page** — project-filtered library (drafts + published + CRUD), extending 012; tweak → new version (acceptance bar #2)

**North-star principle (operator-LOCKED):** ONE builder for ANY business requirement across the **strict↔loose spectrum**. Domain-agnostic — PM/legal/finance are example *content*, never baked in. Requirement-first: you describe the *business requirement* and the AI drafts the workflow AND sets a strictness dial; you refine the draft by FORM (talk available). The **publish gauntlet** (lint → real golden run → judge verdict, can honestly BLOCK) is a first-class surface, not a hidden button.

---

## 1. Phase 103 Scope + the 4 Success Criteria (plain language)

Phase 103 builds the surface that lets a user **author and own workflows** — the page to browse/manage them, and the conversation to create them by describing a business requirement.

The 4 success criteria (in plain language; codenames `WFAUTH-01..04`):

1. **WFAUTH-01 — Workflows page + draft CRUD.** A project-filtered library showing your drafts AND published workflows, with create/save/list/delete. Net-new page (no `ActiveView "workflows"` exists today) + net-new backend (`POST /workflows` create, `GET /workflows` draft-list, `PATCH` refine — none exist).
2. **WFAUTH-02 — NL → WorkflowDefinition generation + auto-retry.** Describe a recurring task in plain English; the AI emits ONE valid `WorkflowDefinition` (forced structured output), self-heals on a schema `ValidationError` (re-prompt loop), and **never silently substitutes** on a grey area — it surfaces a confirm checkpoint instead. Net-new (proven only in the throwaway spike `scripts/spike-097/authoring_feel.py`).
3. **WFAUTH-03 — Read-only live graph.** The draft renders as a read-only graph of phase nodes (NOT an editable drag-canvas — operator rejects it). Inspectable, not draggable.
4. **WFAUTH-04 — Project-filtered library + run-from-thread.** Library filters by project folder; Run hands off INTO a chat thread in workflow mode (workflows are a *mode of a thread*, never page-resident). Publish is the QUAL-01 gauntlet; tweak forks a new version.

**G-2 fires** (this phase is sketch-gated): scope mentions a live page, builder, graph, badges, "feels like" — sketch BEFORE spec/discuss. **Operator's two acceptance bars** (from the spike verdict, `scripts/spike-097/out/unknown-d.md:9-63`): (1) a clarify-as-you-go grey-area validation loop with NO silent substitution; (2) post-publish editability/versioning (tweak a published workflow into v2/v3; immutability is per-version).

---

## 2. The LOCKED Design Philosophy

**ONE builder for ANY business requirement across the strict↔loose spectrum.** Not a PM tool, not a legal tool — a domain-agnostic instrument. PM/legal/finance/HR are only example *content* on a card; nothing in the model or UI bakes a vertical in.

**Requirement-first, not phase-first.** The user does NOT assemble phases — they describe the *business requirement* (the recurring knowledge task), and the AI drafts the phases AND sets a strictness dial proportional to the stakes. The single most load-bearing authoring input is the `business_requirement` field (`harness.py:236-239`) — it is the anchor the always-on publish judge grades against, and publish 400s without it (`workflows.py:136-139`).

**Draft-led, refine-by-FORM with talk available.** The AI produces a whole draft (the spike proved one-shot emission works — both spike drafts validated on attempt 1, `scripts/spike-097/out/transcript.md:67,155`). The user refines by editing the *form* (per-phase fields conditioned on phase_type), with a talk rail available for "add a web-search step" style changes. NOT a drag-canvas (operator-rejected, sketch 013 header line 16).

**No silent substitution.** The spike's MIXED verdict was caused by the generator silently guessing on grey areas — it substituted a non-existent "Acme folder" with "Project Meridian — Risks" and mapped a non-existent "/Risks subfolder" onto the whole folder, both presented as settled fact. The grey-area validation loop is the single most important sketch moment.

**The publish gauntlet is a first-class surface.** Publishing is not a button that succeeds — it is a staged gauntlet (lint → real golden run on the project KB → independent judge verdict) that can HONESTLY block. A judge fail is a HARD wall — no "publish anyway" override exists or should be sketched. The verdict is server-authored and machine-renderable; 103 renders it, never re-derives it.

---

## 3. The REAL Product Shapes (what the sketches MUST honor)

### 3.1 The publish gauntlet — 8 ordered stages (NOT 4)

The route is `POST /workflows/{definition_id}/publish` (`workflows.py:96`, router prefix `/workflows` at `:29`). **G-5 RED LINE:** this joins `api/workflows.py`, NEVER `api/threads.py` (`workflows.py:73` docstring). Orchestration in `backend/app/services/harness/publish_service.py` (762 lines) — **NOT** `backend/app/services/publish_service.py` (that path does not exist). It returns a structured dict for every branch — it NEVER raises into the route, so a publish is never a 500 (sealed orchestration).

The Plan-05 SUMMARY's "4-stage" framing is **OUTDATED** — Plans 06-09 added stages. Render THIS order (follow the CODE, not the SUMMARY):

| # | Stage | What it checks | `golden_run_id`? | Block code |
|---|---|---|---|---|
| 0 | owner-check | RLS-resolve + you own it | None | `not_found` |
| 0b | definition valid | re-validates as `WorkflowDefinition` | None | `definition_invalid` |
| 1 | business_requirement | the D-13 invariant — exactly one declared | None | `business_requirement` |
| 2 | structural lint | `lint_workflow` (pure, no I/O) | None | `lint` |
| 2.5 | interactive-phase | `llm_human_input`/`ask_user`-on_failure can't validate synchronously | None | `interactive_phase` |
| 3 | **REAL golden run** | `is_golden_run=True` against the project KB, wall-budget `harness_publish_max_seconds` | **set** | `golden_run_timeout` / `golden_run_error` |
| 3b | structural gate | citations/integrity gate FAILED during the run | **set** | `structural_gate` |
| 4 | **the judge** | independent-model `JudgeVerdict` (the QUAL-01 hard blocker) | **set** | `judge` |
| 5 | the flip | `publish_definition` (`WHERE status='draft'`, concurrent-double-publish guard) | n/a | (`already_published` on race) |

The 10 distinct `blocked_stage` strings the UI must handle (`publish_service.py` lines in parens): `not_found` (72,86), `already_published` (97,310), `definition_invalid` (117), `business_requirement` (130), `lint` (145), `interactive_phase` (168), `golden_run_timeout` (208), `golden_run_error` (222), `structural_gate` (245), `judge` (291). On success `blocked_stage` is `None`.

### 3.2 `PublishRequest` + `PublishVerdict` — the ABI 103 renders (never re-derives)

**Request body = ONE field** (`workflows.py:77-81`): `golden_input: str` — the author's representative kickoff prompt the golden run executes against the project KB (becomes `inputs={'kickoff_prompt': golden_input}`, `publish_service.py:544,583`). The publish modal/drawer is a single prompt textarea + a Publish button, NOT a multi-field form.

**Response = EXACTLY 5 fields** (`workflows.py:84-94`, comment "Machine-renderable for 103"):
```
published: bool
version: int | None = None
golden_run_id: UUID | None = None
blocked_stage: str | None = None
named_failures: list = Field(default_factory=list)
```
- SUCCESS: `{published: True, version: <int>, golden_run_id: <UUID>}` → show version + a "view the golden run" link.
- BLOCK: `{published: False, blocked_stage: <str>, named_failures: [...], golden_run_id: <UUID or None>}`.

**HTTP mapping** (`workflows.py:128-143`) — the client must read the verdict body on a 200 to know pass vs block:
- `not_found` → **404** (uniform; cross-user collapses to the same 404, no existence leak)
- `already_published` → **409**
- `business_requirement` → **400** with the WHOLE structured verdict in `detail` (the D-13 invariant)
- every OTHER block AND success → **200** with the `PublishVerdict` body (the **primary "gauntlet failed" UI** — read `blocked_stage`)
- malformed `definition_id` → **422** (FastAPI path-coercion, a framework error not a verdict)

### 3.3 The judge block — `named_failures` shape (the QUAL-01 centerpiece)

The hard blocker (`publish_service.py:285-294`): after a successful golden run, `_block(stage='judge')` fires when `verdict.get('failure') OR verdict.get('overall_passed') is not True`. There is no override, no opt-out, no mock — the run is REAL and the judge is an INDEPENDENT model (`resolve_judge_model` → `Settings.harness_judge_model`, default `claude-opus-4-8`/`gpt-5.5` — never the run model).

`_judge_named_failures` (`publish_service.py:445-465`) returns EITHER:
- (a) `['the judge produced no verdict (<reason>) — honest failure, not a silent pass']` when the verdict couldn't be produced (model failed to emit / no judge model resolved), OR
- (b) a list of per-criterion dicts `{criterion, score, evidence}` for each criterion where `passed is False`, PLUS a trailing `{summary: <one-paragraph>}`.

So a judge block = **per-criterion critique rows + an overall summary**, NOT prose. `JudgeVerdict` (`validator_kinds.py:103-112`, `extra='forbid'`) has `overall_passed`, `overall_score`, `grounded_in_evidence`, `answers_business_requirement`, `did_the_work_not_delegated`, `criteria: list[JudgeCriterionVerdict]`, `summary` — but those raw booleans are NOT in `PublishVerdict`; they live in the `judge_verdict` governance receipt. **Do NOT render raw `JudgeVerdict` booleans in the verdict card** — render the flattened `named_failures`. Each `JudgeCriterionVerdict` (`validator_kinds.py:88-100`) is `{criterion, passed, score, evidence}` (`evidence` required so OpenAI strict accepts it).

`named_failures` is typed as a bare `list` — heterogeneous per stage: `list[str]` for an honest-failure judge; `{criterion, score, evidence}` + `{summary}` for a per-criterion judge block; lint/interactive carry their own dict shapes. **103's renderer branches on item shape per stage** (open Q: typed discriminated union vs generic key/value render — operator's call, §6).

### 3.4 `WorkflowDefinition` — the phase/edge/field vocabulary the graph + form edit

Top-level (`harness.py:220-239`): `slug`, `version:int`, `name`, `status:Literal['draft','published']='draft'`, `phases:list[PhaseSpec]`, `project_folder_id:UUID|None`, `output_target_folder`, `reingest_output`, `version_policy:Literal['supersede-by-filename','keep-all']`, `provenance`, `inputs:list[InputFieldSpec]|None`, `assets:list[AssetRef]|None`, `business_requirement:str|None`. Every node subclasses `_StrictBase` (`ConfigDict(extra='forbid')`, `harness.py:27-30`) — a hallucinated/typo'd key raises `ValidationError`.

**Edge/topology truth (HONESTY FLAG):** there is **NO `depends_on`, no DAG, no edge model**. `PhaseSpec` (`harness.py:189-193`) is `{slug, phase_index:int, config, validators:list[ValidatorSpec]=[]}`. Ordering is the explicit integer `phase_index` (engine sorts by it, `db/workflows.py:141`). The graph = a **linear spine i→i+1** PLUS every `skip_to_phase:<slug>` parsed out of `validators[].on_failure` (`reachability.py:19-21`). The only non-linear edge is a validator failure-branch. Do NOT draw cross-cutting `depends_on` arrows or parallel lanes — they have no schema backing (`max_parallel_agents` is internal sub-agent fan-out WITHIN one `llm_batch_agents` node, not a graph branch).

**SIX phase types** (the prompt's "5" is stale — `llm_emit` added in 101.1). Discriminated union on `phase_type` (`harness.py:157-167`). The per-phase form is NOT uniform — render conditionally:

| phase_type | Editable fields | Notes |
|---|---|---|
| `programmatic` | `fn` (PROGRAMMATIC_PHASE_REGISTRY key), `input_keys` | no LLM/tools/scope/model |
| `llm_single` | `prompt`, `model`, `temperature`, `folder_scope`, `skill_ref` | no tools/max_steps |
| `llm_agent` | `prompt`, `available_tools` (the per-phase WHITELIST), `max_steps=12`, `wall_clock_seconds`, `model`, `folder_scope`, `skill_ref` | |
| `llm_batch_agents` | + `max_parallel_agents=5`, `merge_strategy:concat\|concat_numbered` | fan-out type |
| `llm_human_input` | `prompt`, `options`, `timeout_seconds=300` | human-pause; no model/tools |
| `llm_emit` | `prompt`, `emitter='render_template'`, `model`, `folder_scope`, `skill_ref`, **`citation_policy`**, **`integrity_policy`** | the deliverable terminus; ONLY type with the policy enums |

`llm_emit` (`harness.py:123-154`) is the sealed forced-emit deliverable node — visually distinct (the only one with the citation/integrity badges + `emitter`).

**Validators are PER-PHASE** (`PhaseSpec.validators`, not workflow-level). `ValidatorSpec` (`harness.py:170-186`): `kind` (9-value Literal), `config:dict={}`, `on_failure:str='fail_run'` (recognized: `fail_run | retry | skip_to_phase:<slug> | ask_user`), `max_retries:int=2`, `timing:Literal['pre','post']='post'`.

**Two model_validators to respect:** any per-phase `folder_scope` REQUIRES `project_folder_id` (`harness.py:241-253`); `skill_snapshot` REQUIRES `skill_ref` (`:255-269`, snapshot is run-time-materialized, `None` on drafts — the builder sets `skill_ref` only).

**Immutable-on-publish:** a DB trigger (`workflow_definitions_block_published_update`) freezes the row once `status='published'`; `publish_definition` is the ONLY flip site (`db/workflows.py:233-255`, double-publish = idempotent no-op returning `-1`). The builder renders a published definition READ-ONLY; a tweak forks a new draft version (`version:int`, per-version immutability).

### 3.5 The strictness-policy mapping (the dial)

The dial is **TWO composed axes**, not one slider: (1) WHICH gates are on (the 5-kind menu), and (2) for the citation/judge gates, WHAT policy value they carry.

**The 5 first-class validator kinds** (`harness.py:178-182` Literal; `validator_kinds.py` `@register_validator` at 191,245,343,381,497) — all real and live:
- `citations_required` — deterministic citation enforcement; mode `deterministic`/`emit` (wraps `check_coverage` over `field_map`, fails on ANY uncited/invented leaf) vs `presence` (counts markers, `min_markers`). (`validator_kinds.py:191-231`)
- `output_file_valid` — re-opens the .docx/.pptx/.xlsx via `assert_integrity`; fails if it won't re-open OR has residual unfilled tags. PDF is a v1 STUB (always passes; real re-open → Phase 106). (`:245-339`)
- `structure_check` — `loose` (default; named-section presence over output TEXT, not the rendered file) vs `strict` (jsonschema over the payload). (`:343-377`)
- `llm_judge_rubric` — an independent LLM judge over forced_emit; fixed `JUDGE_RUBRIC_CORE` (3 baked criteria: `grounded_in_evidence`, `answers_business_requirement`, `did_the_work_not_delegated`) + the `business_requirement` + author criteria woven as DATA; pass/fail is schema-bound `JudgeVerdict.overall_passed`, never regex. (`:381-493`)
- `freshness` — the ONLY NET-NEW kind and the ONLY `timing='pre'` gate; deterministic KB queries over server-resolved `folder_scope`; `config['max_age_days']` MANDATORY (no default — absent fails closed); opt-in `check_versions` finds filename-stem collisions → routes to `ask_user`. (`:497-565`, `freshness.py`)
- (pre-102 primitives also in the menu: `json_schema`, `regex_match`, `workspace_file_exists`, `programmatic`.)

**`citation_policy`** (REAL, LIVE, `llm_emit` only) — `Literal['strict','flag','partial','draft']='strict'` (`harness.py:153`). Governs POST-VERDICT disposition only (the verdict computation is UNCHANGED; `emit_policy.py:1-211`):
- `strict` = honest fail, deliverable NOT produced — "compliance/financial/legal — reject anything unverified"
- `flag` = deliver WITH `' [unverified]'` marks (`_UNVERIFIED_MARK`, `emit_policy.py:54`) + coverage summary — "working-grade"
- `partial` = BLANK uncited values (None, null-over-invent) + a gap list — "data-room"
- `draft` = no enforcement, prepend `'DRAFT — citations not enforced'` (`_DRAFT_LABEL`) — "human reviews"
- RED LINE: every non-strict mode MARKS or BLANKS, NEVER a silent pass; a no-op (zero real leaves matched) falls back to strict honest-fail (WR-06, `emit_policy.py:119-133`).

**`integrity_policy`** (`Literal['strict','documented_limit']='strict'`, `harness.py:154`) — **DECLARED, NOT YET WIRED.** A grep finds it ONLY in the model definition; no executor reads it. The `documented_limit` STRING is computed (`tool_dispatcher.py:1401,1408`) but the policy enum that would switch the gate is unimplemented. **Sketch must flag it greyed / "coming with Phase 106 emitters" OR omit it** — do NOT imply it changes delivery today.

**The publish judge is ALWAYS-ON regardless of per-phase gates.** Per-phase `llm_judge_rubric` is optional; the publish-time QUAL-01 judge (`publish_service.py` stage 4) is a fixed gate the dial CANNOT remove. The sketch must make "loose = no per-phase gate" NOT falsely imply the deliverable escapes the judge entirely.

**Dial presets (plain-language, mapped to REAL enums — these are SEED-082's scenario rows):**
- STRICT (template-fill, every placeholder cited): ALL gates ON — `citations_required`(deterministic) + `output_file_valid` + `freshness`(`max_age_days`) + `llm_judge_rubric`, `citation_policy=strict`.
- MIDDLE (structured cited analysis): `citations_required`(presence) + `structure_check`(loose) + `llm_judge_rubric`, `citation_policy=flag`.
- LOOSE (prose/analysis): judge-only or no per-phase gate, `citation_policy=draft`.

**DO NOT invent labels** like "compliance mode", "lenient", "level 1/2/3", "high/medium/low strictness" — they are NOT in the codebase. Use the real enum values + plain-language captions.

### 3.6 The NL-gen + auto-retry surface

Proven only in `scripts/spike-097/authoring_feel.py` (throwaway). Mechanism: a forced `emit_workflow_definition` tool whose `input_schema = WorkflowDefinition.model_json_schema()` → `WorkflowDefinition.model_validate(raw)` → on `ValidationError`, append the FULL error string ("…extra/unknown keys are forbidden. Validation errors: <err>. Re-emit a COMPLETE, valid WorkflowDefinition…") and re-emit ONCE (`:296-341`).

**TWO distinct honesty surfaces** the sketch must separate:
1. **Drafting-time fail-fast loop** — `extra='forbid'` rejects an invented/typo'd KEY instantly → a transient "caught an invalid field, regenerating…" micro-state that self-heals in <2s, error available on expand. **Be honest: this loop NEVER FIRED in the live spike** (both drafts valid on attempt 1) — it is a designed-for resilience state, not observed-every-time.
2. **Publish-time lint** — catches problems that are valid-as-STRINGS: orphan phase, dangling skip, no terminal, bad index, unsatisfied input key, off-registry tool name. `lint_workflow` (`reachability.py:83-178`) returns `LintError(code, phase_slug, message)`; the 5 codes: `ORPHAN_PHASE`, `UNSATISFIABLE_SKIP`, `NO_TERMINAL`, `BAD_INDEX`, `INPUT_UNSATISFIED`. (An off-registry tool name is a valid string the schema accepts → caught here, not in the drafting loop.)

**Design-time grounding** (4 sources fed to the generator; from the spike, `authoring_feel.py:151-235`): (a) MUST-HAVE — KB folder tree as indented name+id lines; (b) MUST-HAVE — tool registry names+purpose from `get_tools(None)` (the eligible `available_tools` whitelist; spike chose 11 of 24, zero off-registry); (d) MUST-HAVE — template placeholders via `DocxTemplate(...).get_undeclared_template_variables()`; (c) NICE-TO-HAVE — skill registry (spike referenced 0).

**`folder_scope` is a BOUND resolved `list[UUID]`, never a path/prose.** Spoken folder names must be RESOLVED against the real tree at authoring time — a prime grey-area-validation trigger (the spike had "Project Meridian — Risks" but no literal "/Risks" child).

**Open: provider variance.** `CONCLUSION.md` Condition 7 mandates validating the typed emission across the full native-7 + OpenRouter — GLM/MiniMax silently DROP native tool-use (narrate the definition as TEXT); DeepSeek/Moonshot reasoning models truncate the structured emission under token-budget. The "fixing…"/failure UX must honestly cover a provider that CAN'T emit structured output at all, not just a schema typo. Production retry cap is undefined (spike did 1; in-run validators use `max_retries=2`).

---

## 4. Reuse Map (what's BUILT vs NET-NEW)

### 4.1 REUSE-AS-IS — the shared sketch scaffold & theme

- **`themes/default.css`** (Aether Deep Midnight, sourced from `frontend/src/index.css :.dark`): surfaces hsl 216-220, `--color-primary` soft indigo 239°, `--color-accent-violet` 258°, `success`/`warning`/`danger` + `-dim` variants, `--font-headline` Manrope / `--font-sans` Inter / `--font-mono` JetBrains, 4px grid, `radius-sm/md/lg/xl`, animations `fadeSlideUp`/`brandPulse`/`pulseGlow`/`dotBounce`/`checkPop`. **Link `../themes/default.css`; invent NO new tokens.**
- **The scaffold:** `body { padding-top: 52px }`, the sticky `.variant-nav` of `.variant-tab` buttons (★ on the recommended variant), the fixed bottom-right `.sketch-toolbar` (flow/stage toggle + theme `<select>` with only the `default` option). State = a small JS object re-rendered into `#root`/`#shell`. Copy 012/013's exact structure so 018+ sit beside them.
- **Color language (LOCKED):** indigo `--primary` = normal/count · amber `--warning` = pending/Harness/needs-you · green `--success` = done/published · red `--destructive` = error/block. Non-color-alone is mandatory (glyph + text + token).

### 4.2 EXTEND — sketches 012 & 013 already encode the operator's decisions

- **012 (`012-workflows-page/index.html`)** — the Workflows page (BUILD NOW). 3 variants (A card-grid ★, B master-detail, C compact-list); a launch modal collecting kickoff + KB scope; "workflows are a MODE OF A THREAD, never page-resident" (`012:444`); the landed thread REUSES the already-picked 008-D timeline / 009-C chat seam / 011-A composer (`012:402`). The `WORKFLOWS` array (`012:273-295`) already carries `seed`/`draft`/`published`/`shared` source tags + the search/filter toolbar. **021 extends THIS** — add the strictness-tier badge, project filter, drafts shelf, tweak→new-version.
- **013 (`013-workflow-builder/index.html`)** — the NL builder (DESIGN NOW). Talk-led 4-stage (Describe→Drafting→Refine→Published, `013:170-175`); read-mostly vertical phase-card flow; the production per-phase KB scope picker (searchable combobox over a nested folder tree, multi-select emitting folder_ids[], `013:200-264`); the inferred-inputs + asset-upload strip (`013:266-280`); publish→immutable+versioned (`013:320`). **018/019 extend THIS** — add the requirement-first describe + strictness dial, the grey-area checkpoint, the 6th phase type (`llm_emit`), and the read-only GRAPH (013 is a vertical list, not a node-link graph).

**Two stale things in 012/013 to FIX:** both predate `llm_emit` (013 `PHASES`/`PT` map only 5 types) and the strictness vocabulary (`citation_policy`/`freshness`/`business_requirement` appear nowhere). 012/013 also predate the 8-stage publish gauntlet (they show publish as a binary success).

### 4.3 NET-NEW (flag honestly in every sketch)

- The live React Workflows page, nav entry, `ActiveView "workflows"` — none exist (`App.tsx:9` union is `chat|documents|skills|settings|library-health`). Nav is a `useState<ActiveView>` ternary (NOT react-router), duplicated across `NavPanel.tsx`/`ChatLayout.tsx`/`AppDock.tsx` — adding "workflows" = extend the union + add to 3 arrays + 1 ChatLayout branch.
- Draft-create / draft-list / definition-update / NL-gen backend — none exist. `GET /workflows/published` (`workflows.py:42`, owner-scoped, optional `project_folder_id`) and `POST /workflows/{id}/publish` are the ONLY routes. The builder's save/refine loop has no server surface yet.
- The read-only node-link graph — no graph lib installed (Grep `reactflow|dagre|d3|cytoscape` over `frontend/src` → zero deps). The current live render is a vertical accordion (`PhaseTimeline`→`PhaseCard`, `<ol>/<li>`). The graph is genuinely new surface.

### 4.4 REUSE — the run-surface vocabulary the graph nodes should borrow verbatim

`PhaseCard.tsx:41-77` already owns an AA-accessible per-node status+type vocabulary: phase-type glyphs+labels (programmatic ⚙ "Server step", llm_single ✎ "AI write step", llm_agent 🤖 "AI agent step", llm_batch_agents ⛓ "Parallel agents" + violet left-border `:293`, llm_human_input ☺ "Needs you") + 6 statuses (pending ○ Locked, running ● + indeterminate progressbar `:332-342`, done ✓, failed ✕, retrying ↻ "Attempt N", skipped ⤳). Non-color-alone is mandatory. The graph node carries: [type glyph+label] [status atom] [scope chip if `folder_scope`] [skill chip if `skill_ref`] [gate chip if `validators` non-empty] — all REAL fields, no invented badges.

---

## 5. Borrowable Read-Only-Graph Patterns (peer products, cited)

The graph is a **read-only execution/definition graph**, NOT an editable build canvas. Topology is a mostly-linear spine + occasional `skip_to_phase` failure-branches — so x/y are computable from `phase_index` with NO layout lib (plain HTML/CSS node cards + ONE `<svg>` edge overlay; the Dagster foreignObject idea inverted).

- **GitHub Actions visualization graph** (closest peer): LEFT-TO-RIGHT flow; each job a rounded-rect pill with the status ICON to the LEFT of the name; edges are simple lines; real-time updates; click-node-to-open-logs (not edit). Borrow: LTR layout + icon-left-of-name + click-to-detail.
- **Temporal** (color/line vocabulary, zero-JS-buildable): GREEN=completed, solid-RED=failed, DASHED-RED=retrying, DASHED-PURPLE=pending; pending animates via dashed lines moving forward (marching-ants `stroke-dashoffset`) — the cleanest "live progress along the edge". Retry icon carries the attempt number.
- **Dagster** (`scaling-dag-visualization`): node = React inside SVG `<foreignObject>` (HTML/CSS node chrome, SVG edges); horizontal LTR default for compactness, vertical op-graph fallback; asset-checks condense to terse "x / y" with tick/cross; edge culling (draw only between visible nodes).
- **n8n** (read-only execution canvas): view-only is the SAME canvas with connection handles removed + drag disabled (`isCanvasReadOnly`), not a different widget; per-node execution-state + item-count badges. Borrow: "view-only = same graph minus build affordances."
- **Prefect** (static vs live distinction): `flow.visualize()` (static, before/after) vs Schematics (live); a per-state count roll-up ("4 done / 1 running / 2 pending") above the graph.
- **Airflow** (Graph view): LTR DAG, box-fill-color = state with an explicit STATE LEGEND beside it (we layer glyph+text on top for non-color-alone), auto-refresh recolors live.

**Honest caption:** "edges = run order (i→i+1) + failure branches (`skip_to_phase`)" — NOT "depends_on". Default LTR (offer a vertical variant since the spine is mostly-linear and vertical reads well). NO graph library will be added (plain HTML/CSS/SVG).

---

## 6. Key Decisions for the Operator (the genuine forks to confirm before building)

These are real ambiguities the sketches expose — confirm at sketch-review so the chosen variant becomes the acceptance bar.

1. **Strictness dial shape:** the dial is TWO axes (gate-on/off menu + a 4-stop `citation_policy` segmented control). Render as composed controls, OR collapse into named presets (STRICT/MIDDLE/LOOSE) that pre-set the gate menu? And: does the dial expose `citations_required` `presence` vs `deterministic` mode, or hide it behind the preset?
2. **`integrity_policy`:** show it greyed "coming with Phase 106", or omit entirely? (Declared-not-wired today.)
3. **Grey-area validation shape:** inline checkpoint cards in the chat stream, a batched "review these N assumptions" panel before first draft, or per-field confirm chips on the rendered draft? (The acceptance bar — operator picks the shape.)
4. **`named_failures` renderer:** a typed discriminated union per stage (lint vs interactive vs judge shapes), or a generic key/value render of each dict? (Affects how rich the gauntlet honesty card can be.)
5. **Synchronous publish long-wait UX:** publish is blocking up to `harness_publish_max_seconds` (a real provider golden run). Does 020 need a "publishing… running golden run on your KB" progress state? (Background-job publish is DEFERRED — sync long-wait is a real 103 design problem.)
6. **Graph orientation + scope:** LTR vs vertical? And does the graph render the STATIC definition (all phases planned, Workflows page), the LIVE run (recolors as it streams), or both as a mode toggle? Should the new graph REPLACE the run-time vertical `PhaseTimeline`, or stay a Workflows-page-only surface (G-5: avoid re-touching recent 094/101.1 `PhaseTimeline`/`PhaseCard`)?
7. **Card grid (012-A ★) vs vertical card-list (what `SkillsPage` actually ships):** which is the canonical Workflows-page layout? They diverge today.
8. **Scope of 103:** build BOTH the page (021) and the NL builder (018/019), or page-first? 012 was BUILD-NOW, 013 was DESIGN-NOW/build-v2.9 — confirm the time-horizon now that 103 is active.
9. **Provider for NL-gen + retry cap:** which model drives the generator (forced tool_choice Anthropic-style vs OpenAI strict-schema), how many auto-retry rounds before an honest "couldn't generate a valid workflow" terminal state, and does the "fixing…" UX cover a provider that can't emit structured output at all (GLM/MiniMax tool-drop, DeepSeek/Moonshot truncation)?
10. **`folder_scope` resolution UI:** the builder needs the live enumerable registries (tool names from `get_tools`, `PROGRAMMATIC_PHASE_REGISTRY` fns, `EMITTER_REGISTRY` keys, per-validator-kind config schemas) surfaced to the frontend to render dropdowns instead of free-text — these live in backend services, not `harness.py`. Confirm they'll be exposed.

---

## 7. Per-Sketch Design Implications

### 018 requirement-first authoring (describe → AI drafts + sets the dial)
**Must honor:** the describe box collects a *business requirement* (free text), NOT a phase list; `business_requirement` is a REQUIRED, prominent field (publish 400s without it). The AI emits ONE whole `WorkflowDefinition` (one-shot proven) — show a "composing your workflow…" working state, then the draft appears whole (do NOT narrate phases token-by-token unless labeled not-yet-proven). The AI ALSO sets a strictness dial proportional to stakes (§3.5 presets). The grey-area checkpoint is the centerpiece: every unresolvable folder ref / vague scope / unmapped placeholder / missing tool surfaces as an "I read X as Y — confirm or correct?" card the user clears before the field binds — NO silent substitution. Auto-repair is a transient "caught an invalid field, regenerating…" micro-state (honest: never fired live).
**Builds on:** 013 (talk-led describe/refine, inferred-inputs strip).
**Risk:** over-promising a live per-phase drawing animation (the generator is one-shot — the draft appears whole, not drawn step-by-step).

### 019 draft refine + read-only live graph
**Must honor:** refine-by-FORM, conditioned on phase_type (§3.4 table) — programmatic shows {fn, input_keys}; llm_emit shows {prompt, emitter, citation_policy, integrity_policy}; do NOT show a tools/model picker on programmatic or llm_human_input. The graph is a LINEAR spine (LTR or vertical), node per `PhaseSpec` by `phase_index`, solid edges i→i+1, the only branch a dashed `on fail → <slug>` (`skip_to_phase`). Nodes inspectable NOT draggable — no connection handles, no drag, no '+' add-affordance on the canvas; a "View only" label. Reuse `PhaseCard`'s node vocabulary verbatim (§4.4). Show ALL SIX phase types incl. the visually-distinct `llm_emit` deliverable terminus. Grounding-review surface: every folder ref as the REAL name+bound id; `available_tools` as real registry chips; template placeholders as the fill contract.
**Builds on:** 013 (scope picker, phase cards, inspector) + 5 peer graph patterns (§5).
**Risk:** drawing a richer DAG than exists (no `depends_on`, no parallel lanes) — keep the spine honest.

### 020 publish gauntlet honesty
**Must honor:** the publish form = ONE `golden_input` textarea + a Publish button (§3.2). Show the 8 REAL ordered stages (§3.1), NOT 4. The block-reason chips = the 10 REAL `blocked_stage` strings; render each stage's `named_failures` VERBATIM (server-authored, do not re-derive). The judge BLOCK card (QUAL-01 centerpiece) shows per-criterion `{criterion, score, evidence}` rows + the one-paragraph summary; an un-producible verdict shows the single "honest failure, not a silent pass" line. The "open the golden run" affordance ONLY appears when `golden_run_id` is non-null (stage 3 succeeded — no run on pre-run blocks). Distinguish the 200-block (read `blocked_stage`) from 404/409/400/422. A judge fail is a HARD wall — NO "publish anyway" button; communicate "fix and re-publish" (a fresh golden run + judge each attempt).
**Builds on:** 012's publish action (upgrade from binary to staged) + the real `PublishVerdict` ABI.
**Risk:** rendering raw `JudgeVerdict` booleans (they're in the receipt, not the verdict) or promising a run link where there is none.

### 021 Workflows page (project-filtered library + drafts/published + CRUD)
**Must honor:** project-filtered library (drafts + published), backed by `GET /workflows/published` (real) + net-new draft-list/CRUD (flag as net-new). Each card: name, source tag, the ordered phase chain with type badges + tool chips + the entry phase's `input_keys`, AND a strictness-tier badge derived from the gate set (§3.5). Run hands off INTO a thread (workflows = a mode of a thread). A "tweak → new version" path: opening a PUBLISHED workflow forks v2/v3 (immutable per-version) — make "this publishes a NEW version" explicit, never an in-place edit. A new "Workflows" nav entry (net-new).
**Builds on:** 012 (card grid ★ / master-detail / compact-list, search+filter, launch handoff) + `SkillsPage` 3-pane pattern (header + right-aligned CTA, 3-pulse skeleton, centered-icon empty state).
**Risk:** inventing endpoints (no draft-CRUD/unpublish/single-GET exists) or promising the card grid when `SkillsPage` ships a vertical list (the 012-A vs list divergence — operator fork §6.7).
