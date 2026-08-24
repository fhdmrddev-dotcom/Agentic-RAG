# Phase 196: Registry-Backed Model Picker (canvas) - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

**A step's model is chosen from the live registry, never typed — and the control the user turns is
the control the code obeys.**

The anchor capability (AUTH-04) is the canvas step form: the four free-text `AI model` inputs in
`frontend/src/components/workflows/PhaseFormPanel.tsx` — `llm_single` (`:876`), `llm_agent` (`:912`),
`llm_batch_agents` (`:965`), `llm_emit` (`:1067`) — become registry-sourced pickers, backed by a
server-side refusal and a run-time enabled check the harness has never had.

⚠ **THE ROADMAP'S CANVAS-ONLY SCOPE FENCE IS DELIBERATELY WIDENED BY OPERATOR DECISION (2026-08-17),
AND THAT IS RECORDED AS A DECISION RATHER THAN SMUGGLED IN.** The ROADMAP `Flags` line for this phase
reads *"the app-wide model single-source sweep (SEED-040 / SEED-088) is explicitly OUT; the canvas /
workflow surface only."* At discuss-phase the operator folded **two open reported bugs** that live on
other surfaces (Settings and the chat composer). The reason they belong together is one root, not
convenience: **all three are a model control that lies about what will actually run.** A typed model
box that nothing validates, a judge knob whose value the judge never reads, and a composer picker
that silently reverts are the same defect wearing three faces.

**What stays OUT, unchanged:** the app-wide model single-source-of-truth sweep (SEED-040 / SEED-088)
beyond these three surfaces; judge *fitness* as a capability facet (see D-16); branching the model
selection into per-workflow defaults; any change to the `coerce` default (D-122-05 is correct).

**In scope, stated as three surfaces:**

| # | Surface | Driver |
|---|---|---|
| 1 | Canvas step form — registry-backed picker, server refusal, harness enabled-check, `llm_emit` fitness | **AUTH-04** (the phase requirement) |
| 2 | Settings judge knob — route the four consumers to DB-backed settings so the knob is not inert | **BUG-260731-01** (folded, `severity: critical`) |
| 3 | Chat composer — a thread restores its own last-used model | **BUG-260718-04** (folded, `severity: major`) |

</domain>

<decisions>
## Implementation Decisions

### Which list IS the live registry

- **D-01 (LOAD-BEARING): a NEW non-operator union endpoint is the picker's source.** Neither shipped
  list is "the live registry", and this was **measured, not reasoned**:

  | Source | ids | What it misses |
  |---|---|---|
  | `MODEL_CAPABILITIES` (code) → `GET /settings` `verified_models` | **61** | all **8** DB-only ids |
  | enabled `model_capabilities_overrides` (DB) → `GET /me/preferences` `allowed_models` | **34** | **35** code-registry ids |
  | **overlap** | **26** | — |

  - `allowed_models` alone cannot offer `claude-sonnet-5`, `gpt-5.5`, `gpt-5.6-sol/terra/luna`,
    `gpt-4o`, `o1` — ⚠ **including `gpt-5.5`, the model SEED-135 MEASURED as the working judge.**
  - `verified_models` alone cannot offer the 8 DB-only ids: `claude-opus-5`, `gemini-3.6-flash`,
    `gemini-3.7-flash`, `glm-4.7-flash`, `kimi-k3`, `nvidia_nvidia-nemotron-nano-9b-v2`,
    `openai/gpt-oss-20b`, `qwen/qwen3.8-max` — ⚠ **that set contains ALL THREE local LM Studio rows
    (SEED-172) and `gemini-3.6-flash`, the exact id SEED-135 measured silently degrading a run to
    `coerce`.** A picker blind to the model that caused the seed is not a fix.
