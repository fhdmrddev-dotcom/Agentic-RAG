---
phase: 211-the-connection-is-a-service-not-a-verb
plan: 05
subsystem: verification
tags: [sc3, fence, seam, render-gate, count-gate, hot-file-ledger, conn-04, conn-05, conn-08]

requires:
  - phase: 211-01
    provides: "the static descriptor — `name` / `title` / `description` / `inputSchema` derived from the adapter's own `INPUT_SCHEMA` — that the seam test compares against by IMPORTING the adapter"
  - phase: 211-02
    provides: "`service_id` REQUIRED on the wire, migration 127's two constraints and its §2b descriptor backfill, and the capability arm of `POST /connections/{id}/discover`"
  - phase: 211-03
    provides: "the create body that emits `service_id` on every shape and `capability` on NO shape by default — the state the SC#3 fence proves absent and the seam test creates"
  - phase: 211-04
    provides: "the split render gate (card ← boundness, list ← tools, Refresh ← audience only) and the one unscoped read — the two things the reachability suite drives"
provides:
  - "the SC#3 negative fence — a POSITIONAL source sweep of BOTH surface trees, falsified before it was trusted and driven RED against three plants in real production source"
  - "the RENDER half of the seam — a production-chain render against the four REAL row shapes, including the empty action list, RED against the pre-211-04 gate"
  - "the BACKEND half of the seam — 14 cases, 0 skips, nothing mocked on either half, against the real local Postgres"
  - "both count-gate knobs for both new suites, with WHICH knob each needed MEASURED rather than assumed"
  - "five hot-file rows and their detail sections, in the same commit"
  - "⭐ BUG-260827-01 — a cross-plan seam defect found after the plans were written, recorded with its RED and deliberately not fixed"
affects: [212, 214, 215, "the operator's /gsd:fast follow-up"]

tech-stack:
  added: []
  patterns:
    - "A verb-category fence is POSITIONAL, never lexical — it reads only the positions where a CATEGORY can be offered, so the same word surviving as an ATTRIBUTE never fires it"
    - "A source fence gains a STRUCTURAL leg beside its NAMED leg, because a name-based fence is defeated by a rename and a fence a rename defeats reads as coverage"
    - "An exemption is NAMED, closed, and proved LOAD-BEARING by its own case — an exemption whose target no longer fires is a hole with a comment over it"
    - "A seam is covered on BOTH sides and each side's docblock NAMES the other, so neither is mistaken for the whole"
    - "A found-but-unfixed defect gets a test that pins TODAY'S behaviour as the fix's RED — never a test asserting the behaviour we want, left failing"

key-files:
  created:
    - frontend/src/components/settings/__tests__/connectionVerbFence.test.ts
    - frontend/src/components/workflows/__tests__/connectionCardReachability.test.tsx
    - backend/tests/integration/test_211_service_shape_seam.py
    - .planning/reported-bugs/BUG-260827-01-service-only-connection-records-a-false-capability-mismatch.md
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/phases/211-the-connection-is-a-service-not-a-verb/211-VALIDATION.md

