---
phase: 244-the-chat-shell-and-the-composer
plan: 10
subsystem: agent-tools / sandbox attachment hydration
gap_closure: true
gap_closure_round: 1
tags: [SHELL-04, L-5-defect-6b, WR-02, T-244-10-01, tdd, solo-run]
requires:
  - "244-02 — _hydrate_thread_attachments, _attachment_container_path, the /sandbox/attachments route"
  - "244-07 — WR-02's move of the marker onto the sandbox session (the fix this plan corrects)"
provides:
  - "a per-session record of WHICH workspace paths were copied, not merely THAT hydration ran"
  - "a copy budget that is a SESSION total rather than a per-call count"
  - "244-10-UAT-ROW.md — the three-arm real-run row that scores SHELL-04's remaining clause"
affects:
  - "backend/app/services/tool_dispatcher.py::_handle_execute_code"
  - "backend/app/services/tool_dispatcher.py::_hydrate_thread_attachments"
tech-stack:
  added: []
  patterns:
    - "weakref.WeakKeyDictionary[session, set[str]] — membership/keying, never getattr (the MagicMock truthiness trap)"
    - "the record is written BEFORE the copy is attempted, so a permanently-broken file costs one attempt per SESSION"
key-files:
  created:
    - .planning/phases/244-the-chat-shell-and-the-composer/244-10-UAT-ROW.md
  modified:
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_244_attachment_hydration.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "D-244-10-A: the marker's TYPE changes (set -> dict of copied paths) rather than its LIFETIME — a boolean about a mutable directory is the defect class."
  - "D-244-10-B: `already` is passed as the caller's live set and mutated in place rather than returned and re-unioned — equivalent in effect, and it is what makes the record land BEFORE a copy that raises."
  - "D-244-10-C: ws_list_files now runs once per execute_code call instead of once per session. Accepted deliberately; an invalidation signal from the upload door would be a SECOND mechanism that can go out of sync, which is how this hole was made."
metrics:
  tasks: 3
  commits: 3
  duration: ~55 min
  completed: 2026-09-12
---

# Phase 244 Plan 10: The second attachment reaches the sandbox — Summary

`_hydrated_sessions` (a `WeakSet`, meaning *hydration ran*) becomes `_hydrated_files` (a
`WeakKeyDictionary[session, set[str]]` of copied workspace paths, meaning *these files arrived*),
consulted on every `execute_code` call instead of once — so a file attached after the sandbox
already exists is copied into `/sandbox/attachments`, while an already-copied one still never is.

⚠ **SELF-VERIFIED, NOT REVIEWED (D-244-21 / OV-SOLO-01).** Gemini is unavailable; no independent
second reviewer exists for this work.

⛔ **THIS PLAN DOES NOT CLOSE SHELL-04.** Every case here drives a `MagicMock` session, which
cannot prove a byte lands in a real container. Status is **built, drive owed** —
`244-10-UAT-ROW.md` is scored at `/gsd:verify-work`.

---

## What was built

| Task | What | Commit |
|---|---|---|
| 1 | RED — five cases (A–E) + two shipped cases re-driven | `bde91fbf7` |
| 2 | GREEN — the marker records WHICH files were copied | `33ff520d5` |
| 3 | The ledger row + section (same commit) and the three-arm real-run row | `681a1c138` |

## The defect, and why the previous fix caused it

`244-07` closed WR-02 by moving the hydration marker from the per-iteration `ToolContext` onto the
sandbox session. **That was right for the DoS arm it named and wrong for this one:**
`SandboxSessionManager` caches the session per `thread_id` until idle eviction (30 min default), so
once a session was marked, no later attachment was ever copied into it. The agent's own round-4
output in L-5 is the evidence, not an inference:

```
/sandbox/attachments [] ['c679b991-Meridian-Q4-pricing.xlsx']
```

It recovered the second file at round 10 via the `workspace_read` fallback, ~49 s and ~10 wasted
rounds later. SHELL-04's *"and the agent can use it"* was true for the first attachment and only
**accidentally** true for later ones.

⛔ **"The SECOND attachment did not hydrate", never ".pdf does not hydrate."** The single observed
run attached `.xlsx` first and `.pdf` second, so **ordering is confounded with file type** and the
type-specific claim is NOT established. Arm 3 of the UAT row (a fresh thread whose FIRST attachment
is the `.pdf`) is what resolves it. Nothing in this plan can.

