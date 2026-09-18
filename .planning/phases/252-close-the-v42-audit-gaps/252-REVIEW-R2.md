---
phase: 252-close-the-v42-audit-gaps
round: R2 — live-or-fixed verdict on the ten findings left open by 252-REVIEW.md
reviewed: 2026-09-17T19:40:00Z
reviewed_at_head: 7a5563cf51354f8a7ab0754eefb9704d709ac2ba
depth: standard (every verdict driven, not read)
scope: >-
  Re-verification of CR-04..CR-07 and CR-09..CR-14 from 252-REVIEW.md.
  CR-01 / CR-02 / CR-03 / CR-08 were closed by Phase 253 and were NOT re-verified.
  Plus a bounded fresh pass over code committed after 2026-09-16T18:30:00Z.
files_reviewed: 11
files_reviewed_list:
  - frontend/src/components/panel/PhaseTimeline.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/panel/phaseStatusMeta.ts
  - frontend/src/components/sources/WatchRowCard.tsx
  - frontend/src/components/sources/WatchedFoldersSection.tsx
  - frontend/src/components/sources/sourceHealthVocabulary.ts
  - frontend/src/components/sources/__tests__/WatchRowCard.test.tsx
  - frontend/src/components/sources/bug260912AppCredentials.test.ts
  - backend/app/api/connectors.py
  - scripts/vitest-count-gate.cjs
  - .github/workflows/backend-tests.yml
findings:
  critical: 2
  warning: 9
  info: 0
  total: 11
verdicts:
  still_live: 10
  fixed_since: 0
  refuted: 0
status: issues_found
---

# Phase 252 — R2: live-or-fixed verdict on the ten open findings

**Reviewed at HEAD:** `7a5563cf5`
**Method:** every verdict driven against the code as it is today. Four findings were reproduced
by mounting the real components in vitest; the rest were established by reading HEAD plus
`git log` on the exact file.

⛔ **This is NOT a re-review of Phase 252.** `CR-01`, `CR-02`, `CR-03` and `CR-08` were closed by
Phase 253 and were deliberately not re-verified here; `252-REVIEW.md` remains the provenance
document the ROADMAP cites.

---

## 1. The ten verdicts

