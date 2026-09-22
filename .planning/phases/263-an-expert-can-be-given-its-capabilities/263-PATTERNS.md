# Phase 263: An Expert Can Be Given Its Capabilities — Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 16 (4 created · 12 modified)
**Analogs found:** 16 / 16 — every file this phase touches has a shipped analog in this repo

> **Relationship to `263-RESEARCH.md`.** RESEARCH measured *what the code does* at the touch points.
> This document answers only *what to copy, from where*. It does **not** re-derive RESEARCH's
> measurements. Where a measurement here **disagrees with or extends** RESEARCH, it is flagged
> `⚠ FINDING` with the command and its output — eight such findings are recorded, F-1 … F-8.
> ⛔ **No source file was modified and no git write command was run.**

---

## File Classification

| New/Modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `backend/app/services/skill_body_authoring.py` *(new, D-263-13)* | service | request-response (forced LLM emission) | `backend/app/services/skill_proposer_service.py` | **exact** |
| `supabase/migrations/190_skill_expert_provenance.sql` *(new)* | migration | DDL | `supabase/migrations/188_expert_chat_scoping.sql` §1 | **exact** |
| `backend/tests/unit/test_263_*` *(new, several)* | test | — | `test_259_expert_member_isolation.py` · `test_259_closed_core_inventory.py` | **exact** |
| `backend/tests/integration/test_263_craft_block_is_read.py` *(new, D-263-13 Fence 1)* | test (live DB) | file-I/O → DB read | `backend/tests/integration/test_137_2_skill_creator_seed_content.py` | **exact** ⭐ F-2 |
| `frontend/src/components/experts/ProposedSkillCard.tsx` *(new)* | component | render-only | `OrgIdentity.tsx` `AVATAR_PENDING` (+ its token test) | role-match ⭐ F-8 |
| `backend/app/services/expert_authoring.py` | service | request-response | itself (`DraftPromptSuggestion`, `:14-24`) | **exact** |
| `backend/app/api/experts.py` | route | request-response | `draft_expert` (`:88-186`) · `create_expert` (`:60-85`) | **exact** |
| `backend/app/services/expert_service.py` | service | CRUD / predicate | itself (`:249-291`) | **exact** |
| `backend/app/db/experts.py` | db | CRUD | `update_expert_bundle` (`:343-409`) | **exact** |
| `frontend/src/components/experts/ExpertAuthoringStudio.tsx` | component | request-response | itself (`:756-774` pill rail · `:211-241` draft-apply) | **exact** |
| `frontend/src/components/skills/SkillFormDialog.tsx` | component | form / CRUD | itself (`:287-322` reset effect) | **exact** |
| `frontend/src/lib/api/experts.ts` | api-client | request-response | `PublishGateError` in `lib/api/skills.ts:67-74` | role-match ⚠ F-3 |
| `frontend/src/lib/api/skills.ts` | api-client | request-response | ⛔ **untouched** (D-263-03) — analog is *do nothing* | n/a |
| `frontend/src/types/index.ts` | types | — | `SkillCreate` (`:748-754`) | **exact** |
| `frontend/src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx` | test | — | itself (`:1-33` mock factory) | **exact** ⚠ F-4 |
| `frontend/src/components/skills/SkillFormDialog.test.tsx` | test | — | itself (`:38-45` `importActual` factory) | **exact** ⚠ F-4 |
| `scripts/vitest-count-gate.cjs` | config | — | the Phase-260/261 knob blocks (`:165-170`, `:4326-4331`) | **exact** ⚠ F-7 |

---

## Pattern Assignments

### 1. `backend/app/services/skill_body_authoring.py` (service, request-response) — NEW

**Analog:** `backend/app/services/skill_proposer_service.py` — the near-exact structural mirror
(RESEARCH §1.1). Copy its **module skeleton, import discipline, gate placement and `forced_emit`
call shape**; ⛔ do **not** copy its prompt home (D-263-13 forbids module-prose doctrine).

**Imports pattern** (`skill_proposer_service.py:38-53`) — ⭐ note `_emit_tool` is *imported*, never
re-implemented; that is the precedent D-263-13 and RESEARCH §1.4 both name:

```python
from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.services.forced_emit import forced_emit

# D-03: reuse the tuner's builder-model resolver + flat-schema tool builder VERBATIM
# (no re-implementation — the plan's "import, do not re-implement" contract). ``_emit_tool``
# applies ``_flatten_nullable`` so the proposer schema clears the Gemini ``type:[...]`` array
# trap + strict validators (minimax/moonshot).
from app.services.skill_tuner_service import _emit_tool, resolve_skill_builder_model

logger = logging.getLogger(__name__)
```

**Emission model pattern** (`:66-75`) — flat, single-typed, no unions/Optionals at property level:

```python
# ── FLAT, single-typed proposer schema (Gemini type:[...] trap — Pitfall 5) ──────
class SkillProposal(BaseModel):
    """The builder model's ONE proposed instruction-body edit (D-04)."""

    proposed_instructions: str  # the rewritten INSTRUCTION BODY
    rationale: str              # honest "why this change"
    evidence_cited: str         # which failing / disagreement cases drove the edit
```

**FLAG-01 gate pattern** (`:356-366`) — ⭐ this is the exact shape D-263-14 asks for, and it answers
D-263-14's *"verify the switch's real name and call shape"*: **`app.models.user_settings.self_improve_enabled()`**,
zero args, **function-local import**, fail-**open** on a read blip (default-ON, D-Q4):

```python
    from app.models.user_settings import self_improve_enabled  # function-local (Pitfall-4)

    if not self_improve_enabled():
        logger.info(
            "skill_proposer.propose: self-improvement is disabled by the operator (FLAG-01) "
            "— refusing to draft a proposal (skill=%s source_run=%s)",
            (skill or {}).get("id"),
            source_run_id,
        )
        return None
```

Definition, for the polarity (`backend/app/models/user_settings.py:1514-1524`):

```python
def self_improve_enabled() -> bool:
    """FLAG-01 capability switch: is the self-improvement (skill-saving) capability on?
    ...default-ON: a cold-cache / DB-read failure returns True so a transient blip NEVER
    silently disables the capability (D-Q4). Only a deliberate operator OFF flip flips it."""
    try:
        return load_app_settings().self_improve_enabled
    except Exception:  # noqa: BLE001 — defensive: default-ON on cold cache / read failure
        return True
```

**Model resolution + honest-`None` floor** (`:371-387`):

```python
    from app.config import get_model_capability, settings  # function-local (Pitfall-4)

    model = resolve_skill_builder_model(settings)
    if model is None:
        # Honest floor (D-03): no builder model resolved → the caller surfaces a "no builder
        # model" failure. NEVER fabricate a proposal, NEVER call the paid provider.
        return None

    provider = (get_model_capability(model) or {}).get("provider", "unknown")
```

