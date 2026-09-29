---
phase: 252
reviewed: 2026-09-16T18:30:00Z
depth: standard
status: issues-found
files_reviewed: 28
files_reviewed_list:
  - backend/app/api/connectors.py
  - backend/app/api/setup.py
  - backend/app/services/connector_service.py
  - backend/tests/unit/test_252_credential_boundary.py
  - backend/tests/unit/test_252_setup_refusal.py
  - backend/tests/unit/test_connector_credential_boundary.py
  - docs/HOT-FILE-LEDGER.md
  - frontend/src/components/chat/ThinkingBlock.tsx
  - frontend/src/components/panel/__tests__/TodosSection.test.tsx
  - frontend/src/components/panel/__tests__/WorkspacePanel.derived.test.tsx
  - frontend/src/components/panel/PhaseCard.test.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/panel/phaseStatusMeta.ts
  - frontend/src/components/panel/PhaseTimeline.tsx
  - frontend/src/components/panel/TodosSection.tsx
  - frontend/src/components/sources/__tests__/WatchRowCard.test.tsx
  - frontend/src/components/sources/bug260912AppCredentials.test.ts
  - frontend/src/components/sources/sourceHealthVocabulary.test.ts
  - frontend/src/components/sources/sourceHealthVocabulary.ts
  - frontend/src/components/sources/WatchedFoldersSection.test.tsx
  - frontend/src/components/sources/WatchedFoldersSection.tsx
  - frontend/src/components/sources/WatchRowCard.tsx
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/stores/streamsStore.ts
  - scripts/check-schema-acl-parity.cjs
  - scripts/full-schema-supplement.sql
  - scripts/vitest-count-gate.cjs
  - supabase/full-schema.sql
findings:
  critical: 2
  warning: 9
  info: 3
  total: 14
---

# Phase 252: Code Review Report

**Reviewed:** 2026-09-16
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues-found
**Range:** `46cf36bf6..HEAD` (`.planning/` excluded)

## Summary

The phase's credential-boundary work (B-2 / B-3 / W-4) is sound and I could not break it:
`_validate_custom_client_id` genuinely never echoes the value, so
`ConnectorClientIdRefused(f"… {exc}")` and the 422 detail carry the rule only;
`e.errors(include_input=False)` removes the input key from every union arm; `SettingsWriteRefused.detail()`
carries column + constraint names only. All 33 backend cases in the three touched test files pass;
the new `WatchRowCard.test.tsx` runs 9/9, matching its pin; `check-schema-acl-parity.cjs` exits 0
and the supplement is still the byte-identical 433-line tail of `full-schema.sql` (verified).

The defects are concentrated in **two places the phase's own success criteria claim to have
closed**:

1. **SC#1 ("a greenfield deploy is not born with anon-executable functions").** The new gate only
   understands `GRANT/REVOKE EXECUTE ON FUNCTION`. I proved two ways it stays green over a real
   gap — a deleted `REVOKE … FROM PUBLIC` (the exact Postgres trap CLAUDE.md records), and an ACL
   statement that follows a string literal containing `--` (a construct migration 180 already
   ships). Separately, the table/column half of the mirror is **five columns and one whole table**
   behind, and the missing table is `connector_tokens`, whose own migration says its ciphertext
   columns "must NEVER be granted SELECT to authenticated or anon".
2. **SC#5 ("the panel never calls a live run finished").** The new `runLive` prop can now do the
   inverse — call a *live* run finished — during the window where `PhaseTimeline`'s frame is stale,
   and it leaves an interrupted card permanently un-expandable.

There is also a visible UI duplication shipped by SC#4 (the queued sentence renders twice), and
the hot-file ledger rows for twelve files in this phase's own blast radius were left stale, which
is the failure mode that ledger section exists to prevent.

---

## Critical Issues

### CR-01 — The bootstrap artifacts still ship `connector_tokens` and five `connector_connections` columns unmirrored, and the new gate is structurally unable to see it

**Severity:** Critical (security — greenfield deploy)
**File:** `scripts/full-schema-supplement.sql:194-262` (§5), `:265-305` (§6 header); `scripts/check-schema-acl-parity.cjs:123` (`ACL_RE`)