key-decisions:
  - "The verb fence is POSITIONAL, not lexical. SC#3 forbids the three words as a CATEGORY, and this phase's whole thesis is that the verb survives as an ATTRIBUTE — so a lexical sweep would flag `destinationFactsOf`, `CONNECTION_CAPABILITY_WORDS`, `EXTERNAL_CAPABILITY_SENTENCES` and the refusal copy, all of which legitimately carry the words. Noise is how a fence gets deleted."
  - "A STRUCTURAL leg was added beside the NAMED leg. Leg A alone (an identifier matching `…OPTIONS|CHOICES|TABS|CHIPS|FILTERS|SEGMENTS|CATEGORIES`) is defeated by renaming the constant, and MUST_FIRE case 2 drives exactly that rename. Leg A2 treats any top-level declaration with two or more labelled entries as an option set regardless of its name."
  - "ONE named exemption: `SERVICE_SUGGESTIONS`'s `{ service_id: \"smtp\", label: \"Email over SMTP\" }`. It is a SERVICE IDENTITY in a `<datalist>` beside Slack and Jira — a protocol a person types, not a category they are made to choose between. It is exempt BY NAME with a re-open trigger, and a case proves the exemption is load-bearing."
  - "⚠ `--reporter=basic` was REMOVED IN VITEST 4, so the plan's own acceptance command errors. Runs used the default reporter; the count gate uses `--reporter=json` and says so in its own comments."
  - "NO redundant TARGETS entry for `connectionCardReachability.test.tsx`. Measured, not assumed: the gate printed it as `— 10 new` before any knob was turned, because `src/components/workflows` is already a DIRECTORY entry. A file-level line beside a covering directory entry would state a dependency that is not real, which this script's own 189-14 block refuses in writing."
  - "The seam test calls the REAL route handlers as functions with real dependency VALUES rather than driving the ASGI stack. The ASGI dependency stack is named as OUT of the path, and the one property it would have carried — the column GRANT — is measured instead with the only instrument that can see it: a `SET LOCAL ROLE authenticated` Postgres session. A service-role client bypasses both the grant and RLS, so a 200 through one would have proved nothing about it."
  - "`app.dependencies._supabase` is pointed at the REAL local Supabase for the seam test's lifetime. That is not a mock: `backend/tests/conftest.py:10` sets `SUPABASE_URL=https://test.supabase.co` before any app import, and `connector_service._fetch_connection_row` uses the SINGLETON — so passing a good client into the handlers alone would still have gone to an unresolvable host. Restored in teardown."
  - "⭐ `phase_types.py` is NOT edited. The seam defect is recorded in VALIDATION.md, filed as BUG-260827-01 with `status: open`, and given its RED in the seam test's §7 — which asserts TODAY'S behaviour including the wrong sentence."
  - "The G-4 checkpoint was NOT auto-approved. Auto-mode auto-approves `checkpoint:human-verify`, but writing an unobserved verdict onto a lived-experience board is the over-claiming this phase is about. The phase closes with owed manual rows, stated as a DECISION."

metrics:
  duration: ~2h
  tasks: 2 of 3 (Task 3 is a blocking human-verify checkpoint)
  commits: 3
  completed: 2026-08-27

requirements-completed: [CONN-04, CONN-05, CONN-08]
---

# Phase 211 Plan 05: Prove the Two Absences, Pay the Bookkeeping Summary

**Both absences this phase claims are now proved by fences that were falsified before they were
trusted — no verb category anywhere in either surface tree, and no unreachable card on any of the
four real row shapes — the backend↔database seam is driven with nothing mocked on either half,
and the one thing none of it could see was found by reading the merged tree: a cross-plan seam
defect that makes a service-only connection tell a run something that is not true.**

## Performance

- **Duration:** ~2 h
- **Tasks:** 2 of 3 executed; **Task 3 is a blocking `checkpoint:human-verify` and is NOT approved**
- **Files created:** 4 · **Files modified:** 4
- **Commits:** 3

## Commits

| Task | Commit | Subject |
| --- | --- | --- |
| 1 | `720ae68b` | `test(211-05): the SC#3 verb fence, the render half of the seam, and both gate knobs` |
| 2 | `f4e60008` | `test(211-05): the backend half of the seam, five ledger rows, and the seam defect recorded` |
| — | *(this file)* | `docs(211-05): validation results, the owed rows, and the seam defect` |

---

## Gate numbers, verbatim

**The count gate, from the REPO ROOT, verdict line read verbatim rather than summarised — and
IDENTICAL on two consecutive runs:**

```
  connectionVerbFence.test.ts                  21      21       0
  connectionCardReachability.test.tsx          10      10       0
  total                                      5211    5829    +618
  total 5829  ·  failed 0  ·  pinned total 5211
count gate OK — 116/116 pinned files present, no per-file decrease, 0 failing.
```

**Both pins are met EXACTLY (21/21, 10/10) and no existing pin moved in either direction.**

⚠ **THE GRAND TOTAL GREW AND THAT IS THE GATE WORKING** — its contract is *no per-file DECREASE*
and *zero failing*, never a fixed total. Fully attributable, with no residual:

| step | total | delta | cause |
| --- | ---: | ---: | --- |
| the orchestrator's measurement of the merged base | 5798 | — | — |
| after `connectionCardReachability.test.tsx` existed (no knob turned yet) | **5808** | +10 | it already RAN under the `src/components/workflows` directory entry |
| after `connectionVerbFence.test.ts` was added to TARGETS | **5829** | +21 | it ran for the first time |

**`git diff scripts/vitest-count-gate.cjs | grep -E "^-" | grep -v "^---"` prints NOTHING.**
Additions only; no pin was raised and none was lowered, so the lowering-with-named-deletions
escape hatch was not needed and is not claimed.

**Typecheck (`-p tsconfig.app.json` — the flag is load-bearing; a bare `--noEmit` checks ZERO
files):** **34**, the exact pre-phase baseline, and

