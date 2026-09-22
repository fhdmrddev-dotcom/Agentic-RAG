# Phase 263: An Expert Can Be Given Its Capabilities — Research

**Researched:** 2026-09-21
**Domain:** LLM-assisted skill authoring · Pydantic structured output · Postgres provenance columns · React modal reuse
**Confidence:** HIGH (everything below was measured in this session; each claim carries the command or file:line that produced it)

⛔ **Every line number, count and triple in this document was re-derived in this session.** Where a
locked decision or a prior register disagrees with the measurement, the measurement is reported as a
finding beside the original, never silently planned around.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions — D-263-01 .. D-263-12 (verbatim summary, NOT re-opened)

| # | Decision |
|---|---|
| **D-263-01** | Sketch 263 **variant A** is the locked UI. The shipped `Bound Knowledge & Capabilities` card splits into **"In your library"** (solid `⚡` pills, unchanged) and **"Proposed for this Expert"** (dashed `⬡` cards, name + one-line description). Dashed border + violet accent are the ONLY *"does not exist"* signal — no red, no error styling. `Create this skill →` opens the **existing** `SkillFormDialog`, pre-filled. ⛔ No new studio screen, no wizard step. |
| **D-263-02** | `suggested_new_skills` is a **REQUIRED** field on `ExpertDraftOutput`, and may be empty. `Field(..., min_length=0)` over a nested model carrying `name`, `description`, `why_needed`. ⛔ **Never `Field(default=[])`.** |
| **D-263-03** | The write path is the EXISTING `POST /skills`. Variant A's UI **is** `SkillFormDialog`, so this adds **zero new API surface**. |
| **D-263-04** | The instructions body is authored by the EXISTING `skill-creator`, on approval. A proposal carries `name` + `description` only; pressing `Create this skill →` authors the body and the dialog opens pre-filled for human review. |
| **D-263-05** | The row is written **IMMEDIATELY on approve**. An abandoned Expert leaves real library rows, not garbage. |
| **D-263-06** | `resolve_expert_bundle`'s skill predicate gains a **THIRD ARM**: `... OR (the skill was born for THIS bundle)`. ⛔ The `org_id == caller_org_id` fence is UNTOUCHED. Needs its own RED drive. |
| **D-263-07** | **Migration 190** adds `public.skills.born_for_expert_bundle_id uuid NULL`. ⚠ `is_org_shared` is NOT touched and the publish gate is NOT bypassed. |
| **D-263-08** | The marker is **BACKFILLED at Expert save** — created `NULL`, one `UPDATE` in the Expert save path stamps it. An abandoned Expert leaves it `NULL`. |
| **D-263-09** | The fence lives in **BOTH** places, and the server is the real one. Frontend: disabled `Save Expert` + inline banner naming the count. Backend: `POST /experts` and `PATCH /experts/{id}` independently re-check. |
| **D-263-10** | The server **REFUSES with a named 422** naming **each** unknown skill so any client can render the banner from the response. |
| **D-263-11** | The closed-core inventory is **measurably unchanged** from this phase's base commit. Mirror D-259-06's AST test: **counted, never substring-matched.** |
| **D-263-12** | **`PACK-17` is DRIVEN, not asserted** — a cross-org caller must find a foreign-org skill neither visible nor resolvable. |

### Claude's Discretion (verbatim, D-263-04 derived)

> Because the body is generated before the dialog opens, there is a loading moment between click
> and dialog that the sketch does not show. **Render it in place on the proposal card** (the card
> enters a generating state); do **not** open an empty dialog and fill it, and do **not** add a
> separate "Generate instructions" button.

### Deferred Ideas (OUT OF SCOPE — ignore completely)

- The blueprint prose is never rewritten when a claimed capability is dropped.
- `is_org_shared` and the publish gate are untouched.
- `SEED-103` (batched interview questions for `skill-creator`).
- `SEED-104` (agent-driven skill file attachment) — a proposed skill is created with instructions only, **no files**.
- `SEED-187` (turning a long document into a teachable skill).
- A skill marketplace · cross-org skill sharing · any change to the agent loop, executors, emitters or the tool registry · a client-side URL router.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (from `.planning/REQUIREMENTS.md:137-152`) | Research Support |
|----|-------------|------------------|
| **PACK-14** | Drafting an Expert names the domain skills it needs that **do not exist yet** — named, described, and visibly distinguished from the skills already in the library. | §A (the `ExpertDraftOutput` nested-model idiom + the `_generate_fallback_draft` trap) · §G (the variant-A split and its two existing mount points) |
| **PACK-15** | A proposed skill becomes real **only on human approval**, one at a time, created through the **existing** `skill-creator` / `save_skill` path. ⛔ A second skill-authoring engine is the thing to refuse, and the closed-core inventory must be measurably unchanged. | §1 (**the decisive finding** — `skill-creator` is an interactive interview loop, not a one-shot prompt; the driver-vs-engine distinction and its falsifiable fence) · §E (closed-core counts verified 7/1/29/10) |
| **PACK-16** | An Expert saved with a skill that does not exist **says so before it is saved**. | §D (the 422 envelope precedent **and the bare-`except` trap that would destroy it**) |
| **PACK-17** | A skill authored for one org is **never** visible or resolvable to another, driven against a cross-org caller. | §F (`skills_autofill_org_id` verified non-caller-supplied; the PACK-04 drive shape to mirror; the sharpest drive for the new third arm) |

</phase_requirements>

---

## Summary

Three things were measured this session that change how this phase must be planned.

**First, and most important: `skill-creator` is not callable, and its instructions are not a
one-shot authoring prompt.** The grep the orchestrator ran before spawning me is correct — every
`skill-creator` hit in `backend/app/` and `frontend/src/` is a migration filename or a comment about
a seeded row. But going one level deeper found the row itself
(`supabase/migrations/087_skill_creator_reborn.sql:66-91`, id `…0010`, verified live in the local
DB), and its `instructions` are a **seven-step interactive interview loop** that opens *"Move one
step at a time and keep the user in control"*, tells the model to call `search_documents` and
`save_skill`, and spends steps 4-7 on Studio navigation. **Driving that verbatim as a `forced_emit`
system prompt would produce interview questions, not a skill body.** D-263-04's *intent* (reuse, do
not build a second authoring engine) survives intact; its *literal reading* does not. §1 resolves
this with a reuse that is real and testable rather than rhetorical, and names the one falsifiable
fence that makes the distinction enforceable.

