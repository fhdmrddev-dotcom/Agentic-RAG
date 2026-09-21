# Phase 263: An Expert Can Be Given Its Capabilities - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning

<domain>
## Phase Boundary

An Expert's capabilities match its description, because authoring one can **author the skills it
needs**. The studio names the domain skills that do not exist yet, a human approves each, and they
are created through the **existing** skill path — so an Expert stops being a manifest over an empty
shelf.

**This phase fills the shelf. It does not change what an Expert DOES at run time.**

⛔ **Out of scope, named so they are not absorbed:** a skill marketplace · cross-org skill sharing ·
any change to the agent loop, executors, emitters or the tool registry · rewriting the blueprint
prose when a claimed capability is dropped (a named gap, carried in `<deferred>`) · a client-side
URL router.

⚠ **Why this phase exists — measured, not assumed.** `BUG-260921-01`, driven live in Chrome on
2026-09-21: a doctoral-literature-review Expert produced a **2163-char PRISMA blueprint** and was
given `docx`, `xlsx`, `pptx`. `SELECT count(*) FROM public.skills` = **10** (2 system), and for an
academic domain those three output formats are the only lexical matches. ⭐ **The prompt is not at
fault and must not be "improved" as the fix** — it already demands an exhaustive configuration and
already asks for domain skills. **The library is the ceiling.**

</domain>

<decisions>
## Implementation Decisions

### 1. The authoring surface (PACK-14 · G-2 acceptance bar)

- **D-263-01: Sketch 263 variant A is the locked UI, ratified by the operator 2026-09-21.**
  The shipped `Bound Knowledge & Capabilities` card
  (`frontend/src/components/experts/ExpertAuthoringStudio.tsx:744-834`) splits into two headed
  groups — **"In your library"** (solid `⚡` pills, unchanged) and **"Proposed for this Expert"**
  (dashed `⬡` cards carrying name + one-line description). The dashed border and the violet accent
  are the ONLY things carrying *"does not exist"*; no red, no error styling — a proposal is an
  opportunity, not a failure. `Create this skill →` opens the **existing** `SkillFormDialog`,
  pre-filled. ⛔ **No new studio screen and no wizard step** — B (a provisioning step) and C (a
  refusal sheet) were the rejected alternatives and are preserved in the sketch, not deleted.
  Contract: `.planning/sketches/263-the-skills-an-expert-needs/README.md`, committed `fb9514954`.

- **D-263-02: `suggested_new_skills` is a REQUIRED field on `ExpertDraftOutput`, and may be empty.**
  `Field(..., min_length=0)` over a nested model carrying `name`, `description`, `why_needed`.
  ⛔ **Never `Field(default=[])`.** That is the exact shape 261 had to fix at `757bb9e25`: every
  substantive field carried a default, so a model returning nothing validated perfectly and
  richness was a lottery (`description` measured 293 chars on one run and 2163 on another;
  `example_output` 164 then 6). **The schema IS the contract.** An empty list is a real answer when
  the library genuinely covers the domain — `min_length=1` would manufacture a proposal to satisfy
  a schema.
  ⚠ `forced_emit`'s recovery ladder makes a required field safe: a rung whose payload fails
  `model_validate` re-drives the next rung rather than going dark.

### 2. Creating the skill (PACK-15 — reuse, do not invent)

- **D-263-03: The write path is the EXISTING `POST /skills`** (`backend/app/api/skills.py:227`) —
  what `SkillFormDialog` already calls via `frontend/src/lib/api/skills.ts`. Variant A's UI **is**
  that dialog, so this adds **zero new API surface**.
  ⚠ **PACK-15 names `skill-creator` / `save_skill`; this is a deliberate reading of that wording,
  recorded rather than glossed.** The requirement's force is *"no second authoring engine"*, and
  `POST /skills` is the existing **human** path while `save_skill`
  (`backend/app/services/tool_dispatcher.py:1435`) is the existing **agent** path. Reaching
  `save_skill` from a UI dialog would require a `ToolContext` adapter — **new surface built to
  satisfy a word.** The rejected third option was extracting a shared service both paths delegate
  to; correct, but it refactors two shipped paths and touches `tool_dispatcher.py`
  (85 commits / 35 phases, **G-5 FIRING**).

