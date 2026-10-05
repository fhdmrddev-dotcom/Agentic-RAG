# Phase 274: Thread-Scoped Attachments - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-05
**Phase:** 274-thread-scoped-attachments
**Areas discussed:** 'Ingested' meaning, Attachment lifetime, Promote flow, Duplicate rule, Guardrails (G-2 / G-4)

Pre-discussion measurement (code read at HEAD): ATT-01/02 largely built by Phase 244; gaps = promote
(not built), thread-delete leaves `workspace-files` bucket bytes, 24h TTL. Seeds sweep: 0 matched (no
plans yet); SEED-247 folded by hand.

---

## 'Ingested' meaning

| Option | Description | Selected |
|--------|-------------|----------|
| Inline-only | Keep D-244-03; never chunked/embedded; 10 MB | ✓ |
| Chunk + thread scope | Thread-scoped vectors; touches 231 RLS sites + 272 seam | |
| Inline now, seed the other | Inline + plant a re-open seed | |

| Option (size cap) | Description | Selected |
|--------|-------------|----------|
| Keep 10 MB | Shared MAX_FILE_SIZE; verbatim 422 | ✓ |
| Raise for attachments only | Separate cap + setting | |
| You decide | | |

| Option (SC#1 proof) | Description | Selected |
|--------|-------------|----------|
| Full roster, 8 rows | Planted fact per provider + OpenRouter | ✓ |
| One provider + negative | Only valid if agent loop untouched | |

## Attachment lifetime

| Option | Description | Selected |
|--------|-------------|----------|
| Life of the thread | No 24h cliff; templates keep 24h | ✓ |
| Keep 24h | No change | |
| Separate setting, longer default | e.g. 30 days | |

| Option (thread delete) | Description | Selected |
|--------|-------------|----------|
| Delete rows + bucket bytes | Fix the orphaned-bytes gap | ✓ |
| Rows only | Today's behaviour | |

## Promote flow

| Question | Options | Selected |
|--------|-------------|----------|
| Placement | Chip + panel / Chip only / Panel only | Chip + panel |
| Folder choice | Reuse MoveToFolderDialog (required folder) / Default + change | Reuse MoveToFolderDialog |
| After promotion | Stays, chip says 'In Library' / Moves | Stays + 'In Library' |
| Rights | Same as Library upload / You decide | Same as Library upload |

## Duplicate rule

| Question | Options | Selected |
|--------|-------------|----------|
| Same bytes already in org | Link + say where / Refuse / Copy anyway | Link + say where |
| Same name, different bytes | New version, warned / Silent version / Ask version-or-both | New version, warned |

## Guardrails

| Question | Options | Selected |
|--------|-------------|----------|
| G-2 sketch | Sketch first / Skip, recorded | Sketch first |
| G-4 scenarios (multi) | Library pollution · Agent can't see it · Promote lands wrong · Delete eats the keeper | All four |

## Claude's Discretion

- Mechanism separating chat attachments from workflow template inputs (kind / route param / NULL expiry)
- Existing expired rows: forward-only
- Promote route's module home; server-side byte copy
- What the 'In Library' mark persists on

## Deferred Ideas

- Thread-scoped chunking/embedding (SEED-247 Q2)
- Higher attachment size cap
- Promote agent-written workspace files (SEED-038 / Phase 273)
- "Keep both" on same-name promote
- Remove a single attachment from a thread
