# Phase 46: Smart Skill Dispatch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 46-smart-skill-dispatch
**Areas discussed:** Relevance matching, tool filtering, catalog format, edge cases, embedding storage, match limits, fallback behavior

---

## Relevance Matching Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Embedding similarity | Reuse text-embedding-3-small to compute cosine similarity between user message and skill descriptions. One extra embedding call per message (~50ms). | ✓ |
| Keyword matching | Match words from skill descriptions against user message. Zero latency but misses semantic matches. | |
| LLM pre-classification | Send skill catalog + message to cheap model for classification. Most accurate but adds cost and latency. | |
| Hybrid keyword + embedding | Keywords for exact matches, embeddings for semantic depth. More complex. | |

**User's choice:** Embedding similarity
**Notes:** "Research how skills are triggered in Claude and advise" — led to the insight that skill dispatch is essentially RAG for skills. The existing embedding_service infrastructure can be reused.

---

## Embedding Source

| Option | Description | Selected |
|--------|-------------|----------|
| Description only | Simpler, less storage, but may miss name matches. | |
| Name + description combined | Embed "SkillName: Skill description" — matches both name and description keywords. | ✓ |
| Separate embeddings | 2x storage and query cost for marginal accuracy gain. | |

**User's choice:** Name + description combined

---

## Similarity Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 0.4 (match existing RAG threshold) | Consistent with RAG logic, but may let in loosely-related skills. | |
| 0.5 (moderate strictness) | Skills should be clearly relevant. Reduces false positives. | ✓ |
| Configurable via .env (default 0.5) | More flexible but another config parameter. | |

**User's choice:** 0.5 threshold

---

## Match Cap

| Option | Description | Selected |
|--------|-------------|----------|
| No limit | Can inject 10+ skills if many are relevant. | |
| 3 skills max | Very conservative. Most messages need 0-2 skills. | |
| 5 skills max | Covers multi-skill scenarios while keeping prompt size reasonable. | ✓ |
| 8 skills max | Generous. Rarely exceeded but extra tokens when not needed. | |

**User's choice:** 5 skills max

---

## Tool Definition Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Conditional — include only when skills match | 0 matches = no skill tools (except save_skill). Cleanest SKILL-02 compliance. | ✓ |
| Always include | Simpler code but LLM might call load_skill for skills not in catalog. | |

**User's choice:** Conditional — include skill tools only when relevant skills exist; save_skill always available

---

## Catalog Format

| Option | Description | Selected |
|--------|-------------|----------|
| Same format, shorter list | Minimal code change — same `- **SkillName**: description` format, just fewer entries. | ✓ |
| Compact format | Fewer tokens but harder for LLM to match intent. | |

**User's choice:** Same format, shorter list

---

## No-Match Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Include nothing | No catalog, no load_skill/read_skill_file. Only save_skill remains. | ✓ |
| Fallback to first skill | Risks irrelevant skill injection. | |

**User's choice:** Include nothing when no skills match

---

## Explicit Skill Name Bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Always include if name explicitly mentioned | Guarantees intentional skill activation works regardless of embedding score. | ✓ |
| Embedding-only (no keyword bypass) | Risks failing obvious cases where user names a skill directly. | |

**User's choice:** Always include if name is explicitly mentioned in the user's message

---

## save_skill Availability

| Option | Description | Selected |
|--------|-------------|----------|
| Always include save_skill | Users can create skills at any time. Separating tool sets gets weird — keep all 3 together. | ✓ |
| Only include save_skill when skills match | Prevents over-triggering risk but blocks organic skill creation. | |

**User's choice:** Always include save_skill in General Mode

---

## Embedding Storage

| Option | Description | Selected |
|--------|-------------|----------|
| In skills table via pgvector | Add `embedding vector(1536)` column to skills table. Update on create/update. | ✓ |
| Separate skill_embeddings table | More normalized but adds a JOIN per query. | |

**User's choice:** In skills table via pgvector

---

## Embedding Update Timing

| Option | Description | Selected |
|--------|-------------|----------|
| On create/update/delete | Compute embedding in the same API call that saves the skill row. | ✓ |
| On-the-fly per request | No storage needed but unacceptable latency. | |

**User's choice:** On create/update/delete

---

## Frontend Changes

| Option | Description | Selected |
|--------|-------------|----------|
| Backend only, no frontend changes | Existing skill_activated SSE event is sufficient. Matching is transparent. | ✓ |
| Add 'considering skills' loading hint | Nice-to-have but adds complexity for minimal UX gain. | |

**User's choice:** Backend only

---

## Fallback on Embedding Service Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback to all skills on error | Degrades gracefully — over-triggering protection is lost but skills remain functional. | ✓ |
| Fallback to no skills on error | More conservative, prevents over-triggering, but user might not access skills at all. | |

**User's choice:** Fallback to all skills on error

---

## Claude's Discretion

Areas where user said "you decide" or deferred to implementation:
- Exact pgvector index type (IVFFlat vs HNSW)
- Backfill strategy for existing skills without embeddings
- Exact embedding call placement in CRUD endpoints
- Whether `read_skill_file` should also be available without matching skills
- Similarity threshold fine-tuning (0.5 is starting default)

---

## Deferred Ideas

- Frontend indicator showing which skills were matched — nice-to-have but not required
- Skill categories/tags for faster pre-filtering — over-engineering for current scale
- LLM-based pre-classification for skill matching — adds latency and cost
- Configurable skill match limit UI — config-only is fine for v2.4