**Second, this codebase already contains two `forced_emit`-based skill-text authoring services** —
`skill_tuner_service.build_candidates` (rewrites a skill's DESCRIPTION) and
`skill_proposer_service.propose` (rewrites a skill's INSTRUCTION BODY,
`backend/app/services/skill_proposer_service.py:335-406`). Neither appears in CONTEXT.md. The second
is a near-exact structural mirror of what D-263-04 needs and is the call site a plan should copy —
but it is **not directly callable** here, because it requires an existing skill row, a base version
and an eval run, none of which a proposal has.

**Third, two trap-shaped defects sit directly in this phase's blast radius.** `create_expert`
(`backend/app/api/experts.py:73-85`) wraps its service call in a bare `except Exception` that
converts *everything* into a **400** with a stringified detail — so a 422 raised inside that `try`
is silently destroyed, and D-263-10's named refusal never reaches a client. And **every skills
vitest suite is in neither knob of the count gate**: `grep -ic "skill" scripts/vitest-count-gate.cjs`
returns **0**, so `SkillFormDialog.test.tsx` — the file variant A reuses — runs nowhere and guards
nothing.

**Primary recommendation:** Build the body-authoring module as a **driver** that reads the
`skill-creator` row's §3 craft doctrine from the database at call time and contributes no authoring
doctrine of its own — fenced by a test that turns RED when craft prose is inlined. Land the 422
**above** `create_expert`'s `try:`. Adopt `SkillFormDialog.test.tsx` into both gate knobs in the
same wave that touches the dialog.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Naming skills that do not exist (PACK-14) | **API / Backend** (`expert_authoring.py`) | Frontend (render only) | It is a field on an LLM structured output; the schema is the contract (D-263-02). The studio renders what the draft returns and derives nothing. |
| Distinguishing proposed vs. real (PACK-14) | **Browser / Client** | — | Pure presentation. The draft already tells the client which list each name belongs to; no second API read. |
| Authoring the instruction body (D-263-04) | **API / Backend** (new driver module) | Database (reads the `skill-creator` row) | A provider call with credentials. ⛔ Never the browser. |
| Writing the skill row (D-263-03/05) | **API / Backend** (`POST /skills`, existing) | — | Zero new API surface. RLS + `skills_autofill_org_id` are both server-side. |
| Save-time existence fence (PACK-16) | **API / Backend** (`api/experts.py`) | Browser (advisory mirror, D-263-09) | ⛔ A UI-only fence is not a fence. The server is the real one. |
| Provenance marker (D-263-07/08) | **Database / Storage** (migration 190) | Backend (one backfill `UPDATE`) | A nullable column + one write. No engine code. |
| Run-time resolution (D-263-06) | **API / Backend** (`expert_service.py`) | Database (one extra SELECT column) | Python-side filter over rows already fetched — see §C. |
| Cross-org isolation (PACK-17) | **Database / Storage** (trigger + RLS) | Backend (driven test) | ⭐ Already structural and shipping. This phase **drives** it; it does not build it. |

---

## Project Constraints (from CLAUDE.md)

| Directive | Bearing on this phase |
|---|---|
| Python backend must use a `venv` | All pytest runs in this document used `backend/venv/Scripts/python.exe`. |
| Backend baseline gate: `pytest tests/unit -q --continue-on-collection-errors`, ceiling **71 failed**, zero headroom | See §H. Do not run the full suite per task; run the targeted suites named there. |
| **No LangChain, no LangGraph — raw SDK calls only** | The body-authoring driver must go through `forced_emit` → the provider gateway, exactly as `expert_authoring.py` and `skill_proposer_service.py` already do. |
| **Use Pydantic for structured LLM outputs** | D-263-02's nested model and the body-authoring emission model are both Pydantic v2. |
| All tables need RLS | `public.skills` already has 4 policies (§B). A nullable column add needs no policy change — proven in §B. |
| Migrations are numbered SQL under `supabase/migrations/`, applied by **pasting into the Supabase SQL editor**, never `db push`/`db reset`; then `bash scripts/regenerate-full-schema.sh` | Migration 190 is DB-mutating → its plan is `autonomous: false`. |
| **The Extension Contract (EXT-01)** — a plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE, never engine code | ⭐ `docs/EXTENSION-CONTRACT.md:26` lists **Skills** as the first row of the *Open by Design* table: *"DATA (Markdown + YAML)"*. This phase creates DATA. That is its entire legal basis, and it is explicit rather than inferred. |
| G-5 hot-file ledger; G-8 plan proportion (target 3-5) | §G and §H carry the re-derived triples. Three files in this blast radius have stale or absent rows. |
| Provider-docs-first | Not triggered — this phase adds no provider-specific handling; it reuses `forced_emit`, which already owns the per-provider rung ladder. |

---

## 1. THE OPEN QUESTION — `skill-creator` is not callable, and its instructions are not a prompt

### 1.1 Is there ANY existing programmatic path that runs `skill-creator` to author a skill body?

**No. Measured, three ways.**

```
$ grep -rn "skill-creator\|skill_creator" backend/app/ frontend/src/
```

Ten hits, **zero callable**: `api/setup.py:74,79,80,81` (migration filenames in a list),
`api/skills.py:207,219` (comments), `models/skill.py:24` (comment), `utils/folder_utils.py:209`
(docstring), `utils/skill_visibility.py:21` (docstring), plus two frontend files echoing the
migration filenames into a setup panel. **The orchestrator's pre-spawn measurement is confirmed.**

The three paths named in the brief, each checked:

| Path | Verdict | Evidence |
|---|---|---|
| **Agent path** — `_handle_save_skill` | Exists, but is a **writer, not an author**. It takes `name`/`description`/`instructions` **already written by the model** and inserts them. It does not generate a body. | `backend/app/services/tool_dispatcher.py:1435-1438` — `name = args.get("name")`, `instructions = args.get("instructions", "")`. Registered at `:4555`. |
| **Setup/seed path** — `api/setup.py` | Lists migration **filenames** for an operator to paste. No runtime behaviour. | `backend/app/api/setup.py:74-81` |
| **Does anything load a skill row's `instructions` into a prompt?** | **Yes — but only into the open agent loop, never into a sealed authoring shot.** `_handle_load_skill` returns `row["instructions"]` as a tool result, which the agent then follows in-conversation. | `backend/app/services/tool_dispatcher.py:1305`, `:1410` (the `skill_instructions_override` branch); `agent_loop.py:688` — *"call silently and then follow the skill's instructions exactly"* |

⭐ **And the finding CONTEXT.md does not contain: two services already author skill TEXT via
`forced_emit`.**

| Service | What it authors | Line |
|---|---|---|
| `skill_tuner_service.build_candidates` | a skill's **DESCRIPTION** (for triggering) | `backend/app/services/skill_tuner_service.py:203` |
| `skill_proposer_service.propose` | a skill's **INSTRUCTION BODY** | `backend/app/services/skill_proposer_service.py:335` |

`skill_proposer_service` is the structural sibling D-263-04 needs — and it is **not directly
callable here**, which is why a new module is unavoidable. Its signature requires an existing row,
a version and an eval run, none of which a *proposal* has:

```python
# backend/app/services/skill_proposer_service.py:335-344
async def propose(
    *,
    skill: dict,            # an EXISTING skills row
    base_version: dict,     # an EXISTING skill_versions row
    source_run_id: str,     # an EXISTING eval_runs row
    evidence: dict,         # assembled from eval_results / skill_test_cases
    user_settings: Any,
) -> SkillProposal | None:
```

### 1.2 ⛔ THE DECISIVE MEASUREMENT — what `skill-creator`'s instructions actually are

The row exists and was read live:

```
$ python -c "... SELECT name, is_system ... FROM public.skills ..."
COUNT = 10
 - financial_ratio_calculator | sys= True  | shared= True  | enabled= True
 - skill-creator              | sys= True  | shared= True  | enabled= True
 - arabic-tender-document     | sys= False | shared= False | enabled= True
 - docx                       | sys= False | shared= True  | enabled= True
 - meridian-executive-report  | sys= False | shared= False | enabled= True
 - pptx                       | sys= False | shared= False | enabled= True
 - project-brief-summarizer   | sys= False | shared= False | enabled= True
 - risk-lens_099uat           | sys= False | shared= False | enabled= True
 - weekly-report-writer       | sys= False | shared= False | enabled= True
 - xlsx                       | sys= False | shared= False | enabled= True
```

⭐ **`BUG-260921-01`'s central claim is VERIFIED LIVE: exactly 10 rows, exactly 2 system.** The bug
is real and current, not a stale reading.

⚠ **A second measurement nobody asked for, and it makes D-263-06's case stronger than CONTEXT
states:** of the eight non-system skills, **only `docx` has `is_org_shared = True`**. Seven of eight
are private-to-author. So the "second hollowness" D-263-06 closes is not a theoretical edge — it is
the condition **87.5% of the current library is already in**.

The source of the `instructions` (`supabase/migrations/087_skill_creator_reborn.sql:81-118`),
quoted because this is the claim that decides the phase's shape:

> `You are **skill-creator**, a built-in guide that helps the user turn a repeatable task into a
> saved, tested Skill on THIS platform. … Move one step at a time and keep the user in control —
> confirm before you save, and never invent capabilities.`
>
> `## 1. Interview — understand the task before writing anything` / `Ask focused questions, one
> small batch at a time:` …
> `## 2. Research with our knowledge base` / `call \`search_documents\`` …
> `## 3. Draft and save with \`save_skill\`` …
> `## 4. Propose test cases and hand off to the Studio` … `## 5. Evaluate honestly` …
> `## 6. Improve` … `## 7. Publish`

⛔ **This cannot be driven verbatim as a one-shot `forced_emit` system prompt, for four independent
reasons, each measured in the text above:**

1. It is **multi-turn by construction** — *"Move one step at a time"*, *"Ask focused questions, one small batch at a time"*, *"get a 'yes, that's right' before drafting"*. A sealed single shot has no second turn.
2. It instructs the model to **call tools** (`search_documents`, `save_skill`, `load_skill`, `read_skill_file`, `execute_code`). A `forced_emit` shot passes exactly one tool — the emitter — with `tool_choice` forced to it. The model would be told to call tools it cannot see.
3. **Step 3 tells the model to call `save_skill`** — a direct conflict with the forced emitter, and with D-263-03's decision that the write goes through `POST /skills`.
4. **Four of its seven steps (4-7) are Studio navigation, evals and publishing** — they have no meaning in a body-authoring shot and would consume the model's attention budget.

⛔ **THIS IS A MEASURED CONTRADICTION WITH D-263-04 AS LITERALLY WORDED, AND IT IS REPORTED RATHER
THAN PLANNED AROUND.** D-263-04 says *"runs `skill-creator` to author the body"*. There is no
`skill-creator` to run, and its text is choreography for a conversation, not a prompt for an
emission. **The decision's force — "reuse, do not build a second authoring engine" — is intact and
is honoured below.** What is not implementable is the literal reading.

### 1.3 The correct shape: a DRIVER, not an ENGINE — and what makes that distinction testable

**The reusable asset inside `skill-creator` is §3's craft block**, which is authoring doctrine and
nothing else. Verbatim from the migration (`:100-105`):

> - **Imperative form.** Write directives to the agent ("Extract the risks," not "The agent should extract risks").
> - **Explain the why, sparingly.** A short reason beats a wall of MUST rules — the agent generalizes better from intent than from a checklist.
> - **Generalize, don't overfit.** Describe the shape of the task, not one exact example.
> - **A pushy-but-honest description.** … but never claim more than the skill actually does.
> - **Progressive disclosure.** Keep the core instructions lean.

Steps 1, 2 and 4-7 are interaction choreography. Step 3's craft bullets are the doctrine. **Saying
so plainly is more honest than pretending the whole row is reusable.**

**The distinction between a driver and an engine, made real:**

> A module is a **DRIVER** if it contributes **no authoring doctrine of its own** — it reads the
> doctrine from `public.skills WHERE id = '00000000-0000-0000-0000-000000000010'` at call time,
> composes it with the Expert's context, and binds the emission to a Pydantic model.
> A module is an **ENGINE** if the doctrine lives in its own source as prompt prose, because then
> `skill-creator` can change and the module will not.

⭐ **That is falsifiable, and here is the fence that falsifies it** (this is what makes the
distinction real rather than rhetorical):

- **Fence 1 — the doctrine is READ, not written.** Assert the module performs a DB read keyed on the
  `skill-creator` row, and that with that read stubbed to return `""` the resulting system prompt
  contains **none** of the five craft bullets' distinctive tokens (`Imperative form`,
  `Progressive disclosure`, `overfit`, …). **Drive it RED** by inlining one bullet as a module
  literal; restore and verify md5-identical.
- **Fence 2 — the closed core is unchanged.** D-263-11's mirror of `test_259_closed_core_inventory.py`
  (§E), counted not substring-matched.
- **Fence 3 — no second write path.** Assert the module never inserts into `public.skills`; the row
  is written only by `POST /skills` (D-263-03).

⚠ **The honest counter-argument, recorded rather than hidden.** `skill_proposer_service` already
carries its own `_PROPOSER_SYSTEM_PROMPT` as module prose (`:78-90`). So *"prompt prose lives in the
service"* is the established precedent in this codebase, and a reviewer could legitimately say the
DB-read is stricter than anything shipping. **Both facts are true.** The DB-read is proposed because
PACK-15 names `skill-creator` explicitly and this is the only reading under which that name means
something executable. A plan that instead mirrors `skill_proposer_service` byte-for-byte with its
own prompt constant is *defensible*, but it should say so in CONTEXT rather than claim it reuses
`skill-creator`.

⚠ **One more thing a plan must decide, surfaced not settled:** `skill_proposer_service.propose` is
gated fail-closed by `self_improve_enabled()` (`:355-368`, FLAG-01). That kill-switch governs the
**agent improving its own skills**. Authoring a *new* skill a human explicitly approved is arguably
a different act. ⛔ **Do not copy the gate reflexively and do not omit it silently** — name the call.

### 1.4 What `forced_emit` requires — the call site to mirror exactly

**Signature** (`backend/app/services/forced_emit.py:344-356`) — keyword-only throughout:

```python
async def forced_emit(
    *,
    messages: list[dict],
    model: str,
    provider: str,
    emitter: str,
    tools: list[dict],
    user_settings: Any,
    system_prompt: str = "",
    max_tokens: int | None = None,
    schema_model: type[BaseModel] | None = None,
    strict: bool | None = None,
) -> dict:
```

**The rung ladder** (`:242-255`), tier-scoped from the model's registry `emit_tier`:

```python
_RUNGS_BY_TIER: dict[str, list[tuple[str, bool, bool]]] = {
    "force_strict": [("strict_force", True, True), ("non_strict_force", True, False), ("coerce", False, False)],
    "force":        [("non_strict_force", True, False), ("coerce", False, False)],
    "coerce":       [("coerce", False, False)],
}
```

**How the Pydantic model is passed, and how failure falls through — ⭐ D-263-02's safety claim is
VERIFIED:**

- `schema_model` flows to `_extract_or_recover` (`:549`) → `_validate_args` (`:140-157`), which does
  `_model.model_validate(data)` inside a bare `try` and **returns `None` on any validation error —
  never raises**.
- A `None` there sets `last_failure = "model_failed_to_emit"` (`:571`) and the `for` loop
  **descends to the next rung** (`:572`).
- Exhausting the ladder returns the honest `_failure` floor with `emitted=None` (`:578-589`) — never
  silent, never fabricated.

