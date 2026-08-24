---
phase: 190-live-connector-slice-connector-security-stretch
plan: 19
subsystem: planning-docs
tags: [phase-close, validation, sc10, roster-derivation, fence-sweep, g-7, owed-rows, honesty, conn-02, conn-03]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: "01..18"
    provides: "every RED observation, plant transcript, fence and measured baseline this document aggregates rather than re-derives — plus the deviations, deferrals and named residuals it collects"
provides:
  - "190-VALIDATION.md — filled: the 51-row per-task map, all 14 falsification rows with verbatim REDs, 7 source-fence results, the derived SC#10 roster, the G-6/D-31 driven-vs-argued report, and the collected residual register for /gsd:secure-phase"
  - "The PHASE-WIDE D-23/D-24 fence sweep — the eight files empty against BOTH candidate bases and the worktree"
  - "Four gates RE-MEASURED from the phase base commit in a throwaway worktree, never quoted"
  - "The SC#10 roster DERIVED by grouping MODEL_CAPABILITIES, with the command and its output pasted"
  - "BLOCK-190-UAT-01 — the measured artefact gap that blocks all 8 SC#10 rows, Row B and the kill-switch lived read"
  - "The REFUTATION of the inbucket opportunity, driven against the shipped guard"
  - "CONN-02 / CONN-03 settled in REQUIREMENTS.md as NOT complete, each with its closing condition"
  - "The G-7 verdict at close: clear, exit 0, zero gap-closure rounds"
