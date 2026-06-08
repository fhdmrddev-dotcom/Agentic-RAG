# Unknown (d) — Does describe → refine → publish FEEL good (talking, not wiring)?

**Spike:** Phase 097 Plan 04 (Wave 1) — THROWAWAY · **Verdict author:** operator (human) · **Recorded:** 2026-06-09
**Evidence judged:** `scripts/spike-097/out/transcript.md` (the grounded describe → one-refine → re-draft conversation over the strict `WorkflowDefinition` schema) + `scripts/spike-097/out/unknown-c.md` (the grounding inventory).
**Method:** subjective human read of the authoring conversation. This is the call the spike could NOT automate (VALIDATION manual-only) — a written verdict, not a metric.

---

## Feel rating: MIXED

(GOOD / **MIXED** / POOR — the operator's one-line carry-forward into the Plan 05 go/no-go conclusion.)

> Operator verbatim: "Mixed until the workflow is built. The user must have to validate the grey areas until the workflow is built and of course user should be able to modify later or tweak as v2, v3..."

MIXED — not GOOD. The conversational shape is genuinely promising, but it is gated on TWO things the spike proved are not yet in place: an explicit grey-area validation loop during authoring, and a first-class "tweak → new version" path after publish. Until both exist, authoring leans on the user catching the model's silent guesses by eye — which is exactly the failure mode that makes it feel like wiring rather than talking.

---

## What felt GOOD

- **One sentence → a correctly-typed 4-phase pipeline.** From a single plain-English description the generator produced a sensible `llm_agent` (gather) → `llm_single` (draft) → `llm_human_input` (confirm) → `llm_agent` (finalize) shape. The structure was right, not just schema-valid.
- **The refine turn felt conversational, not like editing JSON.** "Make the research phase pull only from the /Risks subfolder, and add a human-confirm step before the file is produced" was absorbed as intent and re-drafted — the operator never touched a field by hand. That is the talking-not-wiring promise landing.
- **Human-confirm was INFERRED from the wording.** "pause for me to confirm before finalizing" produced an `llm_human_input` phase in the FIRST draft, before any refine. The generator read the operator's intent for a checkpoint correctly. (Note: this is also why the refine's "add a human-confirm step" did not add a SECOND one — it re-pointed the existing one at "before the file is produced". The model reconciled rather than duplicated, which is the right behavior but worth surfacing to the user, see grey areas below.)
- **Tools and template fields came through clean.** Every whitelisted tool was a real registry name (zero off-registry hallucinations) and the template placeholders (`project_name`, `report_date`, `rows`) were used. Grounding worked where it was wired.

## What made it MIXED — the friction (silent guessing on grey areas)

The generator's defining weakness this run: it **silently GUESSED on ambiguities instead of surfacing them.** Two concrete instances in the transcript:

1. **Non-existent "Acme" folder → silently substituted "Project Meridian — Risks".** The description said "the Acme project folder." No such folder exists in the grounded tree. Rather than ask, the generator quietly mapped it onto the real `Project Meridian — Risks` folder (id `75755ec9-…`) and embedded that id in the prompt. It happened to pick the right one — but the user was never told a substitution occurred, so a WRONG guess would have shipped just as silently.
2. **Spoken "/Risks subfolder" → mapped onto the whole folder (no such subfolder exists).** The refine asked to pull "only from the /Risks subfolder." There is no `/Risks` child in the tree. The generator equated `/Risks` with the entire `Project Meridian — Risks` folder and wrote "this is the /Risks subfolder" into the prompt as if the mapping were settled. Again: a plausible guess presented as fact, with no checkpoint for the user to confirm or correct.

Both are the SAME defect: an **unresolvable / ambiguous reference resolved by assumption, not by asking.** For a non-coder author this is dangerous precisely because the output LOOKS confident and schema-valid. You only catch the wrong guess if you happen to read the embedded folder id and know it's wrong. That is wiring-by-inspection, not talking.

Secondary friction (lower severity, same family):

