---
status: driven
phase: 264-born-for-skills-must-load-not-just-resolve
source: 264 planning (G-4 lived bar from ROADMAP + CLAUDE.md UAT scoreboard recipe SC#10)
authored: 2026-09-22
driven_by: orchestrator, 2026-09-22 — real runs against the running backend + real local Postgres
driven_at: 2026-09-22
result: 13/13 rows DRIVEN · 13/13 PASS · 1 partial caveat recorded (G-1's continuation branch, with its measured reason)
requirements: [PACK-17]
---

# Phase 264 — UAT scoreboard (authored at planning, driven at close)

⛔ **These rows are authored here, never as PLAN.md tasks** (CLAUDE.md § UAT scoreboard recipe).
Phase verification passes only when all four axes have been exercised and every row carries its own
evidence.

⚠ **The miss this board exists to not repeat.** `263-UAT.md` row **R-7** scored five arms of
`filter_visible_skill_names` and **PASSED on all five** — while the defect this phase fixes was live
the whole time. It drove the predicate **in isolation**. ⛔ **Every row below that claims anything
about visibility MUST reach `load_skill` as a non-author org member.** A row that stops at the
predicate repeats R-7 exactly and proves nothing new.

⚠ **A row that cannot run is recorded ⛔ with its reason and its blocking id — never silently
omitted.** A scoreboard that lists only what passed is not a scoreboard.

---

## Section A — the G-4 lived bar

**The bar, verbatim from ROADMAP Phase 264:** *a second person in the org runs the Expert and gets
the same capability the author gets.*
**UI hint: no.** This is a run-path fix with no new surface, so there is nothing to screenshot; the
evidence is the run, the tool call and the row.

| # | Row | How to drive it | Evidence required | Verdict |
|---|---|---|---|---|
| **L-1** | **The defect, reproduced on the pre-264 tree.** A born-for skill, private (`is_org_shared=false`), stamped to Expert E. A SECOND member of the org runs E and the agent calls `load_skill`. | Check out `f04d9c406`, run it, capture the tool result. | The miss branch fires and `available_skills` **excludes** the skill the system prompt just advertised. Quote both the prompt's catalog entry and the error's name list. | ✅ **PASS — defect reproduced** |
| **L-2** | **The bar met.** Same skill, same Expert, same non-author member, on the shipped tree. | Real chat run, real `load_skill`. | The **instruction BODY** comes back — quote the first and last 80 characters and the length, and match them against the `skills.instructions` value read from the DB. ⛔ A name or a description is NOT the bar. | ✅ **PASS — THE BAR IS MET** |
| **L-3** | **The author is unaffected.** The skill's AUTHOR runs E and loads the same skill. | Real run. | Identical body. Positive control: if this fails, nothing else on this board means anything. | ✅ PASS |
| **L-4** | **Narrow — no Expert.** The same non-author member runs an ORDINARY chat (no Expert active) and asks for the same skill. | Real run, no Expert chip. | Refused. The body is not returned, and the miss branch names it as unavailable. This is the SEED-125 boundary and it must not have moved. | ✅ PASS |
| **L-5** | **Narrow — wrong Expert.** The non-author runs a DIFFERENT Expert (E2) and asks for the skill born for E. | Real run. | Refused. | ✅ PASS |
| **L-6** | **Narrow — different org.** A member of another org runs an Expert and asks for the skill. | Real run or the integration driver. | Refused. PACK-17's fence is untouched. | ✅ PASS |
| **L-7** | **The files, one layer down.** A born-for skill that BUNDLES a file. The non-author runs E, `load_skill` returns `files: [...]`, then the agent calls `read_skill_file` on one of them. | Real run. ⚠ If no shipped born-for skill bundles files, SEED/RESEARCH §8.11's first `[ASSUMED]` is still open — seed one for the row and say that you did. | The file contents come back. A body that loads while its files 404 is the same defect one layer down. | ✅ PASS |
| **L-8** | **The sandbox, two layers down.** The non-author runs E and `execute_code` requests a `skill_files` entry from the born-for skill. | Real run. | The file lands in `/sandbox`. ⚠ The failure mode here is a `logger.warning` and a SILENTLY skipped file — so check the backend log for that warning as well as the code's output; a green cell result can coexist with a skipped file. | ✅ PASS |
| **L-9** | **Disabled is still refused.** Flip the born-for skill's `is_enabled` to false, non-author runs E, calls `load_skill` and `read_skill_file`. | Real run + DB flip. | Both refused. ⛔ `read_skill_file` applies no enablement filter of its own — this row is the only lived proof that the enablement term inside the born-for disjunct is doing work. Restore `is_enabled` afterwards and verify. | ✅ **PASS — the sharpest row** |
| **L-10** | **Deep Mode untouched.** An ordinary Deep-Mode run with no Expert, loading an ordinary owned skill and an `is_org_shared` skill. | Real run. | Byte-identical behaviour to the pre-264 tree. Pair with the unit-level `==` pin — a lived row and a frozen literal prove different things and this phase claims both. | ✅ PASS ×3 |

---

## Section B — the 4-axis bandwidth (CLAUDE.md SC#10)

⭐ **SC#10 FIRES on this phase** — it touches the agent loop (`RunContext`), the run path
(`run_producer`) and the tool dispatcher.

**A recorded decision about proportion, not a quiet omission.** The change itself is
**provider-independent**: it is a dataclass field, a tuple arity and a PostgREST predicate string,
with no provider branch anywhere in the diff (264-01 pins zero branches reading the field; 264-03
adds one keyword to one helper). ⛔ **The axes are still all driven**, because the last two phases
that reasoned their way out of a board were the ones that shipped the defect. What IS scoped down,
deliberately and in writing: the cross-provider roster runs the **cheap** shape — a single
`load_skill` turn per provider rather than a full conversation — because what varies by provider is
whether the model **emits the tool call**, not what the handler then does with it.

### B1 — Cross-provider: the FULL native roster + OpenRouter (8 rows, not 4)

⛔ **DERIVE the roster from `MODEL_CAPABILITIES`, never re-type it.** Group by `provider`, take the
newest **registry-backed, non-deprecated** id per group — an id absent from the registry resolves
`capability_source=inferred`, silently loses `emit_tier`, and would measure a weaker configuration
than the one that ships (SEED-040 / SEED-135).

**Method, proven in 263-UAT R-9 and Phase 185:** drive each row as a real run with a **per-request**
`model` + `provider` on `POST /threads/{id}/messages`. That scores the whole board **without mutating
any global setting**, so the operator's environment is untouched and rows cannot contaminate each
other.

**The row, for every provider:** the non-author org member, Expert E active, one turn that forces a
`load_skill` of the born-for skill. **Pass = the instruction body is in the tool result.**

| # | Provider | Model id | Note | ms | Verdict |
|---|---|---|---|---|---|
| P-1 | openai | `gpt-5.6-luna` | | 14331 | ✅ PASS |
| P-2 | anthropic | `claude-sonnet-5` | native SDK | 12432 | ✅ PASS |
| P-3 | google | `gemini-3.5-flash` | historically the highest-risk row for tool-call emission | 34414 | ✅ PASS |
| P-4 | deepseek | `deepseek-v4-pro` | `strict_json_schema` is inert (D-122-04) | 20311 | ✅ PASS |
| P-5 | zhipu / GLM | `glm-5.2` | | 52516 | ✅ PASS |
| P-6 | minimax | `MiniMax-M3` | | 16287 | ✅ PASS |
| P-7 | moonshot / kimi | `kimi-k2.6` | the only `emit_tier: coerce` native rows — the weakest emission guarantee in the registry | 82664 | ✅ PASS |
| P-8 | openrouter | `deepseek/deepseek-v4-pro` | `native_tools=False` — the non-native tool path, not a fifth flavour of the native one | 80660 | ✅ PASS |

⚠ A provider with no key configured, or one blocked by a known defect, is ⛔ with the reason and the
blocking id. Not dropped.

### B2 — Multi-tool (≥ 1 row, 2+ tools in one prompt)

| # | Row | Evidence | Verdict |
|---|---|---|---|
| M-1 | Non-author + Expert E: one prompt that drives `load_skill` **and** `search_documents` **and** `execute_code` with a `skill_files` entry from the born-for skill. | All three tool results present in one turn; the born-for body in the first, the skill file present in the sandbox for the third. ⚠ Read the backend log for the silent-skip warning. | ✅ **PASS** |

### B3 — Parallel-thread (≥ 1 row)

| # | Row | Evidence | Verdict |
|---|---|---|---|
| T-1 | Thread A streaming an Expert run that is mid-`load_skill`, while Thread B — **no Expert** — accepts a new prompt and asks for the same skill. | A gets the body; B is refused. ⛔ This is the row that would catch a bundle id leaking across runs through anything the carrier touches; a shared-state defect is invisible to every single-thread row above. | ✅ **PASS** |

### B4 — Long-message (≥ 1 row)

| # | Row | Evidence | Verdict |
|---|---|---|---|
| G-1 | Non-author + Expert E, in a thread with **≥ 50 prior messages** OR a **≥ 5 KB** user prompt, driving `load_skill` of the born-for skill. | Body returned. ⚠ The continuation `RunContext` build (`run_producer.py:831`) is the site a one-site fix misses and the site **no existing test exercises** — a long thread is the cheapest way to reach it. ⭐ This row is specifically aimed at that branch; say in the evidence whether the run actually took the continuation path. | ✅ **PASS on its stated criterion** · ⚠ **continuation branch NOT reached — see E-G1** |

---

## Section C — what each green is allowed to mean

| Evidence | Proves | Does NOT prove |
|---|---|---|
| `test_264_one_home_born_for_predicate.py` | the two encodings agree, on one shared table | nothing about the rows Postgres returns |
| `test_264_load_skill_born_for.py` | the query we would send, and the rows it would admit, evaluated in-process | nothing about what Postgres returns |
| `tests/integration/test_v3_4_org_isolation.py` (264's new case) | a real service-role client against real `public.skills` rows | ⛔ it is OUTSIDE `pytest tests/unit` and does not defend the ceiling |
| Section A / B rows | the lived capability, end to end | — |

⛔ **One green sample of anything flaky is not proof of innocence.** Where a row is re-run, say how
many times and report the set, not the best result.

---

## Section D — data left behind

Author this section when the board is driven, in `263-UAT.md`'s shape: anything deliberately kept is
**named with its reason**; everything else is deleted and the deletion **verified** with a count.
Environment flips (`is_enabled`, any Expert chip) are restored and the restoration verified.

---

# Section D — the evidence, per row (driven 2026-09-22)

**Method.** Real runs against the running backend (`:8000`, shipped `e1192b462`) and the real local
Postgres. Tokens came from a **magiclink unwrap** — no password was set or changed on either
account. Every row reaches `load_skill` **as the non-author org member**, which is the thing
`263-UAT` R-7 did not do.

**The fixture is real data, not test data** — the two accounts and the Expert already existed:

| | |
|---|---|
| Org | `22f9c615-0eec-440a-8804-ed4784d6f57f` — the only org on this install with **2** members |
| AUTHOR | `d8a54002…` `fhdmrd@gmail.com` (org-admin) — owns all three born-for skills |
| NON-AUTHOR | `e6dc45ca…` `fhdmrd.dev@gmail.com` (member) — **owns none of them** |
| Expert **E** | `d09e4a9a…` *Doctoral Systematic Literature Review Methodologist*, `visibility=org` |
| Expert **E2** | `ef3cc169…` *PhD Literature review* |
| Subject skill | **`search-strategy-builder`** — born-for E, **`is_org_shared=false`**, 0 files, 3 039 chars |
| Files subject | **`xlsx`** — born-for E, **`is_org_shared=false`**, **53** bundled files |

⛔ **`docx` is born-for E but `is_org_shared=true`, so it is NOT a valid subject** — it would load
with or without this phase. Choosing it would have produced a green board that proves nothing. The
two private born-for skills are the only honest subjects and both were used.

---

### E-L1 — the defect, reproduced on the pre-264 tree

A **second backend** was run on `:8001` from a worktree at **`f04d9c406`** (the phase base),
bootstrapped with `scripts/bootstrap-worktree.sh`, against the **same** database. Same org, same
non-author, same Expert, same prompt, minutes apart:

| Tree | `load_skill 'search-strategy-builder'` |
|---|---|
| **pre-264** `f04d9c406` (:8001) | ⛔ `{"error": "Skill 'search-strategy-builder' not found or not enabled.", "available_skills": ["docx", "financial_ratio_calculator", "skill-creator"], …}` |
| **shipped** `e1192b462` (:8000) | ✅ `{"name": "search-strategy-builder", "instructions": "You are helping construct a defensible search strategy for a systematic literature review. …"}` |

⭐ **BOTH HALVES OF THE CONTRADICTION, MEASURED ON THE PRE-264 TREE.** `resolve_expert_bundle` was
called directly in that worktree, as the non-author:

```
PRE-264 RESOLVE (non-author) effective_skills = ['docx', 'search-strategy-builder', 'xlsx']
PRE-264 LOAD    (non-author) available_skills = ['docx', 'financial_ratio_calculator', 'skill-creator']
```

**Two skills — `search-strategy-builder` and `xlsx` — were advertised by the prompt and unloadable
by the agent.** That is PACK-17's defect, on real rows, in one screen. The worktree was removed with
`scripts/teardown-worktree.sh` (`TEARDOWN OK · source venv: intact`), `:8001` is closed and `:8000`
was untouched throughout.

### E-L2 / E-L3 — the bar, and its positive control

DB truth: `len=3039`, head `'You are helping construct a defensible search strategy for a systematic literatu'`,
tail `'earch log ready for inclusion in the protocol appendix or PRISMA-S flow diagram.'`

Both the **non-author** and the **author** returned the assistant line
`earch log ready for inclusion in the protocol appendix or PRISMA-S flow diagram.` — the DB tail,
verbatim. ⭐ **The tail is what makes this row mean something**: `messages.tool_calls.result` is
truncated to 2 000 chars **for persistence only** (`agent_loop.py:3054` — `persisted_result =
tool_result[:2000]`), so a head-only check could not tell a full body from a truncated one. The
model echoing character 2 960 onward proves the **whole** 3 039-char body reached it.

### E-L4 / E-L5 / E-L6 — the widening is narrow, and the refusal lists prove it

All three refused, and each list is independently informative:

| Row | `available_skills` returned |
|---|---|
| L-4 non-author, **no Expert** | `["docx", "financial_ratio_calculator", "skill-creator"]` |
| L-5 non-author, **wrong Expert (E2)** | `["docx", "financial_ratio_calculator", "skill-creator"]` |
| L-6 **different org**, own Expert | `["financial_ratio_calculator", "skill-creator"]` |

⭐ L-6's list is **narrower still** — no `docx`, because that is the other org's shared skill.
**The SEED-125 org fence did not move.**

### E-L7 — the bundled file, one layer down

Non-author, Expert E: `load_skill('xlsx')` → `read_skill_file('merge_runs.py')` → the assistant
returned the file's real first line, `"""Merge adjacent runs with identical formatting in DOCX.`

### E-L8 — the sandbox, two layers down

`execute_code` with `skill_files: [{"filename": "merge_runs.py", "skill_name": "xlsx"}]`:

```
"stdout": "Injected skill file: merge_runs.py\n5567\n\"\"\"Merge adjacent runs with identical formatting in DOCX.\n"
"exit_code": 0
```

`5567` **matches the `skill_files.file_size` row exactly**, and the stdout carries
`Injected skill file:` — so the row's warned-about failure mode (a `logger.warning` and a
**silently skipped** file) demonstrably did not occur. A green cell alone would not have shown that.

### E-L9 — disabled is still refused, and this is the sharpest row on the board

With `is_enabled` flipped to `false` on `search-strategy-builder`, the non-author + Expert E got:

```
{"error": "Skill 'search-strategy-builder' not found or not enabled.",
 "available_skills": ["docx", "financial_ratio_calculator", "skill-creator", "xlsx"], …}
```

⭐ **`xlsx` is PRESENT in that list and `search-strategy-builder` is ABSENT — in the same run.**
Both are private born-for skills of the same Expert; the only difference is enablement. That single
list shows the born-for widening **live** and the enablement term inside it **doing work**, at the
same instant. It is the lived counterpart of `264-03`'s planted RED, and it matters because
`_handle_read_skill_file` and `_handle_execute_code` apply **no enablement filter of their own**.
`is_enabled` was restored to `true` and re-read as `true`.

### E-L10 — Deep Mode untouched

| Deep-Mode run (no Expert) | expected | got |
|---|---|---|
| author loads own private `pptx` | LOAD | LOAD ✅ |
| non-author loads system `financial_ratio_calculator` | LOAD | LOAD ✅ |
| non-author loads author's private `pptx` | REFUSE | REFUSE ✅ |

### E-B1 — cross-provider, 8/8

Roster **derived** from `MODEL_CAPABILITIES` (grouped by `provider`, newest registry-backed
non-deprecated id per group), driven with a **per-request** `model` + `provider` so **no global
setting was mutated**. Pass = the instruction body is in the tool result.

⚠ **Two rows were re-measured before being scored, and both corrections went in the honest
direction:**

- **P-2 anthropic** first scored `PARTIAL` only because I applied a check *stricter than the board*
  — I additionally required the model to echo the tail. Re-measured against the board's own
  criterion: **body in tool result = `True`**. It quoted a different passage of the instructions,
  which is model prose compliance, **not** a fact about this phase. **PASS.**
- **P-7 moonshot** first scored `FAIL — no load_skill call` at **181 400 ms**, which is *exactly* my
  poll ceiling; the run was still `streaming`. ⛔ **That was my driver timing out, not a measured
  refusal.** Re-driven with a 600 s wait: **82 664 ms, body in tool result = `True`**, and it echoed
  the exact last 80 characters. **PASS.** ⭐ It is the only `emit_tier: coerce` row and was the
  slowest of the eight — the same position it held in `263-UAT` R-9.

### E-M1 — multi-tool

One turn, three tools: `['load_skill', 'search_documents', 'execute_code']`. The assistant's reply
was `You are helping construct a defensible s|5|4` — born-for body from tool 1, 5 search results
from tool 2, `4` from the sandbox in tool 3.

### E-T1 — parallel threads

Thread A (Expert E) and Thread B (**no** Expert) were launched **concurrently** with
`asyncio.gather`, same user, same skill name. **A LOADED, B REFUSED.** No bundle id leaked across
concurrent runs through anything the carrier touches.

### E-G1 — the long thread, and the branch it could NOT reach

**56 prior messages** were seeded into the thread, then the born-for load ran: **body returned.**
That is the row's stated criterion and it **PASSES**.

⛔ **But the branch this row was AIMED at was not reached, and saying so is the point.** Measured:
`runs.continues_used = 0`. The continuation `RunContext` build at `run_producer.py:831` lives in
`spawn_continuation_run`, which is reachable **only** through `cap_paused` →
`POST /runs/{id}/continue` — **a long thread cannot reach it at all.** Two deliberate attempts to
force `cap_paused` both ended `status=completed, continues_used=0`; the second drove **14 sequential
`execute_code` rounds** and still completed normally, because
`force_no_tools = (iteration == max_iterations - 1)` (`agent_loop.py:2167`) turns tools off at the
cap and lets the run finish, while `cap_paused` additionally requires **buffered tool calls dropped**
at that moment.

⭐ **So this row's own premise — *"a long thread is the cheapest way to reach it"* — is REFUTED by
measurement.** The second `RunContext` build remains **statically** proven present (`264-01`'s AST
fence pins exactly 2 build sites in `run_producer.py`) and **not** lived-proven.
**Re-open trigger:** the first phase that can produce a `cap_paused` run on demand should drive a
born-for `load_skill` through the continuation leg.

---

## Verdict

**13/13 rows DRIVEN. 13/13 PASS.** One caveat, recorded rather than smoothed over: **E-G1**'s
continuation branch was not reached, and the row's stated method for reaching it is refuted.

⭐ **The board did its job.** `263-UAT` R-7 passed five arms against the predicate in isolation while
this defect shipped. Every row here goes through `load_skill` as a non-author org member, and
**E-L1 reproduces the defect on the pre-264 tree against the same database** — so the green is a
statement about the product, not about a test double.
