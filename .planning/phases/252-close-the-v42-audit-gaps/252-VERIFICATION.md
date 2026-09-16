---
phase: 252-close-the-v42-audit-gaps
status: complete
verification_mode: self-verified
independent_review: owed
verified_by: claude (orchestrator)
verified_at: 2026-09-16
base: 53e2435b7
head: 1ee7903f0 (+ this commit)
requirements: [CRED-01, CRED-03, CRED-04, WATCH-03, WATCH-04, WATCH-06, WATCH-07, HONEST-03, HONEST-04, MODEL-08, CRED-02]
success_criteria: 5/5
---

# Phase 252 — Verification

> ⛔ **`verification_mode: self-verified` · `independent_review: owed`, and this phase is itself a
> `DEBT-06` row.** The ROADMAP says so outright. The operator granted autonomy for *doing the work*;
> an autonomy grant is not a reviewer. ⭐ **`BUS-247` records a self-verified close that shipped two
> blockers with every gate green — which is why this phase exists at all.** A review request is
> posted to the agent bus at this close, and **`DEBT-06` is NOT ticked.**

---

## 0 · What this phase was, and what it actually found

Five green phase verifications could not see four blockers and nine warnings. Phase 252 closes them.
⭐ **Its method — re-derive every inherited claim against source before building — refuted seven
claims, three of them in its own planning documents and one of them a test that would have certified
a live credential leak as closed.**

**Every claim below was measured on the tree, not read from a record.**

---

## 1 · Success criteria — 5 of 5

### SC#1 — a greenfield deploy is not born with anon-executable SECURITY DEFINER functions ✅

| Evidence | Reading |
|---|---|
| `scripts/full-schema-supplement.sql` §6 | migration 181's ACLs mirrored; signature set `diff`-identical to the migration |
| `supabase/full-schema.sql` | same edit, **same commit**; `diff <(tail -n 433 …) …supplement.sql` → **empty**, before and after |
| `node scripts/check-schema-acl-parity.cjs` | **exit 0** — `migrations scanned: 148 · function ACLs found: 16 · mirrored: 16 (61 GRANT/REVOKE statements)` |
| `--self-test` | **exit 0 — 10/10**: both RED arms fired, the counterfactual held, a collapsed scan set exits 2 |

⭐ **The gate fired for REAL on run one, before any planted defect.** Three function ACLs outside
migration 181 were mirrored by nothing: `resize_embedding_column(integer)` (mig 177),
`create_org_with_default_dept(text,text,text)` (mig 104), `query_user_documents(text)` (mig 012).
**The first is the RPC `BUG-260911-01` found callable unauthenticated in production**, which NULLs
every vector in `document_chunks` and `skill_embeddings`. Migration 177 closed it wherever 177 ran;
**every greenfield deploy re-opened it.** That was not in the audit and not in the plan.

⭐ **And §6 alone would have been INERT for 181's Group B.** 181 omits `REVOKE … FROM PUBLIC` for the
two autofill trigger functions because migration **106** had already done it on live DBs —
`--no-privileges` loses 106's revoke too, so on a fresh database the PUBLIC grant stands and 181's
role revokes achieve nothing. 106's revokes are now inside §6.

⛔ **Still owed:** migration 181 is **not applied to cloud**. `CRED-04`'s `get_advisors(security)`
at the next promotion is what confirms it.

### SC#2 — the credential-smell path never writes the credential ✅

`e.errors(include_input=False)` at `connector_service.py`. **5 tests passing**, driven through the
real pydantic model with the assertion over `caplog.text`.

⛔ **THE PLAN'S OWN PROBE WAS A FALSE GREEN, and this is the phase's sharpest finding.** The plan
mandated a secret shaped `sk-live-…`. Driven verbatim, **the leak assertion PASSED before the fix**:
`backend/app/services/logging_sink.py:84` carries `re.compile(r"sk-[A-Za-z0-9_\-]{6,}")` and
`_RedactingFilter` clears `record.args`, sitting first in the root handler list. Measured:

| Probe shape | Pre-fix occurrences |
|---|---|
| `sk-` prefix (the plan's) | **0** — redacted |
| Entra `~` shape | **5** |
| `secret_` prefix | **5** |
| `len > 128` | 0 — pydantic truncation, an accident not a fence |

**The leak was real regardless:** the redactor knows **4** shapes, the validator refuses **13
prefixes + `~` + len>128**, and the sink is **opt-in** — with `LOG_FILE_PATH` unset there is no
filter at all and `sk-` leaks five times too. The suite now drives two shapes outside the redactor.
**The audit's "six occurrences" was five**, confirmed twice.

**The sibling sweep (D-10) ran and is reported both ways.** The plan's grep was *structurally
incapable of matching* (`grep -r -A 6` prefixes context lines, defeating the anchor); replaced with
an AST walk over **104** logger-with-exception sites. Exactly **one** same-class site exists:
`embedding_service.py:167` — and it carries **document text, not a credential**, so the audit's
*"the only place that writes a refused credential to disk"* **stands as stated**.

### SC#3 — a server-issued `client_id` cannot brick a connection ✅

Validation at `store_oauth_client_credentials`, the single write seam, reusing the shipped
`_validate_custom_client_id`. Refusal is a named `ConnectorClientIdRefused`; the DCR route answers
**422** without echoing the value; the degraded row now **names its repair**.

⭐ **The RED drive showed the bypass is worse than "no validation":** pre-fix the route answered
**`200 OK`** and returned `authorize_url` with the refused credential **inside the URL**.

⚠ **Corrected from the audit:** the repair path **existed structurally** —
`store_oauth_client_credentials` is an UPDATE and the BYO form's `custom_client_id` **is** validated
— it was simply **never stated**. An unnamed repair path is the same thing as none to the person
looking at it, which is why naming it was the work.

⚠ **The ordering criterion turned out VACUOUS, and it is recorded rather than quietly passed.**
Established by AST: `start_mcp_oauth` **has no generic `except ConnectorError` arm at all** (its only
`except` is the new one at `:1361`; the generic arm at `:1063` is in `discover_tools`). The trap
cannot fire here today. The arm and its comment stay, because `:1060` records it firing once already
in this file.

⛔ **G-4 scenario S2 (`McpAuthDoor` BYO-OAuth, LIVE) stays ⛔ OWED**, per D-14. Only the code-level
proof was driven — refusal + no write + a nameable repair, through the real route. The live consent
leg needs an interactive browser and a third-party account; the operator was absent by their own
instruction. **Recorded, never silently dropped.**

### SC#4 — "Sync now" says what happened ✅

`onSyncNow` returns the real outcome; **one** derived slot; the second renderer **deleted**, not
guarded. Acceptance greps on `WatchRowCard.tsx` all **0**: `0 changes`, `Synced just now`,
`{refusal &&`, `triggerWatchSync`, `isRateLimited`, `429`, `isConnectionDisabled`,
`dangerouslySetInnerHTML`.

⭐ **W-2's fix is a deletion, and the reason is measured.** No genuine rate-limit cause exists:
`backend/app/services/sources/failure_cause.py:97` maps `429` into `"unreachable"` in the same table
as 408/500/502/503/504, and the client mirror holds `\b429\b|rate ?limit|quota exceeded` in the
**same regex alternation** as timeouts and 5xx. **A 429 is indistinguishable from a 503 after
classification**, so the `Run failed (429)` reading **disappears entirely**. ⛔ **No cause was
invented to keep the string alive**, and `failure_cause.py` was not touched — its `Cause` union is
still one plain-text line.

⭐ **A finding the audit did not make, and it is why B-4 shipped:**
`frontend/src/components/sources/WatchRowCard.tsx` **had no test file at all**, and
`src/components/sources` is **not a TARGETS directory entry**. The audit noted SC#3's evidence was a
non-collapse assertion; the stronger statement is **there was no suite for that assertion to be weak
in**. The component now has one — **9 cases, every assertion over rendered content**, adopted into
**both** knobs.

### SC#5 — the panel never calls a live run finished, on either surface ✅

**Hole 1:** a new per-thread `reconcilingThreads` slice + a per-thread in-flight lock.
⛔ `loadingThreads` was **not** reused — it has a second consumer (`MessageList`'s cold-load
skeleton). Three liveness reads on **three separate `const` lines** (285/286/287); the existing
source fence **extended in place** and driven RED (`expected [1,1,+0] to deeply equal [1,1,1]`);
`check-react-hooks-rules.cjs` → `OK — no NEW violation`. Every `reconcile` exit enumerated: one clear
site by design, covering the `getSnapshot` catch (`:2082`), the loop early-return (`:2237`), normal
fall-through and any throw.

**Hole 2:** `PhaseTimeline` passes its **own already-computed `runTerminal`** down as one optional
prop — ⛔ not a second liveness derivation, which `PhaseCard`'s own docblock at `:398` warns against.
A new **quiet-terminal ROW** in `phaseStatusMeta`, ⛔ not a key in `STATUS_META` (that is
`Record<Phase["status"], …>` over a **wire type**). `git diff WorkspacePanel.tsx` → **EMPTY** (D-27),
so its three additive-sibling contracts stay true.

⭐ **Checking the prop's consumers found three ungated `phase.status === "retrying"` reads** — left
alone they would print `No outcome` beside a violet active frame and `Attempt 2` on a dead run. One
`isRetrying` derivation, three sites, a sixth test case.

**`BUG-260915-01` was corrected FIRST, touching no source** — `git diff --name-only` after that task
named exactly one path. All four cited lines verified and quoted at this commit.

---

## 2 · Warnings

| # | Disposition |
|---|---|
| W-1 | ✅ the connection pill reads the CAUSE from the vocabulary, not a one-cause binary |
| W-2 | ✅ the tautology deleted; the 429 reading removed rather than re-keyed (see SC#4) |
| W-3 | ✅ `token_revoked` names the door; verb kept, `action` unchanged, exactly three actions |
| W-4 | ✅ `POST /setup/provider-key` → 400 on refusal; the 500 arm byte-unchanged, proven by a control |
| W-5 | ✅ resolved clean at the audit — no work |
| W-6 | ✅ two `TS2556` gone; **67 → 65**, strict subset proven by a normalised `diff`, not counts |
| W-6b | ⚠ **the audit's second sentence was STALE** — the suite IS in both knobs; commit `b0dd02f28` adopted it *and* authored the errors. The **comment inside the test file** rotted, and is corrected with the original struck through |
| W-7 | ✅ pin `8 → 9`, **after the slack was EXPLOITED**: a case deleted, the gate's own comparison fed the report and printed `ConnectionGrantsList.test.tsx 8 8 0` — no `[count-decrease]` — then restored md5-identical (`d8ec1ecbd8d2fbe715a1e847f1fc3fbc` both times) |
| W-8 | ✅ `ThinkingBlock.tsx:158` cites a file that exists |
| W-9 | ✅ resolved clean at the audit — no work |

---

## 3 · Gates

| Gate | Verdict |
|---|---|
| `pytest tests/unit` | **71 failed · 4871 passed · 2 xfailed · 2 xpassed · 0 collection errors** — at the locked ceiling. ⭐ **Node-id set compared against the 71-id baseline file: identical, 0 new, 0 gone.** The `+7` passed is exactly plan 01's 2 and plan 02's 5. |
| `tsc -p tsconfig.app.json --noEmit` | **65** (base 67), `TS2556` **0**, re-run independently by the orchestrator |
| `vitest-count-gate.cjs` | **`total 8400 · failed 0 · pinned total 7660`** · `count gate OK — 288/288 pinned files present, no per-file decrease, 0 failing.` Re-run **independently by the orchestrator** on the final tree, from the repo root, `GSD_VITEST_MAX_WORKERS=2`, verdict read verbatim. See §3a for why the base reading matters more than this one. |
| `check-schema-acl-parity.cjs` | exit 0 · `16 / 16` · self-test **10/10** |
| `check-hot-file-ledger.cjs 252` | `ledger gate OK` — 281 rows · subject **31** files · watched **13** (⛔ not vacuous) |
| `check-gap-closure-rounds.cjs 252` | `G-7 clear` — 5 plans, **0** gap-closure |
| `check-seeds-register.cjs` | `gate OK` — **294/294** parsed, **0** duplicate ids |
| `check-claude-md-size.cjs` | OK — 103,481 chars, 69% of limit |

### 3a · The count gate, and a base reading that did not reproduce

⛔ **D-44a briefed this phase's base as RED** — `total 8379 · failed 2`, both failures being
`sketchComposition.test.tsx`'s §2 positive controls, SEED-171's recorded pair on its **fourth**
reproduction. **Plan 05's pre-edit run measured `failed 0` on a byte-unchanged tree**
(`git status --short frontend/src/components/library/` empty).

⭐ **That is NOT evidence the pair is fixed and it is not written up as one.** It is the inverse
sample of the one that produced D-44a. Recorded as *provably unmodified*, ⛔ never as *fine* —
**one green sample of a flaky suite proves nothing**, and this pair has now produced both colours on
identical trees.

**The criterion actually applied was the SET, not the count:** the failing set was compared by
grepping each captured run's failure lines, ⛔ never `failed 0` vs `failed 0`. **∅ before, ∅ after.
This phase added no red.** The cap held at `GSD_VITEST_MAX_WORKERS=2` on every invocation and was
never touched.

⚠ **The orchestrator then ran the gate a THIRD time, independently, on the final tree** —
`total 8400 · failed 0 · pinned total 7660 · 288/288`, matching plan 05's post reading exactly. So
the tally across this phase is **one red sample (D-44a) and three green ones**, all on a tree where
`sketchComposition.test.tsx` is byte-unchanged. ⛔ **Three greens are still not a fix**, and SEED-171
is not touched: its own record already shows cap 1 and cap 2 each producing clean *and* red runs on
byte-identical trees, and one of its suites flaking in isolation with nothing else on the box.
⭐ **What this does establish is the planning consequence:** `count gate OK` is **not reliably
reachable on demand**, so an acceptance criterion of *"the gate is green"* can fail for reasons no
plan controls — which is why every criterion in this phase was written against per-file deltas and
an explicitly-compared failing SET instead.

⚠ **Four pre-existing units of count-gate slack were surfaced by the blast radius and closed**, each
the same class as W-7 — a pin below the real count, so a deleted case keeps the gate green:
`PhaseCard.test.tsx` **14** units · `WatchedFoldersSection.test.tsx` **22** · `PhaseTimeline.test.tsx`
**3** · `sourceHealthVocabulary.test.ts` **27**. ⭐ **`WatchedFoldersSection.test.tsx` was named by
neither handover table** — found only by reading the gate's whole `actual` column.

**Arithmetic closes with residual ZERO on both totals**, which is what distinguishes growth from
drift: pinned `7660 − 7572 = 88 = 1+22+9+32+2+19+3`; grand `8400 − 8391 = 9` = `WatchRowCard` now
running.

---

## 4 · Seven inherited claims REFUTED by measurement

⭐ **The phase's method is its main output. Three of these were in its own planning documents.**

| # | Claim | Measured |
|---|---|---|
| 1 | audit: `WorkspacePanel.derived.test.tsx` *"is in neither count-gate knob"* | **In both.** The test file's **comment** rotted, not the gate |
| 2 | audit: the B-2 leak is **six** occurrences | **Five** |
| 3 | audit: a bricked connection has **no repair path** | The path **exists**; it was **unnamed** |
| 4 | **my plan**: the B-2 probe (`sk-live-…`) proves the leak | ⛔ **FALSE GREEN** — redacted before caplog; passed pre-fix |
| 5 | **my plan**: 181 has 31 REVOKEs / 17 GRANTs | **30 / 20** — the 31 counted a comment line; the 17 is arithmetically impossible |
| 6 | **my plan**: `MIN_MIGRATION_FILES = 150` | **148** files exist — a 150 floor makes the gate exit 2 **forever** |
| 7 | **my plan** (D-37): the ROADMAP 248 row *"already reads `[x]`"* | It read **`[ ]`** — the audit's correction lived in an **untracked** file, so it never reached a committed register |

⭐ **#7 is the phase in miniature.** `.planning/v4.2-MILESTONE-AUDIT.md` — this phase's own
specification — **was untracked**, so a correction inside it was invisible to git and to every later
reader. It is committed now (`ed6085464`).

⚠ **And one defect I committed myself, in this phase, of the class this phase closes.** SEED-284's
routing note said `ThinkingBlock.tsx` *"now cites THIS file"* — written at discuss-phase, **hours
before the fix existed**. A forward-looking claim in the present tense is indistinguishable to a
later reader from a measured one. Caught by 252-04's executor verifying its own citation, **not by
review**. Corrected with the original kept beside it (`5506843b7`).

⚠ **The 187-24 trap fired eight times across the phase, always on prose an author wrote while
forbidding a literal** — a `?raw` fence and a `grep` criterion cannot tell code from a comment.
Sharpest instance: a fence that strips comment lines starting with `*` is **blind to a JSX
`{/* … */}` block's continuation lines**, which read as live code. Resolution applied uniformly:
**describe, never quote**.

---

## 5 · Register sweep

- ✅ **One `BUG-260828-02`.** The **closed** workflow-input report keeps the id — **8 of its
  citations are in source and test code**, so renaming it would dangle real code; the open
  grant-override report became `BUG-260828-11`, which dangled nothing (90 citations before and
  after, every hit classified).
- ✅ **Closed with a named verifier:** `BUG-260911-01`, `BUG-260910-03`, `BUG-260913-01`,
  `BUG-260828-11`.
- ⚠ **Folded, deliberately NOT closed:** `BUG-260907-02` → 252 · `BUG-260902-06` → 249 with a
  `re_open_trigger` (249's own verifier says *"NOT MET BY MULTI-WORKER OBSERVATION"*) ·
  `BUG-260915-01` → 252, mechanism corrected. ⛔ **No report was flipped to `closed` without a
  verifier** — a wrong `closed` is worse than a stale `open`, because it stops the next reader
  looking.
- ✅ ROADMAP Phase 248 checklist row ticked (it read `[ ]` — see §4 #7).
- ⛔ **Pre-existing register debt named, not fixed:** 8 reports read `status: closed` with no
  verifier, and **two duplicate-id clusters remain** — `BUG-260528-01` resolves to **three** files
  (not the two `248-CONTEXT.md` recorded) and `BUG-260906-01` to two. **Phase 251's `REG-01` did not
  clear them.**

**Seeds:** 7 triggers fired at planning, all 7 routed into the seed. `SEED-266` moved
`planted → partially-answered` (`partial: true`) — the function-ACL half is answered; table ACLs,
`SET row_security = off` and `--no-privileges` stay open. `SEED-280` gained a **sixth and seventh**
case. **`SEED-287` planted** for the TARGETS knob class.

⚠ **SEED-280's original five were re-measured: counts identical to its 2026-08-31 table.
Sixteen days, zero drift, zero action.** A seed that names instances does not close a class.

---

## 6 · Owed, and named rather than omitted

| # | Item | Why |
|---|---|---|
| 1 | ⛔ **Independent review** | This phase is a `DEBT-06` row. Request posted to the bus; **`DEBT-06` NOT ticked** |
| 2 | ⛔ **G-4 scenario S2**, live `McpAuthDoor` BYO-OAuth | Needs an interactive browser + a third-party account; operator absent. Code-level proof driven |
| 3 | ⛔ **Migration 181 not applied to cloud** | `CRED-04`'s `get_advisors(security)` at promotion confirms it |
| 4 | ⛔ `embedding_service.py:167` | Same-class pydantic-into-the-log; **document text, not a credential**. Outside §8 |
| 5 | ⛔ `tool_dispatcher.py:970/983` | Same class at a different boundary. Named, untouched |
| 6 | ⛔ `connectors.py` extraction | **OWED, and this was its SEVENTH landing.** Honoured by construction (+28/−6, no new route, no new helper) — ⛔ an eighth must propose the extraction FIRST |
| 7 | ⛔ `bug260912AppCredentials.test.ts` in neither knob | 252-03 moved its pin while the gate could not see the file. Named in TARGETS' own comment and in SEED-280 |
| 8 | ⛔ `src/components/sources` directory entry | Declined — would adopt ~10 unpinned suites including the deliberately-red `sourceComposition.test.tsx`. **SEED-287** |
| 9 | ⛔ `BUS-246` / `BUS-247` / `BUS-248` | Operator rulings. Untouched |

---

## 7 · Verdict

**5 of 5 success criteria met. 7 of 9 warnings closed; the other two needed no work.**
Backend at its ceiling with an identical failing set. Typecheck a strict subset. Count gate green
with a ∅ failing set before and after.

⛔ **This close is `self-verified` and says so.** The phase exists because five phases closed green;
closing it on its own word would be the fourth consecutive phase to break the gate this milestone
wrote for itself.
