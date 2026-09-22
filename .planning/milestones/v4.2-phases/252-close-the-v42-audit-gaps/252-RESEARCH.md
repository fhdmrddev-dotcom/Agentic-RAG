# Phase 252 — Research

**Method:** every claim below was re-derived against the tree at `697f71063` **before** any plan was
written. ⛔ Nothing here is inherited from `.planning/v4.2-MILESTONE-AUDIT.md` without being measured
again — the audit is a claim about code, and *a review is a claim about code, not the code*.

---

## 1 · B-1 — the greenfield ACL gap

### 1.1 Measured

| Claim | Command | Result |
|---|---|---|
| the regenerate script can never carry a grant | `sed -n '101,107p' scripts/regenerate-full-schema.sh` | `pg_dump --schema-only --no-owner **--no-privileges** --schema=public` |
| neither bootstrap artifact carries a function ACL | `grep -c "REVOKE.*EXECUTE ON FUNCTION" supabase/full-schema.sql scripts/full-schema-supplement.sql` | `0` and `0` |
| 181 itself is correct | `grep -c REVOKE supabase/migrations/181_*.sql` | `31` |
| the supplement is `full-schema.sql`'s verbatim tail | `diff <(tail -n 259 supabase/full-schema.sql) scripts/full-schema-supplement.sql` | **empty** |

`supabase/full-schema.sql` is **7513** lines; `scripts/full-schema-supplement.sql` is **259**.

### 1.2 The 13 functions of migration 181, exactly as the migration names them

⛔ **Argument lists are part of the identity.** A `REVOKE … ON FUNCTION f(uuid, text)` does not
affect `f(uuid)`. Copy these signatures **verbatim** — do not retype, do not normalise whitespace
inside the parens.

**Group A — trigger functions** (revoke `PUBLIC`, `anon`, `authenticated`; grant `service_role`):
`public.capture_skill_version()` · `public.handle_new_user()` · `public.stale_skill_embedding()` ·
`public.stale_skill_embedding_from_case()`

**Group B — trigger functions with no `PUBLIC` grant** (revoke `anon`, `authenticated`; grant
`service_role`): `public.autofill_org_id_by_owner()` · `public.autofill_org_id_from_parent()`

**Group C — RLS helpers and app RPCs** (revoke `PUBLIC`, `anon`; grant `authenticated`,
`service_role`):
`public.current_user_org_ids()` ·
`public.connection_doc_is_visible(uuid, text)` ·
`public.current_user_has_permission(uuid, text)` ·
`public.folder_is_org_shared(uuid)` ·
`public.keyword_search_chunks(text, uuid, integer, jsonb, uuid[])` ·
`public.match_document_chunks(vector, uuid, integer, double precision, jsonb, uuid[], text)` ·
`public.match_skills(vector, uuid, text)`

**13 functions · 31 REVOKEs · 17 GRANTs.**

### 1.3 The ordering fact that makes this safe

`REVOKE … FROM PUBLIC` **must precede** `REVOKE … FROM anon`: `anon` inherits from `PUBLIC`, so
revoking from `anon` alone changes nothing while the `PUBLIC` grant stands. This was measured in
migration 177 and is stated in 181's own header. The supplement mirror must preserve that order.

The supplement is **appended at the END** of `full-schema.sql`, so every function already exists and
Supabase's stock `GRANT ALL … TO anon, authenticated, service_role` default privileges have already
run. §5's own header states this ordering dependency for the mig-118 block; §6 inherits it.

### 1.4 The precedent to copy — §5 of the supplement

`scripts/full-schema-supplement.sql:190-259` is the **mig-118 column-grant mirror**, and its header
already contains the argument §6 needs, written for a different migration. ⭐ Two things to carry
across, and one to *not*:

- **Carry:** the `⚠ WHY THIS LIVES HERE RATHER THAN IN THE DUMP` framing, the idempotency
  statement, and the explicit ordering note.
- **Carry:** §5's measured-drift warning — that block *"had fallen FOUR COLUMNS behind the live
  table"*, and the failure it shipped was **total, not partial**.
- ⛔ **Do not carry** its "compare this list by hand whenever a migration adds a column" instruction
  **as the only mechanism**. That is precisely the instruction that existed and did not prevent 181.
  §6 gets a **gate** (Plan 01 Task 3).

