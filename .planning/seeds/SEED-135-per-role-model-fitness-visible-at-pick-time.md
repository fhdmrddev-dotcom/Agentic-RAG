---
seed_id: SEED-135
title: "Model fitness must be visible BEFORE it costs you a run — the app has THREE model roles (chat/retrieve, emit step, publish judge) with three different bars, all picked from flat dropdowns that imply interchangeability; a single-provider tenant can be silently blocked from publishing"
status: partially-answered
planted: 2026-07-31
phase_origin: "Phase 185 operator UAT, 2026-07-30/31 (runs da5541c0 and ced8005d). Two independent model-fitness failures surfaced in ONE golden-run attempt: an unregistered chat model silently degraded the emit phase from force to coerce, and a registry-known force-tier Google judge returned provider_error with a null verdict. Neither was announced anywhere before the run burned."
folded_into: 249 (the cheap 80% only — the per-role half stays open)
category: "Cross-provider model management / honesty at pick time — a SURFACING gap over capability data that already exists in the registry, plus one genuinely missing facet (judge fitness). NOT a re-platform of the LLM call path; the emit ladder and the judge resolver are both correct as written."
related_seeds: [SEED-040, SEED-088, SEED-122, SEED-082, SEED-085, SEED-118]
related_memories: [feedback_cross_provider_always_top_of_mind, feedback_provider_uniform_ux, feedback_model_names_representative, project_provider_feature_fit_routing, feedback_investigate_with_tools_first]
related_decisions:
  - "D-122-04 (config.py:195-208) — ``emit_tier`` is the SINGLE SOURCE OF TRUTH for forced emission; ``forced_emission`` + ``strict_json_schema`` are explicitly DEPRECATED-UNREAD. Any fitness surface must read emit_tier, never the two bools."
  - "D-122-05 (config.py:205-207) — a registry MISS degrades to ``coerce`` by design (default-SAFE). That default is CORRECT and must not change; what is missing is that the degradation is invisible to the person who caused it."
  - "D-03 / WR-05 (validator_kinds.py:66-76) — the judge must be an INDEPENDENT, FORCEABLE model 'so the verdict is truncation-safe'. The invariant is documented; it is enforced only on the fallback path."
  - "SEED-082 captured gap (Phase 103/104): 'workflow builder has no model-selection design (model:null inherits composer → unforceable model silently gets best-effort)'. This seed is the measured confirmation of that prediction, plus the judge role it did not cover."
re_open_trigger: "The FIRST time a tenant, customer or operator is pinned to a single provider that is not OpenAI or Anthropic — specifically: a Google-only, Moonshot/Kimi-only, or local/Ollama-only deployment is scoped, OR anyone asks 'which model should I use for X?' about a workflow emit step or the publish judge, OR a publish/emit failure is triaged and the root cause turns out to be the model rather than the workflow. Any one of those means the fitness information is being discovered by burning a run instead of read at pick time."
priority: high
suggested_phase: "A dedicated small cross-provider phase, best co-scoped with SEED-088 (dynamic model registry) — see 'Why SEED-088 is a hard dependency for the real fix' below. A cheap 80% (surface the tier that already exists in the three pickers + validate the judge write against emit_tier) is independently shippable and does not need 088."
surface: Agentic-RAG
trigger_when: unset
---

# SEED-135 — per-role model fitness, surfaced at pick time

## The operator's ask (2026-07-31, in spirit)

> Our application is cross-provider, so suppose one company wants to use one provider — this
> should work everywhere with models; notify the user where to use the flagship models and where
> to use the regular models.

That is one sentence containing two hard requirements. **(1)** Single-provider tenancy must be a
supported configuration, not an accident that happens to work for OpenAI. **(2)** The app must
*tell* people where a strong model is required, in the surface where they pick the model — not in
a backend log, and not by failing a run.

Today it does neither reliably.

## Three roles, three different bars, one flat dropdown

