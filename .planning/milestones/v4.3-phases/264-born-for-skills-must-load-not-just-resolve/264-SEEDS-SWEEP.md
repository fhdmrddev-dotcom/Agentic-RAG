---
status: recorded
phase: 264-born-for-skills-must-load-not-just-resolve
swept: 2026-09-22
swept_by: planner, after the four PLAN.md files existed
gate: "node scripts/check-seeds-register.cjs --phase 264 — exit 0, 310/310 parsed, 0 duplicate ids"
---

# Phase 264 — seeds register sweep (the re-run CONTEXT.md demanded)

⚠ **The context-time sweep matched 0 seeds, and CONTEXT.md said why: the phase had declared no
`files_modified` yet.** That reading was "a fact about the phase, not a clean sweep." This is the
re-run, against the real `files_modified` of all four plans (18 paths).

**Result: 14 seeds matched. None is folded into 264. Every one is left OPEN with its reason below.**
A leave-open needs no frontmatter edit — `status:` IS the index, and none of these seeds changes
state because of this phase. ⛔ What would be dishonest is leaving the match unrecorded, which is
what this file prevents.

⚠ **Read the gate's two unswept figures and never sum them:** `134 carry no trigger_when at all` ·
`114 carry prose but no structured trigger`. Most of the register is still unswept; the 14 below are
only what a structured match could see.

| Seed | Status | Why it matched | Routing |
|---|---|---|---|
| SEED-052 | planted | `**/agent_loop.py` | **Leave open.** Interactive todo-driven HITL execution. 264 adds one dataclass field to that file and reads it nowhere. Unrelated. |
| SEED-053 | planted | `**/task_service.py` | **Leave open.** Sub-agent tool/search events to the harness stream. 264 adds one propagated kwarg to `sub_ctx`. Unrelated. |
| SEED-054 | planted | `**/agent_loop.py` | **Leave open.** Output-file subtitle + file icon. Unrelated. |
| SEED-170 | planted | `tool_dispatcher.py` | **Leave open.** Two shipped comments crediting `OutputFileCard` for work it does not do. 264 touches neither comment. ⚠ Adjacent in spirit — 264 DOES retire two prose blocks deliberately (D-264-02), which is the correct handling of exactly this failure mode; SEED-170's own two comments stay unfixed. |
| SEED-177 | partially-answered | the broad `backend/app/**` glob | **Leave open.** MCP connections both ways. A glob match, not a real trigger. ⭐ Its *rule* is honoured by this phase: D-264-02 retires two pieces of prose DELIBERATELY with their reasons rewritten, never tripped by surprise — the SEED-177 discipline, precedent D-206-07. |
| SEED-188 | open | `backend/app/**`, `backend/tests/**` | **Leave open, and named as the nearest real neighbour.** Four modules carry an anti-prompt-injection discipline that nothing tries to break. 264 is a tenancy-predicate change, not a content-channel one; its own injection surface (a UUID spliced into the PostgREST `.or_()` DSL) IS driven — `coerce_uid` raises on a malformed bundle id, with its own RED-driven arm (264-02 T1). That closes 264's slice and nothing of SEED-188's. |
| SEED-192 | planted | `agent_loop.py` | **Leave open.** The 12.4 KB shared system prompt. 264 does not touch prompt assembly — and `agent_loop.py`'s standing named seam (the prompt-assembly block) is explicitly recorded as still OWED in 264-04 T2. |
| SEED-198 | partially-answered | `backend/app/**` | **Leave open.** Experts as a bundle over four subsystems. 264 completes the run-time half of the SKILLS axis (PACK-17) and no other arm. |
| SEED-272 | planted | `tool_dispatcher.py` | **Leave open.** A failed attachment copy never gives up and never recovers. Different handler, different subsystem. |
| SEED-284 | planted | `docs/HOT-FILE-LEDGER.md` | **Leave open.** Three file-local elapsed formatters. Matched only because 264-04 edits the ledger. Not a code touch. |
| SEED-288 | planted | `run_producer.py`, `**/agent_loop.py` | **Leave open.** Todo reconciliation against what a run did. Unrelated. |
| SEED-291 | partially-answered | `tool_dispatcher.py`, `agent_loop.py` | **Leave open, and consistent with it.** The Extension Contract: a plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED CODE, never engine code. ⭐ 264 adds **no** engine branch — 264-01 pins zero branches reading the new field and the closed-core AST invariant on `agent_loop.py` stays green by construction. The phase is evidence FOR the contract, not a change to it. |
| SEED-299 | planted | `task_service.py`, `run_producer.py` | **Leave open.** A stranded Deep run's token count. Unrelated. |
| SEED-303 | partially-answered | `expert_service.py`, `run_producer.py`, `**/agent_loop.py`, `**/tool_dispatcher.py` | **Leave open — and this is the one that needed a real look.** Its SKILLS-axis arm (*"additive — a skill is method, never a fence"*) is about `member_skills` being an override catalog; its S9 arm folded into 263. 264 closes neither: it makes an already-resolvable born-for skill **loadable**, which is the run-time completion of 263's S9 work, not a new arm. ⛔ The remaining arms (S3 two Experts, S8 clone-on-customise, per-Expert spend attribution) are untouched, so the seed stays `partially-answered` with no edit. |

## The seed that did NOT match, and must still be proven untriggered

⛔ **`SEED-129`** (`status: open`, priority high) — *residual org-blind service-role skill reads.* It
did not appear in the structured sweep, but RESEARCH §2.10 measured its third re-open trigger as
firing on *"any future phase [that] touches … the `agent_loop.py` skill-catalog block"*
(`agent_loop.py:1435`, which still carries the pre-SEED-125 flat predicate on the service-role
client). **Phase 264 deliberately does not touch those lines** — an Expert run takes the
`skill_catalog_override is not None` branch and never runs that query.

⚠ **A sweep that cannot see a trigger is not the same as a trigger that did not fire.** 264-04 Task 3
carries the obligation to PROVE the non-touch with
`git diff f04d9c406..HEAD -- backend/app/services/agent_loop.py` over that block, and to record the
proof. If any plan does edit those lines for any reason, SEED-129's obligation attaches and must be
routed before the phase closes.