| id | One-line | **Verdict** | How it was established |
|---|---|---|---|
| **CR-04** | `PhaseTimeline` can call a *live* run finished while its frame is stale | ⛔ **STILL LIVE** | **Driven.** Mounted `PhaseTimeline` with a resolved `run_status:"completed"` frame, then flipped the slice to `running` with the next `getThreadWorkflow` deferred → the card rendered `No outcome`. The pre-flip control asserted the string was **absent**, so the case is not vacuous. |
| **CR-05** | An interrupted phase card becomes permanently un-expandable | ⛔ **STILL LIVE** | **Driven.** `<PhaseCard status="running" runLive={false}/>` → `regionHidden: true`, `aria-expanded: "false"`, whole card text = `"gather⊣No outcome"`; a `userEvent.click` on the header changed nothing. Matched control `runLive={undefined}` → `regionHidden: false`, `aria-expanded: "true"`, full body rendered. |
| **CR-06** | The queued sync sentence renders TWICE on the same card | ⛔ **STILL LIVE** | **Driven.** Mounted `WatchRowCard` with the parent's real behaviour (`pendingSays` set **and** `onSyncNow` resolving `{kind:"queued", says}`) → occurrence count of `Asked · next check within 60 seconds` in the rendered card = **2**, adjacent. |
| **CR-07** | Moving the refusal into the actions toolbar hides it on `degraded` rows | ⛔ **STILL LIVE** | **Driven, with a matched pair.** `state:"degraded"` + `refusal` → `sources-refusal` element **absent**, refusal text **absent**. Same props at `state:"healthy"` → both **present**. |
| **CR-09** | A refused DCR registration orphans a client at the remote server; every retry mints another | ⛔ **STILL LIVE** | Read at HEAD. `connectors.py:1327-1372` unchanged: `register_client` still runs before validation, the 422 arm persists nothing, logs no orphan id and sets no marker, so `if not client_id and probe.registration_endpoint` is re-entered on every retry. Last commit on the file is 252's own `78cddb5cd`. |
| **CR-10** | The new `WatchRowCard` suite casts its most important contract to `never`; its default stub returns a value the type forbids | ⛔ **STILL LIVE** | Verified at HEAD: `:94` `onSyncNow?: (w: ConnectorWatch) => unknown`, `:97` `vi.fn().mockResolvedValue(undefined)`, `:109` `onSyncNow={onSyncNow as never}`. File untouched since `9f652cc8f` (252-03). |
| **CR-11** | `bug260912AppCredentials.test.ts`'s occurrence pin re-baselined 4 → 5 while the suite runs in neither count-gate knob | ⛔ **STILL LIVE** | Verified in **both** knobs: `grep -n "bug260912AppCredentials" scripts/vitest-count-gate.cjs` → **one hit, and it is a comment** (`:5248`, the 252-05 decline note). Absent from TARGETS and from BASELINE. The suite itself still passes 14/14, so the pins are correct — and still unguarded. |
| **CR-12** | A rejected sync falls back to a sentence claiming the *source* stopped | ⛔ **STILL LIVE** | Read at HEAD. `WatchRowCard.tsx:304` still `err?.message \|\| UNKNOWN_SOURCE_FAILURE_SENTENCE`; `sourceHealthVocabulary.ts:104` still `"It stopped, and no reason was recorded."` No `askFailed` row was added. |
| **CR-13** | `PhaseCard`'s `runLive` docblock contradicts its only call site | ⛔ **STILL LIVE, and it is TWO files, not one** | Read at HEAD. `PhaseCard.tsx:417-419` still says `undefined` covers *"a mount before the frame resolves"*; `PhaseTimeline.tsx:394` still passes `runLive={!runTerminal}`, a boolean at every instant. **Newly measured:** `phaseStatusMeta.ts:283-284` carries the same false sentence in stronger form — *"`PhaseTimeline` passes `undefined` before its frame fetch resolves"*. |
| **CR-14** | The second caller of `store_oauth_client_credentials` swallows the new named exception | ⛔ **STILL LIVE** | Read at HEAD. `connectors.py:1565-1578` still a bare `except Exception: logger.warning(...)` with no `ConnectorClientIdRefused` arm. The mitigating annotation is also unchanged — `models/connector.py:600` still types `custom_client_id: CustomClientId \| None`. |

**Score: 10 STILL LIVE · 0 FIXED SINCE · 0 REFUTED.**

**Why nothing was fixed incidentally, stated as a measurement rather than an impression.**
`git log --since=2026-09-16T18:30:00Z --name-only -- . ':!.planning/' ':!*.md'` returns exactly
eleven paths, and **every one of them is Phase 253's own deliverable** (the ACL parity gate, the
greenfield privileges harness, the supplement, `full-schema.sql`, the two CI workflows, the hook,
and three `test_253_*` suites). Not one of the ten findings' files appears. Per-file `git log`
confirms it individually: `PhaseTimeline.tsx` and `PhaseCard.tsx` are last touched by `448d03dbc`
(252-04), `WatchRowCard.tsx` by `d1850cb67` (252-03), `connectors.py` by `78cddb5cd` (252-02),
`WatchRowCard.test.tsx` by `9f652cc8f` (252-03). **The 191 pushed commits and the `/gsd:fast`
fixes moved none of this code.**

### Drive evidence, verbatim

Two throwaway probe suites were created inside the frontend tree, run, and deleted; both were
untracked and **no tracked file was mutated** (`git status --short` at the end of this review is
byte-identical to its state at the start: `.claude/settings.local.json`, the 236 roster report and
one untracked screenshot — all pre-existing).

```
CR-05  {"before":{"buttons":1,"regionPresent":true,"regionHidden":true,"ariaExpanded":"false",
        "text":"gather⊣No outcome"},
        "after": {"buttons":1,"regionPresent":true,"regionHidden":true,"ariaExpanded":"false",
        "text":"gather⊣No outcome"}}          ← after a real click on the header
CR-05  control (runLive undefined):
       {"buttons":1,"regionPresent":true,"regionHidden":false,"ariaExpanded":"true",
        "text":"Phase 1· AI agent stepgather●RunningAn AI agent using allowed tools, looping
        until done.Working"}
CR-06  {"sentence":"Asked · next check within 60 seconds","count":2,
        "text":"Invoices● Connected●ReadingWork Drive→Finance|checked every 30 minutes
        Asked · next check within 60 secondsAsked · next check within 60 secondsSync now…"}
CR-07  degraded: {"hasRefusalTestid":false,"containsRefusal":false}
CR-07  healthy : {"hasRefusalTestid":true, "containsRefusal":true}
```