### 1.5 Why this is the third recurrence

`supabase/full-schema.sql:7449-7456` documents this exact failure class **verbatim for migration
118**. 181 reproduced it. Prose in a file nobody re-reads is this project's own recorded failure
mode, stated in `CLAUDE.md` three separate times.

---

## 2 · B-2 — the credential in the log

### 2.1 The site, verbatim (`backend/app/services/connector_service.py:571-588`)

```python
try:
    return ConnectorConnectionResponse.model_validate(d)
except ValidationError as e:
    # ⚠ SEED-239 & TM-248-05: If a stored connection row contains an invalid config
    # (e.g. legacy row violating a newly tightened model rule like custom_client_id smell),
    # do NOT allow a single bad row to fail list_connections with a 503 for the whole org.
    logger.warning(
        "connector_service._to_response: validation failed for connection %s: %s",
        d.get("id"),
        e,                      # ← the raw pydantic ValidationError
    )
```

### 2.2 Why `%s` on a `ValidationError` is the leak

Pydantic v2's `ValidationError.__str__` renders `Input should be …, input_value='<the value>'` for
**every union arm it tried**. `ConnectorConnectionResponse.config` is a union, so one bad
`custom_client_id` is echoed once per arm. The integration checker measured **six occurrences of
the secret in one message**.

⛔ **The population this handler exists for is precisely the legacy rows that already hold a secret
in `custom_client_id`** — the code comment says so. Phase 248 moved the secret out of an
org-readable column and into the application log.

### 2.3 The fix, and how to prove it

`e.errors(include_input=False)` — pydantic v2's documented switch. It returns a list of dicts with
`type`/`loc`/`msg`/`url` and **no `input`** key.

⛔ **The assertion must be over the FORMATTED message**, i.e. `record.getMessage()` /
`caplog.text` — not over `record.args`. A structured-args assertion would not have seen the six
occurrences, because they live inside the rendered `%s`.

### 2.4 The validator that produces the refusal (`backend/app/models/connector.py:160-197`)

Rejects: blank, `len > 128`, any `~` (Entra client-secret shape), and a prefix in
`("sk-", "ghp_", "gho_", "ghu_", "ghs_", "ghr_", "xoxb-", "xoxp-", "xapp-", "secret_", "whsec_",
"client_secret", "bearer ")` (case-insensitive). ⭐ Its own docstring already promises *"Does NOT
echo the rejected value in error messages to prevent credential leakage (TM-248-06)"* — **the
validator keeps that promise and a handler three files away breaks it.**

`CustomClientId = Annotated[str, Field(min_length=1), AfterValidator(_validate_custom_client_id)]`
guards three **request** models, at `:286`, `:393` and `:600`.

---

## 3 · B-3 — the DCR writer that bypasses the boundary

### 3.1 The path

`backend/app/api/connectors.py:1323-1352` — when a probe advertises `registration_endpoint` and no
`client_id` is stored, the route calls `register_client(...)` and takes
**`registered.client_id` from a remote server's response**, then persists it via
`connector_service.store_oauth_client_credentials(...)`.

`backend/app/services/connector_service.py:~646-660` writes it with **no validation**:

```python
if client_id and client_id.strip():
    row = await _fetch_connection_row(connection_id, org_id)
    ...
    config["custom_client_id"] = client_id.strip()
    config.pop("custom_client_secret", None)
    updates["config"] = config
```

### 3.2 Why refusing at the DISCOVERY step was right and refusing at the WRITER is also right

The `if not client_id and probe.registration_endpoint:` block carries a long comment explaining that
**refusing there** would demand a developer-console credential from the one class of server whose
whole appeal is that it needs none — driven live against `mcp.notion.com` on 2026-09-01. That
reasoning stands and is **not** what this phase changes.

What changes is the **writer**: a value that the inbound boundary would refuse must not be stored
silently. The distinction is *refuse to register at all* (rejected, rightly) versus *refuse to
persist a value that will brick every future read* (this phase).

### 3.3 The consequence that is worse than the bypass

Once a non-compliant server-issued id is stored, every read of that connection fails
`model_validate` → falls into §2's degraded fallback → `status="error"` **forever**.

