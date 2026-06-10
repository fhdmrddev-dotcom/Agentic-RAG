# Phase 101: Template-Fill + Integrity Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 101-template-fill-integrity-validation
**Areas discussed:** Arbitrary-upload ambition, Format coverage, Fill seam (tool vs phase),
Integrity-fail behavior, Library-asset scope, Citation surfacing, MiniMax bug routing, Monty

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Arbitrary-upload ambition | How far to push filling user-uploaded docs with no Jinja tags | ✓ |
| Format coverage (docx/pptx/xlsx) | docx-first + documented limits vs all-three-first-class | ✓ |
| How fill plugs in (tool vs phase) | Reusable agent tool vs workflow-phase composition | ✓ |
| Integrity-fail behavior | Gate + retry + data fallback vs hard fail | ✓ |

**User's choice:** All four selected. Added a forward-roadmap note: investigate **pydantic/monty**
as a possible dynamic alternative to Docker for the sandbox (see Monty section).

---

## Arbitrary-upload path

| Option | Description | Selected |
|--------|-------------|----------|
| Provenance split + token replace | Library assets → docxtpl/Jinja; ephemeral uploads → non-Jinja run-safe `{{token}}` replace (scalar only); uploads never hit Jinja → SSTI structurally impossible; unmarked docs out of scope | ✓ |
| Also attempt unmarked semantic fill | Model finds where data goes in an arbitrary token-less doc | |

**User's choice:** Provenance split + token replace (Recommended).
**Notes:** Plan must handle Word run-splitting (Pitfall 1). Unmarked free-form fill → deferred SEED.

---

## Format coverage

| Option | Description | Selected |
|--------|-------------|----------|
| docx first-class; pptx/xlsx best-effort + documented | docx both engines; pptx/xlsx scalar fill + documented hard limits; integrity always runs on all 3 | ✓ |
| All three first-class working | Commit to pptx row-growth + xlsx chart preservation as features | |

**User's choice:** docx first-class; pptx/xlsx best-effort + documented (Recommended).
**Notes:** No silent caps — the verdict states what filled / what didn't. python-docx/pptx/openpyxl
already in the sandbox image; only docxtpl is net-new.

---

## How fill plugs in (fill seam)

| Option | Description | Selected |
|--------|-------------|----------|
| Reusable render_template agent tool | Deterministic; sandbox; engine-by-provenance; citation + integrity gate; returns file + verdict; usable from Deep + workflows; no new phase_type | ✓ |
| Workflow-phase composition only | llm phase → programmatic render phase; not a Deep tool | |

**User's choice:** Reusable render_template agent tool (Recommended).
**Notes:** Composes llm_agent + the tool; Deep chat can fill templates too. LLM produces the cited
field-map (typed arg); the tool produces the file.

---

## Integrity-fail behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Gate + bounded retry + honest fail with data fallback | Corrupt never delivered; retry on harness loop; on final fail, honest error + preserve cited field-map | ✓ |
| Hard fail only (no data fallback) | Fail cleanly without surfacing the extracted data | |

**User's choice:** Gate + bounded retry + honest fail with data fallback (Recommended).
**Notes:** Citation/coverage failures reject before render; integrity failures reject after. This is
the concrete output_file_valid + citations_required that Phase 102 generalizes.

---

## Library-asset scope

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve + fill; defer author-attach UX to 103 | Render engine + asset resolution + fills both sources; seeded library-asset fixture for UAT | ✓ |
| Build full library-asset lifecycle now | Author-upload-asset API/UI + no-TTL storage + binding in 101 | |

**User's choice:** Resolve + fill; defer author-attach UX to 103 (Recommended).
**Notes:** SC#1 needs library templates to fill; 101 resolves an AssetRef → Storage bytes; the rich
author-attach UX is Phase 103. Implements the assets[] behavior 100/D-13 assigned here.

---

## Citation surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Run output only; clean file | source_chunk_id in field-map + verdict; delivered file clean; in-file embedding deferred to 106/107 | ✓ |
| Embed citations in the produced file | Footnotes / sources appendix / cell comments | |

**User's choice:** Run output only; clean file (Recommended).
**Notes:** Matches spike open-Q-ii (provenance lives in run OUTPUT) + Phase 102's citations_required.

---

## MiniMax bug routing (BUG-260607-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Cover + document, leave open | 101 cross-provider field-map UAT includes the MiniMax row; pass or documented; 101 doesn't own the fix | ✓ |
| Fold into 101 | Make 101 responsible for the service-boundary repair | |
| Defer entirely | Skip MiniMax in the roster UAT | |

**User's choice:** Cover + document, leave open (Recommended).
**Notes:** Bug stays open; its re-open trigger ("cross-provider workflow UAT surfaces it") is satisfied
by this phase. Frontmatter updated to record the routing.

---

## Monty (operator forward-roadmap note)

**Investigated:** `https://github.com/pydantic/monty` — experimental Rust restricted-Python
interpreter; microsecond startup vs Docker's ~195ms; **no third-party library support**.

**Conclusion:** Disqualifying for the Phase-101 render path (can't run docxtpl/python-docx/
python-pptx/openpyxl). Captured as **SEED-070** — a forward *dynamic execute-backend selector*
(monty for lightweight no-deps Python, Docker for library-heavy render) that could relieve
`BUG-260607-02` warm-up latency. D-13 keeps the render-backend seam swappable to enable it later.

## Claude's Discretion

- Token-marker syntax + run-merging algorithm (arbitrary path).
- render_template tool name + typed arg schema + per-phase whitelisting (099 pattern).
- Sandbox invocation details; retry bound count; worded→ordinal hook shape; SSE reuse.

## Deferred Ideas

Monty/dynamic backend (SEED-070); unmarked semantic fill; in-file citation embedding (106/107);
pptx/xlsx first-class; author-attach UX (103); output re-ingestion (SEED-069/102); domain mapping
values (104).