## RED drive — the measured colours, per case

⛔ Driven against **unmoved production code**: `git diff -- backend/app/services/tool_dispatcher.py`
was EMPTY at commit `bde91fbf7`.

Test A's failure, verbatim:

```
E  AssertionError: the SECOND attachment was never copied into /sandbox/attachments — the agent
   can only reach the first file. copy targets seen:
   ['/sandbox/attachments/a1b2c3d4-Meridian-Q4-pricing.xlsx']
```

| Case | Plan predicted | **Measured at RED** | Verbatim |
|---|---|---|---|
| A — a file attached after the session exists is copied | RED | **RED** | above |
| B — the already-copied file is not copied again | green | ⚠ **RED on its fileB arm** | `fileB was copied 0 times across three calls` — its **fileA arm was GREEN** (`count == 1`), so WR-02's DoS fence was intact; the case reds only because the new file never arrives at all |
| C — the budget is a SESSION total | "RED or green, record which" | **RED** | `the session copied 1 files against a cap of 2 — the cap is per CALL, not per session: ['/sandbox/attachments/aaaaaaa1-one.pdf']` |
| D — the zero-attachment path costs nothing | green | **GREEN** | — |
| E — a row that expires between calls | green | ⚠ **RED** | `the live late attachment did not arrive` — its **expired arm was correct**; the live late `.pdf` never arrived, same root cause as A |

⭐ **B and E red for a reason worth recording rather than smoothing over.** The plan predicted them
green because each describes shipped behaviour — and each *also* depends on the late attachment
arriving at all, which is the defect. Their control arms (fileA copied once; the expired row never
copied) were green throughout, so neither red indicates a second defect. Reported as measured, not
as predicted.

Suite at RED: `4 failed, 15 passed`. Suite after the fix: **`19 passed`**, 0 failed.

## Both shipped marker cases were RE-DRIVEN, not deleted

- `test_hydration_runs_once_per_session` asserted `session in tool_dispatcher._hydrated_sessions`
  — **an assertion about the MARKER'S TYPE**, and the type is exactly what changed. It now asserts
  the copied TARGET PATHS (the same file is copied once per session), which is strictly stronger
  than the boolean it replaces and survives the next marker change too. The docstring records what
  the old assertion was and why it moved.