- **D-263-04: The instructions body is authored by the EXISTING `skill-creator`, on approval.**
  A proposal carries `name` + `description` only. Pressing `Create this skill →` runs
  `skill-creator` to author the body, and the dialog opens **pre-filled with the generated
  instructions** for human review. This is the reuse `PACK-15` asks for by name, and it keeps the
  draft call from bloating.
  ⚠ **Measured reason for rejecting "drafter returns everything upfront"** (what the sketch mocked):
  the drafter already returns a 6-char `example_output` under load, which is *why* 261 had to add
  `min_length` floors. Adding five ~650-char instruction bodies to one structured output makes
  thinning likelier. Cost accepted: one LLM round-trip (~5-15 s) per approved skill.

- **D-263-05: The row is written IMMEDIATELY on approve.** A skill is genuinely useful standalone,
  so an abandoned Expert leaves **real library rows, not garbage**. Staging until Expert-save was
  rejected: it needs a holding store plus a deferred write — arguably the second engine `PACK-15`
  forbids — and a browser crash would lose approvals a human already gave.

- **Claude's discretion (derived from D-263-01 + D-263-04):** because the body is generated before
  the dialog opens, there is a loading moment between click and dialog that the sketch does not
  show. Render it in place on the proposal card (the card enters a generating state); do **not**
  open an empty dialog and fill it, and do **not** add a separate "Generate instructions" button.

### 3. The second hollowness — org-visibility (measured during discussion)

⚠ **A collision neither the ROADMAP nor the sketch saw, measured against shipped code:**
`POST /skills` **hard-sets `is_org_shared = False`** with the comment *"HARD-SET — never from the
caller (D-08 / T-118-02-01)"* (`api/skills.py:250`). But `resolve_expert_bundle`'s phase-2 member
check requires `is_system OR (org_id == caller_org_id AND is_enabled AND (user_id == caller OR
is_org_shared))` (`backend/app/services/expert_service.py:205-224`, **D-259-04**). **So a skill
created for an org-wide Expert is stripped for every org member except its author** — a second
hollowness, at run time, for everyone else. And flipping it is gated: `PATCH
/skills/{id}/toggle-global` (`api/skills.py:540`) refuses with a **409** unless the `eval_runs`
publish gate is met or `{"override": true}` is passed (GATE-01 / D-07).

- **D-263-06: `resolve_expert_bundle`'s skill predicate gains a THIRD ARM.**
  `... OR (the skill was born for THIS bundle)`. ⛔ **The `org_id == caller_org_id` fence is
  untouched**, so `PACK-17` is unaffected by this change and must still be driven independently.
  This IS a change to D-259-04's phase-2 check and therefore needs **its own RED drive** against a
  planted violation, in the shape of `test_259_expert_member_isolation.py`.

