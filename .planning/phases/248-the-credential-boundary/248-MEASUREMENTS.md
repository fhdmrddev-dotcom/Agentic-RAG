---
type: measurement-pack
phase: 248
phase_name: The Credential Boundary
measured: 2026-09-14
author: claude
source: production (Supabase MCP, READ-ONLY — no write attempted, no exploit run)
kind: measurement-no-recommendations
---

# Phase 248 — measurement pack

⛔ **No recommendations by design.** `CRED-03`'s decisions are the operator's. This pack establishes
**facts** so the phase plans against measurement rather than against the advisor's summary line.
Everything below was read from **production** with read-only queries.

---

## 1 · ⭐ `CRED-03` — the trap splits the 15 functions into THREE groups, not one

`CRED-03` says *"each of the advisor's 13 anon-executable findings is either revoked or recorded as
intentionally public."* The advisor reports a count. **The ACL reports the mechanism, and the
mechanism differs between them** — so a single uniform migration would half-work.

**Postgres ACL notation:** an entry whose grantee is **empty** (`=X/postgres`) is the grant to
**`PUBLIC`**. `anon=X/postgres` is an explicit grant to the `anon` role. The two require *different*
remedies, and that is the whole of the trap already recorded in `CLAUDE.md`:

> `REVOKE … FROM anon` changes nothing while the `PUBLIC` grant stands — measured when migration
> 177's first version applied cleanly and verify still read `FAIL`.

### Group A — **PUBLIC grant present** (11 functions) · ⛔ `REVOKE … FROM anon` is a NO-OP here

ACL carries `=X/postgres`. **Revoke from `PUBLIC` first, then grant back what genuinely needs it.**

| Function | Args | Shape |
|---|---|---|
| `capture_skill_version` | — | trigger fn |
| `handle_new_user` | — | trigger fn |
| `stale_skill_embedding` | — | trigger fn |
| `stale_skill_embedding_from_case` | — | trigger fn |
| `connection_doc_is_visible` | `p_source_connection_id uuid, p_ingest_visibility text` | RLS helper |
| `current_user_has_permission` | `p_org_id uuid, p_permission_key text` | RLS helper |
| `current_user_org_ids` | — | RLS helper |
| `folder_is_org_shared` | `p_folder_id uuid` | RLS helper |
| `keyword_search_chunks` | `search_query text, match_user_id uuid, …` | app RPC |
| `match_document_chunks` | `query_embedding vector, match_user_id uuid, …` | app RPC |
| `match_skills` | `query_embedding vector, match_user_id uuid, …` | app RPC |

### Group B — **NO PUBLIC grant; explicit `anon` + `authenticated` grants** (2 functions) · ✅ a plain `REVOKE … FROM anon` DOES work

| Function | Args | ACL |
|---|---|---|
| `autofill_org_id_by_owner` | — | `postgres=X \| anon=X \| authenticated=X \| service_role=X` |
| `autofill_org_id_from_parent` | — | `postgres=X \| anon=X \| authenticated=X \| service_role=X` |

### Group C — **already locked down** (2 functions) · nothing owed

| Function | ACL | `anon` | `authenticated` |
|---|---|---|---|
| `create_org_with_default_dept` | `postgres=X \| service_role=X` | false | false |
| `resize_embedding_column` | `postgres=X \| service_role=X` | false | false |

⭐ `resize_embedding_column` is in Group C because **migration 177 already fixed it** — the
destructive RPC `BUG-260911-01` named. Its presence here is confirmation that the Group A remedy
shape works, since 177 had to revoke from `PUBLIC` to get there.

---

## 2 · A second cut of the same 15, by whether RPC exposure is intended at all

⚠ **This cut is orthogonal to §1 and is where the judgement lives.** Revoking is mechanical;
deciding *who should be able to call each* is not.

**Six are TRIGGER functions with zero arguments, reachable at `/rest/v1/rpc/<name>`:**
`autofill_org_id_by_owner` · `autofill_org_id_from_parent` · `capture_skill_version` ·
`handle_new_user` · `stale_skill_embedding` · `stale_skill_embedding_from_case`