```
npx tsc --noEmit -p tsconfig.app.json | grep -E "error TS" | grep -iE "connectionVerbFence|connectionCardReachability"
```

prints nothing — not one of the 34 comes from either new file.

**Backend unit suite:**

```
68 failed, 2778 passed, 2 xfailed, 2 xpassed, 32 warnings in 70.24s (0:01:10)
```

**68 is the rot baseline exactly.** No new failing FILE: the failures are
`retrieval_service` 15 · `sql_service` 12 · `explorer_agent` 6 · `multimodal_query` 5 ·
`reembed_kickoff` 4 · `sandbox_service` 3 · `lifespan` 3 · `db_runs` 3 and a long tail of ones and
twos. **Nothing connector-, harness- or 211-related is in the set.** (Passed grew 2680 → 2778 as
the phase's own tests landed.)

**The seam test — it RAN; it did not skip:**

```
14 passed, 11 warnings in 4.62s
```

**`test_migration_127.py` — the owed transition, DONE.** Run by the operator on the main working
tree, 2026-08-27, verbatim:

```
..........                                                               [100%]
10 passed, 1 warning in 0.48s
```

`3 passed, 7 skipped` → **`10 passed, 0 skipped`**. The seven live-DB cases now execute, including
both negative controls. ⭐ That pair is what makes SC#4's green mean *"the constraint was
REPLACED"* rather than *"the constraint was DELETED"*.

**CLAUDE.md size gate:**

```
  CLAUDE.md                                   84775 chars   56.5% of limit  headroom   65225  [OK]

claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

Exit 0. No `[disposition-too-long]`, no `[duplicate-row]`, no `[malformed-row]`. The phase's
baseline was 83,431; the four new rows plus three corrections cost **+1,344 chars**, and every
reason went to `docs/HOT-FILE-LEDGER.md` instead.

---

## Task 1 — the two fences (`720ae68b`)

### (a) The SC#3 verb fence — POSITIONAL, and falsified before it was trusted

**The design decision that matters:** SC#3 forbids *Message / Ticket / Email* **as a category**,
and this phase's whole thesis (SEED-207) is that the verb survives as an **attribute**. A lexical
sweep of the two trees would therefore flag `destinationFactsOf`'s per-row prose,
`CONNECTION_CAPABILITY_WORDS`'s three lowercase nouns, `EXTERNAL_CAPABILITY_SENTENCES`'s node-face
readings and `connectionRefusalCopy.ts`'s closed negation table — **all of them correct, shipped
and reviewed.** A fence that flags English produces noise, and noise is how a fence gets deleted
(T-211-24). So the matcher reads only the four POSITIONS in which a category can be offered:

| leg | what it reads |
| --- | --- |
| **A · named set** | a `label`/`title`/`chip`/`tab`/`option`/`name` string literal inside a top-level declaration whose IDENTIFIER declares it a set of selectable things (`…OPTIONS`, `…CHOICES`, `…TABS`, `…CHIPS`, `…FILTERS`, `…SEGMENTS`, `…CATEGORIES`) |
| **A2 · structural** | the same, in any top-level declaration carrying TWO OR MORE labelled entries, **whatever it is called** |
| **B · aria role** | the text child of an element carrying `role="radio"` / `"tab"` / `"option"` |
| **C · native option** | the literal text child of an `<option>` element |

⚠ **LEG A2 EXISTS BECAUSE LEG A IS DEFEATED BY A RENAME, and MUST-FIRE case 2 drives exactly that
rename.** A fence a rename defeats reads as coverage.

**Falsified FIRST, on synthetic input, before the tree was walked** — the discipline
`ExternalActionSection.test.tsx` §7 records:

- **5 MUST-FIRE controls**, each a shape of a control this phase deleted: a three-verb chooser
  declared as `…_CHOICES`; **the same set RENAMED** so only leg A2 can see it; a
  `<button role="radio">Creates a ticket</button>`; a `<div role="tab">Email</div>`; a native
  `<option value="post_message">Message</option>`.
- **6 MUST-NOT-FIRE controls**, each quoted from real shipped code:
  `CONNECTIONS_READ_ONLY_BANNER` (which names all three as consequences),
  `CHECK_NEGATION_BY_CAPABILITY`, `capabilityWordOf`, `CONNECTION_CAPABILITY_WORDS`,
  `EXTERNAL_CAPABILITY_SENTENCES`, and a `role="status"` live region.
- **A non-vacuity case over the controls themselves**: every control must actually CONTAIN a
  category word, or a matcher that had silently stopped working would make them all green forever.

⚠ **ONE MUST-NOT-FIRE CONTROL CARRIES NO CATEGORY WORD AND IS MARKED `carriesWord: false`, WITH
ITS REASON.** `CONNECTIONS_FILTER_CHIPS` (All / Connected / Not connected) is there to prove a
REAL selectable set is inspected and silent — a different job. **The first draft asserted the word
was present in every control and went RED on exactly that row**, which is the non-vacuity case
doing its job on its own author. The escape hatch is asserted to be exactly one row wide.

**Then driven RED against three plants in REAL production source**, one per leg, each reporting a
work item rather than a boolean, each file restored **md5-identical**:

```
"/src/components/settings/connectionsCopy.ts:161 [named-set] CONNECTIONS_FILTER_CHIPS · label: \"Email\""
"/src/components/workflows/ExternalActionSection.tsx:161 [aria-role] Creates a ticket"
"/src/components/settings/ConnectionFormPanel.tsx:1063 [native-option] Message"
```

md5 before/after, all three identical: `connectionsCopy.ts` `2490e9a4…`,
`ExternalActionSection.tsx` `e57611af…`, `ConnectionFormPanel.tsx` `45873cf3…`.

**Non-vacuity on three independent floors**, because an absence proved over nothing is free:

1. **117 non-test source files** across both trees (floor pinned at > 90, with each tree floored
   separately — one combined count cannot show that both are present).
2. **Six named files were READ with real content**, including `ConnectionFormPanel.tsx`,
   `ConnectionPicker.tsx`, `ExternalActionSection.tsx` and `McpToolPicker.tsx`.
3. ⭐ **The matcher really REACHED 16 selectable sets**, and
   `connectionsCopy.ts · CONNECTIONS_FILTER_CHIPS` — the Settings → Connections **filter rail**,
   which is the surface SC#3 names when it says *filtering* — is asserted by name to be among
   them.

**THE ONE EXEMPTION, and it is named rather than silent.** `SERVICE_SUGGESTIONS` carries
`{ service_id: "smtp", label: "Email over SMTP" }`, and leg A2 fires on it — correctly by its own
rule, and wrongly by SC#3's meaning. It is a **service identity** in a `<datalist>` of service
identities beside Slack and Jira: a protocol a person types, not a category they must choose
between before seeing a connection. 211-03's own record is explicit that these entries are DATA
and that nothing branches on them. So it is exempt by NAME, the exemption list is asserted to hold
exactly one entry, and **a case proves the exemption is LOAD-BEARING** by re-running the matcher
against the same source under a name the exemption cannot match and asserting the offender appears
— and that it is the ONLY thing that declaration contributes. Re-open trigger: *a second entry
being added to the list, or the list growing a reader that branches on its labels.*

**A second, stronger case** is stated separately: after 211-03 and 211-04 there is **no
`role="radio" | "tab" | "option"` anywhere in either non-test tree at all.** Stated on its own so
that a NEW radiogroup shows up as a decision to review, rather than passing silently the moment
its labels avoid three words.

### (b) ⭐ The RENDER half of the seam

`connectionCardReachability.test.tsx` — 10 cases, T3, driven through the PRODUCTION CHAIN
(`ExternalActionSection` → `ConnectionPicker` → the action card) with **only `@/lib/api` faked**
and **not one prop of the component under proof constructed anywhere**, asserted mechanically by a
static `?raw` self-import.

It does **not** duplicate `McpToolPicker.reachability.test.tsx`'s leg (b): leg (b) asks *"does the
production chain mount this component at all?"* — an EDGE question, answered once. This file asks
*"for each of the four row shapes that really sit in the database, what does the gate DO?"*

The four shapes are the REAL ones, read off the live local DB on 2026-08-26 and re-confirmed
2026-08-27 (`slack`/`post_message`/len 1, `jira`/`create_ticket`/len 1,
`mcp.deepwiki.com`/null/len 3), plus **legacy · EMPTY** — the shape that is NOT on disk today and
is the most important case in the file, because it is what every shipped row carried before
migration 127 §2b and what a failed descriptor write still produces. **A pre-populated fixture
cannot see the closed loop.**

**THE RED, VERBATIM**, driven against the pre-211-04 gate (`if (!connection?.mcp_server_url)
return null`) planted back into `McpToolPicker.tsx`:

```
 FAIL  src/components/workflows/__tests__/connectionCardReachability.test.tsx > 211-05 · the render gate, against the REAL row shapes (D-211-12 / T-211-22b) > ⭐ CASE 1 · LEGACY + EMPTY — the card, the in-words empty state AND an enabled Refresh
TestingLibraryElementError: Unable to find an element by: [data-testid="mcp-tool-picker"]
 ❯ src/components/workflows/__tests__/connectionCardReachability.test.tsx:243:19
    241|     await bindRow(LEGACY_EMPTY.id)
    242|
    243|     expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
       |                   ^

 Test Files  1 failed (1)
      Tests  4 failed | 6 passed (10)
```

⭐ **THE RED IS DISCRIMINATING, NOT BLANKET, AND THAT IS THE PART TO READ.** Four cases failed —
legacy·empty, legacy·populated, service-only, and the dismount control — while **CASE 3 (MCP ·
empty) correctly still PASSED**, because the old gate served the MCP shape and only that shape.
A blanket RED would have proved the plant broke something; this one proves it broke exactly the
thing the phase fixed. `McpToolPicker.tsx` restored md5-identical (`6b63c3ca…` before and after).

Two negative controls, because every case above would otherwise be satisfied by a card that
renders unconditionally: nothing bound → nothing rendered; and the card is **dismounted** when the
binding is cleared.

### (c) Both gate knobs — and WHICH knob each file needed was MEASURED

⚠ **THE PLAN'S PREMISE WAS WRONG BY ONE ENTRY, AND MEASURING IS WHAT CAUGHT IT.** `211-VALIDATION.md`'s
Wave-0 list says *"Two new files this phase, so four entries."* The gate was run with both files on
disk and green **before either knob was turned**, and its own printed file list settled it:

- `connectionCardReachability.test.tsx` printed as **`— 10 new`**. It already RAN, under the
  `src/components/workflows` DIRECTORY entry. It needed a PIN and nothing else.
- `connectionVerbFence.test.ts` was **absent from the printed list entirely** —
  `src/components/settings`'s three existing entries are all FILE-LEVEL, so a fourth file there is
  reached by none of them. It needed BOTH.

**Three entries, not four.** A redundant file-level TARGETS line beside a covering directory entry
would state a dependency that is not real, which this script's own 189-14 block refuses in
writing, and the measurement is recorded beside both new lines.

⚠ **The plan's acceptance criterion is `grep -c … == 2` for each file; the measured counts are 6
and 5.** Both knobs are present — that is the property — and the surplus is the house discipline's
own requirement that the measured reasoning NAME the file it is about. Recorded rather than
trimmed, because trimming the record to satisfy a count is how a measurement becomes a claim.

---

## Task 2 — the backend half, and the bookkeeping (`f4e60008`)

### (a) The seam test — 14 passed, 0 skipped, nothing mocked on either half

**It RAN. It did not skip.** Both skip conditions (Postgres unreachable, migration 127 unapplied)
were live and neither fired.

| § | What it drives |
| --- | --- |
| 1 | a SERVICE-ONLY row created through the real `POST` handler and read back through the real `GET` — one call crossing 211-02's model arm, its row dict, migration 127's two constraints and the column projection. Plus its NEGATIVE CONTROL (a blank identity is still refused), without which the case proves only that the OLD guarantee was DELETED |
| 2 | a capability row advertises exactly its own action, with `inputSchema.required` compared against the adapter's `INPUT_SCHEMA["required"]` **by importing the adapter**, never a literal; both `post_message` and `create_ticket` |
| 3 | the ambiguous body refused **twice** — at the model AND by the database (SQLSTATE `23514` plus the constraint's NAME). Two separate assertions, because one passing does not imply the other: the model is the API's gate, the CHECK is the gate for every writer that is not the API |
| 4 | ⭐ the §2b backfill read from the LIVE rows — every `capability IS NOT NULL` row has `jsonb_array_length(discovered_tools) = 1` with `[0].name == capability`, non-vacuously (≥ 2 rows); plus the three shipped rows' `capability` byte-unchanged, per-id |
| 5 | the self-heal path — the capability arm of `/discover`, whose ONLY caller in the product is 211-04's Refresh control. ⭐ *No network call* is asserted MECHANICALLY: `mcp_client.list_tools` is replaced by a raiser. The WRITE is checked too — a refresh that returns the right list and caches nothing self-heals for exactly one render. Plus the SERVICE-ONLY third arm (`ConnectorNothingToDiscover`) |
| 6 | ⭐ the column GRANT |
| 7 | ⭐⭐ the seam defect — see below |

⭐ **THE COLUMN GRANT IS MEASURED BY THE ONLY INSTRUMENT THAT CAN SEE IT, and this is a deliberate
departure from the plan's method.** The plan says the GRANT omission "surfaces here as a 503".
It would not have: the seam test drives the handlers with a **service-role** client, and
service_role bypasses both the column grant and RLS, so a 200 through one proves nothing about
`authenticated`. §6 therefore opens a real Postgres session, takes `SET LOCAL ROLE authenticated`
and reads `service_id` + `discovered_tools` — the `test_190_secret_column_privilege.py` instrument,
pointed at the new columns. **Falsified**: a `REVOKE SELECT (service_id) … FROM authenticated`
inside a rolled-back transaction produced

```
RED as expected: 42501 permission denied for table connector_connections
```

and the grant was verified intact after the rollback.

**What is and is NOT in the path is stated in the docstring, not implied.** The ASGI dependency
stack (`require_org_manage`, `require_visible("live_connectors")`, `get_user_supabase_client`) is
named as OUT, with its two consequences handled rather than hidden.

**Database hygiene, verified rather than promised.** Every created row is deleted in a fixture
teardown that runs on failure too; every raw-SQL probe rolls back. After the run the table was
queried directly and holds **exactly the three shipped rows, unchanged**.

### ⭐⭐ (b) THE CROSS-PLAN SEAM DEFECT — `BUG-260827-01`, recorded and NOT fixed

Found by reading the merged tree at wave 4, after the plan was written. **All three sites are
correct alone; the JOIN ships the defect.**

1. `ConnectionFormPanel.tsx` (211-03) — a service-only row is **creatable**.
2. `ConnectionPicker.tsx` (211-04) — that row is **listed and bindable**.
3. `phase_types.py:2460` — `getattr(connection, "capability", capability) != capability`. The
   `getattr` DEFAULT fires only when the attribute is **MISSING**, never when its value is `None`.

So a service-only row is recorded-and-not-sent with **"the bound connection is for a different
capability"** — false. It is not a *different* capability; it is **no** capability. On the one
surface in this codebase whose entire discipline is not over-claiming.

⚠ **A MEASURED REFINEMENT OF THE REPORTED CHAIN — two arms, and they are DIFFERENT failures.**

| path | step config after the bind | what actually happens |
| --- | --- | --- |
| the shipped UI | `capability` CLEARED by `ConnectionPicker.bind`, and a service-only row advertises no action, so `tool_name` stays empty | the **closed-set guard raises `KeyError`** at `phase_types.py:~2323` — line 2460 is never reached |
| the definition / API surface | `capability: "post_message"` alongside a service-only `connection_id`; nothing cross-checks them | **line 2460 fires** and records the inaccurate sentence |

Both are real, both are pinned. Recorded so the follow-up fixes the arm it means to and does not
leave a stack-trace-shaped failure behind.

**`phase_types.py` IS NOT EDITED.** It is in no 211 plan's `files_modified`, 211-04's must_have
promises that branch stays untouched, and it is a G-5 hot file (`46 / 21 / 2627`) with no review
cycle in this phase. `git diff --numstat 5f2c7d8c HEAD -- harness.py grounding.py phase_types.py`
**prints nothing across the whole phase.**

**Its RED already exists.** §7 asserts **today's** behaviour on purpose — the condition and the
sentence pinned **separately**, so a fix that changes one without the other cannot pass — and it
keeps the genuinely-mismatched case refused, so a fix that merely widens the guard would delete a
real protection while closing a wording bug. Those cases go RED when the fix lands and are updated
in that commit. **The operator closes it via `/gsd:fast`** (~4 lines, one file, G-3 territory).

### (c) Five ledger rows, with their sections, in the same commit

⚠ **EVERY TRIPLE RE-DERIVED FROM GIT AT WAVE 4 — nothing copied forward, including from
`211-MEASUREMENTS.md` §2**, and that was the right call: §2 was captured before the phase began,
and two of its four figures were already stale by the time this plan ran.

| file | §2 (pre-phase) | **re-derived** | G-5 | buckets |
| --- | --- | --- | --- | --- |
| `backend/app/models/connector.py` | `4 / 2 / 346` | **`5 / 3 / 450`** | ⚠ **FIRES, at threshold** | `190 · 206 · 211` |
| `backend/app/services/mcp_client.py` | `2 / 2 / 367` | **`3 / 3 / 400`** | ⚠ **FIRES, at threshold** | `206 · 209 · 211` |
| `backend/app/api/connectors.py` | — | **`6 / 3 / 734`** | ⚠ **FIRES, at threshold** | `190 · 206 · 211` |
| `backend/app/services/connector_service.py` | — | **`7 / 3 / 1149`** | ⚠ **FIRES, at threshold** | `190 · 206 · 211` |
| `frontend/src/components/workflows/McpToolPicker.tsx` | — | **`3 / 3 / 645`** | ⚠ **FIRES, at threshold** | `206 · 206.2 · 211` |

⭐ **ALL FIVE CROSS THE THRESHOLD IN THIS PHASE — `211` is the third bucket in every case.**

⚠ **FOUR OF THE FIVE HAD NO ROW AT ALL**, so G-5 could never have fired on any of them at any
count. Three of the four are the *entire backend connector surface*: the model that decides which
shapes are representable, the route module that admits them, and the service that resolves
credentials for them.

⚠ **THE FIFTH HAD A ROW THAT WAS PRESENT AND WRONG — the worse state.** `McpToolPicker.tsx` read
`2 / 2 / 570 | no (2 phases) | ⚠ named inside Phase 206's section with no row of its own`, a
disposition describing the moment *before* the row existed, attached to the row that fixed it.
**The plan's own task text inherited that stale cell** and instructed this plan to *add* a row for
a file that already had one. Recorded rather than tidied away: the plan being wrong in exactly the
way this ledger predicts is the finding.

⚠ **`connector_service.py` was in a THIRD state — named inside another file's section, with no row
and a DEAD ANCHOR.** `docs/HOT-FILE-LEDGER.md:4424` already carried
`### backend/app/services/connector_service.py — Phase 206…`, whose anchor is not the one a
`CLAUDE.md` link would target. The new `##` section is what makes the link resolve.

**`phase_types.py` and `grounding.py` say it plainly rather than writing `satisfied`:**
*honoured by construction (211) — the phase moved the axis out of the UI without editing either
file*, with the empty diff quoted as evidence in the detail file, and `phase_types.py`'s cell
naming `BUG-260827-01` so the row cannot read as clean. `grep -c "phase_types.py.*satisfied"` →
**0**; same for `grounding.py`.

⚠ **`grounding.py`'s triple was the ONE row in this pass that was NOT stale** (`19 / 6 / 1311`,
unchanged). Recorded, because a re-derivation that reports only the rows it changed is not a
re-derivation.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — blocking] `--reporter=basic` does not exist in vitest 4**
- **Found during:** Task 1, first run of the fence suite.
- **Issue:** the plan's acceptance and verify commands use `--reporter=basic`, which errors with
  `Failed to load custom Reporter from basic`. `scripts/vitest-count-gate.cjs:101` already records
  the removal in its own comments.