### 3.4 ⭐ The repair path EXISTS but is UNNAMED — corrected from the audit

The audit says there is *"no repair path, because the operator never typed the value and cannot type
a compliant one."* **Measured: the structural path exists.**
`store_oauth_client_credentials` is an `UPDATE`, and the BYO form submits a `custom_client_id`
through `OAuthAuthorizeRequest`/the connection-update model, which **is** `CustomClientId`-validated.
An operator who pastes their own compliant client id from a developer console replaces the bad one.

⛔ What does not exist is any **statement** of that. The degraded row renders
`"Connection configuration requires update (validation failed)"`, which names nothing actionable.
**So the owed work is to name it, not to build it** — and the corrected reading of the audit's claim
is *"an unnamed repair path, which is the same thing to the person looking at it."*

### 3.5 The single writer, and why validation goes there

`store_oauth_client_credentials` already earns four properties every writer needs: id→`config`,
secret→its own ungranted column, legacy plaintext `custom_client_secret` swept on every write, and
`org_id`-scoped update. Its own docstring records that an earlier draft called two helpers **that
do not exist** (the Phase 212 D-2 defect). ⛔ Adding a **fourth request model** would guard a door
this value does not arrive through.

---

## 4 · B-4 — "Sync now"

### 4.1 The card (`frontend/src/components/sources/WatchRowCard.tsx`)

```js
// :234-243
async function handleRowSync() {
  setIsSyncing(true); setSyncOutcome(null)
  try { await onSyncNow(watch); setSyncOutcome("✓ Synced just now (0 changes)") }
  finally { setIsSyncing(false) }
}
```
`onSyncNow` is typed `(watch: ConnectorWatch) => Promise<void> | void` at `:139` — **it carries no
result.** `syncOutcome` renders at `:380-385`; the refusal notice renders at `:611-613`. **Two
independent slots.**

### 4.2 ⭐ The parent is already correct, and that is why A-alone is a no-op

`WatchedFoldersSection.tsx:262-293` — `handleSyncNow` awaits `triggerWatchSync(watch.id)`, branches
on `res.status === "refused"` into `setRefusals`, else into `setPendingAsks` with
`COPY.asked(withinPhrase(res.next_check_within_seconds))`, and **wraps the whole thing in
`try/catch` that calls `setError`**. So it **never rejects**, and the card's missing `catch` can
never fire. ⛔ **Adding only the `catch` ships a no-op** — the same class of error the ROADMAP flags
for `BUG-260915-01` candidate #1.

**The real defect is that the parent's correct verdict never reaches the card**, which then invents
one.

### 4.3 `WatchSyncResponse` carries no change count

`frontend/src/lib/api/sources.ts:117-126`: `status`, `message`, `next_run_at?`,
`next_check_within_seconds?`, `reader_running?`. ⛔ **There is no field from which `(0 changes)`
could ever be true.** Nothing replaces it.

### 4.4 W-2's tautology, in full

```js
// :184  — the default
const cause: SourceFailureCause = stopped?.cause ?? classifySourceFailure(watch.last_error)
// :247-248
const isRateLimited =
  cause === "unreachable" && Boolean(classifySourceFailure(watch.last_error) === "unreachable")
```
When `stopped` is absent the two conjuncts are the **same expression**. And `unreachable` is the
catch-all cause, so a Drive **503**, a DNS failure and a socket timeout all render
**`Run failed (429)`** at `:276`.

### 4.5 W-1's binary

`:246` `const isConnectionDisabled = stopped?.cause === "connection_disabled"`, and `:251-265`
renders `⊙ Connection Off` on that one cause and **`● Connected` on every other** — including
`token_revoked` and `app_credentials_invalid`, which are connection-level failures.

### 4.6 W-3, and why `token_revoked` alone is wrong

`sourceHealthVocabulary.ts:165-205`: three causes carry `action: "reconnect"`, and
`WatchedFoldersSection.tsx:357-367`'s `runFix` **only navigates** for that action.
`connection_disabled` → `"Open {n} in Settings ↗"` and `app_credentials_invalid` →
`"Check {n} in Settings"` were both reworded to name the door. **`token_revoked` still reads
`Reconnect {n}`** — a verb the control does not perform.