- `test_hydration_runs_once_across_agent_loop_iterations` moved from a bare call **count** to the
  copied target **paths**. Its claim ("eight iterations do not copy the same 10 MB attachment eight
  times") is unchanged; a count became ambiguous the moment "a copy of a DIFFERENT file" became
  possible.

`grep -c` for both names returns `2`. Deleting either would have retired WR-02's DoS fence in the
same commit that re-opened its risk.

## The change, and the three threats it had to hold at once

```python
_hydrated_files: "weakref.WeakKeyDictionary[object, set[str]]" = weakref.WeakKeyDictionary()
```

- **T-244-10-02 (WR-02's original arm, kept at per-FILE granularity):** an already-copied path is
  never copied again. Test B asserts `copies.count(destA) == 1` across three calls.
- **T-244-10-01 (the cap):** `_ATTACHMENT_HYDRATION_MAX_FILES` is compared against
  `len(already) + len(rows)` — the **session total**. ⛔ Making the copy incremental is precisely
  what would have turned a cap into a per-call budget, letting a thread exceed it by attaching
  across calls. Test C patches the cap to 2, makes three calls each adding one file, and asserts
  two copies plus a NAMED truncation note.
- **T-244-10-04 (one expiry gate):** the incremental filter is applied to `ws_list_files`' already
  gated output and adds no second predicate. The shipped source fence
  `test_hydration_adds_no_second_expiry_rule` inspects `_hydrate_thread_attachments`' source, so it
  covers the new filter automatically — and it is still green.

**Three properties are inherited from WR-02 rather than re-argued**, and the code says so: keyed by
the SESSION (lifetime == the directory's), weak (cannot pin a session alive), and
**membership/keying, never `getattr`** — `getattr` on a `MagicMock` returns a truthy child mock, so
an attribute-based guard reads "already hydrated" on the first call and cannot be fenced at all.

### The cost this adds, named rather than discovered later

Hydration ran `ws_list_files` **once per session**; it now runs **once per `execute_code` call** —
one bounded, thread-scoped DB listing on a handler that already awaits container I/O. Accepted
deliberately (D-244-10-C): the alternative is an invalidation signal from the upload door into the
dispatcher, a SECOND mechanism that can go out of sync, and *a marker out of sync with the
container is how this hole was made*. The steady state still costs nothing: when no row is new, the
helper returns before any `mkdir`, copy or note.

### Byte-unchanged, asserted from the diff rather than claimed

`git diff -U0` hunk headers span only: the marker definition (`1788`–`1804`), the helper's
signature + docstring + filter + cap + the `already.add` line (`1849`–`1939`), and the call-site
block (`2074`–`2093`).

```
git diff -U0 | grep '^[-+]' | grep -vE '^[-+]{3}' \
  | grep -E 'basename|_re_attach|_ATTACHMENT_NAME_MAX|NamedTemporaryFile|copy_to_runtime|unlink|def _copy_in|def _attachment_container_path'
  -> (no output)
```

**No changed line mentions any of them.** `_attachment_container_path`'s five traversal reductions
(T-244-02-02), the `_copy_in` shape, `_output_baseline_seeded` and the expiry gate's SQL home are
all untouched. ⚠ The hunk header at `@@ -1834,2 +1849,2 @@ def _attachment_container_path` names
that function only because git labels a hunk with the preceding `def`; the changed lines there are
`_hydrate_thread_attachments`' signature and its docstring's first line.

## Gates

| Gate | Result |
|---|---|
| `pytest tests/unit/test_244_attachment_hydration.py -q` | **19 passed, 0 failed** |
| `pytest tests/unit -q --continue-on-collection-errors` | **71 failed, 4673 passed, 2 xfailed, 2 xpassed** — the ceiling holds with its zero headroom |
| Failing **SET** diff (baseline `a2c8da1af` vs HEAD) | **EMPTY both ways**, 71 ids each |
| `git diff --stat -- frontend/ supabase/ backend/requirements.txt backend/Dockerfile.sandbox` | EMPTY |
| vitest count gate | **NOT RUN — by plan decision.** Wave ownership is `244-09`'s; the frontend diff is empty |
| `node scripts/check-claude-md-size.cjs` | exit **0** — 95,982 chars, 64% of limit |
| `node scripts/check-hot-file-ledger.cjs --files backend/app/services/tool_dispatcher.py` | exit **0**, `subject: 1 files` (non-vacuous) |

### ⚠ The SET diff needed normalising, and the reason is worth keeping

A raw `diff` of the two `FAILED` captures showed two lines differing — because pytest interleaved a
`RuntimeWarning: coroutine '…' was never awaited` from stderr onto the END of a `FAILED` line, and
it attached to a *different* line in each run. **The test IDs were identical.** After stripping the
interleaved suffix, both sets are 71 ids and `diff` exits 0. ⛔ Recorded because a `| tail`-style
count would have shown `71 == 71` and missed nothing here — but a naive SET diff shows a false
delta, and reporting it as "two tests changed" would have been a fabricated regression.

### ⚠ `check-hot-file-ledger.cjs 244` exits 1 — PRE-EXISTING, and already owned

```
[no-row] frontend/src/stores/streamsStore.ts   (named by 244-13-PLAN.md)
```

This fails at the base commit `a2c8da1af`, names a file this plan never touches, and is **already
documented inside `244-13-PLAN.md` itself** (line 214: *"=> [no-row] frontend/src/stores/
streamsStore.ts (19 commits / 12 phases / 484 lines — G-5 FIRES)"*), whose Task 3 adds the row.
`244-13` is **wave 3**. Per CLAUDE.md's scope boundary this is out of scope and was NOT fixed:
adding another plan's ledger row from here would mint a triple that goes stale before its owner
lands, and this ledger's own finding is that *a row present and WRONG answers the auditor with
`satisfied` and stops the audit*. The gate is therefore reported scoped to this plan's subject
file, where it exits 0 non-vacuously.

## The ledger

Re-derived from git at this plan's close, dated quick-task buckets subtracted:

| | was | **now** |
|---|---|---|
| commits | 83 | **84** |
| phases | 35 | **35** (37 buckets − `260529`, `260705`) |
| lines | 4913 | **4966** |

The row was stale **one plan later**, which is this ledger's own recurring finding about itself.
Verdict: **honoured by construction** — the marker changes TYPE, no new call site, no new handler,
traversal fence byte-unchanged. Row (`CLAUDE.md` + the § "Scan list" table) and section updated in
the **same commit**. The section names WR-02's fix as the thing that made this hole and states the
invariant that now holds: *the record says WHICH files, so a claim about hydration can never again
outlive the files it was about.*

⚠ **The disposition cell was 201 chars on first write and the gate caught it** (cap 200,
`[disposition-too-long]`). Trimmed, re-run, exit 0 — the guard fired in the turn the prose was
authored, which is what it exists for.

## Deviations from Plan

**1. [Rule 3 — blocking] `already` is mutated in place instead of returned and re-unioned**
- **Found during:** Task 2
- **Plan said:** *"have the helper return the set of paths it copied and union it back in"*
- **Built:** the helper takes the caller's **live** set and adds each path to it **before**
  attempting that path's copy, keeping its return type as `list[str]` (the notes).
- **Why:** the two are equivalent in effect, and only the in-place form satisfies the plan's own
  harder constraint in the same sentence — *"write the record BEFORE/around the copy … a hard
  failure must not re-attempt container I/O on every subsequent call."* A return-at-end would let
  a permanently-failing file re-attempt a DB read + container write on **every** `execute_code`
  call for 30 minutes. Its failure is already named individually, so nothing is lost.
- **Files:** `backend/app/services/tool_dispatcher.py`
- **Commit:** `33ff520d5`

**2. [scope boundary — NOT fixed] `check-hot-file-ledger.cjs 244` exits 1 on `streamsStore.ts`**
- Pre-existing at base, owned by `244-13` (wave 3), documented above. Logged here rather than in
  `deferred-items.md` because `244-13-PLAN.md` already carries it and a duplicate entry would only
  add merge risk on a file `244-13` also edits.

**3. [recorded, not a deviation] Tests B and E were RED at RED time, against the plan's prediction**
- Both depend on the late attachment arriving; their control arms were green. Reported as measured.

No Rule 4 (architectural) situations arose. No package was installed —
`git diff -- backend/requirements.txt backend/Dockerfile.sandbox` is EMPTY, so no
`## Package Legitimacy Audit` is owed (T-244-10-SC).

## G-7 compliance

This is gap-closure **round 1**. **No task introduced a new user-facing capability** — the product
surface is unchanged: the same attachment, the same `/sandbox/attachments` path, the same tool
result shape. What changed is that a file the user already attached now arrives. The plan's
frontmatter carries `gap_closure: true` (the key the detector keys on) as well as
`gap_closure_round: 1`, so a future round 2 is capped.

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema change at a trust
boundary. The two boundaries this touches (user file → container filesystem; thread scope → sandbox
session) were already in the register, and their fences are byte-unchanged.

## Owed — do not read this plan as closing SHELL-04

| Owed | Where | Who |
|---|---|---|
| The real-container drive, three arms | `244-10-UAT-ROW.md` | `/gsd:verify-work` |
| The `.pdf`-first control that resolves the ordering/type confound | `244-10-UAT-ROW.md` Arm 3 | same |
| An independent review | — | no reviewer exists; this is a self-verification |
| The presentation finding (`uuid8-` prefix + "Template" label leaking into user-facing copy) | `244-UAT.md` § `naming_defects_…` | ⛔ NOT this plan; a presentation fix, never a storage change |

## Registry merge order (for the orchestrator)

⛔ Both wave-1 plans append to `docs/HOT-FILE-LEDGER.md` and `CLAUDE.md`. The plan specifies
**`244-09` merges FIRST, whole**; this plan's ledger row + section are then re-applied by hand, and
`node scripts/check-hot-file-ledger.cjs 244` + `node scripts/check-claude-md-size.cjs` re-run from
the repo root **after the second merge**. Conflicts on the two registry files resolve BOTH-sides.

## Self-Check: PASSED

- `backend/app/services/tool_dispatcher.py` — FOUND (modified)
- `backend/tests/unit/test_244_attachment_hydration.py` — FOUND (modified)
- `.planning/phases/244-the-chat-shell-and-the-composer/244-10-UAT-ROW.md` — FOUND (created)
- `docs/HOT-FILE-LEDGER.md` — FOUND (modified)
- `CLAUDE.md` — FOUND (modified)
- Commits `bde91fbf7`, `33ff520d5`, `681a1c138` — all present in `git log`
- No file deletions: `git diff --diff-filter=D --name-only a2c8da1af HEAD` → empty
- `STATE.md` / `ROADMAP.md` — NOT modified (orchestrator owns those writes)
