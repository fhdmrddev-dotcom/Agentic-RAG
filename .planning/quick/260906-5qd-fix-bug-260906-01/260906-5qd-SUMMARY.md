---
phase: quick-260906-5qd
plan: 01
subsystem: backend/ingestion
tags: [classification, ingest, two-paths-one-outcome, agreement-test, AR-118-02]
requires:
  - "enrich_for_ingest (backend/app/services/ingest_enrich.py) — the shared enrichment home"
  - "classification_matcher.match_metadata / build_suggestion — UNCHANGED by this task"
provides:
  - "metadata._classification on the queue/watch ingest path"
  - "a cross-path agreement fence for classification"
affects:
  - "backend/app/api/documents.py (block removed)"
  - "backend/app/services/ingest_enrich.py (block added)"
  - "every connector-watch and durable-queue ingest"
tech-stack:
  added: []
  patterns:
    - "one home per user-visible outcome; agreement tests, never per-path tests"
key-files:
  created: []
  modified:
    - backend/app/services/ingest_enrich.py
    - backend/app/api/documents.py
    - backend/tests/unit/test_ingest_enrich_shared.py
decisions:
  - "The block MOVED verbatim; its comment was adapted (not rewritten) because the original named a persist UPDATE that does not exist in the new home."
  - "The measured attachments ordering delta was RECORDED, not 'fixed' — the plan's claim that no reachable rule can change verdict was independently confirmed."
  - "Live-DB confirmation is OWED, not claimed. It is written into the bug's re_open_trigger."
metrics:
  duration: ~35 min
  completed: 2026-09-06
requirements: [BUG-260906-01]
---

# Quick 260906-5qd: Classification on the queue ingest path — Summary

Moved the Phase 118 classification rule-eval block out of `ingest_document` (the legacy
synchronous upload path) into `enrich_for_ingest` — the one enrichment home both ingest
paths already call — so a file arriving through a connector watch is classified exactly as
an interactively-uploaded one is. Closes `BUG-260906-01`, the **fifth** defect of the shape
*two code paths serving one user-visible outcome, and only one of them doing the work*.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | *(no commit — measurement only)* | pre-change baseline recorded |
| 2 | `423d12a3e` | `fix(260906-5qd)` — the block moved; `documents.py` −44 L, `ingest_enrich.py` +76 L |
| 3 | `26a93b069` | `test(260906-5qd)` — four agreement/fence tests, +265 L |

Base: `9a30e6230`. Branch: `worktree-agent-a22dc2a2a8abf651f`.

## Measured test figures

⚠ **Compared against what this task measured itself, never against CLAUDE.md's documented
ceiling of 71.** The tree was already at **72** on the merge base — one over the documented
ceiling, pre-existing and not caused by this work.

| | Task 1 (unmodified tree) | after Task 3 |
|---|---|---|
| `pytest tests/unit -q --continue-on-collection-errors` | **72 failed · 3781 passed · 2 xfailed · 2 xpassed · 0 collection errors** | **71 failed · 3786 passed · 2 xfailed · 2 xpassed · 0 collection errors** |
| `tests/unit/test_ingest_enrich_shared.py` | **24 passed** | **28 passed** |

**New failures introduced by this change: ZERO.** Derived by name-set comparison, not by
counting — `comm -13` over both normalised `FAILED` lists is empty.

### ⚠ THE COUNT WENT 72 → 71 AND THIS CHANGE DID NOT EARN THAT

`tests/unit/test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`
is the single test that flipped. **It is not a fix and must not be reported as one.**
Measured rather than assumed:

- On the **reverted (pre-move) tree, in isolation, it PASSES.** So its baseline failure was
  never caused by the shipped code.
- The baseline failure was `AssertionError: assert 'status update / confirmation' == 'email'`,
  and the captured log for it reads
  `INFO httpx: HTTP Request: POST https://api.openai.com/v1/chat/completions "HTTP/1.1 200 OK"`.
  **The test makes a REAL live-model call** and asserts on the model's `document_type`. The
  flip is the model answering differently on two runs — non-determinism, not a repair.