⭐ **The CR-05 control is the most useful line in this report.** It shows that `runLive={false}`
does not merely change a badge — it collapses the card from a full step (`Phase 1 · AI agent step
· gather · Running · <description> · Working`) down to **eight characters**, with no way back.
Everything between those two readings is what a user loses when a run dies mid-step.

---

## 2. Severity classification of what is still live

The round-1 review used a three-tier scale (Critical / Warning / Info). This round uses the
two-tier BLOCKER / WARNING scale. **Two findings are re-graded UPWARD and the reason is the drive,
not a change of opinion:** CR-04 and CR-05 were reasoned from source in round 1 and are now
*reproduced*, and both produce demonstrably incorrect user-visible behaviour — CR-04 in direct
contradiction of the phase's own success criterion.

### BLOCKER

#### BL-01 (was CR-04) — the panel tells the user a run that started one second ago is over

**File:** `frontend/src/components/panel/PhaseTimeline.tsx:250`, `:394`
**Severity:** BLOCKER — incorrect behaviour, user-visible, reproduced.

`runTerminal` is derived from `frame`, which is only re-read *asynchronously* on a
`phaseSignature` change (`:225-228`) and is **never cleared** except on a `threadId` change
(`:196-203`). So on a second run in the same thread, the previous run's terminal `run_status`
is still in hand for the whole fetch round-trip, and `runLive={!runTerminal}` is `false` while a
phase is genuinely `running`. `statusMetaForRun("running", false)` → `INTERRUPTED_META` → `⊣ No
outcome`, no spinner, no `aria-busy`.

The docblock at `:385-390` reasons only about the **mount** case (`frame === null`, which is
safe). The **restart** case is covered by no prose and no test.

**Fix (unchanged from round 1 — it is still the honest one):** gate on frame freshness.

```ts
const [frame, setFrame] = useState<{ wf: RunFrame; sig: string } | null>(null)
// …setFrame({ wf, sig: signatureAtIssue })…
const frameFresh = frame?.sig === phaseSignature
runLive={!(frameFresh && runTerminal)}
```

Pin it with the exact case driven here: resolved `completed` frame → flip the slice to `running`
with the next `getThreadWorkflow` deferred → assert `No outcome` is **absent**.

#### BL-02 (was CR-05) — an interrupted phase card loses its entire detail region, permanently

**File:** `frontend/src/components/panel/PhaseCard.tsx:436`, `:444`, `:486-487`, `:469-474`, `:680`
**Severity:** BLOCKER — functional regression introduced by this phase, reproduced.

With `status === "running"` and `runLive === false`: `isRunning` false (`:436`), `isTerminal`
false (`:444` — it lists only `done|failed|skipped`), `forcedOpen` false (`:486`), `canToggle`
false (`:487`), `open` initialises false (`:469`) and the effect at `:473` only ever sets it true
for `isRunning || isFailed`. The body is `hidden={!open}` (`:680`) and the header click is a no-op.

Measured above: the card's whole text collapses to `gather⊣No outcome`. The step identity line,
the type sentence, the emit sub-steps, the failure block and the outputs are all unreachable —
and they **were** reachable before this phase, which the matched control proves.

⚠ Note the interaction with BL-01: during the stale-frame window a *live* card is also
un-expandable, so BL-02 makes BL-01 worse rather than being independent of it.

**Fix:**

```ts
const isInterrupted = LIVE_CLAIMING_STATUSES.has(phase.status) && runLive === false
const isTerminal = phase.status === "done" || phase.status === "failed"
  || phase.status === "skipped" || isInterrupted
```

and add the case the shipped test does not have: `runLive={false}` + `status="running"` → click
the header → assert the region loses `hidden`. The shipped assertion (`ariaDisabled !== "true"`)
passes over the whole regression, as the drive shows.

### WARNING