affects: [190-secure-phase, 190-verify-work, v3.6-milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measure the base-commit baseline in a SPARSE throwaway worktree — then check the sparse set is complete, because an omitted directory invents phantom fixed failures"
    - "A raw failure count is not a regression baseline; the set-diff of FAILED node ids is"
    - "Prove a documentary grep-conflict MECHANICALLY: tokenize the file and assert every occurrence of the banned word is a STRING or COMMENT token"
    - "Derive a roster by grouping a registry and taking a version-tuple max — never by typing the list, so a representative cannot fall out of the registry"
    - "Verify an opportunity before writing it as fact: the cheap unblock was refuted twice, and the second refutation is the phase's own security property"

key-files:
  created:
    - .planning/phases/190-live-connector-slice-connector-security-stretch/190-19-SUMMARY.md
  modified:
    - .planning/phases/190-live-connector-slice-connector-security-stretch/190-VALIDATION.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The phase CLOSES WITH 12 UAT ROWS OWED, recorded as a DECISION in three places — the authority is CONTEXT D-30 verbatim"
  - "CONN-02 and CONN-03 are SETTLED as NOT complete, with the reason and the closing condition written out — leaving a box silently unticked is as dishonest as ticking it wrongly"
  - "VALIDATION's own claim that Row B is 'runnable today, no operator dependency' is CORRECTED on measurement: the credential half is true, the environment half is false"
  - "The inbucket opportunity is REFUTED and the refutation is the phase's own guard — send_email needs a publicly-routable TLS SMTP host, strictly larger than D-30's 'throwaway mailbox'"
  - "My own first base measurement was WRONG and is recorded with its correction rather than replaced — a corrected number nobody can re-derive is just a different assertion"
  - "The base commit is 83a93c9a (before 190-01's first commit); de122b9a was ALSO measured because six prior plans fenced against it, and the eight files are identical at both"

patterns-established:
  - "A closing plan reports PROVED / ARGUED / OWED as three separate categories at the top of the document, so a reader cannot mistake one for another"
  - "Name the ARGUED items explicitly (ARG-1..3) rather than letting an undriven claim sit inside a table of driven ones"

requirements-completed: []

# Metrics
duration: 105min
completed: 2026-08-09
---

# Phase 190 Plan 19: The Close Summary

**The phase is code complete at 19/19 plans and closes with TWELVE UAT rows OWED — stated as a
decision, never as a claim that everything ran — and the plan's own discipline caught a
measurement error in its own instrument: the first base-commit baseline omitted `supabase/` from
a sparse worktree and would have let this document claim the phase fixed eleven pre-existing
failures it never touched.**

## Performance

- **Duration:** ~105 min (dominated by four full test-suite runs: 486 s + 360 s + 303 s + 147 s)
- **Completed:** 2026-08-09
- **Tasks:** 3 — Tasks 1+2 in one commit (both author the same document), Task 3 in its own
- **Files:** 5 (1 created, 4 modified) — **682 insertions, 188 deletions, ZERO file deletions**
  (`git diff --diff-filter=D --name-only HEAD~2 HEAD` prints nothing)
- **Production source touched:** **none.** This plan writes documentation and tracking only, as
  G-7 requires of a closing round

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 + 2 | Fill VALIDATION — the phase-wide fence sweep, 14/14 falsification rows, the derived SC#10 roster | `4afd1ba7` |
| 3 | Close the phase with 12 UAT rows owed — the decision, in ROADMAP + STATE + REQUIREMENTS | `f009a2be` |

**Why Tasks 1 and 2 share a commit:** both author the same document. A hand-split would fabricate
an intermediate state this plan never meant to ship, which is the 190-17 precedent — stated here
rather than smuggled.

---

# ⭐ THE FINDING: MY OWN MEASUREMENT WAS WRONG, AND THE CORRECTION IS RECORDED RATHER THAN SUBSTITUTED

The plan's Task 1 says the baselines must be **re-measured from the phase's base commit** rather
than quoted, "because pins drift silently and this phase already met a +13 drift." That was done
in a throwaway worktree at `83a93c9a`. The first run reported:

```
221 failed, 3362 passed, 19 skipped, 5 xfailed, 9 xpassed, 1 error
```

against HEAD's `211 failed, 3575 passed`. Read at face value that is **"the phase fixed 10
pre-existing failures"** — a flattering claim, and false.

**The set-diff exposed it.** Eleven failures "disappeared", and they clustered suspiciously:
`test_061_runs_table::test_rls_policy_present_in_full_schema`, `test_098_schema_lock`,
`test_141_run_scope::test_migration_092_additive_nullable`, three `test_harness_templates`
migration tests, `test_workspace_template`, and three `test_audit_event_registration` G2 tests.
**Every one reads `supabase/full-schema.sql` or `supabase/migrations/`.** And:

```
$ ls C:/Users/.../b190base/supabase
ls: cannot access '.../b190base/supabase': No such file or directory
```

The worktree was **sparse** (`backend scripts frontend`) — I had omitted `supabase/` myself, so
those tests failed on **my checkout**, not on the base commit. The instrument was broken, not the
base.

**Fixed rather than caveated.** `git sparse-checkout set backend scripts frontend supabase`, run
repeated:

| | failures | passes | "gone" list |
|---|---|---|---|
| first (sparse, no `supabase/`) | **221** | 3362 | 11 — **phantom** |
| corrected (with `supabase/`) | **211** | 3372 | **0** |
| HEAD | **211** | **3575** | — |

**Failures UNCHANGED at 211. Passes +203.** Both numbers are in `190-VALIDATION.md` so the
correction is auditable — a corrected number nobody can re-derive is just a different assertion.

**The one honest caveat on "zero new failures":** the set-diff shows **two** new ERRORs, both in
`tests/integration/test_114_explain_index.py`. Attribution was measured, not argued:

- the phase **never opened the file** — `git diff --name-only 83a93c9a HEAD -- backend/tests/`
  lists 17 files and that is not one;
- **both its tests pass in isolation, twice in a row** (`2 passed` · `2 passed`);
- the *first* base run had a **different** test in the *same* file failing, so the file swaps
  which case fails between whole-suite runs.

A live-DB `EXPLAIN`-plan test whose verdict depends on planner statistics. **Flaky, untouched,
named** — not absorbed into a round number.

---

# ⭐ THE SC#10 SCOREBOARD: 8 ROWS, ALL ⛔, NONE OMITTED — AND THE BLOCK IS MEASURED

The roster is **DERIVED**, with the command and its output pasted above the table so the next
reader re-derives rather than trusts:

```
TOTAL model ids: 61   providers: 8
anthropic  claude-sonnet-5   n=7   native_tools=True   emit_tier=force
deepseek   deepseek-v4-pro   n=2   native_tools=True   emit_tier=force
google     gemini-3.5-flash  n=7   native_tools=True   emit_tier=force
minimax    MiniMax-M3        n=8   native_tools=True   emit_tier=force
moonshot   kimi-k2.6         n=3   native_tools=True   emit_tier=coerce
openai     gpt-5.6-terra     n=17  native_tools=True   emit_tier=force_strict
openrouter z-ai/glm-5.2      n=9   native_tools=False  emit_tier=force
zhipu      glm-5.2           n=8   native_tools=True   emit_tier=force
```

Each representative is a **key of the registry** by construction (grouped, then a version-tuple
max), so none can resolve `capability_source=inferred` and silently lose `emit_tier` — the
SEED-040 / SEED-135 trap the plan names.

**All eight rows are ⛔ with a named reason and the blocking id `BLOCK-190-UAT-01`. None is
dropped.** *A scoreboard that lists only what passed is not a scoreboard.*

**The block was MEASURED at close against the live database, not assumed:**

```
connector_connections rows                          → 0
published defs containing an external_action phase  → 0
ANY def (any status) containing one                 → (no rows)
app_settings.feature_visibility                     → live_connectors ABSENT ⇒ cold default "off"
```

Every SC#10 row is defined as *a published workflow containing an `external_action` step, run
end to end*. **That artefact does not exist anywhere in the database.** The chain each row needs
is three links long and none exists: (1) an `external_action` step authored and published,
(2) a bound connection — and the create endpoint is gated on (3) `live_connectors` turned ON,
which is an **operator** action by design (D-26/D-25) with still no Control Room card
(`D-190-DEF-09`).

**Why this plan did not simply build them, stated as a decision rather than an inability.**
Authoring a workflow, publishing it and flipping a platform-wide kill-switch are not
measurements — they are new artefacts and a **global setting change in the operator's live
environment**. CLAUDE.md's own scoreboard recipe praises the Phase-185 method precisely because
it *"scores the whole board without mutating any global setting, so the operator's environment is
untouched"*. G-7 and D-32 additionally forbid a closing documentation plan from shipping new
surface.

**What is already proved without these rows, and what is not:** the connector layer is
provider-agnostic by construction — `_adapter_args` is a closed two-column projection and no
adapter reads a model or a provider. What the eight rows would prove is that the **surrounding
run** is provider-correct, which is a harness property. That is why they are ⛔ rather than fatal.

---

# ⭐ THE INBUCKET OPPORTUNITY WAS VERIFIED BEFORE BEING WRITTEN — AND IT IS REFUTED TWICE

The brief flagged `supabase_inbucket` as a possible `send_email` destination needing no operator
provisioning, and said explicitly: **verify that claim before writing it as fact.** Verified. It
does not hold, for two independent reasons.

**1. There is no reachable SMTP listener.** The web UI answers, the mail port does not:

```
http://127.0.0.1:54324/  → HTTP 200          port 54325 → ConnectionRefusedError
port 2500  → ConnectionRefusedError          port 1025  → ConnectionRefusedError
port 54327 → TCP opens, NO banner, EHLO times out (SMTPServerDisconnected)
$ netstat -ano | grep LISTENING | grep ':543..'   →  54321 54322 54323 54324 54327  only
```

**2. And the stronger reason — `egress.py` refuses it, BY DESIGN.** Driven against the shipped
guard rather than argued:

```
smtp://127.0.0.1           → REFUSED reason_code=scheme_not_tls
smtps://127.0.0.1          → REFUSED reason_code=address_not_public
smtp+starttls://127.0.0.1  → REFUSED reason_code=address_not_public
smtps://localhost          → REFUSED reason_code=host_not_allowed
```

with the audit lines reading exactly D-08's shape —
`egress refused: capability=send_email host=127.0.0.1 reason=address_not_public address=127.0.0.1`.

**Inbucket is a plaintext, loopback-only catch-all: precisely the address CONN-03 SC#2 exists to
refuse.** Using it would mean disabling the two guards this phase's headline security property
rests on.

**So D-30's `send_email` dependency is strictly LARGER than recorded — it needs a
publicly-routable SMTP host with TLS, not "a throwaway mailbox."** That enlargement is written
into VALIDATION, REQUIREMENTS and STATE rather than left to surface at UAT. *The guard refusing
the one destination that would have made the row cheap is the guard working.*

---

## The phase-wide fence sweep — verbatim

Existence sanity-checked **first at every rev** (190-05's lesson: an empty `--numstat` and a path
typo are indistinguishable). All eight resolved OK on disk, at `de122b9a` and at `83a93c9a`.

```
>>>BEGIN git diff --numstat de122b9a HEAD -- <the eight>
<<<END
>>>BEGIN git diff --numstat 83a93c9a HEAD -- <the eight>
<<<END
>>>BEGIN git diff --numstat HEAD -- <the eight>   (worktree)
<<<END
```

**All three print NOTHING.** This is the phase-wide fence — the per-plan checks were checkpoints;
this comparison against the phase's own base is the only one that catches a file opened in one
plan and closed in another. `PhaseFormPanel.tsx`'s single 189-14 gated line stays unspent-again.

**The base commit, derived rather than assumed:** `83a93c9a` (*"docs(190): planning complete — 19
plans, checker PASSED"*), the commit immediately before `31fd3c31`, plan 190-01's first commit —
derived with `git log --oneline de122b9a..31fd3c31` (17 commits). ⚠ **`de122b9a` was measured
too**, because six prior plans fenced against it; the two differ only by planning documents plus
one unrelated `/gsd:fast` (`f02b5f41`, on `WorkflowCanvas.tsx` — **not** one of the eight).

## The four gates — base vs HEAD, both measured

| Gate | Base `83a93c9a` | HEAD `a115e5a4` | Verdict |
|---|---|---|---|
| Backend suite | 211 failed · 3372 passed · 1 error | **211 failed · 3575 passed · 1 error** | failures **unchanged**, **+203** passes; set-diff **0** gone, **2** new (the untouched flake) |
| Count gate | 2727 / 2714 / 0 failed / 48 files, exit 0 | **2851 / 2838 / 0 failed / 51 files**, exit 0, `count gate OK` | drift `+13` → `+13`; this plan added **0** |
| Typecheck | **33** | **33** | unmoved. The bare form still checks **0** files |
| Frontend suite | — | **21 failed · 4686 passed (4707)**, 8 of 249 files | not a regression signal (D-190-DEF-05/-06) — **re-attributed by measurement**: running only the named rot set reproduces **21 failed**, i.e. every whole-suite failure lives in it |

**The count-gate base figures reproduce this document's own original row exactly** (2727 / 2714 /
0 / 48) — the first time in this phase a quoted baseline survived re-measurement unchanged. It is
recorded as a re-measurement, not as a citation.

**Zero installs across the whole phase** — `git diff --numstat` on `requirements.txt`,
`package.json` and `package-lock.json` prints nothing against **both** bases. The Package
Legitimacy Audit stays NOT APPLICABLE. Three vendor SDKs were deliberately refused along the way
(`slack_sdk`, a Jira SDK, any HTTP wrapper) because each would construct its own client and break
D-05 outright.

## Plant hygiene — and a criterion measured rather than gamed

`grep -rc PLANT backend/app` → **zero occurrences in every file**. `frontend/src` non-test files
→ zero. `grep -rn "PLANT-"` over both trees → nothing.

⚠ **The plan's criterion `grep -rc PLANT … → 0 for every file` is UNSATISFIABLE as literally
written**, and rather than lower-casing a word to satisfy a grep, it was proved **mechanically**:
a `tokenize` pass over all nine backend test files carrying the word reports

```
NON-STRING / NON-COMMENT `PLANT` tokens: 0
```

Every occurrence is a docstring or comment — the legibility 190-06 argued for, which a reviewer
needs in order to judge whether a RED meant anything. **Zero executable plant residue.** This is
the same criterion-conflict class recorded at 190-06, -07, -10, -11, -13, -15, -17 and -18, and
it is resolved the same way: state it, measure it, assert the property the grep was a proxy for.

## G-7, reported bugs, cloud parity — run at close

```
$ node scripts/check-gap-closure-rounds.cjs 190
  plans: 19 total · 0 gap-closure
  G-7 clear — no gap-closure plans in this phase.
  exit=0
```

The script was **read before it was run**, per the plan. Its derivation is
`max(highest explicit gap_closure_round, distinct commits adding gap plans)`; both are zero here.
Recorded verbatim so a later `--gaps` routing starts from a measured number.

`grep -rl "folded_into: 190" .planning/reported-bugs/ | wc -l` → **0**. Matches CONTEXT
`<deferred>`: BUG-260808-02 is DEFERRED-not-folded, BUG-260807-01 was swept by a `/gsd:fast`
before the phase executed (`f02b5f41`), and every other open report is out of domain.

`bash scripts/pending-cloud-migrations.sh` → **`104 → 117`**, fourteen files, confirming 190-04's
correction that both prose ranges were wrong at **both** ends. `check-deploy-drift.sh` → **PASS**.

## G-6 / D-31 — all eight conditions reported, DRIVEN distinguished from ARGUED

| # | Condition | Verdict |
|---|---|---|
| 1 | a send with no approval, or during a publish | ✅ **DRIVEN** — `httpx.AsyncClient.send was called - outbound egress attempted`, on the publish path. Plus **A4**, a second door nobody had named: a restart-stranded golden run was resumable and **would have SENT once per boot** |
| 2 | a phase reads "Complete" for a send that did not leave | ✅ **DRIVEN three times, on three vendors** — Slack `ts=None`, Jira `key=UNKNOWN`, SMTP `ok=True` over a wire carrying `Bcc: attacker@evil.com` |
| 3 | a credential in the JSONB / an SSE frame / an API response / a log | ⚠ **DRIVEN for three of four; the SSE frame is ARGUED** (ARG-1) |
| 4 | org B sends using org A's connection | ✅ **DRIVEN — the leak was REPRODUCED before it was closed** |
| 5 | a request reaches `169.254.169.254` / `127.0.0.1` / RFC1918 | ✅ **DRIVEN** — four clause deletions plus twenty logged requests to the metadata endpoint |
| 6 | the guard passes because a credential was absent | ✅ **DRIVEN, worse than predicted** — the wrong ordering raised **nothing at all** |
| 7 | a `PhaseFormPanel.tsx` / `PhaseNodeCard.tsx` diff is non-empty | ✅ **DRIVEN phase-wide by this plan** |
| 8 | one email arrives twice from one run | ⚠ **HALF DRIVEN** — at-most-once is mechanical in all three adapters (the recorder's second queued response is a SUCCESS **on purpose**); the *"arrives twice"* half needs Row A and is **OWED** |

**Six of eight fully driven, two with a named non-driven half. Nothing asserted without saying
which it is.**

### The three ARGUED items, named rather than buried

| Id | What is argued | Why it is not driven | What would close it |
|---|---|---|---|
| **ARG-1** | *no `phase_*` SSE frame carries a credential* | **No test asserts over an emitted SSE frame.** Grepping the 190 suites returns only substring hits inside the word *"assert"*. What IS driven: the response model (an **import failure**), the audit-receipt payload at any depth, the rendered DOM, the log lines | one case capturing a real `phase_recorded_not_sent` / `phase_transition` frame from an engine run and sweeping it, with a positive control |
| **ARG-2** | *any future per-run suppression flag has A4's blind spot* | the specific defect **was** driven and closed at the root, with a fence keeping the flag un-threaded; the generalisation is a design claim | nothing today — a note for the next phase adding such a flag |
| **ARG-3** | D-18's *"halts the run"* | **measured FALSE against the shipped engine** at 190-13: a failure fails the PHASE and the engine continues by its own explicit decision. At-most-once **is** shipped and grep-checked | a wording reconciliation in CONTEXT/ROADMAP — **not** unshipped work |

## Decisions Made

1. **Close with the live-send rows owed** (option 1). The authority is CONTEXT **D-30** verbatim:
   *"the phase may legitimately close with them owed — stated as a DECISION, never as a claim
   that everything ran."* Recorded in three places, naming `post_message` (Slack) as the first
   row to run — it falsifies **T13**, the likeliest shipped defect, and retires assumption **A3**
   in the same run, at the smallest setup cost of the three.
2. **CONN-02 and CONN-03 settled as NOT complete**, each with its reason and its closing
   condition written into `REQUIREMENTS.md`. CONN-03 because **its own text** names
   `/gsd:secure-phase (threats_open: 0)` and that gate has not run; CONN-02 because its word is
   *run* and no message, ticket or email has left this application. Leaving a box silently
   unticked would be as dishonest as ticking it wrongly, so the rows now say which and why.
3. **VALIDATION's own Row-B claim corrected on measurement.** *"No operator dependency —
   runnable today"* is true of its **credential** half and false of its **environment** half.
   The mechanism Row B tests **is** proved (D-17 on three axes, two real engine runs, three
   plants); the **lived read of the card word** is what is owed, and a DOM assertion is not a
   person reading a card.
4. **Both candidate base commits measured.** `83a93c9a` is the plan's definition; `de122b9a` is
   what six prior plans fenced against. Reporting only one would have left a reader unable to
   reconcile this document with the summaries.
5. **The throwaway worktree is removed and the main tree was never mutated** — `git worktree
   prune` succeeded, `git worktree list` shows only the main tree (plus one pre-existing,
   unrelated), and the `node_modules` junction was removed with the real one confirmed intact.

## Deviations from Plan

### 1. [MEASURED — the instrument, not the code] The first base baseline was wrong and is recorded with its correction

Fully described above. The plan asked for a re-measured base baseline; the first attempt used a
sparse worktree missing `supabase/` and produced 11 phantom "fixed" failures. Corrected by adding
`supabase` to the sparse set and re-running. **Both numbers are published**, because a correction
whose "before" is deleted is indistinguishable from a claim.

### 2. [RECORDED — an acceptance criterion cannot hold as written] `grep -rc PLANT` → 0 for every file

Measured: nine backend and four frontend **test** files carry the word, every occurrence prose.
Proved mechanically by tokenizer rather than by eye, and the production-source half — which is
what the criterion is a proxy for — is **zero everywhere**. Same class as 190-06's recorded
conflict; resolved the same way rather than by lower-casing a word.

### 3. [RECORDED — the checkpoint was pre-resolved, and that is stated] Task 3 did not stop for a human

Task 3 is a `checkpoint:decision` with `gate="blocking"`. The orchestrator resolved it in advance
(option 1, close-with-owed-rows) because the operator delegated this session unattended and
provided no mailbox, Jira project or Slack channel. **This is recorded as a decision with its
authority (D-30) rather than presented as an operator answer** — no human input was received.
The two rejected options are preserved in the plan for audit.

### 4. [RECORDED — a fifth file] `REQUIREMENTS.md` is not in `files_modified`

The plan's `files_modified` names VALIDATION, ROADMAP and STATE. The orchestrator's brief makes
settling CONN-02 / CONN-03 mandatory, and `REQUIREMENTS.md` is where they live. Stated rather
than smuggled; the edit annotates two traceability rows and adds one settlement section, and
marks **nothing** complete.

### 5. [RECORDED] The SDK state verbs were NOT called, and the SDK `commit` verb was not used either

`D-190-DEF-01` has five recorded occurrences this phase, the worst at 190-06 where both verbs
*reported doing nothing* while deleting 39 lines including `stopped_at` and three history blocks.
`STATE.md` was copied aside first, hand-edited per the plan-03…18 convention, and diffed
afterwards — **14 / 6, with every one of the six deletions a replacement**, keys at exactly one
each, and the history blocks **growing** 17→18 and 5→6. Commits were made with plain `git` for
the same reason and for consistency with every prior plan in this phase.

### 6. [RECORDED — a worktree that would not delete] the measurement worktree left a directory behind

`git worktree remove --force` failed with *"Invalid argument"* (the `node_modules` junction), but
`git worktree prune` succeeded and the worktree is **no longer registered**. The leftover
directory sits under `AppData/Local/Temp`, outside the watched tree. The junction was removed and
the real `frontend/node_modules` confirmed intact.

---

**Total deviations:** 1 measured instrument correction, 2 recorded criterion/checkpoint notes,
1 deliberate scope addition, 2 recorded tooling notes. **No production source touched, no package
installed, no D-32 scope-fence item approached.**

## Issues Encountered

- **A raw failure count is not a regression baseline** — 190-09 recorded this and it bit again
  here in a new costume: `221 → 211` reads as an improvement and was an artefact. The set-diff of
  FAILED node ids is the instrument; the raw count is not.
- **`git worktree add` failed on the full tree** with *"Filename too long"* on a
  `.planning/milestones/…/uat-screenshots/*.png` path, leaving a half-created worktree that was
  never registered. Solved with `--no-checkout` + `git sparse-checkout` — which then introduced
  the very error described above. Worth carrying: **a sparse checkout is a measurement decision,
  and an omitted directory is a silent one.**
- **The eight rot-file paths had to be re-derived**, not guessed: five of my eight initial paths
  did not resolve, so vitest silently ran only three files. Located with `find`, re-run, and the
  named set reproduced **21 failed** — the whole-suite figure. Attribution by measurement.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| **T-190-19-SCORE** | The roster is DERIVED by a pasted command over `MODEL_CAPABILITIES`; **8 rows, each ⛔ with a reason and a blocking id, none omitted**, and the block itself measured against the live database rather than asserted |
| **T-190-19-FENCE** | `git diff --numstat` on the eight files asserted empty against the PHASE'S OWN BASE — and against the second candidate base, and the worktree — with existence confirmed at each rev first |
| **T-190-19-PLANT** | `grep -rc PLANT` → zero in `backend/app` and in every non-test `frontend/src` file; the documentary test-file mentions proved **prose-only by tokenizer**, not by eye |
| **T-190-19-D30** | The live-send rows are ⛔ *awaiting operator-provided destination*, recorded as a DECISION in ROADMAP and STATE naming `post_message` first. **Never recorded as passed.** The dependency is additionally recorded as **larger** than D-30 stated, on measurement |
| **T-190-19-A1** | Recorded in VALIDATION § Residuals with its trigger (the first live `create_ticket` row) rather than remembered, together with A2, A3 and RESIDUAL-190-01 |
| **T-190-19-RES** | RESIDUAL-190-01 carried with its `inspect.getsource` fence **and the measured correction that its stated trigger cannot fire** — `httpx>=0.28.0` has no upper bound, so what protects the pin is that the fence runs against the *installed* library every time |
| **T-190-19-G7** | `check-gap-closure-rounds.cjs 190` run at close, verdict and derivation recorded verbatim; D-32's twelve-item fence restated as a written line in VALIDATION § H and still present in the ROADMAP Flags line |
| **T-190-SC** | `git diff --numstat <base> -- requirements.txt package.json package-lock.json` prints nothing against **both** bases; the Package Legitimacy Audit stays NOT APPLICABLE |

## Known Stubs

**None.** This plan created no code. Every section of `190-VALIDATION.md` is filled from a
recorded observation or a command run at close; no row is left as `*TBD at plan-phase*`, and the
rows that cannot be closed carry ⛔ with a named reason rather than a blank.

## Threat Flags

**None new.** No network endpoint, auth path, file access or schema was introduced — documentation
and tracking only. Two surfaces raised by earlier plans are **carried forward** rather than
flagged here: the request-time SSRF / latency-amplifier surface (190-15) and the resume-path
blind spot (190-13), both collected in VALIDATION § Residuals for `/gsd:secure-phase 190`, which
**no plan's threat register covers**.

## Cloud parity (D-22)

**Nothing new is owed by this plan.** The standing queue was re-derived rather than quoted:
**`104 → 117`** + `SECRETS_ENCRYPTION_KEY` (`bash scripts/pending-cloud-migrations.sh`, fourteen
files). Migrations **116** and **117** are in it. `check-deploy-drift.sh` → **PASS**.

⚠ **One non-code half is owed and is not a migration:** `live_connectors` is `"off"` by cold
default in **every** environment; turning it on is an operator action (`PUT /admin/visibility`)
and **there is still no Control Room card for it** (`D-190-DEF-09`). Until then every surface
this phase shipped is correctly absent everywhere — which is also half of why the UAT rows are
blocked.

## Next Phase Readiness

**Ready for `/gsd:secure-phase 190`** — mandatory, `threats_open: 0`, and the last thing standing
between CONN-03 and complete.

| Owed by | What |
|---|---|
| **`/gsd:secure-phase 190`** | The collected register is in `190-VALIDATION.md` § Residuals: RESIDUAL-190-01 (with its trigger corrected), A1, A2, A3, D-190-DEF-08's tripwired import cycle and its inherited sibling — **plus two surfaces NO plan's register covers**: the request-time SSRF / outbound-latency amplifier the credential check introduced, and the resume-path blind spot A4 exposed |
| **`/gsd:secure-phase 190`** | ⚠ The credential-header fence is **scoped and must stay scoped** — `slack_adapter.py` is exempt by name because a bearer header is that vendor's own auth; "completing" it would be RED on correct code |
| **`/gsd:verify-work 190`** | Do **not** read `npm test` as this phase's regression signal (D-190-DEF-05/-06). Use `node scripts/vitest-count-gate.cjs` (51 files, `failed 0`, 2851) plus the per-suite runs; the backend figure is **211 failed**, unchanged from the base |
| **UAT / D-30** | Twelve rows, named and prioritised in VALIDATION. **Run Slack `post_message` first.** `send_email` needs a **publicly-routable TLS SMTP host** — measured, and larger than D-30 originally recorded |
| **A `/gsd:quick`** | **D-190-DEF-09** — widen `GovernedFeature`, add the five map keys, author the `FeatureVisibility.FEATURES` card. Until it lands, the §2h banner names the right home before that home has a row in it |

**Three things not to re-litigate:** the base-baseline correction (both numbers are published and
re-derivable); the ⛔ verdicts (the block is measured against the live database, not assumed); and
the inbucket refutation (the guard refusing a loopback plaintext destination is the guard
working, and routing around it would disable the property CONN-03 exists to prove).

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| `190-VALIDATION.md` filled | `[ -f … ]` | **FOUND** |
| `190-19-SUMMARY.md` | `[ -f … ]` | **FOUND** |
| `.planning/ROADMAP.md` modified | `git diff --numstat` | **FOUND** (3 / 3 — two checkboxes + the progress row, all replacements) |
| `.planning/STATE.md` modified | `git diff --numstat` | **FOUND** (14 / 6 — every deletion a replacement; keys 1/1/1; history blocks 17→18 and 5→6) |
| `.planning/REQUIREMENTS.md` modified | `git diff --numstat` | **FOUND** (46 / 2 — two rows annotated, one settlement section added, **nothing marked complete**) |
| commit `4afd1ba7` (Tasks 1+2) | `git log --oneline --all \| grep` | **FOUND** |
| commit `f009a2be` (Task 3) | `git log --oneline --all \| grep` | **FOUND** |
| no commit deleted a file | `git diff --diff-filter=D --name-only HEAD~2 HEAD` | **empty** |
| the eight fenced files | `git diff --numstat 83a93c9a HEAD -- <8>` | **empty**, and empty against `de122b9a` too |
| ROADMAP checkbox tally | `grep -c "^- \[x\] 190-"` / `"^- \[ \] 190-"` | **19 / 0** |
| the row does not read "Complete" over owed rows | inspection | reads **`CLOSED WITH 12 UAT ROWS OWED`** |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*
