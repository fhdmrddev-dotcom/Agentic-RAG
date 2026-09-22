# Phase 263 — deferred items (out of scope, found during execution)

Discoveries that are real, reproducible, and **not** caused by this phase's changes. Logged rather
than fixed, per the executor scope boundary.

---

## D-1 — `logging_sink.py`'s OpenAI-key redactor mangles any word containing `sk-` + 6 chars

- **Found during:** `263-02` Task 2, in the captured log of the Fence-1 RED drive. The line read
  `skill=contract-risk-***REDACTED***`, and the skill name in that test is
  `contract-risk-register` — nothing secret anywhere near it.
- **File:** `backend/app/services/logging_sink.py:84`
- **Pattern:** `re.compile(r"sk-[A-Za-z0-9_\-]{6,}")` → `"sk-***REDACTED***"`. It is unanchored, so
  it fires on the `sk-` INSIDE an ordinary word.
- **Reproduced directly** (not inferred from the one log line):

  | input | output |
  |---|---|
  | `contract-risk-register` | `contract-risk-***REDACTED***` |
  | `risk-assessment` | `risk-***REDACTED***` |
  | `task-runner` | `task-***REDACTED***` |
  | `disk-usage` | `disk-usage` (only 5 chars follow — under the `{6,}` floor) |
  | `sk-proj-ABCDEF` | `sk-***REDACTED***` (the true positive still works) |

- **Severity:** not a security defect — it errs toward over-redaction, which is the safe direction.
  It is a **diagnostics** defect: any log line naming a `risk-*`, `task-*` or similar kebab-case
  identifier is unreadable, and the operator cannot tell an over-redaction from a real key.
- **Why it matters to THIS phase specifically:** PACK-14 makes the drafter emit **kebab-case skill
  names**, and `risk-register` / `task-…` are exactly the shapes a domain Expert proposes. So the
  proposal-authoring logs 263-03 and 263-04 will rely on are disproportionately likely to be hit.
- **Suggested fix (not applied):** require a word boundary before the token, e.g.
  `(?<![A-Za-z0-9])sk-[A-Za-z0-9_\-]{6,}`, and drive it RED against `risk-register` first — the
  current pattern has no test that would notice either the false positive or its removal.
- **Scope:** `logging_sink.py` is untouched by any 263 plan and has no ledger row in this phase's
  `files_modified`. Fixing it here would be unreviewed surface inside a plan that has nothing to do
  with logging. Candidate for `/gsd:fast` (one file, one line) or a seed.
