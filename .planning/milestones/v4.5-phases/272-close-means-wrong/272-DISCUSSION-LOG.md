# Phase 272: Close Means Wrong - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-03
**Phase:** 272-close-means-wrong
**Areas discussed:** Who decides close-means-wrong, Which date "October" means, How strict the empty result is, Refactor scope (G-5)

The operator selected the recommended option in all 17 questions.

---

## Who decides close-means-wrong

| Option | Description | Selected |
|--------|-------------|----------|
| Model, closed field list | Agent must filter on any named value of an org field; no flag, no migration | ✓ |
| Admin 'must filter' flag | Per-field toggle (migration + Settings); only flagged fields mandatory | |
| Both | Model filters; flag makes empty result stricter | |

| Option | Description | Selected |
|--------|-------------|----------|
| Per-request field list | Tool description built from org's enabled fields + enum values; old "call without filter first" guidance removed | ✓ |
| Static built-ins only | Fixed 7 keys; discover custom fields via query_documents_by_view | |

| Option | Description | Selected |
|--------|-------------|----------|
| Find's condition list | `filters` [{field, op, value}] via the 271 compiler; metadata_filter mapped to eq | ✓ |
| Flat dict + date_range | Keep equality dict, add separate date_range | |

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse, list valid values | Tool error names allowed values | ✓ |
| Pass through, fail closed | Matches 0 → "nothing matched" | |
| Case/format-insensitive match | Normalise, then refuse | |

## Which date "October" means

| Option | Description | Selected |
|--------|-------------|----------|
| Document date, others explicit | date_typed by default; source/added dates only when the user says so | ✓ |
| Any date matches (OR) | Broader; reintroduces wrong-month | |
| Upload date (created_at) | Wrong fact | |

| Option | Description | Selected |
|--------|-------------|----------|
| Excluded and counted | Undated docs excluded; count stated | ✓ |
| Excluded silently | | |
| Included | Breaks close-means-wrong | |

| Option | Description | Selected |
|--------|-------------|----------|
| Inject today, state range | Most recent completed October; resolved range stated | ✓ |
| Ask which year | Extra round trip every time | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, on the tool card | One visible text line; G-2 skip recorded; G-4 scenario | ✓ |
| Only in the answer text | Depends on the model remembering | |

## How strict the empty result is

| Option | Description | Selected |
|--------|-------------|----------|
| Structural lock | Dispatcher refuses a same-turn search that drops the field; a different value on the same field is allowed | ✓ |
| Prompt rule + distinct result | Board checks behaviour | |

| Option | Description | Selected |
|--------|-------------|----------|
| Best passages from the set | Threshold relaxed inside the filter set; marked low-similarity | ✓ |
| Nothing, with a distinct reason | Stricter; may refuse answerable questions | |

| Option | Description | Selected |
|--------|-------------|----------|
| Name filter, offer nearby | Nearby values from a document-level count, never cited | ✓ |
| Name filter only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Four distinct kinds | found / 0 docs matched / invalid filter / unavailable; audit records filter + kind | ✓ |
| Keep today's single message | The SC#2 failure | |

## Refactor scope (G-5)

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow cut (dispatcher) | search_documents handler + audit + lock to own module | ✓ |
| Full registry/handler split | | |
| Honoured by construction | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Honoured by construction (agent_loop) | ~10 lines in SYSTEM_PROMPT; seam owed → 273 | ✓ |
| Extract the seam now | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Exact scan for small sets | Resolve to a document set; exact below threshold, iterative_scan above; unfiltered unchanged | ✓ |
| Turn on iterative_scan globally | | |
| Measure only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| 3 prompts per provider | October / entity / empty period; a correct answer without the filter FAILS | ✓ |
| 1 prompt per provider | | |

## Claude's Discretion

Extraction module boundaries, handler module name, the RPC parameter vs a new RPC, the measured exact-scan threshold, where the lock's per-turn state lives, copy wording, plan count (3-5).

## Deferred Ideas

The SEED-153 workflow-input binding, the publish-gauntlet gate and the workflow citation post-gate; an admin must-filter flag; the full dispatcher split and the agent_loop prompt seam (→ 273); global iterative_scan.