**What is wrong.** This phase edited the supplement's maintenance header to read *"ANY migration
that narrows a **table OR function** privilege must be mirrored here"*, and §6's header says the
file is *"guarded by `scripts/check-schema-acl-parity.cjs`"*. The gate's `ACL_RE` only matches
`GRANT|REVOKE EXECUTE ON FUNCTION`. It sees **no table or column privilege at all**, so the
half of the stated rule that was already broken stays broken and now reads as guarded.

Measured against `supabase/migrations/`:

| Migration | Statement | In the supplement? |
|---|---|---|
| `129:85` | `REVOKE ALL ON TABLE public.connector_tokens FROM anon, authenticated;` | **no** |
| `129:88` / `151:92` | `GRANT SELECT (id, connection_id, account_email, account_name, token_type, scopes, expires_at, created_at, updated_at) ON public.connector_tokens TO authenticated;` | **no** |
| `129:101` | `GRANT SELECT (auth_type, status, error_message) ON public.connector_connections …` | **no** |
| `128:106` | `GRANT SELECT (default_approval_posture) …` | **no** |
| `156:31-37` | `GRANT SELECT/INSERT/UPDATE (default_ingest_visibility) …` | **no** |

`grep -c "connector_tokens" scripts/full-schema-supplement.sql` returns **0**.

**Concrete failure scenario (security).** Bootstrap a fresh project from `supabase/full-schema.sql`.
`pg_dump --no-privileges` carries no grants, so `connector_tokens` is created and picks up
Supabase's stock `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO anon, authenticated`.
`129`'s `REVOKE ALL` never runs. Migration 151's RLS policy `connector_tokens_select` (dumped, and
scoped to `current_user_org_ids()`) then permits any authenticated org member to
`GET /rest/v1/connector_tokens?select=access_token_ciphertext,refresh_token_ciphertext`
for every connection in their org — the columns migration 129's own comment says
"must NEVER be granted SELECT to authenticated or anon". On a local/dev DB the migrations have run,
so this is invisible; on a greenfield deploy it is live.

**Concrete failure scenario (functional).** On the same greenfield DB, §5 runs
`REVOKE ALL ON public.connector_connections FROM authenticated` and then grants only 15 columns.
`_SELECTABLE_COLUMNS` (`backend/app/services/connector_service.py:143`) is derived from
`ConnectorConnectionResponse`'s keys and names `auth_type`, `status`, `error_message`,
`default_approval_posture`, `default_ingest_visibility` — none of which are granted. PostgREST
answers `42501 permission denied for table connector_connections` on **every** connector read.
§5's own comment records this exact failure happening before ("MEASURED DRIFT, 2026-08-26 … FOUR
COLUMNS behind"); it has now drifted by five more.

The underlying gap pre-dates Phase 252. What Phase 252 added is a header claiming the broader rule
and a gate that enforces only the narrow one, plus an SC#1 verdict of ✅ over the artifact.

**Fix.** Either (a) narrow the §6 header and the gate's report text to say *function* ACLs only,
and record the table half as explicitly owed with a named seed, **or** (b) extend the gate. (b) is a
small change: add a second regex for table/column privileges and compare `(table, grantee, verb,
column-set)` tuples. Regardless of which, the five `connector_connections` columns and the whole
`connector_tokens` block should be mirrored into the supplement and into `full-schema.sql`'s tail in
the same commit, exactly as §5 and §6 were.

---

### CR-02 — `check-schema-acl-parity.cjs` compares function NAMES, not ACLs: deleting a `REVOKE … FROM PUBLIC` keeps it green (proven)

**Severity:** Critical (the guard cannot fire on the mutation it exists to catch)
**File:** `scripts/check-schema-acl-parity.cjs:177-190` (`analyse`), `:186` (`missing`)

**What is wrong.** `scanSupplement` reduces the supplement to a `Set<signature>` and `missing` is
`expected.keys().filter(s => !mirroredSet.has(s))`. Once a function's name appears **anywhere** in
the supplement with **any** grantee and **any** verb, every ACL statement about it is invisible to
the gate. The docstring discloses this in one line (`:25-28`), but §6's header and the gate's own
failure text do not — the failure text goes on to lecture the reader that
*"REVOKE … FROM PUBLIC must precede REVOKE … FROM anon: anon inherits from PUBLIC"* (`:220-221`),
which reads as something it checks.