So the honest statement is: **failed count is at or below the Task-1 figure, and the delta
is a live-model coin-flip in an unrelated test.**

### A second thing that baseline log proved, for free

The same captured log carried
`WARNING classification rule-eval failed; skipping suggestion` with
`ValueError: badly formed hexadecimal UUID string` out of `coerce_uid("user-001")`. That is
the soft `except` doing its job on the **pre-change** tree: a non-UUID user id degrades to
"no suggestion" and the document still ingests. After the move the same degradation happens
in `enrich_for_ingest`'s frame instead of `ingest_document`'s — identical behaviour, and it
is now covered by `test_classification_never_blocks_ingestion`.

## RED evidence — every guard was driven against a planted defect

⛔ **A guard nobody has seen fire is not a guard.** The sibling
`test_both_ingest_paths_call_the_shared_enrichment` was once satisfiable by a comment; that
lesson is why all three drives below were run.

### Drive 1 — revert the move (the plan's mandated drive)

`git checkout 9a30e6230 -- backend/app/api/documents.py backend/app/services/ingest_enrich.py`

```
FAILED tests/unit/test_ingest_enrich_shared.py::test_both_paths_derive_the_same_classification
FAILED tests/unit/test_ingest_enrich_shared.py::test_classification_lives_in_one_home_not_two
2 failed, 26 passed, 1 warning in 5.82s
```

Verbatim assertions:

```
>       assert legacy_cls is not None, "the legacy upload path derived no classification"
E       AssertionError: the legacy upload path derived no classification
E       assert None is not None
```

```
E   AssertionError: documents.py evaluates classification rules itself - the step has two homes
    again, which is precisely how BUG-260906-01 happened: ['                from app.services
    import classification_matcher  # noqa: PLC0415', '                    if
    classification_matcher.match_metadata(rule["match_expr"], metadata_dict, whitelist):', '
    metadata_dict["_classification"] = classification_matcher.build_suggestion(']
```

⚠ **HONEST LIMIT OF DRIVE 1, stated rather than glossed.** On the reverted tree the step is
absent from *both* transports, so `legacy_cls == queued_cls` is `None == None` and the
**equality** assertion cannot itself go red — the two **presence** assertions are what fire.
The equality assertion is therefore a *forward* guard (it catches the step being re-split, or
the threadpool transport diverging), not the thing that reproduces this specific bug. Said
plainly because the opposite claim would be the exact overclaim this file exists to avoid.

### Drive 2 — remove the AR-118-02 fail-closed re-filter only

Planted `pass  # PLANTED DEFECT: AR-118-02 re-filter removed` over the re-filter line:

```
>       assert "_classification" not in (out.metadata or {}), (
            "another user's rule was evaluated against this uploader's metadata"
        )
E       AssertionError: another user's rule was evaluated against this uploader's metadata
E       assert '_classification' not in (({'_classification': {'condition_summary':
        'document_type = invoice', 'rule_id': 'rule-stranger-1', ...
FAILED tests/unit/test_ingest_enrich_shared.py::test_a_foreign_users_rule_is_never_evaluated
1 failed, 27 deselected
```

⭐ **`rule_id: 'rule-stranger-1'` in the failure output is the point** — the test proves the
re-filter, not merely that nothing matched. The fake ignores `.or_()` deliberately, so the
over-broad result reaches the Python filter exactly as a malformed server-side filter would.

### Drive 3 — the positive control is built in

`test_both_paths_derive_the_same_classification` uses the *same* fake with an *owned* rule
and DOES produce a suggestion. Without it, drive 2's green could mean "the fake can't serve
any rule". It can.

Both files were restored via `git checkout HEAD -- <specific file>` after each drive
(never `git clean`, never a blanket reset), and the tree was confirmed clean.

## What survived the move, verified individually

