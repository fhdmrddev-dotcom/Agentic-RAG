# Phase 122: Cross-Provider Trust & Honesty Parity - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make structured emission **recovered-or-honest on every provider**, replace
per-provider forcing *guesswork* with **doc-verified declarations**, **measure**
cross-provider reliability on a per-provider scoreboard that **gates any tier
change**, and make task labels **concrete on every provider (OpenAI-parity)** —
all at the **gateway/adapter boundary**, never a shared-path fork.

Four requirements:
1. **MP-01** — a force→coerce **retry ladder** in `forced_emit` so a typed
   emit recovers instead of degrading to a silent empty result.
2. **MP-02** — an explicit, **doc-verified `emit_tier`** per model replaces
   guesswork (drop the inert DeepSeek function-level `strict`; keep GLM forcing).
3. **MP-03** — the eval treats **provider as a first-class axis** with a
   per-provider scoreboard (trigger / force / recovery / honest-fail),
   pass-OR-documented, gating any `emit_tier` change.
4. **TDP-01** — task/step labels are concrete on every provider (an ungated
   prompt nudge fills `execute_code.description` + a deterministic frontend
   summarizer floor backstops the rest), without regressing providers that
   already label well.

**In scope:** the recovery ladder in `forced_emit`; the `emit_tier` registry
declaration + removal of the hardcoded `provider=="openai"` strict gate; the
per-provider scoreboard (extension of `eval_cross_provider.py`) + the
tier-change gate ritual; the ungated `execute_code.description` prompt nudge +
verifying the existing label floor; SC#10 4-axis eval-axis verification.

**Out of scope (this phase):**
- The "Setting up agent…" dispatch-latency banner + **live description before
  `tool_start`** → TDP-02 / **STRETCH Phase 128**.
- **MiniMax malformed tool-args** boundary repair + OpenRouter
  `require_parameters` → MP-04 / **STRETCH Phase 129**.
- Runtime auto-demotion of a model's tier (rejected — see D-122-03).
- A comprehensive per-tool frontend summarizer (deferred unless UAT needs it).
- Local-provider routing fixes (BUG-260616-01) — already owned by Phase 111.1.

**Red line (D-14 / GATEWAY-01):** provider differences live ONLY at the
gateway/adapter boundary; the shared event-stream path is never branched by
provider. **Deep Mode stays byte-identical** on the native-7. No new runtime.

**Through-line:** *honesty is measured, never silently mutated* — the ladder
recovers at runtime and **logs**; the scoreboard **measures**; only a gated,
reviewed change moves a tier.

</domain>

<decisions>
## Implementation Decisions

### MP-01 — Force→coerce recovery ladder
- **D-122-01:** The ladder lives in **`forced_emit` itself**, so EVERY consumer
  recovers — workflow `llm_emit`/`render_template`, the Phase-102 publish-gauntlet
  judge, Phase-103 NL workflow-authoring, AND Phase-111 document metadata
  extraction (which silently extracts nothing on the default `gpt-4o` config
  today). The defect is in the shared path, so the fix belongs there. **Folds
  BUG-260615-01's real-world impact** (default-config extraction unbroken as a
  side effect).
- **D-122-02:** **4-rung ladder, in order:** (1) forced with strict `json_schema`
  *if the model's tier declares it*, (2) **forced NON-strict** (the proven-missing
  rung — OpenAI/DeepSeek/Z.ai `400` on strict TIER-FORCE but accept the same
  schema non-strict per the BUG-260615-01 / Phase-111 repro), (3) **TIER-COERCE**
  (`tool_choice="auto"` + directive + narration recovery — the existing path),
  (4) **honest fail** (the existing `_surface_failure_message` floor; never a
  silent empty or fabricated artifact). Each rung is an already-known-good mode,
  just chained.