#### WR-01 (was CR-06) — the queued sentence renders twice, adjacently

**File:** `frontend/src/components/sources/WatchRowCard.tsx:408` and `:501-514`;
`frontend/src/components/sources/WatchedFoldersSection.tsx:299-302`

`handleSyncNow` builds `says` once and then publishes it **twice** — into `pendingAsks` (→
`pendingSays` → `outcomeLine` at `:408`) *and* as the returned `{kind:"queued", says}` (→
`syncOutcome` → `syncLine` → toolbar chip at `:501`). Measured occurrence count in the rendered
card: **2**.

The parent's own comment (`WatchedFoldersSection.tsx:296-298`) says the sentence is *"built ONCE
and used twice … so they cannot disagree"* — true about the **string**, and exactly why the
**double render** was not noticed. Not disagreeing and not duplicating are different properties.

**Fix:** one writer, one reader. Drop the `queued` arm from the card's slot (leave it rendering
`refused` / `failed` only) and let `pendingSays` carry the queued reading as it did before this
phase. Pin with `occurrences(cardText(), COPY.asked("60 seconds")) === 1`.

#### WR-02 (was CR-07) — a `degraded` row silently drops the server's own refusal

**File:** `frontend/src/components/sources/WatchRowCard.tsx:483`, `:487`, `:501`

Both the outcome line (`{!isDegraded && outcomeLine}`) and the actions toolbar that now owns the
refusal (`{!isDegraded && (…)}`) are suppressed for `state === "degraded"`. The deleted
`<p data-testid="sources-refusal">` rendered unconditionally on the card.

Driven: degraded + refusal → the refusal element and its text are both **absent**; the identical
props on a healthy row render both. The user is left with *"This source could not be read here"*
and no statement of what the server said about the click they just made.

**Fix:** render `syncLine` outside the `!isDegraded` guard — it is a statement about the last
click, not about the source's health.

#### WR-03 (was CR-09) — a refused DCR registration orphans an application, and every retry mints another

**File:** `backend/app/api/connectors.py:1327-1372`

`register_client` creates a real OAuth application at the remote authorisation server **before**
`store_oauth_client_credentials` validates the id. On refusal the route raises 422 and persists
nothing — so on the next Connect, `if not client_id and probe.registration_endpoint` is true again
and a second application is minted. Nothing is logged that would let an operator find the orphans.

This is the closest of the nine warnings to a blocker: it is reachable by any user with
connector-write permission, it creates unbounded state in **someone else's** account, and the
comment at `:1335-1338` names that exact cost as the reason the persist exists — the refusal path
re-opens it.

**Fix:** persist a *"this server's DCR output is unusable"* marker on the connection so the branch
is skipped on retry (cheapest, and it matches the refuse decision), and/or attempt RFC 7592 client
deletion when `registration_client_uri` is advertised. At minimum log the orphan **by hash** — the
value is refused precisely because it looks like a secret, so never verbatim.

#### WR-04 (was CR-10) — the new suite type-erases the one contract the phase added

**File:** `frontend/src/components/sources/__tests__/WatchRowCard.test.tsx:94`, `:97`, `:109`

`onSyncNow` is `(watch) => Promise<WatchSyncOutcome>` in the component (`WatchRowCard.tsx:195`),
declared `(w: ConnectorWatch) => unknown` in the suite, defaulted to
`mockResolvedValue(undefined)` and passed as `onSyncNow={onSyncNow as never}`. `as never` disables
all type checking on D-15's deliverable, and the default stub returns a value the union forbids —
so **no case in the file ever produces a `queued` reading**. That is precisely why the suite could
not see WR-01: my probe reproduced the duplication in a single mount the moment the stub returned
the shape the real parent returns.

**Fix:** type the override `(w: ConnectorWatch) => Promise<WatchSyncOutcome>`, drop `as never`,
default it to a real `{kind:"queued", says}` and add the occurrence case from WR-01.

#### WR-05 (was CR-11) — a hand-edited exact-count pin that no gate executes

**File:** `frontend/src/components/sources/bug260912AppCredentials.test.ts:123-140`;
`scripts/vitest-count-gate.cjs` (TARGETS and BASELINE)

