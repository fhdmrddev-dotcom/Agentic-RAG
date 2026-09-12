---
phase: 244-the-chat-shell-and-the-composer
plan: "08"
kind: security-defect-round
subsystem: chat-composer / workspace-attachments / source-adapters
tags: [security, tdd, T-244-06-07, T-244-03-01, T-244-05-05, UF-1]
base_commit: 5edb08292
requires:
  - 244-SECURITY.md (the three open threats)
  - 244-REVIEW.md WR-04, WR-07
provides:
  - a per-read byte cap threaded through the SourceAdapter contract (clamp_read_cap)
  - the composer lock discriminator set on exactly one branch
  - an opt-in include_expired listing so an expired attachment leaves a tombstone
affects:
  - backend/app/api/workspace.py
  - backend/app/services/sources/base.py
  - backend/app/services/sources/adapters/{google_drive,microsoft_graph,mcp_source,mock_source}.py
  - backend/app/services/sources/mail/gmail.py
  - backend/app/services/sources/import_service.py
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/lib/api/threads.ts
  - frontend/src/providers/StreamsProvider.tsx
threats_closed: [T-244-06-07, T-244-03-01, T-244-05-05]
threats_open: []
migrations: none
duration: ~3h
completed: 2026-09-12
---

# Phase 244 Plan 08: Three Open Threats — Summary

**All three of `244-SECURITY.md`'s open threats are mitigated in code, each driven RED first;
two audit claims were measured WRONG in the process and are corrected beside their originals
rather than over them.**

⚠ **This is a self-verification.** No independent reviewer exists (`D-244-21` / `OV-SOLO-01`),
so every verdict below is the same agent that wrote the code. Nothing here was driven in a
browser; `244-VALIDATION.md`'s rows stay `⬜ owed`.

---

## 1 · `T-244-06-07` (DoS) — the chat's cloud door reads under its own 10 MB cap

**Status: CLOSED.** `workspace.py:412` — `fetch_cloud_file(conn, body.file_id,
max_bytes=MAX_FILE_SIZE)`.

### ⚠ The audit's framing was OVERSTATED, and that changed the fix

`244-SECURITY.md` OPEN-3 says *"A multi-GB pick from the person's own Drive is resident in a
worker before the 422"*. **Measured false.** `send_pinned_http` (`egress.py:830-852`) already
refuses a declared over-cap `content-length` **before a single body byte is read**, then
streams with a running counter and abandons the read past `max_bytes` — and both first-party
adapters already passed `max_bytes=source_max_file_bytes()`.

So the real residency bound was the **operator's source ceiling**: `1–50 MB, default 25`
(`user_settings.py:1227-1242`). The gap is **2.5–5× the declared 10 MB cap**, not unbounded.
Real, and smaller than recorded. A threat written larger than it is gets fixed for the wrong
reason — a streaming rewrite was not needed, a cap parameter was.

### What changed

| | |
|---|---|
| `sources/base.py` | `read_file` gains `max_bytes: int \| None = None`; new `clamp_read_cap()` — **ONE home** for `min(request, operator ceiling)`. A caller can only TIGHTEN. |
| Drive / Graph | hand the clamped cap to `send_pinned_http` — enforced **before materialisation**, which is the declared mitigation verbatim |
| `mail/gmail.py` | `read_message` takes the cap too (a mail id reaches the same picker a Drive file does) |
| `mcp_source.py` | ⚠ enforces **after decode** — a file arrives base64 inside a JSON-RPC envelope, so no prefix of the response means *"the file is this big"*. Residency stays bounded by `mcp_max_body_bytes()`, derived one-way from the same ceiling (SEED-258). **No envelope knob was added.** |
| `mock_source.py` | accepts and does **not** enforce, and says so — it has no transport to bound |
| `workspace.py` | `EgressResponseTooLarge` → **422 "File too large"**, not `502 Failed to download cloud file`. Same rule `T-244-06-04` closed on: our own refusal must not read as the provider's fault. |

⛔ **The clamp is deliberately not per-adapter.** `SEED-258` removed three private ceilings that
agreed only by luck; re-deriving `min(request, ceiling)` in each adapter reinstates exactly that
one level down.