**The `forced_emit` call site** (`:391-406`) — keyword-only throughout, `strict=False`, and the
`emitted`-or-`None` return with no fabrication:

```python
    result = await forced_emit(
        messages=[{"role": "user", "content": _render_evidence_as_data(evidence)}],
        model=model,
        provider=provider,
        emitter="emit_proposal",
        tools=_emit_tool("emit_proposal", SkillProposal),
        user_settings=user_settings,
        system_prompt=_PROPOSER_SYSTEM_PROMPT,
        schema_model=SkillProposal,
        strict=False,
    )
    return result.get("emitted")  # None on honest fail — never fabricated
```

⛔ **The one thing NOT to copy:** `_PROPOSER_SYSTEM_PROMPT` (`:78-90`) is module prose. D-263-13
requires the craft doctrine to be **read from the DB row at call time**. Keep the module's own
framing text (task setup, the DATA-block delimiter idiom at `:57-59`) and **inject** the craft block.

**Alternate model-resolution analog, if the plan prefers the Expert path's resolver**
(`expert_authoring.py:288-299`) — `builder_model` → `llm_model` → `settings.llm_model` → `"gpt-4o"`,
with `provider` from `user_settings.active_provider` first. ⚠ The two resolvers differ; pick one and
say which. `resolve_skill_builder_model` has the honest-`None` floor and no hardcoded paid default —
prefer it for a *skill*-authoring shot.

---

### 2. `supabase/migrations/190_skill_expert_provenance.sql` (migration, DDL) — NEW

**Analog:** `supabase/migrations/188_expert_chat_scoping.sql` §1 — a **better** analog than 189,
because 188 adds exactly this shape: a nullable uuid FK to `expert_bundles` with `ON DELETE SET NULL`,
a `COMMENT`, and a **partial** index. Copy it almost verbatim:

```sql
-- Migration 188 — Phase 260 (PACK-02, PACK-05, D-260-04, D-260-08)
-- Table: public.threads — add active_expert_id for durable consultant scoping

-- 1. Add active_expert_id column to public.threads
ALTER TABLE public.threads
    ADD COLUMN IF NOT EXISTS active_expert_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.threads.active_expert_id IS
    'Active consultant expert bundle invited to this thread (PACK-02, Phase 260). Scopes retrieval and tools, preserves chat history. Cleared to NULL on dismissal.';

-- Partial index for active expert lookups on threads
CREATE INDEX IF NOT EXISTS idx_threads_active_expert
    ON public.threads (active_expert_id)
    WHERE active_expert_id IS NOT NULL;
```

⭐ The precedent settles RESEARCH's two `[ASSUMED]` items A1 and A2 in the repo's own voice:
`ON DELETE SET NULL` **and** a partial `WHERE … IS NOT NULL` index are what this codebase already
does for a nullable `expert_bundles` FK. `190` may copy the three statements and change the names.

**Header-comment idiom** to copy (188 line 1-4 shape): `-- Migration <n> — Phase <n> (<REQ-IDs> / <D-IDs>)`
then one `--` line per section. For a migration with a *reason* worth recording, `154` shows the
long-form header (BEGIN/COMMIT, ordering rationale) — not needed for a plain column add.

⚠ Index-name convention is **not uniform**: `188` uses `idx_threads_active_expert`, `189` uses
`idx_expert_grants_lookup`, RESEARCH §B.3 proposes `skills_born_for_expert_bundle_id_idx`. Pick one
and be consistent inside the file; `idx_skills_born_for_expert` matches the two nearest neighbours.

⛔ **189 is NOT the analog for the ACL question.** `189` contains
`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_grants TO authenticated, service_role;`
— which is exactly what puts a migration inside `scripts/check-schema-acl-parity.cjs`'s scan.
`188` contains **no** `GRANT`/`REVOKE`, which is why RESEARCH §B.6's "190 touches the supplement not
at all" holds — **provided 190 stays GRANT-free, like 188 and unlike 189.**

---

### 3. `backend/app/services/expert_authoring.py` (service, request-response) — MODIFIED

**Analog:** itself. The nested-model idiom D-263-02 needs already exists one class above the target:

```python
# backend/app/services/expert_authoring.py:14-24
class DraftPromptSuggestion(BaseModel):
    """Phase 261 (BUG-260921-01a) — a DRAFT tile, with a floor on the prompt body.

    Deliberately NOT ``models.expert.PromptSuggestion``: that model is also the read
    shape for every persisted bundle, and tightening it would make an older thin row
    unreadable. The floor belongs where the content is GENERATED, not where it is read.
    """

    title: str = Field(..., min_length=3, max_length=60, description="Crisp action-oriented button label")
    prompt: str = Field(..., min_length=150, description="Detailed multi-sentence starter prompt (2-3 sentences minimum)")
```

⭐ **Copy the docstring's *reasoning*, not just its shape.** `SuggestedNewSkill` is a DRAFT-only
model for the same reason: it is generated, never a persisted read shape.

**Imports block already present** (`:1-11`) — nothing new is needed for D-263-02:

```python
from __future__ import annotations

import json
import logging
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.config import get_model_capability, settings
from app.models.expert import PromptSuggestion
```