- **Fix:** ran with the default reporter. No file changed.

**2. [Rule 3 — blocking] the seam test could not reach Supabase under pytest**
- **Found during:** Task 2, first run — `httpx.ConnectError: [Errno 11001] getaddrinfo failed` on
  five cases.
- **Issue:** `backend/tests/conftest.py:10` sets `SUPABASE_URL=https://test.supabase.co` before any
  app import so that a unit suite with no local stack can instantiate settings. A real env var
  beats `.env`, so the app's singleton client is built against a host that does not resolve.
- **Fix:** an autouse fixture points `app.dependencies._supabase` at a **real** client at the
  **real** local URL read from `backend/.env`, and restores the previous value in teardown. It
  installs no fake and intercepts no call — it undoes a test-harness default.
  ⚠ Passing a good client into the handlers alone would NOT have been enough:
  `connector_service._fetch_connection_row` uses the SINGLETON.
- **Files modified:** `backend/tests/integration/test_211_service_shape_seam.py` only.

**3. [Rule 1 — bug in my own test] the `create_ticket` fixture omitted `account_email`**
- **Fix:** supplied it. `CreateTicketConfig` is `extra='forbid'` with three required fields; the
  basic-auth username half is a NON-secret fact and lives in `config` by design (D-03 / R12).