- **D-02: the union logic is COPIED, not invented.** `_registry_row` +
  `get_model_registry` (`backend/app/api/admin.py:1054-1149`) already computes exactly this union
  (DEF rows ∪ OVR rows ∪ DB-only rows, with `enabled`/`deprecated`/`capability_source` per row). The
  new route reuses that composition. ⚠ **`GET /admin/models` itself CANNOT be reused** — it sits
  behind the router-level `require_operator` gate and returns a byte-identical **404** to a normal
  author (`admin.py:1051`, SC#4 / D-149-09). The gate is correct and must not be widened.
- **D-03: measured union size is 69** (61 + 8). Research should re-derive rather than trust this
  number — it moves whenever an operator adds a registry row.

### Blank, disabled, and unknown values

- **D-04: blank stays `""` on the wire — ZERO data change.** Measured: **257 phases across 242
  workflows; 239 (93 %) store no model at all**, and the 18 that do all store the SAME value,
  `gpt-5.4` — which is registry-known (`config.py:268`, `emit_tier: force_strict`) **and** enabled in
  the DB registry, so it survives under any candidate list. **The migration burden of this phase is
  one distinct value.**
- **D-05: blank is a NAMED first option, not an empty slot** — `Use the run's model`. It leads the
  list, following the `JudgeModelPicker` idiom where the auto/default option leads.
- **D-06 (HONESTY): the inherit option's label carries the hedge; it does NOT assert a fixed
  default.** Measured at `backend/app/services/harness/phase_types.py:393-395`:

  ```python
  def _effective_model(phase, ctx) -> str:
      """The per-phase model override or the run's inherited model."""
      return getattr(phase.config, "model", None) or getattr(ctx, "model", "") or ""
  ```

  A blank step inherits **the model the run was started with** — knowable at run time, *not* at
  authoring time. So the copy names the mechanism AND the current value: *"Runs with whatever model
  starts the run — today that would be `gpt-5.4`."* ⚠ **A bare `Effective: gpt-5.4` footer (the shape
  both shipped pickers use) would assert a fixed default the code does not implement — which is the
  exact class of lie this phase exists to remove.** ⚠ **Reading recorded for correction:** the
  operator selected *"Named inherit option"* for the storage question and *"Hedge it explicitly"* for
  the honesty question; the orchestrator's reading is that **the hedge lives in the option's own
  label rather than in a separate 🔒 footer card**, stated to the operator at discuss-time and not
  contradicted. A planner may ship a separate footer instead **only if it carries the same hedge**.
- **D-07: a DISABLED model (`enabled=false`) is NOT offered, but is KEPT if already stored** as
  `(current)`. Measured: **3 disabled rows today**, e.g. `gpt-5.2`. This is the idiom both shipped
  pickers already use (`JudgeModelPicker.tsx:74,98`, `ModelDefaultPreference.tsx:69,~`). ⚠ **The form
  must NOT rewrite a stored value as a side effect of being opened** — viewing a workflow is not
  editing it.
- **D-08: an UNKNOWN model (in neither list) is kept as `(current)` AND names its consequence** —
  SEED-135's ask, in user words not engine words: *"not in the registry — forced emission
  unavailable, document steps run best-effort."* Measured: **zero phases are in this state today**,
  so this is future-proofing, not repair. Saving is **not** blocked (an operator retiring a registry
  row must not make existing workflows unsaveable).

### How hard the refusal is (SC#2)

- **D-09: client list + SERVER rejection on the workflow save path.** Measured: `config.model` is
  validated by **nothing** — not on save, not at publish, not at run. A client-only list would reduce
  SC#2 to *"cannot be selected through the form"*, which is weaker than the criterion's words and is
  bypassable by any direct API call. Precedent to mirror: `PUT /me/preferences` already refuses a
  model outside its allowed-set with a 400 (`me_preferences.py:87-96`).
- **D-10: the harness gains the enabled-check it has never had.** Measured: `_resolve_enabled_model`
  (`backend/app/services/run_model_resolution.py:35`, Phase 149 D-149-10) exists **only** on the chat
  `send_message` path (called at `:239`, reached from `api/threads.py`). `_effective_model` hands the
  per-phase string **straight to the provider with no check**. Route the per-phase model through the
  same shipped resolver: a disabled model falls back to the run's model **with an honest notice**,
  exactly as chat already does. ⚠ **Without this the picker is honest and the runtime still is not** —
  a workflow authored before this phase can still burn a run on a disabled model in silence.