- **Scope leaks into prompt TEXT, not a bound field.** Per unknown-c, the schema has no `folder_scope`, so the resolved folder id lives inside an `llm_agent` `prompt` string — a hint the agent can widen, not a server-side bound parameter. The authoring feel suffers because "only from /Risks" is expressed as a polite instruction, not an enforced boundary. (This is the PROJ-02 schema gap, tracked in unknown-c → Phase 098.)
- **No "are you sure?" before publish.** The loop drafts and re-drafts but never pauses to enumerate what it inferred ("I read 'Acme' as 'Project Meridian — Risks' — correct?"). There is no moment where the grey areas are laid on the table for human sign-off.

## The two requirements the operator made conditions of "good"

These are the gates that turn MIXED into GOOD. Both are carry-forward requirements for the Phase 103 NL-authoring loop.

### 1. Grey-area validation loop — clarify-as-you-go with explicit human validation (#1 priority)

Authoring must be a **conversation that surfaces each uncertainty and has the USER validate it**, iteratively, until the workflow is fully built — NOT one-shot-and-hope. During authoring the AI must SURFACE, and ask the user to confirm/correct, every grey area it would otherwise guess on:

- an unresolvable or ambiguous **folder reference** (e.g. "Acme" with no Acme folder; "/Risks" with no /Risks subfolder) — show the candidate match and ask before binding it;
- a **vague scope** ("the project folder" when several could match);
- an **unmapped template placeholder** (a field with no obvious data source);
- a **missing tool or skill** the requested behavior would need but the registry doesn't have.

The rule: **no silent substitution.** Every inferred mapping the generator is not certain about becomes a checkpoint the user clears. This is the single most important thing Phase 103's authoring loop must get right — it is the difference between "talking to a colleague who checks their assumptions" and "a confident black box that occasionally ships the wrong folder."

### 2. Post-build editability / versioning — tweak → new version (v2, v3, …)

A built/published workflow must **NOT be frozen forever.** The operator must be able to tweak it later into v2, v3, etc. This is compatible with the existing design anchors:

- `WorkflowDefinition` already carries a `version: int` field.
- The "no-edit-published" immutability anchor means you do not MUTATE a published version in place — but you CAN **publish a new version** from it.
- So the authoring UX needs a first-class **"tweak → new version"** path: open an existing (published) workflow, change it via the same describe→refine conversation, and publish it as the next version. **Immutability applies per-version, not per-workflow.**

Phase 103 (and the Phase 098 schema work) must record this: editability is a versioning operation, not a violation of immutability.

---

## Carry-forward (feeds Plan 05 go/no-go + downstream phases)

- **Phase 103 (Workflows page + NL authoring, WFAUTH-02):** build the clarify-as-you-go grey-area validation loop (surface unresolvable folder refs / vague scope / unmapped placeholders / missing tools+skills; user validates each before bind — no silent guessing). Add the "tweak → new version" authoring path. These two are acceptance bars, not nice-to-haves — they are what moves the feel from MIXED to GOOD. (Phase 103 is G-2 sketch-gated: `/gsd:sketch` before `/gsd:spec-phase`.)
- **Phase 098 (Project Binding + KB Scope Governance, PROJ-02):** add the additive bound `folder_scope` (per-phase) + `project_folder_id` (per-definition) so scope is a server-side bound parameter, not a hint inside prompt text. The generator should RESOLVE a spoken folder name/path against the real tree (path→id resolution is an authoring-time step) and emit a folder id the engine binds via `ToolContext.folder_subtree_ids`.
- **Versioning:** confirmed compatible with `WorkflowDefinition.version` + the "no-edit-published" anchor — immutability is per-version; editing republishes a new version.

**Bottom line for go/no-go:** the authoring *mechanism* works (grounded one-shot generation + conversational refine over the strict schema produces correctly-typed, schema-valid drafts), so the spike de-risks the Phase 103 generator. But the *experience* is MIXED until the grey-area validation loop and the tweak-to-new-version path are built — the operator's two named conditions for calling it good.
