# Phase 097 Spike — CONCLUSION: Go/No-Go + Recommended Schema Shape

**Spike:** Phase 097 Plan 05 (Wave 3) — THROWAWAY · **Synthesized:** 2026-06-09
**Deliverable (ROADMAP SC#3):** a written go/no-go on the `docxtpl` trusted-template fill path + the recommended additive-optional `inputs` / `assets` / `folder_scope` schema shape (the Phase 098/100/101 lock candidate) + the Phase 101 UAT seed. Rolls up SC#1 (end-to-end artifact), SC#2 (4 unknowns answered), SC#4 (failure-mode UAT seed).
**Evidence base (every claim below cites one of these):** `out/field-map.json`, `out/risk-register-filled.docx` (+ `-1/-5/-20.docx`), `out/corruption.log`, `out/transcript.md`, and the four written answers `out/unknown-a.md`, `out/unknown-b.md`, `out/unknown-c.md`, `out/unknown-d.md`.
**Provider:** the spike ran on ONE provider — Anthropic native SDK, forced `tool_choice`, `claude-opus-4-8` (SC#10 does NOT bind the throwaway spike; cross-provider coverage is mandated for 098+).

> **Two distinctions this conclusion makes explicit, up front:**
>
> 1. **This GO covers the TRUSTED, PRE-AUTHORED template path only.** The spike validated `docxtpl`/Jinja: a `.docx` template authored once (with `{%tr %}` rows and `{{ }}` tags) + AI-derived DATA. The **arbitrary-upload** path — fill ANY user-uploaded `.docx` that has no pre-authored Jinja tags, via non-Jinja run-replace — is the **harder, separate problem** and remains an OPEN unknown deferred to Phase 100/101 (Phase 101 SC#1 requires BOTH paths). **This GO must NOT be read as "all template-fill is solved."**
> 2. **Design principle confirmed — the LLM produces DATA only; deterministic code produces the FILE.** The model emitted a typed, cited field-map (`out/field-map.json`); pinned `docxtpl` code rendered the bytes (`out/risk-register-filled.docx`). The LLM never touched OOXML. This is *why* zero corruption occurred (`out/corruption.log`) and it is the golden rule Phase 101 inherits (TMPL-02/TMPL-03).

---

## DECISION: GO

**(recommended — pending operator confirmation at Plan 05 Task 2)** on the `docxtpl` **trusted-template** fill path, with the named **Conditions** below. The four unknowns are answered, the headline artifact opens clean in a real editor, the variable-row growth surprise (the load-bearing risk, A5) is clean, and the recommended schema shape is additive-optional (zero-migration). This is a **conditional GO** (`go-conditional`): proceed, and carry the conditions the evidence surfaced into Phase 098/100/101/103.

---

## 1. Four Unknowns — Answers (SC#2)

### (a) Can a model DERIVE the field schema and fill it from the KB WITHOUT inventing? → **YES**

`claude-opus-4-8` via Anthropic native **forced** `tool_choice` derived the correct field schema from the template and filled it from the **bound** KB scope, declining (null) rather than inventing. Backed by `out/field-map.json` + `out/unknown-a.md`:

- **Right fields derived.** The emitted field-map covered exactly the template's required top-level keys `['project_name','report_date','rows']` (`field-map.json` → `covered_keys` == `placeholder_keys`), and inferred the nine per-row register columns from the template's `{{ r.<field> }}` tags. `score` was correctly NOT emitted — it is a render-time compute, not an LLM field.
- **Declines, doesn't invent.** Across 56 leaves the model filled 50 and left an **11% null-rate** (`field-map.json` → `null_rate: 0.1071`) on fields the excerpts did not support — the *desired* behavior; a 0% null-rate on a thin corpus would be the invention warning sign.
- **100% citation coverage, 0 invented citations.** Every non-null value carries a `source_chunk_id` that was actually retrieved (`field-map.json` → `citation_coverage_pct: 100.0`, `invented_citation_count: 0`, `uncited_row_count: 0`). This is the deterministic preview of the production `citations_required` gate (TMPL-02).
- **Caught + fixed a real failure mode.** A 4096-token output truncation silently zeroed rows on an early run; instrumenting it (`field-map.json` → `attempts[].output_tokens: 4063`, just under the cap) is why the final emission is whole — a concrete Phase 101 carry-forward (raise/observe the token budget for wide registers).
- **Provider finding A1.** Anthropic forced tool-use was **sufficient** for the nested nullable+citation field-map — `RiskRegisterFieldMap.model_validate()` accepted the single `tool_use` block (`unknown-a.md` §5). **The OpenAI-strict pivot stays documented but UNUSED** (the A1 fallback in the research; cheap to invoke later if drift appears at scale).

### (b) Does KB-grounded `docxtpl` fill produce a CLEAN, re-openable `.docx`? → **GO**

KB-grounded `docxtpl` fill produced a clean, openable risk-register from real KB content. Backed by `out/risk-register-filled.docx` + `out/corruption.log` + `out/unknown-b.md`:

- **Opens clean in a REAL editor (operator-confirmed).** Beyond the python-docx re-open gate (`corruption.log` Pitfall 3: tables=1, rows=7), the operator opened `out/risk-register-filled.docx` in Word/LibreOffice — **no "needs repair" banner**, the `{%tr %}` table grew to **6 risk rows** (one per risk, not a single un-repeated template row), and the scalar tags `project_name`/`report_date` filled (`unknown-b.md` "Real-editor confirmation", `corruption.log` "Pitfall 3 (real-editor)"). This is the strongest evidence for (b).
- **Variable-row growth — clean at 1/5/20 (A5, the load-bearing surprise).** `{%tr %}` grew the body row exactly: n=1→2 rows, n=5→6, n=20→21 (`out/risk-register-filled-1/-5/-20.docx`; `corruption.log` Pitfall 5). docxtpl's table-row repeat is correct for variable-length registers where python-docx/python-pptx **cannot grow a table at all**. A5 is the finding that most affects the docx go/no-go and it landed **clean**.
- **SSTI contained + XML-safe.** Render ran through `DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))`; the `&<>` probe (`Acme & <Corp> risk`) escaped to `&amp;/&lt;/&gt;` and survived as literal text (`corruption.log` Pitfall 2; `unknown-b.md` §3-§4). The SSTI containment mechanism (TMPL-03 / T-097-08) is wired and demonstrated even on the trusted spike template.
- **All six named pitfalls clean** (`out/corruption.log`): Pitfall 1 (run-split — N/A by design for docxtpl), 2 (`&<>`), 3 (won't-open — incl. real-editor), 4 (tag boundary), 5 (variable rows), 6 (uncited rows) all `clean`.
- **Honest carry-forward.** The real KB states probability/impact as WORDS (High/Medium/Low), which do not parse as ints, so the deterministic `score = P×I` compute left the **real doc's Score column blank** (`unknown-b.md` §1 + "Phase 101 carry-forward"). This is a graceful, honest degrade (blank, not wrong), accepted by the operator as expected — NOT corruption. The synthetic `-1/-5/-20.docx` use numeric P/I and DO show P×I. Production needs a worded→numeric mapping (see Conditions).

### (c) What authoring-time grounding does the NL→workflow generator NEED? → **clear grounding inventory**

The grounded one-shot generation over the strict `WorkflowDefinition` schema produced a correctly-typed draft and a clear MUST-HAVE vs nice-to-have grounding inventory. Backed by `out/transcript.md` + `out/unknown-c.md`:

- **MUST-HAVE grounding (the draft actually USED it):** (1) the KB **folder tree** (name+id) — the draft bound `Project Meridian — Risks` / `Weekly reports` by real id; (2) the **tool registry** (names only) — the draft whitelisted only real registry tools, **zero off-registry hallucinations**; (3) the **template placeholder set** (`project_name`, `report_date`, `rows`) — used to shape the fill step (`unknown-c.md` grounding table; `transcript.md` §Design-time grounding).
- **Nice-to-have / unused:** the **skill registry** (3 skills provided, none referenced in this run) — carry it so skill-backed phases are authorable, but lower-priority (`unknown-c.md`).
- **The folder_scope seam finding (the load-bearing schema gap).** The current strict schema has **no** `folder_scope` field, so scope could only land as **resolved folder ids embedded in prompt TEXT** — a hint the agent can widen, not a server-side bound parameter (`unknown-c.md` "folder_scope shape finding"; `transcript.md` shows the id `75755ec9-…` written into the `llm_agent` prompt). This confirms the need for an **additive BOUND `folder_scope`** (PROJ-02) plus **spoken-path→id resolution** at authoring time (the tree has `Project Meridian — Risks` but no literal `/Risks` child, so the generator had to resolve a spoken path against the real tree).

### (d) Does describe → refine → publish FEEL good (talking, not wiring)? → **MIXED (non-blocking)**

The operator's subjective verdict (the call the spike could not automate — VALIDATION manual-only) is **MIXED**, gated on two named conditions. Backed by `out/unknown-d.md` + `out/transcript.md`:

- **What felt GOOD:** one sentence → a correctly-typed 4-phase pipeline (`llm_agent`→`llm_single`→`llm_human_input`→`llm_agent`); the refine turn felt conversational (the operator never touched a field by hand); human-confirm was *inferred* from the wording in the first draft; tools + template fields came through clean (`unknown-d.md` "What felt GOOD"; `transcript.md` §1-§2).
- **What made it MIXED — silent guessing on grey areas.** The generator **silently GUESSED** on ambiguities instead of surfacing them: it substituted a non-existent **"Acme" folder** with `Project Meridian — Risks` and mapped a non-existent **"/Risks subfolder"** onto the whole folder — both presented as settled fact, never surfaced for confirmation (`unknown-d.md` "What made it MIXED"; `transcript.md` §1 description "the Acme project folder", §2 refine "/Risks subfolder"). It happened to guess right, but a wrong guess would have shipped just as silently.
- **The two operator conditions for GOOD** (carry-forward to Phase 103, both acceptance bars not nice-to-haves): (1) a **clarify-as-you-go grey-area VALIDATION loop** — surface every unresolvable folder ref / vague scope / unmapped placeholder / missing tool, user validates each, **no silent substitution**, until the workflow is built; (2) **post-build EDITABILITY / VERSIONING** — tweak a built workflow into v2, v3 (immutability is **per-version**, not per-workflow; compatible with `WorkflowDefinition.version` + the "no-edit-published" anchor) (`unknown-d.md` "The two requirements").
- **Why MIXED is non-blocking for THIS go/no-go:** the authoring *mechanism* works (grounded one-shot generation + conversational refine over the strict schema produces correctly-typed, schema-valid drafts), so the spike **de-risks** the Phase 103 generator. The gap is in the *experience*, and both fixes are Phase 103 work — they do not invalidate the docxtpl fill path or the schema shape this conclusion recommends.

---

## 2. GO / NO-GO (SC#3)

### DECISION: GO  *(recommended — conditional; pending operator confirmation)*

**On:** the `docxtpl` **trusted, pre-authored library template** fill path (the Phase 101 production target for the trusted path).

**Rationale (evidence-cited):**
- (b) is a clean GO — `out/risk-register-filled.docx` opens in a real editor with no repair banner; the `{%tr %}` table grew exactly at 1/5/20 rows (A5 clean, `out/corruption.log`); autoescape contained `&<>`; all six pitfalls clean.
- (a) is YES — `out/field-map.json` shows 100% citation coverage, 0 invented citations, an 11% decline-rate (declines rather than invents); Anthropic forced tool-use sufficient (A1).
- (c) gives a clear grounding inventory and surfaces the single most important additive field (bound `folder_scope`).
- (d) is MIXED but non-blocking — the mechanism works; the two gaps are Phase 103 experience work.
- The recommended schema shape (§3) is **additive-optional → zero-migration**: old published `WorkflowDefinition` rows still `model_validate()` cleanly.

### Conditions (the GO is conditional on these)

1. **Production render MUST run in the sealed Docker sandbox (Phase 101), not the local venv.** The spike rendered LOCALLY in the backend venv for the fast loop (`unknown-b.md` "Render ran LOCAL … production render is the sealed Docker sandbox (Phase 101)"). Production must render inside the sealed, network-less sandbox (SSTI containment, TMPL-03).
2. **`docxtpl` must be added to `backend/Dockerfile.sandbox` + `SANDBOX_IMAGE` tag bumped — in Phase 101, NOT in this spike.** `docxtpl==0.20.2` is the only new dependency; it is absent from the sandbox image today (the spike installed it into the venv only). Per CLAUDE.md the tag bump only affects NEW chats.
3. **Worded likelihood/impact → numeric mapping is needed for the Score compute (Phase 101).** Real risk-register KB content speaks in High/Medium/Low; the deterministic `score = int(P)×int(I)` compute leaves Score blank on worded inputs (`unknown-b.md` §1, "Phase 101 carry-forward"). Add a categorical→ordinal mapping (e.g. Low=1/Med=2/High=3) at context-build time — a deterministic, NON-LLM compute.
4. **The Phase 103 authoring loop MUST add (i) a grey-area validation step (no silent substitution) and (ii) a tweak→new-version path** (the operator's two unknown-d conditions; `out/unknown-d.md`). These move the feel from MIXED to GOOD.
5. **The arbitrary-upload fill path remains an OPEN unknown for Phase 100/101.** This GO covers TRUSTED, pre-authored Jinja templates only. The non-Jinja run-replace path for arbitrary uploads (Phase 101 SC#1's second path) was NOT exercised by the spike and is the harder, separate problem.
6. **Findings A1 and A5 are recorded explicitly:** **A1** — Anthropic forced tool-use was sufficient; the OpenAI-strict pivot stays documented but **UNUSED** (invoke only if drift appears at scale). **A5** — `{%tr %}` row growth was **clean** at 1/5/20 rows; the single most go/no-go-affecting docx finding landed clean.

---

## 3. Recommended Additive-Optional Schema Shape (SC#3)

> **This is a RECOMMENDATION for Phase 098/100/101 to LOCK — NOTHING is committed here.** No edit to `backend/app/models/harness.py`, no SQL migration. Every field is **OPTIONAL** so existing published `WorkflowDefinition` rows still `model_validate()` cleanly — **zero-migration, additive** (research A4, confirmed against `harness.py`'s "no-edit-published" immutability: adding optional fields is non-breaking).

```python
# additive on WorkflowDefinition (all OPTIONAL — old rows validate unchanged)
project_folder_id: UUID | None = None          # PROJ-01: project = folder + subtree
inputs:  list[InputFieldSpec] | None = None    # AI-derived launch form (dynamic@design, fixed@run)
assets:  list[AssetRef]       | None = None    # Storage-backed workflow-owned templates/refs

class InputFieldSpec(_StrictBase):
    key: str
    label: str
    type: Literal["text","number","date","enum","file","kb_auto"]
    required: bool = True
    source: Literal["user","kb_auto","template_derived"] = "user"   # see Open Q (i)
    enum_options: list[str] = []                                    # when type == enum
    folder_scope: list[UUID] | None = None       # if kb_auto: RESOLVED ids, not a path (Open Q iii)
    # NOTE: NO `Cited`/provenance field here — provenance lives in run OUTPUT (Open Q ii)

class AssetRef(_StrictBase):
    asset_id: str                                # Storage path / id
    filename: str
    kind: Literal["template","reference"]
    mime: str

# additive on LlmAgent / LlmSingle phase configs
folder_scope: list[UUID] | None = None           # PROJ-02: per-phase retrieval narrowing — BOUND resolved ids
```

### The three open questions, settled by the evidence

| # | Open question | Resolution | Evidence |
|---|---------------|-----------|----------|
| (i) | Does `InputFieldSpec` need a `template_derived` provenance flag? | **YES — keep it, as a `source` enum value** (`"user" / "kb_auto" / "template_derived"`). The generator reliably distinguished template-placeholder-derived fields (`project_name`/`report_date`/`rows`) from description-derived intent, so authoring-time provenance is worth declaring on the input spec. | `out/transcript.md` (template placeholders used as a distinct grounding source); `out/unknown-c.md` (placeholder set is MUST-HAVE grounding) |
| (ii) | Does `Cited` provenance belong in `inputs` or only in run OUTPUT? | **Run OUTPUT only.** `inputs` declares the *shape* (keys + types); the live `source_chunk_id`/`source_doc` provenance is a run-time artifact. The field-map JSON carries citations per value at run time, exactly where the `citations_required` gate reads them. | `out/field-map.json` (provenance lives on each run value: `value`+`source_chunk_id`); `out/unknown-a.md` §7 |
| (iii) | Is `folder_scope` a string path or a resolved id list? | **A BOUND resolved-id list** (`list[UUID]`), with **authoring-time path→id resolution**. A string path is a hint the agent can widen; the engine binds resolved ids via the existing `ToolContext.folder_subtree_ids` seam. The generator must RESOLVE spoken folder names/paths against the real tree at authoring time. | `out/unknown-c.md` "folder_scope shape finding" (scope = resolved id(s), not a string path; `extra="forbid"` rejected an invented key, so scope leaked into prompt text); `out/transcript.md` (id embedded in prompt) |

**One sharp edge surfaced for the lock (carry-forward, not a blocker):** the retrieval layer does not expose a stable `document_chunks.id` on enriched chunks, so the spike assigned spotlight ids (`chunk-N`). The production `inputs`/citation design should surface a real end-to-end chunk id (`out/unknown-a.md` §7).

---

## 4. Phase 101 UAT Seed — the Six Named Failure Modes (SC#4 / G-6)

These are the pre-named "How we'd know this failed" UAT rows Phase 101 inherits (G-6). Each row is the spike's observed result + where the evidence lives. Source: `out/corruption.log` (+ `out/field-map.json` for Pitfall 6).

| # | Failure mode | Spike result | Evidence / note |
|---|--------------|--------------|-----------------|
| Pitfall 1 | docx run-split silent miss | **clean (N/A for docxtpl)** | docxtpl tags are run-safe by DESIGN (each tag in one run/row); no residual `{{`/`{%`. The non-Jinja run-replace path where this CAN bite is **Phase 101 (arbitrary upload)**. `corruption.log` |
| Pitfall 2 | unescaped `& < >` XML corruption | **clean** | Seeded `Acme & <Corp> risk`; `autoescape=True` escaped to `&amp;/&lt;/&gt;`; file re-opened, literal text survived. `corruption.log`, `risk-register-filled-1.docx` |
| Pitfall 3 | produced file won't open | **clean (incl. REAL editor)** | python-docx re-open passed (tables=1, rows=7) AND operator confirmed a real-editor open with no repair banner + 6 grown rows. `corruption.log`, `unknown-b.md`, `risk-register-filled.docx` |
| Pitfall 4 | docxtpl tag spans a structural boundary | **clean** | No `TemplateSyntaxError` on the real fill or 1/5/20 renders — each `{%tr %}` sits in its own row. `corruption.log` |
| Pitfall 5 | variable-length rows (the load-bearing surprise, A5) | **clean** | `{%tr %}` grew exactly: 1→2, 5→6, 20→21 rows. python-docx/pptx cannot grow tables. `corruption.log`, `risk-register-filled-{1,5,20}.docx` |
| Pitfall 6 | hallucinated / uncited rows | **clean** | `field-map.json`: uncited_row_count=0, invented_citation_count=0, 100% citation coverage — previews `citations_required`. `field-map.json`, `unknown-a.md` |
| Pitfall 7 | stale / multi-version data (observe-only) | **not-exercised** | Single version per source file — no freshness ambiguity in this corpus. The `freshness` gate is **Phase 102**; the spike only OBSERVES. `corruption.log`, `field-map.json` `multi_version_observed:false` |
| Pitfall (pptx) | `.pptx` variable-row table growth | **not-exercised — DEFERRED to Phase 101** | docx-first spike. python-pptx cannot grow tables (pptx #192). Phase 101 UAT row. `corruption.log` |
| Pitfall (xlsx) | `.xlsx` cell-write / chart strip | **not-exercised — DEFERRED to Phase 101** | docx-first spike. openpyxl cell-write + chart preservation. Phase 101 UAT row. `corruption.log` |

> Phase 101 SC#4 also names **merged-cell mis-write** and the **arbitrary-upload run-replace** miss — both **not exercised** here (docx trusted-template only); they enter Phase 101 as fresh UAT rows alongside the pptx/xlsx deferrals.

---

## 5. What the Spike Does NOT Do

This is a **throwaway** spike (SEED-051). It commits NO production surface:

- **No schema committed.** §3 is a RECOMMENDATION written to this file only — **no edit to `backend/app/models/harness.py`**.
- **No SQL migration** created (research A6 — the spike persists nothing to the DB; all evidence is files under `scripts/spike-097/out/`).
- **No `backend/Dockerfile.sandbox` change** and no `SANDBOX_IMAGE` bump — that is the Phase 101 production add (Condition 2).
- **No production code** — orchestration glue lives entirely in `scripts/spike-097/` (repo root, OUTSIDE `backend/`'s uvicorn `--reload` tree, off the G-5 hot files `threads.py` / `anthropic_service.py`). `docxtpl` was installed into the venv for the fast loop only.
- **No cross-provider matrix** — single provider by design (SC#10 binds 098+, not the spike).
- **No arbitrary-upload path** — only the trusted, pre-authored `docxtpl`/Jinja template was exercised.

**Throwaway artifacts produced (the evidence, all under `scripts/spike-097/`):** `run_spike.py`, `derive_fields.py`, `field_map.py`, `render_docx.py`, `authoring_feel.py`, `make_template.py`, `make_sample_corpus.py`, `find_risk_folder.py`, `templates/risk-register.docx`, `sample-corpus/`, and `out/` (`field-map.json`, `risk-register-filled.docx` + `-1/-5/-20.docx`, `corruption.log`, `transcript.md`, `unknown-a/b/c/d.md`, `kb-folders.json`, `spike-config.json`).

**The Phase 101 production add (NOT done here):** add `docxtpl==0.20.2` to `backend/Dockerfile.sandbox`, rebuild, bump `SANDBOX_IMAGE`; render inside the sealed sandbox; add the worded→numeric Score mapping; build BOTH the trusted (`docxtpl`) and arbitrary-upload (run-replace) fill paths with the full failure-mode UAT scoreboard.

---

## Operator Sign-Off (Plan 05 Task 2 — checkpoint:decision)

> The recommended decision above is `DECISION: GO` (conditional — `go-conditional`). A continuation agent records the operator's confirmed choice (`go` / `go-conditional` / `no-go`) and any added/removed conditions here, then closes the plan. **Pending operator confirmation.**

**Confirmed decision:** _pending_
**Conditions added/removed by operator:** _pending_