- **D-11: the AI-draft path is VERIFIED, then left alone.** `grep '"model"'
  backend/app/services/workflow_authoring.py` → **zero hits**, so the drafter appears to emit no
  `config.model` and blank is the correct draft behaviour (it inherits the run's model). ⚠ **Research
  must CONFIRM this rather than inherit it** — the phase says so explicitly rather than assuming.
  Having the drafter *choose* a fit model is **OUT** (it collides with AUTH-02 / Phase 197).

### Fitness at pick time (SEED-135)

- **D-12: fitness is annotated on `llm_emit` ONLY.** That is where the bar is real and where the
  measured failure happened (run `da5541c0`). Other step types get a plain list. ⚠ **Annotating every
  AI step was rejected on a reason, not a preference:** on `llm_single`/`llm_agent` the tier predicts
  nothing, and a warning that predicts nothing trains people to ignore the ones that do.
- **D-13: `emit_tier` goes on the wire.** Measured distribution over the 61 registry rows:
  **17 `force_strict` · 39 `force` · 5 `coerce`** — plus every unregistered id, which defaults to
  `coerce` (D-122-05, correct and unchanged). ⚠ **`emit_tier` has NEVER been sent to the client:**
  `grep -rn "emit_tier" frontend/src` returns exactly one hit, a prose comment at
  `ProviderScoreboard.tsx:19`. The data exists; it has simply never travelled.
- **D-14: `emit_tier` is ADDED to the DB overlay list in the SAME phase.** Measured at
  `backend/app/config.py:717-718` the overlay copies only
  `llm_call_timeout_seconds, context_window_tokens, max_output_tokens, native_tools, deprecated`.
  ⚠ **So all 8 DB-only models — including every local LM Studio row — read `coerce` forever and an
  operator has no knob to correct it.** SEED-135 calls this *"a one-line prerequisite that belongs in
  the same commit as any surfacing work — otherwise the surface tells the truth about a value the
  operator has no way to correct."* The Model Registry tab's editable-column set
  (`_MODEL_CAP_COLUMNS`) is the other half.
- **D-15: engine words never become user words.** SEED-085's two-audience rule applies verbatim: the
  surface says *"can fill a document"* / *"best-effort only"*; the ⌥ Technical-names reveal says
  `emit_tier: force_strict`.
- **D-16: judge FITNESS stays OUT — and the reason is a measurement gap, not scope tidiness.**
  `gemini-3.5-flash` is `emit_tier: "force"` and registry-known, and it **still** returned
  `provider_error` with a null verdict. So `emit_tier` is *necessary but not sufficient* for the judge
  role. SEED-135 rates its own `$defs`/`$ref` schema-stripping hypothesis **MEDIUM** and states it has
  **NEVER been live-verified**, forbidding any document from citing the cause as fact until someone
  dumps the sanitized Google tool payload. **Do not build a fitness facet on an unverified
  hypothesis.** What this phase DOES fix is the judge *wiring* (D-17).

### Folded bugs

- **D-17 — `BUG-260731-01` (`severity: critical`, CONFIRMED 2026-08-17): route the four judge
  consumers to DB-backed settings.** Measured on `develop` at `d84b024e`:

  | Source | Value |
  |---|---|
  | `app_settings.harness_judge_model` — what the operator set in the UI | **`deepseek-v4-pro`** |
  | `settings.harness_judge_model` — the env singleton every consumer reads | **`None`** |
  | `resolve_judge_model(settings)` — what the judge shot actually uses | **`claude-opus-4-8`** |

  The four consumers stop reading `app.config.settings` and read the DB-backed
  `UserEffectiveSettings` the rest of the app uses. ⚠ **The report's own condition is BINDING and is
  not optional garnish: the fix MUST include a test that sets the row and asserts the RESOLVED model
  changes** — *"the absence of that test is why this survived from 2026-07-31 to 2026-08-17."*
  ⚠ Why it is worse than an inert setting: **the fallback is a TOP-TIER model**, so the knob fails in
  the *expensive* direction while the operator's stated goal was to spend less; and the
  publish-gauntlet judge is a **hard wall**. The alternative fix the report allows — declaring the
  knob system-level in the UI — was **considered and rejected**, because it leaves the operator's
  actual goal impossible.
- **D-18 — `BUG-260718-04` (`severity: major`): a thread restores its model by DERIVING it from its
  last message.** The report's own option (a). Every message already persists the model it used
  (`ChatArea.tsx:320` sends `selectedModel` per message), so seed `selectedModel` from the thread's
  most recent message on load. **No new storage, no schema change, no migration.** Falls back to the
  global default for brand-new threads **or when the stored model is no longer enabled** — which
  reuses D-07's rule rather than inventing a second one. Today `selectedModel` is ephemeral state
  seeded from the global default (`ChatArea.tsx:63`, `:154-156`) and reset on provider change
  (`:201`); the gap is purely restore-on-load.
- **D-19: `BUG-260809-01` (cloud eval engine 0/8) STAYS OPEN.** Reviewed and not folded — it is the
  eval engine, not a model control, and belongs to the SEED-040/088 sweep this phase fences out.

### Guardrails

- **D-20 — G-5 on `PhaseFormPanel.tsx` is HONOURED BY CONSTRUCTION, not overridden.** Re-derived
  2026-08-17: **16 commits / 8 phases / 1167 L** (buckets `103 155 183 184 185 189 193 193.1`;
  quick-task bucket `260814` excluded) — identical to the ledger row, which is unusually healthy for
  this table. The row's standing order since Phase 185 is *"the next surface that needs the panel gets
  its own component and one gated line"*, honoured three times running (185 / 193 / 193.1, the last
  **mechanically fenced** by a source fence that splits the panel's `?raw` text and asserts exactly
  one mount line carrying both the `pt ===` guard and the spread prop). **This phase REPLACES an
  existing field rather than adding a second concern**, and follows the same shape: a `ModelField`
  component with one gated mount line per phase type. ⚠ **A planner that inlines picker state
  (`useMemo`/`useState`/`useEffect`/`.filter(`/`.map(`) into the panel body breaks the property the
  193.1 fence guards.** Read `docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsphaseformpaneltsx`
  before planning.