⭐ Unlike the other two, **reconnecting genuinely IS the fix** for a revoked token, so the verb
stays and only the location is added. The file's own rule at `:49` — *a new cause adds a ROW, never
an `if`* — and the two prior rows' comments both record that the three-named-actions pin must stay
green **by construction**, never by loosening.

### 4.7 ⛔ `WatchRowCard.tsx` HAS NO TEST FILE — a finding the audit did not make

`find frontend/src -name "*WatchRowCard*"` returns the **source and nothing else**.
`frontend/src/components/sources/__tests__/` contains only `ConnectedSourceSection.test.tsx`,
`CreateWatchModal.test.tsx`, `sourceCapability.test.ts`.
And `src/components/sources` is **not a TARGETS directory entry** — TARGETS names ten individual
files under it.

⭐ **TARGETS decides what RUNS; BASELINE decides what is GUARDED, and this file is on the wrong side
of both.** The audit's note that SC#3's evidence was a non-collapse assertion understates it:
**there was no suite for that assertion to be weak in.**

---

## 5 · Flow C — the panel's two run-state surfaces

### 5.1 Hole 1, and the correction that must land first

`TodosSection.tsx:262-264`:
```js
const isStreaming = useStreamingForThread(threadId)
const isLoading   = useLoadingForThread(threadId)
const isRunLive   = isStreaming || isLoading
```

⛔ **`BUG-260915-01`'s stated mechanism is measurably FALSE.** The report says *"opening a thread
triggers no reconcile"*. Measured at `StreamsProvider.tsx:1936-1942`: `setViewingThread` **does**
fire `useStreamsStore.getState().actions.reconcile(threadId)`. **Candidate #1 is already
implemented, and a fixer following the report ships a no-op.**

**The real hole:**
- `loadingThreads` is written **only** by `loadMessages` (`:3275-3277` add, `:3381-3390` clear).
- Thread open fires `reconcile`, which calls `getSnapshot` and **never touches `loadingThreads`**.
- So for the whole `/snapshot` round-trip, `isStreaming` is false and `isLoading` is false →
  `isRunLive` false → **`Not ticked` on a live run, on every thread open.**
- `reconcileInFlightRef` is declared `useRef(false)` at **`:1503`**, read at **`:1975`**, cleared at
  **`:2506`** — **a single global boolean, not keyed by thread.** A dropped second reconcile leaves
  the false state until the user navigates away and back, which is the *persistent* symptom the
  report actually describes.

⭐ **The code already knows.** `:2028` says verbatim: *"would hold `reconcileInFlightRef` — a GLOBAL
flag, not a per-thread one … Make the in-flight guard per-thread first if a retry is ever wanted
here."*

### 5.2 Why `loadingThreads` must not be reused

`streamsStore.ts:219-222` — `loadingThreads` also drives `MessageList`'s cold-load skeleton
(*"cold-load skeleton on `loadingThreads.has(activeThreadId) && …`"*). A **second consumer**.
⛔ Widening it would change a surface nobody is looking at. **One home per concern.**

The per-thread pattern to mirror already exists three times over: `reconcileErrors: Map`,
`fallbackNotices: Map`, `failedSendDrafts: Map`, each with a `use…ForThread` selector.

### 5.3 ⛔⛔ The hook-order landmine — read this before touching `TodosSection`

`TodosSection.tsx:243-261` carries a shouting comment. Quoted because paraphrasing it has already
cost this project a blank page:

> **THE TWO HOOKS ARE CALLED ON THEIR OWN LINES AND THE `||` COMBINES THEIR VALUES. NEVER write
> `useStreamingForThread(threadId) || useLoadingForThread(threadId)`.** `||` SHORT-CIRCUITS: the
> moment the first selector returns true — i.e. the moment a run actually starts — the second hook
> is never called, React counts fewer hooks than the previous render, throws *"Rendered fewer hooks
> than expected"*, and **THE WHOLE PAGE GOES BLANK.** Shipped that way for one commit in Phase 250
> and found by DRIVING the app, not by a test: every unit fence passed, because a `vi.fn()`
> standing in for a hook consumes no hook slot, so the violation is structurally invisible to them.

Pinned by `__tests__/TodosSection.test.tsx` → *"hooks are never short-circuited"*. **That pin must
be extended to the third hook, not merely left standing.**

