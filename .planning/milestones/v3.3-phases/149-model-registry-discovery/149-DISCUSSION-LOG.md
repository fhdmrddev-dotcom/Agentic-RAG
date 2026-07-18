# Phase 149: Model Registry & Discovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 149-model-registry-discovery
**Areas discussed:** Registry universe + deprecated, Lock semantics in v3.3, Discovery run lifecycle, Open-bug routing, Picker polish (user-raised)

---

## Registry universe + deprecated

| Option | Description | Selected |
|--------|-------------|----------|
| Full union (Recommended) | Built-ins (DEF) ∪ overrides (OVR) ∪ discovery-confirmed DB-only rows; zero code edits for new models | ✓ |
| Built-ins only + overrides | New models still need a code change | |
| You decide | Claude picks at planning | |

| Option | Description | Selected |
|--------|-------------|----------|
| Own column (Recommended) | `deprecated boolean` (+ maybe note) in the 149 migration; deprecated ≠ disabled | ✓ |
| Reuse enabled | No migration; conflates provider-sunset with operator-hide | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Badge in picker (Recommended) | Deprecated-but-enabled stays selectable with an informational badge; only `enabled` gates | ✓ |
| Hidden for new picks | Second visibility mechanism next to enabled | |
| Operator-only flag | Users see nothing | |

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v3.4 (Recommended) | Advanced facets (emit_tier, max_tools, parallel, prefill, strict_json) stay code-only | ✓ |
| Editable in 149 | Full facet list now — bigger migration + SC#10 blast radius | |
| You decide | | |

**User's choice:** All recommended options.

---

## Lock semantics in v3.3

| Option | Description | Selected |
|--------|-------------|----------|
| Pin org default (Recommended) | Lock sets org-wide default (`llm_model`) + locked policy flag; one lock max; v3.4-ready | ✓ |
| Stored-but-inert policy | Recorded but does nothing until v3.4 | |
| Drop lock from 149 | Ship with the v3.4 per-user layer | |

| Option | Description | Selected |
|--------|-------------|----------|
| Registry-driven (Recommended) | Picker list BECOMES the registry; `provider_model_lists` retires | ✓ |
| Filter existing lists | Keep two model lists alive | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Block until re-pick (Recommended) | Disabling org-default/locked model refused with plain explanation; no dead default | ✓ |
| Allow + auto-fallback | Default changes as a side effect | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback + notice (Recommended) | Next message runs on org default with honest inline notice | ✓ |
| Plain refusal | Mid-flow dead end | |
| You decide | | |

**User's choice:** All recommended options.

---

## Discovery run lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Sync fan-out (Recommended) | One POST, concurrent server-side, one response; client-side timers; no new infra | ✓ |
| Live streaming progress | SSE per-provider updates — net-new admin streaming surface | |
| Background job + poll | Heaviest for a seconds-long operation | |

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral (Recommended) | Diff in response/UI only; confirm applies immediately; re-run is cheap | ✓ |
| Persisted proposals | Table + status lifecycle + staleness problems | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled + opt-in (Recommended) | New models land disabled; "enable now" only when capabilities complete | ✓ |
| Auto-enable when complete | Confirm means different things per provider | |
| Always disabled, no shortcut | Extra round-trip every time | |

| Option | Description | Selected |
|--------|-------------|----------|
| 8 cloud, keyed only (Recommended) | curate_models.py providers; no-key = "skipped"; local providers out | ✓ |
| Include local providers | Env-specific state in an org-level registry | |
| You decide | | |

**User's choice:** All recommended options.

---

## Open-bug routing

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into 149 (Recommended) | BUG-260620-01: enforce max_output_tokens clamp at the shared resolution point | ✓ |
| Defer to a fix phase | Ships a knob that doesn't bite | |
| Leave open | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Defer + UAT stopgap (Recommended) | BUG-260711-02 → SEED-114; 149 UAT row proves the registry native_tools flip stopgap live | ✓ |
| Fold the adapter into 149 | Phase-sized scope graft | |
| Leave open, no UAT row | | |

**User's choice:** Both recommended options. Frontmatter updated: gpt-4o report → `folded`/`folded_into: 149`; GPT-5.6 report → `deferred` with named re-open trigger.

---

## Picker polish (user-raised at the wrap-up gate)

**User's words (freeform):** "We added a lot of models under each provider and we did not include icons in the picker and also we have put some information about context and other things which make it not very good and not user friendly… consider just to do some small enhancement to this visually according to what we are building now."

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded polish in 149 (Recommended) | Provider logos (@lobehub/icons), group by provider, declutter rows; NO redesign | ✓ |
| Defer to Phase 156 | Picker file touched twice; 156 may not ship | |
| Sketch it first | G-2 pass before planning | |

**Notes:** Judged in-scope (not creep) because D-149-08 already rewires the picker's data source and D-149-05 already adds a badge to it; icon convention (RDD 48) is locked, so no new design decisions needed.

---

## Claude's Discretion

- Lock storage shape (one-lock-max, v3.4-survivable)
- Enabled/fallback enforcement seam on the request path + notice emission shape
- Migration numbering + full-schema regen + cloud-parity notes
- Discovery diff computation details (per-provider "changed" semantics)
- Registry write API shape (upsert vs field-patch)
- Audit action vocabulary details
- TTL-cache invalidation across WORKER_COUNT=2 vs SC#1 "next request"
- DEF vs OVR rendering in API responses (Reset support)

## Deferred Ideas

- Advanced routing-facet editing → v3.4 config-consolidation
- Per-user model preference (revive `user_settings.preferences`) → v3.4
- OpenAI Responses-API adapter → SEED-114 (named re-open trigger)
- Local-provider discovery (Ollama/LM Studio)
- Persisted discovery proposals (documented alternative)
- Full picker redesign → Phase 156 or its own sketch

## Reviewed Todos (not folded)

- `spike-nl-workflow-authoring.md` — generic keyword match only; workflow-inputs cluster, resurfaces at 151/152 (same disposition as 146/147/148)