- **D-21 — G-2 (sketch before UI) FIRED AND WAS DECLINED, on a reason.** The picker idiom is already
  shipped **twice** — `JudgeModelPicker.tsx` (137.1, sketch 024-A) and `ModelDefaultPreference.tsx`
  (167) — so the acceptance bar exists in code, not in a drawing. Re-drawing an atom that already
  ships is precisely the structural sketch→build drift `SEED-155` records. **The operator was offered
  a sketch and did not take it.**
- **D-22 (⚠ A REAL FINDING, not bookkeeping) — FIVE FILES THIS PHASE TOUCHES ARE ABSENT FROM THE
  HOT-FILE LEDGER, so G-5 has never fired on any of them.** Measured 2026-08-17 with the CLAUDE.md
  recipe (six-digit quick-task buckets subtracted):

  | File | commits / phases / lines | in ledger? |
  |---|---|---|
  | `backend/app/config.py` | **70 / 41 / 1275** | ❌ **absent** |
  | `frontend/src/pages/SettingsPage.tsx` | 34 / 21 / 1426 | ❌ absent |
  | `backend/app/api/admin.py` | 30 / 11 / 1718 | ❌ absent |
  | `backend/app/services/harness/validator_kinds.py` | 11 / 4 / 744 | ❌ absent |
  | `frontend/src/components/admin/ModelRegistryTab.tsx` | 9 / 3 / 1083 | ❌ absent (exactly at threshold) |

  ⚠ **`config.py` at 41 phases is the second-hottest file measured anywhere in this project** — after
  `backend/app/api/threads.py` (76) — **and its own guardrail has been structurally blind to it for
  the project's entire life.** This is the identical invisibility failure `WorkflowsPage.tsx`
  (ten phases), `WorkflowDoorSwitch.tsx` (six) and `db/workflows.py` (seventeen) each suffered.
- **D-23: this phase discharges the ledger debt for the files it ACTUALLY MODIFIES, measured at
  close** — a row **and** its detail section, per the SAME-COMMIT SYNC RULE. The remaining absent
  files are **named in D-22 so they are no longer invisible**, and are left unwritten by decision:
  writing four detail sections about code this phase does not touch would turn a model-picker phase
  into a documentation phase. ⚠ **Any of the five that 196 ends up modifying moves from "named" to
  "owed a row" automatically — re-derive at close rather than trusting D-22's figures**, since this
  table's own documented failure mode is a figure going stale on the next commit, sometimes the same
  afternoon.
- **G-1 / G-3 / G-7:** none fire. 196 is not an insert (`<base>.N`); the scope is far past `/gsd:fast`
  (≤ 1 file / ≤ 10 lines); no gap-closure round has run.

### Claude's Discretion

- The exact route name and shape of the D-01 union endpoint (`GET /models/registry`, a widened
  `/me/preferences`, or another form) — the **contract** is fixed (non-operator readable, returns the
  union with `enabled` / `deprecated` / `capability_source` / `emit_tier` per row), the URL is not.
