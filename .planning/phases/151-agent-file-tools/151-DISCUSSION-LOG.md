# Phase 151: Agent File Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 151-agent-file-tools
**Areas discussed:** FILE-02 no-original fallback, FILE-01 attach sources, FILE-01 target & collisions, SC#3 mid-chat hand-off

---

## FILE-02 — no-original behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Error honestly | Return a clear error ('no original stored — use read_document'); tool always means 'real bytes'; matches SEED-108 honesty tie-in | ✓ |
| Silent text fallback | Write extracted markdown/text as a .txt/.md instead — re-introduces the overclaim SEED-108 kills | |
| Error + auto-attach text | Error but also drop extracted text as `<name>.extracted.txt` — more code, risk agent treats it as original | |

**User's choice:** Error honestly.
**Notes:** Honesty is a first-class value here — never let a model present a reconstruction as the real file.

## FILE-02 — size cap

| Option | Description | Selected |
|--------|-------------|----------|
| 50 MB, refuse over | ~50 MB (covers virtually all KB docx/pdf/pptx), streamed to disk, operator-tunable knob, never truncate binary | ✓ |
| 25 MB, refuse over | Tighter cap matching common upload limits | |
| 100 MB, refuse over | Generous cap for image-heavy PDFs/decks | |

**User's choice:** 50 MB, refuse over.
**Notes:** Operator-tunable env/setting knob; never truncate a binary.

## FILE-02 — landing dir

| Option | Description | Selected |
|--------|-------------|----------|
| `/sandbox/input/<filename>` | SEED-108 convention; separate from /sandbox/output/ + scratch; tool returns exact path | ✓ |
| `/sandbox/<filename>` | Same dir execute_code injects skill files into today; mixes fetched inputs with scratch | |
| You decide | Let planner pick; contract is 'tool returns absolute path' | |

**User's choice:** `/sandbox/input/<filename>`.

---

## FILE-01 — attach sources

| Option | Description | Selected |
|--------|-------------|----------|
| Thread workspace file | Covers agent-created (workspace_write) AND user-handed (Phase-100 TemplateUpload) via one source path | ✓ |
| Sandbox output file | Agent-created file in /sandbox/output/ via execute_code; reuses harvest/copy_from_runtime | ✓ |
| Inline content | Agent passes bytes/text directly; simplest for small text, weak-model risk on large/binary | ✓ |
| KB document id | Attach an owned KB doc's original bytes; couples to FILE-02; data-movement questions | ✓ |

**User's choice:** ALL FOUR sources (comprehensive).
**Notes:** Matches SEED-104's "comprehensive, not a narrow patch." KB-doc-id source flagged for the threat model (attach owned doc → owned skill → later make global = a data-movement path under the existing owner-scope gate).

## FILE-01 — write target

| Option | Description | Selected |
|--------|-------------|----------|
| Any skill the user owns | `.eq('user_id')` owner gate; global + is_system built-ins never writable; agent names target | ✓ |
| Only the actively-loaded skill | Restrict to skill loaded/authored this thread; tighter blast radius but adds thread-state + blocks legit flows | |

**User's choice:** Any skill the user owns.

## FILE-01 — filename collision

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite in place | Upsert on skill_id+filename; predictable authoring loop; no orphan rows; result says 'updated' | ✓ |
| Error on collision | Refuse; agent must rename/delete first; no delete counterpart yet | |
| Auto-rename (file-2.ext) | Keep both with suffix; litters skill with near-duplicates | |

**User's choice:** Overwrite in place.

---

## SC#3 — mid-chat hand-off

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse workspace upload, widen types | Reuse Phase-100 TemplateUpload→/workspace/files; widen the .docx/.pptx/.xlsx-only allowlist for scripts/.md/.json/.csv/images; lowest new surface | ✓ |
| Reuse workspace upload as-is | No type change — only Office docs handable mid-chat; SC#3 covers only Office templates | |
| Dedicated skill-attach upload surface | Distinct 'attach to skill' affordance; clearest intent but net-new frontend + second upload path | |

**User's choice:** Reuse workspace upload, widen types.
**Notes:** Widening the allowlist triggers the T-02 provenance concern (user-uploaded arbitrary file → skill → sandbox-injected/executed) — captured for the FILE-01 threat model.

---

## Claude's Discretion

- SSE/UI feedback event on attach (mirror `workspace_file_written`) — additive + provider-uniform if added.
- Exact env/setting key + default for the size cap.
- Exact tool JSON-schema arg names (cross-provider wording is a planner/researcher concern under SC#10).
- Whether a companion `list_skill_files` agent read is needed.

## Deferred Ideas

- `attach_skill_file` delete/list companion tool — no delete counterpart this phase.
- Sandbox binary parity (SEED-106) + managed packages (SEED-043) — needed for *faithful* conversion, out of scope.
- BUG-260708-02 (execute_code libraries install-timing) — LEFT OPEN, not folded (orthogonal); FILE-02 UAT must not mask it.
- BUG-260708-01 (DeepSeek tool-markup leak) — LEFT OPEN, not folded (tangential cross-provider honesty).
