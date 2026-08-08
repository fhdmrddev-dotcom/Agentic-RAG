# Phase 190 — Deferred Items

Out-of-scope discoveries made during execution. Append-only; each entry names a concrete
re-open trigger, per the standing project rule.

---

## D-190-DEF-01 — `.planning/STATE.md` frontmatter is not valid YAML, and was not before this phase

**Found during:** plan 190-01, while hand-repairing STATE.md after the SDK verbs corrupted it.

**Measured, not assumed.** The frontmatter fails `yaml.safe_load` at **HEAD**, before this plan
touched anything:

```
HEAD frontmatter ALREADY BROKEN: ScannerError mapping values are not allowed here
  in "<unicode string>", line 6, column 331:
     ... d by MEASUREMENT, not preference: **a remote MCP server makes th ...
```

**Cause:** several long narrative values (`last_activity`, `stopped_at`) are *unquoted* scalars
containing `: ` sequences, and the `### Previous stopped_at …` narrative blocks sit **between**
the `---` fences. YAML reads the embedded colons as mapping separators.

**Why it is not fixed here:** pre-existing, unrelated to this plan's three test files, and
repairing it means re-quoting several multi-thousand-character values in a file that six SDK
verbs are already known to rewrite destructively. That is its own change with its own blast
radius, not a line item inside a security gate.

**Consequence to be aware of:** any tool that parses this frontmatter with a real YAML parser is
either failing silently or falling back to a regex. That is a plausible contributor to the
recurring corruption — a writer that cannot parse the file it is editing will not preserve it.

**Re-open trigger:** the next time an SDK state verb corrupts `STATE.md` (it has now done so at
189-16, 190-planning and 190-01), or the first time a consumer of this frontmatter is observed
reading a wrong value. Fix as its own `/gsd:fast`, not inside a feature phase.

### ⚠ THE TRIGGER FIRED AGAIN — occurrence #4, plan 190-06 (2026-08-08)

Recorded because the trigger above asks for it, and because this occurrence is **worse than the
earlier ones in one specific way: both verbs REPORTED FAILURE and destroyed the file anyway.**

```
$ gsd-sdk query state.advance-plan
{ "error": "Cannot parse Current Plan or Total Plans in Phase from STATE.md" }
$ gsd-sdk query state.update-progress
{ "updated": false, "reason": "Progress field not found in STATE.md" }

$ git diff --numstat .planning/STATE.md
7  39  .planning/STATE.md
```

**39 lines deleted after two calls that both said they had changed nothing.** What went: the
`stopped_at` key entirely, the rich `last_activity` narrative, `status: executing` → `planning`,
`last_updated` rewound to a *stale* `18:49:07.592Z`, and **three `### Previous stopped_at` history
blocks**, replaced by a fabricated `progress:` block (`completed_plans: 147`, `percent: 52`) that
nothing measured.

**Recovered** by restoring a copy taken *before* the calls (`git diff --numstat` → empty, byte-exact
against `HEAD`) and hand-editing, per the plan-03/04/05 convention. Note also that the failing
parse is of the markdown **body** ("Current Plan or Total Plans"), not the frontmatter — so
repairing the YAML would NOT have prevented this, and might make it worse by turning a loud error
into a silent successful rewrite. Any fix must address the destructive-write path, not only the
parse.

**Standing instruction for every remaining plan in this phase:** copy `STATE.md` aside first, and
run `git diff --numstat .planning/STATE.md` after any state verb. Do not trust a verb's own report.

---

## D-190-DEF-02 — `CONN-03` deliberately NOT marked complete by plan 190-01

**Found during:** plan 190-01 state updates.

`190-01-PLAN.md` frontmatter carries `requirements: [CONN-03]`, and the executor protocol marks
those complete at plan end. **It was not marked, on purpose.**

CONN-03 requires an unconditional SSRF/egress guard, org-scoped Fernet-encrypted credentials
resolved server-side by reference, sandboxed template evaluation, a cross-org credential-leak
test, **and** `/gsd:secure-phase` with `threats_open: 0`. Plan 190-01 delivered the **drives** for
one of those and nothing else — no `egress.py`, no `connector_service.py`, no adapters, no
migrations. Checking the box now would assert a security property that does not exist, in the
one phase whose entire discipline is not over-claiming (D-31), and it is precisely the
false-completion class this plan's own RED observations exist to prevent.

