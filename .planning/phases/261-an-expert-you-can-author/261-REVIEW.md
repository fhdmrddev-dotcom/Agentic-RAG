# Phase 261 — SCOPED REVIEW (claude)

**Scope:** `D-v4.3-03`. Reviewed: PACK-07, PACK-08, PACK-09, PACK-10, closed-core inventory.
⛔ **EXCLUDED by decision:** `D-v4.3-01` union composition and `D-v4.3-02` tool floor — claude
authored those decisions and `BUG-260920-01`, so reviewing their implementation would be
self-assessment. **The operator verifies those two live.**

**Base:** `f3a1fe66f` · **HEAD reviewed:** `c135e8029` · **Date:** 2026-09-20
**Method:** re-driven, not read. Fences planted RED, source restored, call sites traced to their
terminals. Gemini's SUMMARY figures were not taken as evidence.

**Verdict: REVISE — 1 confirmed finding on a phase criterion, 2 minor.**

---

## F-1 · CONFIRMED · major — `PACK-10`'s *"nor invite it"* is UNMET

**The criterion (ROADMAP, Phase 261 SC#5), verbatim:** *"An Expert can be restricted to named
users or roles beyond `private | org | public`, and a user outside that set can neither **see** it
nor **invite** it — driven against a bundle whose row is readable while the grant is absent."*

**The *see* half is enforced.** `list_expert_bundles_for_caller` (`backend/app/db/experts.py:200`)
evaluates `visibility` and `expert_grants` correctly; an ungranted row is **absent** from the list,
not greyed out.

**The *invite* half is enforced nowhere.** **Four** reachable surfaces, all gated on **org only**:

| Surface | Gate found | Grant check |
|---|---|---|
| `GET /experts/{bundle_id}` (`api/experts.py:195`) | `get_active_org_id` → `get_expert_service(caller_org_id=…)` — **takes no user id at all** | ❌ |
| `GET /experts/{bundle_id}/resolve` (`api/experts.py:215`) | `resolve_expert_bundle` phase 1 = `is_system OR org_id == caller_org_id` (`expert_service.py:196`) | ❌ |
| `PATCH /threads/{id}` setting `active_expert_id` (`api/threads.py:720-728`) | `check_entitlement(pool, org, "experts")` — **tier only** | ❌ |
| `get_expert_by_slug` → `get_expert_bundle_by_slug(pool, slug, caller_org_id)` | org only — **no user id** | ❌ |

⭐ **The decisive evidence: `check_expert_grant_access` — the function written for exactly this —
has ZERO production call sites.** Traced across `backend/`: 1 definition (`db/experts.py:275`) and
**15 references, all inside `tests/unit/test_261_expert_grants_db.py`.** The test proves the
predicate is correct; nothing in the product asks it.

**Failure scenario, concrete.** An org-admin authors *HR Advisor*, sets `visibility='granted'`, and
grants it to three named people. Any of the other 200 members of that org who obtains the bundle's
UUID can (a) `GET /experts/{id}` and read the full manifest — name, folders, skills, connections —
and (b) `PATCH /threads/{id}` with `active_expert_id` and hold a fully scoped conversation with it.
The list never showed it to them; nothing refused them.

⚠ **This is an INTRA-ORG gap, not a tenant leak.** `resolve_expert_bundle`'s org clause and
`PACK-04`'s member stripping both hold — a cross-org caller still gets `None`. RLS on
`expert_grants` is present and correct (mig 189:43-70). The breach is *inside* one org, which is
exactly the boundary `PACK-10` was added to create.

⚠ **The slug surface is the worst of the four**, and it was found by an independent second trace rather than the first: a UUID must be obtained, a **slug can be guessed** (`financial-analyzer`, `hr-advisor`). Recorded because one search finding three surfaces and a second finding a fourth is the tell that a call-site sweep must be re-derived, never trusted at first pass.

**Fix shape:** thread `caller_user_id` + `caller_roles` into all three surfaces and call the
function that already exists. Drive it RED against a readable-row/absent-grant bundle, the way
`PACK-04` drove the member check.

---

## F-2 · CONFIRMED · minor — `PACK-09` brainstorm upload decodes any file as UTF-8

`api/experts.py:106-114`:

```python
data = await f.read()
text = data.decode("utf-8", errors="replace")[:30000]
```

A **PDF or DOCX** — the two formats an admin most obviously drops in to brainstorm from — decodes
to replacement-character noise, which is then joined into `brainstorm_text` and handed to the
drafting model as though it were content. The result is a **silently worse draft**; nothing tells
the admin the file was unreadable.

⭐ **The non-ingestion guarantee itself is sound and structural** — files are read into memory,
sliced, joined and dropped. Zero references to `documents`, `chunks`, embeddings or storage
anywhere in `services/expert_authoring.py`. `POST /experts/draft` returns `ExpertDraftOutput` and
performs **no insert**; saving is the separate `POST /experts`, so *no auto-publish* holds too. The
retention/deletion arm is satisfied by construction (nothing is stored) — but that should be
**stated** as the reason rather than left as an absence.

This project already ships real extractors (`pypdf`, `python-docx`). Either use them, or refuse the
file with a named reason.

---

## F-3 · PLAUSIBLE · minor — unbounded read before the truncation

Same site: `await f.read()` loads the **entire** upload into memory, and the `[:30000]` slice
happens afterwards. A large file is fully resident before being discarded. There may be an upstream
body limit; I did not find one on this router. Cap the read, not the slice.

---

## What I verified GOOD, by driving it

| Criterion | Evidence |
|---|---|
| **PACK-07** — existing endpoints, no second router | Exactly **one** `APIRouter` in `api/experts.py:29`, mounted **once** (`main.py:902`). The 9 write verbs in `lib/api/experts.ts` are additions to that router, not a parallel surface |
| **PACK-08** — `role_permissions`, not a branch | `require_expert_manage` → `_has_org_permission(..., "experts:manage")`; mig 189 seeds the key for `super-admin` + `org-admin`, so granting another role is a **row change**. Fence **DRIVEN RED**: planted `if current_user['role'] == 'org-admin'` in `api/experts.py` → `test_no_hardcoded_role_checks_in_expert_backend` **FAILED**; removed → passes |
| **PACK-09** — no ingestion, no auto-publish | see F-2 — the guarantee holds structurally |
| **PACK-10** — RLS on the grant table | mig 189:43 `ENABLE ROW LEVEL SECURITY`, read + write policies, grants to `authenticated`/`service_role`. The *table* is right; the *callers* are F-1 |
| **Closed-core inventory** — counted, not substring-matched | AST-counted at **base and HEAD**: `_TOOL_REGISTRY` **29 → 29**, `EXPERT_CORE_TOOLS` **10 → 10**. `EXPERT_DELIVERABLE_TOOLS` (4) is new but widens *which existing tools an Expert may call* — it registers nothing. The phase's own fence pins 7 phase types / 1 emitter / 29 tools / 10 core. Fence **DRIVEN RED**: planted `"planted_expert_runtime"` in `_TOOL_REGISTRY` → `test_tool_dispatcher_contains_zero_expert_tools_or_dispatchers` **FAILED**; removed → passes |
| 261's six test files | **33 passed**, run in `backend/venv` |

⚠ **Restore honesty:** after both plants, `git diff` is **empty** — content identical to HEAD. One
file's **md5 differs** because `core.autocrlf` re-materialised it CRLF on `git checkout --`. That is
this repo's known trap, not a residue of the plant. *Content*-identical, not *byte*-identical.

⚠ **NOT verified by me:** the full-gate figures in `261-05-SUMMARY.md` (backend `71 ≤ 71` / 5209
passed, vitest `297/297` / 8487, tsc, schema parity 155/155). I ran the six 261 files and the two
fences only. Those totals remain **gemini's claim**, not this review's measurement.

---

## Owed to the OPERATOR — inside the excluded arms, so not closeable here

Both reported 2026-09-20 and unaddressed in `BUS-295`:

1. **`restricted` mode names only the first folder.** `run_producer.py` sets
   `scoped_folder_path = _get_path(expert_folder_ids[0])`. An Expert with several knowledge folders
   gets **one** of them named in the injected prompt while retrieval covers all — `BUG-260920-01`'s
   class, narrowed rather than closed.
2. **Subtree asymmetry.** Union expands the thread folder's **subtree**; `restricted` uses the
   expert's folders **without** expansion, so a child of an expert folder is invisible under strict
   isolation. May be intentional; it is not written down as a choice.

---

## ⚠ CORRECTION TO MY OWN EARLIER FIGURE — the original is struck through, not deleted

`BUG-260920-01`, `SEED-303` and `BUS-291`/`293`/`296` all state that inviting an Expert strips
~~**21 of 31**~~ tools. **`_TOOL_REGISTRY` measures 29, not 31** — AST-counted at both base and
HEAD, and confirmed by the phase's own fence, which pins `== 29`. The original figure came from
counting **grep output lines** over the registry block, which included comment lines.

**The corrected figure is `19 of 29`.** The finding is unchanged in kind and in consequence —
`execute_code`, `workspace_write`, `render_template` and `ask_user` were all stripped, which is why
`D-v4.3-02` exists — but a register carrying a wrong measured number is how a wrong number gets
quoted forward, so it is corrected in place with its origin named.
