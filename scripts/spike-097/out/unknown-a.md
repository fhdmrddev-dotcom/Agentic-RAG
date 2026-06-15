# Unknown (a) — Can a model DERIVE the risk-register field schema and fill it from the KB WITHOUT inventing?

**Spike:** Phase 097 Plan 02 (Wave 1) — THROWAWAY · **Generated:** 2026-06-08T19:36:41.920806+00:00
**Provider:** anthropic (native SDK, forced tool_choice) · **Model that answered:** `claude-opus-4-8`
**Bound scope:** `folder_ids=['75755ec9-5ba7-495b-ad93-7500011cf6f2']` — a server-side parameter resolved from `spike-config.json`, NOT a prompt hint the model could widen (Pattern 2 / PROJ-02 / threat T-097-06).

## Verdict: YES

The model DERIVED the correct field schema from the template and filled it from the bound KB scope while declining (null) rather than inventing. Every non-null value is cited to a retrieved chunk.

---

## 1. Did the model derive the right fields?

The template's coverage oracle (`get_undeclared_template_variables()`) requires the top-level placeholder keys **['project_name', 'report_date', 'rows']**. The emitted field-map covered **['project_name', 'report_date', 'rows']** → covering: **YES**.

Within `rows`, the model emitted **6 risk row(s)**, each shaped with the nine register columns (`risk_id, cause, event, effect, probability, impact, response_strategy, owner, status`) — i.e. it inferred the per-row schema from the template's `{{ r.<field>.value }}` tags rather than being handed a column list. `score` was correctly NOT emitted (it is a render-time compute, not an LLM field).

## 2. Null-rate (declines vs invents)

Across **56** total leaves (2 scalars + 6 rows x 9 fields), the model filled **50** value(s) and declined the rest — an overall null-rate of **11%** where the excerpts did not support a value.

Per-field null rate (over the emitted rows):
  - `risk_id`: 0% null
  - `cause`: 17% null
  - `event`: 33% null
  - `effect`: 17% null
  - `probability`: 17% null
  - `impact`: 17% null
  - `response_strategy`: 0% null
  - `owner`: 0% null
  - `status`: 0% null

A non-zero null-rate is the *desired* behaviour: it is the model choosing to decline rather than fabricate. A 0% null-rate on a thin corpus would be the warning sign (it would imply invention).

## 3. Citation coverage

- Filled (non-null) leaves: **50**
- Cited to a retrieved `<doc>`: **50** → **100.0%** citation coverage
- Uncited (value present, no `source_chunk_id`): **0** (Pitfall 6)
- Invented citations (`source_chunk_id` not in the retrieved set): **0** (threat T-097-07 / spoofing)
- Uncited rows (≥1 uncited or invented leaf): **0** 

Every non-null value carrying a `source_chunk_id` that was *actually retrieved* is the deterministic preview of the production `citations_required` gate (TMPL-02).

## 4. Re-prompt (previews `citations_required`)

Re-prompted: **NO — first emission already passed the citation check**.

  - Attempt 1 [claude-opus-4-8, stop_reason=tool_use]: 6 rows, 0 uncited row(s), 0 invented citation(s), 100.0% citation coverage

## 5. Provider verdict (A1)

Anthropic native forced tool-use (`tool_choice={type: tool}`) **HELD** for the nested nullable + citation field-map: the SDK returned a single schema-conformant `tool_use` block that `RiskRegisterFieldMap.model_validate()` accepted. **No pivot to OpenAI strict Structured Outputs was required** — the A1 fallback stays unused, documented in `field_map.py` for the production phase if drift appears at scale.

## 6. Failure-mode observations for Plan 03 / Plan 05 (G-6 log)

- **Pitfall 6 (hallucinated / uncited rows):** 0 uncited value(s), 0 invented citation(s) on the final emission. Clean.
- **Pitfall 7 (stale / multi-version data — OBSERVE only):** 3 distinct source file(s); version spread per file: {Project-Meridian-Status-Report-Week09.docx: [1], Project-Meridian-Charter-Excerpt.docx: [1], Project-Meridian-Risk-Workshop-Notes.docx: [1]}. Single version per file — no freshness ambiguity in this corpus.

## 7. Implication for the production `inputs` schema (TMPL-02 / informs, does not lock)

The cited field-map shape works: **every field nullable + provenance per value** lets the model decline cleanly, and a deterministic coverage+citation pass (no second LLM) is sufficient to enforce "cite or null". The `Cited` provenance belongs in the **run output** (it carries the live `source_chunk_id`), while the future `inputs` schema only needs to declare the *shape* (field keys + types) — confirming the RESEARCH hypothesis (Open Question 4). One sharp edge for production: the retrieval layer does not expose a stable `document_chunks.id` on enriched chunks, so the field-map phase must assign and pass a spotlight id (done here as `chunk-N`); the production `inputs`/citation design should surface a real chunk id end-to-end.