**Concrete failure scenario (driven, not reasoned).** I removed the single line
`REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` from a copy of
the supplement and ran the shipped `analyse()`:

```
missing: 0 []
```

Exit 0. `schema ACL parity OK`. The remaining `FROM anon` / `FROM authenticated` revokes are
**inert while the PUBLIC grant stands** — CLAUDE.md records that trap by name, and migration 177's
first version failed on exactly it. `resize_embedding_column` is the RPC `BUG-260911-01` found
callable unauthenticated in production, and it NULLs every vector in `document_chunks` and
`skill_embeddings`. So the one gate written to stop that class re-shipping will pass over precisely
the edit that re-ships it.

The same hole applies to a future *narrowing*: migration 190 revoking EXECUTE from `authenticated`
on `match_document_chunks` (already named in §6 with a `GRANT … TO authenticated`) would pass the
gate while the greenfield bootstrap grants exactly what 190 revoked.

**Fix.** Compare statement tuples rather than names. Concretely, have `aclsIn` return
`{ verb, signature, grantees }` and key the expected/mirrored sets on
`` `${verb}|${signature}|${grantee}` `` (one entry per grantee, since
`REVOKE … FROM anon, authenticated` is legal):

```js
out.push(...grantees(m[3]).map((g) => ({ key: `${m[1].toUpperCase()}|${normaliseSignature(m[2])}|${g.toLowerCase()}`, signature: …, file })))
```

Then drive it RED against the deletion above — that counterfactual belongs in `--self-test`, which
today only plants a *whole-function* omission (`FIXTURE_SUPPLEMENT_MISSING_ONE` filters every
`public.alpha` line) and therefore never exercises the partial case.

---

## Warnings

### CR-03 — The gate's comment stripper swallows any ACL statement that follows a string literal containing `--` (proven; migration 180 already ships that construct)

**Severity:** Warning (silent false negative in a security gate)
**File:** `scripts/check-schema-acl-parity.cjs:112-121` (`statements`)

**What is wrong.** `statements()` truncates every line at the first `--` before splitting on `;`.
It has no notion of string literals, so a `--` inside `'…'` destroys that statement's terminating
`;`, and the next statement is glued onto the unterminated chunk. `ACL_RE` is anchored with `^\s*`
and no `m` flag, so the glued ACL no longer matches and is never counted as expected.

**Concrete failure scenario (driven through the shipped `aclsIn`):**

```js
// swallowed-case
"COMMENT ON COLUMN public.t.c IS 'includes /v1 -- verbatim';\n\nREVOKE EXECUTE ON FUNCTION public.danger(integer) FROM PUBLIC;\n"
 -> []                                   // the ACL is invisible
// control (same SQL, no `--` in the literal)
 -> [{"signature":"public.danger(integer)"}]
```

`supabase/migrations/180_app_settings_self_hosted_endpoints.sql:30` and `:32` already contain
`COMMENT ON … IS '… -- …';`. A future migration that puts a function REVOKE after such a comment
will be mirrored by nobody and reported by nothing.

**Fix.** Strip `--` only when it is outside a quoted string / dollar-quoted body. Minimal version:
walk the file once tracking `'`, `"` and `$tag$` state instead of `line.indexOf('--')`. A cheaper
belt-and-braces alternative that also closes the anchoring half: drop `^\s*` from `ACL_RE` and
scan with a global regex over the comment-stripped text rather than over `;`-split chunks.

---

### CR-04 — `PhaseTimeline` can call a *live* run finished while its frame is stale — the inverse of the bug SC#5 fixes

**Severity:** Warning (user-visible wrong state; no data loss)
**File:** `frontend/src/components/panel/PhaseTimeline.tsx:250` (`runTerminal`), `:394` (`runLive={!runTerminal}`)

