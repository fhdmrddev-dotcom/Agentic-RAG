---
phase: 239-any-mcp-server-with-files
plan: "04"
kind: gap-closure
gap_closure_round: 1
scope: backend-only
subsystem: connectors / sources / MCP
base: dc021defc
head: 22eee1b56
reviewed_against: 239-REVIEW.md
findings_in_scope: 19
findings_fixed: 14
findings_partial: 1
findings_not_mine: 4
tags: [security, mcp, source-adapter, fences, fail-closed]
---

# Phase 239 Plan 04: Backend gap-closure round 1 — Summary

**Untrusted server input was reaching decisions it should not reach, in two places, and the
fence that was supposed to notice could not see either of them.** CR-01 and CR-02 are one root
shape and are closed by one guard; ME-05 is why neither was caught, and closing it made the
phase's headline claim true by construction rather than by docstring.

⚠ **The worktree landed on `1335b4b1a` for the fourth time running.** Reset to `dc021defc` as
instructed, before any read. Recorded because the trap has now fired on four consecutive
agents and is not getting less frequent.

⚠ **`239-REVIEW.md` is not committed.** It exists only as an untracked file in the operator's
main working tree (`C:\Vibe Apps\Agentic RAG\.planning\phases\239-any-mcp-server-with-files\239-REVIEW.md`)
and is absent from `dc021defc` and from every ref. I read it from there. **It should be
committed** — the authority for a gap-closure round living outside version control is the same
class of problem as a `trigger_when` nobody sweeps.

---

## Per-finding disposition

