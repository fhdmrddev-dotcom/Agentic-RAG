# Phase 099: Workflow ↔ Skill Composition - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 099-workflow-skill-composition
**Areas discussed:** Snapshot mechanics, Composition shape, skill_ref identity & lifecycle, Cross-provider UAT depth

---

## Snapshot mechanics

### Q1: What should the "skill version snapshot" actually be?

| Option | Description | Selected |
|--------|-------------|----------|
| Content copy into definition (Recommended) | Copy instructions + file manifest INTO the definition JSONB; self-contained, zero new tables; runs always use the snapshot | ✓ |
| New skill_versions table | Real versioning infra; skill_ref pins a version id; much bigger blast radius (Skills CRUD, save_skill, import/export, UI) | |
| Hash-pin + live lookup | Store ref + content hash; verify at run; a deleted skill still breaks unless a fallback copy is added | |

**User's choice:** Content copy into definition

### Q2: How should the snapshot handle the skill's attached FILES?

| Option | Description | Selected |
|--------|-------------|----------|
| Copy files at snapshot (Recommended) | Copy each file to a workflow-owned Storage path (definition id + version); read_skill_file reads snapshot copies | ✓ |
| Manifest + hash only, warn on missing | Live reads; observable warning on drift/missing (clip-and-observe); "cannot break" only softly held | |
| Instructions only, no file snapshot | Files live-resolved, no guarantees; read_skill_file errors when source skill deleted | |

**User's choice:** Copy files at snapshot

### Q3: When does the skill snapshot get taken?

| Option | Description | Selected |
|--------|-------------|----------|
| At publish (Recommended) | Drafts keep a live reference; draft→published transition materializes the snapshot; enforced in today's validate/save path (098 D-07 precedent) | ✓ |
| At every definition save | Drafts also frozen; storage churn on every save; authors can't pick up live skill improvements while iterating | |

**User's choice:** At publish
**Notes:** Captured consequence — republish (tweak→new-version) re-snapshots the current skill state. Code fact: drafts cannot execute (kickoff requires status='published'), so only snapshotted definitions ever run.

---

## Composition shape

### Q1: How should the skill's instructions land in the phase framing?

| Option | Description | Selected |
|--------|-------------|----------|
| Append as delimited block (Recommended) | Phase prompt first/primary; skill block follows ('## Skill: {name}' + instructions + file list); single system string, provider-agnostic | ✓ |
| Prepend before phase prompt | Skill-as-persona first; risks skill overriding phase intent | |
| You decide | Planner picks; capture only single-system-string constraint | |

**User's choice:** Append as delimited block

### Q2: Should skill FILE CONTENTS be inlined into the framing, or fetched on demand?

| Option | Description | Selected |
|--------|-------------|----------|
| List files, fetch on demand (Recommended) | Framing lists filenames (mirrors load_skill); contents via auto-whitelisted read_skill_file | ✓ |
| Inline contents up to a cap | Small text files inlined; needs cap policy | |
| Inline everything | No tool dependency; context blow-up risk | |

**User's choice:** List files, fetch on demand

### Q3: What should skill_ref do on llm_single (no tools)?

| Option | Description | Selected |
|--------|-------------|----------|
| Instructions-only compose (Recommended) | Instructions compose; file list omitted; auto-whitelist inert (folder_scope shape-symmetry pattern) | ✓ |
| Disallow skill_ref on llm_single | Validation error; contradicts the SC which names llm_single | |
| Inline small files for llm_single only | Compensates for missing tool; asymmetric code path + cap policy | |

**User's choice:** Instructions-only compose

### Q4: Should skill_ref also go on llm_batch_agents for shape symmetry?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, carry to batch too (Recommended) | 098 folder_scope precedent; each fanned sub-agent gets the same skill framing + whitelist; avoids a second schema change | ✓ |
| No — llm_agent + llm_single only | Strictly the SC's named types; add later if needed | |

**User's choice:** Yes, carry to batch too

---

## skill_ref identity & lifecycle

### Q1: What is skill_ref — the skill's UUID or its name?

| Option | Description | Selected |
|--------|-------------|----------|
| UUID (Recommended) | Consistent with 098 resolved-ids rule; rename-proof; Phase 103 generator resolves names → ids; snapshot stores name/description too | ✓ |
| Name (matches tools today) | Matches load_skill/read_skill_file resolution; renames re-point references; private/global collisions ambiguous | |

**User's choice:** UUID

### Q2: What must be true about the skill at PUBLISH time?

| Option | Description | Selected |
|--------|-------------|----------|
| Visible + enabled (Recommended) | Exists + owned-or-global to author + is_enabled; violation = definition-save validation error (098 D-07 pattern) | ✓ |
| Visible only, ignore enabled flag | Any visible skill snapshotable; treats is_enabled as Deep-chat-only | |

**User's choice:** Visible + enabled

### Q3: One skill per phase, or allow multiple?

| Option | Description | Selected |
|--------|-------------|----------|
| Single skill_ref (Recommended) | SC wording ("reference a skill"); unambiguous framing; list later is additive zero-migration | ✓ |
| List of skill_refs | More expressive; multiplies framing-order/snapshot/validation cases ahead of need | |

**User's choice:** Single skill_ref

---

## Cross-provider UAT depth

### Q1: How deep should 099's live cross-provider UAT go?

| Option | Description | Selected |
|--------|-------------|----------|
| Representative-4 (Recommended) | OpenAI/Anthropic/Google/OpenRouter, one model per SC#10 axis; skill composition is a provider-agnostic string append (098 D-09 reasoning); full native-7 reserved for Phase 101 | ✓ |
| Full native-7 + OpenRouter | Whole roster here; ~2× UAT time for a surface with no provider-variant code path | |

**User's choice:** Representative-4

---

## Claude's Discretion

- Exact delimiter format of the skill block; whether the description composes or stays metadata.
- Snapshot JSONB field shape/naming; storage bucket/path layout + access rule for snapshot copies.
- Snapshot size guardrail (lean: none in 099, observe first).
- Migration mechanics (likely zero-migration — skill_ref lives inside the definition JSONB).
- Retry-suffix ordering relative to the skill block (lean: retry suffix last).

## Deferred Ideas

- Skills UI awareness of referencing workflows (delete-warning UX) → Phase 103 / Skill Studio.
- General skill versioning (skill_versions table) → future Skill Studio milestone.
- Multiple skills per phase → additive later.
- Full native-7 + OpenRouter gauntlet → Phase 101 (spike Condition 7).
- Global-publish privacy interaction (private skill in a global workflow) → STRETCH Phase 109 note.