**What is wrong.** `runTerminal` is derived from `frame`, which is re-read asynchronously on every
`phaseSignature` change (`:225-228`). Between a phase flipping to `running` and the re-read
landing, `frame` still holds the **previous** run's terminal `run_status`.

**Concrete failure scenario.** Thread T finished a harness run (`frame.run_status = "completed"`,
`runTerminal = true`). The user sends a new message that starts a second run. SSE moves phase 0 to
`running` → `phaseSignature` changes → `readFrame()` is issued but has not resolved.
For that whole round-trip `runLive === false`, so `statusMetaForRun("running", false)` returns
`INTERRUPTED_META` and the genuinely-running first phase renders `⊣ No outcome`, with no spinner,
no `aria-busy`, no BLOOM frame — i.e. the panel tells the user a run that started one second ago is
over. The PhaseCard docblock (`:385-390`) reasons only about the *mount* case (`frame === null`),
which is safe; the *restart* case is not covered by it or by any test.

**Fix.** Only trust `runTerminal` when the frame was fetched for the current phase signature. Keep
the signature alongside the frame and gate on agreement:

```ts
const [frame, setFrame] = useState<{ wf: RunFrame; sig: string } | null>(null)
// …setFrame({ wf, sig: signatureAtIssue })…
const frameFresh = frame?.sig === phaseSignature
const runLive = !(frameFresh && runTerminal)
```

A cheaper stopgap that removes the flash without the plumbing: `runLive={!runTerminal || anyRunning === false ? !runTerminal : undefined}` is *not* recommended (it re-opens hole 2); the freshness check is the honest one.

---

### CR-05 — An interrupted phase card becomes permanently un-expandable, hiding its whole detail region

**Severity:** Warning (functional regression introduced by this phase)
**File:** `frontend/src/components/panel/PhaseCard.tsx:436`, `:444`, `:469-474`, `:486-487`, `:679`

**What is wrong.** With `phase.status === "running"` and `runLive === false`:

- `isRunning = false` (`:436`)
- `isTerminal = status === "done" | "failed" | "skipped"` → **false** (`:444`)
- `forcedOpen = isRunning` → **false** (`:486`)
- `canToggle = isTerminal && !forcedOpen` → **false** (`:487`)
- `open` initialises to `isRunning || isFailed` → **false** (`:469`), and the effect at `:473`
  only ever sets it true for those same two.

The accordion body is `hidden={!open}` (`:679`).

**Concrete failure scenario.** A harness run dies mid-step (process killed, worker restart) without
emitting a phase-terminal event. The user opens the panel. The step now reads `⊣ No outcome`
— correct — and **cannot be opened at all**: no chevron (`canToggle` gates it at `:665`), the
header click is a no-op (`:570`), so the step's identity line, emit sub-steps, failure block and
outputs are unreachable. Before this change the same card was force-opened and all of that was
visible. The new test asserts `ariaDisabled !== "true"` and never asserts the card can be expanded,
so the regression is unpinned.

**Fix.** Treat the interrupted reading as terminal for interaction purposes:

```ts
const isInterrupted = LIVE_CLAIMING_STATUSES.has(phase.status) && runLive === false
const isTerminal = phase.status === "done" || phase.status === "failed" || phase.status === "skipped" || isInterrupted
```

and add a case: `runLive={false}` + `status="running"` → the region is reachable (click the header,
assert `region` loses `hidden`).

---

### CR-06 — The queued sync sentence now renders TWICE on the same card