- **D-263-07: Migration 190 adds `public.skills.born_for_expert_bundle_id uuid NULL`.**
  The narrowest arm that closes the problem: a skill born for Expert A is **never** resolvable
  through Expert B. Rejected alternatives: a bare boolean + author linkage (no backfill needed, but
  any Expert-born skill of that author resolves through ANY of that author's Experts), and
  re-stamping on reuse (actively wrong at two bundles — the first Expert silently loses the skill).
  ⚠ **`is_org_shared` is NOT touched and the publish gate is NOT bypassed.**

- **D-263-08: The marker is BACKFILLED at Expert save.**
  The skill is created with `born_for_expert_bundle_id = NULL` (D-263-05 writes before a bundle id
  exists), and one `UPDATE` in the Expert save path stamps it. An abandoned Expert leaves the marker
  `NULL`, and the skill then behaves **exactly as it does today** — no new exposure from an
  abandoned draft.
  ⚠ `public.skills.org_id` is `NOT NULL` and populated by the `skills_autofill_org_id` BEFORE
  INSERT trigger (`autofill_org_id_by_owner('user_id')`, full-schema `:5234`) — the creating user's
  org, never a caller-supplied value. **That is the structural half of PACK-17 and it already
  ships**; this phase drives it rather than building it.

### 4. Saying so before it is saved (PACK-16)

- **D-263-09: The fence lives in BOTH places, and the server is the real one.**
  Frontend: variant A's disabled `Save Expert` plus the inline banner naming the count. Backend:
  `POST /experts` and `PATCH /experts/{id}` independently re-check `member_skills` against the live
  library. ⛔ **A UI-only fence is not a fence** — a stale client or a direct API call walks past
  it, which is this project's recurring finding (a green fence coexisting with the shipped defect,
  Phase 235).

- **D-263-10: The server REFUSES with a named 422.** The response names **each** unknown skill so
  any client can render the banner from the response rather than re-deriving it. Consistent with
  variant A's disabled Save. An author who genuinely wants to drop a capability removes it first —
  an explicit act. Rejected: accept-strip-and-report, which saves the Expert and moves the drift
  rather than closing it.
  ⚠ **This front-runs the run-time strip.** `expert_service.py`'s phase-2 check already discards
  unknown names silently at run time; save time is the only moment a human can still act.

### 5. The red line (PACK-15 / EXT-01)

- **D-263-11: The closed-core inventory is measurably unchanged from this phase's base commit.**
  Mirror **D-259-06**'s AST test: **7 phase types · 1 emitter · 29 tools**, **counted, never
  substring-matched.** ⭐ Phase 260 paid for that lesson when a planted `bundle_emit` passed all
  five fence tests. A skill is **DATA**, which is precisely why `EXT-01` permits this phase at all.

- **D-263-12: `PACK-17` is DRIVEN, not asserted.** A cross-org caller must find a skill authored in
  another org neither visible nor resolvable — driven the way `PACK-04` drove the member check.
  ⚠ `SEED-125` was a **real** cross-org skill leak, and this phase creates skills programmatically,
  which is exactly how one would recur.

### 6. AMENDED AT PLANNING — 2026-09-21, operator-ratified

⚠ **D-263-04's LITERAL WORDING IS REFUTED BY MEASUREMENT. The original above is kept unchanged
rather than rewritten, because the refutation is the finding.** It reads *"runs `skill-creator` to
author the body"*. Measured at `/gsd:plan-phase` research, then spot-verified independently by the
orchestrator against `supabase/migrations/087_skill_creator_reborn.sql:66-118` (row id
`…0010`, confirmed live in the local DB):

**`skill-creator`'s `instructions` are a SEVEN-STEP INTERACTIVE HUMAN INTERVIEW LOOP.** Verbatim:
*"Move one step at a time and keep the user in control"* · *"Ask focused questions, one small batch
at a time"*. It names five tools a sealed shot cannot expose (`search_documents`, `save_skill`,
`load_skill`, `read_skill_file`, `execute_code`), **its step 3 tells the model to call
`save_skill`** — which conflicts with the forced emitter *and* with **D-263-03** — and four of its
seven steps are Skill-Studio navigation choreography. ⛔ **It cannot be driven verbatim as a
`forced_emit` system prompt.** There is also **no programmatic driver for it anywhere** in
`backend/app/` or `frontend/src/`: every grep hit is a migration filename or a comment.
`_handle_save_skill` (`tool_dispatcher.py:1435`) is a **writer, not an author**.

