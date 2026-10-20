# Phase 280: In Once, Out Clean - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 280-in-once-out-clean
**Areas discussed:** Second upload of same file, Charts after retention delete, How wide the 404 fix goes, OneDrive live re-drive setup

Before the questions, a read-only measurement subagent measured the tree. Findings M-1..M-7 are in CONTEXT.md.

---

## Second upload of same file

| Question | Options | Selected |
|---|---|---|
| 2nd upload response | Existing copy + `already_in_library` flag / Existing copy, no flag | Existing copy + flag ✓ |
| Atomicity for real new versions | Insert first, then retire (no migration) / One DB function (migration 207) | Insert first, then retire ✓ |
| CR-01 cross-org folder | File bug + fix here / File bug, defer the fix | File bug + fix here ✓ |
| Other minter callers | All through the one fixed minter / Upload door only | All through the one fixed minter ✓ |

**User's choice:** all recommended options.

---

## Charts after retention delete (DEBT-08)

| Question | Options | Selected |
|---|---|---|
| Fate of `message_artifacts` on disposal | Keep, record why / Strip the data rows / Delete the chart | Keep, record why ✓ |
| Where it is written | Public retention page + internal doc / Internal doc only | Public + internal ✓ |

**User's choice:** all recommended options.

---

## How wide the 404 fix goes (DEBT-11)

| Question | Options | Selected |
|---|---|---|
| Sweep width | All 21, one tiny helper / Document domain only / One central patch in `main.py` | All 21, one tiny helper ✓ |
| Dead `main.py:66-88` patch | Remove if proven dead / Leave it alone | Remove if proven dead ✓ |

**User's choice:** all recommended options.

---

## OneDrive live re-drive setup

| Question | Options | Selected |
|---|---|---|
| Test folder | I generate files, you upload / Force a small page size / Use an existing big folder | Claude generates, operator uploads ✓ |
| Driver | Claude drives, operator approves / Operator clicks, Claude verifies | Claude drives, operator approves ✓ |

**User's choice:** all recommended options.

---

## Not selected for discussion: settled by recommendation

- **Purge + the `sources.py` G-5 extraction:** a shared delete helper (guard → rows → bytes). Both purge doors move into it. The Library delete stays inline (275 D-32 fence). The operator was shown this and chose "I'm ready for context".

## Claude's Discretion

- Helper names and module paths, the internal docs file for D-07, the optional frontend note for `already_in_library`, and the concurrency test mechanism.

## Deferred Ideas

- Library delete onto the shared helper (blocked by D-32).
- A `document_id` on `message_artifacts`.
- Re-run the seeds sweep after planning.
- Todo `spike-nl-workflow-authoring.md`: not folded (unrelated, and a new capability).