This also matches the shipped project practice recorded in STATE.md for Phase 184:
*"REQUIREMENTS.md is deliberately untouched and the orchestrator marks them at phase end after
live verification."*

**Re-open trigger:** phase close — `/gsd:verify-work 190` + `/gsd:secure-phase 190` returning
`threats_open: 0`. CONN-02 and CONN-03 are marked together, then, by the orchestrator.

---

## D-190-DEF-03 — `graphify update .` not run for this plan

**Found during:** plan 190-01 close.

CLAUDE.md asks for `graphify update .` after modifying code files. This plan modified **test
files only** and its `files_modified` contract names exactly three of them; regenerating
`graphify-out/` would put a large unrelated artefact inside a security-gate commit, and
test-only changes alter no architecture the graph indexes.

**Re-open trigger:** the first plan in Phase 190 that lands production source — `190-02`
(`backend/app/security/egress.py`) is the expected one. Run it there.

**DISCHARGED at plan 190-06** (2026-08-08): `graphify update .` run after landing
`app/models/connector.py` + `app/services/connector_service.py` — *"Rebuilt: 19444 nodes, 50603
edges, 1687 communities"*, exit 0. `graphify-out/` is untracked, so the rebuild put nothing into
this plan's commits. Later plans that land production source should run it too.

---

## D-190-DEF-04 — `backend/tests/test_dual_mode_wiring.py` is ROTTED, 15 failures, all pre-existing

**Found during:** plan 190-03, while checking every consumer of the audit vocabulary after
migration 117 widened it.

**Measured, and explicitly NOT caused by this plan.** `pytest tests/test_dual_mode_wiring.py -q`
reports **15 failed, 38 passed**. The failure-reason histogram is
`32 AttributeError · 8 KeyError · 3 AssertionError · 2 ConnectError`, and the dominant one is:

```
AttributeError: <module 'app.api.threads'> does not have the attribute 'insert_run'
httpx.ConnectError: [Errno 11001] getaddrinfo failed
```

`insert_run` moved out of `threads.py` during the **Phase 162.5** extraction (2444 → 1204 lines);
the file still `monkeypatch`es it by name. The two `ConnectError`s are tests that reach the real
network from a machine with no DNS answer for the host.

**Proof this plan did not cause it:** the four tests in that file that DO touch the audit
vocabulary are green — `pytest tests/test_dual_mode_wiring.py -k "audit or event_type"` →
**4 passed, 49 deselected**. The file references `_AUDIT_EVENT_TYPES` exactly once, in a
docstring at `:214`, and pins no count. The two tests that DID pin a count
(`test_harness_audit_102.py:65`, `test_harness_audit_emit.py:60`) were caused by this plan, were
observed RED, and were fixed in commit `0e5a62a9` under deviation Rule 3 — they are not deferred.

**Why it is not fixed here:** out of scope by the executor's own scope boundary (a pre-existing
failure in an unrelated file), and re-pointing 32 monkeypatches at the post-162.5 seams is its own
change with its own blast radius. It also matches the recorded project finding that the backend
suite is not a regression backstop.

**Re-open trigger:** the first plan that needs `test_dual_mode_wiring.py` as evidence for a claim
— or `/gsd:verify-work 190`, if the verifier tries to read a whole-suite number from it. Fix as
its own `/gsd:fast` (re-point the `insert_run` monkeypatches; mark the two network-reaching tests).

---

## D-190-DEF-05 — `cd frontend && npm test` is NOT green: 21 failures in 8 files, ALL pre-existing

**Found during:** plan 190-05 task 3, running the plan's own `npm test` acceptance criterion.

**The criterion as written is not satisfiable at HEAD, and that is recorded as a finding rather
than quietly rounded to a pass.** `190-05-PLAN.md` task 3 lists *"`cd frontend && npm test`
reports `0 failed`"*. Measured on the finished tree:

```
 Test Files  8 failed | 238 passed (246)
      Tests  21 failed | 4567 passed (4588)
```

**Proof it is pre-existing — measured, not argued.** The three files this plan changed were
temporarily reset to their pre-phase state (`git checkout de122b9a -- <the three>`), the eight
failing suites were re-run, and the result was **identical**:

```
 Test Files  8 failed (8)
      Tests  21 failed | 88 passed (109)
```

Same 8 files, same 21 tests, with this plan's changes absent. The three files were then restored
and verified **md5-identical** (`phaseVocabulary.ts` `514bc7ec…`, `phaseVocabulary.test.ts`
`e270f26a…`).

A second, independent mechanical check agrees: none of the eight failing files mentions
`phaseVocabulary`, `notConnected` or `workflows/` at all —
`grep -c -i "phaseVocabulary\|notConnected\|workflows/"` returns **0** for every one of them.

**The eight, and what they are:** `IngestionPage`, `MessageItem`, `Plan04.frontend`,
`useMessages`, `StreamsProvider.dedup`, `streamsProvider`, `streamsProvider_075_9_clientkey`,
`lib/model-info` — the chat / ingestion surfaces, i.e. the recorded **SEED-056 frontend vitest
rot**, not the workflow canvas.

**Why the count gate says `failed 0` while `npm test` says 21:** every one of the eight sits
**outside** `scripts/vitest-count-gate.cjs`'s `TARGETS`
(`grep -cE "IngestionPage|MessageItem|streamsProvider|useMessages|model-info|Plan04"` → **0**).
This is the recorded "the count gate has TWO knobs" trap: the gate is a workflow-surface
instrument, and a plan that quotes it as whole-suite health is over-claiming.

**Why it is not fixed here:** the executor scope boundary — eight unrelated files across the chat
and ingestion surfaces, zero of them reachable from this plan's one changed line.

**Re-open trigger:** SEED-056's own trigger, or the first plan in Phase 190 that needs a
whole-frontend-suite number as evidence. **`/gsd:verify-work 190` must not read `npm test` as a
regression signal for this phase** — use `node scripts/vitest-count-gate.cjs` (48 files, `failed
0`) plus the per-suite run, which is what plans 190-05 onward actually assert against.

---

## D-190-DEF-06 — the `npm test` rot GREW between plan 190-05 and plan 190-09: 8 files / 21 tests → 9 files / 26 tests

**Found during:** plan 190-09 Task 3, recording the frontend numbers.

**Measured at HEAD after 190-09's three commits:** `cd frontend && npm test` →
**26 failed | 4562 passed (4588)**, across **9** failing files. D-190-DEF-05 recorded **21
failures in 8 files**. The extra file is
`src/components/layout/__tests__/ChatHistoryColumn.test.tsx` (4 of the 5 extra failures; the
5th is ordering-dependent and does not reproduce in isolation).

**It is NOT this plan's, and that was driven rather than argued.** `api.ts` was temporarily
rolled back to its `HEAD~1` bytes and the file re-run:

```
=== WITHOUT the 190-09 api.ts block ===   Tests  4 failed | 16 passed (20)
=== WITH    the 190-09 api.ts block ===   Tests  4 failed | 16 passed (20)
```

Identical. `api.ts` was restored md5-identical (`fb4b4de7…`) and `git diff --stat` on it is
empty. The test file itself has not been touched since `c10cc7d8` (Phase 165), and it imports
nothing from `lib/api`.

**Why it is not fixed here:** the executor scope boundary. `ChatHistoryColumn` is a chat-layout
surface with no reachable path from this plan's one appended block, and it belongs to the same
SEED-056 rot D-190-DEF-05 already carries.

**Why it is recorded rather than folded into D-190-DEF-05:** because the number MOVED. A
deferral that quotes a stale count invites the next plan to read a real regression as the known
rot. The honest instrument for this phase remains `node scripts/vitest-count-gate.cjs`
(48 pinned files, `failed 0`, 2732 tests at 190-09) — `npm test` is not a regression backstop
here, and `/gsd:verify-work 190` must not read it as one.

**Re-open trigger:** SEED-056's own trigger, or the first time the `npm test` failure count
moves again inside phase 190 — at which point it must be re-derived and re-attributed by the
same roll-back-and-re-run method, never inherited from this entry.

---

## D-190-DEF-07 — UI-SPEC §2h's banner copy and plan 190-09's write gate CONTRADICT each other

**Found during:** plan 190-09 Task 1, choosing where to attach `require_visible("live_connectors")`.