| # | Finding | Disposition | Commit |
|---|---|---|---|
| CR-01 | destructive tool bindable as the READER | ✅ **fixed** (backend half; UI half is the other agent's) | `fe6da7122` |
| CR-02 | server-authored `description` chooses what we invoke | ✅ **fixed** | `fe6da7122` |
| HI-01 | `✓ Ready as source` on every `custom_mcp` row | ⛔ **NOT MINE — frontend** | — |
| HI-02 | OAuth save deletes `source_tools` | ⛔ **NOT MINE — frontend** | — |
| HI-03 | unparsed listing reported EMPTY AND COMPLETE | ✅ **fixed** | `6701d3f9f` |
| HI-04 | `root_path` only settable by hand-crafted PATCH | ⚠ **PARTIAL — named, not refused.** See below. UI control still OWED and assigned to nobody | `6701d3f9f` |
| ME-01 | `tool_grants` not consulted on the source path | ✅ **fixed** | `f00f06f84` |
| ME-02 | default binding produces no version → modification detection off forever | ✅ **fixed** (binding half). Receipt half not done — see below | `fe6da7122` |
| ME-03 | 0-byte file raised as an error | ✅ **fixed** | `6701d3f9f` |
| ME-04 | `_MUTATION_WORDS` substring matching over-broad | ✅ **fixed** — with a correction to the review's failure scenario, below | `fe6da7122` |
| ME-05 | *"nothing else knows any tool name"* is false and unfenceable | ✅ **fixed** — vocabulary MOVED; fence extended; claim rewritten | `fe6da7122`, `86ba55ac1` |
| ME-06 | fence sees only `ast.Compare` | ✅ **fixed — and the review understated it.** See below | `86ba55ac1` |
| ME-07 | `source_tools` unbounded; `root_path` exempt from everything | ✅ **fixed** (bounded) + exemption now STATED | `f00f06f84` |
| LO-01 | comment asserts a false invariant | ⛔ **NOT MINE — it is `frontend/src/components/sources/sourceCapability.ts`**, listed under "Backend LOs" in my brief in error | — |
| LO-02 | `browse(None)` mints a root before validation | ✅ **fixed** | `6701d3f9f` |
| LO-03 | MCP conformance is a private class | ✅ **fixed** — invariants parametrized + registry-derived completeness guard | `9e61fbdec` |
| LO-04 | `_DIR_WORDS` exists twice with different contents | ✅ **fixed** — one set, the union | `fe6da7122` |
| LO-05 | server error text reflected verbatim into the API response | ✅ **fixed** | `f00f06f84` |
| LO-06 | a real folder named `virtual_root` collides with the sentinel | ✅ **fixed** — `mcp:root`, and **not** `\x00…`; see below | `6701d3f9f` |

**Plus one gap the review did not name and I found while fixing CR-01:**

| — | `create_connection` never called `reject_unoffered_source_tools` at all | ✅ **fixed** | `fe6da7122` |

---

## The two Criticals are one defect

The review treats CR-01 and CR-02 separately and its own summary already says why they belong
together: *"the phase built a careful structural fence against one class of server-controlled
input in one file, and then let a different server-controlled field in a different file decide
which remote tool this application invokes."* The brief asked for the cause, not the symptom.

**The cause is that a decision about what to EXECUTE was being taken from data the remote end
authors.** So one predicate — `looks_like_a_mutation`, judging the tool's own NAME — now guards
both exits, and the auto-detector additionally stopped reading server prose entirely.

⚠ **The two guards are deliberately asymmetric, and the asymmetry is written into the
docstring rather than left to be inferred:**

- **The auto-detector uses an ALLOW-LIST of shapes.** It binds with nobody watching, so a name
  it cannot recognise binds *nothing* and falls through to the operator's picker. Fail-closed.
- **The write boundary uses a DENY-LIST.** A person chose the value, and this product's
  headline claim is *any* MCP server — refusing every vocabulary this app does not recognise
  would refuse exactly the servers Phase 239 exists to support. **The residual risk is named in
  the code: a destructive tool whose name carries no mutation word can still be bound by hand.**

This is the one place I did not follow the review's letter. Its CR-02 fix #2 proposes requiring
`^[a-z_]*(list|read|get|cat|browse|ls)[a-z_]*$` — an allow-list — and if that shape were also
applied at the boundary the "rows, not code" claim would die. Applying it to the unattended path
only preserves both properties.

### RED evidence — CR-01 / CR-02 / ME-02 / ME-04 / ME-05

Every repro in the review reproduced verbatim against `dc021defc` before I changed anything:

```
== CR-01: destructive tool bound as reader ==
  ACCEPTED  <-- DEFECT
== CR-02: description decides the binding ==
  {'list_tool': 'enumerate_tree', 'read_tool': 'purge_documents'}
== ME-04: over-broad substring mutation match ==
  mutation?(list_assets) = True      mutation?(get_asset)   = True
  mutation?(read_dataset) = True     mutation?(input_file)  = True
  mutation?(output_list) = True
== HI-03: unparsed listing -> empty AND complete ==
  []
  []
== ME-02: no version for the reference listing shape ==
   _Entry(name='report.pdf', …, size=None, modified_at=None)
== ME-03: 0-byte file ==
  (b'', None)
== ME-07: root_path unchecked/unbounded ==
  ACCEPTED unchecked
  McpConfig accepted key len 500 value len 5000
```

After the fix, on the same script:

```
== CR-01 ==  refused: source_tools.read_tool names 'delete_file', whose own name says it
             CHANGES something. …
== CR-02 ==  None
== ME-04 ==  every one False
== ME-05 ==  _LIST_TOOL_NAMES in connector_service: ABSENT
```

**22 new cases driven RED as tests**, by restoring `mcp_source.py` and `connector_service.py`
to `dc021defc` with the new tests in place:

```
22 failed, 23 passed, 1 warning in 22.46s
```

Sources restored and verified md5-identical (`06cb94b0…`, `523681b1…`) → `45 passed`.

---

## ME-05 was the enabling fix, and the honest resolution was the one the brief anticipated

The brief said: *"If the honest resolution is that inference legitimately needs tool words,
then the CLAIM is what changes."*

**It turned out not to need that.** Inference needs tool words, but nothing requires those words
to live *above* `adapters/`. `_LIST_TOOL_NAMES`, `_READ_TOOL_NAMES`, `_MUTATION_WORDS`,
`_DIR_WORDS`, `_schema_params` and the whole of `infer_source_tools` moved down into
`mcp_source.py` — the file whose docstring had claimed exclusive ownership all along.
`connector_service.infer_source_tools` is now a delegation holding no literal. **The claim is
true by construction; no sentence had to be softened.**

The docstring was still rewritten, because the *history* is the finding: it now records that
the claim was false on the day it was written, that `test_boundary_fence.py` structurally could
not see it, and that it is now enforced — with the plant-and-restore evidence named inline.

---

## ME-06: the review understated the gap, and my own positive control proved it

The review names three invisible shapes: `.startswith()`, `match`/`case`, dict subscripts. I
widened the walker to cover all three plus `.get()`, `.endswith()`, `.removeprefix/suffix()` and
`ast.MatchValue`.

⚠ **The widened walker still returned `[]` for `if name in ("list_directory", "ls")`.**

That is a **fourth** shape, and it is the worst one: the comparator of an `in` test against a
container literal is an `ast.Tuple`, and only its *elements* are `ast.Constant`. So the single
most idiomatic way to write a membership test in Python was invisible to **both** fences for the
whole of Phases 232, 238 and 239 — including to the very positive control that was supposed to
prove the fence could fire. `_flatten` now expands `Tuple`/`List`/`Set` operands.

**It was found by writing the new positive control, not by reading the code.** A control that
only confirms what you already believe is decoration; this one failed on its first run and told
me something the review had not.

### RED evidence — the fences, planted in the SHIPPED files

Planted `if name in ("list_directory", "ls")` into `connector_service.py` and
`service_id.startswith("google")` into `sources/base.py`:

```
E   AssertionError: app/services/sources/base.py branches on a provider identity above
E       services/sources/adapters/:
E         line 235: 'google' (matches 'google')
E   AssertionError: app/services/connector_service.py decides something using an MCP tool name:
E         line 403: 'list_directory' (matches 'list_directory')
E         line 403: 'ls' (matches 'ls')
2 failed, 16 passed
```

Both files restored **md5-identical**: `eeb95b1ca2b15454af403888fa9bc031` (connector_service),
`3b3d8770a6c9309f0635503d155dd8f7` (base). No false positives across the seven fenced modules.

⚠ **`"read"` and `"browse"` are deliberately ABSENT from `TOOL_LITERAL_EXACT`** and the test says
so by name. They are ordinary English in these modules (scopes, verbs, modes) and a fence with
false positives is a fence that gets deleted. `ls` and `cat` are safe because nothing else
spells them.

---

## HI-03 was the most dangerous non-Critical, and it is fully closed

`_parse_listing` caught the `isError` **field** and nothing else, so any 200 whose body the
parser did not recognise became `[]` — while `list_files` always answers `next_page_token=None`,
so `watch_service` stamps `listing.complete = True` on the first pass. **Complete, and zero
files, is precisely the state the H-5 deletion guard exists to refuse.** A fail-OPEN inside a
fail-closed guard.

The fix distinguishes two silences, and the control matters as much as the fix:

- `text` empty, or whitespace only → `[]`, complete. **A genuinely empty folder is still empty.**
- `[]` or `{"entries": []}` → `[]`, complete. **An explicit empty container is an ANSWER.**
- non-empty body that yielded zero entries → **raises**.
- `[FILE] a.txt (10 bytes)\nTotal: 1 file` → keeps the file. **A partial parse is not a refusal.**

---

## HI-04: named, not refused — and this is the one I deliberately did not implement as written

The review's own fix raises `"…Set the root path in Settings → the connection → File source
mapping."` **That sentence points at a control that does not exist**, which the same finding
proves. And the finding splits cleanly:

- **VERIFIED:** `root_path` defaults to `""`, `infer_source_tools` never produces it, and
  Settings renders no control — so the virtual root always resolves to `path: ""`.
- **SUSPECTED, and the review says so:** that `""` is what a server refuses. `SEED-257` records
  that MCP sources cannot be driven locally at all, so nobody has seen the answer.

⚠ **Two shipped tests assert the opposite claim** —
`test_an_unbound_connection_addresses_the_servers_own_default_root` and
`test_browsing_the_virtual_root_lists_the_configured_root_path` both pin `path == ""`. Refusing
the empty root would have required deleting them, i.e. picking one unverified belief over
another *and* breaking every server that is legitimately rooted at `""`. The brief's rule —
*do not weaken a test to make it pass; if a finding is wrong, say so with evidence* — cuts
against implementing the refusal, so I did not.

**What I did instead:** when a listing fails and the wire path was empty, the failure now NAMES
the empty root as the likely cause, with the field that sets it. A diagnosis, not a verdict.
Two cases pin it, including the control that a *configured* root is never accused of absence.

⛔ **THE UI CONTROL IS STILL OWED AND IS ASSIGNED TO NOBODY.** My brief gives the frontend agent
HI-01, HI-02 and CR-01's UI half; HI-04's frontend half is named in neither brief. It is a
plain text input bound to `draft.sourceRootPath` on the File source mapping card — the draft
plumbing already exists (`connectionFormCopy.ts:584` says so). **Until it ships, no MCP source
can be pointed at a real folder through the product.**

---

## LO-06: fixed, but not the way the review suggested, and the reason matters

The review offers `"\x00virtual_root"` or `"mcp:root"`. **A NUL byte would be a defect, not a
fix:** this value reaches `connector_watches.source_folder_id`, and a NUL in a Postgres text
column is `22P05` — the exact failure v3.7's UAT caught in a `.msg` subject line. Chose
`mcp:root`, which `_join` cannot produce because `_join` only ever concatenates a folder path
and an entry name.

⚠ **No migration is owed** — `SEED-257` establishes this family has never been driven, and it
has not shipped past `develop`, so no row can carry the old value. Had one existed, the old
string would have had to stay in `VIRTUAL_ROOT_IDS` as a legacy arm. This is stated in the code.

⚠ **My first version of the LO-06 test passed against the defect.** I wrote it with
`root_path="/srv"`, where the entry id is `/srv/virtual_root` either way — so it proved nothing.
The collision is reachable *only* at the empty root, which is where HI-04 says every MCP row
sits today. Rewritten against `conn()` with no root, it fails on the old sentinel. Recorded
because the review's own standard is that a test which cannot fail on the defect is not evidence.

---

## Corrections to the review

**ME-04's failure scenario is half right.** The review says a server whose lister is
`list_assets` and whose reader is `read_dataset` *"gets no auto-binding at all"* and implies
whole-token matching fixes that. Whole-token matching fixes the *pre-filtering* — those names
are no longer discarded as mutations — but they still do not auto-bind, because neither carries
a directory word or a file word and the shape door is an allow-list. That is the fail-closed
behaviour working as designed, with the picker as the escape hatch. The case I pinned instead
(`list_folder_assets` / `get_asset_file`) is one where the substring rule genuinely changed the
BINDING outcome, so the RED is about behaviour rather than about a predicate.

**CR-02's `enumerate_tree` still binds, and should.** The review's driven output shows both
`purge_documents` → `read_tool` and `enumerate_tree` → `list_tool`. Only the first is the
defect. Under the fix the whole input binds nothing, because `enumerate_tree` carries no
directory word — but had it been `enumerate_directory`, binding it as the LISTER from its own
name would be correct and is not a CR-02 violation. The defect was prose choosing the READER.

**LO-01 is a frontend file.** My brief lists it under "Backend LOs"; the review correctly cites
`frontend/src/components/sources/sourceCapability.ts:60-64`. I did not touch it. **It belongs
with HI-01**, which the review itself says ("Fix the comment in the same change as HI-01").

---

## Deliberately not done

- **ME-02's second half — the watch receipt.** The review asks that `version: null` surface on
  the run receipt as *"this source states no version — changes cannot be detected"*. I fixed the
  binding (`list_directory_with_sizes` first in the preference order, so the reference server
  yields `size:N` versions and modification detection works at all). The receipt line is a
  `watch_service` + run-receipt surface change, outside the reviewed diff and outside a
  backend-only gap-closure round; it would need its own copy decision. **Not done, and it is a
  real remaining gap: a server offering neither sizes nor timestamps still syncs once and then
  reports `checked · 0 changes` forever.**
- **HI-01, HI-02, CR-01's UI half, LO-01** — frontend, second agent.
- **HI-04's UI control** — frontend, and currently in nobody's scope. Flagged above.

---

## Gate verdicts (verbatim)

Targeted, after every change:

```
286 passed, 1 warning in 2.85s
```

Full backend unit suite:

```
71 failed, 4188 passed, 2 xfailed, 2 xpassed, 45 warnings in 187.62s (0:03:07)
```

⚠ **The ceiling is `71` with ZERO headroom and it is met exactly.** `4113 → 4188` is `+75`
passing, all of them new cases from this round.

**The failing SET was diffed, not the count** (the `| tail` lesson). The 71 failures live in 24
files, and **not one is a file this round touched**:

```
test_061_consumer · test_071_1_threadpool_sweep · test_075_4_unknown_provider_error
test_111_1_reembed_kickoff · test_182_validate · test_190_review_fix_data_layer
test_200_1_phase_output_shape · test_chat_tool_approval · test_cross_worker_cancellation
test_db_runs · test_explorer_agent · test_extraction_service · test_forced_emit
test_get_model_capability_inference · test_lifespan · test_module7_tools
test_multimodal_query · test_per_format_ingestion · test_phase56_iteration_start
test_published_workflow_ownership · test_retrieval_service · test_sandbox_service
test_sql_service · test_streaming_reliability
```

The two connector-adjacent ones were opened and are unrelated to this diff:
`test_190_review_fix_data_layer` fails because the projection lacks `account_email` /
`account_name` (an OAuth column drift — I did not touch `_PROJECTION`);
`test_chat_tool_approval` fails on `KeyError: 'call_id'` in the chat approval path.

⚠ **`239-baseline/pytest-failing-set.txt`, named in my brief, does not exist** — not in the
worktree, not in the main tree, not under any name matching `*failing-set*`. So the promised
`comm` comparison was impossible and the set was verified by file attribution instead. Worth
regenerating for the next round.

Ledger + size gates:

```
ledger gate OK — every watched file has a row.
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

⚠ **The size gate failed first, on MY OWN row** — `[disposition-too-long] 205 chars (cap 200)`
for `connector_service.py`. Trimmed to 137. Recorded because that guard has now fired on its
author in the authoring turn, which is exactly what it was built to do.

---

## Ledger

Re-derived in the commit that lands them (`22eee1b56`):

| file | was | now |
|---|---|---|
| `mcp_source.py` | `2 / 1 / 643` | **`6 / 1 / 1022`** |
| `connector_service.py` | `23 / 9 / 1821` | **`24 / 9 / 1749`** |
| `models/connector.py` | `22 / 13 / 732` | **`23 / 13 / 751`** |
| `api/connectors.py` | `39 / 18 / 2051` | **`40 / 19 / 2071`** |

⚠ **`connector_service.py` SHRANK by 72 lines** despite gaining the CR-01 guard — the vocabulary
left. That is the rare right direction for a file whose extraction is owed.

⚠ **CLAUDE.md and `docs/HOT-FILE-LEDGER.md` DISAGREED about `connector_service.py` before this
round** — `23 / 9 / 1821` in one, `21 / 7 / 1601` in the other. A row that is present and wrong
answers an auditor with a number and stops the audit; two rows that disagree guarantee one of
them was doing that. Both now carry the same re-derived triple.

⚠ **`api/connectors.py` grew again** (2051 → 2071). Its extraction has been owed since Phase
233 and every round since has added to it, including this one (`_provider_said`, 11 lines).

---

## Commits

| hash | subject |
|---|---|
| `fe6da7122` | fix(239): a server may no longer choose which of its tools we run (CR-01, CR-02) |
| `86ba55ac1` | test(239): the boundary fence can now see the leak it was written for (ME-05, ME-06) |
| `6701d3f9f` | fix(239): a listing this app cannot parse is no longer reported empty (HI-03) |
| `f00f06f84` | fix(239): a tool set to deny is no longer callable as the source reader (ME-01) |
| `9e61fbdec` | test(239): the source contract is one body over every family, not four copies (LO-03) |
| `22eee1b56` | docs(239): ledger triples re-derived in the commit that lands them |

Not pushed. `master` and `production` untouched. `frontend/` untouched.

---

## Self-Check: PASSED

- All six commits present on `worktree-agent-a5c0400260f1332c5` above `dc021defc`.
- `239-04-SUMMARY.md` written to `.planning/phases/239-any-mcp-server-with-files/`.
- Targeted gate `286 passed`; full suite at the `71` ceiling with the failing set attributed;
  ledger and CLAUDE.md size gates green.
- Every structural fence in this round was driven RED against a defect planted in the SHIPPED
  file and the file restored md5-identical; hashes recorded above.