- **D-263-13: THE DRIVER READING. `skill-creator` is reused as DATA, not as an engine.**
  The new module reads `skill-creator`'s **§3 craft block** (the five bullets under *"Apply this
  craft (it is what makes skills work or fail)"* — imperative form · explain the why sparingly ·
  generalize don't overfit · a pushy-but-honest description · progressive disclosure) **from the DB
  at call time**, and **contributes ZERO authoring doctrine of its own**. D-263-04's *force* —
  reuse, no second authoring engine — is preserved exactly; only its *mechanism* is corrected.
  ⛔ **This is made FALSIFIABLE, never rhetorical, and the fence is the deliverable:** stub the DB
  read to `""` and assert **none of the five craft bullets' tokens survive in the composed system
  prompt**. ⛔ **Drive it RED by inlining one bullet** — a fence nobody has seen fire is not a fence.
  ⚠ **The honest counter-argument, recorded rather than buried:** this codebase already has two
  `forced_emit` skill-text authoring services — `skill_tuner_service.build_candidates`
  (description) and **`skill_proposer_service.propose` (instruction BODY)**. The second is the
  near-exact mirror, and its prompt lives as **module prose**, which is precisely the shape the
  DB-read fence exists to refuse. It is **not directly callable** here (it needs an existing row +
  version + eval run). Mirror its `forced_emit` *call shape*; do **not** inherit its prompt home.

- **D-263-14: the body-authoring path is GATED by FLAG-01's `self_improve_enabled()`.**
  Operator-ratified 2026-09-21. Authoring a skill body is **AI writing skill text**, which is what
  that switch exists to stop; gating costs one `Depends` and keeps **one home per concern**.
  ⛔ **Only GENERATION is gated.** Proposal *listing* (PACK-14) and manual creation through
  `SkillFormDialog` stay ungated — a kill-switch that hides the proposals would make PACK-14
  invisible rather than safe. ⚠ Verify the switch's real name and call shape at its existing call
  sites before wiring; do not trust this paragraph's spelling of it.

- **D-263-15: the body-authoring route is `POST /experts/draft-skill-body` in `api/experts.py`,
  with `Depends(require_expert_manage)`.** ⛔ **Not optional and not a style choice:** a hidden
  second AST fence, `backend/tests/unit/test_261_single_expert_authoring_gate.py:77-90`, goes RED
  if an expert-authoring route omits that guard. Measured at research.

### Folded Todos

None. One todo matched by keyword only and was reviewed, not folded — see `<deferred>`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The measured defect this phase exists for
- `.planning/reported-bugs/an-authored-expert-has-no-domain-skills-because-none-exist-to-select.md` —
  `BUG-260921-01`, `folded_into: "263"`. The live drive, the 10-row library, the three secondary
  findings (two already fixed in 261 at `757bb9e25`).
- `.planning/seeds/SEED-303-an-expert-adds-scope-it-does-not-replace-it.md` — `status:
  partially-answered`. Scenario **S9**: *an Expert is only as capable as the library it draws from.*
  Its `trigger_paths` name `expert_service.py`, `api/experts.py`, `models/expert.py` — this phase's
  blast radius.
- `.planning/seeds/SEED-125-skill-tools-service-role-cross-org-leak.md` — `status: closed`. The
  **real** cross-org skill leak `PACK-17` exists to prevent recurring.

### Design contract (G-2 acceptance bar)
- `.planning/sketches/263-the-skills-an-expert-needs/README.md` — variant A, the winner, with the
  rejected B and C preserved and the "what to look for" list.
- `.planning/sketches/263-the-skills-an-expert-needs/index.html` — the interactive prototype,
  driven in Chrome with zero console errors.
- `.planning/sketches/MANIFEST.md` § *263 · The skills an Expert needs* — the registry entry and
  the recorded reason A beat B and C.

### Prior locked decisions this phase must not contradict
- `.planning/phases/259-an-expert-is-a-bundle-not-a-runtime/259-CONTEXT.md` — **D-259-04**
  (two-phase member boundary check — the predicate D-263-06 amends) and **D-259-06** (the
  mechanical closed-core inventory test D-263-11 mirrors).