⛔ **BUT THERE IS A CAVEAT D-263-02 DOES NOT ACCOUNT FOR, AND IT HALVES THE SAFETY MARGIN.**
`generate_expert_draft` passes `strict=False`, and `forced_emit:490-491` reads:

```python
if strict is False and rung_name == "strict_force":
    continue
```

So on a `force_strict`-tier model the ladder is **two rungs, not three** — `non_strict_force` then
`coerce`. A required `suggested_new_skills` therefore gets **exactly one retry** before the honest
floor, not two. That is still safe (D-263-02's reasoning holds), but a plan should not promise three
attempts.

**The exact call site to mirror** (`backend/app/services/expert_authoring.py:327-337`):

```python
result = await forced_emit(
    messages=[{"role": "user", "content": prompt_content}],
    model=model,
    provider=provider,
    emitter="emit_expert_draft",
    tools=_emit_tool("emit_expert_draft", ExpertDraftOutput),
    user_settings=user_settings,
    system_prompt=_EXPERT_DRAFTER_SYSTEM_PROMPT,
    schema_model=ExpertDraftOutput,
    strict=False,
)
emitted = result.get("emitted")
```

⚠ **`_emit_tool` and `_flatten_nullable` are DUPLICATED** — defined at `expert_authoring.py:61,76`
**and** at `skill_tuner_service.py:153,175`. `skill_proposer_service.py:53` imports them from the
tuner *verbatim* with the comment *"import, do not re-implement"*. **A new module should import from
`skill_tuner_service`, following the proposer's precedent, not copy a third time.**

---

## 2. Standard Stack

⭐ **This phase installs NOTHING.** Every dependency it needs already ships. There is no
`## Package Legitimacy Audit` section below because there are no packages to audit — that is a
measured absence, not an omission.

### Core (all present, all reused)

| Component | Version / location | Purpose | Why standard here |
|---|---|---|---|
| `forced_emit` | `backend/app/services/forced_emit.py` (705 L) | The one blessed structured-output path | ⛔ D-14 red line: it never opens the agent loop, never imports a raw provider SDK. Three services already sit on it. |
| Pydantic v2 | in `backend/venv` | `ExpertDraftOutput`, the nested proposal model, the body-authoring model | CLAUDE.md mandates Pydantic for structured LLM outputs. |
| `skill_tuner_service._emit_tool` / `_flatten_nullable` | `:175` / `:153` | JSON-schema flattening that clears the Gemini `type:[...]` trap and strict validators | `skill_proposer_service.py:53` imports these rather than re-implementing — follow that. |
| `POST /skills` | `backend/app/api/skills.py:227-259` | The existing human write path (D-263-03) | Already lints pre-persist and always saves. |
| `SkillFormDialog` | `frontend/src/components/skills/SkillFormDialog.tsx` (635 L) | The existing dialog variant A reuses | D-263-01. |
| `skills_autofill_org_id` | `supabase/full-schema.sql:5234` | Structural org stamp | ⭐ PACK-17's structural half already ships (§F). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| A new body-authoring driver | `skill_proposer_service.propose` directly | ⛔ **Not viable** — requires an existing skill row, `base_version` and `source_run_id`. A proposal has none. |
| `POST /skills` | `save_skill` via a `ToolContext` adapter | ⛔ Rejected by D-263-03, and the measurement supports it: `_handle_save_skill(args, ctx: ToolContext)` needs `ctx.supabase`, `ctx.current_user`, plus ~15 other dataclass fields (`tool_dispatcher.py:150-186`). That adapter is new surface built to satisfy a word. |
| DB-read doctrine (§1.3) | A module-local prompt constant | Defensible (it is what `skill_proposer_service` does) but then PACK-15's *"existing `skill-creator`"* is decorative. Name the choice in CONTEXT. |

---

## A. `ExpertDraftOutput` + the nested proposal model (D-263-02)

### A.1 The nested-model idiom to copy, verbatim

`backend/app/services/expert_authoring.py:14-24` — ⭐ **read the docstring: it explains *why* this is
a separate model, and the same reasoning applies to the new one.**

```python
class DraftPromptSuggestion(BaseModel):
    """Phase 261 (BUG-260921-01a) — a DRAFT tile, with a floor on the prompt body.

    Deliberately NOT ``models.expert.PromptSuggestion``: that model is also the read
    shape for every persisted bundle, and tightening it would make an older thin row
    unreadable. The floor belongs where the content is GENERATED, not where it is read.
    """

    title: str = Field(..., min_length=3, max_length=60, description="Crisp action-oriented button label")
    prompt: str = Field(..., min_length=150, description="Detailed multi-sentence starter prompt (2-3 sentences minimum)")
```

⚠ **CORRECTION — CONTEXT.md cites `expert_authoring.py:31-58` for `ExpertDraftOutput`. Measured:
the class opens at `:31` and its last field is at `:58`, so that citation is CORRECT.** Recorded
because the sibling citations in the same block are not (§C).

The current `ExpertDraftOutput` (`:31-58`), all 13 fields:

```python
class ExpertDraftOutput(BaseModel):
    name: str = Field(..., min_length=3, max_length=120, ...)                    # :46
    slug: str = Field(..., min_length=3, max_length=120, ...)
    icon: str = Field(..., ...)
    category: str = Field(..., min_length=3, max_length=60, ...)
    when_to_use: str = Field(..., min_length=40, max_length=240, ...)
    example_output: str = Field(..., min_length=120, ...)
    description: str = Field(..., min_length=400, ...)
    scope_mode: ScopeMode = Field(default="biased", ...)
    tool_floor_enabled: bool = Field(default=True, ...)
    prompt_suggestions: list[DraftPromptSuggestion] = Field(..., min_length=3, max_length=3, ...)
    member_skills: list[str] = Field(..., ...)                                   # :56
    knowledge_folder_ids: list[UUID] = Field(..., ...)
    required_connections: list[str] = Field(..., ...)                            # :58
```

### A.2 ⭐ `Field(..., min_length=0)` on a required list — CONFIRMED, and it is NOT `default=[]`

**Executed in the project venv (`pydantic 2.12.5`), not reasoned about.** Output verbatim:

```
pydantic 2.12.5
A.x required = True          # class A: x: list[N] = Field(..., min_length=0)
B.x required = False         # class B: x: list[N] = Field(default=[])
A() omitted -> ValidationError: x
B() omitted -> []
A(x=[]) -> []
```


| Construct | `model_fields['x'].is_required()` | Omitting the field |
|---|---|---|
| `Field(..., min_length=0)` | **`True`** | **raises `ValidationError`** |
| `Field(default=[])` | `False` | silently yields `[]` |
| `Field(..., min_length=0)` with `x=[]` | — | **validates cleanly** |

⭐ **All three properties D-263-02 depends on hold.** Pydantic v2 accepts `min_length=0` on a
required list, it is materially different from `default=[]`, and an explicit empty list is a legal
answer. **`min_length=0` is semantically a no-op constraint** — its value is entirely
self-documenting (it says "empty is a real answer") — so a plan should keep it for that reason and
not imagine it enforces anything.

### A.3 ⛔ THE TRAP: `_generate_fallback_draft` will raise the moment the field becomes required

`expert_authoring.py:265-279` constructs `ExpertDraftOutput` with **thirteen explicit kwargs and no
`**extra`**:

```python
    return ExpertDraftOutput(
        name=name, slug=slug, icon=icon, category=category,
        when_to_use=when_to_use, example_output=example_output,
        description=detailed_desc, scope_mode="biased", tool_floor_enabled=True,
        prompt_suggestions=prompts, member_skills=matched_skills,
        knowledge_folder_ids=matched_folder_ids, required_connections=matched_connections,
    )
```

⛔ **Adding a 14th REQUIRED field without touching this call raises `ValidationError` at
`:265`** — and because the fallback is what runs when `forced_emit` fails (`:347-355`, inside
`except Exception` — the warning is logged at `:348`), **the failure mode is: the LLM path degrades, the fallback then also throws,
and the endpoint 500s.** The fallback must pass `suggested_new_skills=[]` in the same task.

### A.4 The prompt text at `:110` that must change (item 11)

```
11. 'member_skills': Select all matching skill names from the provided available skills, or include 3-5 recommended domain skill names.
```

⛔ **The `or include 3-5 recommended domain skill names` hatch is the exact mechanism PACK-16 names
as the defect.** It puts invented names into `member_skills`, where `expert_service.py` strips them
at run time in silence. The edit must **remove the hatch from item 11** and add an item 14 routing
proposals to `suggested_new_skills`. ⚠ Leaving the hatch in place while adding the new field would
ship *both* behaviours and make PACK-16 unfalsifiable.

### A.5 Serialization and consumption

- **Endpoint:** `backend/app/api/experts.py:88` — `@router.post("/draft", status_code=200, response_model=ExpertDraftOutput)`. ⭐ `response_model` is the model itself, so **adding a field to the Pydantic class is the whole wire change.** No serializer edit.
- **Studio consumption:** `ExpertAuthoringStudio.tsx:220-236`. ⚠ CONTEXT cites `:230`; measured, `:230` is `if (draft.member_skills) setMemberSkills(draft.member_skills)` — correct, and the new `if (draft.suggested_new_skills) setSuggestedNewSkills(...)` lands beside it in the same guarded-assignment idiom.
- **`POST /experts` body model:** `ExpertBundleCreate` inherits `member_skills: list[str] = Field(default_factory=list)` (`backend/app/models/expert.py:43,51`). `ExpertBundleUpdate.member_skills` is `list[str] | None = None` (`:64`) — ⚠ **so a PATCH that omits `member_skills` has nothing to check, and the §D fence must skip rather than treat `None` as empty.**

---

## B. Migration 190 (D-263-07)

### B.1 189 is the head — confirmed

```
$ ls supabase/migrations/ | sort -t_ -k1 -n | tail -8
182_workflow_runs_token_totals.sql   186_tier_capabilities.sql
183_model_rates.sql                  187_expert_bundles.sql
184_model_rates_complete_roster.sql  188_expert_chat_scoping.sql
185_model_rates_db_roster.sql        189_expert_presentation_and_grants.sql
```

⭐ **190 is free.** (CLAUDE.md warns the ROADMAP has named an already-taken number twice running —
184 and 185. This one was checked.)

### B.2 Current `public.skills` DDL (`supabase/full-schema.sql:2696-2710`)

```sql
CREATE TABLE public.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    instructions text DEFAULT ''::text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_org_shared boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    org_id uuid NOT NULL
);
```

Confirmed live against the running DB — the column list is byte-identical, and
`born_for_expert_bundle_id` is **absent**.

### B.3 The exact DDL shape this repo uses

Mirroring 189's own idiom (`189_expert_presentation_and_grants.sql:5-16`):

```sql
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS born_for_expert_bundle_id uuid NULL
  REFERENCES public.expert_bundles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.skills.born_for_expert_bundle_id IS
  'Phase 263 (D-263-07): provenance marker — the Expert bundle this skill was authored for. '
  'NULL for every skill not born from Expert authoring (including an abandoned draft, D-263-08). '
  'Read as the THIRD disjunct of resolve_expert_bundle phase-2; the org_id fence is UNCHANGED.';

CREATE INDEX IF NOT EXISTS skills_born_for_expert_bundle_id_idx
  ON public.skills (born_for_expert_bundle_id)
  WHERE born_for_expert_bundle_id IS NOT NULL;
```

**On `ON DELETE SET NULL`:** the alternative is no FK at all. ⚠ `public.skills.org_id` is
`NOT NULL` with **no FK** and a comment saying *"no FK until org schema exists"*
(`full-schema.sql:2714`), so this table has precedent for FK-less uuid columns. A real FK is
recommended: deleting an Expert should degrade its born skills to ordinary library rows (matching
D-263-08's abandoned-draft semantics) rather than leave dangling ids. **`ON DELETE CASCADE` would be
wrong** — it would delete real, independently-useful skills.

**On the index:** warranted. The `resolve_expert_bundle` read is `WHERE name = ANY($1)` and filters
in Python, so the index does not serve that query — but **D-263-08's backfill `UPDATE`** and any
future "which skills were born for this Expert?" read do. A **partial** index keeps it tiny: with
10 rows live and `NULL` on every pre-existing skill, it indexes zero rows today.

### B.4 ⭐ RLS: no policy change needed — and here is why, with the policy text

`public.skills` has RLS enabled (`full-schema.sql:7545`) and **four** policies:

```sql
-- :6512 INSERT
CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT TO authenticated
  WITH CHECK ((org_id IN (SELECT public.current_user_org_ids())) AND (auth.uid() = user_id) AND (is_system = false));
-- :6726 SELECT
CREATE POLICY "Users can view own and global skills" ON public.skills FOR SELECT TO authenticated
  USING ((is_system = true) OR ((org_id IN (SELECT public.current_user_org_ids()))
         AND ((auth.uid() = user_id) OR (is_org_shared = true))));
-- :6638 UPDATE / :6379 DELETE — both (org_id IN current_user_org_ids()) AND (auth.uid() = user_id)
```

⭐ **Every one of the four predicates is ROW-scoped and references only `org_id`, `user_id`,
`is_system`, `is_org_shared`.** None is column-scoped. Postgres RLS applies per row regardless of
column count, so **a new column is covered by all four policies the instant it exists.**
**Conclusion: migration 190 needs no policy change. Stated explicitly, with the text, because
"almost certainly not" is not an answer a migration plan can act on.**

### B.5 ⭐ Both UPDATE triggers are SAFE for D-263-08's backfill — measured, and this is not obvious

`public.skills` carries **four** triggers. The two that fire on UPDATE were read in full because a
provenance-only `UPDATE` touching them would be a real defect:

| Trigger | Fires | Verdict for a `born_for_expert_bundle_id`-only UPDATE |
|---|---|---|
| `skills_capture_version` (`:5241`) | AFTER INSERT OR UPDATE | ⭐ **SAFE.** Its body guards the content trifecta: `IF NOT (NEW.name IS DISTINCT FROM OLD.name OR NEW.description … OR NEW.instructions …) THEN RETURN NEW;` — *"toggle-only / no content change → no version"*. **No spurious `skill_versions` row.** |
| `stale_skill_embedding` (`:5255`) | AFTER UPDATE | ⭐ **SAFE.** Same shape, guarded on `name`/`description`: *"instructions/toggle-only change → vector stays valid, no invalidation"*. **The embedding is NOT deleted.** |
| `skills_autofill_org_id` (`:5234`) | BEFORE **INSERT** only | Not reached by an UPDATE. |
| `skills_set_updated_at` (`:5248`) | BEFORE UPDATE | Bumps `updated_at`. Benign and correct. |

⛔ **Had either guard been unconditional, D-263-08's backfill would have silently created a phantom
skill version or deleted a live embedding on every Expert save.** Both were checked; both hold.

### B.6 ⭐ `scripts/full-schema-supplement.sql` — NO obligation, and this was verified not assumed

The supplement's own maintenance contract (`scripts/full-schema-supplement.sql:20-40`) lists exactly
four categories: **storage buckets · storage RLS policies · the `auth.users` signup trigger ·
realtime memberships**, plus **table/column GRANTs and REVOKEs** (added Phase 253 / CRED-03).

And `scripts/check-schema-acl-parity.cjs` enforces only the last of those — it scans
`supabase/migrations/` for `GRANT`/`REVOKE` statements and requires each to appear in the supplement
(`:58`).

**A plain `ALTER TABLE … ADD COLUMN … uuid NULL` with no `GRANT`/`REVOKE` statement is therefore
outside every category.** Cross-checked from the other direction: `grep` for table-level grants on
`public.skills` in `full-schema.sql` returns **zero** — the table relies on schema-level/default
privileges, so no column-level grant exists that a new column could miss.

⭐ **Verdict: migration 190 touches `scripts/full-schema-supplement.sql` NOT AT ALL.** ⚠ This flips
the moment a plan adds any `GRANT`/`REVOKE` to 190 — and CLAUDE.md records that this file is EXEMPT
from the ledger gate, so **no gate would ask.**

### B.7 Migration procedure (CLAUDE.md, binding)

1. Paste `190_skill_expert_provenance.sql` into the **Supabase SQL editor**. ⛔ Never `supabase db push` / `db reset`.
2. `bash scripts/regenerate-full-schema.sh` (no `--reset`).
3. ⛔ Never hand-edit `full-schema.sql`.
4. The plan carrying 190 is **`autonomous: false`** — execution pauses for the operator — and it is the phase's ONLY DB mutator. Never run it beside another plan.
5. ⛔ **190 joins the OWED-BEFORE-PRODUCTION batch with 186, 187, 188, 189** (`STATE.md:263-268`), migration-then-backend.

---

## C. The predicate change (D-263-06)

### C.1 ⛔ CORRECTION — CONTEXT.md's line numbers are STALE by ~45 lines

CONTEXT.md cites `expert_service.py:205-224` for the phase-2 skill check, in **four separate
places**. **Measured: the file is 378 lines and the skill block is `:249-291`, with the predicate at
`:270-277`.** Lines 205-224 are inside `update_expert_service` / `delete_expert_service` — a
completely different function. **A plan that opens `:205` will edit the wrong thing.**

(CLAUDE.md's ledger row is correct and current: `expert_service.py` reads **5 / 3 / 378** and was
re-derived at 263 planning. ⚠ **It now FIRES G-5 at 3 phases** — the row says so.)

### C.2 The predicate verbatim, as it stands today

```python
# backend/app/services/expert_service.py:249-291
    # 1. Evaluate member_skills independently
    raw_skills = bundle.get("member_skills") or []
    effective_skills: list[str] = []

    if raw_skills:
        skill_query = """
            SELECT name, is_system, org_id, user_id, is_org_shared, is_enabled
            FROM public.skills
            WHERE name = ANY($1::text[]);
        """
        skill_rows = await pool.fetch(skill_query, raw_skills)
        valid_skills: set[str] = set()

        for row in skill_rows:
            s_name = row["name"]
            is_sys = bool(row.get("is_system"))
            s_org_id = row.get("org_id")
            s_user_id = row.get("user_id")
            s_shared = bool(row.get("is_org_shared"))
            s_enabled = bool(row.get("is_enabled", True))

            if is_sys:
                valid_skills.add(s_name)
            elif (
                s_org_id == caller_org_id
                and s_enabled
                and (s_user_id == caller_user_id or s_shared)
            ):
                valid_skills.add(s_name)

        for s in raw_skills:
            if s in valid_skills:
                effective_skills.append(s)
            else:
                stripped_count += 1
                detail = f"skill:{s}"
                stripped_details.append(detail)
                logger.warning(
                    "EXPERT_MEMBER_CROSS_ORG_STRIPPED: skill '%s' foreign or inaccessible to org '%s' (user '%s')",
                    s, caller_org_id, caller_user_id,
                )
```

### C.3 ⭐ The answer the brief asked for: it is a PYTHON-SIDE filter — but the SQL must change too

**The predicate is Python** (`:270-277`), over rows already fetched by a SQL query that filters only
on `name`. **So D-263-06 is a two-line change in two places:**

1. **SQL (`:255`)** — the column must be added to the SELECT list, or the Python cannot see it:
   ```sql
   SELECT name, is_system, org_id, user_id, is_org_shared, is_enabled, born_for_expert_bundle_id
   ```
   ⛔ **This is the half a plan is most likely to miss.** Adding only the Python disjunct yields a
   `KeyError`/always-`None` — and with `.get()` it fails **silently open-to-strip**, i.e. the
   feature does nothing and every test still passes.

2. **Python (`:275`)** — the third disjunct lands inside the existing `elif`'s inner parenthesis,
   so the `s_org_id == caller_org_id and s_enabled` fence stays **structurally above it**:
   ```python
   elif (
       s_org_id == caller_org_id          # ⛔ UNTOUCHED — PACK-17's fence
       and s_enabled
       and (
           s_user_id == caller_user_id
           or s_shared
           or row.get("born_for_expert_bundle_id") == bundle_id   # D-263-06, the THIRD ARM
       )
   ):
   ```
   ⭐ **Placing it in the INNER parenthesis is what makes D-263-06's "the `org_id` fence is
   untouched" true by construction rather than by assertion.** A fourth top-level `elif` would be
   the bug PACK-17 exists to prevent.

⚠ **Use `row.get(...)`, not `row[...]`.** The existing code mixes both (`row["name"]` vs
`row.get("is_system")`). Every mock row in `test_259_expert_member_isolation.py` is a plain dict
without the new key; `.get()` keeps **all six existing tests green without editing their fixtures**,
while `row[...]` would red them all for no reason.

⚠ **Type note:** `bundle_id` is a `UUID` parameter; asyncpg returns `uuid` columns as `UUID`. Direct
`==` is correct. But in the mock-based tests the fixture must supply a `UUID`, not a `str` — a
string would compare unequal and the test would pass for the wrong reason.

### C.4 The RED-drive shape to copy

`backend/tests/unit/test_259_expert_member_isolation.py` (378 L, **6 tests, all passing** — measured
this session). The shape: `MagicMock()` pool, `fetchrow = AsyncMock(return_value=bundle_row)`,
`fetch = AsyncMock(side_effect=[skill_rows, folder_rows, conn_rows])`, then assertions on
`resolved.effective_skills` / `stripped_members_count` / `stripped_details` / `caplog.text`.

⭐ **Four cases D-263-06 needs, and the last two are what stop a one-sided fix:**

| # | Setup | Expected |
|---|---|---|
| 1 | org-A skill, `is_org_shared=False`, `user_id != caller`, `born_for = bundle_id` | **ADMITTED** (the new arm works) |
| 2 | same, but `born_for = <a different bundle>` | **STRIPPED** (D-263-07's narrowness holds — Expert B cannot reach Expert A's skill) |
| 3 | same, but `born_for = NULL` | **STRIPPED** (no regression; abandoned drafts stay as today) |
| 4 | **org-B** skill with `born_for = bundle_id` | ⛔ **STRIPPED** — the sharpest case. This is PACK-17 re-driven against the new arm (§F). |

⭐ **The RED drive:** plant the third disjunct as a top-level `elif` (outside the org fence),
observe case 4 turn RED, restore, verify md5-identical. **That plant is the one that proves the
placement, not merely the presence.**

---

## D. The save-time 422 (D-263-09 / D-263-10)

### D.1 ⛔ THE TRAP — a bare `except Exception` would destroy the named 422

```python
# backend/app/api/experts.py:60-85
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expert(
    payload: ExpertBundleCreate,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),   # ← the existing guard
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    org_id = _to_uuid(active_org)
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    try:                                                              # ← :73
        return await create_expert_service(pool=pool, org_id=org_id, user_id=user_id, bundle_in=payload)
    except Exception as exc:                                          # ← :80  ⛔ CATCHES HTTPException
        logger.error("Failed to create expert bundle: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,                  # ← :83  a 422 becomes a 400
            detail=f"Could not create expert bundle: {exc}",          # ← :84  the dict becomes a STRING
        ) from exc
```

⛔ **`HTTPException` subclasses `Exception`.** A 422 raised inside that `try` is caught at `:80`,
logged as an error, and re-raised as a **400 whose `detail` is the stringified exception** — so
D-263-10's *"names each unknown skill so any client can render the banner from the response"* is
destroyed, and the frontend banner silently falls back to re-deriving. **This is precisely this
project's recurring "a green fence coexisting with the shipped defect" shape.**

**The fix, and it is the one that honours D-263-09's *"inside the existing guard, not beside it"*:**
land the member check **between `:72` and `:73`** — after `require_expert_manage` and
`get_active_org_id` have resolved (so it is inside the permission boundary), and **above** the
`try:`. That placement needs no change to the existing error handling at all.

⚠ `update_expert` (`:294-315`) has **no** try/except, so a 422 there propagates cleanly. **The two
endpoints are asymmetric** — a plan that writes one shared helper must still place the call
correctly in each, and a test should assert the **status code** on both (a test asserting only "it
refuses" would pass on the 400).

### D.2 The 422 envelope precedent — do not invent a new one

This codebase's structured-refusal idiom is `detail={"error": "<snake_case_code>", …payload}`.
Three shipping precedents, quoted:

```python
# backend/app/api/skills.py:585-588  — the publish gate, in THIS phase's blast radius
raise HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail={"error": "publish_gate_unmet", "gate": gate.model_dump()},
)

# backend/app/api/connectors.py:1233-1239  — a 422 with a named reason
raise HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail={"reason_code": exc.reason_code, "message": f"Connection refused by security policy: {exc.reason_code}"},
)

# backend/app/services/entitlement_service.py:50-58  — the richest, and it carries a `detail` key INSIDE detail
super().__init__(
    status_code=status.HTTP_403_FORBIDDEN,
    detail={
        "detail": f"Capability '{result.capability}' requires '{req_tier}' tier (current tier: '{curr_tier}')",
        "error": "entitlement_required",
        "capability": result.capability,
        "required_tier": result.required_tier,
        "current_tier": result.current_tier,
        "upgrade_hint": upgrade_hint,
    },
)
```

**The shape D-263-10 should mirror** — closest to the `entitlement_service` precedent because it,
too, must render a human-readable banner client-side:

```python
raise HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail={
        "detail": f"{len(unknown)} of this Expert's capabilities do not exist in your library.",
        "error": "expert_member_skills_unknown",
        "unknown_skills": unknown,          # ← the NAMES, so the client renders from the response
    },
)
```

⚠ **FastAPI reserves 422 for its own request-validation errors** (`RequestValidationError`), whose
body is `{"detail": [{"loc": …, "msg": …}]}` — a **list**. Ours is a **dict**. A client discriminates
on `typeof detail === "object" && !Array.isArray(detail)`, or simply on `detail.error`. ⛔ **A plan
must say which**, or the frontend will render the wrong branch on a genuine Pydantic error.

### D.3 What the check must actually query

⚠ **The check cannot reuse `resolve_expert_bundle`** — that resolves an *existing* bundle by id, and
on `POST` no bundle exists yet. It is a **fresh query over `payload.member_skills`** using the same
visibility predicate. ⭐ **That is a second home for the same rule**, which is exactly the shape this
project keeps paying for — so **extract one helper** (e.g. `filter_visible_skill_names`) and have
both `resolve_expert_bundle` and the save-time fence call it. ⚠ Note the asymmetry: the save-time
check runs **before** a bundle id exists, so the third arm (D-263-06) is vacuous there — the helper
must accept `bundle_id: UUID | None`.

⚠ **`PATCH` must skip when `member_skills is None`** (`models/expert.py:64`) — `None` means *"not
being changed"*, and treating it as `[]` would refuse every unrelated PATCH.

---

## E. The closed-core inventory fence (D-263-11)

### E.1 ⭐ RUN THIS SESSION — CLAUDE.md's counts are CORRECT, STATE.md's are NOT

```
$ backend/venv/Scripts/python.exe -m pytest tests/unit/test_259_closed_core_inventory.py -q
......                                                                   [100%]
6 passed, 1 warning in 0.75s
```

The file is **94 lines, 6 tests** (⚠ STATE.md:82 says *"5 tests passing"* — it is 6). The pinned
counts, read from the source:

| Registry | Pinned | Line | vs CLAUDE.md |
|---|---|---|---|
| `PHASE_TYPE_REGISTRY_ENTRIES` | **7** | `:20` | ✅ matches |
| `EMITTER_REGISTRY` | **1** | `:30` | ✅ matches |
| `_TOOL_REGISTRY` | **29** | `:40` | ✅ matches |
| `EXPERT_CORE_TOOLS` | **10** | `:89` | ✅ matches |

⛔ **BUT STATE.md:82 IS WRONG AND IT IS WRONG IN THE DANGEROUS DIRECTION.** It records Phase 259-03
as asserting *"`EMITTER_REGISTRY` has strictly **4** emitters"*. **The test asserts `== 1`, and it
passes.** A `4` is exactly the kind of figure a future phase would "restore" — and Phase 259's own
review finding F-2 was that a planted `bundle_emit` **doubled** the emitter registry and passed all
five fence tests. **Report it; do not propagate it.** ⭐ **This is why D-263-11 says "counted, never
substring-matched" — and why a plan must re-run the test rather than quote any register.**

The other two tests: `:55` (no expert runtime/loop modules in `services/`) and `:65`
(`expert_service.py` is pure data transformation, AST-checked).

### E.2 What this means for the plan

⭐ **D-263-11 is nearly free**, because this phase adds **no executor, no emitter, no tool** — a
skill is DATA (`docs/EXTENSION-CONTRACT.md:26`). The obligation is to **re-run the existing file at
the phase base commit and at HEAD and show the six pass identically**, plus a fresh non-vacuity
plant (Phase 260 paid for that lesson when a planted `bundle_emit` passed all five fences).

⚠ **The one way this phase could break it:** if the body-authoring driver were implemented as a new
**tool** so the agent could call it, `_TOOL_REGISTRY` would become 30 and the fence would fire.
⛔ **It must be a plain service function called from a route, never a registered tool.**

### E.3 ⛔ A SECOND FENCE THE BRIEF DID NOT NAME, and a plan can trip it

`backend/tests/unit/test_261_single_expert_authoring_gate.py` (143 L, part of the 36 passing in §H)
enforces, by AST:

1. **Every `@router.post` / `.patch` / `.delete` in `api/experts.py` carries
   `Depends(require_expert_manage)`** (`:77-90`).
2. **Zero hardcoded role literals** (`org-admin`, `super-admin`, `admin`) across
   `api/experts.py`, `services/expert_service.py`, `services/expert_authoring.py`,
   `db/experts.py` (`:22-29`).

⛔ **If any plan adds a mutating endpoint to `api/experts.py`** — e.g. a
`POST /experts/draft-skill-body` for D-263-04 — **it MUST carry `Depends(require_expert_manage)` or
this fence goes RED.** D-263-03 adds no endpoint to `/skills`, but D-263-04's body-authoring shot
needs *some* route, and `api/experts.py` is its natural home. **Name the guard in the plan.**

---

## F. PACK-17 cross-org drive (D-263-12)

### F.1 The PACK-04 drive to mirror, verbatim

`backend/tests/unit/test_259_expert_member_isolation.py:84-136`,
`test_resolve_strips_foreign_skill_seed_125`. Its skeleton:

```python
    mock_pool.fetch = AsyncMock(side_effect=[[
        {"name": "org_b_secret_skill", "is_system": False, "org_id": org_b, "user_id": uuid4(),
         "is_org_shared": True, "is_enabled": True},        # ← FOREIGN, and is_org_shared=True
        {"name": "org_a_safe_skill",   "is_system": False, "org_id": org_a, "user_id": user_a,
         "is_org_shared": True, "is_enabled": True},
    ]])

    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved.effective_skills == ["org_a_safe_skill"]
    assert "org_b_secret_skill" not in resolved.effective_skills
    assert resolved.stripped_members_count == 1
    assert "skill:org_b_secret_skill" in resolved.stripped_details
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text
```

⭐ **Note what makes it sharp:** the foreign skill is `is_org_shared=True`, i.e. *maximally* visible
within its own org. **PACK-17's drive must do the same with `born_for_expert_bundle_id = bundle_id`
— the maximally-privileged value under the new arm** (§C.4 case 4). Anything weaker tests nothing.

### F.2 ⭐ The trigger genuinely makes the org stamp non-caller-supplied — with ONE condition, checked

`supabase/full-schema.sql:5234`:
```sql
CREATE TRIGGER skills_autofill_org_id BEFORE INSERT ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('user_id');
```

Its body reads the owner column and looks up `public.org_members` — **but it opens with a NO-OP
arm**:

```plpgsql
  -- Forward-compat NO-OP: org_id already provided (e.g. Phase 163) -> keep it verbatim.
  IF NEW.org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_owner_id := (to_jsonb(NEW) ->> v_owner_col)::uuid;
  IF v_owner_id IS NULL THEN RETURN NEW; END IF;      -- fail-safe: NOT NULL then rejects
  SELECT om.org_id INTO v_org_id FROM public.org_members om WHERE om.user_id = v_owner_id LIMIT 1;
  NEW.org_id := v_org_id;
```

⛔ **So "non-caller-supplied" is conditional on the insert path not supplying `org_id`.** Checked:

```python
# backend/app/api/skills.py:246-256
    result = (
        supabase.table("skills")
        .insert({
            "user_id": current_user["id"],
            "name": body.name.strip(),
            "description": body.description,
            "instructions": body.instructions,
            "is_org_shared": False,  # HARD-SET — never from the caller (D-08 / T-118-02-01)
        })
        .execute()
    )
```

⭐ **`POST /skills` supplies exactly five keys and `org_id` is NOT among them.** The trigger's NO-OP
arm is not reached; the stamp is derived from `org_members`. **D-263-08's structural claim is
VERIFIED, not assumed.**

⭐ **And it is doubly protected:** the dependency is `get_user_supabase_client` (`:231`), the
**user-JWT** client, so RLS applies — `"Users can insert own skills"` (`:6512`) requires
`org_id IN current_user_org_ids() AND auth.uid() = user_id AND is_system = false`. The BEFORE INSERT
trigger runs before the `WITH CHECK`, so the derived `org_id` is what gets validated. **Two
independent mechanisms, neither caller-controlled.**

⚠ **CORRECTION:** CONTEXT.md and both ledger rows cite `is_org_shared` hard-set at
`api/skills.py:250`. **Measured: `:253`.** Off by three; harmless, but recorded.

### F.3 The drive PACK-17 needs

Three cases, mirroring §F.1's shape with `born_for_expert_bundle_id` added to every fixture row:

1. **Resolution** — org-B skill, `born_for = bundle_id`, `is_org_shared=True` → **STRIPPED**, `EXPERT_MEMBER_CROSS_ORG_STRIPPED` logged.
2. **Visibility** — a cross-org caller listing skills never sees it. ⚠ There is an existing suite for this axis: `backend/tests/unit/test_seed125_skill_visibility_filter.py`. **Extend it rather than opening a third home for the same rule.**
3. **Creation** — a skill created by an org-A user is stamped org-A regardless of any payload. ⚠ **This one needs a live-DB test** (the trigger is a Postgres object; a mock cannot exercise it). Precedent: `test_261_expert_grants_db.py` runs against the live local Postgres.

⭐ **The RED drive:** plant the third disjunct **above** the org fence (§C.4), observe case 1 turn
RED, restore, verify md5-identical. That is the plant that proves PACK-17 survived D-263-06.

---

## G. Frontend: the variant A split

### G.1 The card as it stands (`ExpertAuthoringStudio.tsx:701-874`)

⚠ **A CORRECTION TO MY OWN FIRST READING, recorded rather than quietly fixed — CONTEXT.md is
RIGHT and my first pass was WRONG.** I initially reported that the card is not headed *"Bound
Knowledge & Capabilities"*; `grep` then found it at `:705`. The cause was confusing the **card
heading** with the **sub-section label** one level down. Both exist:

```tsx
701:            {/* Resources (Folders, Skills, Connections) */}
702:            <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
703:              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
704:                <Wrench className="h-4 w-4 text-primary" />
705:                <span>Bound Knowledge & Capabilities</span>      {/* ← THE CARD, as CONTEXT names it */}
706:              </h3>
708:              {/* Knowledge Folders */}
744:              {/* Member Skills & Specialized Capabilities */}   {/* ← the sub-block that SPLITS */}
748:                    Member Skills & Capabilities ({memberSkills.length} active)
838:              {/* Required Connections */}
```

⭐ **So the card at `:701-874` holds THREE peer sub-blocks — Folders, Skills, Connections — and
D-263-01 splits only the middle one (`:744-834`).** CONTEXT's citation is exact.

That middle sub-block has **three** inner parts, which is what variant A must slot into without
disturbing:

| Block | Lines | What it is |
|---|---|---|
| **Active Skills Pills** | `:756-774` | `⚡ {skillName}` + `<X/>` remove, in `border-primary/20 bg-primary/5`. ⭐ **This is variant A's *"In your library"* group — it exists and is unchanged.** |
| **Quick add custom skill input** | `:777-799` | Free-text + `Add`. ⛔ **THIS is how phantom names enter today** — `handleAddCustomSkill` (`:245-252`) pushes any string into `memberSkills` with no library check. PACK-16's frontend fence must cover it, not only the draft path. |
| **Available System Skills picker** | `:802-834` | Toggle chips from `availableSkills`. |

⭐ **Variant A's *"Proposed for this Expert"* group is a FOURTH inner part of the skills
sub-block**, inserted between `:774` (the close of the Active Skills Pills) and `:776` (the Quick
add input) — it does not replace anything, and it does not touch the Folders or Connections peers. **That is the smallest-diff reading and it matches
D-263-01's "no new studio screen".**

### G.2 ⛔ `SkillFormDialog` does NOT support a controlled initial value today — one additive prop is needed

Its full props contract (`SkillFormDialog.tsx:271-285`):

```tsx
interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill?: Skill | null
  /** Resolves to the saved Skill so the form can surface its `lint_warnings` … */
  onSave: (body: SkillCreate | SkillUpdate) => Promise<Skill | void>
  currentUserId?: string
  onTuneSkill?: (skillId: string) => void
}
```

And the reset effect (`:304-322`):

```tsx
  useEffect(() => {
    if (open) {
      setName(skill?.name ?? "")
      setDescription(skill?.description ?? "")
      setInstructions(skill?.instructions ?? "")
      …
      setSavedSkillId(skill?.id ?? null)
      if (skill) {
        listSkillFiles(skill.id).then(setFiles).catch(…)
      }
    }
  }, [open, skill])
```

⛔ **Passing a synthetic object as `skill` to pre-fill it is a TRAP and must be named in the plan.**
`const isEdit = !!skill` (`:288`) would flip to `true`, which (a) changes the dialog title to edit
wording, (b) fires `listSkillFiles(skill.id)` against an id that does not exist, and (c) makes the
save read as an update. **Not viable.**

**The correct, minimal change — one additive optional prop consumed inside the existing effect:**

```tsx
  /** Phase 263 (D-263-01/D-263-04): pre-fill for a PROPOSED skill that has no row yet.
   *  Only read when `skill` is absent, so `isEdit` stays false and no file fetch fires. */
  initialValues?: { name?: string; description?: string; instructions?: string }
```
```tsx
      setName(skill?.name ?? initialValues?.name ?? "")
      setDescription(skill?.description ?? initialValues?.description ?? "")
      setInstructions(skill?.instructions ?? initialValues?.instructions ?? "")
```

⭐ Three `??` insertions, zero behaviour change for every existing caller (`initialValues` undefined
→ byte-identical), and `isEdit` stays `false`. ⚠ `initialValues` must be in the effect's dependency
array or a second proposal opened without unmounting will show the first one's body.

### G.3 `POST /skills` caller signature

```ts
// frontend/src/lib/api/skills.ts:22-31
export async function createSkill(body: SkillCreate): Promise<Skill> {
  … method: "POST" …
}
```
⭐ **Unchanged.** D-263-03 is satisfied by this existing function — ⛔ no second client function, as
the ledger row for this file states.

### G.4 ⛔ THE GATE FINDING — every skills suite is in NEITHER knob

```
$ grep -ic "skill" scripts/vitest-count-gate.cjs
0
```

⛔ **ZERO occurrences of the word "skill" in the entire count gate.** Not in `TARGETS` (what RUNS),
not in `BASELINE` (what is PINNED). The affected files, all of which exist and are green:

`SkillFormDialog.test.tsx` · `SkillCard.test.tsx` · `SkillEvalSection.test.tsx` ·
`SkillsPage.import.test.tsx` · `SkillStudioPage.test.tsx` · `SkillTunerPage.test.tsx`

**`SkillFormDialog.test.tsx` is the one this phase edits.** Measured directly:

```
$ GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/skills/SkillFormDialog.test.tsx --maxWorkers=2
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

⭐ **8 green — so adoption CANNOT red the gate.** ⛔ **Without adoption, every test a 263 plan adds
to that file falsifies nothing** — the exact Phase 260 F-2 shape (*"a total that does not move after
a phase adds tests IS the tell"*). **Adopt it into BOTH knobs in the same wave that edits it:**

```js
// BASELINE, near :170
"SkillFormDialog.test.tsx": 8,
// TARGETS, near :4331
"src/components/skills/SkillFormDialog.test.tsx",
```

### G.5 The experts suites ARE in both knobs — verified

| Knob | Lines | Entries |
|---|---|---|
| `BASELINE` | `:166-170` | `ComposerExpert.test.tsx: 5` · `ExpertSpotlightCard.test.tsx: 5` · `OrgExpertsTab.test.tsx: 5` · `ExpertAuthoringStudio.test.tsx: 4` |
| `TARGETS` | `:4327-4331` | the four matching paths |

```
$ GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/experts/__tests__ --maxWorkers=2
 Test Files  2 passed (2)
      Tests  9 passed (9)
```
⭐ **9 = 5 + 4, exactly the pins.** Adding cases to `ExpertAuthoringStudio.test.tsx` **raises its
pin**, which is the gate working — update the BASELINE number in the same commit.

### G.6 G-5 hot-file triples — RE-DERIVED THIS SESSION

```bash
git log --oneline -- <file> | wc -l
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' \
  | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l
wc -l <file>
```

| File | Measured now | Ledger cell | State |
|---|---|---|---|
| `frontend/src/components/skills/SkillFormDialog.tsx` | **12 / 8 / 635** | `12 / 8 / 635` | ⭐ **FIRES · row CURRENT** (added at 263 planning, `b2c48f501`) |
| `backend/app/api/skills.py` | **19 / 10 / 858** | `19 / 10 / 858` | ⭐ **FIRES · row CURRENT** |
| `backend/app/services/expert_service.py` | **5 / 3 / 378** | `5 / 3 / 378` | ⭐ **FIRES · row CURRENT** |
| `frontend/src/lib/api/skills.ts` | **6 / 4 / 748** | `6 / 4 / 748` | ⭐ **FIRES · row CURRENT** |
| `backend/app/api/experts.py` | **5 / 2 / 396** | `1 / 1 / 175` | ⚠ **STALE by 4 commits / 1 phase / 221 lines.** Below threshold (2 phases), so G-5 does not fire — **but a row present and WRONG stops an audit harder than an absent one.** Correct it. |
| `backend/app/services/expert_authoring.py` | **3 / 1 / 356** | `1 / 1 / 233` (detail file only) | ⚠ STALE. Does not fire. |
| `frontend/src/components/experts/ExpertAuthoringStudio.tsx` | **2 / 1 / 1194** | `1 / 1 / 1082` (detail file only) | ⚠ STALE. Does not fire. |

⭐ **CONTEXT.md's warning that `SkillFormDialog.tsx` and `api/skills.py` have NO ledger row is now
DISCHARGED** — both rows landed at `b2c48f501` (*"docs(263): add ledger rows for SkillFormDialog +
api/skills.py, fix 2 stale rows"*), in CLAUDE.md `:819-820` **and** `docs/HOT-FILE-LEDGER.md`
`:10900-10901` + `:15521`/`:15545`, honouring the same-commit sync rule.

⛔ **FOUR files in this blast radius FIRE G-5.** Per CLAUDE.md, each must be read in
`docs/HOT-FILE-LEDGER.md` before planning, and each edit must be *honoured by construction* — which,
for this phase, it genuinely is: `expert_service.py` gains **one disjunct inside an existing
parenthesis**; `api/skills.py` is **untouched**; `lib/api/skills.ts` is **untouched**;
`SkillFormDialog.tsx` gains **one optional prop and three `??`**.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Structured LLM output with recovery | A retry loop around a provider call | `forced_emit` (`:344`) | It owns the tier-scoped rung ladder, narration recovery, truncation detection and ladder-level token accounting (METER-06). A hand-rolled retry under-reports spend. |
| JSON-schema for an emitter | `model.model_json_schema()` raw | `skill_tuner_service._emit_tool` (`:175`) | `_flatten_nullable` collapses `anyOf:[T,null]`; without it Gemini's sanitizer drops the field and strict validators (minimax/moonshot) 400. |
| Skill-authoring doctrine | New prompt prose | The `skill-creator` row's §3 craft block, read from the DB (§1.3) | PACK-15 names it. Re-writing it forks the doctrine. |
| Writing a skill row | A new endpoint, or a `ToolContext` adapter to `save_skill` | `POST /skills` (D-263-03) | Already lints pre-persist, hard-sets `is_org_shared`, and inherits RLS + the org trigger. |
| Pre-filling a modal | A second dialog | One additive `initialValues` prop (§G.2) | A second dialog is the second engine PACK-15 refuses, in the UI register. |
| Org scoping on insert | Passing `org_id` in the payload | `skills_autofill_org_id` (§F.2) | ⛔ Supplying `org_id` hits the trigger's NO-OP arm and **re-opens SEED-125**. |
| Skill-name visibility filtering | A second copy of the predicate | One extracted helper both callers use (§D.3) | Two homes for one rule is this project's most-repeated defect. |

**Key insight:** ⭐ **Every mechanism this phase needs already ships.** Its real work is *wiring and
driving*, not building — which is exactly why `EXT-01` permits it and why the closed-core inventory
can be measurably unchanged.

---

## Common Pitfalls

### Pitfall 1: Reading `skill-creator`'s instructions as a prompt
**What goes wrong:** The model returns interview questions, or a skill body *about how to run an interview*.
**Why:** The row is a 7-step multi-turn loop that tells the model to call five tools (§1.2).
**Avoid:** Extract §3's craft block. Compose it with framing text the driver owns; never pass the row verbatim.
**Warning sign:** A generated body containing "Ask focused questions" or "open this skill in Skill Studio".

### Pitfall 2: The fallback draft throws once the field is required
**What goes wrong:** `/experts/draft` 500s whenever the LLM path fails — i.e. exactly when the fallback exists to help.
**Why:** `expert_authoring.py:265-279` constructs the model with 13 explicit kwargs (§A.3).
**Avoid:** Add `suggested_new_skills=[]` in the same task as the schema change.
**Warning sign:** A green unit test that only ever exercises the `forced_emit` success path.

### Pitfall 3: The 422 becomes a 400
**What goes wrong:** D-263-10's named refusal arrives as a stringified 400; the client cannot render the banner.
**Why:** `api/experts.py:80` catches `Exception`, and `HTTPException` is one (§D.1).
**Avoid:** Raise **above** the `try:` at `:73`.
**Warning sign:** A test asserting "it refuses" without asserting `response.status_code == 422`.

### Pitfall 4: The SELECT is not widened
**What goes wrong:** D-263-06 silently does nothing; every existing test still passes.
**Why:** The predicate is Python over rows fetched by a SQL query that does not select the column (§C.3).
**Avoid:** Widen `expert_service.py:255` in the same edit.
**Warning sign:** Case 1 of §C.4 fails while cases 2-4 pass — the signature of an always-`None` read.

### Pitfall 5: A test lands in a file no gate runs
**What goes wrong:** New cases in `SkillFormDialog.test.tsx` falsify nothing.
**Why:** `grep -ic "skill" scripts/vitest-count-gate.cjs` = **0** (§G.4).
**Avoid:** Adopt into both knobs in the same wave.
**Warning sign:** ⚠ **The gate total does not move after the phase adds tests.** That is the tell, not the reassurance.

### Pitfall 6: A new endpoint without `require_expert_manage`
**What goes wrong:** `test_261_single_expert_authoring_gate.py` goes RED.
**Why:** It AST-walks every mutating route in `api/experts.py` (§E.3).
**Avoid:** Any new `@router.post` there carries `Depends(require_expert_manage)`.

### Pitfall 7: Quoting a register instead of measuring
**What goes wrong:** A plan pins `EMITTER_REGISTRY == 4` (STATE.md:82) and reds the fence; or writes "tsc: zero errors" against a 72-error base.
**Why:** Registers rot here within days — five documented corrections in CLAUDE.md alone.
**Avoid:** Re-run. §E and §H give the commands.

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|---|---|---|---|
| Every `ExpertDraftOutput` field carried a default | Required fields with `min_length` floors | Phase 261, `757bb9e25` | D-263-02 extends the corrected shape. ⛔ Never regress to `default=[]`. |
| A sealed single forced shot | An ordered **rung ladder** resolved from `emit_tier` | Phase 122 (MP-01 / D-122-02) | A required field is safe — with **one** retry under `strict=False`, not two (§1.4). |
| `forced_emit` returned no usage | Ladder-total `input_tokens`/`output_tokens`, failed rungs included | Phase 256 (METER-06) | A new caller inherits correct spend accounting for free. |
| `skills.is_global` | `skills.is_org_shared` | Phase 111/165 | ⚠ Migration 087 still writes `is_global` — it is **already applied**; do not re-execute it. |

**Deprecated / outdated:**
- `backend/supabase/migrations.archive/` — dead; schema changes go in `supabase/migrations/` at the repo root.
- `expert_authoring.py`'s local `_emit_tool`/`_flatten_nullable` (`:61`, `:76`) — a third copy. Import from `skill_tuner_service` instead (`skill_proposer_service.py:53` is the precedent).

---

## Runtime State Inventory

> This phase adds a column and a code path; it is not a rename. Included because D-263-08 performs a
> **data backfill**, which is the category this section exists to surface.

| Category | Items Found | Action Required |
|---|---|---|
| **Stored data** | `public.skills` — **10 rows live**, measured. All will have `born_for_expert_bundle_id = NULL` after migration 190. ⭐ **This is CORRECT, not a gap**: D-263-08 stamps only skills born from Expert authoring going forward. **No historical backfill is owed or wanted** — retro-stamping would grant Experts skills their authors never scoped to them. | **Code edit only** (the forward-looking `UPDATE`). ⛔ **No data migration.** |
| **Live service config** | **None.** No n8n workflow, Datadog dashboard, Tailscale ACL or Cloudflare tunnel references skills or Experts — verified by grep across the connector and egress surfaces. | None |
| **OS-registered state** | **None.** No Task Scheduler entry, pm2 process or systemd unit touches this surface. | None |
| **Secrets / env vars** | **None.** This phase reads no new secret. The body-authoring driver resolves its model through existing user settings / `MODEL_CAPABILITIES`, exactly as `generate_expert_draft` does (`expert_authoring.py:288-299`). | None |
| **Build artifacts** | **None.** No package rename, no `pyproject.toml` change, no sandbox image change (`Dockerfile.sandbox` untouched → `SANDBOX_IMAGE` tag unchanged). | None |
| ⛔ **Deploy parity (the one that IS owed)** | Migration 190 is applied **locally only** and joins the v4.3 close batch with **186, 187, 188, 189** (`STATE.md:263-268`). | **Operator action at the milestone close**, migration-then-backend, never the reverse. |

---

## Validation Architecture

> `.planning/config.json` sets `workflow.nyquist_validation: false` (measured at Phase 235's stop, per
> CLAUDE.md G-8). ⛔ **Per the contract, this section is therefore SKIPPED as a formal requirement.**
> The gate commands a plan actually needs are in §H, which is the operative section.

---

## H. Gate baselines

### H.1 Backend

**Canonical command** (CLAUDE.md, binding), run in `backend/` with the venv:
```bash
pytest tests/unit -q --continue-on-collection-errors
```
**Ceiling: 71 failed, zero headroom.** ⛔ **NOT RUN in this session** — it is slow and the brief said
not to. The rule stands unchanged: **any new failure above 71 breaks the gate.** ⚠ **The COUNT is
not the evidence — the SET is** (`STATE.md:148-152`): capture with `grep -E "^FAILED "` and diff in
**both** directions, stripping trailing warning text first.

**Targeted suites a 263 plan runs per task — MEASURED GREEN THIS SESSION:**

```
$ backend/venv/Scripts/python.exe -m pytest \
    tests/unit/test_259_expert_member_isolation.py \
    tests/unit/test_261_expert_grants_db.py \
    tests/unit/test_259_expert_bundles_db.py \
    tests/unit/test_259_expert_entitlement_gate.py \
    tests/unit/test_261_single_expert_authoring_gate.py -q
36 passed, 1 warning in 2.70s

$ backend/venv/Scripts/python.exe -m pytest tests/unit/test_259_closed_core_inventory.py -q
6 passed, 1 warning in 0.75s
```

⭐ **42 tests, 3.5 seconds, all green.** That is the per-task loop. Full expert/skill surface for a
wave merge (18 files):

```bash
pytest tests/unit/test_259_expert_*.py tests/unit/test_260_expert_*.py \
       tests/unit/test_261_expert_*.py tests/unit/test_261_single_expert_authoring_gate.py \
       tests/unit/test_259_closed_core_inventory.py tests/unit/test_seed125_skill_visibility_filter.py \
       tests/unit/test_skill_*.py tests/unit/test_182_grounding_skill_org_gate.py -q
```

### H.2 Frontend — the count gate

```bash
GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs   # from the repo ROOT
```

⛔ **NOT RUN in this session.** A concurrent agent is active in this repo (it committed `16b4d41d5`
at 18:31 today), and CLAUDE.md records that the gate goes non-deterministic with a sibling agent —
so a number measured now would be **evidence of nothing** and could be mistaken for a baseline.
**Reporting the contract instead is the honest option.**

**The contract:** *no per-file **DECREASE** and **zero failing***. ⛔ **Never a fixed grand total** —
CLAUDE.md records six documented rots of that figure, one of which took a single day. The frozen
`STATE.md:138` value (`8478 · failed 0 · pinned 7737 · 295/295`) is **2026-09-20 and already
suspect**; re-derive rather than quote it.

⛔ **If a run reds:** capture failing FILENAMES from the gate's **own persisted JSON** *before*
re-running anything, check each against `git diff --numstat <base>..HEAD`, and do **not** reach for
the cap. `GSD_VITEST_MAX_WORKERS=2` stands.

**Targeted, measured this session:**

| Suite | Result | Knob state |
|---|---|---|
| `src/components/experts/__tests__` | **2 files / 9 tests passed** (50.3 s) | ✅ both knobs |
| `src/components/skills/SkillFormDialog.test.tsx` | **1 file / 8 tests passed** (8.1 s) | ⛔ **NEITHER knob** — adopt at 8 |

### H.3 ⛔ tsc — the baseline is 72, NOT the 65 STATE.md freezes

```
$ cd frontend && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -c "error TS"
72
```

⛔ **MEASURED 2026-09-21: 72 errors.** `STATE.md:139` freezes the base at **65**. **The baseline has
drifted +7** — almost certainly Phases 261/262 (the concurrent agent committed
`openai_service.py` / `provider_gateway/*` / `config.py` at 18:31 today).

⛔ **A plan MUST write a SET-DIFF criterion, never "zero errors" and never "65".** The reachable
criterion is:

> `npx tsc -p tsconfig.app.json --noEmit` reports **no error in a file this phase modified** that
> was not present at the phase's own base commit — re-measured at the base, not quoted from here.

⛔ **And never bare `npx tsc --noEmit`** — `frontend/tsconfig.json` is solution-style
(`{"files": [], "references": […]}`), so it type-checks **ZERO files and exits 0** no matter what is
broken (CLAUDE.md, measured at Phase 239-08 over a change carrying 24 real `TS6133` errors).

### H.4 Governance gates — run this session

```
$ node scripts/check-seeds-register.cjs --phase 263
seeds register gate OK — 310/310 parsed, 0 duplicate ids, 310/310 carry all 5 required keys.
  register: 310 files · parsed: 310 · skipped: 0 · duplicate ids: 0
  unswept:  134 carry no trigger_when at all · 114 carry prose but no structured trigger
  trigger sweep — phase 263 (0 plan file(s), 0 path(s) in files_modified)
  0 seeds matched
```
⚠ **0 seeds matched because the phase has no PLAN.md yet** — the gate says so explicitly rather than
reporting a clean sweep. **Re-run after plans exist**; `SEED-303`'s `trigger_paths` name
`expert_service.py`, `api/experts.py` and `models/expert.py`, all of which this phase touches, so it
**will** match and must be routed.

⚠ **Read both unswept figures and never sum them** — 134 and 114 are separate populations.

**Also required before/at planning:**
```bash
node scripts/check-hot-file-ledger.cjs 263      # will FAIL on any file with no row — §G.6
node scripts/check-claude-md-size.cjs           # any CLAUDE.md ledger edit
node scripts/check-gap-closure-rounds.cjs 263   # only if verification returns gaps_found
```

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `ON DELETE SET NULL` is the right FK action for `born_for_expert_bundle_id` `[ASSUMED]` | B.3 | Low. `CASCADE` would delete real skills (clearly wrong); no FK leaves dangling ids. Operator may prefer no FK, matching `org_id`'s precedent. |
| A2 | The partial index on the new column is warranted `[ASSUMED]` | B.3 | Very low. It indexes zero rows today. Omitting it costs a seq-scan on a 10-row table. |
| A3 | The body-authoring driver should NOT inherit `self_improve_enabled()`'s FLAG-01 kill-switch `[ASSUMED]` | 1.3 | **Medium — this is a real operator decision.** If an operator disables self-improvement expecting *all* programmatic skill authoring to stop, omitting the gate violates that expectation. ⛔ **Surface it; do not decide it silently.** |
| A4 | `suggested_new_skills` is the right field name `[ASSUMED]` | A | Cosmetic. D-263-02 uses this name; nothing else binds it. |
| A5 | `expert_member_skills_unknown` is the right error code `[ASSUMED]` | D.2 | Low — it is a new code, so nothing can conflict. The *envelope shape* is `[VERIFIED: codebase]` from three precedents. |
| A6 | Extracting `filter_visible_skill_names` as a shared helper is preferable to duplicating the predicate `[ASSUMED]` | D.3 | Low, and it is the project's own stated principle (one home per concern). But it edits a **G-5-FIRING** file, so the plan must honour it by construction. |
| A7 | No historical backfill of `born_for_expert_bundle_id` is wanted `[ASSUMED]` | Runtime State Inventory | **Medium.** If an operator expects existing Expert-adjacent skills to become resolvable, this is wrong — but retro-stamping would grant access nobody scoped. Recommend confirming. |

---

## Open Questions

1. **⛔ D-263-04's literal reading is not implementable — does the operator accept §1.3's resolution?**
   - **What we know:** `skill-creator` is a DB row whose instructions are a 7-step interactive interview loop that calls five tools (§1.2, measured). There is no callable service.
   - **What's unclear:** whether *"runs `skill-creator`"* is satisfied by **reading its §3 craft doctrine from the DB at call time** (the driver reading), or whether the operator would accept a `skill_proposer_service`-shaped module with its own prompt constant (the established precedent, but then PACK-15's naming of `skill-creator` is decorative).
   - **Recommendation:** take the **driver** reading, and make it falsifiable with §1.3's Fence 1 (stub the DB read → assert no craft tokens survive; drive RED by inlining one bullet). ⛔ **Do not plan past this silently** — it is the phase's single largest shape decision, and D-263-04 as worded cannot be built.

2. **Where does the body-authoring shot's route live?**
   - **What we know:** it needs *some* route. `api/experts.py` is natural and is covered by `require_expert_manage`; `api/skills.py` is where skills live but its routes are user-JWT/RLS-scoped, not `experts:manage`-gated.
   - **What's unclear:** which. ⚠ `api/skills.py` is **G-5 FIRING** (19/10/858) and D-263-03 deliberately leaves it untouched; `api/experts.py` is below threshold but its AST fence (§E.3) will demand the guard.
   - **Recommendation:** `POST /experts/draft-skill-body` in `api/experts.py`, carrying `Depends(require_expert_manage)`. It keeps `api/skills.py` byte-unchanged (honouring its ledger row) and sits beside the existing `POST /experts/draft`.

3. **Does the FLAG-01 self-improvement kill-switch govern this path?** (A3)
   - **Recommendation:** ask the operator. The honest framing: *"when you turn self-improvement off, should approving a proposed skill in the Expert studio also stop working?"*

4. **`STATE.md:82` records `EMITTER_REGISTRY` as 4; the passing test asserts 1.**
   - **What we know:** the test passes at `== 1` (§E.1, run this session).
   - **Recommendation:** correct `STATE.md` at the phase close. ⛔ A `4` in a register is exactly the figure a future phase would "restore" — and Phase 259's F-2 was a planted emitter that doubled the registry and passed five fences.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Python venv | all backend work | ✓ | `backend/venv/Scripts/python.exe` | — |
| pytest | backend fences | ✓ | ran 42 tests in 3.5 s | — |
| Local Postgres :54322 | migration 190, live-DB tests | ✓ | connected, read 10 skill rows | — |
| Node + vitest | frontend suites | ✓ | vitest 4.1.0 | — |
| `npx tsc` | type baseline | ✓ | 72 errors measured | — |
| `scripts/check-seeds-register.cjs` | REG-02 sweep | ✓ | 310/310 OK | — |
| An LLM provider key | D-263-04's body shot at UAT | **NOT MEASURED** | — | ⚠ `forced_emit` returns an honest `emitted=None` floor; the UI must render a real failure, never a fabricated body. |

**Missing dependencies with no fallback:** none.

---

## Sources

### Primary (HIGH — measured this session)
- `backend/app/services/forced_emit.py` — signature `:344-356`, rungs `:242-255`, `_validate_args` `:140-157`, strict-demotion `:490-491`, descent `:571-572`, floor `:578-589`
- `backend/app/services/expert_authoring.py` — `:14-24`, `:31-58`, `:61`, `:76`, `:110`, `:265-279`, `:327-337`
- `backend/app/services/expert_service.py` — `:249-291` (⛔ **not** `:205-224`)
- `backend/app/services/skill_proposer_service.py` — `:1-40`, `:53`, `:66-90`, `:335-406`
- `backend/app/api/experts.py` — `:32`, `:42-57`, `:60-85`, `:88`, `:294-315`
- `backend/app/api/skills.py` — `:227-259` (`is_org_shared` at **`:253`**), `:540-588`
- `backend/app/services/tool_dispatcher.py` — `:150-186`, `:1305`, `:1410`, `:1435-1470`, `:4554-4555`
- `backend/app/models/expert.py` — `:33,43,51,55,64`
- `backend/app/services/entitlement_service.py` — `:50-58`
- `backend/app/api/connectors.py` — `:1233-1239`
- `supabase/full-schema.sql` — `:2696-2710`, `:5234`, `:5241`, `:5248`, `:5255`, `:6379`, `:6512`, `:6638`, `:6726`, `:7545`, and both trigger-function bodies
- `supabase/migrations/087_skill_creator_reborn.sql` — `:66-118` (**the decisive text**)
- `supabase/migrations/189_expert_presentation_and_grants.sql` — `:1-25`
- `scripts/full-schema-supplement.sql` — `:20-40`; `scripts/check-schema-acl-parity.cjs` — `:58`
- `scripts/vitest-count-gate.cjs` — `:166-170`, `:4327-4331`, and `grep -ic "skill"` = **0**
- `frontend/src/components/skills/SkillFormDialog.tsx` — `:271-285`, `:287-288`, `:304-322`
- `frontend/src/components/experts/ExpertAuthoringStudio.tsx` — `:220-236`, `:245-252`, `:744-834`
- `frontend/src/lib/api/skills.ts` — `:22-31`, `:368`
- `backend/tests/unit/test_259_closed_core_inventory.py` — `:20,30,40,55,65,89` (**6 passed**)
- `backend/tests/unit/test_259_expert_member_isolation.py` — `:22-81`, `:84-136`
- `backend/tests/unit/test_261_single_expert_authoring_gate.py` — `:22-29`, `:77-90`
- Live local Postgres :54322 — `public.skills` = **10 rows**, column list confirmed
- Pydantic **2.12.5** in the project venv — `min_length=0` required-field semantics, executed (§A.2)
- `docs/EXTENSION-CONTRACT.md` — `:3-4`, `:26`, `:36-41`

### Secondary (MEDIUM)
- `CLAUDE.md` — G-5 ledger rows `:814-821`, workflow guardrails, migration + gate rules
- `docs/HOT-FILE-LEDGER.md` — `:10584-10585`, `:10900-10901`, `:15521`, `:15545`
- `.planning/REQUIREMENTS.md:130-152`; `.planning/STATE.md:82,129-154,263-268`
- `.planning/sketches/263-the-skills-an-expert-needs/README.md`
- `.planning/phases/261-…/261-CONTEXT.md:63-71`

### Tertiary (LOW)
- None. ⭐ **No WebSearch or Context7 lookup was needed or performed** — this phase adds no external dependency and every question was answerable from source. Recorded as a fact, not an omission.

---

## Metadata

**Confidence breakdown:**
- **Standard stack — HIGH.** Nothing is installed; every component was read at the line level and every fence was executed.
- **Architecture — HIGH**, with one **explicitly flagged** exception: D-263-04's literal reading is refuted by measurement and §1.3's resolution is a *recommendation awaiting ratification*, not a locked shape.
- **Pitfalls — HIGH.** All seven come from code read or commands run in this session; six are traps with a named file:line.
- **Gate baselines — HIGH for what was run** (backend targeted 42/42, vitest targeted 17/17, tsc 72, seeds 310/310); **explicitly NOT MEASURED** for the full backend suite and the full vitest gate, with the reason stated in each case.

**Research date:** 2026-09-21
**Valid until:** ~2026-09-28 (7 days). ⚠ This repo's own recurring finding is that figures rot in
days — the tsc baseline drifted 65 → 72 since 2026-09-20, and a concurrent agent is committing to
`develop` today. **Re-derive every count at planning rather than quoting this file.**
