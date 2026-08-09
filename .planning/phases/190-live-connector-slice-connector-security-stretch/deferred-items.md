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

### ✅ RESOLVED — plan **190-16**, 2026-08-09. Branch **(b): the GATE is right, the COPY moved.**

The trigger fired on the plan that actually renders the banner (**190-16**, not 190-10/11 — the
Settings tab landed there). The chosen half, and why:

| | |
|---|---|
| **Branch taken** | **(b)** — `require_visible("live_connectors")` STAYS on the three write endpoints; §2h's second sentence is amended to state the truth. |
| **Why not (a)** | Deleting the three `dependencies=` entries would remove a security gate from a security phase, inside a Settings-table plan, and would turn a shipped **plant-driven** test RED (`test_190_connectors_api.py` case 9 asserts the OFF direction refuses the write). Removing a gate that was PROVED to work is not a copy fix. |
| **Why (b) is honest** | Of the two possible errors the gate is the more restrictive one, and a phase whose whole discipline is not over-claiming should not ship a live-credential WRITE surface more open than its plan says. The banner renders ONLY while the switch is off — the exact state it now describes — so the corrected sentence can never appear in a state it does not fit. |
| **What moved, in ONE commit** | `190-UI-SPEC.md` §2h's second sentence · `connectionsCopy.ts`'s `CONNECTIONS_BANNER_BODY` (the rendered string, asserted by character-identity in `ConnectionsTab.test.tsx`) · and the STRUCTURAL half: while the switch is off, every write affordance is **REMOVED, not disabled** (`＋ Add a connection` and the row `⋯`), per the shipped 185 rule. |
| **Reversal cost** | Delete the three `dependencies=[Depends(require_visible("live_connectors"))]` entries in `backend/app/api/connectors.py`; re-point `test_190_connectors_api.py` case 9; restore §2h + `CONNECTIONS_BANNER_BODY` to 155-C's wording; drop the OFF-state affordance removal in `ConnectionsTab.tsx`. **All four in the same commit** — a gate without the copy under-claims, and the copy without the gate is the D-31 defect. |