- Component naming and file placement for the picker (`ModelField.tsx` is a suggestion, not a lock).
- Whether the `llm_emit` fitness annotation renders as a chip, a suffix, or a grouped `<optgroup>` —
  the **requirement** is that a `coerce` model is distinguishable from a `force`/`force_strict` one
  *before* selection, in user words.
- Wave/plan decomposition, and whether the three surfaces ship as separate plans (they almost
  certainly should — surfaces 2 and 3 are independent of surface 1).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The phase's own requirement and criteria
- `.planning/ROADMAP.md` §`#### Phase 196: Registry-Backed Model Picker (canvas)` (~`:630-642`) —
  goal, the three success criteria, and the canvas-only scope fence that **D-domain deliberately
  widens**.
- `.planning/REQUIREMENTS.md` §AUTH-04 (`:66`) — *"A user selects the model for a step from the live
  model registry, rather than typing a model name or slug by hand"*, and the Future-Requirements row
  (`:110`) recording the app-wide sweep as deferred.

### Seeds — the spec inputs
- `.planning/seeds/SEED-135-per-role-model-fitness-visible-at-pick-time.md` — **the primary spec
  input.** Three model roles with three different bars; the `emit_tier` single-source rule; the
  measured run `da5541c0` degradation; the overlay-list prerequisite (§"Why SEED-088 is a hard
  dependency"); the six-item "How we would know this is closed" list; and §"2026-07-31 — the operator
  generalised this" (G1 *every setting names its consumers* / G2 *no silent fallback* / G3 *one knob,
  one concern*) — **G2 is the through-line of D-17 and D-18.**
- `.planning/seeds/SEED-172-local-llm-providers-cannot-be-added-through-the-registry.md` — why the 8
  DB-only ids exist and why three of them were inserted **by hand**; the `_PROVIDER_BASE_URLS` (11,
  routing) vs `PROVIDER_ENDPOINTS` (8, SSRF allowlist) conflation; the hidden 600 s SDK ceiling; and
  ⚠ **`ollama` and `lmstudio` are SEPARATE providers since Phase 111 (D-111-7)**.
- `.planning/seeds/SEED-040-model-registry-self-service.md` and
  `.planning/seeds/SEED-088-dynamic-model-registry-live-discovery-db-backed-ui-managed.md` — the
  app-wide sweep this phase is fenced against; read to know the boundary, not to build to it.

### Reported bugs FOLDED into this phase (update their frontmatter at plan time)
- `.planning/reported-bugs/BUG-260731-01-judge-model-knob-may-be-inert-env-singleton.md` — read
  §"⚠ CONFIRMED 2026-08-17" for the three-row measurement and §"What a fix must do" for the **binding
  test requirement**.
- `.planning/reported-bugs/BUG-260718-04.md` — read §"Hypothesized cause" for the exact line
  references and §"Suggested routing" for options (a)/(b); **(a) is D-18.**

### Reviewed and NOT folded
- `.planning/reported-bugs/BUG-260809-01-cloud-eval-engine-sweep-all-providers-fail.md` — stays
  `open` (D-19).

### Project rules that bind this phase
- `CLAUDE.md` §"Provider-docs-first (evidence-based)" — cross-provider work researches the provider's
  OWN docs first, then cross-checks against measured app behaviour.
- `CLAUDE.md` §"UAT scoreboard recipe (MANDATORY)" — ⚠ **the FULL native roster is 8 rows, not 4**,
  and it must be **DERIVED from `MODEL_CAPABILITIES` by grouping on `provider`, never re-typed.**
  A model-picker phase is precisely a phase where a hand-typed roster would rot.
- `CLAUDE.md` §"Workflow guardrails" + the hot-file ledger table — the G-5 audit scan list.
- `docs/HOT-FILE-LEDGER.md#frontendsrccomponentsworkflowsphaseformpaneltsx` — the named seam, the
  standing one-gated-line order, and the 193.1 source fence that mechanically guards it.