A trigger function is invoked by Postgres on a row event. **Nothing in the app calls these over
PostgREST**, so RPC exposure appears to be an artifact of the default grant rather than a decision.
⚠ **Stated as an observation, not a finding** — a caller has not been searched for, and "appears to
be" is exactly the kind of phrase this project has been burned by. **Confirm by grep before acting.**

**Seven are RLS helpers or app RPCs** where `authenticated` access is plausibly load-bearing:
`connection_doc_is_visible` · `current_user_has_permission` · `current_user_org_ids` ·
`folder_is_org_shared` · `keyword_search_chunks` · `match_document_chunks` · `match_skills`

⚠ **`match_document_chunks`, `keyword_search_chunks` and `match_skills` were ALREADY examined once**
— migration 177's own analysis found they filter on `auth.uid()` and **not** on their
`match_user_id` argument, so under `anon` (where `auth.uid()` is NULL) they return nothing. The
v3.4 one-way door holds. **That analysis should be re-read, not redone.**

---

## 3 · `CRED-01` — still live, re-confirmed

`custom_client_id` is a bare `str | None = None` at `backend/app/models/connector.py` **244, 351,
558** — no pattern, no length bound, no shape check. `config` is `SELECT`-able org-wide by
`authenticated` while `secret_ciphertext` is not.

⛔ **The fence must make at least one assertion AS `anon` (or as a plain `authenticated` user), not
through the service role.** Every gate in this project reads through the service role, which is
precisely the blind spot that hid `BUG-260911-01` from all of them.

---

## 4 · Baselines — ⚠ NOT captured yet

Deliberately left empty. They must be taken **on the phase's own base commit**, immediately before
the first source edit, and this pack predates that commit.

⚠ When taken: **if the backend reads above 71, read `SEED-274` before attributing it to the diff** —
that ceiling measured 71 / 72 / 72 / 77 on one tree and is not a stable property of the suite.

---

## 5 · Hot-file ledger — files 248 is likely to touch

Re-derive with the documented recipe at the phase's base commit; these are from 2026-09-14 and this
project's own repeated finding is that a figure written at a close goes stale on the next commit.

| File | Ledger row says | Note |
|---|---|---|
| `backend/app/models/connector.py` | `26 / 14 / 835` | `CRED-01`'s home — the three bare `custom_client_id` declarations |
| `backend/app/api/connectors.py` | `44 / 21 / 2140` | ⛔ **extraction OWED at its sixth landing.** 247 fenced it at ZERO lines; if 248 must land there, the extraction is proposed FIRST |
| `backend/app/security/secret_cipher.py` | `4 / 2 / 256` | ⛔ `SECRET_COLUMNS` is the ONE encrypt-on-write set — a provider-key column absent from it is stored **plaintext** and nothing says so |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | `28 / 10 / 2477` | wider `ConnectionShapeFields.tsx` seam still OWED |
| `frontend/src/components/settings/connectionFormCopy.ts` | `19 / 8 / 1631` | `CRED-01`'s refusal copy |

---

## 6 · Migration

Next free slot is **181**. Apply by **pasting into the Supabase SQL editor** — never `db push` /
`db reset` — then `bash scripts/regenerate-full-schema.sh`.

⛔ **Cloud is a separate approval.** Supabase MCP **reads are free**; **every write against
production needs explicit per-action operator approval.** ⚠ And the flag: `.mcp.json` currently
carries `read_only=true`, so an MCP write is not merely ungoverned — it is **impossible** from here.
`CLAUDE.md` says the flag was removed on 2026-09-11; against the tracked file that is **false**.

---

## 7 · What this pack deliberately does not contain

- **No recommendations.** `CRED-03`'s per-function ruling is the operator's.
- **No baselines** — see §4.
- **No claim that the six trigger functions are safe to revoke.** §2 says *appears*; a caller search
  has not been run.