⚠ ~~**ONE HALF IS STILL OWED, and it is named rather than closed:** UI-SPEC **§9's panel notice**
carries the same false sentence (*"You can save this connection and workflow authors can bind it
to a step"*) and is out of 190-16's surface. **Plan 190-17 must amend it in the commit that
builds the panel**, and must remove the panel's write affordances under the same OFF state. A
recorded note in §2h points at it so it cannot be lost.~~

### ✅ THE OWED HALF IS PAID — plan **190-17**, 2026-08-09. Same branch **(b)**, extended, not re-decided.

| | |
|---|---|
| **What was false** | §9's panel notice (*"**You can save this connection** and workflow authors can bind it to a step"*) **and its footer** (`will save · will not send`). 190-16 named the notice; the FOOTER was not named and carried the identical promise one line below it. Both are corrected. |
| **What moved, in ONE commit** | `190-UI-SPEC.md` §9's notice block **and** its `font-mono` footer line, with the branch, the structural half and the reversal cost written beside them · `connectionFormCopy.ts`'s `PANEL_OFF_BODY` + `PANEL_OFF_FOOTER` (the rendered strings, asserted by character-identity in `ConnectionFormPanel.test.tsx`) · and the STRUCTURAL half: while the switch is off the panel renders **no Save, no `Replace`, and static text instead of inputs** — REMOVED, not disabled. |
| **Why removed and not disabled** | 190-16 MEASURED it: its plant C rendered the Add button `disabled` instead of removed and `toBeDisabled()` **passed on the defect**. Only an absence assertion sees it, so the panel's suite asserts absence for all three affordances. |
| **Reversal cost — now SIX edits, and they may never be separated** | The four above, PLUS: restore §9's notice + footer to 156-A's wording (and `PANEL_OFF_BODY` / `PANEL_OFF_FOOTER` with them), and drop the panel's OFF-state affordance removal in `ConnectionFormPanel.tsx`. |

**D-190-DEF-07 is now CLOSED in full** — both surfaces that carried the false sentence say the
same true thing, and both write surfaces remove rather than disable. Nothing about branch (b) was
re-litigated here; 190-16's four reasons were extended to the surface that was out of its reach.

---

## D-190-DEF-08 — a latent import cycle on the connector registry: measured, fenced, NOT fixed

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

---

## D-190-DEF-09 — `live_connectors` has NO operator card in the Control Room, and the client `GovernedFeature` union does not name it

**Found during:** plan 190-16, wiring the UI-SPEC §2h OFF banner to a real feature read.

**Both halves are ONE gap and must land in ONE commit.** They are recorded together because
fixing either alone is worse than fixing neither: widening the type without the card leaves five
exhaustive maps edited for no user-visible reason, and adding the card without the type does not
typecheck.

**Half 1 — the client type is stale against the server.** Plan 190-09 added `"live_connectors"`
to the backend's `_VISIBILITY_FEATURES` (`api/admin.py:97-105`) and `_GOVERNED_FEATURES`
(`models/user_settings.py`, cold default `"off"`). `GET /features` therefore RETURNS the key
(`api/features.py:81` iterates `_GOVERNED_FEATURES`) — measured, not assumed. But
`frontend/src/lib/api.ts`'s `GovernedFeature` union still names only five features, so
`features.live_connectors` is a type error.

**Measured cost of widening it** (190-16 tried it, then reverted): `tsc -p tsconfig.app.json`
went **33 → 38**. The five new errors are all `Record<GovernedFeature, …>` exhaustive maps that
then miss a key:

```
src/components/admin/ControlRoomPage.tsx(188,7)                      DEFAULT_VISIBILITY
src/components/admin/ControlRoomPage.tsx(229,81)                     greenlist initial state
src/components/admin/__tests__/ControlRoomPage.test.tsx(88,53)       fixture
src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx(24,7) fixture
src/components/admin/revertByteIdentical.test.tsx(88,3)              fixture
```

Each is a one-line map-key addition. **Two of them are `/admin` source**, which phase 190's
**D-25** fences ("connections are managed in SETTINGS… do not add anything to `/admin`").

**Half 2 — and this is the one that makes a shipped sentence false.** The Control Room's
visibility grid does NOT render from `Record<GovernedFeature, …>`; it renders from the
hand-curated `FEATURES` array in `frontend/src/components/admin/FeatureVisibility.tsx:101-157`,
whose entries carry seven authored fields each (`name`, `desc`, `livesOn`, `glyph`, `uiSurface`,
`refusedApi`, `routePrefixes`). **There is no `live_connectors` entry, so no card renders and an
operator has no UI to flip the switch** — the only route today is a raw
`PUT /admin/visibility {feature: "live_connectors", audience: "everyone"}`, which is what
`190-09-SUMMARY.md` § Cloud parity already records as the operator action.

**Why 190-16 did not close it:** authoring a `FEATURES` entry is a **new user-facing capability
in `/admin`** — the exact thing D-25 fences and the exact class G-7 forbids smuggling into
another plan. 190-16 is the Settings table; the operator's card is its own small change.

**What 190-16 did instead, so nothing is silent:** it reads the key through ONE documented,
fail-closed reader (`settings/connectionsCopy.ts` → `liveConnectorsOnFrom`), and both this entry
and `lib/api.ts`'s union comment point here.

⚠ **THE CONSEQUENCE, STATED RATHER THAN SMOOTHED:** UI-SPEC §2h's banner closes with *"An
operator turns `live_connectors` on in the Control Room."* That sentence names the right owner
and the right home (D-25: the operator sets the lock) — but **until Half 2 lands, an operator who
goes there finds no row.** The sentence is kept verbatim because it is operator-approved and its
home is correct; the missing card is recorded here rather than discovered in UAT.

**Re-open trigger:** ANY of — plan 190-17 (the next 190 plan that touches this surface's copy);
`/gsd:verify-work 190` reaching the §2h banner's last sentence; or the first operator who tries
to turn live sending on. Fix as ONE `/gsd:quick`: widen the union, add the five map keys, and
author the `FEATURES` entry (Off | On control, `offOn={def.key === …}` — the
`visual_workflow_canvas` precedent at `FeatureVisibility.tsx:147-156, :311` is the exact shape).
Mark this entry resolved naming the audience the card writes.

---

## D-190-DEF-10 — WR-01: GATE 3 is a no-op in production for `create_ticket` and `send_email`, and its fence drives a config the model forbids

**Found by:** the Phase-190 code review (`190-REVIEW.md` WR-01), 2026-08-09.
**Routed:** DEFER the code, FIX the score. Both halves were done in the review-fix round.

**The measurement, re-derived rather than inherited.** `_pre_credential_destination` returns
the step's `base_url` if one exists, else the per-capability constant
`{"post_message": SLACK_API_BASE, "create_ticket": None, "send_email": None}`.
`ExternalActionPhaseConfig` is a `_StrictBase` (`extra='forbid'`) and carries **no
`base_url`** — `models/harness.py` adds `connection_id` and nothing else. So on the shipped
path:

| capability | GATE 3, before any credential work |
|---|---|
| `post_message` | validates the code constant `https://slack.com/api/` — always passes |
| `create_ticket` | `destination is None` → `validate_destination` is **never called** |
| `send_email` | `destination is None` → `validate_destination` is **never called** |

**Why it is DEFERRED and not fixed.** There is **no reachable bypass today**:
`send_pinned_http` and `open_pinned_smtp` both call `validate_destination` as their first
statement, so no socket opens unvalidated. What is missing is the ORDERING property D-06
exists to make structural rather than incidental. The honest repair is not a one-liner — it
touches `ExternalActionPhaseConfig`'s `extra='forbid'` contract and the D-13 config shape
(190-06 deliberately settled that non-secret destination config lives on the CONNECTION ROW,
not the step, and `test_190_egress_ordering.py` asserts that settlement), so undoing it to
satisfy a fence would be the tail wagging the dog. That is a scoping decision, not a
line-count one, and it belongs to a plan rather than a fix round (G-7: a closure round may not
add capability, and this is closer to a design change than a defect repair).

**What WAS done in the fix round, because a false ✅ is not deferrable:**
`190-VALIDATION.md`'s W0-3 row and its G-6 row 6 are corrected in place, with the measurement
above written into a new § *CORRECTION TO W0-3's ✅*, and the "six of eight fully driven"
count restated as five of eight. The correction states exactly what W0-3 does prove
(`post_message`'s ordering, on the SHIPPED config shape) and what it does not.

**Two things this entry does NOT claim to have fixed, and they are the re-open work:**

1. **The executor's docblock still over-states the property.** `_exec_external_action`'s block
   reads *"a send with **no credential bound at all** raises the EGRESS REFUSAL rather than a
   missing-credential error"* as an absolute. True for `post_message`, false for the other
   two. Correcting it means writing the true, narrower, per-capability sentence — which is
   easy, but writing it BESIDE a fence that still cannot see the production path would be
   documenting a gap rather than closing one, so both move together or neither does.
2. **The fence has nothing real to bite on for `create_ticket`.** The property those two
   capabilities actually need is BINDER-level and is asserted **nowhere**: drive
   `jira_adapter.Adapter.send` with a stub credential whose `.secret` property RECORDS access,
   aim it at a refused host, and assert `EgressRefused` is raised **and** `.secret` was never
   read. `jira_adapter.py:100-108` records that gap in prose only.

**Re-open trigger — ANY of:** the next plan that opens `ExternalActionPhaseConfig` or
`_pre_credential_destination`; a **fourth capability** arriving (D-04's own trigger — the
`None` default would silently extend the gap to it); `/gsd:secure-phase` re-running on this
tree and reading the executor docblock as a claim; or the Open Platform milestone (SEED-013)
moving adapters behind an MCP client, where the pre-credential ordering stops being ours to
assert at all. **Fix in ONE commit, both halves: the narrowed docblock AND the binder-level
drive.**

---

## D-190-DEF-11 — WR-03's UI half: nothing clears `connection_id` when the step's capability changes

**Found by:** the Phase-190 code review (`190-REVIEW.md` WR-03), 2026-08-09.
**Half of it was FIXED in the review-fix round; this is the half that was not.**

`ExternalActionSection`'s capability rows call `onChange(name)`, which patches `capability`
only. Nothing clears `config.connection_id` — not the section, not `ConnectionPicker` (which
writes only on `<select>` change), not `PhaseFormPanel` (`0 0` by D-23). So binding a Slack
connection and then switching the step to *Creates a ticket* leaves a **stranded reference**
in the JSONB, and the author is actively told there is nothing to clean up: the picker's list
read is capability-filtered so `bound` is `undefined` and the footer reads *"🔒 nothing bound
— this step will record, not send"*, while `notConnectedOf` sees a non-empty string and drops
the canvas badge, so the canvas says the step is complete.

**What WAS fixed (commit `50d058e3`):** the RUN is now honest. The executor's mismatch check
was a bare `ValueError` — not an `AdapterError`, so nothing caught it, and the run died with
no `text`, no `failure` sentence and none of D-17's four terminals. It now returns the shipped
`recorded_not_sent` terminal with a logged warning. That is the half that decides whether a
user sees a stack trace or the shipped vocabulary, and it does not depend on any UI behaving.

**Why the UI half is deferred:** it is a frontend change on the workflow-builder surface
(`ConnectionPicker.tsx` and/or `ExternalActionSection.tsx`) inside a backend-security fix
round, it needs its own count-gate + `tsc -p tsconfig.app.json` cycle, and it is entangled
with **WR-04** (`D-190-DEF-13`) — both are "the reference does not resolve" wearing different
clothes, and fixing them separately means touching `notConnectedOf`,
`canvasModel.buildPhaseData` and the picker twice.

**Re-open trigger:** the next plan that opens `ConnectionPicker.tsx` or
`ExternalActionSection.tsx` — or the first author who reports a step that reads *"complete"*
on the canvas and *"nothing bound"* in the panel. **Fix it together with WR-04**, in one
commit, since both are resolved by passing the fetched connection list into the badge
resolution as DATA.

---

## D-190-DEF-12 — WR-05's panel half: Save is not disabled for an incomplete connection

**Found by:** the Phase-190 code review (`190-REVIEW.md` WR-05), 2026-08-09.
**The DEFECT is fixed; this is the ergonomics half.**

**What WAS fixed (commit `f64a0ebb`):** the models. `name`, `secret`, `host`, `from_address`,
`base_url`, `project_key`, `account_email` and `default_channel` are all `NonEmpty`, and
`port` is `Field(ge=1, le=65535)` (which also closes **IN-03**). An entirely empty connection
is no longer creatable through the API, through curl, or through any future caller — the
review's own Fix section names the model as the right home *"where both the API and any future
caller are covered"*.

**What is deferred:** the review's second sentence — *"Mirror it in the panel with a
`saveBlocked` term so the button is disabled rather than the request 422'ing."*
`ConnectionFormPanel.tsx:625` computes `saveBlocked` as `saveRefusal?.kind === "cipher"` only,
so an incomplete form still round-trips to the server. **Measured, so the consequence is known
rather than assumed:** the panel already renders an honest refusal for this — a 422 lands in
`saveRefusalFrom(error)` as `kind: "generic"` and the `saveRefusal?.kind === "generic"` block
at `:1460` renders it with `role="status"`. Nothing is silent; it is one round trip less
pleasant than it should be.

**Why deferred:** `ConnectionFormPanel.tsx` is a ~1500-line file with a 63-case suite and a
character-identity copy contract (190-18's closed six-row refusal map). A completeness term
needs its own RED-first drive plus the count gate plus `tsc`, which is a frontend plan, not a
line in a backend security fix round.

**Re-open trigger:** the next plan that opens `ConnectionFormPanel.tsx`, **or** the first UAT
row that reaches sketch 156-A's *Add a connection* panel (⛔ owed today — zero connections
exist and the create surface is gated off). Whoever does it should key the term off the same
per-capability required-field set the models now declare, rather than re-typing it.

---

## D-190-DEF-13 — WR-04: the canvas badge and the panel footer disagree about whether a step is connected

**Found by:** the Phase-190 code review (`190-REVIEW.md` WR-04), 2026-08-09. **Not fixed.**

`notConnectedOf` (`phaseVocabulary.ts:811-813`) returns `false` for any non-empty-string
`connection_id` — it validates the SHAPE of the reference and nothing about the referent. The
picker, one panel away, resolves the reference against the live list and filters out disabled
rows (`ConnectionPicker.tsx:231`), so it reports `bound === undefined` for the same step.

**The failure:** an author binds a connection; an org admin later disables it (UI-SPEC §2g's
`⏻ Disabled`, a first-class supported action) or deletes it. Open the workflow and the canvas
shows **no `Not connected` badge** — the step reads as finished — while the panel footer reads
*"🔒 nothing bound"* and the run produces `recorded_not_sent`. Two surfaces, one step, opposite
answers, and **the one an author scans first is the one that is wrong.** The whole point of
D-24's state-conditional badge is that the canvas answers *"is this step finished?"*, and a
dangling reference is exactly the state it should still flag.

**The shape of the fix, named so the next author does not re-derive it:** `notConnectedOf`
reads `PhaseSpecJSON` and cannot fetch, so the resolution must arrive as DATA.
`canvasModel.buildPhaseData` already resolves `notConnected` once and passes it as data
(`canvasModel.ts:145-175`) — pass the Builder's fetched connection list into that resolution
and treat *"bound id not present among the ENABLED connections for this capability"* as
not-connected. Keep `notConnectedOf`'s two-line shape (D-24) by widening its second line to
take an optional resolved-set argument defaulting to today's behaviour, so `PhaseNode.tsx` and
`PhaseNodeCard.tsx` stay at `0 0`.

**Why deferred:** a frontend change on the fenced canvas subtree inside a backend security fix
round, and it must land with **D-190-DEF-11** — the two are the same defect from two
directions.

**Re-open trigger:** the next plan that opens `phaseVocabulary.ts`, `canvasModel.ts` or
`ConnectionPicker.tsx`, or the first UAT row that disables a bound connection and re-opens the
workflow. ⚠ Whatever lands must re-verify the eight D-23/D-24 empty-diff fences in the same
commit.

---

## D-190-DEF-14 — WR-06: `require_visible` short-circuits for operators BEFORE reading the audience, so the connector WRITE surface is open while the switch is OFF

**Found by:** the Phase-190 code review (`190-REVIEW.md` WR-06), 2026-08-09. **Not fixed.**

**Stated plainly, because it is the one deferral here with a live consequence:** with
`live_connectors` at its cold default `"off"`, an **operator** can still create, edit and
delete connector connections — i.e. can still store a live tenant credential — through
`POST /connectors/connections` from curl or from a stale tab, even though the Settings UI has
correctly removed every write affordance for that state.

The operator no-op in `dependencies.py:541-542` runs **before** the `"off"` test.
`GET /features` (`api/features.py:70-72`) does the opposite and honours `"off"` for everyone
*including operators*, deliberately, per D-181-01; `require_canvas` (`dependencies.py:668-671`)
also checks the flag first. So this dependency is the odd one out among three consumers of the
same idea. `D-190-DEF-07`'s resolution table asserts branch (b) was chosen because *"a phase
whose whole discipline is not over-claiming should not ship a live-credential WRITE surface
more open than its plan says"* — and for the operator audience it is exactly that.

**Why it is deferred rather than fixed here, measured:** `require_visible` is **shared by four
other governed features**. Moving the `"off"` test above the operator no-op changes the
behaviour of every one of them in the same commit, and at least one may depend on an operator
reaching a surface they have switched off for everyone else. That is a cross-feature
governance decision with its own blast radius — not a line in a connector fix round — and
getting it wrong locks an operator out of their own Control Room.

**The narrower, safer shape if the broad one is judged too wide:** add a dedicated
`require_live_connectors` that composes the `"off"` check with `require_visible`, leaving the
four other consumers untouched. Whichever is chosen, it should also
`await ensure_settings_fresh()` — same root cause as CR-02, which was fixed in the executor
but **not** in this dependency.

**Interim mitigation, so the exposure is bounded rather than open-ended:** the write path is
still behind `require_org_manage` (org-admin or super-admin) AND migration 116's `org:manage`
RLS policies AND — since commit `f64a0ebb` — migration 118's column privileges. An operator
storing a credential while the switch is off cannot cause a SEND: the executor's GATE 2 is
independent, and CR-03 made it require a positive `"everyone"`.

**Re-open trigger:** ANY of — the next plan that opens `dependencies.py`'s `require_visible`;
`D-190-DEF-09`'s Control Room card landing (the operator will then have a real UI for this
switch and the mismatch becomes visible); or the first operator who reports being able to save
a connection the banner says they cannot.

---

## D-190-DEF-15 — the Info findings (IN-01, IN-02, IN-04), and where IN-03 went

**Found by:** the Phase-190 code review, 2026-08-09.

**IN-03 is NOT deferred — it was folded into WR-05's fix** (commit `f64a0ebb`). A non-numeric
SMTP port became `0`, and `validate_destination`'s
`resolved_port = port or parsed.port or _DEFAULT_PORTS[scheme]` treats `0` as FALSY and
substitutes 465/587 — so someone who typed `four sixty five` got a working connection on a
port they never chose. `Port = Annotated[int, Field(ge=1, le=65535)]` makes it a refusal.
Driven by `test_190_review_fix_data_layer.py`'s per-field case for `port=0`.

The other three are documentation / ergonomics and are deferred:

**IN-01 — `harness_engine.py:802-836`'s WR-06 block still describes Phase 190 in the future
tense.** It reads *"once Phase 190 wires a real send, PUBLISHING a workflow would PERFORM THE
EXTERNAL ACTION"* and *"PHASE 190 OWNS THE FIX and it is one of two shapes"*. 190 took shape 1
(the `is_golden_run` gate) and the trigger test is green. `_exec_external_action`'s docblock
was rewritten to mark its superseded invariants; this one was not, so a future reader of the
engine will believe the defect is still open.
**Fix:** append a dated `RESOLVED 2026-08-09 (Phase 190 / D-16 — shape 1)` note in the block's
own superseded-quote style, **without deleting the reasoning**.
**Re-open trigger:** the next plan that opens `harness_engine.py`, or `/gsd:docs-update`.

**IN-02 — `ExternalActionSection`'s six "purity" fences no longer prove anything about the
section's behaviour.** They read the SOURCE OF THAT ONE FILE for `useEffect`, `fetch(` and
`@/lib/api`. This phase moved all three into `ConnectionPicker.tsx`, which the section now
renders unconditionally — so the fences pass and the section is no longer a pure leaf: every
render with a capability selected opens a network request. `190-VALIDATION.md` §M4 scores them
✅ *"re-run post-mount"*, which is TRUE but no longer means what the row implies.
⚠ This is the same class as WR-01 — a green fence measuring a property that moved — and it is
recorded here rather than left as a ✅ that reads stronger than it is.
**Fix:** either restate the fences as *"this file names no transport"* (honest and still
useful) or extend the walk to the modules this file imports, so the property matches the claim.
**Re-open trigger:** the next plan that opens `ExternalActionSection.tsx` or its test — which
is also `D-190-DEF-11`'s trigger, so they should land together.

**IN-04 — `SendEmailConfig.username` is unreachable from the UI.** `configFromDraft` never
writes it and the panel has no field for it, so `smtp_adapter._identity` always falls back to
`from_address`. The model, migration 116's comment and the `lib/api.ts` type all declare the
field. For any provider whose SMTP username is not the mailbox address (SES, Mailgun, most
relay services) the connection can be created and can **never authenticate**, with no
configuration path.
⚠ Slightly sharper after the fix round: WR-05 now constrains `host`, `from_address` and
`secret`, and `username` was DELIBERATELY left unconstrained-optional (D-03 — it is absent for
every host whose login IS the mailbox), so the model is now explicit that the field is
optional-by-design rather than merely unpopulated.
**Fix:** either add the field to UI-SPEC §3b's form or drop it from the model, so the three
spellings agree.
**Re-open trigger:** the `send_email` UAT row (⛔ owed — D-30, and it needs a
publicly-routable TLS SMTP host), or the first operator whose relay rejects the mailbox
address as a username.

---

## D-190-DEF-16 — `full-schema.sql` carries NO ACLs, so a privilege-narrowing migration is invisible to every greenfield bootstrap

**Found during:** the CR-01 fix, 2026-08-09, while regenerating the bootstrap artifact.
**Partially closed in the same commit (`f64a0ebb`); the general case is deferred.**

**Measured, not assumed.** `scripts/regenerate-full-schema.sh` runs
`pg_dump --schema-only --no-owner --no-privileges`, so:

```
$ grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql   ->  0     (before the fix)
```

Migration 118's `COMMENT` survived the regeneration; its `REVOKE` / `GRANT` did **not**. A
greenfield project bootstrapped from `full-schema.sql` alone would therefore have shipped with
`secret_ciphertext` readable over PostgREST by every authenticated org member — the exact
defect 118 exists to close, silently absent.

**What was done:** the CR-01 grant is mirrored into `scripts/full-schema-supplement.sql`,
which the script appends verbatim, and the supplement's own maintenance note now lists **ACLs**
as a fourth thing `pg_dump` cannot carry (beside storage buckets, the auth trigger and realtime
memberships). `grep -c` on the regenerated artifact now returns 4.

**What is deferred, and it is the part that will bite someone else:** the mirroring is
**manual and unfenced**. Nothing detects a future migration that narrows a privilege and
forgets the supplement — the same class of same-commit-sync obligation CLAUDE.md already
fences twice (`Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md`, and
`scripts/check-deploy-drift.sh` for deploy artifacts), and it deserves the same treatment.

**Two candidate shapes, neither taken here:**
1. **Drop `--no-privileges`** from the dump. Honest and total, but it emits every table's ACLs
   (a very large diff) and may reference roles a fresh project does not have at paste time —
   it needs its own verification pass against a real greenfield project, which is a plan.
2. **A drift check**: a script that greps `supabase/migrations/*.sql` for `GRANT` / `REVOKE`
   and asserts each such statement's table appears in `full-schema-supplement.sql`. Cheap,
   fenced, and in the exact shape of `check-deploy-drift.sh`.

**Re-open trigger:** the next migration that contains `GRANT` or `REVOKE` — or the first
greenfield/cloud deploy after which a privilege is observed missing. Whoever hits it should
take shape 2 and register it beside the existing drift checks.