**The fallback constructor that MUST be edited in the same task** (`:265-279`, RESEARCH §A.3's trap)
— it is a flat 13-kwarg call with no `**extra`; a 14th required field raises here:

```python
    return ExpertDraftOutput(
        name=name, slug=slug, icon=icon, category=category,
        when_to_use=when_to_use, example_output=example_output,
        description=detailed_desc, scope_mode="biased", tool_floor_enabled=True,
        prompt_suggestions=prompts, member_skills=matched_skills,
        knowledge_folder_ids=matched_folder_ids, required_connections=matched_connections,
    )
```

**Failure-path wrapping to preserve** (`:347-355`) — the fallback is reached from inside
`except Exception`, so a fallback that throws turns a degraded path into a 500:

```python
    except Exception as exc:
        logger.warning("forced_emit expert draft failed (%s), using grounded fallback", exc)

    return _generate_fallback_draft(...)
```

---

### 4. `backend/app/api/experts.py` (route, request-response) — MODIFIED

**Analog for the new `POST /experts/draft-skill-body` route:** `draft_expert` (`:88-186`).

**Decorator + dependency stack to copy verbatim** (`:88-94`):

```python
@router.post("/draft", status_code=status.HTTP_200_OK, response_model=ExpertDraftOutput)
async def draft_expert(
    description: str = Form(..., description="Description of the desired expert"),
    files: list[UploadFile] | None = File(default=None, description="..."),
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> ExpertDraftOutput:
```

⚠ **FINDING F-6 (extends RESEARCH §E.3) — the AST fence only sees POSITIONAL-OR-KEYWORD defaults.**
`test_261_single_expert_authoring_gate.py:43-53`:

```python
def _has_expert_manage_dependency(fn_node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    """Check if function parameters include Depends(require_expert_manage)."""
    for default in fn_node.args.defaults:          # ← .defaults ONLY, never .kw_defaults
        ...
```

`args.defaults` excludes keyword-only parameters. **A new route that declares
`*, current_user: dict[str, Any] = Depends(require_expert_manage)` (after a bare `*`) lands in
`kw_defaults` and the fence reports it as UNPROTECTED → RED**, even though it is correctly guarded.
⛔ Declare the guard as a plain positional-or-keyword parameter, exactly as `draft_expert` does.
(The `mutating_endpoints_checked >= 6` floor at `:94` is unaffected — one more route only raises it.)

**`user_settings` resolution for the shot** (`:169-176`) — the route, not the service, loads it:

```python
    # 3. Load caller user_settings for LLM provider credentials
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    from app.models.user_settings import load_user_settings  # noqa: PLC0415
    try:
        user_settings = load_user_settings(user_id)
    except Exception as exc:
        logger.warning("Could not load user_settings for %s: %s", user_id, exc)
        user_settings = None
```

**The save-time 422 (D-263-10) — envelope to copy.** The richest shipped precedent is
`backend/app/services/entitlement_service.py:50-58`, and it is the right one because it also feeds a
rendered banner:

```python
super().__init__(
    status_code=status.HTTP_403_FORBIDDEN,
    detail={
        "detail": f"Capability '{result.capability}' requires '{req_tier}' tier (current tier: '{curr_tier}')",
        "error": "entitlement_required",
        "capability": result.capability,
        ...
    },
)
```

⭐ The `"detail"` key **inside** `detail` is load-bearing here — see F-3: the frontend's
`handleResponse` reads exactly `err.detail?.detail` for its message. An envelope without that key
renders the generic fallback string.

**Placement** — above `create_expert`'s `try:` at `:73`, after the `Depends` have resolved. Copy
`create_expert`'s two resolution lines (`:71-72`) and insert the check between them and the `try`:

```python
    org_id = _to_uuid(active_org)
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
    # ← D-263-10 check lands HERE (RESEARCH §D.1: HTTPException subclasses Exception)
    try:
```

⚠ `update_expert` (`:294-315`) has **no** try/except at all — copy the check placement, not the
structure, and assert `422` on **both** endpoints.

---

### 5. `backend/app/services/expert_service.py` (service, predicate) — MODIFIED

**Analog:** itself, `:249-291`. RESEARCH §C.2/§C.3 quote the block and the two-line change in full —
not repeated here. Two pattern notes a plan needs that are *not* in that section:

- **Row-access idiom is mixed and the `.get()` half is the one to copy.** `row["name"]` vs
  `row.get("is_system")` coexist in the same loop; `.get("born_for_expert_bundle_id")` keeps all six
  existing mock-dict fixtures green without edits (RESEARCH §C.3).
- **The strip log line is the fence's observable**, and every isolation test asserts on it:
  `logger.warning("EXPERT_MEMBER_CROSS_ORG_STRIPPED: skill '%s' foreign or inaccessible to org '%s' (user '%s')", ...)`.
  A new arm must not introduce a second log verb — the tests match this literal via `caplog.text`.

**Shared-helper extraction (RESEARCH §D.3 / A6) — the shape to copy** is `create_expert_service`
(`:34-60`), which is a pure keyword-only pass-through with a one-line docstring:

```python
async def create_expert_service(
    pool: asyncpg.Pool,
    org_id: UUID,
    user_id: UUID,
    bundle_in: ExpertBundleCreate,
) -> dict[str, Any]:
    """Create a new tenant expert bundle via service layer."""
    return await experts_db.create_expert_bundle(pool=pool, org_id=org_id, created_by=user_id, ...)
```

⛔ **AST constraint on this file** (`test_259_closed_core_inventory.py:65-83`): no `while` loop, and
no import whose module name contains `openai` / `anthropic` / `litellm` / `agent_loop`. A helper here
must stay pure data transformation.

---

### 6. `backend/app/db/experts.py` (db, CRUD) — MODIFIED

**Analog for D-263-08's backfill `UPDATE`:** `update_expert_bundle` (`:343-409`), the module's only
existing `UPDATE public.expert_bundles` (`:399`). The module's local idiom set to copy:

- `_row_to_dict(row: asyncpg.Record | None)` (`:61`) for the return shape
- keyword-only `async def <verb>_expert_<noun>(pool: asyncpg.Pool, ...)` naming
- numbered `$1`-style asyncpg parameters, never f-string interpolation

⭐ **`create_expert_service` is a pure pass-through**, so the backfill has exactly one natural home:
a new `stamp_skills_born_for_bundle(pool, *, bundle_id, skill_names, org_id)` in `db/experts.py`,
called from `create_expert_service`/`update_expert_service`. ⛔ It must carry the `org_id` predicate
in its own `WHERE` — the stamp is a privilege grant under D-263-06, so it must not be able to stamp a
foreign-org row.

⛔ This file is in `EXPERT_MODULE_PATHS` (`test_261_single_expert_authoring_gate.py:22-27`) — **zero
hardcoded `org-admin` / `super-admin` / `admin` string literals**, in any comparison or sequence.

---

### 7. `frontend/src/components/experts/ProposedSkillCard.tsx` (component, render-only) — NEW

⭐ **FINDING F-8 — the dashed "not real yet" convention already exists in this repo, WITH a test that
pins its tokens.** `frontend/src/components/org/OrgIdentity.tsx:66-69`:

```tsx
// The gradient initial-circle atom (InvitationsTab.tsx:236-241) and its dashed
// indigo pending variant (OrgMembersTab.tsx:225-228). Hand-rolled gradient — NOT the
// shadcn ui/avatar.tsx image-Avatar (its look/behavior differs); do not swap.
const AVATAR_BASE = "flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold"
const AVATAR_SOLID = "bg-gradient-to-br from-primary to-primary/60 text-white"
const AVATAR_PENDING = "border border-dashed border-primary/40 bg-primary/[0.06] text-primary"
```

⭐ `border-dashed border-primary/40 bg-primary/[0.06] text-primary` **is** D-263-01's *"dashed border
+ violet accent, no red, no error styling"*, already expressed in this design system's tokens. Copy
the token string; do not invent a new one.

**And copy its test shape** (`OrgIdentity.test.tsx:100-108`) — a class-token assertion with a
**negative** arm, which is what makes "proposed ≠ real" falsifiable rather than decorative:

```tsx
  it("pending → dashed indigo variant (verbatim OrgMembersTab.tsx:225-228 tokens)", () => {
    render(<OrgAvatar initial="B" pending />)
    const el = screen.getByTestId("org-avatar")
    for (const token of ["border-dashed", "border-primary/40", "bg-primary/[0.06]", "text-primary"]) {
      expect(el.className).toContain(token)
    }
    expect(el.className).not.toContain("bg-gradient-to-br")
  })
```

**Container/pill geometry to match** — the solid `⚡` rail the new group sits beside
(`ExpertAuthoringStudio.tsx:756-774`):

```tsx
{memberSkills.length > 0 && (
  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-primary/20 bg-primary/5">
    {memberSkills.map((skillName) => (
      <span
        key={skillName}
        className="inline-flex items-center gap-1 rounded-md bg-primary/20 border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary"
      >
        <span>⚡ {skillName}</span>
        <button type="button" onClick={...} className="hover:text-destructive ml-0.5 text-primary/70 ...">
          <X className="h-3 w-3" />
        </button>
      </span>
    ))}
  </div>
)}
```

⭐ The `⬡` card carries a **description line**, so it is a `div`-per-item block, not a pill — but the
group wrapper (`rounded-lg border … p-2`, `gap-1.5`) and the `text-xs` scale should match so the two
headed groups read as peers.

**Generating-state analog** (Claude's-discretion item in CONTEXT §2): the studio already owns an
in-place busy pattern via `isDrafting` (`:216-241`) — one boolean in the parent, rendered on the
card, no new dialog. ⛔ No separate "Generate instructions" button (CONTEXT forbids it).

---

### 8. `frontend/src/components/experts/ExpertAuthoringStudio.tsx` (component) — MODIFIED

**Draft-apply idiom to extend** (`:211-241`) — guarded assignment, one `if` per optional field:

```tsx
      const draft = await draftExpert(brainstormPrompt, brainstormFiles)
      setName(draft.name)
      ...
      if (draft.member_skills) setMemberSkills(draft.member_skills)
      if (draft.required_connections) setRequiredConnections(draft.required_connections)
      if (draft.knowledge_folder_ids) setKnowledgeFolderIds(draft.knowledge_folder_ids)
```

⭐ `if (draft.suggested_new_skills) setSuggestedNewSkills(draft.suggested_new_skills)` lands beside
`member_skills` in the same idiom — one line, same guard shape.

**The save-error banner that D-263-09's frontend fence reuses** (`:1033-1038`):

```tsx
{saveError && (
  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
    <AlertCircle className="h-4 w-4 flex-none" />
    <span>{saveError}</span>
  </div>
)}
```

⚠ This is the **destructive/red** banner, set from `catch (err: any) { setSaveError(err.message ...) }`
(`:359-361`). D-263-01 says a proposal is *"an opportunity, not a failure"* — so the **inline
count banner** beside `Save Expert` must NOT reuse these tokens. Use the violet/primary family
(`border-primary/30 bg-primary/5 text-primary`), matching the pill rail. The destructive banner stays
for the **server's** 422 arriving after a stale-client save.

**The phantom-name entry point PACK-16's frontend fence must also cover** (`:245-252`) — it pushes
any free-text string into `memberSkills` with no library check:

```tsx
  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim()
    if (!trimmed) return
    if (!memberSkills.includes(trimmed)) {
      setMemberSkills((prev) => [...prev, trimmed])
    }
    setCustomSkillInput("")
  }
```

---

### 9. `frontend/src/components/skills/SkillFormDialog.tsx` (component, form) — MODIFIED

**Analog:** itself. RESEARCH §G.2 gives the `initialValues` prop and the three `??` insertions. Two
pattern facts that change how the plan is scoped:

⚠ **FINDING F-5 — `SkillFormDialog` (the modal) has NO production mount today.**

```
$ grep -rn "SkillFormDialog" frontend/src --include=*.tsx --include=*.ts \
    | grep -v "SkillFormDialog.test\|SkillFormDialog.tsx:"
frontend/src/pages/SkillsPage.tsx:8:import { SkillDetailPanel } from "@/components/skills/SkillFormDialog"
```

The module exports **two** components — `SkillFormDialog` (`:287`) and `SkillDetailPanel` (`:437`) —
and production imports only the **panel**. **D-263-01 would be the modal's first production mount**,
so there is no established call-site idiom to copy; the only existing mount is its own test
(`SkillFormDialog.test.tsx:106-113`). ⛔ Consequence: the modal's `open`/`onOpenChange`/`onSave`
wiring is **unproven in production** — the plan should treat mounting it as new surface with its own
test, not as "reusing a shipped dialog's call site".

⭐ **Good news for the diff size:** both wrappers delegate to a shared `SkillForm` whose props are a
flat *controlled* set (`SkillFormProps`, `:33-57`: `name/setName`, `description/setDescription`,
`instructions/setInstructions`, `isEdit`, `isOwner`, …). The pre-fill therefore lands **entirely
inside `SkillFormDialog`'s reset effect** — `SkillForm` needs **zero** changes, and
`SkillDetailPanel` is untouched. That confirms RESEARCH §G.2's three-`??` reading is sufficient.

**The save-wiring analog** (`SkillsPage.tsx:76-86`) — what the studio's `onSave` must mirror,
returning the saved `Skill` so lint warnings surface:

```tsx
  const handleSave = async (body: SkillCreate | SkillUpdate): Promise<Skill> => {
    if (selectedSkill) {
      return updateSkill(selectedSkill.id, body as SkillUpdate)
    }
    const created = await createSkill(body as SkillCreate)
    setIsCreatingNew(false) // close after new skill created
    return created
  }
```

⭐ For a proposal there is never a `selectedSkill` — the studio's handler is the `createSkill` arm
only, and **`createSkill(body)` is the existing, unchanged D-263-03 write path**
(`lib/api/skills.ts:22-31`). `SkillCreate` (`types/index.ts:748-754`) already carries exactly
`name` / `description?` / `instructions?` / `is_org_shared?` — **no type change is needed** for the
create call.

---

### 10. `frontend/src/lib/api/experts.ts` (api-client) — MODIFIED

⚠ **FINDING F-3 (extends RESEARCH §D.2) — the shipped client FLATTENS the 422 to a string, so
`unknown_skills` never reaches the component.** `lib/api/experts.ts:73-95`:

```ts
async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  if (!res.ok) {
    let msg = fallbackError
    try {
      const err = await res.json()
      if (typeof err.detail === "string") {
        msg = err.detail
      } else if (err.detail?.detail) {
        msg = err.detail.detail
      } else if (err.detail?.upgrade_hint) {
        msg = err.detail.upgrade_hint
      } else if (Array.isArray(err.detail) && err.detail.length > 0) {
        msg = err.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(", ")
      } else if (err.message) { msg = err.message }
    } catch { /* Keep default */ }
    throw new Error(msg)                       // ⛔ the structured payload is DROPPED here
  }
  return res.json() as Promise<T>
}
```

`createExpert` and `updateExpert` both route through it (`:125`, `:128`). So **D-263-10's
*"names each unknown skill so any client can render the banner from the response"* is not reachable
through this client as it stands** — the component receives only `err.message`. ⭐ Two good
consequences, both worth planning around rather than discovering: (a) the `"detail"` key **inside**
`detail` is what makes the message honest (the `err.detail?.detail` arm), so the envelope must carry
it; (b) the array needs a typed carrier.

**The typed-carrier analog — and it is one file over, in this phase's own blast radius.**
`frontend/src/lib/api/skills.ts:63-74` + `:85-99`:

```ts
/** Phase 136 (GATE-01): a typed carrier for the structured 409 publish-gate
 *  refusal. Holds the server-computed `PublishGate` so the dialog can render the
 *  SAME honest counts/reason the server used — the client never recomputes `met`
 *  (D-07). Mirrors the ApiError idiom (a named Error with a typed field). */
export class PublishGateError extends Error {
  readonly gate: PublishGate
  constructor(gate: PublishGate) {
    super(gate.reason || "This skill can't be published yet — its eval gate isn't met.")
    this.gate = gate
    this.name = "PublishGateError"
  }
}
```

```ts
  if (!res.ok) {
    if (res.status === 409) {
      // Structured publish-gate refusal — detail is an OBJECT { error, gate }, NOT
      // a string (do NOT route through proposalError's string path). Surface the
      // gate via a typed error so the dialog renders the server's honest evidence.
      let gate: PublishGate | undefined
      try {
        const j = (await res.json()) as { detail?: { error?: string; gate?: PublishGate } }
        gate = j?.detail?.gate
      } catch { /* non-JSON / malformed 409 body — fall through to the generic message */ }
      if (gate) throw new PublishGateError(gate)
      throw new Error("This skill can't be published yet — its eval gate isn't met.")
    }
    throw new Error("Failed to update skill.")
  }
```

⭐ **Copy this verbatim, swapping 409/`gate` for 422/`unknown_skills`.** It is the same problem
(structured refusal → rendered from the server's own evidence, never re-derived), solved once in this
codebase, in a file this phase already reads. The base idiom it cites is `ApiError`
(`lib/api/_core.ts:49-55`): a named `Error` subclass with one `readonly` typed field and an explicit
`this.name`.

⛔ **Do not "fix" `handleResponse` generically.** Nine functions route through it; widening its throw
type changes every catch site in the studio and in `OrgExpertsTab`. Add the discriminated arm inside
`createExpert`/`updateExpert` before the `handleResponse` call, exactly as `toggleSkillOrgShared`
does before its generic throw.

**New-function idiom** (`draftExpert`, `:147-167`) for `draftSkillBody` — JSON body, so it is the
simpler `createExpert` shape (`:118-126`), not the FormData one:

```ts
export async function createExpert(payload: ExpertBundleCreate): Promise<ExpertBundle> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API_BASE}/experts`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return handleResponse<ExpertBundle>(res, "Failed to create expert")
}
```

⭐ **Wire types live in `lib/api/experts.ts`, not `types/index.ts`** — `ExpertDraftOutput` is declared
at `:63-71` of this module and imported by the studio as `import type { ExpertDraftOutput } from "@/lib/api/experts"`.
So `SuggestedNewSkill` belongs **here**, beside it. ⛔ `frontend/src/types/index.ts` needs **no
change** for the draft type (only `Skill`/`SkillCreate` live there, and they are already sufficient).

---

## Test Patterns (the highest-value half)

### T-1. The RED-drive shape for D-263-06 — `backend/tests/unit/test_259_expert_member_isolation.py`

**Header + imports** (`:1-19`) — copy verbatim; `test_263_*` should import the same symbols:

```python
from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.models.expert import ExpertBundleCreate, ExpertBundleUpdate
from app.services.expert_service import (
    ResolvedExpertBundle,
    create_expert_service,
    ...
    resolve_expert_bundle,
)
```

**The mock-pool scaffolding** (`:24-70`) — ⭐ note the ordered `side_effect` list: skills, folders,
connections, in that order. A new test that omits the folder/connection lists will fail inside
`resolve_expert_bundle`, not at its assertion:

```python
    mock_pool = MagicMock()
    org_a, user_a, bundle_id, folder_a = uuid4(), uuid4(), uuid4(), uuid4()

    bundle_row = {
        "id": bundle_id, "name": "Legit Expert", "slug": "legit-expert",
        "description": "Legitimate org bundle", "scope_mode": "restricted",
        "is_system": False, "org_id": org_a,
        # Phase 261 (F-1): expert_bundles.visibility is NOT NULL DEFAULT 'private' and
        # created_by is NOT NULL — a row without them is unreachable in production.
        "visibility": "org", "created_by": user_a,
        "member_skills": ["system_calc", "org_a_tool"],
        "knowledge_folder_ids": [folder_a],
        "required_connections": ["slack"],
        "prompt_suggestions": [{"title": "Hi", "prompt": "Hello"}],
    }
    mock_pool.fetchrow = AsyncMock(return_value=bundle_row)
    mock_pool.fetch = AsyncMock(side_effect=[
        [ {"name": "system_calc", "is_system": True,  "org_id": None,  "user_id": None,   "is_org_shared": True,  "is_enabled": True},
          {"name": "org_a_tool",  "is_system": False, "org_id": org_a, "user_id": user_a, "is_org_shared": False, "is_enabled": True} ],
        [ {"id": folder_a, "org_id": org_a, "user_id": user_a, "is_org_shared": False} ],
        [ {"service_id": "slack", "capability": "post_message"} ],
    ])
```

⚠ Every skill fixture dict is **flat and complete** for the columns the SELECT names. A D-263-06 test
adds `"born_for_expert_bundle_id": <UUID or None>` to each — **a `UUID`, never a `str`** (RESEARCH
§C.3), or the `==` compares unequal and the test passes for the wrong reason.

**The PACK-04 assertion block** (`:127-136`) — the shape D-263-12's PACK-17 drive copies:

```python
    with caplog.at_level(logging.WARNING):
        resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)

    assert resolved.effective_skills == ["org_a_safe_skill"]
    assert "org_b_secret_skill" not in resolved.effective_skills
    assert resolved.stripped_members_count == 1
    assert "skill:org_b_secret_skill" in resolved.stripped_details
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text
```

⭐ Four assertions per case, not one — membership **and** absence **and** the counter **and** the log.
That redundancy is what makes the arm-placement RED drive (§C.4 case 4) fail loudly rather than
silently flip a boolean.

### T-2. The counted-inventory shape for D-263-11 — `test_259_closed_core_inventory.py`

**Imports + the counting idiom** (`:1-26`) — ⛔ `len(...)` on the registry, never a substring grep:

```python
import ast
import pathlib
import pytest

from app.services.harness.phase_types import PHASE_TYPE_REGISTRY_ENTRIES
from app.services.harness.emitters import EMITTER_REGISTRY
from app.services.tool_dispatcher import _TOOL_REGISTRY

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"


def test_phase_type_registry_contains_zero_expert_executors():
    assert len(PHASE_TYPE_REGISTRY_ENTRIES) == 7, (
        f"Inventory drift: expected 7 phase type executors, got {len(PHASE_TYPE_REGISTRY_ENTRIES)}: "
        f"{list(PHASE_TYPE_REGISTRY_ENTRIES.keys())}"
    )
    for key in PHASE_TYPE_REGISTRY_ENTRIES:
        assert "expert" not in key.lower(), f"Expert executor detected in phase types: {key}"
```

⭐ **Two assertions per registry: the exact count, then a name predicate over every member.** Phase
260's planted `bundle_emit` passed five fences precisely because a count-only or a name-only test is
half a fence. The failure message prints the **whole key list** — copy that too; it is what turns a
red into a one-line diagnosis.

**The AST-walk arm** (`:46-53`), for "no new handler of shape X":

```python
    dispatcher_path = APP_DIR / "services" / "tool_dispatcher.py"
    tree = ast.parse(dispatcher_path.read_text(encoding="utf-8"), filename=str(dispatcher_path))
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("_handle_expert"):
                pytest.fail(f"Expert-specific tool handler found in tool_dispatcher: {node.name}")
```

⛔ **D-263-11's obligation is to re-RUN this file at base and HEAD, not to author a copy.** The counts
at HEAD must be identical (`7 / 1 / 29 / 10`), and the new service must be a plain function called
from a route — a registered tool would take `_TOOL_REGISTRY` to 30 (RESEARCH §E.2).

### T-3. The live-DB fence for D-263-13 — ⭐ FINDING F-2: an exact analog RESEARCH does not name

`backend/tests/integration/test_137_2_skill_creator_seed_content.py` **already reads the
`skill-creator` row against the live local Postgres and asserts its content.** It supplies the id
constant, the reachability gate, the pool fixture, and the "absent row is a HARD FAILURE, not a skip"
convention D-263-13's Fence 1 needs:

```python
_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)
_SKILL_CREATOR_ID = "00000000-0000-0000-0000-000000000010"


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live ... gate",
)