### Design record
- `.claude/skills/sketch-findings-agentic-rag/` — the 024-A picker idiom (preset `<select>` +
  always-on 🔒 footer), the Phase 111.1 reusable provider picker, the Phase 127 ICON CONVENTION
  (provider/model logos are single-source `@lobehub/icons` **everywhere**), and SEED-085's
  two-audience ⌥ Technical-names vocabulary. Load via `Skill("sketch-findings-agentic-rag")`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`frontend/src/components/settings/JudgeModelPicker.tsx`** — the 024-A idiom in full: registry-only
  `<select>`, a leading auto/default option, an unknown persisted value kept selectable as
  `(current)` (`:74`, `:98`), an always-on 🔒 footer, and a server-derived state loop (read → persist →
  re-read, never optimistic). **Clone this shape; do not invent one.**
- **`frontend/src/components/settings/ModelDefaultPreference.tsx`** — the same idiom plus the
  **two-layer governance proof**: the select offers only the operator/org enabled set, the server
  re-validates on write (400), and an operator LOCK disables the control while the server remains the
  actual wall (*"the disable is courtesy, the server is the wall"*, T-167-14b). **This is the closest
  analog to what 196 builds.**
- **`backend/app/api/admin.py:1054-1104` (`_registry_row`) + `:1106-1149` (`get_model_registry`)** —
  the union composition D-02 reuses: DEF ∪ OVR ∪ DB-only, with `capability_source`,
  `overridden_fields`, `enabled`, `deprecated`, `is_default`, `is_locked` per row. ⚠ Note its WR-04
  lesson — absent numeric fields return `None`, not a false `0`.
- **`backend/app/api/me_preferences.py`** — the non-operator read/write precedent: an allowed-set
  computed server-side, a 400 on an out-of-set write, and a fresh view returned so the client stays
  server-derived. **The authz shape D-09's save-path refusal should mirror.**
- **`backend/app/services/run_model_resolution.py:35` (`_resolve_enabled_model`)** — the shipped
  disabled-model fallback + honest SSE notice that D-10 routes the harness through. It already handles
  the *"the org default is itself disabled"* dead-default case (`:75`).
- **`frontend/src/components/settings/ModelPillRow.tsx`** — the shipped precedent for badging a model
  in a picker (amber `unverified` chip, informational `deprecated` badge that stays selectable), plus
  the `modelLogo()` / `providerLogo()` single-source seam.
- **`frontend/src/components/workflows/PhaseFormPanel.tsx:337-379` (`SelectField`)** — the panel's own
  select primitive, already used for `citation_policy` etc. A `ModelField` should compose with the
  panel's `FieldLabel` / `hint` / `help` / `onPersist`-on-blur conventions rather than restyle them.

### Established Patterns

- **`emit_tier` is the SINGLE source of truth for forced emission (D-122-04).** `forced_emission` and
  `strict_json_schema` are **DEPRECATED-UNREAD**, and `config.py:188-194` explicitly forbids adding a
  derived view that re-reads them. ⚠ **Any fitness surface reads `emit_tier`, never the two bools.**
  Latent drift worth not propagating: `resolve_judge_model`'s fallback check still reads
  `forced_emission` (`validator_kinds.py:83-86`) — both candidates agree today, so there is no live
  divergence, but the "correct" path and the emit ladder read two different flags.
- **A registry MISS degrades to `coerce` by design and that default is CORRECT (D-122-05).** This
  phase makes the degradation *visible*; it must not change it.
- **Save-on-blur, server-derived state.** The panel persists on blur (`onPersist`); the settings
  pickers persist on select and re-read. Do not introduce a third state discipline.