### RED evidence (`eb8848774`, five cases, each naming its own thing)

```
assert 'max_bytes' in {}                                          (the route passed none)
TypeError: GoogleDriveSourceAdapter.read_file() got an unexpected
           keyword argument 'max_bytes'                           (x2 — cap + clamp)
TypeError: MicrosoftGraphSourceAdapter.read_file() got an unexpected
           keyword argument 'max_bytes'
an over-cap file answered HTTP 502. Our own size refusal must not
           be dressed as a provider failure.
```

### Two existing fences re-aimed, each proven still live

- `test_239_body_cap_admits_the_file_ceiling.py` demanded each adapter **call**
  `source_max_file_bytes` by bare name. Widened to accept reaching it *through* `clamp_read_cap`
  — **and strengthened**: the clamp is now itself asserted to call the accessor and to refuse a
  raise. Planted `return int(max_bytes)` → `clamp_read_cap let a caller RAISE the operator
  ceiling`. Restored **md5-identical**.
- ⚠ `test_240_mail_shape.py` patched `gmail.source_max_file_bytes` with **`raising=False`**. When
  that name left the namespace the patch **landed on nothing** and the case failed `DID NOT
  RAISE` instead of naming the moved target. Re-targeted at the setting; **`raising=False`
  deleted**. Planted `if False:` over the ceiling check → the case fires by name. Restored
  **md5-identical**.

### Does it strengthen the cloud half of `T-244-05-04`?

**Yes, and by exactly the measured amount.** That row is closed on the LOCAL door's
pre-materialisation `file.size` reject. The cloud door now has its own equivalent: the 10 MB cap
is stated to the transport, which refuses the declared length before reading. The cloud half's
residual drops from *"up to the operator ceiling, 25 MB default"* to *"10 MB"* — for Drive,
Graph and Gmail. ⚠ **It does not become identical to the local door for MCP**, whose bound stays
the envelope cap.

---

## 2 · `T-244-03-01` (EoP) — the discriminator lives on one branch

**Status: CLOSED.** `ChatArea.tsx:205-224` — the genuine-lock branch sets `capPaused: false`.

The declared mitigation was already written: *"the discriminator is `capPaused`, which is set
only on the `state.cap_paused` reconcile branch."* It was set on both, and
`workflowLocked = workflowLock !== null && !workflowLock.capPaused` therefore evaluated **false**
for a run that is locked AND paused — the composer unlocking mid-run. Three lines of code; the
rest of the diff is the reason, recorded at the line.

⛔ **Fail-closed by choice, not deleted as unreachable.** No writer of `'cap_paused'` onto
`workflow_runs.status` has been found, but the value is schema-valid
(`063_dual_mode_continue.sql:57`, on BOTH status columns), `threads.py:1238` reads `cap_paused`
straight off it, and `_TERMINAL_WORKFLOW_STATUSES` (`threads.py:1095`) does not contain it. **The
server can answer that state today.** Cost if the arm goes live: one Cancel click. Cost of the
other direction: the elevation the threat names.

`BUG-260904-05` is untouched — an ordinary Deep cap-pause carries no `active_workflow_run_id` and
still takes the reconcile branch.

### ⭐ Why the shipped fence was green over the defect

`HARNESS_LOCKED_STATE` sets `cap_paused: false`. Every one of the five existing cases read the
discriminator on a run that is locked **OR** paused — **never one that is BOTH.** Case 5
constructs that state directly. RED at `79cd5ba44`: `AssertionError: expected true to be false`,
asserted on both the flag (cause) and the disabled harness composer (consequence).

---

## 3 · `T-244-05-05` (Repudiation) — an expired attachment leaves a tombstone

**Status: CLOSED for the listing; three named limits deferred (item 14).**

### ⭐ The finding that shaped the fix: there are TWO expiry gates, not one

The brief warned `db/workspace.py:207,219` might be the gate the renderer reads through. **It is
not.**