**4. [Rule 1 — the `?raw` self-sweep trap, its SIXTH firing in this phase]**
- **Found during:** Task 1(b) — the self-fence asserting no component prop is constructed failed on
  **its own POSITIVE CONTROL string**.
- **Fix:** the needle is composed at runtime (`"<" + "Mcp" + "ToolPicker"`) and spelled nowhere,
  including in the comment that explains it — the `ownProperty.ts` discipline 211-03 recorded on
  its fourth firing.

**5. [Rule 1 — my own control was wrong, caught by my own non-vacuity case]**
- Two MUST-NOT-FIRE controls asserted a category word was present when it was not: one quoted only
  snake_case identifiers (`create_ticket` — `\bticket\b` does not match inside it), and
  `CONNECTIONS_FILTER_CHIPS` carries no category word at all *by design*.
- **Fix:** the first was replaced with real prose from `connectionRefusalCopy.ts`; the second is
  marked `carriesWord: false` with its reason, and the escape hatch is asserted to be exactly one
  row wide.

**6. [Rule 2 — missing critical record] the bug id and the reference in an already-committed file**
- `BUG-260826-06` was taken; today is 2026-08-27, so the report is `BUG-260827-01`. The reference
  inside `connectionCardReachability.test.tsx` (committed in Task 1) was corrected in Task 2's
  commit rather than left pointing at another phase's bug. Recorded because a Task-1 file moving
  in Task 2's diff should be explained, not discovered.

