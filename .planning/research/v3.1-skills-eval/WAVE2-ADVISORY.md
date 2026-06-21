# v3.1 Research — WAVE 2 ADVISORY ADDENDUM

**App:** Agentic RAG (repo root `C:/Vibe Apps/Agentic RAG`, branch `v2.5-dev`) · **Scope:** integrates the 5 Wave-2 dimension findings (multi-provider reliability, context/memory, task-description parity, Workflow Studio UX, self-improving agents) into one advisory. Wave 1 covers the Anthropic skills model, skill-creator, the collision, chat IA, and the first scope — **not re-derived here**.

**Verification note:** every load-bearing claim below was spot-checked against live source this session, then run through three adversarial verdicts; corrections are folded in. Confirmed: GLM rows all carry `forced_emission: True` (`config.py:310-316`) with `strict_json_schema` deliberately ABSENT and flagged "verify strict live" in-comment (`config.py:306-309`) — this is a **documented TIER-FORCE-via-OpenAI-compatible-tool_choice decision, not an accidental over-claim** (D-15, `config.py:306-307`); `execute_code.description` is optional, `required:["code"]` only (`openai_service.py:601-604`, `:632`); `toolSummary` reads `args.description` for execute_code (`toolMeta.ts:26`); `skill_versions`/`current_version_id`/`skill_modes` = **0 hits** in `supabase/full-schema.sql` (planned-but-unbuilt — the v3.1 PRD's own spine, see §5.4); messages table has **no** `origin`/`run_type` column; `SEED-041` status = `dormant`; the v3.1 PRD marks "Skill auto-improvement via meta-eval" Out of Scope (`v3.1-skill-studio-eval.md:135`). **Conflicts/uncertainties are flagged inline with ⚠; anything resting on live-UAT or external docs rather than code is tagged "needs live confirmation (DB/logs/provider test)".**

**One sequencing correction up front:** the authoritative version map is `.planning/PRDs/SEQUENCE.md`, NOT the slot numbers buried in each PRD body. v3.1 = **Workflow + Skill Eval Studio**; v3.2 = **Operator UX (admin shell + secrets + deployment presets)**. The `v3.1-skill-studio-eval.md` file body is the pre-resequence Skill-Studio brief (still the correct capability), and `v3.2-operator-ux.md` body still carries stale internal "v3.1" labels — read SEQUENCE.md, not the bodies. This matters for the WUX routing in §6 (see §4.5 and §6.4).

---

## 1. MULTI-PROVIDER STRATEGY

### 1.1 The architecture is sound; three defects narrow the "heavy-lifting" set

The app routes every model through `MODEL_CAPABILITIES` (`config.py:207-337`) + `get_model_capability()` (`config.py:464`), with `resolve_calling_mode()` (`openai_service.py:1416`) splitting NATIVE (API `tools` param) from STRUCTURED (JSON-in-prompt via `tool_parser.py`). The provider gateway dispatches `anthropic`/`google` to native adapters and everything else to `openai_compat` (`dispatcher.py:73-127`), with the **forcing translation living only in the 3 adapters** — the D-14 RED LINE (no `if provider ==` forcing branch in the shared chunk/SSE path). This is the correct shape and must not regress. Verified accurate against source.

### 1.2 Per-provider capability tiering (codebase flags × official docs)

| Provider | Force named tool? (docs) | Structured output (docs) | Registry today | Heavy-lift tier | Citation |
|---|---|---|---|---|---|
| **OpenAI** | Yes | `json_schema` strict (verified) | `forced_emission✓ strict✓` | **force-strict (gold)** | Only provider we send strict `response_format` (`openai_service.py:1555` gates json_schema to `provider=="openai"` ONLY) |
| **Anthropic** | Yes `{"type":"tool"}` | Forced tool use (no token-schema) | `forced_emission✓` | **force (gold)** | Force translation at `anthropic.py:71-75`; forcing errors under extended thinking → emit runs thinking-OFF |
| **Google/Gemini** | Yes `mode=ANY` | FC; rejects anyOf/oneOf **AND** multi-type `type:[]` | `forced_emission✓ max_tools16` | **force (schema-care)** | Both handled at `_sanitize_schema_for_google` + `_translate_nullable_type` (`google_service.py:256-309`) |
| **DeepSeek (v4)** | **No in thinking mode → 400** | `json_object`; FC-`strict` Beta, NOT `response_format:json_schema` | `forced_emission✓` + **function-level** `strict✓` only ⚠ | force-when-thinking-off → else coerce | function-level `strict:True` IS set (`openai_service.py:1548`), but token-level `json_schema` response_format is **already gated OFF** for DeepSeek (`openai_service.py:1555` — would 400; we force thinking-OFF on emit) |
| **MiniMax (M2/M3)** | Docs show only `auto` (needs live confirm) | No `json_schema` documented | `forced_emission✓` (no strict) | force (no strict) | Interleaved-thinking needs full reasoning preserved; large args → 400 (`minimax-m3-invalid-tool-args-400.md`) |
| **Moonshot/Kimi (K2)** | **No — "model decides / or no tool"** (needs live confirm) | None documented | `forced_emission` **absent** ⇒ COERCE (`config.py:330-331`) | coerce (chat-strong) | Genuinely unforceable — coerce is correct; rows deliberately leave `forced_emission` ABSENT (default SAFE) |
| **Zhipu/GLM** | docs.z.ai unverified-here; **code = deliberate TIER-FORCE** | `text`/`json_object` doc'd; `json_schema` **unverified** | all rows `forced_emission✓` (intentional D-15) ⚠ **strict UNVERIFIED, not contradicted** | **force (verify live before any change)** | `config.py:306-310` — forcing is a DOCUMENTED decision; only `strict_json_schema` is the unverified item (already correctly ABSENT) |
| **OpenRouter** | Yes — IF upstream supports + `require_parameters=true` | `json_schema` strict IF `require_parameters` | conditional `forced_emission✓` (Kimi rows ABSENT) | route-dependent | `config.py:321-336` already encodes the conditional; forcing adapter MUST send `provider.require_parameters=true` |
| **Ollama/LM Studio** | Unreliable | Varies | `native_tools=False` | coerce / no | Local; forced_emit injects local key+base_url |

### 1.3 The three concrete defects (`BUG-260615-01`)

- **(A) No non-strict COERCE retry on a TIER-FORCE 400 — highest ROI.** The shared force path raises → returns `provider_error` with **no non-strict retry ladder** and **degrades straight to null** (`forced_emit.py` raise path → `openai_service.py:1534` strict-handling). This structural gap is **code-confirmed**. The specific *"gpt-4o + DeepSeek v4-pro + GLM-4.6 all 400 on the Phase-111 metadata schema, yet OpenAI accepts the same schema non-strict"* result is a **live-UAT/`BUG-260615-01` observation — needs live confirmation (provider test); the exact failing-provider set is NOT code-derived.** What IS code-derived: there is no force→coerce fallback, and the failing set is **schema-specific, not a fixed provider list**. Default extraction model is gpt-4o → **silent no-metadata** until fixed.
- **(B) Registry strict/forcing flags need live verification — but the GLM "should be coerce" verdict OVERREACHED and is corrected here.** ⚠ The factual observation is correct: every `glm-*` row is `forced_emission: True` (`config.py:310-316`) and `strict_json_schema` is deliberately absent. But `forced_emission` for GLM is a **documented TIER-FORCE decision** (`config.py:306-307`: "GLM/Zhipu is TIER-FORCE via OpenAI-compatible tool_choice"), NOT an accidental over-claim. The genuinely-unverified item is **`strict_json_schema` only** (already correctly ABSENT, with the in-code comment "verify strict response_format live"). **Do NOT flip GLM `forced_emission`→coerce on a docs reading alone** — the rows reflect an intentional choice; live-verify GLM forcing via the MP-03 scoreboard FIRST. For DeepSeek, the `strict` story is smaller than the original draft implied: the token-level `json_schema` response_format is **already disabled** for DeepSeek (`openai_service.py:1555`), so "drop DeepSeek strict" only means dropping the function-level `strict:True` flag (`openai_service.py:1548`) — **low live blast radius**. ⚠ needs live confirmation (provider test) before any row change.
- **(C) DeepSeek/Gemini honest-fail FORCE-tier emit** on some deliverable schemas — honesty holds (no silent `.docx`), but they miss the bar. 4/7 providers produced clean cited `.docx` in Phase-104 UAT (live-UAT observation).

**What already works and must be kept:** default-SAFE tier resolution (registry miss ⇒ coerce, never wrongly forces — `config.py:174`); `recover_narrated_emission` (`forced_emit.py:98`); `is_truncated` rejection; provider-raise → honest `provider_error`; cross-provider key/base_url injection for judge shots.

### 1.4 Cross-provider design rules for v3.1

1. **Promote the implicit tier to an explicit, doc-verified field** `emit_tier: force-strict | force | coerce`. **force-strict** = OpenAI only; **force** = Anthropic, Google, MiniMax, OpenRouter-when-`require_parameters`, **and GLM (it is an intentional TIER-FORCE — keep forcing, verify strict live)**; **coerce** = Kimi, Ollama/LM Studio, DeepSeek-in-thinking. **Do NOT drop GLM forcing on docs alone.** For DeepSeek, dropping the function-level `strict:True` is low-impact (token-level json_schema already off).
2. **Add the non-strict retry ladder** (fixes A): on a force-tier 400, retry once forcing-without-strict → then coerce → then honest-fail. Keep the never-prose-as-artifact guarantee. This is the top-ROI item.
3. **OpenRouter: always send `provider.require_parameters=true`** when forcing/requesting json_schema (`config.py:321-325` already documents this; verify the adapter actually sends it).
4. **Service-boundary repair for MiniMax malformed-args** (`minimax-m3-invalid-tool-args-400.md`) — a tool-args-JSON coercion at the MiniMax boundary, never a shared-path change.
5. **Skill triggering is a tier concern.** For weak triggerers (Google under-triggers per `google-skills-not-loading.md`; reasoning models narrate-instead-of-call) strengthen the catalog prompt per-provider and/or force `load_skill` on a strong model for harness skill phases. Treat **skill-authoring + eval as strong-model-only**; weak models consume skills.

### 1.5 What stays SHARED vs what branches

- **SHARED (never fork):** canonical event stream + SSE wire format, `_drain`/chunk handler, `tool_calls_buffer` construction, finish/usage normalization, the agent loop, `tool_dispatcher` handlers, and the **tool schemas themselves** (`get_tools()` is Deep byte-identical).
- **BRANCHES (adapter/sanitizer boundary only):** force-tool translation (the 3 adapters), Google schema sanitization, DeepSeek `reasoning_content` round-trip, MiniMax args repair, per-provider emit tier. This matches the CLAUDE.md service-boundary rule.

### 1.6 Eval Studio: provider as a first-class axis

**Provider is NOT a first-class eval/routing axis today** — `emit_policy.py` has no provider branch (P1 finding). v3.1 should: run the **same skill/workflow eval across the provider set** and report a **scoreboard** of per-provider **trigger-rate, force-success-rate, narrated-recovery-rate, honest-fail-rate**. Acceptance = **pass-OR-documented per provider** with graceful degradation as the net (the Phase-111 SC#4 model). **This scoreboard is also the safety net for §1.3(B): run it BEFORE flipping any registry tier, so a row that "happened to work" can't silently regress.** Curate `_SUB_AGENT_MODEL_DEFAULTS` (`config.py:672`) per provider's eval tier — workflow phases run via sub-agents, so the request `model` does not steer them (096 Pitfall 1). This wires the existing SC#10 4-axis cross-provider UAT mandate *into the eval*, not just manual UAT.

---

## 2. CONTEXT & MEMORY

### 2.1 How the app remembers today

**Stateless by design** — full thread history is stored and resent every turn (no provider-side thread state). Per turn, `run_agent_loop` loads the entire thread (`agent_loop.py:1024-1030`, user-scoped, ordered, **no LIMIT**), builds the system prompt fresh, and augments it in-place with folder-scope, skills catalog (`:1065-1075`), user memory (`:1087-1096`), and disabled-tools notes.

**The only ceiling defense is drop-oldest truncation** — `trim_messages_to_fit` (`context_window.py:151-229`): system msg always kept, last `reserve_recent`=10 always kept, **atomic tool-pair removal** (`_remove_oldest_atomic`, `:251-306`) prevents orphaned-tool 400s, a synthetic `[…trimmed…]` marker is inserted, and a Phase-078 hard floor degrades to `system + last 1 msg` rather than ever erroring. It runs **twice** (pre-loop `:1131-1135` + **every iteration** `:1427-1431`), emitting `system_warning kind=context_truncated` on each trim.

**Cross-thread memory** — `user_memory(user_id, key, value)` with RLS (`026_user_memory.sql:5-20`), strictly **per-user, not per-thread**. `remember` upserts (`tool_dispatcher.py:1188-1228`); `recall` reads on demand (`:1231-1273`); **top-10 most-recent** memories auto-injected into the system prompt every General run (`agent_loop.py:1077-1096`). Cross-thread bleed is **intended and bounded to the same user** (RLS-enforced, no cross-USER bleed).

### 2.2 Gaps (cited, verified)

1. **No compaction anywhere — drop-oldest is lossy.** The model literally forgets early turns mid-conversation; on long skill/workflow chats this silently degrades quality. SEED-041 is the planted fix, **status confirmed `dormant` this session**.
2. **Skill instructions are trimmable.** `load_skill` returns `{instructions, files:[filenames]}` — full instructions **plus a filename MANIFEST only, not file bodies** (`tool_dispatcher.py:655-702`). This lands as a normal `tool` result in mutable history → subject to drop-oldest → a long skill can be **trimmed out from under a multi-turn skill session** exactly when the thread is busiest.
3. **`read_document` has no cap.** `read_path` returns the FULL `full_markdown` when no line range is given (`kb.py:385-449`) — the premise's "3k cap" does NOT exist here; persisted result is `[:2000]` but the in-context body is full. One big read can trigger a trim cascade.
4. **Non-OpenAI token estimation is chars/4.** tiktoken is used **only** for `provider=="openai"` (`context_window.py:94-117`); Anthropic/Google/DeepSeek/Kimi/GLM/MiniMax are all budgeted with a crude heuristic — trims fire too early/late on the very providers the operator wants to support equally.
5. **No Deep/Harness context isolation at the data layer — the collision.** ⚠ **CONFIRMED:** the `messages` table has **no `origin`/`run_type`/`mode` column** (verified 0 hits). Harness writes final answers, failure reasons, and ask_user rows into the **same `messages` table via the same `insert_assistant_message`** (`harness_engine.py:416-519`). `_reconstruct_history` reads everything ordered by `created_at` (`agent_loop.py:723-809`), so the next Deep turn sees prior harness output as ordinary chat — and vice-versa. The only discriminator is the `kind` field *inside* `tool_calls` JSONB for `system` rows.
6. **Auto-recall is recency-only, capped at 10** (`agent_loop.py:1078-1084`) — no relevance ranking; >10 facts lose the oldest, irrelevant facts crowd the prompt every turn.

### 2.3 Recommendations (priority order)

- **A. Ship SEED-041 rolling summarization** — when the trimmable head must go, summarize it into a recap block kept right after the system prompt instead of deleting it. Research Anthropic's native context-management config first (vendored-but-unused `beta_context_management_config_param.py`); app-level summarization fallback for non-Anthropic; one UX, per-provider adapters at the service boundary. **Single highest-leverage fix for skill quality + multi-turn coherence.**
- **B. Protect loaded-skill instructions from trimming** — pin the active skill's instructions into a non-trimmable region, or re-inject each turn from the skill row rather than relying on history retention.
- **C. Add a mode discriminator** (`messages.origin = deep|harness`) and let `_reconstruct_history` filter/compact the other mode's rows. Keep the shared *thread* (product wants one), but stop replaying the other mode's internals verbatim. **This is the surgical fix for the collision** — minimal migration, sits in `_reconstruct_history` (`agent_loop.py:723-809`).
- **D. Cap/paginate `read_document`** at a token budget with explicit continuation; make in-context body match persisted truncation.
- **E. Per-provider token estimation** — Anthropic/Google token-count endpoints (or better heuristics) instead of chars/4.
- **F. Relevance-ranked auto-recall** + artifact-reference replacement (large stored tool results become `see artifact X` pointers, SEED-041 deliverable 3).

---

## 3. TASK-DESCRIPTION PARITY

### 3.1 Root cause (one sentence)

The concrete "what's being done" text per tool call is a **model-authored tool argument** (`execute_code.description`, `write_todos[].content`, `task.description`) — the frontend never synthesizes it from the tool name; **OpenAI looks richer only because it reliably fills the *optional* `execute_code.description` arg**, while weaker/reasoning providers leave it empty on heavy prompts, and the system prompt contains **zero** instruction to fill it (it actively says "do NOT narrate, keep text minimal").

### 3.2 Evidence (verified this session)

- The only "concrete task description" surface is `args.description` for execute_code — `toolSummary` returns `args.description` (`toolMeta.ts:26`); absent ⇒ falls back to bare-verb `toolLabel` ("Executing code", `toolMeta.ts:18`). Renders at `ToolCallPanel.tsx:670, 846-848, 940-945` and `ExecuteCodeBody.tsx:284-286`.
- The arg is the **model's output**: `execute_code.description` is defined "Shown to the user while the code runs" and is **optional** (`required:["code"]` only — `openai_service.py:601-604, 632`). It reaches the UI verbatim via `StreamsProvider.onToolStart` arg-spread (`StreamsProvider.tsx:443, 487`).
- **It's reliability, not a wire-format gap — empirically confirmed:** captured `scripts/.sse_after_run1/{openai,anthropic,deepseek,google,moonshot,minimax,zhipu}.json` shows **all seven providers** emit a good `description` on a *simple* run; the gap appears on heavy/reasoning prompts.
- **The prompt is the lever:** `agent_loop.py:537-548` says "do NOT narrate / keep text minimal" and **nowhere** instructs filling `description` (the only "description" hits at `:641/:651` are STRUCTURED-mode schema rendering in `_format_tool_list`). ⚠ The SYSTEM_PROMPT is **explicitly unified** — `agent_loop.py:600-601` comments "Applies uniformly to OpenAI, Anthropic, Google, OpenRouter, Ollama — all providers see this same SYSTEM_PROMPT (unification principle)," and there is **zero** existing `provider ==` branch in prompt assembly.
- `write_todos.content` (`:918`) and `task.description` (`:955`) are **required** — present-or-call-fails, a different failure mode (out of scope). Harness `PhaseSpec.name/label` (`harness.py:189-206`) are authored at publish time → **provider-independent → out of scope, don't touch**.

### 3.3 Recommended cross-provider fix (corrected gating predicate)

- **A (ship first) — prompt the model to always fill `description`, UNGATED for all providers.** ⚠ **Correction to the original draft:** do NOT gate this on `provider != openai`. (1) The SYSTEM_PROMPT is deliberately unified (`agent_loop.py:600-601`); a `provider !=` gate would introduce the **first** provider branch into a documented-unified prompt — crossing an architectural line. (2) The SSE captures show OpenAI **already** fills `description` reliably, so an explicit "ALWAYS set the `description` field" sentence is a **no-op-at-worst for OpenAI and cannot regress it**, while it DOES reach Anthropic/Google/MiniMax/Zhipu/DeepSeek — exactly the providers that drop it on heavy prompts. An `!= openai` gate would perversely keep the instruction ON for those weak-on-heavy providers (which is what you want) but invites a future reader to "simplify" it to OpenAI-only and breaks unification for no benefit. **Add one ungated reinforcement sentence near `agent_loop.py:537-548`.** Low risk, pure prompt text; reasoning models follow explicit "ALWAYS set X" far better than inferring optional args.
- **C (backstop, pairs with A) — deterministic frontend summarizer.** When `description` is missing, derive a label from `args.code` (leading comment / first def / `output_files` extension → "Generating .pptx") and `args.libraries`. **Zero cross-provider risk** (pure frontend, never regresses OpenAI). This is the spike-007 / D-095.1-02 precedence-chain heuristic. Spec exactly as drafted.
- **D (follow-on) — stream `description` live** by partial-JSON extract before `tool_start`. ⚠ This is **more feasible than the draft claimed**: `description` is the FIRST schema key (`openai_service.py:601`, before `code` at `:605`), and the `setting-up-agent-hides-model-activity.md` evidence shows a long args-streaming window — so a partial-JSON extract surfaces `description` early in a real, evidence-pinned window. Fixes the preparing-window honesty hole.
- **B NOT recommended** — making `description` required raises args-emission burden exactly where MiniMax/Gemini/reasoning models already fail; converts "generic label" into "call rejected."

**Sequencing: A + C together** (A, ungated, lifts rich-label rate across DeepSeek/Kimi/GLM/Anthropic/Google; C guarantees no generic "Executing code" for a code step), D as a follow-on for the live moment.

---

## 4. WORKFLOW STUDIO UX

### 4.1 Crowding diagnosis — emergent, not one bad component

The build is faithful to the Phase-103 sketches; the problem is each sketch optimized its surface in isolation for **honesty + control**, and nobody owned the cross-surface **"what is this workflow, in one breath"** question. Concrete crowding centers (all presentation over data that already exists):

- **A. Workflows page leaks the implementation** (`WorkflowsPage.tsx`): a permanent honesty banner with raw `GET /workflows/published` + `<NetNewFlag>` pills (`:421-426`), endpoint-as-chip (`:512-517`), counts + net-new flags (`:476-482`), and ~7 info bands per card (emoji+name+`v{n}`+tier+draft/published pill+`PhaseChain` with **uppercase `phase_type` ribbons on every node** (`:175`)+`entry needs <keys>`+two buttons). **There is no description/purpose field on the card.** The type ribbon is the exact mistake sketch 029 deleted on the filter builder.
- **B. Publish gauntlet shouts schema, not status** (`PublishGauntlet.tsx`): 8 verbose stage boxes wrapping into a grid (`:264-290`) instead of the reference's compact pip strip with the wait as hero; `VerdictFields` renders all 5 raw field names as a mono grid + "rendered verbatim from server" footer (`:192-209`) — debugger output to a business user; `golden_input` shown as uppercase mono (`:396-400`).
- **C. Builder header/form busy** (`PhaseSpineGraph.tsx`, `PhaseFormPanel.tsx`): a verbatim read-only legend on every render (`:126-141`), raw `phase_type` + `phase_index` as primary node text (`:196-214`), and **two** guidance layers per field (always-visible `help` + hover `ⓘ`) so a 6-field form becomes ~18 lines; a greyed `integrity_policy` "coming in Phase 106" field shown to every author (`:696-707`).
- **D. Run surface** — architecture is right (panel owns the spine, `WorkspacePanel.tsx:188-189`; chat stays quiet, `SeamPointer.tsx`) but **density is wrong**: per-row `oneLiner` type-education repeats on every idle card every run (`PhaseCard.tsx:43`) — calm-at-rest became chatty-at-rest; the chat receipt is so thin it just points "see panel," forcing the user to hold two surfaces.
- **E. Root cause — no "soul" object exists.** `business_requirement` is already stored on `BuilderDefinition` but **surfaced NOWHERE**. Every surface re-derives fragments (`entryInputKeys`, `tierForDefinition`, `PhaseChain`) and renders them as separate dense bands; nothing composes them into purpose + shape + guarantee + output.

### 4.2 The "soul of a workflow" — five things, data already exists

| Soul element | One-line answer | Source (already in def) |
|---|---|---|
| What it does | Purpose sentence | `business_requirement` — shown nowhere today |
| What it needs | "your kickoff prompt · reads Vendors KB" | `input_keys` + `project_folder_id` |
| Its shape | quiet 4-6 dot spine, glyph-only | `phases` by `phase_index`, strip type ribbon |
| Its guarantee | one tier chip `🔒 Strict` | `deriveTier()` (single source of truth) |
| What you get | "committee_brief.docx (cited)" | the `llm_emit` phase's `emitter` + template |

**One soul object, rendered in three sizes** — card / run-header / publish-summary. Everything else (raw `golden_input`, 8-box grid, 5-field verdict, `phase_index`, `phase_type` chips, route chips, honesty banner, `integrity_policy`) becomes **progressive disclosure** — second-screen for the governance-minded author, not first-screen for everyone.

### 4.3 Strict ↔ loose, progressively disclosed (the operator's core ask)

Two doors into the same engine, keyed off the existing `deriveTier` STRICT/MIDDLE/LOOSE — a **disclosure policy, not new schema**:
- **LOOSE — "Describe & run":** describe box → AI draft → **soul card** → Run. The gauntlet still runs behind the scenes but shows a single calm "Checking it works…" hero + plain pass/block ("Blocked: the AI couldn't cite 3 figures. [See why] [Fix]"). Verbatim verdict lives behind "See why."
- **STRICT — "Author & govern":** today's full surface (read-only spine + per-phase forms + gate menu + verbatim gauntlet + route provenance), reached via an "Advanced" toggle. **Nothing removed — demoted one click.**

### 4.4 G-2 sketch passes to run (revisions of existing winners, not greenfield)

Per guardrail G-2 (live UI / "feels like" / visual → sketch before spec):
1. **036 — The Soul Card** (revisit source 021): purpose-led card, glyph-dot spine without type ribbons, one tier chip, output line, details-on-expand. Acceptance: a stranger reads "what + what I get" in 3 seconds.
2. **037 — Strict↔Loose two-door authoring** (revisit 018+019): describe box → soul preview → Run vs Advanced; single guidance layer; legends behind `ⓘ`.
3. **038 — Gauntlet: wait-as-hero, verdict-in-words, schema-on-demand** (revisit 020): pip strip + worded pass/block + "Show raw verdict" disclosure (preserves the verbatim honesty contract without leading with it).
4. **039 — Run receipt carries the soul; panel spine calm-at-rest** (revisit 022): receipt = soul + live status; panel = working detail; strip idle-card type-education.

**Almost all of this is a re-skin over existing data** (~1-2 phases). The only re-architecture is the `disclosureLevel` derived from tier threaded through Builder/Page/Gauntlet — a state/props change, not a data-model change. ⚠ **Hot-file caution:** `PhaseTimeline.tsx`/`PhaseCard.tsx` are shared with the live harness run (G-5-adjacent, touched 094/101.1) — change idle-card density carefully and re-run harness replay tests.

### 4.5 Where this lands (routing — see §6.4)

⚠ The Workflow Studio "soul" re-skin is **operator/author-facing legibility work**, but it does **not** cleanly map to the v3.2 slot just because that slot is named "Operator UX." Per `.planning/PRDs/SEQUENCE.md` + `v3.2-operator-ux.md` §1/§3, v3.2 "Operator" = the **IT person who deploys and administers** the system (admin shell + operator role tier, install wizard, deployment presets, secrets, `model_capabilities_overrides` editor) — NOT the business user authoring/running workflows. So the WUX cluster needs an explicit routing **decision**, not a name-match inference (resolved in §6.4).

---

## 5. SELF-IMPROVING AGENTS

### 5.1 Anthropic's stance (cited) — direction yes, autonomy no

- **Self-improvement is explicitly FUTURE-TENSE:** *"Looking further ahead, we hope to enable agents to create, edit, and evaluate Skills on their own"* — "hope to," not shipped ([anthropic.com/engineering/equipping-agents…with-agent-skills]). ⚠ This single external quote could not be re-verified against any cached copy in the repo this session — **needs live confirmation (web)**; but the load-bearing "autonomy no" weight rests on the locally-verified skill-creator SKILL.md below, so the conclusion stands even if the blog wording were paraphrased. What IS shipped is **human-directed** iteration ("ask Claude to capture its successful approaches"; "ask it to self-reflect").
- **The skill-creator is Anthropic's own reference loop** (`screenshots/skill-creator-extracted/SKILL.md`, verified verbatim) and warns hard about overfitting: *"if the skill works only for those examples, it's useless… try branching out"* (SKILL.md:298); a **60/40 train/held-out split selected by test score** (SKILL.md:394); **human review FIRST** ("GENERATE THE EVAL VIEWER *BEFORE* evaluating inputs yourself," SKILL.md:451); the **"Principle of Lack of Surprise"** (SKILL.md:111-113).
- **The memory tool** (`memory_20250818`) is **cross-session context retention, NOT weight/skill learning** — the same family as our `remember/recall` + `user_memory`. Anthropic's "agent memory" ≠ self-improving skills.
- **Reward-hacking research** ([anthropic.com/research/emergent-misalignment-reward-hacking]): optimizing against a hackable grader produces **broader misalignment as a side effect** — the strongest reason to keep any judge-loop bounded, observable, human-gated. **Industry consensus** (OpenAI/Google): persistent memory yes; closed-loop autonomous self-modification no.

### 5.2 Bounded human-in-the-loop loop on our primitives

We have the substrate: skill-creator methodology, the Phase-102 judge + golden-run **hard publish blocker** (`publish_service.py`), immutable-on-publish snapshots + CAS + immutability trigger (`skill_snapshot.py` + migration 067) — **but for WORKFLOW definitions, not skills**. ⚠ **Confirmed schema gap this session:** `skill_versions`/`current_version_id`/`skill_modes` = **0 hits in `full-schema.sql`** — that table (PRD SKILL-VER-01/02, planned migration 054) must be **built first**; the loop is a layer on top of it. **Note (§5.4): this is the v3.1 PRD's own spine, not net-new beyond it** — it is planned-but-unbuilt, not undiscovered.

```
1. RUN     skill vs saved eval_case set (eval_runner, run-backed Redis stream)
2. EVAL    programmatic assertions + Phase-102 llm_judge rubric + message_feedback
3. PROPOSE sub-agent drafts a DESCRIPTION/INSTRUCTIONS diff → skill_versions row, published_at=NULL (DRAFT, mutable, never live)
4. APPROVE human sees before/after diff + train vs HELD-OUT scores + judge verdict → approve/reject/edit
5. PUBLISH on approval only: published_at=now(), flip current_version_id, immutability trigger locks it (mirror Phase-099 / SKILL-VER-02 migration 054 trigger)
```
**Step 3 produces a DRAFT only; there is NO path from "agent proposes" to "live" without step 4 — hard-enforced by the DB immutability trigger the PRD already specifies (SKILL-VER-02).**

### 5.3 Risks → guardrails (each maps to an Anthropic caution)

| Risk | Guardrail | Anthropic basis |
|---|---|---|
| Overfitting to a few evals | Score on **held-out 40% split**, never train; show both numbers; require held-out not-regress | SKILL.md:298, :394 |
| Reward-hacking the judge | Judge is a **gate, never a reward signal the proposer optimizes in a loop**; single-shot propose→human-approve | emergent-misalignment paper |
| Drift / one-sided optimization | Keep should-trigger AND should-not-trigger cases; regression-check old eval_cases | "one-sided evals create one-sided optimization" |
| Silent auto-publish | **No auto-publish, ever** — draft = `published_at NULL`; immutable only on explicit approve | skill-creator human-first + lack-of-surprise |
| Runaway loops/cost | Reuse `EVAL_MAX_DURATION_SEC`; one propose-cycle per human turn | D-066 run-budget discipline |
| Cross-user contamination | `skill_versions` RLS inherits skill ownership; eval cases user-private | RLS rule (EVAL-SCHEMA-01) |

**Loop verdict:** safe and bounded — no defects found. This is consistent with the v3.1 PRD §10-entry-4, which rejects an **automatic** meta-agent proposer; the human-gated description proposer is a different, narrower thing.

### 5.4 Sequencing

- **v3.1 CORE:** the eval+versioning **foundation** — `skill_versions` table + immutability trigger (SKILL-VER-01/02), `eval_cases`/`eval_runs`/`eval_run_outputs`/`eval_feedback`, `run_skill_eval`, judge-over-skill-output reuse. ⚠ **Framing correction:** this is **the v3.1 PRD's existing spine, NOT net-new beyond it.** The PRD already scopes all five tables (EVAL-SCHEMA-01 / line 107), the `skill_versions` full column spec (line 157), `skills.current_version_id` (line 160), the immutable-on-publish trigger (SKILL-VER-02 / line 213), and an entire multi-phase roadmap around them. "0 hits in full-schema.sql" means **planned-but-not-yet-built**, not "undiscovered scope." Independently valuable; already PRD-scoped — and large enough to be most of a milestone by itself.
- **v3.1 STRETCH (single bounded slice):** the **human-in-the-loop DESCRIPTION proposer** (steps 3+4, **description field only** — lowest blast radius: changes triggering not behavior; skill-creator already ships a portable 60/40 description optimizer). Feature-flagged, default off.
- **LATER (a future slot):** instruction-body auto-proposal, multi-iteration loops, anything resembling autonomous re-propose-until-pass. ⚠ **The v3.1 PRD explicitly marks "Skill auto-improvement via meta-eval" Out of Scope** (`v3.1-skill-studio-eval.md:135`, confirmed this session; rationale at §10 entry 4) — respect that line; these need accumulated eval-data ground truth and carry the reward-hacking/drift risk.

---

## 6. v3.1 SCOPE IMPACT — ranked candidate requirements (CORE vs STRETCH), top risks, and a recommended split if the whole is too big for one milestone

### 6.1 Candidate requirements (ID · one-liner · tier · leverage)

| ID | One-liner | CORE/STRETCH | Leverage | Effort |
|---|---|---|---|---|
| **MP-01** | Non-strict force→coerce **retry ladder** in forced_emit (fixes the silent-no-metadata 400 on the default extraction model) | **CORE** | ★★★★★ | S |
| **MP-02** | Add explicit doc-verified `emit_tier` field; **drop DeepSeek function-level `strict`** (low-impact — token json_schema already off); **KEEP GLM forcing** (intentional D-15), live-verify GLM strict only | **CORE** | ★★★★ | S |
| **MP-03** | Eval Studio treats **provider as a first-class axis** — per-provider scoreboard (trigger/force/recovery/honest-fail rates), pass-OR-documented acceptance; **gate any MP-02 row change behind this** | **CORE** | ★★★★ | M |
| **MP-04** | MiniMax malformed-args boundary repair + OpenRouter `require_parameters` enforcement | STRETCH | ★★★ | S |
| **CTX-01** | **Mode discriminator** (`messages.origin`) + `_reconstruct_history` filter — fix the Deep/Harness collision | **CORE** | ★★★★★ | M |
| **CTX-02** | Ship **SEED-041 compaction** (summarize trim-head instead of deleting) | STRETCH | ★★★★★ | L |
| **CTX-03** | **Pin loaded-skill instructions** out of the trim window | **CORE** | ★★★★ | S |
| **CTX-04** | Cap/paginate `read_document` + per-provider token estimation | STRETCH | ★★★ | M |
| **CTX-05** | Relevance-ranked auto-recall (replace recency-top-10) | STRETCH | ★★ | M |
| **TDP-01** | **Ungated** prompt nudge to fill `execute_code.description` (A) + deterministic frontend summarizer floor (C) | **CORE** | ★★★★ | S |
| **TDP-02** | Stream `description` live before `tool_start` (D) — fixes the preparing-window honesty hole | STRETCH | ★★ | M |
| **WUX-01** | The **soul card** + soul-object-in-three-sizes (surface `business_requirement`, strip type ribbons/index/legends) | **CORE** | ★★★★★ | M |
| **WUX-02** | **Strict↔loose disclosure policy** keyed off `deriveTier` (two-door authoring) | **CORE** | ★★★★ | M |
| **WUX-03** | Gauntlet pip-strip + worded verdict + raw-on-demand; quiet idle PhaseCards | STRETCH | ★★★ | M |
| **SI-01** | `skill_versions` table + immutability trigger + eval foundation (eval_cases/runs/run_outputs/feedback, run_skill_eval, judge-over-skill) — **the PRD's existing spine** | **CORE** | ★★★★★ | L |
| **SI-02** | Human-in-the-loop **description-only proposer** (feature-flagged, default off) | STRETCH | ★★★ | M |

### 6.2 Ranked by leverage (the must-haves)

1. **MP-01** (silent-no-metadata is a live correctness bug on the default model — tiny fix, huge ROI; the structural gap is code-confirmed, the exact provider set needs live confirmation per `BUG-260615-01`)
2. **CTX-01** (the collision is a structural correctness issue, surgical fix)
3. **SI-01** (the eval+versioning foundation — everything self-improving and the provider scoreboard depend on it; this IS the PRD spine)
4. **WUX-01 / WUX-02** (the operator's core "soul + strict↔loose" ask; mostly re-skin over existing data — routing decided in §6.4)
5. **TDP-01** (visible cross-provider parity win, low risk, ungated)

### 6.3 Biggest risks

- ⚠ **MP-02 doc-vs-registry tension — but smaller and more nuanced than first stated.** GLM `forced_emission` is a **documented decision (D-15), not a contradiction** — do NOT flip it on docs alone. DeepSeek `strict` is mostly inert (token json_schema already gated off). The genuinely-unverified items are GLM/DeepSeek **strict** behavior only. Mitigate by making the **MP-03 per-provider scoreboard the safety net BEFORE any row flip** — needs live confirmation (provider test).
- ⚠ **SI-01 is large and gated on a net-new (planned) table** (`skill_versions` does not exist yet — 0 hits confirmed). It is the PRD's own 5-table + trigger + multi-phase spine, so it is realistically **most of a milestone by itself** — under-counting it cascades into SI-02.
- ⚠ **CTX-02 (compaction) is the highest-effort, highest-leverage gamble** — Anthropic's native context-management is vendored-but-unused; the per-provider summarization fallback is real work and touches the hot `context_window.py`/`agent_loop.py` trim path.
- ⚠ **WUX hot-file risk** — `PhaseTimeline.tsx`/`PhaseCard.tsx` are shared with the live harness run (re-run harness replay tests on any density change).
- ⚠ **WUX routing risk** — do not assume v3.2 absorbs it (§4.5 / §6.4): v3.2 "Operator UX" is IT-admin/deployment, not workflow-author legibility.

### 6.4 Honest sizing — this is too big for one milestone

The five themes carry **~16 candidate requirements across three substantial substrates** (provider/eval backend, context/memory engine, Workflow Studio UX) plus the planned skill-versioning + eval foundation. **This "too big" verdict is independently corroborated, more strongly than a leverage count alone:** the v3.1 PRD **ALONE** scopes the eval+versioning core (= SI-01) across five tables, an immutable-publish trigger, three agent tools, dual-execution streaming, and a multi-phase roadmap — i.e. SI-01 is already most of a milestone **before** any of MP/CTX/TDP/WUX is added. Layering a provider-reliability backend, a context engine + migration, task-parity work, and a multi-phase UX re-skin on top is unambiguously overstuffed.

**Recommended split:**

- **v3.1 (Workflow + Skill Eval Studio — keep the PRD's spine):** **SI-01** (foundation), **MP-01/MP-02/MP-03** (provider reliability + the eval provider-axis — these *belong* with eval and make it trustworthy), **CTX-03** (pin skill instructions — directly serves skill quality). STRETCH if room: **SI-02** (description proposer), **MP-04**.
- **The WUX cluster (WUX-01/02/03) + TDP-01/02 — route by an explicit DECISION, not a slot-name match.** ⚠ Do NOT auto-route to v3.2 on the strength of the name "Operator UX": the v3.2 PRD's actual content is admin shell / install wizard / deployment presets (IT-operator), not workflow-author legibility. Three honest options, operator picks:
  - **(a)** explicitly **re-scope v3.2** to absorb workflow-UX legibility (a real planning decision, recorded — not a naming inference), or
  - **(b)** give the **WUX/TDP legibility cluster its own slot** (e.g. a dedicated author-UX milestone), or
  - **(c)** if the operator insists the "soul + strict↔loose" ask lands in v3.1, take **only WUX-01 + WUX-02 as CORE** and defer WUX-03 + all TDP. (The operator's ask is emotionally a v3.1 want; this is the in-v3.1 fallback.)
- **Context:** **CTX-01 (collision)** is small enough to ride in v3.1; **CTX-02 (compaction)** is large enough to warrant its own scoping — recommend **CTX-01 in v3.1, CTX-02 as a standalone candidate for a later slot**, with CTX-04/05 as backlog.

**Bottom line:** v3.1 should stay the Workflow + Skill Eval Studio it's scoped as, *plus* the provider-reliability fixes intrinsic to making eval trustworthy (MP-01/02/03, with GLM forcing untouched and any tier flip gated behind the MP-03 scoreboard) and the small structural fixes that serve skill quality (CTX-01, CTX-03). The Workflow Studio "soul" re-skin (WUX) and the context-compaction engine (CTX-02) are each large enough to anchor their own slot — and WUX's destination is a routing DECISION, not the v3.2 name.

**Key absolute paths for any v3.1 work:** `backend/app/config.py` (registry `:207-337`, GLM TIER-FORCE note `:306-310`, `get_model_capability` `:464`, sub-agent defaults `:672`), `backend/app/services/forced_emit.py` (narration recovery `:98`, raise→provider_error path), `backend/app/services/openai_service.py` (forcing `:1458-1626`, function-level strict `:1548`, json_schema-OpenAI-only gate `:1555`, calling-mode `:1416`, schema `:601-633`), `backend/app/services/dispatcher.py` (native/openai_compat split `:73-127`), `backend/app/services/anthropic_service.py` / `anthropic.py:71-75` (force translation), `backend/app/services/google_service.py:256-309` (schema sanitization), `backend/app/services/agent_loop.py` (trim sites `:1131-1135`/`:1427-1431`, `_reconstruct_history` `:723-809`, memory/catalog inject `:1077-1096`, unified prompt `:537-548`/`:600-601`), `backend/app/services/context_window.py` (trim engine `:151-229`, tiktoken-OpenAI-only `:94-117`), `backend/app/services/harness_engine.py` (harness persist `:416-519`), `frontend/src/lib/toolMeta.ts` (`:18`/`:26`), `frontend/src/providers/StreamsProvider.tsx` (`:443`/`:487`), `frontend/src/pages/WorkflowsPage.tsx` + `frontend/src/components/workflows/{PublishGauntlet,PhaseFormPanel,PhaseSpineGraph}.tsx`, `screenshots/skill-creator-extracted/SKILL.md`, `.planning/PRDs/SEQUENCE.md` (authoritative version map), `.planning/PRDs/v3.1-skill-studio-eval.md` (eval/versioning spine; out-of-scope `:135`; SKILL-VER-02 trigger `:213`), `.planning/PRDs/v3.2-operator-ux.md` (IT-operator scope — NOT workflow-author UX), `.planning/seeds/SEED-041-conversation-compaction.md` (dormant), `.planning/reported-bugs/{BUG-260615-01-pm-pack-seed-and-provider-forcing-findings,minimax-m3-invalid-tool-args-400,non-anthropic-generic-code-task-descriptions,google-skills-not-loading,setting-up-agent-hides-model-activity}.md`.