- `.planning/phases/261-an-expert-you-can-author/261-CONTEXT.md` — **D-261-05** (non-ingesting AI
  drafting), **D-261-06** (human-in-the-loop review), **D-261-03/04** (`require_expert_manage`,
  single-home fence), **D-261-07** (Migration 189).
- `.planning/phases/260-the-expert-you-can-actually-use/260-CONTEXT.md` — **D-260-05** (closed-core
  seam, no `if expert:` in `agent_loop.py`).
- `docs/EXTENSION-CONTRACT.md` — `EXT-01`. A plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE.
  Never engine code.
- `CLAUDE.md` § *Workflow guardrails* — G-5 hot-file ledger, G-7 round cap, G-8 plan proportion.

### Source of truth in code
- `backend/app/services/expert_authoring.py:31-58` — `ExpertDraftOutput`, the schema D-263-02
  extends; `:110` — prompt item 11, the *"or include 3-5 recommended domain skill names"* hatch.
- `backend/app/services/expert_service.py:205-224` — `resolve_expert_bundle`, the phase-2 predicate.
- `backend/app/api/skills.py:227` (`POST /skills`, `is_org_shared` hard-set at `:250`) · `:540`
  (`toggle-global`, the publish gate).
- `backend/app/services/tool_dispatcher.py:1435` — `_handle_save_skill`, the agent path **not**
  chosen (D-263-03).
- `frontend/src/components/experts/ExpertAuthoringStudio.tsx:744-834` — the Skills section that
  splits · `frontend/src/components/skills/SkillFormDialog.tsx` — the dialog that is reused.
- `supabase/full-schema.sql:2696-2715` (table `public.skills`) · `:5234`
  (`skills_autofill_org_id`).

