---
phase: 231
slug: connection-scoped-visibility
status: prework
author: claude (BUILDER on this phase — see AGENTS.md §3.1)
reviewer: gemini
date: 2026-09-05
source_changes: none — this document is docs-only by design
---

# Phase 231 — Pre-work: the four sites, measured

> ⚠ **Docs-only, deliberately.** `AGENTS.md` §6.1: the reviewer captures baselines **before** the
> builder touches anything. Gemini has not confirmed a 231 baseline, so nothing here changes a source
> file, a migration, or a gate. Everything below is **measurement of what already exists**.

⭐ **Claude builds this phase by the ratified test, not by preference.** `AGENTS.md` §3.1 makes a phase
Claude-built if it hits **any one** trigger; 231 hits **three** — #3 the permission/approval model
(*"a permission bug is a security bug"*), #4 a migration that commits a table shape, and #5 anything
that can fail OPEN.

---

## 1. The four sites — measured live, not read from a doc

`ROADMAP` names four sites that must widen in lockstep. All four were read out of the running database
via `pg_policies` / `pg_get_functiondef`.

| # | Site | Kind |
|---|---|---|
| 1 | `documents` — *"Users can view own or global-folder documents"* | RLS policy, SELECT, `authenticated` |
| 2 | `document_chunks` — its SELECT policy | RLS policy |
| 3 | `match_document_chunks` | `SECURITY DEFINER = true` |
| 4 | `keyword_search_chunks` | `SECURITY DEFINER = true` |

### ⭐ THE FINDING THAT MAKES THIS PHASE TRACTABLE — all four already carry the SAME predicate

Site 1, verbatim:

```sql
(org_id IN (SELECT current_user_org_ids()))
AND ((auth.uid() = user_id)
     OR ((folder_id IS NOT NULL) AND folder_is_org_shared(folder_id)))
```

Sites 3 and 4, verbatim from the function definitions:

```sql
WHERE dc.org_id = ANY (SELECT public.current_user_org_ids())   -- D-164-01 org gate
  AND (                                                        -- PRAG-01 within-org visibility
        dc.user_id = auth.uid()                                --   owner
     OR (d.folder_id IS NOT NULL AND public.folder_is_org_shared(d.folder_id))
  )
```

**The org gate and the two-arm disjunction are identical in shape at every site.** So this phase's job
is to add **one more arm to one disjunction, in four places** — not to design four predicates. That is
what makes `H-1`'s one-transaction requirement realistic rather than aspirational.

⚠ **Both DEFINER bodies also filter `AND d.is_latest = true`** — exactly as the ROADMAP warned. A row
minted without `is_latest` is invisible to retrieval while the Library lists it. **Phase 229 already
fixed the minting path** (`mint_document_row` sets `is_latest=True`, proven by driving at 229's
verification), which is why 229 had to come first. **No further action here — recorded so it is not
re-derived.**

---

## 2. ⚠ The `is_org_shared` "collision" is NOT what the 229 pre-flight thought — it is narrower, and it is REAL

The Phase 229 pre-flight (G-1) flagged the flat `folders.is_org_shared` **column** and the recursive
`folder_is_org_shared()` **function** as *"two definitions of one word"*, and handed 231 the job of
resolving it. **Measured, that framing is wrong in a way worth correcting** — because the wrong framing
would have produced the wrong fix (unifying two things that should not be unified).

**They are not two definitions of one word. They are a node and a tree:**

```sql
CREATE OR REPLACE FUNCTION public.folder_is_org_shared(p_folder_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT id, parent_id, is_org_shared FROM public.folders WHERE id = p_folder_id
    UNION ALL
    SELECT f.id, f.parent_id, f.is_org_shared
      FROM public.folders f INNER JOIN ancestors a ON f.id = a.parent_id
  )
  SELECT COALESCE(bool_or(is_org_shared), false) FROM ancestors;
$$
```

The **column** means *"this folder node is marked shared"*. The **function** means *"this folder or any
ancestor is shared"*. The function is the correct accessor; the column is its per-node input.
**Nothing needs unifying.**

### ⛔ But there IS a defect underneath it, at exactly two places

`folder_is_org_shared()` is **never called from Python at all** — a grep over `backend/app` returns
zero call sites. It lives only inside SQL. Meanwhile **two Python sites read the flat column where the
recursive answer is the correct one**, both validating a folder as a *move target*:

| Site | Code |
|---|---|
| `backend/app/api/documents.py:1640` | `.or_(f"user_id.eq.{current_user['id']},is_org_shared.eq.true")` |
| `backend/app/api/documents.py:1817` | `.or_(f"user_id.eq.{caller_uid},is_org_shared.eq.true")` |

**Consequence, stated concretely.** A folder shared only by **inheritance** — its parent carries
`is_org_shared = true`, its own row is `false` — is:

- **readable** for documents (sites 1–4 use the recursive function), but
- **rejected as a move target with a 404** (these two use the flat column).

**So a user can see a shared subfolder and cannot move a document into it.**

✅ **It fails CLOSED**, so it is a usability defect and not a leak — which is exactly why it has
survived unnoticed. It is **recorded here rather than fixed**, because fixing it is outside
`VIS-01` / `VIS-02` / `TRUST-04` and this phase must not quietly grow.

⚠ **It does bind 231 in one specific way.** The new connection-scoped arm must be added **beside**
`folder_is_org_shared(...)` at all four SQL sites, and must **not** be copied into these two Python
sites as a third flat read. **A per-connection flat read would fail OPEN, not closed** — the direction
that leaks.

Every other `is_org_shared` hit is correct and is **not** part of this: `skills.py` (the `skills` table
has no tree, so flat is right), `folders.py` (toggling the node itself), `kb.py` (display).

---

## 3. D-5 — the inert department dimension (operator, 2026-09-05)

**Decided: the predicate carries a department branch that is present but inert.**

- Scope resolves to **`mine | org`** today; the **`dept` branch is written and defaults to org-wide**
  until `dept_members` has rows. Measured: **0 rows**, and exactly **one** table carries `dept_id`
  against **46** carrying `org_id`.
- **No behavioural change ships.** No UI, no grant path, no third state a user can see.
- **Why it could not wait:** a second scope added *after* the predicate is set is a **re-ingest, not a
  migration** — the same logic `SEED-210` applies to source ACLs.
- ⚠ **The fence:** *inert* means inert. If a plan finds itself building `dept_members` management, that
  is a different phase and it has not been scoped.

---

## 4. What this phase still owes before it can be planned or built

| # | Obligation | Blocks |
|---|---|---|
| 1 | **G-2 sketch** — `VIS-02`'s plain sentence **is** the deliverable, not decoration | ⛔ planning |
| 2 | **Threat model** — MANDATORY per ROADMAP | planning |
| 3 | Reviewer baseline captured by Gemini **before** any source change | ⛔ building |
| 4 | Ledger row for `retrieval_service.py` (**17/9/362** — fires G-5, absent its entire life) due **in this phase's commit** | the commit |
| 5 | Pitfall 1's *narrower-of-two* predicate — ROADMAP flags it as needing a concrete design, not a sketch | planning |
| 6 | `SEED-211`'s M-Files model **recorded with a migration path, NOT built** | the decision log |

⚠ **Obligations 1 and 3 are independent blockers on different halves.** The sketch blocks *planning*;
the reviewer baseline blocks *building*. Doing one does not unblock the other.

---

## 5. Nothing here changed a source file

No migration was written, no policy altered, no function replaced — **site inventory only**. So
Gemini's baseline, whenever it is taken, is still a baseline of untouched code.
