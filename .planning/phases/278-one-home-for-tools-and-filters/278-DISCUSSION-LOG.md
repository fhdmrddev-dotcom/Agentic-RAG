# Phase 278: One Home for Tools and Filters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 278-one-home-for-tools-and-filters
**Areas discussed:** Dispatcher split shape, Tests during the move, Retrieval seam verdict, Vocabulary scope + SEED-336

---

## Dispatcher split shape

| Option | Description | Selected |
|--------|-------------|----------|
| By family, in a package | `app/services/tools/`, ~8 family modules | ✓ |
| By family, flat siblings | `tool_*.py` beside `search_documents_tool.py` | |
| One file per tool | 30 files; shared helpers need their own home | |

| Option | Description | Selected |
|--------|-------------|----------|
| Everything | All 30 handlers move; split deferred twice already (OV-273-02) | ✓ |
| Biggest families only | Sandbox + render_template (~2,200 L) now, rest owed again | |

| Option | Description | Selected |
|--------|-------------|----------|
| Registry + dispatch_tool stay in tool_dispatcher.py | Importers unchanged | ✓ |
| Separate tool_registry.py | Cleaner names, one more module to learn | |

**User's choice:** all recommended options.

---

## Tests during the move

| Option | Description | Selected |
|--------|-------------|----------|
| Retarget only, proven by a diff check | Same commit; zero assert lines changed | ✓ |
| Handlers look names up via tool_dispatcher | No test edits, but loses the AST-identical proof | |

| Option | Description | Selected |
|--------|-------------|----------|
| Repoint + anchor check | Each fence targets the new file and asserts it found its anchor | ✓ |
| Scan the whole tools package | Fewer edits; a fence passes if any file matches | |

**User's choice:** both recommended options.
**Notes:** measured 68 string patch targets in 13 test files and 19 source-text fences on `tool_dispatcher.py`. Re-exports cannot keep string patches working (patch-where-used).

---

## Retrieval seam verdict

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm discharge only | AST pin at base; correct stale records beside originals; no code change | ✓ |
| Also retire the 7 re-exports | Repoints 6 importers incl. FIRING `agent_loop.py` | |

**Notes:** measured at discuss: `retrieval_service.py` 174 lines, one function (orchestrator only).

---

## Vocabulary scope + SEED-336

| Option | Description | Selected |
|--------|-------------|----------|
| The 3 backend files | Exactly DEBT-09's wording | ✓ |
| Backend + frontend word list | Cross-language fence against `findState.ts` | |

| Option | Description | Selected |
|--------|-------------|----------|
| Defer SEED-336, write routing back | Fix changes saved-View results; breaks SC#4 | ✓ |
| Fold into 278 | Needs a correct-but-different vs 422 choice | |

**Notes:** the frontend holds only the 3-word type, not a word→column map. Measured drift: the two backend date maps already differ (4 vs 3 entries).

---

## Claude's Discretion

- SC#5 live smoke provider: Anthropic (native), one two-tool row.
- Vocabulary module name; exact handler module boundaries within "by family".
- Plan count 3-4 per G-8.

## Deferred Ideas

- SEED-336 fix (first phase allowed to change Find/Views results).
- Retiring `retrieval_service.py` back-compat re-exports.
- Cross-language vocabulary fence.
- SEED-224 five-tab redesign.
- Todo `spike-nl-workflow-authoring.md` reviewed, not folded (keyword-only match).