**Both knobs checked**, as the task requires: the string `bug260912AppCredentials` appears once in
the gate, at `:5248`, inside the 252-05 comment that declines to adopt it. It is in **neither**
TARGETS nor BASELINE. 252-03 re-baselined its exact-equality occurrence pin `4 → 5`; had the new
number been wrong the suite would be red and nothing in CI or in the count gate would say so.

The pin is correct today — I ran the suite: **14 passed**. This is a finding about the guard.

**Fix:** add `src/components/sources/bug260912AppCredentials.test.ts` to TARGETS and a BASELINE
pin of `14` in the same commit. The stated reason for declining — that a `src/components/sources`
*directory* entry would drag in `sourceComposition.test.tsx`'s standing red — does not apply to a
single named file, and this suite is a pure `?raw` source suite with no mount.

#### WR-06 (was CR-12) — a failed sync would claim the source stopped

**File:** `frontend/src/components/sources/WatchRowCard.tsx:304`;
`frontend/src/components/sources/sourceHealthVocabulary.ts:104`

The catch arm falls back to `UNKNOWN_SOURCE_FAILURE_SENTENCE` — *"It stopped, and no reason was
recorded."* — which is the vocabulary's sentence for **a source that stopped reading**, not for a
request that failed. Unreachable today (the shipped parent never rejects, by `:298-303`'s own
measurement), so the cost is latent; the arm exists specifically for a future caller that does
reject, and that is the caller it would lie to.

**Fix:** add a `COPY.askFailed` row (*"The check could not be asked for."*) and use it here.

#### WR-07 (was CR-13) — the `runLive` prose is false in **two** files, not one

**File:** `frontend/src/components/panel/PhaseCard.tsx:417-419`; **and newly measured**
`frontend/src/components/panel/phaseStatusMeta.ts:283-284`

`PhaseTimeline.tsx:394` passes `runLive={!runTerminal}` — a boolean at every instant, `true`
before the frame resolves. Both docblocks tell the reader `undefined` is what arrives pre-fetch:
`PhaseCard` implies it (*"a mount before the frame resolves"*) and `phaseStatusMeta` states it
outright (*"`PhaseTimeline` passes `undefined` before its frame fetch resolves"*).

⚠ This is not merely cosmetic in combination with BL-01. Both files reassure a future maintainer
that the pre-fetch window is the `undefined` (safe) path. It is the `true` path — and after a
restart it is the `false` path, which is the bug. **The prose actively argues against finding
BL-01.**

**Fix:** reword both to *"`PhaseTimeline` passes a boolean derived from its frame — `true` before
the frame resolves. `undefined` is what the other callers pass."* Same commit, both files.

#### WR-08 (was CR-14) — the OAuth-authorize door still swallows the named refusal

**File:** `backend/app/api/connectors.py:1565-1578`

`ConnectorClientIdRefused` is a `ConnectorError`; this persist block catches bare
`except Exception`, logs a warning and proceeds with the value in hand. Safe **only** because
`OAuthAuthorizeRequest.custom_client_id` is annotated `CustomClientId`
(`backend/app/models/connector.py:600`, verified unchanged) — i.e. the boundary is held by an
annotation in a different file rather than by this door. The DCR door three hundred lines up
catches the exception by name and answers 422; this one does not. Two doors onto one writer with
two different behaviours is the drift that made B-3 necessary in the first place.

**Fix:** add `except connector_service.ConnectorClientIdRefused:` ahead of the generic arm and
answer 422, mirroring `:1353-1372`.

#### WR-09 (fresh pass) — see §3 below

---

## 3. Bounded fresh pass

**Scope, derived rather than assumed.** The round-1 `files_reviewed_list` (28 files) covers every
source file in the union of the five `252-0*-SUMMARY.md` `key-files` blocks; the only uncovered
entry is `CLAUDE.md`, which is documentation. So the fresh pass reduces to **code committed after
`2026-09-16T18:30:00Z`**, which is:

```
.claude/hooks/schema-acl-parity-guard.js      .github/workflows/schema-acl-parity.yml
.claude/settings.json                         .github/workflows/backend-tests.yml
scripts/check-schema-acl-parity.cjs           scripts/check-greenfield-privileges.py
scripts/full-schema-supplement.sql            supabase/full-schema.sql
backend/tests/unit/test_253_{ci_path_coverage,greenfield_sql_lexer,supplement_column_parity}.py
```