**Severity:** Warning (visible duplication shipped by SC#4)
**File:** `frontend/src/components/sources/WatchRowCard.tsx:408` and `:501-514`; `frontend/src/components/sources/WatchedFoldersSection.tsx:299-301`

**What is wrong.** D-16 collapsed *refusal* and *success* into one slot, but the queued sentence has
a **third** renderer that was not considered. `handleSyncNow` writes
`says = COPY.asked(withinPhrase(...))` into `pendingAsks[watch.id]` **and** returns
`{ kind: "queued", says }`. The parent passes the first down as `pendingSays`, which the card
renders at `:408` (`{pendingSays ?? outcome ?? COPY.neverRead}` inside `sources-outcome`); the
second becomes `syncOutcome` → `syncLine` → the toolbar chip at `:501`. Both are the same string.

**Concrete failure scenario.** Click "Sync now" on a healthy watched folder. `triggerWatchSync`
answers `{status:"asked", next_check_within_seconds:60}`. The card then shows
`Asked · next check within 60 seconds` in the outcome line **and**
`Asked · next check within 60 seconds` in the green toolbar chip, simultaneously, until the next
tick advances `last_run_at` and the pending-ask sweeper clears it.

The shipped integration test that covers this exact flow —
`WatchedFoldersSection.test.tsx:796`, `expect(screen.getByTestId("sources-sync-outcome")).toBeInTheDocument()`
— is a **presence assertion** and cannot see it, which is the anti-pattern this phase names by name.

**Fix.** The parent already owns the queued state; the card should not render it twice. Either drop
the `queued` arm from the card's slot (render only `refused` / `failed`, and let `pendingSays` carry
the queued reading, which it already did before this phase), or drop `pendingSays` from
`outcomeLine` when `syncLine?.kind === "queued"`. The first is preferable: one writer, one reader.
Add a case asserting `cardText().split(COPY.asked("60 seconds")).length - 1 === 1`.

---

### CR-07 — Moving the refusal into the actions toolbar hides it on `degraded` rows

**Severity:** Warning (regression)
**File:** `frontend/src/components/sources/WatchRowCard.tsx:466` (`{!isDegraded && (`), `:501`; previously rendered unconditionally at the old `:607-613`

**What is wrong.** The deleted `<p data-testid="sources-refusal">` sat in the card body and rendered
whenever `asCard` was true. Its replacement lives inside `{!isDegraded && (…actions toolbar…)}`, so
`state === "degraded"` (`:234`, from `watch.degraded`) now suppresses the refusal entirely.