### Deliberate departures from the plan text

- **The column GRANT is measured role-scoped, not as a 503** — see Task 2(a). The plan's method
  could not have observed the property.
- **Three count-gate entries, not four** — see Task 1(c). Measured.
- **`McpToolPicker.tsx`'s ledger row is UPDATED, not added** — the plan's premise was stale.

---

## Known gaps

| Gap | State |
| --- | --- |
| ⭐ **`BUG-260827-01`** — a service-only connection makes a run say *"for a different capability"* | **open**, filed, recorded in `211-VALIDATION.md`, RED written. **`phase_types.py` NOT edited.** Closes via the operator's `/gsd:fast` |
| The five per-shape UAT rows + the four G-4 lived-experience checks | ⬜ **OWED — operator.** See below |
| `bash scripts/regenerate-full-schema.sh` for migration 127 | ⬜ **OWED — operator.** Needs `docker`, denied to the agent. `supabase/full-schema.sql` is **not yet regenerated** |

## Known stubs

None. No file in this plan renders UI, and no placeholder, TODO or empty-value-flowing-to-UI
pattern was introduced.

## Threat flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema
change. Its one new backend file is a test; its one new frontend surface is none.

⚠ The plan's threat register entries are all discharged: **T-211-19** (the GRANT) by §6 with its
falsification; **T-211-20** (an unwatched suite) by both knobs on both files; **T-211-22b** (a
stored shape with no renderable surface) on BOTH sides with each naming the other; **T-211-24**
(a fence that flags English) by the six MUST-NOT-FIRE controls; **T-211-25** (a lowered pin hiding
a deletion) by zero deleted lines in `vitest-count-gate.cjs`; **T-211-SC** n/a — **no package was
installed by this plan.**