### 5.4 Hole 2 — the surface that was never in scope

`WorkspacePanel.tsx` mounts `TodosSection` (`:68` import, rendered in the panel body) **and**
`PhaseTimeline threadId={threadId}` at **`:542`**.

`PhaseTimeline.tsx:141-147`: `PhaseTimelineProps { threadId: string | null }`, and it already calls
`usePhases(threadId)` / `useTasks(threadId)`.

`PhaseCard.tsx:404-408`:
```js
export function PhaseCard({ phase, position, timing }: PhaseCardProps) {
  ...
  const isRunning = phase.status === "running"
```
— derived from the **SSE-driven phase status alone**, never from run liveness. It drives a spinner,
`aria-busy` and a forced-open row (`isActive = isRunning || phase.status === "retrying"`). **A run
that dies without emitting its phase-terminal event leaves a card claiming *running* forever.**

`git grep` over Phase 250's artifacts returns **zero** mentions of `PhaseCard`, `PhaseTimeline` or
`phaseStatusMeta`. `HONEST-03`'s wording is *"the workspace panel"*; **one of its two run-state
surfaces was made honest.**

### 5.5 The three additive-sibling contracts in `WorkspacePanel.tsx`

`RunSoul` (`:110-127`), `RunSeam` (`:204-218`) and the cancel seam (`:302-310`) each state in their
own docblock that they **do not read `PhaseCard`/`PhaseTimeline` internals and add a prop to
neither**. ⭐ Their promise is about **those siblings**. `PhaseTimeline` is the card's own owner and
may pass it a prop; the panel file itself is **not modified**, so all three stay true.

### 5.6 `phaseStatusMeta.ts` — the vocabulary the new row joins

`:82` `running: { glyph: "●", text: "Running", textClass: "…--panel-status-active…" }`.
The file already carries a **quiet-terminal family** shared by `pending`/`skipped`/
`recorded-not-sent`/`unknown` (`:114`, `:145`, `:179`), each documented as *"a quiet terminal, not
an alarm"*. The not-live reading joins that family.

---

## 6 · The warnings

| # | Measured | Fix |
|---|---|---|
| **W-4** | `backend/app/api/setup.py:380-390` — `provider_key` has **no** `except SettingsWriteRefused`. `setup_service.py:342-345` says it **propagates by design**. Four sibling seams catch it (`admin.py:618`, `:1784`, `:1800`; `settings.py:951`). | Add the arm → **400**. ⛔ The existing **500** arm for a `False` return stays byte-unchanged — it means a different thing. |
| **W-6** | `WorkspacePanel.derived.test.tsx:62-63` — two `vi.fn(() => …)` zero-arity stubs are spread into. `tsc -p tsconfig.app.json --noEmit` names exactly these two `TS2556`, out of **67** errors total. | Give both a `(..._a: unknown[])` rest parameter, copying `:50` three lines above. |
| **W-6b** | ⚠ **The audit's "in neither count-gate knob" is STALE.** `vitest-count-gate.cjs:152` pins it at `4` and `:4212` lists it in TARGETS. `git log -S` → commit **`b0dd02f28`** both adopted the suite **and** authored the two errors. | Correct the **comment inside the test file** (`:55-56`), which is what actually rotted. |
| **W-7** | `vitest-count-gate.cjs:2887` pins `ConnectionGrantsList.test.tsx` at **8**; `grep -c "^\s*it(\|^\s*test("` on the file returns **9**. One unit of permanent slack since Phase 221 — a deleted case keeps the gate green. | Pin → **9**. |
| **W-8** | `ThinkingBlock.tsx:158` cites `.planning/seeds/SEED-269-one-home-for-the-elapsed-formatter.md`. `ls` → that file does not exist; the register holds `SEED-284-one-home-for-the-elapsed-formatter.md`, plus `SEED-269-explanations-are-noise-…` (unrelated) and `SEED-269-superseded-id.md`. | Re-point to `SEED-284-…`. |
| W-5, W-9 | ✅ Resolved clean at the audit. | **No work.** |

---

## 7 · The reported-bugs register

`.planning/reported-bugs/` holds **190** files.