- **The `require_operator` router gate returns a byte-identical 404, with no RLS backstop**
  (`admin.py:1051`, SC#4 / D-149-09). D-01's new route lives **outside** that router.
- **Cross-provider handling stays at the service boundary**, never forked into the shared path (D-14).

### Integration Points

| Where | What changes |
|---|---|
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 4 `TextField` mounts → 4 gated `ModelField` mounts (D-20's one-line rule) |
| new `frontend/src/components/workflows/ModelField.tsx` (name at discretion) | the picker itself |
| new backend route (name at discretion) | the D-01 non-operator union read |
| workflow save path (`backend/app/api/workflows.py`) | D-09 server-side refusal on `config.model` ⚠ **35 commits / 17 phases — G-5 FIRES, ledger row says "extraction due"** |
| `backend/app/services/harness/phase_types.py:393-395` | D-10 enabled-check ⚠ **38 / 15 / 2393 — G-5 FIRES, ledger row says "extraction due — not taken in 190"** |
| `backend/app/config.py:717-718` | D-14 `emit_tier` in the overlay list ⚠ **absent from the ledger, 41 phases** |
| `backend/app/services/harness/validator_kinds.py` + the 3 other judge consumers | D-17 |
| `frontend/src/components/chat/ChatArea.tsx:63,154-156,201` | D-18 ⚠ **61 / 29 / 587 — G-5 FIRES, "strongest FE extraction case"** |

</code_context>

<specifics>
## Specific Ideas

- **The operator's own framing, from SEED-135 (2026-07-31), is the acceptance mood for all three
  surfaces:** *"Everything should be changed dynamically, and clearly — which piece of the
  application does this change affect? … We are always relying on hardcoded things. We have to change
  this mindset and rely on a dynamic, accurate, safe source of truth — not code."*
- **The inherit option's copy should read like a sentence, not a field value** — *"Use the run's
  model — today that would be `gpt-5.4`"* — because the honest statement has a *because* in it.
- **The fold rationale, in one line worth keeping:** a typed model box that nothing validates, a judge
  knob the judge never reads, and a composer picker that silently reverts are **the same defect
  wearing three faces**.
- ⚠ **Do not test this phase with `gpt-5.4` alone.** It is the only explicit value in the corpus and
  it is registry-known, enabled, and `force_strict` — i.e. it passes every check this phase adds and
  proves nothing. The interesting rows are `gpt-5.2` (disabled), `glm-4.7-flash` (DB-only, local,
  `coerce` by construction), `gpt-5.5` (code-only — absent from `allowed_models`) and
  `gemini-3.6-flash` (DB-only — absent from `verified_models`, and the seed's own failure case).

</specifics>

<deferred>
## Deferred Ideas

- **Judge fitness as a capability facet** — SEED-135 item 6. **Re-open trigger:** the moment someone
  reproduces the `gemini-3.5-flash` judge failure with the sanitized Google tool payload captured and
  confirms or disproves that `criteria` is shape-stripped. Until then no document may state the cause
  as fact (the seed's own rule). See D-16.
- **Refusing a `coerce`-tier judge at `settings.py:448-457`** — SEED-135 item 3, independently
  shippable. Deferred with judge fitness; **re-open trigger:** the judge-fitness work above, or the
  first publish blocked by a judge that could never have graded it.
- **The app-wide model single-source sweep (SEED-040 / SEED-088)** — explicitly fenced out by the
  ROADMAP and by `REQUIREMENTS.md:110`. **Re-open trigger:** its own milestone.
- **Per-workflow (rather than per-step) default model** — raised as a scope question and dropped; it
  is a new capability. **Re-open trigger:** an author asks to set one model for a whole workflow.
- **Having the AI drafter CHOOSE a fit model per step** — collides with AUTH-02. **Re-open trigger:**
  Phase 197 scoping guided authoring (D-11).
- **A "re-measure loaded context" action in the Model Registry tab** — SEED-172 finding 4: reloading
  an LM Studio model at a different context length makes its registry row stale **silently**, and
  there is no reconciliation anywhere. **Re-open trigger:** the next phase touching
  `ModelRegistryTab.tsx`, or the first local model that reads as "forgetful".
- **Numeric range validation on the registry PATCH path** — SEED-172 finding 3: `0`, a negative, or a
  fat-fingered `6000` is accepted end-to-end from the UI; the table has **zero** `CHECK` constraints.
  ~10 lines. **Re-open trigger:** any phase editing `set_model_capability`'s guards — ⚠ **which D-14
  may well be**, so the planner should check whether this becomes free.
- **Ledger rows for the four absent files 196 does not modify** (`SettingsPage.tsx`, `admin.py`,
  `validator_kinds.py`, `ModelRegistryTab.tsx` — and `config.py` if untouched). **Re-open trigger:**
  the next phase whose `files_modified` names any of them. See D-22 / D-23.

### Reviewed Todos (not folded)

- **`BUG-260809-01`** (cloud skill-eval engine 0/8 healthy, `related_seeds: [SEED-040]`) — reviewed at
  discuss-phase, **left `open`**. It is the eval engine and cloud config, not a model control; it
  belongs to the SEED-040/088 sweep this phase fences out (D-19).

</deferred>

---

*Phase: 196-registry-backed-model-picker-canvas*
*Context gathered: 2026-08-17*