| Role | Where it is picked | What it actually needs | What the picker tells you |
|---|---|---|---|
| **Chat / retrieve** (also the default inherited by a workflow phase with `model: null`) | `app_settings.llm_model` — a free-text box, `SettingsPage.tsx:944` | `native_tools`; a workable `max_tools`; KB tools present for grounding detection | An amber `unverified` chip iff the id is not in `verified_models` (`SettingsPage.tsx:947-954`). Its tooltip names the inferred provider, a max-tokens guess, and `timeout=90s` — which is **stale**: `_INFERRED_DEFAULT_TIMEOUT_S = 300` (`config.py:471`). It says nothing about emission. |
| **Emit step** (the forced structured/document emission a workflow phase performs) | Never picked as a role at all — inherited from the chat model, or set per-phase | `emit_tier ∈ {"force", "force_strict"}` | Nothing. `emit_tier` is not in any settings payload and appears nowhere in `frontend/src` except one prose comment (`ProviderScoreboard.tsx:19`). |
| **Publish judge** (grades eval verdicts AND gates skill/workflow publishing) | `harness_judge_model`, via `JudgeModelPicker.tsx` | forceable emission **plus** the ability to carry a NESTED tool schema across the provider boundary | A registry-only `<select>` sorted alphabetically (`JudgeModelPicker.tsx:73`) with an always-on 🔒 footer naming the effective judge. No capability facet of any kind. |

The three lists look the same, sort the same, and read as interchangeable. They are not.

## What actually governs forced emission — verified by reading

`emit_tier` is the only flag that governs it, and the registry says so in its own words.
`backend/app/config.py:188-194`:

> **Phase 122 D-122-04 DEPRECATION NOTE:** ``forced_emission`` + ``strict_json_schema``
> are SUPERSEDED by the explicit ``emit_tier`` enum below. They are kept in place
> but DEPRECATED-UNREAD for one phase (safer rollback per RESEARCH Open Q1) — Plan
> 122-02's ladder reads ``emit_tier`` directly, never these two bools. Do NOT add a
> derived view that re-reads ``strict_json_schema``…

and `config.py:205-207`:

> The lookup MUST read ``get_model_capability(id).get("emit_tier", "coerce")`` so a
> registry MISS (un-doc-verified / case-sensitivity) SAFELY degrades to coerce
> (default-SAFE, D-122-05) — never wrongly assumes force/strict it hasn't verified.

The single read site does exactly that: `forced_emit.py:376` `emit_tier = cap.get("emit_tier", "coerce")`,
with a boundary guard at `:377-378` and rung selection at `:435`. The default-SAFE behaviour is
right. The problem is entirely downstream of it: **the degradation has no receipt anyone sees.**

A registry miss builds its capability dict at `config.py:497-526` (`_build_inferred_defaults`),
which sets `native_tools`, `provider`, `llm_call_timeout_seconds`, `max_output_tokens`,
`capability_source: "inferred"` — and **never sets `emit_tier`**. The only signal is a
once-per-process `logger.warning("model_capability_unknown …")` at `config.py:521-525`, on the
backend, deduped per model id, which nobody running a workflow will ever read.

### Measured, Phase 185 UAT, run `da5541c0`

`app_settings.llm_model` was `gemini-3.6-flash`. That id is **not** in `MODEL_CAPABILITIES` — the
registry's Google rows are `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`,
`gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`
(`config.py:316-330`). So it resolved `capability_source=inferred`, `emit_tier` absent → the
workflow's emit phase ran at tier **`coerce`** instead of `force`
(`harness_audit.emit_rendered.tier`). **No error. No banner. Nothing in the UI.** The operator
chose a newer, stronger Google model and silently got the weakest emission path in the app.

## What `resolve_judge_model` validates — and what it does not

`backend/app/services/harness/validator_kinds.py:65-87`. The docstring states the invariant
(`:70-71`): *"never the run model; a **forceable** model so the verdict is truncation-safe"*.