| Property | Verified by |
|---|---|
| owner gate `.or_(f"user_id.eq.{coerce_uid(user_id)},is_system_global.eq.true")` | present in `ingest_enrich.py`; the SOLE gate (RLS bypassed) |
| `coerce_uid` on the interpolated id (AR-118-01) | present, carried verbatim |
| fail-closed Python re-filter (AR-118-02) | present + **driven RED** (drive 2) |
| soft `except Exception` → `log.warning` → carry on | present + `test_classification_never_blocks_ingestion` |
| first-match-wins, ONE object then `break` (D-118-3) | unchanged, byte-identical |
| `enrich_for_ingest` stays SYNC and keyword-only | both existing pins green |
| `EnrichedIngest` shape | unchanged (4 fields) |
| neither call site touched | `documents.py:2127` and `ingest_splice.py:618` byte-unchanged |

Code was carried with an **assertion in the migration script** that the moved lines are
byte-identical to the originals modulo a 4-space dedent.

`grep -n "classification_matcher" backend/app/api/documents.py` → **no hits at all** (not
even a comment). `backend/app/services/ingest_splice.py` → no hits. Both are pinned by
`test_classification_lives_in_one_home_not_two`.

## Deviations from plan

### 1. [Rule 2 — comment adapted, not carried verbatim]

The plan said *"Carry its explanatory comment block WITH it."* Carried — but the original
opens *"Runs immediately BEFORE the single persist UPDATE below"*, and in the new home there
is no UPDATE below (the **caller** persists). Carrying that sentence verbatim would have
planted a false statement in the file, which is the failure mode this repo's ledger
repeatedly records. The rationale (D-118-8 owner gate, the anti-feature, first-match-wins,
the BackgroundTask/no-JWT framing) is carried intact; the two sentences that named the
*wrong file's* control flow were rewritten to name both callers' write sites explicitly. A
BUG-260906-01 header and the ordering-delta note were added above and below it.

### 2. [Recorded, not fixed] the attachments ordering delta

The plan predicted it and forbade "fixing" it. **Independently confirmed rather than
inherited:** `attachments` is not in `DocumentMetadata.model_fields`
(`['author','date','document_type','language','summary','title','topics']`) and not a custom
field def, so it is not in the whitelist; `match_metadata` calls
`view_filter_compiler.validate_fields(flt, whitelist)`, which **raises `ValueError`** on an
unknown field — the rule cannot evaluate to True either way. **No reachable rule changes
verdict.** The plan's claim holds; nothing was reordered and the whitelist was not widened.
The delta is documented in a comment beside the moved block.

### 3. [Process] Task 1 produced no commit

Measurement only, no files modified. Recorded here rather than fabricating an empty commit.

## Owed, and deliberately NOT claimed

- ⛔ **Live-database confirmation that a watched file arrives carrying `_classification`.**
  The plan explicitly listed this as owed; it was not performed. The automated bar above is
  what this task proves. It is written into the bug's `re_open_trigger` so it is not lost.
- **`graphify update .`** — CLAUDE.md asks for it after code changes. Not run: the graph
  artifact lives in the operator's main tree, and running it inside a throwaway worktree
  would write a graph nobody keeps. Owed on the main tree after merge.
- No frontend was touched, so the vitest count gate was not run (out of blast radius).

## Threat surface scan

No new network endpoint, auth path, file-access pattern or schema change. The one
security-relevant surface (`classification_rules` service-role read at a trust boundary) is
**pre-existing and relocated**, with every one of its three controls verified present and one
of them driven RED. No `threat_flag` raised.

## Known stubs

None. Nothing was stubbed, mocked into the product path, or left placeholder.

## Self-Check: PASSED

- `backend/app/services/ingest_enrich.py` — FOUND, contains the moved block
- `backend/app/api/documents.py` — FOUND, contains no `classification_matcher`
- `backend/tests/unit/test_ingest_enrich_shared.py` — FOUND, 28 tests pass
- commit `423d12a3e` — FOUND in `git log`
- commit `26a93b069` — FOUND in `git log`
- working tree clean apart from the docs artifacts the orchestrator commits