| gate | readers | this round |
|---|---|---|
| `db/workspace.py:207,219` — asyncpg `list_files_in_thread` | sandbox hydrator (`tool_dispatcher.py:1862`) **and** prompt announcement (`agent_loop.py:1694`) | ⛔ **UNTOUCHED** |
| `workspace.py:465` — supabase REST listing | panel **and** transcript, via ONE store slice | ⭐ opt-in widening |

Checking rather than assuming is what kept the hydrator's door shut while the renderer's opened.

### Constraint (a) — a tombstone, not a resurrection — held in three places

1. the per-file **content** route keeps its expiry gate → an expired chip 404s if anything opens it;
2. the hydrator and the system-prompt announcement read the **other** listing, which cannot see
   `include_expired` and is fenced against ever growing one;
3. the **panel** filters expired rows back out, so no preview is ever offered for one.

The chip's expired arm is a non-interactive `<span>` — no remove button, no download.

### What changed

- `workspace.py` — `include_expired: bool = Query(False)`. ⚠ **Opt-in, never a removed gate**: the
  default answer is byte-identical, so `useResolvedFileId` and every other caller are untouched.
- `lib/api/threads.ts` — `getThreadWorkspaceFiles(threadId, signal, { includeExpired })`. Third
  parameter on purpose: anything ahead of `signal` would silently become the abort argument.
- `StreamsProvider.tsx` — **both** slice-fillers ask for expired rows (the panel reconcile *and*
  the `run_completed` self-heal, which would otherwise drop every tombstone on the next harness
  completion); `useWorkspaceFiles` (panel) filters, `useWorkspaceFilesSnapshot` (transcript) does
  not. Filtering is **memoised on the slice, not done inside the selector** — a `.filter()` in a
  `useStreamsStore` selector mints a new array per render and `useSyncExternalStore` compares by
  identity, re-rendering `FilesSection` and `WorkspacePanel` on every stream delta (PANEL-06).

### ⚠ A FastAPI trap, measured not reasoned

`if not include_expired` **skipped the gate on every direct call**, because an unsupplied
`Query(False)` default is the `Query` **object** and an object is truthy. Production was correct
(FastAPI resolves the real bool); the hand-callable path was not. Now `is not True` — only the
literal `True` widens; everything else fails closed.

### RED evidence

**Backend** (`52e14ba56`): `TypeError: list_workspace_files() got an unexpected keyword argument
'include_expired'`. The three invariant cases were each **driven against a planted defect**:
removing one of the hydrator's two SQL arms → `assert 1 == 2`; deleting the content route's gate
→ `the per-file content route lost its expiry gate`. Both sources restored **md5-identical**.

**Frontend** (`fb64568e5`): `expected undefined to be true` · `expected ['wf-agent','wf-expired']
to deeply equal ['wf-agent']` · `expected 2 to be 1`.

⛔ **The trap this suite walked into and out of.** Its first draft used a bare `renderHook`, and
**all five cases went red — including case 4, the positive control**, which asserts a NULL-expiry
agent file survives and must be true before *and* after the fix. `usePanelReconcile` writes
through `actions.replaceWorkspaceFilesForThread`, a **synchronous no-op stub** at
`streamsStore.ts:463` until `StreamsProvider` mounts. The fetch resolved, the write did nothing,
the slice stayed empty — **a textbook-looking RED that would have failed over a correct
implementation too, which is exactly what `244-05` shipped.** The positive control is what told
the difference.

⚠ **Case 2 is a characterization, not RED evidence**, and is labelled so in the file: the client
already passed every row through, so it was green beforehand.

### What was implemented vs deferred

| | |
|---|---|
| ⭐ **implemented** | an expired row reaches the transcript flagged as expired, survives a reload, renders `No longer available`, and stays unreadable |
| ⛔ **deferred (item 14)** | the DETACH registry is still session-scoped and still has no DELETE route; nothing re-fetches when a file expires *while the tab is open* (a day-old open tab can show a live label for a just-expired file — the content route still 404s, so the worst case is an optimistic label, not a false download); `useResolvedFileId` deliberately stays on the gated default |

---

## Unregistered flag UF-1

`POST /threads/{id}/workspace/files/from-connection` is added to `244-SECURITY.md`'s register as
a **retroactively-registered** entry, not folded into an existing row. It is the route that
carried `T-244-06-07`.