- **Operator-set model** (`:77-79`): `model = getattr(settings, "harness_judge_model", None)` →
  `if model: return model`. Returned **unchecked**. No registry lookup, no `emit_tier` check, no
  `forced_emission` check, no provider check.
- **The two hardcoded fallbacks** (`:83-86`): `for candidate in ("claude-opus-4-8", "gpt-5.5")` →
  returned only `if cap.get("forced_emission")` is truthy.

So the forceability invariant is enforced **only on the path that runs when the operator has not
chosen anything**, and skipped **entirely on the path that runs the moment they do**. Secondary
drift worth noting while touching this: the fallback check reads `forced_emission`, the bool the
registry documents as DEPRECATED-UNREAD (`config.py:188-194`), not `emit_tier`. Both candidates
happen to agree today (`claude-opus-4-8`: `forced_emission: True`, `emit_tier: "force"` —
`config.py:298`), so there is no live divergence — but it is a latent one, and it means the
"correct" path and the ladder read two different flags.

## What the settings write validates

`backend/app/api/settings.py:448-457` — the only server-side gate on `harness_judge_model`:

```python
if body.harness_judge_model:
    cap = get_model_capability(body.harness_judge_model)
    if cap.get("capability_source") != "registry":
        raise HTTPException(status_code=400, detail=f"Unknown judge model: …")
```

It checks **registry membership only**. `emit_tier` is not consulted. `kimi-k2.6` is registry-known
and `emit_tier: "coerce"` (`config.py:347`) — it passes this validator and becomes the judge that
gates every publish in the deployment.

## What the client filters on

`JudgeModelPicker.tsx:31` takes `registryModels: string[]`, fed at `SettingsPage.tsx:1177` as
`[...verifiedModels]`, which is `new Set(data.verified_models ?? [])` (`SettingsPage.tsx:659`) — a
flat array of registry ids. The component dedupes and alphabetises (`:73`) and renders `<option>`s
(`:99-103`). There is no capability filter and no capability annotation, because **there is no
capability data in the payload**: `grep -rn "emit_tier" frontend/src` returns exactly one hit, a
comment in `ProviderScoreboard.tsx:19`. `emit_tier` has never been sent to the client.

## The concrete eligible / ineligible sets

61 rows in `MODEL_CAPABILITIES` (`config.py:253-401`), every one of which carries an explicit
`emit_tier` — verified, no row omits it:

- **`force_strict` — 17 rows, all OpenAI** (`gpt-4o` … `gpt-5.6-*`, `o1`; `config.py:261-282`).
  Token-level guaranteed strict schema.
- **`force` — 39 rows**: all Anthropic (`config.py:297-303`), all Google (`:316-330`), DeepSeek
  v4 (`:339-340`), MiniMax (`:356-363`), Zhipu/GLM (`:369-376`), and the conditional OpenRouter
  routes whose upstream is itself forceable (`:390-400`).
- **`coerce` — 5 rows, the INELIGIBLE set:**
  `kimi-k2.6`, `kimi-k2.5`, `moonshot-v1-8k` (`config.py:347-349`),
  `moonshotai/kimi-k2.5`, `moonshotai/kimi-k2.6` (`config.py:395-396`).

Plus the set nobody enumerates: **every model id not in the registry at all** → `coerce` by
default. That includes **every local model** — there are zero rows with `"provider": "ollama"`, so
every Ollama / LM Studio / self-hosted id in the app is coerce-tier by construction ([[SEED-122]]).

## What a single-provider tenant actually gets

| Tenant pinned to | Emit step | Publish judge | Verdict |
|---|---|---|---|
| OpenAI | `force_strict` | `gpt-5.5` — **measured working** (run `ced8005d`) | Works |
| Anthropic | `force` | `claude-opus-4-8` is the hardcoded default | Presumed working — **not measured in this UAT** |
| Google | `force` on registry rows; **`coerce` on any newer id** (measured) | **failed** — `gemini-3.5-flash` returned `provider_error`, `overall_score` null, no verdict (run `da5541c0`) | **Publishing blocked on our one measurement** |
| Moonshot / Kimi | `coerce` — all rows | `coerce` — all rows | Blocked by construction |
| Local / Ollama | `coerce` — no registry rows exist | `coerce` | Blocked by construction |