| id | file | `status` | `folded_into` | note |
|---|---|---|---|---|
| `BUG-260911-01` | `…app-settings-writable-by-anon-in-production.md` | `open` | `null` | blocking; cloud/production |
| `BUG-260910-03` | `search-tab-cannot-save-because-a-stored-value-is-out-of-its-own-bound.md` | `open` | `null` | blocking |
| `BUG-260913-01` | `google-drive-adapter-never-writes-source-path.md` | `open` | `null` | major |
| `BUG-260907-02` | `…custom-client-id-accepts-a-secret-into-a-readable-column.md` | `open` | `null` | major — **this phase's B-2/B-3 territory** |
| `BUG-260828-02` | `grant-override-marker-claims-a-person-changed-it.md` | `open` | `null` | ⛔ **DUPLICATE ID** |
| `BUG-260828-02` | `…no-authoring-surface-can-declare-a-workflow-input.md` | `closed` | `214.1` | ⛔ **DUPLICATE ID**, and the one that is cited |
| `BUG-260902-06` | `a-newly-added-model-appears-only-if-the-request-lands-on-the-worker-that-wrote-it.md` | `open` | `null` | major |
| `BUG-260915-01` | `todo-rows-flash-not-ticked-on-a-live-run-after-thread-open.md` | `open` | `null` | ⛔ **mechanism is false — correct before fixing** |

**Free id on that date:** `BUG-260828-01` … `-10` are all taken, so **`BUG-260828-11`** is next.
⭐ The CLOSED report keeps `-02` because `verified_closed_by: 214.1` is cited in ROADMAP and
verification artifacts; the **open** one is renamed.

⭐ **This is `REG-01`'s exact defect class, one register over, in the milestone that shipped
`REG-01`** — and `248-CONTEXT.md:376` found the duplicate and nobody fixed it.

---

## 8 · Gates and baselines at this phase's base (`697f71063`)

| Gate | Command | Reading |
|---|---|---|
| backend units | `pytest tests/unit -q --continue-on-collection-errors` | **71 failed · 4864 passed · 2 xfailed · 2 xpassed · 0 collection errors** — the locked ceiling, **zero headroom**. Set in `252-BASELINE-backend-failures.txt` (71 ids, 24 files). ⭐ **Zero** are connector/setup/oauth/mcp. |
| vitest count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | **total 8379 · failed 2 · pinned 7572** → `COUNT GATE VIOLATED`. Both failures are `sketchComposition.test.tsx`'s §2 positive controls — **SEED-171's recorded pair, 4th reproduction**, byte-unchanged tree. ⛔ Cap NOT touched. |
| frontend typecheck | `npx tsc -p tsconfig.app.json --noEmit` | **67** errors. ⛔ `npx tsc --noEmit` checks **zero files** and exits 0. |
| G-5 ledger | `node scripts/check-hot-file-ledger.cjs --files <12 files>` | `ledger gate OK` — 12/12 have rows. `.sql` is excluded from the scan by `scripts/check-hot-file-ledger.cjs:64`. |
| G-7 | `node scripts/check-gap-closure-rounds.cjs 252` | `G-7 clear` |
| seeds | `node scripts/check-seeds-register.cjs --phase 252` | `293/293 parsed · 0 duplicate ids` · `0 seeds matched` **because the phase declared no surfaces yet** — re-run after planning. |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | `102442 chars · 68.3% of limit` — OK. |

---

## 9 · Worktree facts that bind every plan

- ⛔ **First action in every worktree:** `bash scripts/bootstrap-worktree.sh "$(pwd)"`. A worktree
  that skipped it reports green typechecks and red tests for reasons that look like the plan's fault.
- ⛔ **`GSD_VITEST_MAX_WORKERS=2`** on every vitest invocation.
- ⛔ **Never `rm -rf` a worktree** — a recursive delete follows the junction and destroys the real
  1.7 GB `venv`. Use `bash scripts/teardown-worktree.sh <path>`.
- **No plan in this phase mutates the local database**, so worktree rule 4 does not bind. B-1 edits
  SQL **text artifacts** only; ⛔ nothing applies a migration or runs `regenerate-full-schema.sh`
  (**Docker is denied in this environment**).

---

*Researched 2026-09-16 · base `697f71063` · every figure re-derived from the tree.*
