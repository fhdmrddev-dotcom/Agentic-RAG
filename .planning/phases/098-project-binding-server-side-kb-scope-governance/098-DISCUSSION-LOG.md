# Phase 098: Project Binding + Server-Side KB Scope Governance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 098-project-binding-server-side-kb-scope-governance
**Areas discussed:** Output-side schema dimension, Scope-enforcement behavior, Cross-provider validation depth

---

## Pre-discussion: what was already locked (not re-asked)

Carried forward from `scripts/spike-097/CONCLUSION.md` (operator-confirmed GO, 2026-06-09) and
`.planning/REQUIREMENTS.md`:
- Schema is additive-optional / zero-migration (old workflows validate unchanged).
- `project_folder_id: UUID|None` on `WorkflowDefinition` (PROJ-01).
- Per-phase `folder_scope: list[UUID]|None` = bound resolved-id list, not a prompt hint (PROJ-02).
- Server-side scope resolution from RLS context at run start; bound to every retrieval call; retrieved `folder_id`s ⊆ scope; RLS backstop (GOV-01).
- Red line: Deep-mode byte-identical; additive seams only.

Codebase scout confirmed the scope channel (`ctx.folder_subtree_ids` → `search_documents(folder_ids)` → RPC `p_folder_ids`) already exists; 098 changes the scope *source* + adds the ⊆ assert + observability.

---

## Reported-bugs cross-check (MANDATORY touchpoint)

3 open `surface: Agentic-RAG` reports reviewed; none overlap the project-binding / scope-governance domain.

| Report | Severity | Disposition |
|---|---|---|
| `general-chat-intermittent-silent-send-drop` | minor | leave open — chat composer, outside domain |
| `minimax-m3-invalid-tool-args-400` | minor | leave open — watch item during 098 cross-provider UAT |
| `setting-up-agent-hides-model-activity` | major | leave open — Deep-mode dispatch banner, outside domain |

No folds into Phase 098.

---

## Output-side schema dimension

| Option | Description | Selected |
|--------|-------------|----------|
| Lock the field shapes now (098) | Reserve `output_target_folder`/`reingest_output`/`version_policy`/`provenance` as additive-optional in 098; wiring deferred | ✓ |
| Defer the whole dimension | Don't touch the schema until output behavior is built (Phase 100/101/102) | |

**User's choice:** Lock the shapes now (accepted recommendation).
**Notes:** Additive + zero-migration → free to reserve; avoids a second migration; old rows validate against the final shape forever. `provenance: source|derived` is the one net-new field and is a self-feedback amplification guard. Behavior stays deferred.

---

## Scope-enforcement behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Clip + observable warning | Drop out-of-scope rows, continue the run, emit a visible run-log warning | ✓ |
| Hard-reject | Fail the whole retrieval/run on any out-of-scope row | |
| Clip silently | Drop rows with no run-log signal | |

**User's choice:** Clip + observable warning (accepted recommendation).
**Notes:** Resilient (one stray row doesn't kill a long run) and auditable (loud in the run log — satisfies SC#4 "observable"). Plus: per-phase `folder_scope` enforced narrow-only (⊆ project subtree), caught at publish/lint time rather than silently clipped at runtime.

---

## Cross-provider validation depth

| Option | Description | Selected |
|--------|-------------|----------|
| Representative-4 here, full native-7 reserved for Phase 101 | 098 confirms bound scope + ⊆ assert per provider on the big-4; the full structured-output gauntlet lands in Phase 101 where the field-map emission varies by provider | ✓ |
| Full native-7 + OpenRouter in 098 | Run Condition 7's full roster against the scope-bind path now | |

**User's choice:** Representative-4 here, full native-7 reserved for Phase 101 (accepted recommendation).
**Notes:** Scope is bound server-side → provider-agnostic by construction (the model can't widen regardless of provider). Condition 7's traps (GLM/MiniMax tool-drop; DeepSeek/Moonshot truncation) bite on the field-map *emission*, which is Phase 101. User explicitly blessed the split.

---

## Claude's Discretion

- Whether to co-lock `inputs` / `assets` schema shapes in 098's migration (lean: co-lock to avoid a second additive migration; behavior stays owned by Phases 100/103).
- Migration mechanics: column types, single vs split migration, exact placement of the RPC/post-query ⊆ assert.

## Deferred Ideas

- Output re-ingestion behavior (SEED-069 wiring) → Phase 100/101/102.
- `inputs`/`assets` behavior → Phase 100 + Phase 103.
- Full native-7 + OpenRouter structured-output validation → Phase 101.
- Workflows page UI → Phase 103.
- `minimax-m3-invalid-tool-args-400` → leave open; watch during 098 cross-provider UAT.