The Google row is the important one, because it is **measured, not inferred**, and because the
same Google model ran the workflow itself successfully both times. The failure is **judge-on-Google
specifically, not Google generally.**

### The judge sequence, measured

1. Run `da5541c0`, `harness_judge_model = gemini-3.5-flash` (registry-known, `emit_tier: "force"` —
   `config.py:327`): publish judge returned `failure: "provider_error"`, `overall_score: null`,
   **no verdict**.
2. Operator changed `harness_judge_model` to `gpt-5.5` at **20:13:20**.
3. Golden run `ced8005d` at **20:13:38** passed: `overall_score: 82`, `publish_succeeded`.

The passing verdict's summary, verbatim:

> "six obligation rows, each with source_clause, current_state, gap, severity, and owner, every
> populated cell carrying a citation to a named knowledge-base document, and the one unsupported
> field (report_title) correctly nulled rather than invented … it is legitimately cited, so
> grounding holds."

**18 seconds and one dropdown change separated "no verdict at all" from a scored, articulate
pass.** Nothing in the product connected those two facts for the operator.

### Why the judge bar is HIGHER than `emit_tier` — a hypothesis, explicitly NOT live-verified

`gemini-3.5-flash` is `emit_tier: "force"`. It is registry-known. It still produced no verdict. So
`emit_tier` is **necessary but not sufficient** for the judge role, and the likely reason is
structural:

- The judge tool's parameters are `JudgeVerdict.model_json_schema()` — built identically at three
  call sites: `publish_service.py:922`, `validator_kinds.py:570`, `eval_runner_service.py:326`.
- `JudgeVerdict` (`validator_kinds.py:110-127`) has a **nested** field:
  `criteria: list[JudgeCriterionVerdict]`, where `JudgeCriterionVerdict`
  (`validator_kinds.py:95-107`) is its own model. Pydantic therefore emits `$defs` plus a `$ref`
  for the `criteria` items.
- `backend/app/services/google_service.py:249-265` (`_GOOGLE_UNSUPPORTED_SCHEMA_KEYS`) lists both
  `"$ref"` (`:252`) and `"$defs"` (`:264`), and `_sanitize_schema_for_google` (`:331-337`) drops
  every listed key recursively before the Google `Tool` is constructed.
- Dropping both leaves `criteria.items` as a content-free `{}` on the wire.

**Confidence, stated honestly: HIGH that the wire schema loses `criteria`'s shape. MEDIUM that this
is what manifests as `provider_error`.** This has **NEVER been live-verified** — no one has dumped
the sanitized Google tool payload or reproduced the failure with instrumentation. `provider_error`
itself is set at `forced_emit.py:471` whenever a provider call raises on a rung, so it is a
catch-all and does not by itself identify the cause. Any phase that picks this up **must reproduce
and inspect the sanitized payload before treating the hypothesis as fact.**

## Why SEED-088 is a hard dependency for the *real* fix

`get_model_capability_async` (`config.py:700-724`) is the DB-override tier — the layer [[SEED-040]]
and [[SEED-088]] exist to make operator-writable. It overlays exactly these fields from
`model_capabilities_overrides`:

```python
for field in ("llm_call_timeout_seconds", "context_window_tokens",
              "max_output_tokens", "native_tools", "deprecated"):
```

**`emit_tier` is not in that list.** So even after SEED-088 ships a full UI-managed registry, an
operator adding `gemini-3.6-flash` by hand would get the timeout and the token cap right and
*still* silently land on `coerce`. Adding `emit_tier` (and any judge-fitness facet) to that overlay
list is a one-line prerequisite that belongs in the same commit as any surfacing work — otherwise
the surface tells the truth about a value the operator has no way to correct.