**The contradiction, both sides quoted.** Plan 190-09's Task 1 directs the gate onto the WRITE
endpoints (*"attach `require_visible("live_connectors")` per endpoint on the WRITE endpoints"*)
and Task 2 requires a test exercising it in BOTH directions. UI-SPEC §2h's operator-approved
banner copy says, verbatim:

> `Connections below can be saved and bound to a workflow, but no message, ticket or email will leave.`

With the cold default `"off"`, a non-operator org admin is refused on create/edit/delete — so
the banner's *"can be saved"* is **false for exactly the audience that reads it**. The panel
notice in §9 carries the same sentence (*"You can save this connection and workflow authors can
bind it to a step"*) and inherits the same problem.

**What was done, and why.** The PLAN was followed: the gate is attached to the three write
endpoints and NOT to the reads. The plan is this executor's contract, it was authored with the
UI-SPEC in its own `<context>`, and of the two possible errors this is the more restrictive one
— a phase whose whole discipline is not over-claiming should not ship a live-credential surface
MORE open than its plan says. The conflict is stated in `api/connectors.py`'s module header, in
`190-09-SUMMARY.md`, and here, so it cannot be discovered as a bug in UAT.

**It is a ONE-LINE decision either way, and the operator owns it:**
- *the banner is right* → delete the three `dependencies=[Depends(require_visible("live_connectors"))]`
  entries in `api/connectors.py`; the flag then governs only the SEND path (190-13), which is
  what D-26 actually describes (*"an `external_action` step behaves precisely as it does
  today"* — a statement about the executor, not about CRUD);
- *the gate is right* → amend §2h's and §9's second sentences to say the tab is read-only until
  an operator turns it on.

**Re-open trigger:** the Settings → Connections UI plan (190-10 / 190-11) — it cannot render the
§2h banner without meeting this. Whichever way it goes, both the copy and the gate must move in
the SAME commit, and this entry must be marked resolved with the chosen half named.

---

## 190-14 · A LATENT IMPORT CYCLE ON THE CONNECTOR REGISTRY — measured, fenced, NOT fixed

**Discovered:** plan 190-14 (2026-08-09), while writing the lazy-import fence.
**Owner of the defect:** 190-08 (`registry.py`) + 190-13 (`phase_types.py:94`). Not 190-14.
**Status:** unreachable in production today; guarded by a tripwire; fix deferred.

`import app.services.connectors.registry` in a cold interpreter **fails**, verbatim:

```
registry.py:38            from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES
harness/__init__.py:22    from . import phase_types
phase_types.py:94         from app.services.connectors.registry import get_adapter
ImportError: cannot import name 'get_adapter' from partially initialized module
             'app.services.connectors.registry' (most likely due to a circular import)
```

It does not bite today for exactly one measured reason: `phase_types.py:94` is the **only**
importer of the registry anywhere under `backend/app`
(`grep -rn "connectors.registry" backend/app --include=*.py` → one import line, one docstring
mention), so the registry is never the module that opens the cycle. Importing the harness first
— the app's real order — works and loads **zero** vendor adapter modules, which is the lazy
property 190-08 promised and which is now driven.

**Why 190-14 did not fix it.** The plan is test-only (`files_modified` = two test files) and
D-32 fences this plan to fences. The cycle is not caused by anything in this plan, so the
scope-boundary rule applies: log it, do not fix it.

**What it got instead — a tripwire, not a comment.**
`test_190_connector_source_fence.py::test_no_vendor_module_enters_the_import_graph_until_a_send_happens`
asserts the sole-importer condition literally
(`importers == ["app/services/harness/phase_types.py:94"]`). The commit that adds a second
importer is the commit that makes the cycle live, and it is the commit this fence turns RED on.

**Re-open trigger:** the first plan that needs to import `connectors.registry` from anywhere
other than `phase_types` — the Open Platform client (SEED-013), a worker entry point, a
management script, or `api/connectors.py` growing a capability list. Break the cycle in that
same commit (the cheapest cut: `registry.py` importing `EXTERNAL_ACTION_CAPABILITIES` from a
module that does not re-export the harness package, or `phase_types` resolving `get_adapter`
lazily inside `_exec_external_action`), and mark this entry resolved naming which cut was taken.
