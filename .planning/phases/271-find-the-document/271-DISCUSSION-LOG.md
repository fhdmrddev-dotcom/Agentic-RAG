# Phase 271: Find the Document - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-03
**Phase:** 271-find-the-document
**Areas discussed:** G-2 gate, Where the two searches live, Relationship + version filters, Rules surface rename + home

---

## G-2 sketch gate

| Option | Description | Selected |
|--------|-------------|----------|
| Discuss now, sketch before plan | Lock semantics now; sketch required before plan; logged as override | ✓ |
| Stop — run /gsd:sketch first | Honor G-2 strictly | |

**User's choice:** Discuss now, sketch before plan.

---

## Where the two searches live

| Option | Description | Selected |
|--------|-------------|----------|
| Mode switch on Documents tab | No sixth tab; Ask hands off to chat | ✓ |
| New sixth Library tab | Changes D-217-15 | |
| Extend Views tab | Blurs View vs search | |

**User's choice:** Mode switch on Documents tab.

| Option | Description | Selected |
|--------|-------------|----------|
| Labelled sort + 'no AI used' line | Visible field sort, exact-match line | ✓ |
| Only mode label differs | Implicit sort | |
| Both modes inline | Risks merge/re-rank | |

**User's choice:** Labelled sort + 'no AI used' line.

---

## Relationship + version filters

| Option | Description | Selected |
|--------|-------------|----------|
| Verb + document picker | Both directions, 4 types | ✓ |
| + has any / has none | Orphan finding | |
| Types only | Cannot answer "what supersedes X" | |

**User's choice:** Verb + document picker.

| Option | Description | Selected |
|--------|-------------|----------|
| Latest default; 3 explicit states | Latest / Has earlier / Superseded | ✓ |
| All versions default | Duplicates rows | |
| No superseded option | Fails FIND-03 | |

**User's choice:** Latest default; 3 explicit states.

---

## Rules surface rename + home

| Option | Description | Selected |
|--------|-------------|----------|
| Filing rules | | ✓ |
| Auto-sort rules | Collides with sort | |
| Organizing rules | Vague | |

| Option | Description | Selected |
|--------|-------------|----------|
| Library header link, rail entry removed | Sub-view, not a tab | ✓ |
| Sub-tab under Indexing | Buried | |
| Keep rail + add link | Two doors | |

**User's choice:** Filing rules; header link, rail entry removed.

---

## Claude's Discretion

Result columns, sort fields, pagination, row click, endpoint shape, compiler reuse.

## Deferred Ideas

"Has any / none relationship" orphan filter; save search as View.
