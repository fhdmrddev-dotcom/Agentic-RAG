---
status: authored
phase: 264-born-for-skills-must-load-not-just-resolve
source: 264 planning (G-4 lived bar from ROADMAP + CLAUDE.md UAT scoreboard recipe SC#10)
authored: 2026-09-22
driven_by: TBD — operator or orchestrator, at phase close
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
| **L-1** | **The defect, reproduced on the pre-264 tree.** A born-for skill, private (`is_org_shared=false`), stamped to Expert E. A SECOND member of the org runs E and the agent calls `load_skill`. | Check out `f04d9c406`, run it, capture the tool result. | The miss branch fires and `available_skills` **excludes** the skill the system prompt just advertised. Quote both the prompt's catalog entry and the error's name list. | |
| **L-2** | **The bar met.** Same skill, same Expert, same non-author member, on the shipped tree. | Real chat run, real `load_skill`. | The **instruction BODY** comes back — quote the first and last 80 characters and the length, and match them against the `skills.instructions` value read from the DB. ⛔ A name or a description is NOT the bar. | |
| **L-3** | **The author is unaffected.** The skill's AUTHOR runs E and loads the same skill. | Real run. | Identical body. Positive control: if this fails, nothing else on this board means anything. | |
| **L-4** | **Narrow — no Expert.** The same non-author member runs an ORDINARY chat (no Expert active) and asks for the same skill. | Real run, no Expert chip. | Refused. The body is not returned, and the miss branch names it as unavailable. This is the SEED-125 boundary and it must not have moved. | |
| **L-5** | **Narrow — wrong Expert.** The non-author runs a DIFFERENT Expert (E2) and asks for the skill born for E. | Real run. | Refused. | |
| **L-6** | **Narrow — different org.** A member of another org runs an Expert and asks for the skill. | Real run or the integration driver. | Refused. PACK-17's fence is untouched. | |
| **L-7** | **The files, one layer down.** A born-for skill that BUNDLES a file. The non-author runs E, `load_skill` returns `files: [...]`, then the agent calls `read_skill_file` on one of them. | Real run. ⚠ If no shipped born-for skill bundles files, SEED/RESEARCH §8.11's first `[ASSUMED]` is still open — seed one for the row and say that you did. | The file contents come back. A body that loads while its files 404 is the same defect one layer down. | |
| **L-8** | **The sandbox, two layers down.** The non-author runs E and `execute_code` requests a `skill_files` entry from the born-for skill. | Real run. | The file lands in `/sandbox`. ⚠ The failure mode here is a `logger.warning` and a SILENTLY skipped file — so check the backend log for that warning as well as the code's output; a green cell result can coexist with a skipped file. | |
| **L-9** | **Disabled is still refused.** Flip the born-for skill's `is_enabled` to false, non-author runs E, calls `load_skill` and `read_skill_file`. | Real run + DB flip. | Both refused. ⛔ `read_skill_file` applies no enablement filter of its own — this row is the only lived proof that the enablement term inside the born-for disjunct is doing work. Restore `is_enabled` afterwards and verify. | |
| **L-10** | **Deep Mode untouched.** An ordinary Deep-Mode run with no Expert, loading an ordinary owned skill and an `is_org_shared` skill. | Real run. | Byte-identical behaviour to the pre-264 tree. Pair with the unit-level `==` pin — a lived row and a frozen literal prove different things and this phase claims both. | |

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
| P-1 | openai | *(derive)* | | | |
| P-2 | anthropic | *(derive)* | native SDK | | |
| P-3 | google | *(derive)* | historically the highest-risk row for tool-call emission | | |
| P-4 | deepseek | *(derive)* | `strict_json_schema` is inert (D-122-04) | | |
| P-5 | zhipu / GLM | *(derive)* | | | |
| P-6 | minimax | *(derive)* | | | |
| P-7 | moonshot / kimi | *(derive)* | the only `emit_tier: coerce` native rows — the weakest emission guarantee in the registry | | |
| P-8 | openrouter | *(derive)* | `native_tools=False` — the non-native tool path, not a fifth flavour of the native one | | |

⚠ A provider with no key configured, or one blocked by a known defect, is ⛔ with the reason and the
blocking id. Not dropped.

### B2 — Multi-tool (≥ 1 row, 2+ tools in one prompt)

| # | Row | Evidence | Verdict |
|---|---|---|---|
| M-1 | Non-author + Expert E: one prompt that drives `load_skill` **and** `search_documents` **and** `execute_code` with a `skill_files` entry from the born-for skill. | All three tool results present in one turn; the born-for body in the first, the skill file present in the sandbox for the third. ⚠ Read the backend log for the silent-skip warning. | |

### B3 — Parallel-thread (≥ 1 row)

| # | Row | Evidence | Verdict |
|---|---|---|---|
| T-1 | Thread A streaming an Expert run that is mid-`load_skill`, while Thread B — **no Expert** — accepts a new prompt and asks for the same skill. | A gets the body; B is refused. ⛔ This is the row that would catch a bundle id leaking across runs through anything the carrier touches; a shared-state defect is invisible to every single-thread row above. | |

### B4 — Long-message (≥ 1 row)

| # | Row | Evidence | Verdict |
|---|---|---|---|
| G-1 | Non-author + Expert E, in a thread with **≥ 50 prior messages** OR a **≥ 5 KB** user prompt, driving `load_skill` of the born-for skill. | Body returned. ⚠ The continuation `RunContext` build (`run_producer.py:831`) is the site a one-site fix misses and the site **no existing test exercises** — a long thread is the cheapest way to reach it. ⭐ This row is specifically aimed at that branch; say in the evidence whether the run actually took the continuation path. | |

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