@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool against local Postgres :54322."""
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


async def _skill_creator_row(pool):
    return await pool.fetchrow(
        "SELECT is_system, is_org_shared, instructions FROM public.skills WHERE id = $1",
        _SKILL_CREATOR_ID,
    )
```

⭐ Its docstring also states the **reason** shape a fence should carry: *"only ever checked by a
one-time `grep` … at authoring time … nothing would catch it before the next expensive multi-round
live UAT cycle. This test is that catch."*

⚠ **FINDING F-1 — the live craft block is migration 089's text, NOT 087's, and RESEARCH quotes 087.**

```
$ ls supabase/migrations/08[789]*
087_skill_creator_reborn.sql  088_skill_creator_eval_step_sequencing.sql  089_skill_creator_file_attach_honesty.sql

$ grep -n "SET instructions" supabase/migrations/088*.sql supabase/migrations/089*.sql
088...:24:SET instructions = $INSTRUCTIONS$You are **skill-creator**, a built-in guide ...
089...:27:SET instructions = $INSTRUCTIONS$You are **skill-creator**, a built-in guide ...
```

**088 and 089 each perform a FULL `SET instructions = $INSTRUCTIONS$…$INSTRUCTIONS$` rewrite**, so
the row live in the DB is **089's**, and `087:100-105` (RESEARCH §1.3's quotation) is superseded.
The live bullets (`089:41-46`):

```
Write the instructions, then call `save_skill` ... Apply this craft (it is what makes skills work or fail):
- **Imperative form.** ...
- **Explain the why, sparingly.** ...
- **Generalize, don't overfit.** ...
- **A pushy-but-honest description.** ...
- **Progressive disclosure — but know the limit.** Keep the core instructions lean. ... since you have
  **no tool to attach a file to a skill yourself** — only the user can do that, via the upload option
  on the Skills page. `workspace_write` saves to a general scratch area, NOT the skill's attached files ...
```

Two consequences for the plan:
1. ⛔ **The fence's token list must be derived from the LIVE row, not transcribed from 087.** The
   fifth bullet's heading differs (`Progressive disclosure` → `Progressive disclosure — but know the
   limit.`). Tokens present in **both** and therefore safe to assert: `Apply this craft`,
   `Imperative form`, `Explain the why, sparingly`, `overfit`, `pushy-but-honest`,
   `Progressive disclosure`.
2. ⚠ **The live fifth bullet mixes doctrine with agent-tool choreography** (`no tool to attach a file
   to a skill yourself`, `workspace_write`, `read_skill_file`). A naive "slice §3 to the end of the
   list" extraction carries that into the body-authoring prompt, where it is false and irrelevant
   (D-263-04's proposals are instructions-only, SEED-104 deferred). The extractor must stop at the
   bullet heading, or the driver must strip tool names.

### T-4. The AST gate a new route must not trip — `test_261_single_expert_authoring_gate.py`

Already covered under §4 (F-6). The module-scan list to be aware of (`:22-29`):

```python
EXPERT_MODULE_PATHS = [
    BACKEND_DIR / "app" / "api" / "experts.py",
    BACKEND_DIR / "app" / "services" / "expert_service.py",
    BACKEND_DIR / "app" / "services" / "expert_authoring.py",
    BACKEND_DIR / "app" / "db" / "experts.py",
]
MUTATING_HTTP_METHODS = {"post", "patch", "delete"}
HARDCODED_ROLE_VALUES = {"org-admin", "super-admin", "admin"}
```

⚠ The **new** `skill_body_authoring.py` is **not** in this list — so it is unfenced for role literals.
A plan may add it (one-line change, same commit) or state that it deliberately does not.

### T-5. ⚠ FINDING F-4 — the vitest mock-factory idiom, and the two shapes are NOT interchangeable

```
$ grep -rln 'vi.mock("@/lib/api/experts"' frontend/src
frontend/src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx
frontend/src/components/experts/__tests__/OrgExpertsTab.test.tsx
$ grep -rln 'vi.mock("@/lib/api/skills"' frontend/src
frontend/src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx
frontend/src/components/experts/__tests__/OrgExpertsTab.test.tsx
$ grep -rlc 'importActual' frontend/src/components/experts frontend/src/components/skills
frontend/src/components/skills/SkillFormDialog.test.tsx
```

**Shape A — CLOSED factory (both experts suites, `ExpertAuthoringStudio.test.tsx:6-32`).** ⛔ This is
exactly the Phase-196 `failed 249` shape: the factory returns a literal, so **any export the
component newly imports is `undefined` at mount** and the whole suite reds:

```tsx
vi.mock("@/lib/api/experts", () => ({
  createExpert: vi.fn(),
  updateExpert: vi.fn(),
  draftExpert: vi.fn(),
  getExpertGrants: vi.fn().mockResolvedValue([]),
  addExpertGrant: vi.fn(),
  removeExpertGrant: vi.fn(),
}))

vi.mock("@/lib/api/skills", () => ({
  listSkills: vi.fn().mockResolvedValue([
    { name: "ratio_calculator", description: "Calculates EBITDA" },
  ]),
}))
```

⛔ **Both suites mock BOTH modules.** Adding `draftSkillBody` to `lib/api/experts.ts` and importing it
in `ExpertAuthoringStudio.tsx` requires a new key in **two** factories, in the same commit —
`ExpertAuthoringStudio.test.tsx` **and** `OrgExpertsTab.test.tsx`. Same for any new `skills.ts`
export. ⚠ `OrgExpertsTab.test.tsx` does not even render the studio directly; it reds anyway if it
mounts anything that imports the new symbol.

**Shape B — `importActual` spread (`SkillFormDialog.test.tsx:38-45`).** Immune to the trap, because
unmocked exports pass through:

```tsx
const listSkillFiles = vi.fn().mockResolvedValue([])
const getPublishGate = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listSkillFiles: (...a: unknown[]) => listSkillFiles(...(a as [])),
    uploadSkillFile: (...a: unknown[]) => uploadSkillFile(...(a as [])),
    ...
  }
})
```

⭐ **Recommendation for the plan:** new experts-suite mocks use **Shape B**. Converting the two
existing closed factories is optional and out of D-263's scope — but if they are left as-is, the new
export keys are a **build obligation named in the plan**, not a discovery at merge.

Also note the supabase mock every dialog-mounting suite needs (`SkillFormDialog.test.tsx:19-30`):

```tsx
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" }, access_token: "token" } } }) },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))
```

### T-6. ⚠ FINDING F-7 — the count-gate knob entry shapes (RESEARCH §G.4's adoption, exactly)

**BASELINE key is the BASENAME; TARGETS is the FULL PATH.** The Phase-260/261 block, verbatim:

```js
// scripts/vitest-count-gate.cjs — BASELINE, :165-170
  // ── Phase 260 (PACK-02 / PACK-03) — Consultant Expert UI & Action Tiles ──
  "ComposerExpert.test.tsx": 5,
  "ExpertSpotlightCard.test.tsx": 5,
  // ── Phase 261 (PACK-07 / PACK-09 / PACK-10) — Expert Authoring Studio & Org Management ──
  "OrgExpertsTab.test.tsx": 5,
  "ExpertAuthoringStudio.test.tsx": 4,
```

```js
// scripts/vitest-count-gate.cjs — TARGETS, :4326-4331
  // ── Phase 260 (PACK-02 / PACK-03) — Consultant Expert UI & Action Tiles ──
  "src/components/chat/__tests__/ComposerExpert.test.tsx",
  "src/components/chat/__tests__/ExpertSpotlightCard.test.tsx",
  // ── Phase 261 (PACK-07 / PACK-09 / PACK-10) — Expert Authoring Studio & Org Management ──
  "src/components/experts/__tests__/OrgExpertsTab.test.tsx",
  "src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx",
```

⚠ **`SkillFormDialog.test.tsx` is NOT under a `__tests__/` directory** — it sits beside its component:

```
$ ls frontend/src/components/skills/
PublishGateDialog.test.tsx  SkillCard.test.tsx  SkillEvalSection.test.tsx
SkillFormDialog.test.tsx    SkillFormDialog.tsx  ...
```

So the adoption pair is:

```js
  // ── Phase 263 (PACK-14/PACK-15) — the dialog an Expert proposal reuses ──
  "SkillFormDialog.test.tsx": 8,                              // BASELINE (basename)
  "src/components/skills/SkillFormDialog.test.tsx",           // TARGETS  (full path, no __tests__)
```

⭐ **Both knobs, same commit as the edit** — the precedent comment block at `:4333-4339` says exactly
why, and the pin **raises** as the phase adds cases. A grand total that does not move after a phase
adds tests is the tell, not the reassurance.

---

## Shared Patterns

### S-1. Structured refusal envelope (server)
**Source:** `backend/app/services/entitlement_service.py:50-58` · `api/skills.py:585-588` ·
`api/connectors.py:1233-1239`
**Apply to:** the D-263-10 422 in `api/experts.py` (both POST and PATCH)
**Contract:** `detail={"detail": "<human sentence>", "error": "<snake_case_code>", "<payload_key>": <data>}`.
⭐ The inner `"detail"` key is required for the client's message path (F-3); `"error"` is what the
client discriminates on (FastAPI's own 422 body is a **list**, ours is a **dict**).

### S-2. Structured refusal carrier (client)
**Source:** `frontend/src/lib/api/skills.ts:63-99` (`PublishGateError`), base idiom
`lib/api/_core.ts:49-55` (`ApiError`)
**Apply to:** `createExpert` / `updateExpert` in `lib/api/experts.ts`
**Contract:** a named `Error` subclass with one `readonly` typed field, `this.name` set explicitly,
thrown from a status-discriminated arm **before** the generic handler; the `res.json()` parse wrapped
in `try/catch` with a fall-through to the generic message.

### S-3. Permission guard on every Expert mutation
**Source:** `api/experts.py:42-57` (`require_expert_manage`) + the router-level
`dependencies=[Depends(require_capability("experts"))]` (`:29-33`)
**Apply to:** every new `@router.post/.patch/.delete` in `api/experts.py`
**Contract:** declared as a **positional-or-keyword** parameter `current_user: dict[str, Any] = Depends(require_expert_manage)`
(F-6 — a keyword-only declaration is invisible to the AST fence and reads as unprotected).

### S-4. `forced_emit` call discipline
**Source:** `skill_proposer_service.py:391-406` · `expert_authoring.py:327-337`
**Apply to:** the new body-authoring driver
**Contract:** keyword-only args · `tools=_emit_tool(<emitter>, <Model>)` **imported from
`skill_tuner_service`** (never re-implemented) · `schema_model=<Model>` · `strict=False` ·
`system_prompt` non-empty (Anthropic 400s on an empty system block) · return `result.get("emitted")`,
`None` on honest fail, **never fabricated**.

### S-5. Live-DB test gate
**Source:** `backend/tests/integration/test_137_2_skill_creator_seed_content.py:53-100`
**Apply to:** D-263-13's Fence 1 and PACK-17 case 3 (the `skills_autofill_org_id` trigger drive,
RESEARCH §F.3 — a mock cannot exercise a Postgres trigger)
**Contract:** `_POSTGRES_TEST_DSN` env-with-default · `_pg_reachable` / `PG_AVAILABLE` /
module-level `pytestmark = pytest.mark.skipif(...)` · function-scoped `pg_pool` fixture ·
**SELECT-only unless the test owns its own cleanup** · an absent expected row is a HARD FAILURE with
a message naming the migration to apply, not a clean skip.

### S-6. Pending / not-yet-real visual state
**Source:** `frontend/src/components/org/OrgIdentity.tsx:66-69` + `OrgIdentity.test.tsx:100-108`
**Apply to:** the `⬡` proposal card
**Contract:** `border border-dashed border-primary/40 bg-primary/[0.06] text-primary`, asserted by
class token **with a negative arm** against the solid variant's tokens.

### S-7. Guarded draft-apply assignment
**Source:** `ExpertAuthoringStudio.tsx:230-235`
**Apply to:** `suggested_new_skills`
**Contract:** one `if (draft.<field>) set<Field>(draft.<field>)` line per optional field — no
destructuring, no defaults, no derivation client-side.

---

## No Analog Found

| File / concern | Role | Why there is no analog |
|---|---|---|
| Slicing the craft block out of a skill row's `instructions` | utility (inside the new driver) | ⛔ **Nothing in `backend/app/` parses a skill's instructions into sections.** `_handle_load_skill` (`tool_dispatcher.py:1305`) returns the body whole, into the open agent loop. The extractor is genuinely new code, and F-1 shows why it is delicate (the live 5th bullet mixes doctrine with tool choreography). ⭐ This is the single piece of this phase with no precedent — plan it with its own RED drive, not as a helper. |
| The `SkillFormDialog` **modal** mount in production | component wiring | F-5 — the modal has never been mounted outside its own test. Use the test's mount (`SkillFormDialog.test.tsx:106-113`) as the shape, and treat the mount as new surface. |

---

## Cross-check: findings that EXTEND or CORRECT `263-RESEARCH.md`

| # | Finding | Bearing |
|---|---|---|
| **F-1** | The live `skill-creator` `instructions` are **migration 089's**, not 087's — 088 and 089 each do a full `SET instructions = $INSTRUCTIONS$…$` rewrite. RESEARCH §1.3 quotes `087:100-105`; the 5th bullet's live heading is `Progressive disclosure — but know the limit.` and carries file-attach choreography. | ⛔ The Fence-1 token list must come from the LIVE row. Safe both-versions tokens listed in T-3. |
| **F-2** | `backend/tests/integration/test_137_2_skill_creator_seed_content.py` already reads row `…0010` live and asserts content markers — an exact analog RESEARCH does not name. | Supplies the id constant, the apply-gate idiom and the pool fixture for D-263-13 Fence 1 and PACK-17 case 3. |
| **F-3** | `lib/api/experts.ts:73-95` `handleResponse` throws `new Error(string)` — the 422's `unknown_skills` array is **discarded**. D-263-10's "client renders from the response" is not reachable through `createExpert`/`updateExpert` as they stand. | Needs the `PublishGateError` carrier (S-2). Also fixes the envelope: the inner `"detail"` key is what the message path reads. |
| **F-4** | Both experts suites use **closed** mock factories for `@/lib/api/experts` **and** `@/lib/api/skills`; only `SkillFormDialog.test.tsx` uses `importActual`. | Any new export imported by the studio needs a key in **two** factories, same commit — the Phase-196 `failed 249` shape. |
| **F-5** | `SkillFormDialog` (the modal) has **no production mount** — `SkillsPage.tsx:8` imports only `SkillDetailPanel`. | D-263-01 is its first production mount → new surface, own test. ⭐ But `SkillForm`'s flat controlled props confirm the `initialValues` change stays inside the dialog: `SkillForm` and `SkillDetailPanel` are untouched. |
| **F-6** | `_has_expert_manage_dependency` walks `fn_node.args.defaults` only — **keyword-only params are invisible**. | A `*`-separated guard declaration reads as UNPROTECTED and reds the 261 fence. Declare it like `draft_expert` does. |
| **F-7** | BASELINE keys are **basenames**, TARGETS are **full paths**, and `SkillFormDialog.test.tsx` is **not** under `__tests__/`. | The adoption pair is spelled out in T-6. |
| **F-8** | The dashed "pending" token string already exists (`OrgIdentity.tsx:69`) **with a token-asserting test**. | D-263-01's "dashed + violet, never red" is a copy, not a design decision. |

⚠ **One RESEARCH `[ASSUMED]` is settled by precedent rather than by argument:** A1 (`ON DELETE SET NULL`)
and A2 (partial index) are **both** what migration 188 already does for a nullable `expert_bundles`
FK. Quote 188 rather than reasoning it out.

⚠ **One RESEARCH open question is now closed by CONTEXT, and the analogs agree:** Open Question 3
(FLAG-01) was ratified as **D-263-14** — gate the generation path. The call shape is confirmed:
`from app.models.user_settings import self_improve_enabled` (function-local), `self_improve_enabled()`,
no args, **default-ON on a read failure**. ⛔ Note the polarity when writing the test: a mocked
settings-read *exception* leaves the path **enabled**, so a "disabled" test must patch the function
or the setting, never simulate a DB blip.

---

## Metadata

**Analog search scope:** `backend/app/services/` · `backend/app/api/` · `backend/app/db/` ·
`backend/app/models/` · `backend/tests/unit/` · `backend/tests/integration/` ·
`supabase/migrations/` · `frontend/src/components/{experts,skills,org}/` · `frontend/src/lib/api/` ·
`frontend/src/pages/` · `scripts/vitest-count-gate.cjs`

**Files read for excerpts (16):** `skill_proposer_service.py` · `skill_tuner_service.py` ·
`expert_authoring.py` · `api/experts.py` · `expert_service.py` · `db/experts.py` ·
`models/user_settings.py` · `test_259_expert_member_isolation.py` ·
`test_259_closed_core_inventory.py` · `test_261_single_expert_authoring_gate.py` ·
`test_137_2_skill_creator_seed_content.py` · `188_expert_chat_scoping.sql` ·
`189_expert_presentation_and_grants.sql` · `089_skill_creator_file_attach_honesty.sql` ·
`ExpertAuthoringStudio.tsx` + its test · `SkillFormDialog.tsx` + its test · `OrgIdentity.tsx` + its
test · `lib/api/experts.ts` · `lib/api/skills.ts` · `lib/api/_core.ts` · `pages/SkillsPage.tsx` ·
`types/index.ts` · `scripts/vitest-count-gate.cjs`

**Read-only guarantee:** no source file was modified; no git write command was run. All measurement
was `grep` / `sed` / `ls` over the working tree at `4ab6502ab` + the uncommitted state recorded in
this session's git status.

**Pattern extraction date:** 2026-09-21