---

## ⚠ Task 3 — the G-4 checkpoint is NOT approved, and that is a decision

Task 3 is `checkpoint:human-verify` with `gate="blocking"`. **Auto-mode auto-approves that type —
and it was deliberately NOT taken here.** CLAUDE.md's G-4 rule is that *no screenshot or
wire-format check substitutes for a row; G-4 requires the driven scenario*, and the executor
cannot drive a browser. Writing an unobserved verdict onto a lived-experience board would be
exactly the over-claiming this phase exists to remove from the product.

So the phase closes with **owed manual UAT rows, stated as a decision** — which CLAUDE.md's G-7
detail explicitly sanctions — with every row present, every blocked row carrying its reason, and
**row 5 named as the one to run first**. Nothing is silently omitted.

**Row 3 (SMTP · `send_email`) is ⛔ BLOCKED**: no such row exists on this box (re-confirmed
2026-08-27 — the table holds exactly `slack`, `jira`, `mcp.deepwiki.com`). The automated coverage
standing near it is named in `211-VALIDATION.md` so it is not mistaken for a substitute: the
descriptor derivation is exercised against the adapter's own `INPUT_SCHEMA`, and
`test_190_smtp_header_injection.py`'s 13 cases still guard its refusals. **Neither drives a real
send.**

---

## Self-Check: PASSED

| Claim | Verified |
| --- | --- |
| `frontend/src/components/settings/__tests__/connectionVerbFence.test.ts` | FOUND |
| `frontend/src/components/workflows/__tests__/connectionCardReachability.test.tsx` | FOUND |
| `backend/tests/integration/test_211_service_shape_seam.py` | FOUND |
| `.planning/reported-bugs/BUG-260827-01-…-false-capability-mismatch.md` | FOUND |
| commit `720ae68b` | FOUND |
| commit `f4e60008` | FOUND |