⚠ **`244-05-SUMMARY.md`'s missing `## Threat Flags` section is left recorded as an omission.** No
section was back-filled — a section claiming threats were flagged when they were not is worse
than the gap.

---

## Gates

| gate | reading |
|---|---|
| backend `pytest tests/unit -q` | **71 failed / 4645 passed / 2 xfailed / 2 xpassed** — ceiling held at 71 with zero headroom. Failing **test-id SET byte-identical** to the pre-work baseline (71 ids both sides, `diff` empty). `+9` passed = my 9 new backend cases. |
| `tsc -p tsconfig.app.json --noEmit` | **67**, and the **SET DIFF is IDENTICAL** to the pre-work baseline |
| `vitest-count-gate.cjs` (cap 2) | `total 8200 · failed 1 · pinned total 7425` — **exactly +6** on both totals vs `8194 / 7419`, my six new cases and nothing else. No per-file decrease. |
| `check-hot-file-ledger.cjs 244` | **exit 0** — 265 rows, 46 subject files, 26 watched, every watched file has a row |
| `check-claude-md-size.cjs` | **exit 0** — 95,656 chars, 63.8% of limit |

**Count-gate knobs:** the new suite is pinned in **BOTH** (`src/providers` is in neither, so a
TARGETS line was required or the gate would never have run it); `ChatArea.capPausedComposer` was
re-baselined `5 → 6`. Append-only apart from that one re-baseline: `32 insertions, 1 deletion`.

### The one count-gate failure, triaged before any re-run

`src/pages/WorkflowsPage.test.tsx` — `STACK_TRACE_ERROR`. Filename taken from the gate's **own
persisted JSON** before re-running anything. It is one of **SEED-171's five named
cap-independent flakes** and is **provably unmodified** by this work (0 hits in
`git diff --name-only 5edb08292 HEAD`, 0 in `git status`). **The cap stayed at 2 and was not
touched.** Not re-rolled — one green sample would not have proven it innocent.

### Three inherited reds outside the gate (deferred item 15)

`model-info.test.ts` · `termMap.test.tsx` · `PendingAskCard.retired.baseline.test.tsx`. All red
at `5edb08292`, none in this diff, and `PendingAskCard.tsx` is byte-identical at the base (765
lines both sides) — so its source was already 29 lines past its pin before this work began. ⚠
**All three are invisible to the count gate**, which read `failed 4` on the same tree and named
none of them: they sit in NEITHER knob.

### ⚠ The tree was not quiet (deferred item 16)

Five frontend admin/api files were modified in this worktree **during this session** by another
writer (+438/−17, mtimes 08:42–08:47, absent from `git status` at session start). They were left
strictly alone, but were on disk for every whole-tree gate reading above. **The per-file
readings are attributable; the whole-tree verdicts are not solely mine.**

---

## Commits

| commit | what |
|---|---|
| `eb8848774` | `test(244-08)` RED — the cloud door reads under no cap of its own |
| `085a57fe9` | `fix(244-08)` GREEN — the 10 MB cap, `clamp_read_cap`, the 422, two fences re-aimed |
| `79cd5ba44` | `test(244-08)` RED — a `cap_paused` harness run unlocks the composer |
| `d76b252a8` | `fix(244-08)` GREEN — the discriminator lives on ONE branch |
| `52e14ba56` | `test(244-08)` RED — an expired attachment vanishes (backend half) |
| `fb64568e5` | `test(244-08)` RED — the expired chip's supply line (frontend half) |
| `8b6887a2a` | `fix(244-08)` GREEN — an expired attachment leaves a tombstone |
| `e79fbabd0` | `chore(244-08)` both count-gate knobs |

---

## What this round did NOT do

- **No browser row was driven.** Every `244-VALIDATION.md` row stays `⬜ owed`, including
  `T-244-05-05`'s natural UAT (attach → wait out the TTL → reload → read the chip).
- **`STATE.md` and `ROADMAP.md` are untouched**, as instructed.
- **No independent review.** `N-1` still stands: this is a self-verification.
- **`244-05-SUMMARY.md`'s `## Threat Flags` omission was not back-filled.**