### Migrations
- `supabase/migrations/189_expert_presentation_and_grants.sql` — the last applied; **190** is next.
- Migration **190** (to be created) — `public.skills.born_for_expert_bundle_id`.
  ⚠ Apply by pasting into the Supabase SQL editor, **never** `supabase db push` / `db reset`, then
  `bash scripts/regenerate-full-schema.sh`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SkillFormDialog.tsx`** — Name · Description · Instructions · Files · Triggers. Opened
  pre-filled by variant A; no new dialog is built.
- **`POST /skills`** (`api/skills.py:227`) — already lints the description against owner-scoped
  siblings pre-persist (TRIG-03 / D-09/D-10) and **always saves**, attaching warnings. The
  proposal flow inherits that behaviour for free.
- **`skills_autofill_org_id` trigger** — org scoping on insert is already structural. PACK-17 is
  *driven*, not *built*.
- **`forced_emit` recovery ladder** — makes D-263-02's required field safe.
- **`test_259_closed_core_inventory.py` / `test_259_expert_member_isolation.py`** — the two test
  shapes this phase copies (D-263-11, D-263-12).

### Established Patterns
- **A skill is DATA (`EXT-01`)** — this is the entire legal basis for the phase. No executor, no
  emitter, no tool is added.
- **`require_expert_manage` + `require_capability('experts')`** (D-261-03, D-259-05) — every
  Expert mutation already routes through one permission helper. The save-time 422 (D-263-10) lands
  **inside** that existing guard, not beside it.
- **Two-phase member resolution** (D-259-04) — bundle first, then each member independently.
  D-263-06 amends exactly one disjunct of one predicate.

### Integration Points
- `ExpertDraftOutput` gains one field → `expert_authoring.py`, the `/experts/draft` response, and
  the studio's draft-apply handler (`ExpertAuthoringStudio.tsx:230`).
- The studio's Skills section splits → one new proposal-card component + the existing pill rail.
- `POST /experts` / `PATCH /experts/{id}` gain the member-existence check → named 422.
- The Expert save path gains the provenance backfill `UPDATE` (D-263-08).
- `resolve_expert_bundle`'s skill predicate gains one disjunct (D-263-06).

### G-5 hot-file warnings for this blast radius
- `backend/app/api/experts.py` (1/1/175) and `backend/app/services/expert_service.py` (2/1/274) are
  **young**, rows added at creation in 259 — below threshold.
- `backend/app/services/tool_dispatcher.py` (85/35/5048) is **G-5 FIRING** — D-263-03 deliberately
  avoids touching it.
- ⛔ **TWO FILES IN THIS BLAST RADIUS HAVE NO LEDGER ROW AND BOTH FIRE G-5 — measured 2026-09-21,
  not assumed.** `node scripts/check-hot-file-ledger.cjs 263` will **FAIL** a PLAN.md naming
  either, so the rows are added **before** planning, not after:
  | File | commits / phases / lines | State |
  |---|---|---|
  | `frontend/src/components/skills/SkillFormDialog.tsx` | **12 / 8 / 635** | ⛔ absent for its ENTIRE LIFE — invisible to its own guardrail at 8 phases |
  | `backend/app/api/skills.py` | **19 / 9 / 858** | ⛔ absent for its ENTIRE LIFE — invisible at 9 phases |
  Both are the files D-263-03 and D-263-01 reuse. Same-commit sync rule applies: a row in
  `CLAUDE.md`'s scan table **and** a section in `docs/HOT-FILE-LEDGER.md`, in one commit.
- `frontend/src/components/experts/ExpertAuthoringStudio.tsx`,
  `backend/app/services/expert_authoring.py` and `frontend/src/lib/api/skills.ts` **do** carry
  rows — re-derive their triples at planning rather than trusting the cells.

</code_context>

<specifics>
## Specific Ideas

- The five proposals modelled in the sketch are the concrete target shape for a doctoral
  literature-review Expert: `systematic-search-strategy` · `prisma-screening` ·
  `methodology-appraisal` · `thematic-synthesis` · `citation-integrity-check`. Use them as the
  worked example in tests and UAT — they are the exact domain the bug was driven against.
- The operator's G-4 bar, stated at scope time: **"an Expert whose capabilities match its
  description."** A UAT row that does not re-drive the PhD-literature-review prompt end-to-end has
  not tested this phase.
- ⚠ `BUG-260921-01` finding (c): the `phd-lr` row the feature was originally judged by is **stale
  mid-development data** and came from neither current path. **Re-draft before judging.**

</specifics>

<deferred>
## Deferred Ideas

- **The blueprint prose is never rewritten when a claimed capability is dropped.** An Expert can
  still *describe* a capability it knowingly lacks, in the 2163-char `description`. No variant in
  sketch 263 addresses this and this phase does not either — named here so it is a decision, not an
  oversight. Trigger: the first phase that edits `description` after save, or a user report that an
  Expert's blueprint over-promises.
- **`is_org_shared` and the publish gate are untouched.** D-263-06/07 route around the gate with a
  provenance marker rather than through it. Trigger: any phase that makes Expert-born skills
  separately discoverable in the Skills surface, where the gate's quality bar would start to matter.
- **`SEED-103`** — batched interview questions for `skill-creator`. D-263-04 drives `skill-creator`
  programmatically with no human interview, so batching is not on this path. Trigger unchanged.
- **`SEED-104`** — agent-driven skill file attachment. A proposed skill is created with
  instructions only, no files. Trigger: the first Expert whose capability genuinely needs a script
  or template attached.
- **`SEED-187`** — turning a long document into a teachable skill. A different entry point
  (Documents surface) to the same destination; not this phase's door.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.60) — matched on the generic keywords *authoring,
  phases, human, run, real*. It is an NL→**workflow** authoring spike and has nothing to do with
  skills or Experts. **Keyword false positive; not folded.**

</deferred>

---

*Phase: 263-An Expert Can Be Given Its Capabilities*
*Context gathered: 2026-09-21*