**Concrete failure scenario.** A user clicks "Sync now"; the backend answers `refused` ("reading is
switched off"), and the parent records it in `refusals[watch.id]`. A subsequent `loadWatches`
returns the watch with `degraded: true` (or the row was already degraded when the refusal was
recorded in an earlier session and re-rendered from parent state). The card renders the degraded
block and **no refusal text at all** — the server's own explanation for why nothing happened is
silently dropped. Before this phase it was shown.

Uncertainty: I did not find a path that sets a refusal *and* flips `degraded` within one click, so
this may be reachable only across a reload. The suppression itself is certain from the JSX nesting.

**Fix.** Render `syncLine` outside the `!isDegraded` guard (it is a statement about the last click,
not about the source's health), or add a degraded-branch render of the same one slot.

---

### CR-08 — Twelve hot-file ledger rows in this phase's own blast radius were left stale, including one whose row says G-5 fires on the next touch

**Severity:** Warning (guardrail integrity — CLAUDE.md's own recorded failure mode)
**File:** `CLAUDE.md` (ledger scan list), `docs/HOT-FILE-LEDGER.md`

**What is wrong.** The phase updated exactly one row (`scripts/vitest-count-gate.cjs`) and one
detail section, while modifying a dozen other ledgered hot files. Re-derived with CLAUDE.md's own
recipe at HEAD:

| File | CLAUDE.md row | measured now |
|---|---|---|
| `frontend/src/components/panel/PhaseCard.tsx` | `16 / 10 / 755` | `17 / … / 788` |
| `frontend/src/components/panel/PhaseTimeline.tsx` | `9 / 7 / 385` | `10 / … / 404` |
| `frontend/src/components/panel/phaseStatusMeta.ts` | `3 / 3 / 236` | `4 / … / 291` |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | `6 / 3 / 560` | `8 / … / 645` |
| `backend/app/api/connectors.py` | `44 / 21 / 2140` | `45 / … / 2162` |
| `frontend/src/stores/streamsStore.ts` | `21 / 13 / 546` | `22 / … / 572` |

(`StreamsProvider.tsx`, `TodosSection.tsx`, `WatchRowCard.tsx`, `WatchedFoldersSection.tsx`,
`ThinkingBlock.tsx`, `connector_service.py` are in the same state.)

`check-hot-file-ledger.cjs 252` returned `ledger gate OK` because it only checks row **presence**,
which is why the verification's "13 watched, ⛔ not vacuous" line does not contradict this.
CLAUDE.md states the consequence explicitly: *"A row that is present and WRONG answers the auditor
with `satisfied` and stops the audit, which is worse than an absent row."*

**Concrete consequence.** `sourceHealthVocabulary.ts`'s row reads *"row added at its THIRD phase, so
G-5 FIRES on the next touch."* Phase 252-03 **was** the next touch (it added a whole new table plus
a reworded control). G-5 therefore fired and no refactor proposal or "honoured by construction"
disposition was recorded anywhere; the next phase reading that row will believe G-5 has not fired
yet, and will be wrong by two phases.

**Fix.** Re-derive and update the twelve rows plus their `docs/HOT-FILE-LEDGER.md` sections in one
commit (the same-commit sync rule), and record the `sourceHealthVocabulary.ts` G-5 disposition
explicitly. Separately worth considering: teach `check-hot-file-ledger.cjs` to fail on a row whose
line count differs from `wc -l` — presence-only is the same class of guard as CR-02.

---

### CR-09 — A refused DCR registration orphans a client at the remote server, and every retry mints another

**Severity:** Warning (unbounded third-party resource creation)
**File:** `backend/app/api/connectors.py:1327-1367`

**What is wrong.** `register_client(...)` creates a real OAuth application at the remote
authorisation server **before** `store_oauth_client_credentials` validates the returned id. On
refusal the new code raises 422 and stores nothing — correct for the credential boundary, but the
remote registration is not (and cannot be) rolled back, and because nothing is persisted the
`if not client_id and probe.registration_endpoint` branch is taken again on the next attempt.

**Concrete failure scenario.** An authenticated org admin connects to an MCP server whose RFC 7591
endpoint mints ids shaped like secrets (e.g. Entra-style `<prefix>~<body>`, which
`_validate_custom_client_id` refuses). Every click of "Connect" registers a new application in that
vendor's account and then answers 422. The refusal message does point at the manual repair
("Enter an application id … in its settings"), so a human will stop; a retrying client or an
impatient user will not, and this is reachable by any user with connector-write permission.

The comment three lines above (`:1335-1338`) explicitly names this cost —
*"re-registering on every Connect would mint a NEW application at the vendor each time — litter in
someone else's account"* — as the reason the write exists. The refusal path re-opens exactly that.

**Fix.** Either persist a "this server's DCR output is unusable" marker on the connection so the
registration branch is skipped on retry, or attempt RFC 7592 client deletion when the endpoint
advertises `registration_client_uri`, or at minimum log the orphaned `client_id` (it is refused
precisely *because* it looks like a secret, so log it redacted / by hash, not verbatim) so an
operator can clean up. A marker is the cheapest and matches the "refuse the registration" decision.

---

### CR-10 — The new `WatchRowCard` suite casts its most important new contract to `never`, and its default stub returns a value the type forbids

**Severity:** Warning (weakened fence on the contract the phase added)
**File:** `frontend/src/components/sources/__tests__/WatchRowCard.test.tsx:94`, `:97`, `:109`

**What is wrong.** `onSyncNow` is typed `(watch) => Promise<WatchSyncOutcome>` (`WatchRowCard.tsx:195`),
but the suite declares it `(w: ConnectorWatch) => unknown`, defaults it to
`vi.fn().mockResolvedValue(undefined)`, and passes it as `onSyncNow={onSyncNow as never}`. `as never`
disables *all* type checking on the single prop whose shape is D-15's deliverable.

**Concrete consequence.** In cases 1 and 2 the card executes
`setSyncOutcome(await onSyncNow(watch))` with `undefined`, so `syncOutcome` is `undefined`,
`syncLine` falls through to the `refusal` fallback, and **no queued reading is ever produced by any
case in the file.** Case 1's `expect(cardText()).not.toContain("0 changes")` therefore passes over a
card that renders no outcome at all, and case 2's "a refusal and a success cannot co-render"
asserts the absence of a success the mock never produced. Both would still fail pre-fix (the old
literal was unconditional), so they are not vacuous — but neither exercises the discriminated union
the phase introduced, and a future regression that broke the `queued` arm would be invisible here.
This is also what let CR-06 through.

**Fix.** Type the override as `(w: ConnectorWatch) => Promise<WatchSyncOutcome>`, drop `as never`,
default it to `vi.fn().mockResolvedValue({ kind: "queued", says: "Asked · next check within 60 seconds" })`,
and add a case asserting a queued click renders that sentence exactly once (which also pins CR-06).

---

### CR-11 — `bug260912AppCredentials.test.ts`'s occurrence pin was re-baselined 4 → 5 while the suite runs in neither count-gate knob

**Severity:** Warning (a pin no gate can check)
**File:** `frontend/src/components/sources/bug260912AppCredentials.test.ts:123-138`; `scripts/vitest-count-gate.cjs` TARGETS block

**What is wrong.** 252-03 edited this suite's exact-equality occurrence pin, and 252-05 recorded —
honestly — that the file is in neither TARGETS nor BASELINE and declined to adopt it. The net effect
is a hand-edited exact-count assertion that **no gate executes**: if the new number were wrong, the
suite would be red and nothing would report it.

I verified the counts by hand and they are correct today
(`app_credentials_invalid` → 5, `connection_disabled` → 4, both matching the new pins), so this is
about the guard, not about a present error.

**Fix.** Add `src/components/sources/bug260912AppCredentials.test.ts` to TARGETS and a BASELINE pin
in the same commit. It is a pure-source `?raw` suite with no mount, so it cannot bring
`sourceComposition.test.tsx`'s standing red with it — the stated reason for declining the
directory-wide entry does not apply to this one file.

---

## Info

### CR-12 — A rejected sync falls back to a sentence that claims the *source* stopped

**Severity:** Info
**File:** `frontend/src/components/sources/WatchRowCard.tsx:304`

`setSyncOutcome({ kind: "failed", says: err?.message || UNKNOWN_SOURCE_FAILURE_SENTENCE })` reuses
`"It stopped, and no reason was recorded."` (`sourceHealthVocabulary.ts:104`), which is the
vocabulary's sentence for a **source that stopped reading**. A sync request that threw without a
message would therefore tell the user their source has stopped, which is a different (and
unverified) claim — in a phase about not claiming things. The arm is unreachable today (the parent
never rejects), so the cost is latent.

**Fix.** Add a `COPY.askFailed` row to the vocabulary ("The check could not be asked for.") and use
that as the fallback.

---

### CR-13 — `PhaseCard`'s `runLive` docblock contradicts its only call site

**Severity:** Info
**File:** `frontend/src/components/panel/PhaseCard.tsx:415-418`

The docblock says *"`PhaseTimeline` passes `undefined` before its frame fetch resolves"*, but
`PhaseTimeline.tsx:394` passes `runLive={!runTerminal}`, which is always a boolean — pre-fetch it is
`true`, never `undefined`. The behaviour is the same either way (`true` and `undefined` both leave
the reading unchanged), so this is documentation only, but it is the kind of prose drift this phase
spent five findings on.

**Fix.** Reword to *"passes `true` before its frame resolves; `undefined` is what the other callers
pass"*.

---

### CR-14 — The second caller of `store_oauth_client_credentials` swallows the new named exception

**Severity:** Info
**File:** `backend/app/api/connectors.py:1565-1578`

`ConnectorClientIdRefused` is a `ConnectorError`, and the OAuth-authorize path's persist block
catches bare `except Exception` and continues with the value in hand. Today that is safe because
`OAuthAuthorizeRequest.custom_client_id` is annotated `CustomClientId`
(`models/connector.py:600`), so a refusable value cannot reach it. If that annotation is ever
dropped or the model is bypassed, a refused credential would be logged-and-ignored here and then
placed into the authorization URL — the same `200 OK` failure the DCR RED drive found.
No credential leaks via the log: the exception message names the rule only, and Python tracebacks
do not carry locals.

**Fix.** Add an explicit `except connector_service.ConnectorClientIdRefused` arm ahead of the
generic one that answers 422, mirroring the DCR block, so the boundary behaves the same at both
doors.

---

_Reviewed: 2026-09-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