## The fix shape (what this seed argues for — not a plan)

**Per-role fitness surfaced at pick time, not discovered by a burned golden run.**

1. **Name the role in the surface.** Three pickers, three different bars, three different labels.
   `[[SEED-085]]`'s two-audience vocabulary applies directly: the surface says
   *"can grade a publish"* / *"can fill a document"* / *"chat only"*; the ⌥ technical reveal says
   `emit_tier: force_strict`. Engine words never become user words.
2. **Ship `emit_tier` (or a derived role-fitness triple) in the settings payload** beside
   `verified_models` / `deprecated_models`, which already travel that way (`SettingsPage.tsx:659-662`).
   This is the whole client-side unlock; the data exists, it has just never been sent.
3. **Validate the judge write against fitness, not just membership** — `settings.py:448-457` should
   refuse (or at minimum loudly warn on) a `coerce`-tier judge. The invariant is already written
   down at `validator_kinds.py:70-71`; enforce it on the path that is actually used.
4. **Make the registry-miss visible where it bites** — the amber `unverified` chip already exists
   (`SettingsPage.tsx:947`); it needs to say *"emission degraded to best-effort"*, fix the stale
   `timeout=90s` string, and appear in the workflow builder / run surface, not only in Settings.
5. **Add `emit_tier` to the DB-override field list** (`config.py:717-718`) so the fitness a surface
   reports is a fitness an operator can fix.