- **D-122-03:** The ladder is **pure runtime recovery** — it **never mutates the
  registry**. A model's `emit_tier` changes ONLY through the MP-03 scoreboard gate
  (deliberate, measured, reviewed — "no silent tier flip", SC#3). The ladder MAY
  **log which rung won** (telemetry that feeds the scoreboard) but never acts on
  it. Runtime auto-demotion was **rejected** (it mutates declared capability
  invisibly and makes the scoreboard non-authoritative).

### MP-02 — Explicit, doc-verified `emit_tier`
- **D-122-04:** Add a **single explicit `emit_tier` enum per model** in
  `MODEL_CAPABILITIES` — `force_strict | force | coerce` — that names the
  **ladder's top rung** and is the single source of truth, paired with the
  existing `capability_source` (`registry` = doc-verified vs `inferred`). It
  **replaces** the implicit `forced_emission` + `strict_json_schema` two-bool
  combo **and** the hardcoded `provider == "openai"` strict gate
  (`openai_service.py:1555`). (Planner: confirm enum-vs-derived-view + migration
  cost against the live `config.py` shape; the *intent* — one explicit declared
  value, no provider-name special-casing — is locked.)
- **D-122-05:** An **un-doc-verified model defaults to `coerce`** (the safe floor)
  — never assumes forcing/strict it hasn't verified; promoted to `force` /
  `force_strict` ONLY when the scoreboard proves it. Matches today's default-SAFE
  behavior (`forced_emission` absent → TIER-COERCE).
- **Locked from the requirement (no re-ask):** **drop** the inert DeepSeek
  function-level `strict` (set at `openai_service.py:1548`, never honored —
  `:1555` gate is OpenAI-only); **keep** GLM/Zhipu forcing (intentional,
  live-verified). Scout note: GLM resolves to non-strict **`force`** (no
  `json_schema` response_format is built for it today) — verify live.

### MP-03 — Per-provider scoreboard + tier-change gate
- **D-122-06:** **Extend the existing operator-run `scripts/eval_cross_provider.py`**
  to emit a **dated `.planning/eval/` scoreboard artifact** (`.json` + `.md`) with
  the 4 axes × the locked roster. The **tier-change gate is the existing OPERATOR
  ritual** (D-01/D-04): grep the latest scoreboard before flipping any `emit_tier`,
  attach to VALIDATION.md. Rejected: LangSmith experiments (not load-bearing; pulls
  state out of git-diffable artifacts) and an automated pytest gate (needs live
  cross-provider calls in CI — secrets + flakiness + cost — contradicts the
  localhost-gated pattern).
- **D-122-07:** **"pass-OR-documented" semantics** — each provider × axis cell is
  **PASS / FAIL / DOCUMENTED**, where **DOCUMENTED = an explicit known-limitation
  row in the scoreboard artifact itself** (note + evidence link, e.g.
  "Moonshot/Kimi: coerce-only, genuinely unforceable"). DOCUMENTED clears the gate
  **because the model's declared `emit_tier` already reflects that reality**
  (declared tier == measured reality). The scoreboard IS the record (no mandatory
  cross-file SEED/bug ceremony, though a link is welcome).
- **Locked from the requirement / D-03 (no re-ask):** the **4 axes** are
  trigger / force / recovery / honest-fail; the roster is **native-7**
  (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu, MiniMax) **gates**,
  **OpenRouter is best-effort and never gates**; one representative model per
  provider (SC#10 convention).

### TDP-01 — Concrete cross-provider task labels
- **D-122-08:** **Targeted scope.** The real gap is a **single ungated
  system-prompt nudge** to fill `execute_code.description` (the schema field +
  cross-provider `tool_args_progress` + the deterministic `inferLabel()` floor
  ALREADY exist). So: add the ungated nudge (shared system prompt — helps every
  provider, can only improve well-behaved ones), **keep/verify** the existing
  `inferLabel` floor for code steps, and **prove via SC#10 UAT that NO provider
  shows a bare tool name**. **Extend** the deterministic floor to other tools
  (`search_documents`, `render_template`, …) ONLY if UAT surfaces a bare name.
  Rejected for now: building a comprehensive per-tool summarizer up front (larger
  surface, more regression risk for the providers that already label well).

### Claude's Discretion
- Exact ladder implementation mechanics inside `forced_emit` (single function vs
  small rung-helpers); how the "which rung won" telemetry is emitted/stored for
  the scoreboard — planner/researcher decide, constrained by D-122-01..03.
- `emit_tier` as a literal enum field vs a validated derived view + the migration
  shape — D-122-04 locks the intent, not the mechanism.
- Exact scoreboard artifact schema/columns and how axes are scored — extend the
  established `.planning/eval/` capability-table format.
- The exact wording/placement of the `execute_code.description` nudge in the
  shared system prompt.

### Folded Todos
*(none — the one phase-matched todo `spike-nl-workflow-authoring` was reviewed and
NOT folded; see Reviewed Todos below.)*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 122" — the goal + 5 Success Criteria (what must
  be TRUE), G-5 (gateway/adapter boundary + `agent_loop.py`), SC#10 = EVAL axis.
- `.planning/REQUIREMENTS.md` — MP-01 (L21), MP-02 (L22), MP-03 (L23),
  TDP-01 (L24); STRETCH MP-04 (L45) / TDP-02 (L44); traceability table.
- `.planning/STATE.md` — v3.1 roadmap shape, G-5 hot-file ledger, open-reports
  routing for 122/128/129.

### Live evidence + routed reported-bugs
- `.planning/reported-bugs/BUG-260615-01-pm-pack-seed-and-provider-forcing-findings.md`
  — **FOLD into 122.** The live root-cause for MP-01/MP-02: TIER-FORCE `400`s
  despite `strict=False`, degrades straight to `null` **without a non-strict
  COERCE retry**; default-config (`gpt-4o`) metadata extraction silently produces
  nothing; failing set is **schema-specific**, not a fixed provider list. Pairs
  with SEED-082. *Update frontmatter `folded_into: 122`.*
- `.planning/reported-bugs/non-anthropic-generic-code-task-descriptions.md`
  (BUG-260528-03) — **FOLD into 122.** TDP-01 is the requirement that closes it
  (was parked at 095.1). NOTE: its stated cause (Anthropic-only `tool_args_progress`)
  is **wrong** — extraction is already cross-provider; the real gap is the missing
  ungated nudge. *Update frontmatter `folded_into: 122`.*
- `.planning/reported-bugs/setting-up-agent-hides-model-activity.md` (BUG-260607-02,
  *major*) — **LEFT OPEN.** TDP-01 labels help once a tool runs, but the pre-tool
  dispatch-latency banner + live-description-before-`tool_start` is TDP-02 /
  Phase 128. In the 122 SC#10 blast radius; must not regress.
- `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` (BUG-260607-03) —
  **DEFER → STRETCH Phase 129 (MP-04).**
- `.planning/reported-bugs/BUG-260616-01-local-model-extraction-mis-routes-to-openrouter.md`
  — already **folded into 111.1** (do NOT re-fold). ADJACENT: its fixes #2/#3 sit
  at the *same* `forced_emit.py:251-275` / `openai_service.py:1449-1456` gateway
  seam MP-02 touches — flag for the researcher to avoid stepping on each other.

### Seeds
- `.planning/seeds/SEED-082-*` — emit-gate policy (strict|flag|partial|draft) +
  model-fit routing; the long-standing home for the MP-01/MP-02 direction.

### Code seams (read to ground the plan)
- `backend/app/services/forced_emit.py:205` — `forced_emit(...)`; existing
  TIER-FORCE / TIER-COERCE tiering (`:245-249`), `_COERCE_DIRECTIVE` (`:59-65`),
  `recover_narrated_emission` (`:98-137`), truncation guard (`:348`),
  cross-provider key/base_url injection (`:251-275`), provider-error wrap
  (`:338-345`). **The ladder home (D-122-01/02).**
- `backend/app/services/provider_gateway/{dispatcher,anthropic,google,openai_compat}.py`
  — the gateway/adapter boundary (D-14). `GatewayRequest.force_tool_name` (`:83`)
  + `strict_schema` (`:84`); per-adapter forcing translation.
- `backend/app/services/openai_service.py:1521-1581` — strict/force handling;
  **`provider=="openai"` strict gate at `:1555`** (the residual guesswork
  D-122-04 removes); DeepSeek function-level `strict` at `:1548` (inert — drop);
  DeepSeek thinking-off on forced (`:1521-1526`).
- `backend/app/config.py:136-182` — `ModelCapability` TypedDict (`forced_emission`,
  `strict_json_schema`, `capability_source` — where `emit_tier` lands); `:207-337`
  — the `MODEL_CAPABILITIES` registry; `:380-394` — native-7 / provider sets;
  `:672-682` — sub-agent model defaults (the representative roster).
- `backend/app/services/agent_loop.py:471` — shared `SYSTEM_PROMPT` (the **ungated
  TDP-01 nudge site**). G-5 hot file — touch minimally.
- `backend/app/services/openai_service.py:601-603` — `execute_code.description`
  tool-schema field (already cross-provider).
- `frontend/src/lib/workspacePanel.ts:109-129` — `inferLabel()` (the deterministic
  floor — already exists); `:178-186` — `humanize()` precedence chain
  (`write_todos` > `execute_code.description` > CODE-INFERRED > "Run code").

### Eval substrate
- `scripts/eval_cross_provider.py` — the operator-run, localhost-gated driver to
  **extend** for the scoreboard (D-122-06); PROVIDERS roster at `:82-93`.
- `.planning/eval/` — dated capability-table artifacts + `README.md` (the D-04
  artifact format + operator gate ritual the scoreboard reuses).
- `supabase/migrations/066_eval_coverage_seed.sql` — the `eval_coverage` workflow
  fixture the `--workflow` eval path drives.

### Adjacent locked context
- `.planning/phases/120-collision-fix-context-isolation/120-CONTEXT.md` — D-14 red
  line, Deep byte-identical, gateway-boundary discipline (carried into 122).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`forced_emit` already tiers** (TIER-FORCE / TIER-COERCE, registry-driven) and
  already has narration recovery + a truncation guard + a non-silent honest-fail
  surface. The MP-01 ladder *chains* existing modes (adds the non-strict rung +
  orders them); it is not new emission machinery.
- **`capability_source` already distinguishes `registry` (doc-verified) vs
  `inferred`** — MP-02's "doc-verified" honesty hook already exists; `emit_tier`
  rides alongside it.
- **`tool_args_progress` is already cross-provider** (Anthropic + OpenAI-compat +
  Google all emit it) — TDP-01 does NOT need provider-specific extraction work.
- **`inferLabel()` is already a deterministic, reload-safe label floor** — TDP-01's
  "deterministic frontend summarizer floor" largely exists; the work is the nudge
  + verification, not a rebuild.
- **`eval_cross_provider.py` + `.planning/eval/` + the operator gate ritual** are
  proven (Phase 088/096/120) — MP-03 extends, doesn't bootstrap.

### Established Patterns
- **Gateway/adapter isolation (D-14).** All forcing/strict translation lives in
  the per-provider adapters; the shared `_normalize` event path is provider-agnostic.
  The ladder + `emit_tier` read must preserve this — no shared-path fork.
- **Default-SAFE capability resolution.** Missing capability fields default to the
  safe path (coerce / no-strict) — D-122-05 keeps that posture for `emit_tier`.
- **Operator-run, localhost-gated eval; git-diffable dated artifacts; manual gate.**
  No secrets in CI (D-122-06).
- **Honest-fail, never silent.** `forced_emit` already surfaces every failure via
  `_surface_failure_message`; the ladder makes honest-fail the explicit *floor*.

### Integration Points
- MP-01 ladder: a new orchestration *inside* `forced_emit` between the
  tier-resolution (`:245-249`) and the single sealed gateway call — shared by all
  callers automatically (D-122-01).
- MP-02: `emit_tier` added to `ModelCapability` (`config.py:136-182`), consumed
  where the tier is currently derived (`forced_emit.py:245-249` +
  `openai_service.py:1536-1581`), removing the `:1555` provider gate.
- MP-03: a new report mode/output in `eval_cross_provider.py` → `.planning/eval/`.
- TDP-01: one line in the shared `SYSTEM_PROMPT` (`agent_loop.py:471`) + a UAT
  assertion against the frontend label render.

</code_context>

<specifics>
## Specific Ideas

- The MP-01 non-strict rung is **evidence-pinned**, not speculative: a direct
  repro proved OpenAI ACCEPTS the `emit_document_metadata` schema in non-strict
  mode while the live `forced_emit` TIER-FORCE `400`s and degrades to `null`
  without that retry (BUG-260615-01 §"Phase 111 live UAT extension"). The plan's
  acceptance test should reproduce a strict-400→non-strict-recovery on at least
  one OpenAI-schema-family provider.
- The failing set is **schema-specific** (optional-heavy + `additionalProperties`
  confidence object trips OpenAI/DeepSeek/Z.ai) — the scoreboard's force/recovery
  axes should exercise a representative *hard* schema, not only an easy one.
- SC#10 4-axis UAT applies and is the **eval axis** (MP-03): cross-provider ×
  multi-tool × parallel-thread × long-message; Deep proven byte-identical.

</specifics>

<deferred>
## Deferred Ideas

- **"Setting up agent…" dispatch-latency banner + live `description` before
  `tool_start`** (BUG-260607-02) → TDP-02 / **STRETCH Phase 128**. TDP-01 only
  fixes labels *once a tool is running*, not the pre-tool dispatch window.
- **MiniMax malformed tool-args 400 + OpenRouter `require_parameters`**
  (BUG-260607-03) → MP-04 / **STRETCH Phase 129**.
- **Comprehensive per-tool frontend summarizer** (friendly label + arg-derived
  detail for every tool, not just `execute_code`) → only if SC#10 UAT shows a bare
  tool name (D-122-08).
- **Runtime auto-demotion of a model's tier** → rejected (D-122-03); revisit only
  if the measured-gate ritual proves too slow in practice.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring` (score 0.6, keyword false-positive on
  "trigger"/"first") — **not folded.** NL workflow authoring already shipped in
  Phase 103; the todo is satisfied (per STATE.md deferred-items). Unrelated to
  cross-provider honesty.

</deferred>

---

*Phase: 122-cross-provider-trust-honesty-parity*
*Context gathered: 2026-06-23*
