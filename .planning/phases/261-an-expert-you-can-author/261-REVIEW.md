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


---

# ADDENDUM — RE-REVIEW OF THE FIXES, AND THE FIXES I THEN MADE MYSELF (2026-09-21)

⚠ **ROLE NOTE, RECORDED RATHER THAN HIDDEN.** Gemini's quota was exhausted mid-phase and the
operator directed claude to continue end to end. So this addendum has **two halves with different
standing**, and they must not be read as one verdict:

- **§A is a REVIEW.** Gemini built the F-1/F-2/F-3 fixes, so reviewing them is clean.
- **§B is BUILD WORK BY THE REVIEWER.** claude authored `BUG-260921-01` and then fixed it. That is
  the `257` failure mode inverted — *"fix it directly"* turning the reviewer into the builder,
  where 14 of 17 later findings were against the reviewer's own fixes. **§B is UNREVIEWED and owes
  an independent pass.**

## §A — Gemini's fixes to F-1 / F-2 / F-3: **ACCEPTED**

| Finding | Verdict | How it was established |
|---|---|---|
| **F-1** PACK-10 invite gate | ✅ **FIXED** | `check_expert_grant_access` now has production call sites in `expert_service.py` (×4), `api/experts.py` (×3), `api/threads.py` and `run_producer.py` — it previously had none outside its own test. **Driven RED:** planting `has_grant = True` at the resolve/invite site failed `test_scenario_pack10_ungranted_user_cannot_read_or_invite_expert`; restoring it went green, 36/36. |
| **F-2** brainstorm upload decode | ✅ **FIXED** | `pypdf.PdfReader` for `.pdf`, `python-docx` for `.docx`, UTF-8 only as the fallback for other types. |
| **F-3** unbounded read | ✅ **FIXED** | `await f.read(MAX_FILE_BYTES)` with a 5 MB cap, applied **before** the slice. |

⚠ **Two residuals on F-2, neither blocking and neither a regression.** A failed extraction is still
only a `logger.warning`, so the file silently contributes nothing and the admin is not told — the
original finding asked for a *named reason*, and half of it stands. And `.doc`, `.pptx` and `.xlsx`
still fall through to the UTF-8 branch, which produces the same replacement-character noise the fix
removed for two formats.

## §A2 — A REGRESSION THE FIX INTRODUCED, which `BUS-299` did not see

`BUS-299` claimed *"All 35 Phase 261 tests pass"*. That was **true and insufficient**: the backend
unit baseline went **71 → 76**, breaking the mandatory zero-headroom gate, and all five new
failures were in **`test_259_expert_member_isolation.py`** — the suite F-1's own change broke.

⭐ **Established inherited-vs-new by stashing, not by reasoning:** with claude's changes stashed,
the five still failed at Gemini's HEAD. `71 + 5 = 76` exactly.

⭐ **And the fix did NOT break the product — it broke five fixtures that modelled a row the schema
forbids.** `expert_bundles.visibility` is `NOT NULL DEFAULT 'private'` and `created_by` is
`NOT NULL`; the fixtures omitted both, so the grant gate read `visibility = None` and correctly
denied. Those rows are unreachable in production and had only ever passed because **nothing read
the column**. Repaired at `4c2428063`; baseline back to **71 failed / 5237 passed**, failing set
otherwise identical.

## §B — claude's own fixes to `BUG-260921-01` (a) and (b): **UNREVIEWED**

**(a) The schema is the contract.** Every substantive `ExpertDraftOutput` field carried a Pydantic
default, so a model returning one thin sentence validated perfectly and richness was a lottery
(293 vs 2163 chars of `description` on one identical prompt). The fields are now **required with
floors** — `description` 400, `example_output` 120, `when_to_use` 40-240, exactly 3 tiles with
150-char prompt bodies — and the system prompt's `140`-char claim is aligned to the enforced 240,
since prompt and schema disagreeing is the defect. Safe because `forced_emit`'s ladder **re-drives**
a rung whose payload fails `model_validate` rather than going dark.

⭐ **Driving the FALLBACK against the new floors caught a regression that would otherwise have
shipped**, and this is the part worth keeping: the fallback constructed `PromptSuggestion` rather
than the floored draft model, and a one-character prompt produced a one-character slug — either
would have raised `ValidationError` in the **last rung under the ladder**, 500-ing the draft
endpoint for exactly the request with nothing left to fall back to. Now total over 7 edge cases
including empty and punctuation-only input.

**(b) One home for the jsonb write.** `json.dumps` on an already-encoded string yields a JSON
**string scalar**: measured live, `phd-lr` reads `jsonb_typeof = 'string'` and
`financial-analyzer` `'array'` in the same column. `_suggestions_to_jsonb` is now the single
serialiser for both write paths, with the invariant *the bind value parses to a list*. The read
side still tolerates the legacy scalar, because the fix stops **new** ones and must not orphan rows
already written.

Both were **driven RED against planted regressions** (a default restored on `description`; the
naive `json.dumps` restored) and green on removal. New fence:
`backend/tests/unit/test_261_draft_contract_and_jsonb.py`, 25 cases.

⚠ **Two of Gemini's existing tests failed on the tightened schema and their FIXTURES were
aligned, not the schema weakened** — their mocked payloads were thin (`description` 27 chars), fell
to the fallback, and their own name assertions caught it. That is the floors binding on mocked data,
which is the desirable direction.

## Still open after all of this

1. ⛔ **The main finding of `BUG-260921-01` is UNFIXED and is the operator's routing call:** an
   authored Expert's capabilities are whatever the skills library happens to hold — measured, the
   drafter picked `docx`, `xlsx`, `pptx` for a doctoral literature reviewer because the library has
   10 rows and nothing else matched. **That is a capability, not a gap-closure item**, and G-7
   forbids smuggling one into a closure round.
2. The two `D-v4.3-03` arms still owed to the operator as a live G-4 check — union composition and
   the tool floor — plus the `restricted`-mode single-folder path and the subtree asymmetry.
3. **§B owes an independent review.**