6. **Judge fitness is its own facet.** `emit_tier` does not capture it — `gemini-3.5-flash` proves
   that. Whether it becomes a registry column, a measured probe, or an eval-studio verdict
   ([[SEED-122]]'s capability matrix is the natural home) is open; that it is a *different question*
   from `emit_tier` is not.

Explicitly **out of scope**: weakening any gate, changing the coerce default (D-122-05 is correct),
changing the emit ladder, or auto-switching the user's model behind their back. The ask is
*notification*, and the honest answer to "your judge can't do this" is to say so before the run,
not to quietly substitute a different model.

## Additional re-open triggers

- SEED-088 (dynamic model registry) enters discuss-phase — the `emit_tier` overlay gap above must
  be decided there or the registry ships a knob that cannot fix the thing it appears to fix.
- SEED-082's builder-side half is picked up (per-workflow model selection / model-fit routing) —
  that phase is where "flagship here, regular there" is *shown* rather than documented.
- A `.docx`/deliverable phase is scoped for a non-OpenAI tenant.
- Anyone proposes adding a fourth model role (a summariser, a router, a re-ranker) — each new role
  silently widens this gap; decide the fitness contract before adding it.

## How we would know this is closed

1. Setting `harness_judge_model` to a `coerce`-tier registry model (`kimi-k2.6`) is refused or
   carries a visible fitness warning — a test that FAILS against today's `settings.py:448-457`
   before it is trusted.
2. Typing an unregistered model id into the Active Model box produces a warning that names the
   **emission** consequence ("forced emission unavailable — document/template steps run best-effort"),
   not only the inferred provider; and the tooltip's timeout figure matches
   `_INFERRED_DEFAULT_TIMEOUT_S` (`config.py:471`).
3. The judge picker distinguishes eligible from ineligible models **before** selection, sourced
   from a server-supplied facet — verifiable by grepping `frontend/src` for `emit_tier` and finding
   it in a payload type, not only in a comment.
4. The Google-judge failure is either **reproduced and root-caused** (sanitized tool payload
   captured, `criteria` confirmed shape-stripped) or **disproved**. Until one of those happens, no
   document, changelog or plan may state the cause as fact — this seed's MEDIUM stays MEDIUM.
5. A Google-only, a Moonshot-only, and a local-only tenant each have a written, measured answer to
   "can this deployment publish?" — a yes, or an honest no with the reason named at pick time.
6. `emit_tier` appears in the `get_model_capability_async` overlay list, so an operator who can see
   the fitness can also change it.

## Related

[[SEED-040]] (model registry self-service — the code-edit pain this compounds; a new model still
needs a `config.py` edit to be emit-capable) · [[SEED-088]] (dynamic model registry — hard
dependency for the durable fix; its overlay list is missing `emit_tier`) · [[SEED-122]]
(local/small-model capability validation — its per-model capability matrix is exactly the artifact
this surface should read from, and it already names `emit_tier` as a target facet) · [[SEED-082]]
(emit-gate policy flexibility — predicted "model:null inherits composer → unforceable model
silently gets best-effort"; this is the measured confirmation) · [[SEED-085]] (user-friendly vs
admin terminology — the vocabulary lever for "flagship here, regular there") · [[SEED-118]]
(weak-model tool-loop harness — the mitigation for models that fail the bar rather than the
notification that they will).

Sibling UAT findings from the same session, both about the same underlying disease — **the
executor knew the real reason and the user got a generic one**: `BUG-260730-01` (a grounded step
failed 3/3 because the citation gate demanded markers nothing ever instructed the model to write;
fixed in plan 185-12 by telling the producer, never by weakening the gate) and `BUG-260730-02`
(open — the emit step's real rejection was `covers_template=false`, surfaced as
"citations_required: no field_map on output" while the audit showed `citation_coverage_pct 100.0`,
zero uncited, zero invented; the precise message was computed, then discarded in favour of the
gate's generic one).

---

## 2026-07-31 — the operator generalised this, and the general form is the real ask

After reading the judge diagnosis the operator restated the problem one level up, and the wider form
is what should drive scope:

> "This is one of the cases where we should have, in the UI, in the settings, in whatever place, the
> flexibility to know every little piece of the application settings. For example you are saying the
> judge was hardcoded as `claude-opus-4-8` while I changed the setting to `gpt-5.5`. Everything should
> be changed dynamically, and clearly — which piece of the application does this change affect? We
> have sub-agents, we have something to generate title, we have something for the eval in the skills,
> we have something for the workflows. This is where we are failing to precisely control everything
> dynamically from the UI. We are always relying on hardcoded things. We have to change this mindset
> and rely on a dynamic, accurate, safe source of truth — not code. Only if something is broken should
> we have to go back to the code."

**The measured sprawl (read from the live `app_settings` row + a consumer grep, 2026-07-31).** Seven
model knobs, none of which states what it governs:

| setting | value at read time | read by |
|---|---|---|
| `llm_model` | `gemini-3.6-flash` | **20 files** — chat, agent loop, harness, multimodal |
| `sub_agent_model` | **`''`** | 12 files — agent loop, harness engine, publish |
| `harness_judge_model` | `gpt-5.5` | **`eval_runner_service.py` AND `harness/publish_service.py`** |
| `skill_builder_model` | **`''`** | skill proposer, skill tuner |
| `extraction_model` | `gpt-5.4-mini` | document ingestion |
| `embedding_model` | `text-embedding-3-small` | 8 files — retrieval, re-embed |
| `rerank_model` | `rerank-v3.5` | rerank service |

Two facts fall directly out of that table, and both are the operator's complaint made concrete:

1. **`harness_judge_model` governs TWO subsystems** — the skill/eval judge and the workflow publish
   judge. The operator asked, unprompted, *"I don't know if this judge model in the settings is only
   for the eval engine"*. That question has no discoverable answer in the product. The ambiguity is
   real, not a gap in their understanding.
2. **Two knobs are empty and silently falling back to code.** `sub_agent_model` and
   `skill_builder_model` are `''`. They render as configurable controls; what actually runs is a
   hardcoded default. This is the same shape as `resolve_judge_model`'s
   `("claude-opus-4-8", "gpt-5.5")` fallback tuple: empty knob → code decides → nobody is told which
   value won.

**Three requirements this generalises to** (they are the acceptance bar, not slogans):

- **(G1) Every setting names its consumers.** "This governs: workflow publish judge, skill evals."
  Derivable from the code, not folklore — a settings surface that cannot answer *what does this
  affect* is not a control panel, it is a form.
- **(G2) No silent fallback.** When a setting is empty and code is deciding, the UI says so and names
  the value actually in force. A control that appears authoritative while code overrides it is worse
  than no control, because it converts a knowable fact into a false belief.
- **(G3) One knob, one concern.** Either split `harness_judge_model` per subsystem, or state plainly
  that the two share one judge — but do not leave it undeclared.

This is the half that [[SEED-040]] and [[SEED-088]] do NOT cover: they carry *"a new model should
appear everywhere"*, which is the supply side. G1-G3 are the **traceability** side — every setting
declaring its blast radius and admitting when code is winning. Note the shape is identical to this
seed's core argument (three model roles, flat dropdowns, no fitness shown), which is why it lives
here rather than in a fourth record; per-role model fitness is simply the first and sharpest instance
of the general rule. Related: [[SEED-117]] (config consolidation), and the standing project direction
recorded in the `project_dynamic_settings_direction` and `project_admin_panel_plan` memories
("everything dynamic → Settings/admin; only API keys stay env secrets").


---

## ⭐ THE CHEAP 80% SHIPPED — Phase 249 (MODEL-05), 2026-09-15. The expensive half stays open.

This seed proposed its own split: *"A cheap 80% (surface the tier that already exists in the three
pickers + validate the judge write against emit_tier) is independently shippable and does not need
088."* Phase 249 took that split as written.

### ✅ Shipped

- **The pick-time warning exists where the pick happens.** The `unverified` chip had existed since
  Phase 075.3 — in `ModelPillRow`, on the **Settings** page. The chat composer's dropdown, where a
  model is actually chosen, had **no marker at all**. It does now, from the same shared copy module,
  so the two surfaces cannot drift.
- **It states the CONSEQUENCE, not the mechanism.** For a model whose inferred provider has no
  native tool calling, the chip says tool calling is disabled, that the run will be structured-mode,
  and that any tool call will arrive as unreadable text. ⭐ Lifted from `config.py`'s own wording,
  which reads that way because the previous phrasing (`safe_defaults_applied=True`) **read as
  benign and hid a total tool-calling failure for a day on 2026-08-18**.
- **The judge-write validation this seed also asked for ALREADY EXISTED** —
  `api/settings.py:798` rejects a non-registry `harness_judge_model` with a 400. Measured, not
  built. Recorded so it is not proposed again.
- ⛔ **`D-122-05` is untouched.** This seed's own instruction — *"That default is CORRECT and must
  not change; what is missing is that the degradation is invisible to the person who caused it"* —
  is honoured exactly: the pick still works, and a case pins that it does.

### ⭐ What the shipped fix measured on the operator's real configuration

**13 of their configured models will silently lose tool calling** — 5 OpenRouter, 6 Ollama,
2 LM Studio — and until this phase nothing said so at pick time. That is this seed's thesis,
quantified on a live machine rather than argued.

### ⛔ The expensive half is OPEN and unchanged

**THREE model roles with three different bars** — chat/retrieve, workflow emit step, publish judge —
all still picked from flat dropdowns that imply interchangeability. The composer chip answers
*"is this model registered, and will it call tools?"*. It does **not** answer *"is this model fit
for the emit step?"* or *"can this tenant publish at all?"*, and the single-provider-tenant publish
block this seed predicts is untouched.

**Re-open trigger: unchanged, verbatim** — the first time a tenant is pinned to a single non-OpenAI,
non-Anthropic provider; or anyone asks *"which model should I use for X?"* about a workflow emit
step or the publish judge; or a publish/emit failure is triaged to the model rather than the
workflow.