All of it is Phase 253's, and all of it has already been reviewed twice (`253-REVIEW.md`
2026-09-17T01:20Z, `253-REVIEW-R2.md`). **Three commits landed after the last of those reviews**
and are therefore the only genuinely unreviewed code in the tree: `3cedc6e51`, `71affadd1`,
`7a5563cf5`. I drove them rather than reading them:

| Driven | Result |
|---|---|
| `node scripts/check-schema-acl-parity.cjs` | exit **0** · 148 migrations · 61 function + 72 table/column tuples · **133/133 mirrored** · tail 653 lines · md5 `da9c561634d417ebd289bedf07b75f69` |
| `node scripts/check-schema-acl-parity.cjs --self-test` | exit **0** · **37/37** arms, including the two new `TUPLES:` arms (*a collapsed PARSE is a harness error* and its counterfactual *the shipped floor does NOT fire on the real tree*) |
| `pytest tests/unit/test_253_{supplement_column_parity,greenfield_sql_lexer,ci_path_coverage}.py -q` | **26 passed** |

`71affadd1` (the `MIN_ACL_TUPLES = 100` floor) is sound and its self-test additions include the
counterfactual, so the floor is proven not to fire on the real tree. I have no finding against it.

One finding stands against the CI half:

#### WR-09 — the `if: always()` that makes the must-pass fence reachable is pinned by nothing

**File:** `.github/workflows/backend-tests.yml:100-112`
**Severity:** WARNING (guard integrity — the exact defect class this phase pair exists to kill)

`7a5563cf5`'s own commit message records the shape: the `scripts/ parity fences (must pass)` step
was added without `if:`, the `Run pytest` step above it **can never succeed** (whole-suite run,
baseline 71 failures, `continue-on-error: true`), and so on run `35231275118` the fence reported
`skipped`. *A guard that cannot fire is not a guard* — shipped by the fix for that very class.

`if: always()` is now present, and **nothing holds it there.** `grep -rn "always()"` across
`backend/tests/` and `scripts/` returns zero hits; `test_253_ci_path_coverage.py`'s five tests
pin the `paths:` trigger arms and the push/pull_request asymmetry, and **none of them assert the
fence step exists, names the three suites, or carries a condition that survives a red predecessor**.
The next edit to this workflow can silently re-delete it, and the only detector is a human
noticing a `skipped` badge on a run whose predecessor step is red by design.

**Fix.** Extend `test_253_ci_path_coverage.py` with a fence over the parsed YAML asserting that
(a) a step named `scripts/ parity fences (must pass)` exists, (b) its `if:` is truthy under a
failed predecessor (`always()` / `success() || failure()`), and (c) its command names all three
`test_253_*` modules — derived from the same module set the existing tests already derive, so the
assertion cannot rot into a hard-coded list. Drive it RED by deleting the `if:` line.

Two smaller observations on the same file, recorded rather than raised as separate findings:

- `:83-89` runs `pytest tests -q` and its comment cites *"its baseline is 71 failures
  (CLAUDE.md)"*. The 71 baseline is for **`tests/unit`**, not for `tests` — the comment conflates
  two different sets. Harmless for pass/fail (the step is `continue-on-error`), but it spends up
  to 12 minutes on output nobody can read against a figure that does not describe it.
- `if: always()` also means the fence runs when `Install backend deps` failed, where
  `source venv/bin/activate` will error. That is a **false red**, not a false green, so it is the
  right side of the trade — but `success() || failure()` would separate the two.

---

## 4. What this round did NOT do

- **CR-01 / CR-02 / CR-03 / CR-08 were not re-verified.** They are recorded as closed by Phase
  253 and `252-REVIEW.md` is the provenance the ROADMAP cites verbatim.
- **No tracked file was modified.** Two probe suites were created untracked, run, and deleted;
  `git status --short` is unchanged from the start of this review.
- **No commit was made.** The orchestrator handles that.

---

_Reviewed: 2026-09-17 · HEAD `7a5563cf5`_
_Reviewer: Claude (gsd-code-reviewer), R2 re-verification round_
_Depth: standard, every verdict driven_
