---
seed_id: SEED-258
title: The source size ceilings are hardcoded Python constants that disagreed with each other in production — they belong in Settings, bounded, with the reason and a recommendation on screen
created: 2026-09-08
planted_during: Phase 239 gap closure — the operator raised MAX_MCP_BODY_BYTES and immediately asked why a tunable operational limit is a constant at all
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - Phase 239 (SRC-04) — where the disagreement was found and the constant raised (`526759c58`)
  - CLAUDE.md — "Settings live in user_settings / app_settings and the Settings UI; env vars are for secrets and infra only"
  - `backend/app/services/mcp_client.py` — `MAX_MCP_BODY_BYTES`, a DoS guard on an untrusted server
  - `backend/app/services/sources/adapters/{mcp_source,google_drive,microsoft_graph}.py` — `MAX_FILE_BYTES` ×3
  - `backend/app/models/user_settings.py:198` — `multimodal_max_b64_bytes_kb`, the EXISTING precedent for a numeric byte knob
  - SEED-257 — the other Phase 239 seed; both are about MCP limits nobody can see
trigger_when: >
  ANY of: (a) a person reports that a file they consider normal "won't import" from any connected
  source — this is the user-visible symptom and it will arrive before anyone goes looking; (b) a
  FIFTH size constant is added, or a fourth source family lands and copies `MAX_FILE_BYTES` a third
  time; (c) any Settings phase touches `app_settings` and could carry this cheaply; (d) a deployment
  needs a different ceiling from local — a cloud tenant with larger documents is the obvious case,
  and today that requires a code change and a redeploy.
---

# SEED-258 — a ceiling nobody can see, set by a number nobody can change

## What happened, and why a constant was the wrong home

Phase 239 shipped MCP as a source family. Two constants governed how large a file could be:

| Constant | Value | Governs |
|---|---|---|
| `mcp_source.MAX_FILE_BYTES` | 25 MB | the decoded file — deliberately equal to `google_drive.py` and `microsoft_graph.py` (TM-239-03) |
| `mcp_client.MAX_MCP_BODY_BYTES` | **2 MB** | the whole JSON-RPC response |

MCP carries file content **inside** the envelope, base64-inflated 4/3. So the real ceiling was
**~1.5 MB**, the 25 MB one **could never fire**, and a 3 MB PDF failed with a transport error naming
a byte cap rather than a plain "this file is too large". Raised to 34 MB at `526759c58`.

⚠ **The interesting part is not the bug, it is why it was invisible.** Both numbers were
*individually defensible* — 2 MB is a sane DoS guard against an untrusted remote server, 25 MB is the
app's own upload ceiling. **Nothing was wrong with either constant. What was wrong was the relation
between them, and a relation has no home in a file of constants.** Phase 239 closed that specific gap
with a test pinning the two IN RELATION. This seed is about the general case.

## Why Settings, in the project's own words

CLAUDE.md: *"Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for
secrets and infra only."* A size ceiling is neither a secret nor infra — it is an operational limit an
operator should be able to see and tune. **Today changing it requires a code edit and a redeploy**,
which also means local and cloud cannot differ without a branch.

⚠ **And the thing an operator most needs is not the number — it is the REASON.** The current values
are explicable only by reading two Python files and knowing that base64 inflates 4/3. That is the
actual failure: not that the value was low, but that **nobody could see what it was or why**.

## The design, so this is ready to build rather than re-derived

**Precedent to follow, not invent:** `user_settings.py:198` already carries
`multimodal_max_b64_bytes_kb: int = 4096`, read through `_val(row, key, None, default)`. Same shape.

- **Home:** `app_settings` (a global singleton, RLS disabled — `backend/app/api/settings.py:25`), not
  `user_settings`. ⛔ **This must NOT be per-user.** A DoS guard a user can raise for themselves is not
  a guard.
- **One knob, not two.** Expose the **file ceiling** — the number a person thinks in ("how big a file
  can I import"). ⛔ **The envelope cap is DERIVED from it**, server-side, as `ceiling × 4/3 +
  headroom. Never a second field.** Exposing both re-creates exactly the disagreement this seed exists
  because of.
- **Bounds enforced SERVER-SIDE, not in the form.** A floor (a ceiling of 0 disables ingestion), and a
  hard maximum the setting cannot exceed no matter what is posted. ⚠ The form is a convenience; the
  API is the boundary. A `PATCH` with `999999999` must be refused by the backend.
- **The three adapters read the setting** rather than each holding their own copy. ⚠ `MAX_FILE_BYTES`
  is currently duplicated across three files and was correct in all three **by coincidence of careful
  authorship** — the fourth family is where that luck runs out.
- **On-screen copy — the whole point of the seed.** State the current value, that it applies to every
  connected source, and **what raising it costs**: more memory buffered per in-flight request from a
  server we do not control. A recommendation ("25 MB suits most document workloads") next to a plain
  statement of the tradeoff. ⛔ **Not a bare number field.**

## How we would know this was answered badly

- Two fields appear (file size **and** envelope size) — the original defect, now user-operable.
- The knob lands in `user_settings`, so a user can raise a DoS guard for themselves.
- Bounds are enforced only in the React form.
- The setting ships with no explanation of the cost, which leaves the operator exactly as blind as the
  constant did — **the problem was never the number**.
- A fourth source family adds a fourth hardcoded `MAX_FILE_BYTES`.

## Explicitly NOT done in Phase 239

⛔ **G-7:** *"a closure round may NEVER introduce a new user-facing capability: that is a phase, not a
gap."* A Settings knob with bounds, derived values, migration and copy is a phase. Phase 239 raised
the constant and pinned the relation; that is the gap-sized part, and it is done.
